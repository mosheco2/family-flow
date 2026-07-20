// Oneflow Life - Family Logic Application

function fmtGroupName(g) {
  if (!g) return '';
  const nickname = g.family_nickname || g.familyNickname || '';
  return nickname ? `${g.name} (${nickname})` : (g.name || '');
}
function fmtUserName(u) {
  if (!u) return '';
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ');
  return full || u.nickname || '';
}

const introStyle = document.createElement('style');
introStyle.innerHTML = `.introjs-showElement{z-index:9999998!important;transform:none!important;}.introjs-fixParent{z-index:auto!important;opacity:1.0!important;transform:none!important;filter:none!important;}body.introjs-active .slider-container,body.introjs-active .slider-scroll,body.introjs-active .overflow-hidden{overflow:visible!important;}body.introjs-active header.sticky{z-index:1!important;}.introjs-overlay{z-index:9999996!important;}.introjs-helperLayer{z-index:9999997!important;}.introjs-tooltipReferenceLayer{z-index:9999998!important;}.introjs-tooltip{z-index:9999999!important;}@media (max-width:768px){.introjs-tooltipReferenceLayer{position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;margin:0!important;right:auto!important;bottom:auto!important;width:90vw!important;}.introjs-tooltip{position:relative!important;max-width:350px!important;margin:0 auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;}.introjs-arrow{display:none!important;}}.introjs-tooltip{font-family:'Rubik',sans-serif!important;border-radius:2rem!important;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)!important;padding:1.5rem!important;border:none!important;overflow:hidden!important;text-align:center!important;}.introjs-tooltip::before{content:'';position:absolute;top:0;left:0;right:0;height:8px;background:linear-gradient(to right,#3b82f6,#a855f7);}.introjs-tooltipbuttons{border-top:none!important;padding-top:1rem!important;display:flex;gap:0.5rem;justify-content:center;}.introjs-button{border-radius:0.75rem!important;text-shadow:none!important;font-weight:bold!important;font-family:'Rubik',sans-serif!important;padding:0.75rem 1.5rem!important;flex:1;text-align:center;}.introjs-nextbutton{background-color:#3b82f6!important;color:white!important;border:none!important;box-shadow:0 10px 15px -3px rgba(59,130,246,0.3)!important;}.introjs-prevbutton{color:#64748b!important;background:#f8fafc!important;border:1px solid #e2e8f0!important;}.introjs-skipbutton{color:#94a3b8!important;font-weight:500!important;background:transparent!important;}.introjs-bullets ul li a.active{background:#3b82f6!important;}`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

const getEl = id => document.getElementById(id);
const val = id => getEl(id) ? getEl(id).value : '';
const safeStr = str => (str || '').toString().replace(/'/g, "\\'").replace(/"/g, "&quot;");

let currentUser = null; let currentGroup = null; let pollInterval = null;
let membersCache = []; let shoppingListCache = []; let wisdomCache = {}; let categoryMapCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let shopMultiDeleteMode = false; let pantryMultiDeleteMode = false;

function getCatScore(name, normalized) {
    const lookups = [normalized, name].filter(Boolean);
    for (const n of lookups) {
        for (const [cat, items] of Object.entries(PRODUCT_DB)) {
            if (items.includes(n)) return cat;
            if (items.some(p => n.includes(p) || (p.split(' ')[0].length > 2 && n.includes(p.split(' ')[0])))) return cat;
        }
        if (categoryMapCache[n]) return categoryMapCache[n];
    }
    return 'שונות';
}
let allTasks = []; let allTransactions = []; let feedCache = [];
let forecastCache = { startingBalance: 0, items: [] };
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let forceTourStart = false;
let forecastRatioChart = null;
let currentForecastMode = 'monthly';
let currentScanTarget = ''; 

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

function setupPwaInstallSection() {
    const section = getEl('pwa-install-section'); const iosDiv = getEl('pwa-ios-instructions'); const androidDiv = getEl('pwa-android-instructions'); const btnInstall = getEl('btn-install-pwa');
    if(!section || !iosDiv || !androidDiv || !btnInstall) return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS) { iosDiv.classList.remove('hidden'); androidDiv.classList.add('hidden'); } 
    else {
        iosDiv.classList.add('hidden'); androidDiv.classList.remove('hidden');
        btnInstall.onclick = async () => {
            if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') section.classList.add('hidden'); deferredPrompt = null; } 
            else showToast('info', 'כדי להתקין, פתחו את תפריט הדפדפן ובחרו "התקן אפליקציה".');
        };
    }
}

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];
const CATEGORIES = { 
    income: [ {value:'salary',label:'💼 משכורת'}, {value:'allowance',label:'💰 דמי כיס'}, {value:'bonus',label:'🌟 בונוס'}, {value:'gift',label:'🎁 מתנה'}, {value:'business',label:'🚀 עסק'}, {value:'other',label:'💸 אחר'} ], 
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

const hidePreloaderAndShowAuth = (view = 'login') => {
    getEl('auth-container').classList.remove('hidden'); 
    const mw = getEl('main-wrapper'); if(mw) mw.classList.remove('hidden');
    switchView(view);
    const preloader = getEl('app-preloader');
    if (preloader) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => preloader.classList.add('hidden'), 700); }
};

window.onload = async () => {
    initAccessibility();
    const btnMonthly = getEl('btn-forecast-monthly'); const btnYearly = getEl('btn-forecast-yearly');
    if(btnMonthly) btnMonthly.addEventListener('click', () => toggleForecastMode('monthly')); if(btnYearly) btnYearly.addEventListener('click', () => toggleForecastMode('yearly'));

    const failsafeTimer = setTimeout(() => { const preloader = getEl('app-preloader'); if (preloader && !preloader.classList.contains('hidden')) { hidePreloaderAndShowAuth('login'); } }, 7000);
    const urlParams = new URLSearchParams(window.location.search); const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    if (inviteCode) { getEl('join-code').value = inviteCode; if(inviteRole) { getEl('join-role').value = inviteRole; try { setJoinRole(inviteRole); } catch(e) {} } clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('join'); return; }

    // מביא ads מוקדם — splash צריך להופיע לכולם (גם אנונימי/אינקוגניטו)
    const adsPromise = fetchAds().catch(()=>{});

    const savedSAToken = localStorage.getItem('ofl_sa_token');
    const savedSession = localStorage.getItem('ofl_session');

    // תמיכה בהשתלטות: אם יש סשן לקוח פעיל, נטען אותו קודם גם אם אנחנו סופר-אדמין
    if(savedSession) {
        try {
            const session = JSON.parse(savedSession);
            if(session && session.user && session.group) {
                if (session.group.type === 'BUSINESS') { window.location.href = '/business.html'; return; }
                currentUser = session.user; currentGroup = session.group;
                // שחזור לוגו קבוצה ממפתח נפרד (למנוע ניפוח הסשן)
                if (currentGroup.id) { const cl = localStorage.getItem(`ofl_logo_${currentGroup.id}`); if(cl) currentGroup.image_url = cl; }
                // אם יש splash פעיל מ-cache — ממתינים לסיום האנימציה לפני מעבר לדאשבורד
                if (window.__splashPreload) { await new Promise(r => setTimeout(r, 2800)); }
                clearTimeout(failsafeTimer); loadDashboard(); return;
            }
        } catch(e) { localStorage.removeItem('ofl_session'); }
    }

    // אין סשן — מחכים ל-fetch ads ואז מציגים splash אם קיים, לאחר מכן login
    await adsPromise;
    const hasSplash = _adsCache && _adsCache.splash && _adsCache.splash.active && _adsCache.splash.img;
    if (hasSplash) { await new Promise(r => setTimeout(r, 3000)); }
    clearTimeout(failsafeTimer); hidePreloaderAndShowAuth('login');
};

window.exitImpersonation = function() {
    localStorage.removeItem('ofl_session');
    window.location.reload();
};



function showToast(t,m) { const el=getEl('toast'); const icon = getEl('toast-icon'); el.classList.remove('hidden'); getEl('toast-message').innerText=m; icon.className=t==='success'?'fa-solid fa-check text-green-400':t==='info'?'fa-solid fa-circle-info text-blue-400':'fa-solid fa-xmark text-red-400'; setTimeout(()=>el.classList.add('hidden'),3500); }
function showOrderStatusToast(orderId, storeName, statusText, isDelivery) {
    let n = document.getElementById('order-status-notif');
    if (!n) { n = document.createElement('div'); n.id = 'order-status-notif'; document.body.appendChild(n); }
    n.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:999999;min-width:260px;max-width:88vw;direction:rtl;';
    const icon = isDelivery ? '🛵' : '🏃';
    const borderColor = isDelivery ? '#6366f1' : '#10b981';
    const textColor = isDelivery ? '#6366f1' : '#059669';
    const bgColor = isDelivery ? '#eef2ff' : '#ecfdf5';
    n.innerHTML = `<div style="background:#fff;border:1.5px solid ${borderColor};border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.12);padding:12px 16px;display:flex;align-items:center;gap:12px;animation:slideUpIn 0.3s ease;">
        <div style="width:40px;height:40px;border-radius:12px;background:${bgColor};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${icon}</div>
        <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:800;color:#1e293b;">עדכון הזמנה #${orderId}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${storeName}</div>
            <div style="font-size:13px;font-weight:700;color:${textColor};margin-top:3px;">${statusText}</div>
        </div>
        <button onclick="document.getElementById('order-status-notif').remove()" style="font-size:16px;color:#94a3b8;background:none;border:none;cursor:pointer;padding:4px;flex-shrink:0;">✕</button>
    </div>`;
    if (n._hideTimer) clearTimeout(n._hideTimer);
}
function toggleLoader(a,s) { const txt = getEl(`btn-${a}-text`); const ldr = getEl(`btn-${a}-loader`); if(txt && ldr) { txt.classList.toggle('hidden',s); ldr.classList.toggle('hidden',!s); } }
function triggerConfetti() { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }



function applyBannersToDOM(banners) {
    const appTop = getEl('app-banner-top'); const appBottom = getEl('app-banner-bottom');
    const placeholder = getEl('app-banner-placeholder');
    const topWrap = getEl('app-banner-top-wrap');
    
    const renderBanner = (el, text, link, img, isTop = false) => {
        if(!el) return;
        
        const formatImgSrc = (imgStr) => {
            if(!imgStr) return '';
            if(imgStr.startsWith('data:image') || imgStr.startsWith('http')) return imgStr;
            return '/' + imgStr;
        };

        if(text || img) {
            let html = '';
            if(img) {
                const imgSrc = formatImgSrc(img);
                // Changed from object-cover to object-contain, adjusted sizes
                html += `<img src="${imgSrc}" alt="Ad" class="absolute inset-0 w-full h-full object-contain opacity-100 z-0 block">`;
            }
            if(text) {
                const bgStyle = img ? 'bg-slate-900/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-white' : 'p-3 block w-full text-center text-slate-800';
                html += `<div class="relative z-10 ${bgStyle}">${text}</div>`;
            }
            el.innerHTML = html;
            el.href = link || '#';
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; }
            el.classList.remove('hidden'); el.classList.add('flex');
            if(isTop) { if(placeholder) placeholder.classList.add('hidden'); if(topWrap) { topWrap.classList.remove('hidden'); topWrap.classList.add('flex'); } }
        } else {
            el.classList.add('hidden'); el.classList.remove('flex');
            if(isTop) { if(topWrap) { topWrap.classList.add('hidden'); topWrap.classList.remove('flex'); } }
        }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img, true); 
    renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}
async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners?type=FAMILY`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

let _adsCache = null;

// מוסיף טרנספורמציה של Cloudinary לאיכות מיטבית בגודל מתאים לתצוגה
function cldOptimize(url, { w = 800, q = 'auto:best' } = {}) {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    return url.replace(/\/upload\/(?!.*\/upload\/)/, `/upload/c_fit,w_${w},q_${q}/`);
}

async function fetchAds() {
    try {
        // טען כיתוב preloader מ-cache
        const cachedText = localStorage.getItem('ofl_preloader_text');
        if(cachedText) { const el = document.getElementById('preloader-loading-text'); if(el) el.textContent = cachedText; const el2 = document.getElementById('preloader-loading-text-splash'); if(el2) el2.textContent = cachedText; }
        const cached = localStorage.getItem('ofl_ads'); if(cached) { try { _adsCache = JSON.parse(cached); applyAdsToDOM(_adsCache); } catch(e) {} }
        const res = await fetch(`${API}/ads`); const data = await res.json();
        if(data.success && data.slots) { _adsCache = data.slots; localStorage.setItem('ofl_ads', JSON.stringify(data.slots)); applyAdsToDOM(data.slots); }
        // טען כיתוב preloader מהשרת (נתיב ציבורי)
        try {
            const sr = await fetch(`${API}/public/settings/preloader_text`); const sd = await sr.json();
            if(sd.value) { localStorage.setItem('ofl_preloader_text', sd.value); const el = document.getElementById('preloader-loading-text'); if(el) el.textContent = sd.value; const el2 = document.getElementById('preloader-loading-text-splash'); if(el2) el2.textContent = sd.value; }
        } catch(e2){}
    } catch(e) {}
}

function renderAdSlot(slotKey, imgEl, linkEl, wrapEl, placeholderEl, cldW) {
    const slot = _adsCache && _adsCache[slotKey];
    const hasAd = slot && slot.active && slot.img;
    // container always visible
    if(wrapEl) wrapEl.classList.remove('hidden');
    if(hasAd) {
        if(imgEl) imgEl.src = cldOptimize(slot.img, { w: cldW || 800 });
        if(linkEl) { linkEl.href = slot.link || '#'; linkEl.classList.remove('hidden'); }
        if(placeholderEl) placeholderEl.classList.add('hidden');
    } else {
        if(linkEl) linkEl.classList.add('hidden');
        if(placeholderEl) placeholderEl.classList.remove('hidden');
    }
}

function applyAdsToDOM(slots) {
    _adsCache = slots;
    // preloader splash — מציג תמונה במסגרת האפליקציה + spinner
    const splashAd = getEl('preloader-splash-ad');
    if(slots.splash && slots.splash.active && slots.splash.img) {
        const def = getEl('preloader-default');
        if(def) def.classList.add('hidden');
        if(splashAd) { splashAd.href = slots.splash.link || '#'; splashAd.classList.remove('hidden'); }
        const spinnerWrap = getEl('preloader-spinner-wrap');
        if(spinnerWrap) spinnerWrap.classList.remove('hidden');
        const si = getEl('preloader-splash-img');
        if(si && si.getAttribute('src') !== slots.splash.img) { si.src = cldOptimize(slots.splash.img, {w:900}); }
        requestAnimationFrame(() => {
            const bar = getEl('preloader-splash-bar');
            if(bar) { bar.style.width = '0%'; requestAnimationFrame(() => { bar.style.width = '100%'; }); }
        });
    }
    // splash עסק (business.html)
    if(slots.splash_biz && slots.splash_biz.active && slots.splash_biz.img) {
        const defB = getEl('preloader-default-biz'); if(defB) defB.classList.add('hidden');
        const splashB = getEl('preloader-splash-biz'); if(splashB) { splashB.href = slots.splash_biz.link || '#'; splashB.classList.remove('hidden'); }
        const spinB = getEl('preloader-spinner-biz'); if(spinB) spinB.classList.remove('hidden');
        const siB = getEl('preloader-splash-biz-img'); if(siB && siB.getAttribute('src') !== slots.splash_biz.img) siB.src = cldOptimize(slots.splash_biz.img, {w:900});
        requestAnimationFrame(() => { const b = getEl('preloader-splash-biz-bar'); if(b) { b.style.width='0%'; requestAnimationFrame(()=>{ b.style.width='100%'; }); } });
    }
    // balance side (w-2/3 of ~370px ≈ 247px → serve 600px for 2× sharpness)
    renderAdSlot('balance_side', getEl('ad-slot-balance-side-img'), getEl('ad-slot-balance-side'), getEl('ad-slot-balance-side'), getEl('ad-slot-balance-side-placeholder'), 600);
    // child home ad (same slot, mirrored to child header)
    renderAdSlot('balance_side', getEl('ad-slot-child-home-img'), getEl('ad-slot-child-home'), getEl('ad-slot-child-home'), getEl('ad-slot-child-home-placeholder'), 600);
    // flow (full-width banner, serve 900px)
    renderAdSlot('flow', getEl('ad-slot-flow-img'), getEl('ad-slot-flow-link'), getEl('ad-slot-flow'), getEl('ad-slot-flow-ph'), 900);
    // shop top (full-width, serve 900px)
    renderAdSlot('shop_top', getEl('ad-slot-shop-top-img'), getEl('ad-slot-shop-top-link'), getEl('ad-slot-shop-top'), getEl('ad-slot-shop-top-ph'), 900);
    // supermarket splash — only show when active
    const smSplash = slots.supermarket_splash;
    if(smSplash && smSplash.active && smSplash.img) {
        const si = getEl('ad-slot-supermarket-splash-img'); if(si) si.src = cldOptimize(smSplash.img, {w:900});
        const sl = getEl('ad-slot-supermarket-splash-link'); if(sl) sl.href = smSplash.link || '#';
    }
    // page tops (full-width, serve 900px)
    ['pantry_top','home_maint_top','bank_top','cashflow_top','budget_top','forecast_top','tasks_top','academy_top','community_top'].forEach(key => {
        const slug = key.replace(/_/g, '-');
        renderAdSlot(key, getEl(`ad-slot-${slug}-img`), getEl(`ad-slot-${slug}-link`), getEl(`ad-slot-${slug}`), getEl(`ad-slot-${slug}-ph`), 900);
    });
}

function openSupermarketModeWithAd() {
    const smSplash = _adsCache && _adsCache.supermarket_splash;
    if(smSplash && smSplash.active && smSplash.img) {
        const overlay = getEl('ad-slot-supermarket-splash');
        if(overlay) { overlay.classList.remove('hidden'); return; }
    }
    openSupermarketMode();
}



// פונקציות העריכה

function checkAndStartTour(force) {
    if (!currentUser) return;
    const key = `tour_done_${currentUser.id}`;
    if (!force && localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    try { showFamilyTour(); } catch(e) {}
}

window.triggerManualTour = function() {
    try { showFamilyTour(); } catch(e) {}
};

function showFamilyTour() {
    const isAdmin = currentUser?.role === 'ADMIN';
    const slides = isAdmin ? [
        {
            bg: 'from-violet-600 to-indigo-700',
            emoji: '👨‍👩‍👧‍👦',
            title: 'ברוכים הבאים ל-Oneflow Life!',
            subtitle: 'המערכת שתשנה את האופן שבו המשפחה שלכם מתנהלת — כסף, קניות, וצמיחה יחד.',
            features: [
                { icon: '🏦', text: 'בנק משפחתי לניהול תקציב, דמי כיס וחיסכון לילדים' },
                { icon: '🛒', text: 'רשימת קניות חכמה ושיתופית לכל המשפחה' },
                { icon: '✅', text: 'משימות ותגמולים שמחנכים ילדים לאחריות פיננסית' },
            ]
        },
        {
            bg: 'from-emerald-500 to-teal-600',
            emoji: '🛒',
            title: 'הסופר החכם שלכם',
            subtitle: 'נהלו קניות ביחד — כולם רואים את הרשימה, ואפשר לסמן מוצרים בזמן אמת מהסופר.',
            features: [
                { icon: '✨', text: 'AI ייצור עבורכם רשימת קניות שבועית שלמה תוך שניות' },
                { icon: '📸', text: 'סרקו קבלה בסיום הקנייה — familAI תזין את כל הנתונים אוטומטית' },
                { icon: '🔴', text: 'מצב "אני בסופר" — כל המשפחה רואה מה נאסף בזמן אמת' },
            ]
        },
        {
            bg: 'from-amber-500 to-orange-500',
            emoji: '✅',
            title: 'משימות ותגמולים',
            subtitle: 'הגדירו משימות בית, תמחרו אותן, והילדים יקבלו תגמול כספי ישירות לארנק שלהם.',
            features: [
                { icon: '💪', text: 'הגדירו משימות יומיות, שבועיות או חד-פעמיות לכל ילד' },
                { icon: '💰', text: 'הילדים מקבלים כסף אמיתי לארנק הדיגיטלי שלהם' },
                { icon: '🎓', text: 'חידונים פיננסיים עם תגמולים לחינוך פיננסי מהנה' },
            ]
        },
        {
            bg: 'from-blue-500 to-cyan-600',
            emoji: '📊',
            title: 'תקציב ותשקיף',
            subtitle: 'הגדירו יעדי הוצאות, עקבו אחרי הכסף, ו-familAI ייתן לכם טיפים לחיסכון.',
            features: [
                { icon: '📅', text: 'תשקיף תזרים — תכננו קדימה ודעו מה מצפה לכם' },
                { icon: '🤖', text: 'familAI מנתח את ההוצאות ומציע דרכים לחסוך' },
                { icon: '📦', text: 'ניהול מזווה — עקבו אחרי המלאי והעבירו לקניות בקליק' },
            ]
        },
        {
            bg: 'from-rose-500 to-pink-600',
            emoji: '🚀',
            title: 'מוכנים להתחיל?',
            subtitle: 'הזמינו את בני המשפחה בוואטסאפ, הגדירו דמי כיס, וצאו לדרך יחד!',
            features: [
                { icon: '📱', text: 'שלחו הזמנה לבני המשפחה ישירות מתפריט "חברים"' },
                { icon: '⚡', text: 'סוללת ה-AI מתאפסת כל יום — 10 פעולות חינמיות מדי יום' },
                { icon: '💡', text: 'לחצו על "?" בכל מקום לקבלת עזרה' },
            ]
        }
    ] : [
        {
            bg: 'from-violet-500 to-purple-700',
            emoji: '🎉',
            title: 'ברוכים הבאים ל-Oneflow!',
            subtitle: 'כאן מתחיל המסע שלך — תרוויח כסף, תחסוך ותתנהל כמו מומחה אמיתי.',
            features: [
                { icon: '💰', text: 'ביצוע משימות בית = כסף אמיתי ישר לארנק שלך' },
                { icon: '🎓', text: 'ענה על חידונים פיננסיים וקבל בונוסים מיוחדים' },
                { icon: '🛒', text: 'בקש להוסיף מוצרים לרשימת הקניות המשפחתית' },
            ]
        },
        {
            bg: 'from-emerald-500 to-teal-600',
            emoji: '💳',
            title: 'הארנק האישי שלך',
            subtitle: 'כל שקל שהרווחת מופיע כאן — ממשימות, מדמי כיס ומחידונים.',
            features: [
                { icon: '🏦', text: 'פתח קופת חיסכון ליעד שאתה חולם עליו' },
                { icon: '📈', text: 'צבור ריבית על כסף שאתה חוסך — כמו אצל הבנק האמיתי' },
                { icon: '📊', text: 'עקוב אחרי ההוצאות שלך ולמד לתכנן חכם' },
            ]
        },
        {
            bg: 'from-amber-500 to-orange-500',
            emoji: '🚀',
            title: 'בואו נתחיל!',
            subtitle: 'בחר משימה, תסיים אותה, ותראה את הכסף מגיע ישירות אליך.',
            features: [
                { icon: '✅', text: 'היכנסו ל"משימות" ובחרו משימה לביצוע עכשיו' },
                { icon: '🛒', text: 'ב"קניות" אפשר לבקש מההורים להוסיף דברים לרשימה' },
                { icon: '🎓', text: 'באקדמיה מחכים לך חידונים כיפיים עם פרסים' },
            ]
        }
    ];

    document.getElementById('ofl-fam-tour-overlay')?.remove();
    let idx = 0;

    function renderSlide() {
        document.getElementById('ofl-fam-tour-overlay')?.remove();
        const s = slides[idx];
        const isLast = idx === slides.length - 1;
        const dots = slides.map((_, i) =>
            `<div style="width:${i===idx?'28px':'8px'};height:8px;border-radius:999px;background:${i===idx?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.35)'};transition:all 0.35s ease"></div>`
        ).join('');
        const feats = s.features.map(f =>
            `<div style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,0.07);border:1px solid #f1f5f9"><span style="font-size:22px;flex-shrink:0;margin-top:2px">${f.icon}</span><span style="font-size:13px;color:#334155;line-height:1.55;font-weight:500">${f.text}</span></div>`
        ).join('');

        const el = document.createElement('div');
        el.id = 'ofl-fam-tour-overlay';
        el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;font-family:Rubik,sans-serif;direction:rtl;background:rgba(15,23,42,0.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
        el.innerHTML = `
<div style="width:100%;max-width:480px;border-radius:28px 28px 0 0;overflow:hidden;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.3);">
  <div class="bg-gradient-to-br ${s.bg}" style="padding:28px 24px 40px;flex-shrink:0;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:7px">${dots}</div>
      <button id="ofl-fam-tour-skip" style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;background:rgba(0,0,0,0.18);border:none;cursor:pointer;font-family:Rubik,sans-serif;padding:7px 16px;border-radius:20px;">דלג</button>
    </div>
    <div style="text-align:center">
      <div style="width:92px;height:92px;border-radius:50%;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-size:46px;margin:0 auto 20px;box-shadow:0 8px 32px rgba(0,0,0,0.2);">${s.emoji}</div>
      <h2 style="font-size:22px;font-weight:900;color:#fff;margin:0 0 8px;letter-spacing:-0.3px">${s.title}</h2>
      <p style="color:rgba(255,255,255,0.82);font-size:14px;line-height:1.6;margin:0;font-weight:400">${s.subtitle}</p>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:20px 16px 8px;display:flex;flex-direction:column;gap:10px;background:#f8fafc;">
    ${feats}
  </div>
  <div style="padding:14px 16px 28px;background:#f8fafc;">
    <button id="ofl-fam-tour-next" class="bg-gradient-to-r ${s.bg}" style="width:100%;color:#fff;font-weight:800;font-size:16px;padding:15px;border-radius:16px;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:Rubik,sans-serif;">
      ${isLast ? '🚀 בואו נתחיל!' : 'הבא →'}
    </button>
  </div>
</div>`;

        document.body.appendChild(el);
        document.getElementById('ofl-fam-tour-skip').onclick = () => document.getElementById('ofl-fam-tour-overlay')?.remove();
        document.getElementById('ofl-fam-tour-next').onclick = () => {
            if (isLast) { document.getElementById('ofl-fam-tour-overlay')?.remove(); }
            else { idx++; renderSlide(); }
        };
    }

    renderSlide();
}

function startAdminTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 👋", intro: "האפליקציה שהולכת לשנות את האופן שבו המשפחה שלכם מתנהלת פיננסית." },
            { element: '#tour-header', title: "מרכז השליטה שלכם", intro: "כאן תמצאו את קוד המשפחה. לחיצה על תפריט תפתח את ההגדרות.", position: 'bottom' },
            { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "המערכת מונעת ע\"י familAI. כאן תוכלו לראות את כמות הפעולות שנותרה.", position: 'bottom' },
            { element: '#user-balance', title: "הארנק המשותף 💳", intro: "כאן תוכלו לראות את היתרה הפנויה של המשפחה בזמן אמת.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "פעולה מהירה ⚡", intro: "רישום הוצאה או הכנסה מכל מקום באפליקציה.", position: 'top' },
            { element: '#tab-shop', title: "סופר חכם 🛒", intro: "רשימת קניות משותפת לכולם. צלמו קבלה ו-familAI תזין את הנתונים!", position: 'bottom' },
            { element: '#tab-pantry', title: "ניהול מזווה 📦", intro: "עקבו אחרי המלאי בבית והעבירו מוצרים חסרים לרשימת הקניות.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק המשפחתי 🏦", intro: "הגדירו דמי כיס שבועיים אוטומטיים לילדים ולמדו אותם לנהל כסף.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות הבית ✅", intro: "הגדירו משימות, תמחרו אותן, והילדים יקבלו תגמול על ביצוע.", position: 'bottom' },
            { element: '#tab-academy', title: "אקדמיה פיננסית 🎓", intro: "יצרו לילדים אתגרים חינוכיים בהתאמה אישית עם ה-AI.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב ושליטה 📊", intro: "הגדירו יעדי הוצאות חודשיים. familAI תנתח ותספק טיפים לחיסכון.", position: 'bottom' },
            { element: '#tab-forecast', title: "תשקיף תזרים 📅", intro: "צפו בפעולות עתידיות ותכננו את התקציב קדימה.", position: 'bottom' },
            { element: '#tab-recipes', title: "השף הפרטי 👨‍🍳", intro: "ה-AI ירקח עבורכם מתכון מהמוצרים שיש במזווה!", position: 'bottom' },
            { element: '#tab-members', title: "הזמנת המשפחה 👨‍👩‍👧‍👦", intro: "שלחו הזמנה מהירה בוואטסאפ לילדים ולבן/בת הזוג.", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else if(id === 'tab-members') switchTab('members'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = getEl('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function startChildTour() {
    switchTab('feed'); const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג', showProgress: true, rtl: true, hidePrev: false, showBullets: true, scrollToElement: true, disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 🎉", intro: "כאן מתחיל המסע שלך לעצמאות: להרוויח כסף ולחסוך נכון." },
            { element: '#ai-battery-indicator', title: "סוללת ה-AI ⚡", intro: "הכירו את familAI - העוזרת החכמה והסודית שלנו!", position: 'bottom' },
            { element: '#user-balance', title: "הארנק האישי שלך 💳", intro: "כאן מופיע כל הכסף שהרווחת מביצוע משימות ומדמי הכיס.", position: 'bottom' },
            { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "בקש להוסיף דברים לרשימת הקניות כאן.", position: 'bottom' },
            { element: '#tab-pantry', title: "המזווה 📦", intro: "בדוק בקלות אילו ממתקים או מוצרים כבר מחכים לכם בבית.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "פתח 'קופת חיסכון' למטרה שאתה חולם עליה ותראה את הריבית מצטברת.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "בחר משימה, סיים אותה, וקבל תגמול ישר לארנק!", position: 'bottom' },
            { element: '#tab-academy', title: "האקדמיה 🎓", intro: "ענה על חידונים כיפיים ותרוויח בונוסים על תשובות נכונות.", position: 'bottom' },
            { element: '#tab-budget', title: "לאן הכסף הולך? 📊", intro: "ראה על מה בזבזת את הכסף ולמד לתכנן קניות חכם.", position: 'bottom' },
            { element: '#tab-forecast', title: "התשקיף שלי 📅", intro: "צפה בהכנסות והוצאות עתידיות.", position: 'bottom' },
            { element: '#tab-recipes', title: "שף AI 👨‍🍳", intro: "בחר מוצרים מהמטבח, והשף ייתן לך מתכון מנצח וקל להכנה!", position: 'bottom' }
        ]
    });
    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return; const id = targetElement.id;
        if(id === 'tab-shop') switchTab('shop'); else if(id === 'tab-pantry') switchTab('pantry'); else if(id === 'tab-bank') switchTab('bank'); else if(id === 'tab-cashflow') switchTab('cashflow'); else if(id === 'tab-tasks') switchTab('tasks'); else if(id === 'tab-academy') switchTab('academy'); else if(id === 'tab-budget') switchTab('budget'); else if(id === 'tab-forecast') switchTab('forecast'); else if(id === 'tab-recipes') switchTab('recipes'); else switchTab('feed'); 
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) { const scrollContainer = getEl('slider-scroll'); if (scrollContainer) { scrollContainer.style.scrollBehavior = 'auto'; scrollContainer.scrollLeft = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2); setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); } }
        return new Promise(resolve => setTimeout(() => { intro.refresh(); resolve(); }, 150));
    });
    intro.onexit(() => switchTab('feed')); intro.oncomplete(() => switchTab('feed')); intro.start();
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => { const el = getEl(`view-${v}`); if(el) el.classList.add('hidden'); }); 
    const tg = getEl(`view-${view}`); if(tg) tg.classList.remove('hidden'); 
}

function openTosModal(e, docKey) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const modal = getEl('tos-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    const contentEl = getEl('tos-modal-content');
    if(!contentEl) return;
    const key = docKey || 'legal_tos_family';
    contentEl.innerHTML = '<p class="text-slate-400 text-center py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</p>';
    fetch(`${API}/public/legal/${key}`)
        .then(r => r.json())
        .then(data => {
            if(data.success && data.content) {
                contentEl.innerHTML = data.content;
            } else {
                contentEl.innerHTML = '<p class="text-slate-400 text-center py-4">לא נמצא תוכן למסמך זה.</p>';
            }
        })
        .catch(() => { contentEl.innerHTML = '<p class="text-red-400 text-center py-4">שגיאה בטעינת המסמך.</p>'; });
}
function closeTosModal() { const modal = getEl('tos-modal'); if(modal) modal.classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; toggleLoader('login', true); 
    try { 
        const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }) }); 
        const data = await res.json(); 
        if(data.success) {
            currentUser = data.user; currentGroup = data.group;
            // לוגין רגיל — מנקים SA token כדי שבאנר ההשתלטות לא יופיע
            localStorage.removeItem('ofl_sa_token');
            saveSession(currentUser, currentGroup);
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) { window.location.href = '/business.html'; return; }
            else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) { window.location.href = '/'; return; }
            await loadDashboard();
        } else showToast('error', data.error); 
    } catch(e) { console.error('LOGIN ERROR:', e); showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); }
}


function _requiresPhone(birthYear) {
    const y = parseInt(birthYear);
    if (!y || isNaN(y)) return false;
    return (new Date().getFullYear() - y) >= 10;
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!getEl('create-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    forceTourStart = true; toggleLoader('login', true); 
    try { 
        const _cPhone = val('create-phone');
        const _cType = val('create-type');
        const _birthYear = _cType === 'FAMILY' ? val('create-year') : (val('create-year-biz') || val('create-year'));
        if (_requiresPhone(_birthYear) && !_cPhone.trim()) { showToast('error', 'מספר טלפון הוא שדה חובה מגיל 10'); toggleLoader('login', false); return; }
        const _firstName = val('create-first-name') || '';
        const _lastName = val('create-last-name') || '';
        const _city = val('create-city') || '';
        const _familyNickname = val('create-family-nickname') || '';
        const _adminNickname = _lastName ? `${_firstName} ${_lastName}`.trim() : _firstName;
        if (!_city.trim()) { showToast('error', 'עיר היא שדה חובה'); toggleLoader('login', false); return; }
        const res = await fetch(`${API}/groups`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type: _cType, groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: _adminNickname, firstName: _firstName, lastName: _lastName, city: _city, familyNickname: _familyNickname, birthYear: _birthYear, password: val('create-password'), phone: _cPhone }) });
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; currentGroup = data.group; 
            saveSession(currentUser, currentGroup);
            if (currentGroup.type === 'BUSINESS' && !window.location.pathname.includes('business.html')) { window.location.href = '/business.html'; return; } 
            else if (currentGroup.type !== 'BUSINESS' && window.location.pathname.includes('business.html')) { window.location.href = '/'; return; }
            try {
                await loadDashboard(); 
            } catch (dashErr) {
                console.error("Dashboard Load Error:", dashErr);
            }
        } else {
            showToast('error', data.error); 
        }
    } catch(e) { 
        console.error("Create Fetch Error:", e);
        showToast('error', 'שגיאה בטעינה המקומית: ' + e.message); 
    } finally { toggleLoader('login', false); } 
}

function setJoinRole(role) {
    const adminBtn = getEl('join-role-admin-btn');
    const childBtn = getEl('join-role-child-btn');
    const roleInput = getEl('join-role');
    if (!adminBtn || !childBtn || !roleInput) return;
    const isAdmin = role === 'ADMIN';
    roleInput.value = isAdmin ? 'ADMIN' : 'CHILD';
    adminBtn.className = `flex-1 py-3 rounded-2xl font-bold text-sm border-2 transition flex flex-col items-center gap-1 ${isAdmin ? 'border-indigo-500 bg-indigo-500 text-white shadow' : 'border-slate-200 bg-white text-slate-500 shadow-sm'}`;
    childBtn.className = `flex-1 py-3 rounded-2xl font-bold text-sm border-2 transition flex flex-col items-center gap-1 ${!isAdmin ? 'border-violet-500 bg-violet-500 text-white shadow' : 'border-slate-200 bg-white text-slate-500 shadow-sm'}`;
}

async function handleJoin(e) {
    e.preventDefault(); if(!getEl('join-tos').checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); forceTourStart = true; 
    const _jPhone = val('join-phone');
    if (_requiresPhone(val('join-year')) && !_jPhone.trim()) { showToast('error', 'מספר טלפון הוא שדה חובה מגיל 10'); return; }
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), email: val('join-email'), password: val('join-password'), phone: _jPhone }) });
    const d=await res.json(); 
    if(d.success) { showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); window.history.replaceState({}, document.title, window.location.pathname); switchView('login'); } else showToast('error', d.error); 
}

function _slimForSession(obj, ...dropKeys) { const r = Object.assign({}, obj); dropKeys.forEach(k => delete r[k]); return r; }
function saveSession(u, g) {
    const user = u || currentUser; const group = g || currentGroup;
    const slim = {
        user: _slimForSession(user, 'profile_image', 'password_hash'),
        group: _slimForSession(group, 'logo', 'logo_url', 'image_url')
    };
    try {
        localStorage.setItem('ofl_session', JSON.stringify(slim));
    } catch(e) {
        try {
            Object.keys(localStorage).filter(k => !['ofl_sa_token','ofl_session'].includes(k)).forEach(k => localStorage.removeItem(k));
            localStorage.setItem('ofl_session', JSON.stringify(slim));
        } catch(e2) {}
    }
    if (group && group.id && group.image_url) { try { localStorage.setItem(`ofl_logo_${group.id}`, group.image_url); } catch(e) {} }
}
function logout() { localStorage.removeItem('ofl_session'); window.location.href = '/'; }
function scrollTabs(direction) { getEl('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','tasks','shop','myorders','bank','cashflow','community','academy','members','budget','pantry','recipes','forecast','home-maintenance'].forEach(x => { 
        const el = getEl(`content-${x}`); if(el) el.classList.add('hidden'); 
        const btn = getEl(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); 
    }); 
    const targetContent = getEl(`content-${t}`); if(targetContent) { targetContent.classList.remove('hidden','tab-anim'); void targetContent.offsetWidth; targetContent.classList.add('tab-anim'); }
    const targetBtn = getEl(`tab-${t}`); if(targetBtn) targetBtn.classList.add('tab-active');
    window._currentFamilyTab = t;

    if (t !== 'shop') { const footer = getEl('cart-footer'); if (footer) footer.classList.add('hidden'); const fab = getEl('fab-container'); if(fab) fab.classList.remove('fab-lifted'); } 
    else { try { renderShopList(); } catch(e) {} }
    
    if (t === 'pantry') try { renderPantry(); } catch(e) {}
    if (t === 'recipes') try { renderRecipePantrySelection(); } catch(e) {}
    if (t === 'forecast') try { renderForecast(); } catch(e) {}
    if (t === 'cashflow') { try { renderCashflow(); } catch(e) {} fetchCashflowData(); }
    if (t === 'budget') try { fetchBudget(); } catch(e) {}
    if (t === 'community') try { fetchCommunityData(); } catch(e) {}
    if (t === 'myorders') {
        try {
            const lastSubTab = sessionStorage.getItem('myorders_sub_tab') || 'orders';
            switchMyOrdersTab(lastSubTab);
            fetchMyOrders();
            loadFamilyServiceCalls();
            startMyOrdersAutoRefresh();
        } catch(e) {}
    }
    if (t === 'home-maintenance') try { loadHomeMaintenance(); } catch(e) {}
    if (t === 'academy' && currentUser && currentUser.role === 'CHILD') try { loadKidAcademy(); } catch(e) {}
    if (t === 'bank') {
        if (currentUser && currentUser.role === 'CHILD') try { loadChildFlwWallet(); } catch(e) {}
        if (currentUser && currentUser.role === 'ADMIN') try { loadFlwKidParentPanel(); } catch(e) {}
    }
}

let myOrdersCache = [];

// --- Auto-refresh כל 20 שניות כשב-myorders ---
let _myordersRefreshInterval = null;
function startMyOrdersAutoRefresh() {
    if (_myordersRefreshInterval) return;
    _myordersRefreshInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API}/store/orders/my/${currentUser.id}`);
            const d = await res.json();
            if (d.success) {
                const newOrders = d.orders || [];
                // Check for status changes and add notifications
                if (window._previousOrdersCache) {
                    const oldMap = new Map((window._previousOrdersCache || []).map(o => [o.id, o]));
                    let hasChanges = false;
                    newOrders.forEach(newOrder => {
                        const oldOrder = oldMap.get(newOrder.id);
                        if (oldOrder && oldOrder.status !== newOrder.status) {
                            console.log('[polling] Status changed:', { orderId: newOrder.id, oldStatus: oldOrder.status, newStatus: newOrder.status });
                            hasChanges = true;
                            // Order status changed - add bell badge notification
                            const badge = getEl('bell-badge');
                            if (badge) {
                                const count = parseInt(badge.textContent || '0') + 1;
                                badge.textContent = count;
                                badge.classList.remove('hidden');
                                badge.style.animation = 'pulse 0.5s';
                                setTimeout(() => badge.style.animation = '', 500);
                            }
                            // Toast מעוצב עם פרטי ההזמנה — מותאם לסוג (משלוח / איסוף עצמי)
                            const isDeliv = !!(newOrder.is_delivery == 1 || newOrder.is_delivery === true || newOrder.is_delivery === 'true');
                            const statusMap = {
                                pending_approval: 'ממתין לאישור',
                                new:              'התקבל בעסק ✅',
                                processing:       'בהכנה 🍳',
                                ready:            isDeliv ? 'מוכן לשליחה 📦' : 'מוכן לאיסוף — אפשר לבוא 🏃',
                                shipped:          isDeliv ? 'בדרך אליך 🛵' : 'מוכן לאיסוף ✅',
                                delivering:       isDeliv ? 'בדרך אליך 🛵' : 'מוכן לאיסוף ✅',
                                completed:        'הושלם ✅',
                                cancelled:        'בוטל ❌'
                            };
                            showOrderStatusToast(newOrder.id, newOrder.store_name || 'העסק', statusMap[newOrder.status] || newOrder.status, isDeliv);
                        }
                    });
                    // רענן accordions אם יש שינוי סטטוס
                    if (hasChanges) {
                        document.querySelectorAll('.biz-accordion').forEach(accordion => {
                            const wrapper = accordion.closest('[data-biz-id]');
                            const bizGroupId = wrapper?.dataset?.bizId;
                            if (bizGroupId && currentGroup) {
                                // מחק ה-cache כדי שהaccordion יטען נתונים חדשים בפתיחה הבאה
                                delete accordion.dataset.loaded;
                                // אם accordion פתוח, רענן אוטומטית
                                if (!accordion.classList.contains('hidden')) {
                                    fetch(`${API}/family/business-activity/${currentGroup.id}/${bizGroupId}`)
                                        .then(r => r.json())
                                        .then(res => _renderBizAccordion(accordion, res, res.type || 'restaurant'))
                                        .catch(() => {});
                                }
                            }
                        });
                    }
                }
                window._previousOrdersCache = newOrders;
                myOrdersCache = newOrders;
                // עדכן UI כשבטאב myorders
                if (window._currentFamilyTab === 'myorders') {
                    const currentSubTab = sessionStorage.getItem('myorders_sub_tab') || 'orders';
                    if (currentSubTab === 'orders') {
                        renderMyOrders();
                    }
                }
            }
        } catch(e) {}
        const activitiesSection = getEl('myorders-section-activities');
        if (activitiesSection && !activitiesSection.classList.contains('hidden') && currentGroup) {
            try {
                // עדכן cache של accordions בטאב הפעילויות בלי לרענן את ה-DOM
                // כשהמשתמש יפתח accordion, הוא יטען נתונים חדשים
                document.querySelectorAll('#myorders-section-activities .biz-accordion').forEach(accordion => {
                    const wrapper = accordion.closest('[data-biz-id]');
                    if (wrapper?.dataset?.bizId && currentGroup) {
                        delete accordion.dataset.loaded;
                    }
                });
            } catch(e) {}
        }
        const quotesSection = getEl('myorders-section-quotes');
        if (quotesSection && !quotesSection.classList.contains('hidden') && currentGroup) {
            try {
                const uid = currentUser ? currentUser.id : '';
                const res = await fetch(`${API}/store/quotes/family/${currentGroup.id}?userId=${uid}`);
                const d = await res.json();
                if (d.success) { familyQuotesCache = d.quotes || []; renderFamilyQuotesTab(); }
            } catch(e) {}
        }
    }, 3000);
}

async function fetchMyOrders() {
    const list = getEl('my-orders-list');
    if (!list) return;
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">טוען הזמנות מהעסקים... <i class="fa-solid fa-spinner fa-spin ml-1"></i></p>';
    
    const timeoutId = setTimeout(() => {
        if (list.querySelector('.fa-spinner')) {
            list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">לא הצלחנו לטעון נסה לרענן את הדף</p>';
        }
    }, 10000);
    
    try {
        const res = await fetch(`${API}/store/orders/my/${currentUser.id}`);
        const data = await res.json();
        clearTimeout(timeoutId);
        
        if (data.success) {
            myOrdersCache = data.orders || [];
            renderMyOrders();
        } else {
            list.innerHTML = `<p class="text-xs text-red-500 text-center py-10">${data.error || 'שגיאה בטעינת ההזמנות'}</p>`;
        }
    } catch (e) {
        clearTimeout(timeoutId);
        list.innerHTML = '<p class="text-xs text-red-500 text-center py-10">שגיאת תקשורת מול השרת</p>';
    }
}

window._myOrdersPage = window._myOrdersPage || 0;
window._myOrdersFilter = window._myOrdersFilter || 'orders';
window._myOrdersSearch = window._myOrdersSearch || '';
window._ordersFilter = window._ordersFilter || { search: '', period: 'all', sort: 'desc' };
window._scTypeFilter = window._scTypeFilter || 'all';

function _renderOrderItems(items) {
    let arr = items;
    if (!arr) return '<span class="text-slate-400 text-[11px]">ללא פרטים</span>';
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch(e) { return `<span class="text-slate-500 text-[11px]">${safeStr(arr)}</span>`; } }
    if (!Array.isArray(arr)) return '<span class="text-slate-400 text-[11px]">ללא פרטים</span>';
    const visible = arr.filter(i => !i.is_quote_metadata && (i.name || i.item_name));
    if (!visible.length) return '<span class="text-slate-400 text-[11px]">ללא פרטים</span>';
    return visible.map(i => {
        const name = i.name || i.item_name || '';
        const qty = parseFloat(i.quantity || i.qty || 1);
        const price = parseFloat(i.price || i.price_per_unit || 0);
        const lineTotal = qty * price;
        return `<div class="flex justify-between items-center py-1 border-b border-slate-50 last:border-0 gap-2">
            <span class="text-slate-700 text-[11px] flex-1 min-w-0">${safeStr(name)}</span>
            <span class="text-slate-400 text-[10px] shrink-0 dir-ltr">×${qty}${lineTotal > 0 ? ' · ₪' + lineTotal.toFixed(0) : ''}</span>
        </div>`;
    }).join('');
}

function applyOrdersFilter(orders) {
    const f = window._ordersFilter;
    let result = [...orders];
    if (f.search) {
        const q = f.search.toLowerCase();
        result = result.filter(o => (o.store_name||'').toLowerCase().includes(q) || (o.customer_name||'').toLowerCase().includes(q) || (o.notes||'').toLowerCase().includes(q));
    }
    if (f.period !== 'all') {
        const now = Date.now();
        const ms = { week: 7*864e5, month: 30*864e5, quarter: 90*864e5 }[f.period] || 0;
        if (ms) {
            result = result.filter(o => {
                const createdMs = now - new Date(o.created_at).getTime();
                // הצג אם נוצרה בתקופה
                if (createdMs <= ms) return true;
                // הצג גם אם עדיין בעיבוד (לא סיימה/בוטלה) — אנחנו סוקדים שהסטטוס עדכן לאחרונה
                const inProgress = !['completed', 'cancelled', 'done'].includes(o.status);
                return inProgress;
            });
        }
    }
    if (f.sort === 'asc') result.sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
    else result.sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
    return result;
}
function switchMyOrdersTab(tab) {
    // redirect beauty to activities (tab removed)
    if (tab === 'beauty') tab = 'activities';
    try { sessionStorage.setItem('myorders_sub_tab', tab); } catch(e) {}
    ['orders','activities','faults','quotes'].forEach(t => {
        const btn = getEl(`myorders-tab-${t}`);
        const sec = getEl(`myorders-section-${t}`);
        if (btn) btn.className = `flex-1 py-2 text-xs rounded-xl transition ${t === tab ? 'font-black bg-white text-slate-700 shadow-sm' : 'font-bold text-slate-500'}`;
        if (sec) sec.classList.toggle('hidden', t !== tab);
    });
    if (tab === 'faults') renderBusinessServiceCallsTab();
    if (tab === 'quotes') loadFamilyQuotes();
    if (tab === 'activities') loadMyActivities();
}

async function renderMyFaultsAsServiceCalls() {
    const list = getEl('my-service-calls-list'); if (!list) return;
    // טען נתוני תקלות אם לא נטענו עדיין
    if (!hmFaults || !hmFaults.length) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען...</p>';
        try {
            const r = await fetch(`/api/equipment/faults/${currentGroup.id}`);
            const d = await r.json();
            if (d.success) hmFaults = d.faults || [];
        } catch(e) {}
    }
    const statusColors = { open: 'border-red-200 bg-red-50', in_progress: 'border-orange-200 bg-orange-50', resolved: 'border-green-200 bg-green-50' };
    const statusLabels = { open: 'פתוח', in_progress: 'בטיפול', resolved: 'טופל' };
    const sevColors = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
    const sevLabels = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', critical: 'קריטית' };
    const activeFaults = (hmFaults || []).filter(f => f.status !== 'resolved');
    if (!activeFaults.length) {
        list.innerHTML = `<div class="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><i class="fa-solid fa-circle-check text-3xl mb-2 opacity-30 block"></i><p class="text-sm">אין קריאות שירות פתוחות</p><p class="text-xs mt-1 px-4">לפתיחת קריאה חדשה — נהול הבית ← בעיות ← הוסף בעיה</p></div>`;
        return;
    }
    list.innerHTML = activeFaults.map(f => {
        const sc = statusColors[f.status] || 'border-slate-200 bg-white';
        const sl = statusLabels[f.status] || f.status;
        const sev = sevColors[f.severity] || 'bg-slate-100 text-slate-600';
        const sevL = sevLabels[f.severity] || f.severity;
        const dateStr = new Date(f.created_at).toLocaleDateString('he-IL');
        const phone = f.fault_tech_phone;
        return `<div class="bg-white border ${sc} rounded-2xl p-4 shadow-sm">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap mb-1">
                        <span class="font-bold text-slate-800 text-sm">${safeStr(f.title)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${sev}">${sevL}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${sc.replace('bg-','text-').replace('-50','')}">${sl}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 mb-1">${safeStr(f.equipment_name || '')} · ${dateStr}</p>
                    ${f.fault_tech_name ? `<p class="text-[11px] text-indigo-600"><i class="fa-solid fa-user-gear ml-1"></i>${safeStr(f.fault_tech_name)}${f.fault_tech_company ? ' — ' + safeStr(f.fault_tech_company) : ''}</p>` : ''}
                    ${f.scheduled_date ? `<p class="text-[10px] text-indigo-500 font-bold mt-0.5"><i class="fa-solid fa-calendar-check ml-1"></i>${new Date(f.scheduled_date).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}</p>` : ''}
                    ${phone ? `<div class="flex gap-1.5 mt-2 flex-wrap">
                        <a href="tel:${phone.replace(/\D/g,'')}" class="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg"><i class="fa-solid fa-phone"></i> חייג</a>
                        <a href="https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent('שלום, בנוגע לקריאה: ' + f.title)}" target="_blank" class="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg"><i class="fa-brands fa-whatsapp"></i> וואצאפ</a>
                    </div>` : ''}
                </div>
                <button onclick="switchTab('home-maintenance'); setTimeout(()=>switchHomeMaintenanceTab('faults'),100)" class="text-[10px] text-indigo-500 font-bold shrink-0 bg-indigo-50 px-2 py-1 rounded-lg">פרטים →</button>
            </div>
        </div>`;
    }).join('');
}


function renderMyOrders() {
    const list = getEl('my-orders-list');
    if (!list) return;

    // עדכון פאנל סינון
    const filterEl = getEl('orders-filter-panel');
    if (filterEl) {
        const f = window._ordersFilter;
        filterEl.querySelector('#orders-search-input').value = f.search || '';
        ['all','week','month','quarter'].forEach(p => {
            const btn = filterEl.querySelector(`[data-period="${p}"]`);
            if (btn) btn.className = `text-[10px] px-2.5 py-1 rounded-lg font-bold transition ${p === f.period ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`;
        });
        const sortBtn = filterEl.querySelector('#orders-sort-btn');
        if (sortBtn) sortBtn.innerHTML = f.sort === 'asc' ? '<i class="fa-solid fa-arrow-up-short-wide ml-1"></i>ישן→חדש' : '<i class="fa-solid fa-arrow-down-wide-short ml-1"></i>חדש→ישן';
    }

    const allFiltered = applyOrdersFilter(myOrdersCache)
        .filter(o => o.status !== 'quote' && (!o.quote_status || o.quote_status === 'approved'));

    if (!allFiltered.length) {
        list.innerHTML = `<div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center shadow-sm">
            <i class="fa-solid fa-basket-shopping text-4xl text-slate-300 mb-3"></i>
            <p class="text-sm font-bold text-slate-500">${myOrdersCache.length ? 'אין הזמנות התואמות את הסינון.' : 'אין לכם הזמנות מעסקים מקומיים.'}</p>
            <p class="text-xs text-slate-400 mt-1">${myOrdersCache.length ? 'נסו לשנות את הסינון.' : 'כנסו לקהילה והתחילו להנות ממשלוחים והטבות!'}</p>
        </div>`;
        return;
    }

    const PAGE_SIZE = 15;
    if (!window._myOrdersPageNum) window._myOrdersPageNum = 0;
    const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);
    if (window._myOrdersPageNum >= totalPages) window._myOrdersPageNum = 0;
    const page = window._myOrdersPageNum;
    const pageOrders = allFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    let html = '';
    pageOrders.forEach(o => {
        let statusColor = '', statusText = '', statusIcon = '';
        switch(o.status) {
            case 'pending_approval': statusColor='border-yellow-200 bg-yellow-50'; statusText='ממתין לאישור עסק'; statusIcon='fa-hourglass-half'; break;
            case 'new':        statusColor='border-blue-200 bg-blue-50'; statusText='התקבל בעסק'; statusIcon='fa-clock'; break;
            case 'processing': statusColor='border-orange-200 bg-orange-50'; statusText='באריזה / הכנה'; statusIcon='fa-box'; break;
            case 'ready':      statusColor='border-purple-200 bg-purple-50'; statusText='מוכן לאיסוף'; statusIcon='fa-bag-shopping'; break;
            case 'shipped':    statusColor='border-indigo-200 bg-indigo-50'; statusText=o.is_delivery?'בדרך אליך! 🛵':'בדרך אלייך!'; statusIcon=o.is_delivery?'fa-motorcycle':'fa-truck-fast'; break;
            case 'delivering': statusColor='border-indigo-200 bg-indigo-50'; statusText='בדרך אליך 🛵'; statusIcon='fa-motorcycle'; break;
            case 'completed':  statusColor='border-green-200 bg-green-50'; statusText='הושלם ונמסר'; statusIcon='fa-check-double'; break;
            default:           statusColor='border-slate-200 bg-slate-50'; statusText='בטיפול'; statusIcon='fa-hourglass-half';
        }
        const dateStr = new Date(o.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        const borderCls = statusColor.split(' ')[0];
        const isDeliv = !!(o.is_delivery == 1 || o.is_delivery === true || o.is_delivery === 'true');
        const orderTypeBadge = `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDeliv ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-700'}">${isDeliv ? '🛵 משלוח' : '🏃 איסוף עצמי'}</span>`;
        const fromQuote = o.quote_status === 'approved' && o.quote_number
            ? `<div class="flex items-center gap-1.5 mt-1 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 w-fit">
                <i class="fa-solid fa-file-invoice text-indigo-500 text-[10px]"></i>
                <span class="text-[10px] font-bold text-indigo-700">הומרה מהצעת מחיר ${o.quote_number}</span>
               </div>`
            : '';
        html += `<div class="bg-white rounded-2xl border ${borderCls} border-r-4 mb-3 cursor-pointer active:scale-[0.99] transition overflow-hidden" onclick="document.getElementById('order-details-${o.id}').classList.toggle('hidden')" style="touch-action:manipulation;">
            <div class="p-3 flex justify-between items-center gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5"><i class="fa-solid fa-store text-slate-400 text-[10px] shrink-0"></i><h4 class="font-bold text-slate-800 text-sm truncate">${safeStr(o.store_name || 'עסק מקומי')}</h4>${orderTypeBadge}</div>
                    <p class="text-[10px] text-slate-500 mt-0.5"><i class="fa-solid ${statusIcon} ml-1"></i> ${statusText} · ${dateStr}</p>
                    ${fromQuote}
                </div>
                <div class="flex flex-col items-end shrink-0">
                    <span class="font-black text-slate-800 dir-ltr text-sm">₪${parseFloat(o.total_amount||0).toFixed(0)}</span>
                    <span class="text-[9px] text-slate-400 font-mono">#${o.id}</span>
                </div>
            </div>
            <div id="order-details-${o.id}" class="hidden border-t border-slate-100 bg-slate-50 p-3">
                <div class="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
                    ${_renderOrderItems(o.items)}
                    ${(o.notes && !o.quote_status) ? `<p class="mt-2 pt-2 border-t border-slate-200 text-[11px]"><strong>הערות:</strong> ${safeStr(o.notes)}</p>` : ''}
                </div>
                ${(o.status === 'completed' && (o.is_delivery == 1 || o.is_delivery === true || o.is_delivery === 'true')) ? (
                    o.customer_rating
                    ? `<div class="mt-2 bg-green-50 border border-green-200 rounded-xl p-2 text-center text-xs font-bold text-green-700">✅ קיבלת ודירגת — תודה!</div>`
                    : `<div id="order-confirm-${o.id}" class="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                        <p class="text-[11px] font-bold text-slate-600 text-center mb-2">קיבלת את ההזמנה?</p>
                        <div class="flex gap-2">
                            <button onclick="confirmOrderReceipt(${o.id}, true)" class="flex-1 py-2 bg-green-500 text-white text-xs font-black rounded-xl">✅ כן, קיבלתי</button>
                            <button onclick="confirmOrderReceipt(${o.id}, false)" class="flex-1 py-2 bg-red-500 text-white text-xs font-black rounded-xl">❌ לא קיבלתי</button>
                        </div>
                    </div>`
                ) : ''}
        </div>
        </div>`;
    });

    // pagination bar
    if (totalPages > 1) {
        const from = page * PAGE_SIZE + 1;
        const to = Math.min((page + 1) * PAGE_SIZE, allFiltered.length);
        html += `<div class="flex items-center justify-between mt-3 px-1">
            <button onclick="window._myOrdersPageNum=Math.max(0,window._myOrdersPageNum-1);renderMyOrders();" ${page===0?'disabled':''} class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${page===0?'text-slate-300 bg-slate-50':'text-slate-600 bg-white border border-slate-200 active:scale-95'}" style="touch-action:manipulation;">
                <i class="fa-solid fa-chevron-right text-[10px]"></i> הקודם
            </button>
            <span class="text-[11px] text-slate-400 font-bold">${from}–${to} מתוך ${allFiltered.length}</span>
            <button onclick="window._myOrdersPageNum=Math.min(${totalPages-1},window._myOrdersPageNum+1);renderMyOrders();" ${page===totalPages-1?'disabled':''} class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${page===totalPages-1?'text-slate-300 bg-slate-50':'text-slate-600 bg-white border border-slate-200 active:scale-95'}" style="touch-action:manipulation;">
                הבא <i class="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
        </div>`;
    }

    list.innerHTML = html;
}

async function confirmOrderReceipt(orderId, received) {
    const container = document.getElementById(`order-confirm-${orderId}`);
    if (!received) {
        try {
            await fetch(`${API}/store/orders/${orderId}/customer-feedback`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ received: false, familyGroupId: currentGroup?.id })
            });
            if (container) container.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:8px 12px;font-size:11px;color:#dc2626;font-weight:700;text-align:center;">😟 דיווח נשמר. צוות העסק יצור קשר איתך.</div>`;
        } catch(e) {
            showToast('error', 'שגיאה בשמירת הדיווח');
        }
        return;
    }
    window._orderRatingModal(orderId);
}

function setOrdersSearch(val) {
    window._ordersFilter.search = val;
    window._myOrdersPageNum = 0;
    renderMyOrders();
}
function setOrdersPeriod(p) {
    window._ordersFilter.period = p;
    window._myOrdersPageNum = 0;
    renderMyOrders();
}
function toggleOrdersSort() {
    window._ordersFilter.sort = window._ordersFilter.sort === 'desc' ? 'asc' : 'desc';
    window._myOrdersPageNum = 0;
    renderMyOrders();
}
function setScTypeFilter(t) {
    window._scTypeFilter = t;
    renderBusinessServiceCallsTab();
}

let familyQuotesCache = [];

async function loadFamilyQuotes() {
    const list = getEl('family-quotes-list');
    if (!list) return;
    if (!currentGroup) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">יש להתחבר תחילה לצפייה בהצעות מחיר.</p>';
        return;
    }
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-10"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען הצעות מחיר...</p>';
    try {
        const uid = currentUser ? currentUser.id : '';
        const res = await fetch(`${API}/store/quotes/family/${currentGroup.id}?userId=${uid}`);
        const data = await res.json();
        if (data.success) { familyQuotesCache = data.quotes || []; renderFamilyQuotesTab(); }
        else list.innerHTML = `<p class="text-xs text-red-500 text-center py-10">${data.error || 'שגיאה'}</p>`;
    } catch(e) { list.innerHTML = '<p class="text-xs text-red-500 text-center py-10">שגיאת תקשורת</p>'; }
}

function _renderQuoteTimeline(historyRaw) {
    const history = typeof historyRaw === 'string' ? JSON.parse(historyRaw || '[]') : (historyRaw || []);
    if (!history.length) return '';
    const evMap = {
        sent_to_customer:       {icon:'fa-paper-plane',       label:'נשלחה אליך',              color:'indigo'},
        resent_updated:         {icon:'fa-rotate-right',      label:'גרסה מעודכנת נשלחה אליך', color:'indigo'},
        customer_response:      {icon:'fa-reply',             label:'שלחת תגובה',              color:'blue'},
        converted_to_work_order:{icon:'fa-hammer',            label:'הומרה לפקודת עבודה',       color:'emerald'},
        approved:               {icon:'fa-check-circle',      label:'אושרה',                   color:'green'},
        business_message:       {icon:'fa-comment',           label:'הודעה מהעסק',              color:'purple'},
    };
    const respLabels = {approved:'אישרת', rejected:'סירבת', discount_request:'ביקשת הנחה', items_request:'ביקשת שינויים', message:'שלחת הודעה'};
    const sorted = [...history].sort((a,b) => new Date(a.ts)-new Date(b.ts));
    const items = sorted.map((ev,i) => {
        const e = evMap[ev.type] || {icon:'fa-circle-dot', label:ev.type, color:'slate'};
        const label = ev.type === 'customer_response' ? (respLabels[ev.responseType] || ev.responseType) : e.label;
        const dateStr = new Date(ev.ts).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        const textSnip = ev.text ? `<span class="text-slate-400 mr-1">: ${safeStr(ev.text.substring(0,40))}${ev.text.length>40?'…':''}</span>` : '';
        const isLast = i === sorted.length-1;
        return `<div class="flex items-start gap-2 ${isLast?'':'pb-2'} relative">
            ${isLast?'':'<div class="absolute right-[5px] top-4 bottom-0 w-px bg-slate-200"></div>'}
            <div class="shrink-0 w-2.5 h-2.5 rounded-full bg-${e.color}-400 border-2 border-white shadow-sm mt-0.5 z-10"></div>
            <div class="flex-1 min-w-0 leading-tight">
                <span class="text-[10px] font-bold text-${e.color}-700">${label}</span>${textSnip}
                <span class="text-[9px] text-slate-400 block">${dateStr}</span>
            </div>
        </div>`;
    }).join('');
    return `<details class="mt-2 pt-2 border-t border-slate-100">
        <summary class="text-[10px] text-slate-400 font-bold cursor-pointer flex items-center gap-1 select-none list-none">
            <i class="fa-solid fa-clock-rotate-left"></i> היסטוריה (${sorted.length})
        </summary>
        <div class="mt-2 space-y-0.5 pr-1">${items}</div>
    </details>`;
}

function renderFamilyQuotesTab() {
    const list = getEl('family-quotes-list');
    if (!list) return;
    if (!familyQuotesCache.length) {
        list.innerHTML = `<div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <i class="fa-solid fa-file-invoice-dollar text-4xl text-slate-300 mb-3"></i>
            <p class="text-sm font-bold text-slate-500">אין הצעות מחיר עדיין.</p>
            <p class="text-[11px] text-slate-400 mt-1">כאשר עסק ישלח לך הצעת מחיר דרך OneFlow, היא תופיע כאן.</p></div>`;
        return;
    }
    const statusMap = {
        draft:             {label:'טיוטא',                    color:'bg-slate-100 text-slate-600'},
        waiting_customer:  {label:'ממתין לתשובתך',            color:'bg-amber-100 text-amber-700'},
        waiting_business:  {label:'ממתין לתגובת העסק',        color:'bg-blue-100 text-blue-700'},
        customer_approved: {label:'אישרת',                    color:'bg-green-100 text-green-700'},
        approved:          {label:'אושרה',                    color:'bg-blue-100 text-blue-700'},
        cancelled:         {label:'בוטלה',                    color:'bg-red-100 text-red-700'}
    };
    let html = '';
    familyQuotesCache.forEach(q => {
        const qs = q.quote_status || 'draft';
        const isCancelled = qs === 'cancelled';
        const history = typeof q.quote_history === 'string' ? JSON.parse(q.quote_history||'[]') : (q.quote_history || []);
        const hasBusinessMessage = history.some(e => e.type === 'business_message');
        // כדור אצל העסק — לקוח כבר הגיב אך ממתין לעדכון
        const customerWaiting = qs === 'waiting_customer' && q.customer_response_type &&
            ['discount_request','items_request','message'].includes(q.customer_response_type);
        const effectiveStatus = isCancelled ? 'cancelled' : (customerWaiting && !hasBusinessMessage) ? 'waiting_business' : qs;
        const st = statusMap[effectiveStatus] || {label:qs, color:'bg-slate-100 text-slate-600'};
        const canRespond = qs === 'waiting_customer' && !customerWaiting;

        const dateStr = new Date(q.created_at).toLocaleDateString('he-IL');
        let metaTitle='', metaNotes='', metaValidity='';
        try {
            const items = typeof q.items === 'string' ? JSON.parse(q.items||'[]') : (q.items||[]);
            const meta = items.find(i => i.is_quote_metadata);
            if (meta) { const m=JSON.parse(meta.data||'{}'); metaTitle=m.title||''; metaNotes=m.notes||''; metaValidity=m.validity||''; }
        } catch(e) {}
        const title = q.quote_title || metaTitle || `הצעה #${q.id}`;
        const bizName = q.business_name || 'עסק';

        // עיצוב כרטיסיה לפי מצב
        const cardStyle = isCancelled
            ? 'border-red-200 bg-red-50/40 opacity-80'
            : customerWaiting
                ? 'border-blue-200 bg-blue-50/30'
                : canRespond
                    ? 'border-amber-300 bg-white shadow-md'
                    : 'border-slate-200 bg-white shadow-sm';

        // חיווי "כדור אצל העסק"
        const waitingBizBanner = customerWaiting ? `
            <div class="mx-3 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-700 flex items-center gap-2">
                <i class="fa-solid fa-hourglass-half text-blue-400"></i>
                תגובתך נשלחה — ממתין לעדכון מהעסק
            </div>` : '';

        // באנר בוטלה
        const cancelledBanner = isCancelled ? `
            <div class="mx-3 mb-2 px-3 py-2 bg-red-100 border border-red-200 rounded-xl text-[11px] font-bold text-red-700 flex items-center gap-2">
                <i class="fa-solid fa-ban"></i> הצעה זו בוטלה
            </div>` : '';

        // באנר "עברה להזמנות"
        const convertedEvent = history.find(e => e.type === 'converted_to_work_order');
        const isConverted = !!(convertedEvent || q.quote_status === 'approved');
        const convertedDateStr = convertedEvent
            ? new Date(convertedEvent.ts).toLocaleDateString('he-IL')
            : (q.updated_at ? new Date(q.updated_at).toLocaleDateString('he-IL') : '');
        const convertedBanner = isConverted ? `
            <div class="mx-3 mb-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-[11px] font-bold text-green-700 flex items-center gap-2">
                <i class="fa-solid fa-check-circle text-green-500"></i>
                עברה להזמנות${convertedDateStr ? ' • ' + convertedDateStr : ''}
            </div>` : '';

        // תגובה קודמת שנשלחה (אם יש ועדיין רלוונטית)
        const prevRespHtml = q.customer_response && customerWaiting
            ? `<div class="mt-1.5 text-[11px] bg-blue-50 rounded-xl p-2 border border-blue-100"><i class="fa-solid fa-reply text-blue-400 ml-1"></i><span class="font-bold text-blue-700">תגובתך: </span>${safeStr(q.customer_response)}</div>`
            : '';

        // הודעה אחרונה מהעסק — מוצגת בגוף הכרטיס
        const lastBizMsg = [...history].filter(e => e.type === 'business_message').sort((a,b) => new Date(b.ts)-new Date(a.ts))[0];
        const bizMsgHtml = lastBizMsg
            ? `<div class="mt-1.5 text-[11px] bg-purple-50 rounded-xl p-2 border border-purple-200 flex items-start gap-1.5">
                <i class="fa-solid fa-comment text-purple-400 mt-0.5 shrink-0"></i>
                <div><span class="font-bold text-purple-700">עסק: </span><span class="text-purple-800">${safeStr(lastBizMsg.text||'')}</span></div>
               </div>`
            : '';

        const timelineHtml = _renderQuoteTimeline(q.quote_history);

        html += `<div class="rounded-2xl border ${cardStyle} overflow-hidden mb-3">
            <div class="p-4 flex justify-between items-start gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${st.color}">${st.label}</span>
                        ${isCancelled ? '<span class="text-[10px] font-bold text-red-500"><i class="fa-solid fa-ban ml-0.5"></i>בוטלה</span>' : ''}
                    </div>
                    <h4 class="font-bold text-slate-800 text-sm ${isCancelled?'line-through opacity-60':''}">${safeStr(title)}</h4>
                    <p class="text-[11px] text-slate-500 mt-0.5"><i class="fa-solid fa-store ml-1"></i>${safeStr(bizName)} • ${dateStr}</p>
                    ${metaValidity && !isCancelled ? `<p class="text-[10px] text-slate-400 mt-0.5"><i class="fa-regular fa-calendar ml-1"></i>תוקף: ${safeStr(metaValidity)}</p>` : ''}
                </div>
                <div class="text-left shrink-0">
                    <span class="font-black text-slate-800 text-sm ${isCancelled?'line-through opacity-50':''}" dir="ltr">₪${parseFloat(q.total_amount||0).toFixed(2)}</span>
                    <p class="text-[9px] text-slate-400 font-mono mt-0.5">#${q.id}</p>
                </div>
            </div>
            ${cancelledBanner}${convertedBanner}${waitingBizBanner}
            <div class="border-t border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-600">
                <div class="space-y-1 mb-2">${_renderOrderItems(q.items)}</div>
                ${metaNotes && !isCancelled ? `<p class="text-[10px] text-slate-500 pt-2 border-t border-slate-100"><i class="fa-solid fa-note-sticky ml-1"></i>${safeStr(metaNotes)}</p>` : ''}
                ${prevRespHtml}
                ${bizMsgHtml}
                ${timelineHtml}
            </div>
            <div class="border-t border-slate-100 px-3 pb-3 pt-2">
                ${isCancelled
                    ? `<div class="w-full bg-red-50 border border-red-200 text-red-400 text-xs font-bold rounded-xl py-2.5 text-center"><i class="fa-solid fa-ban ml-1"></i>הצעה בוטלה</div>`
                    : isConverted
                        ? `<button onclick="window.openFamilyQuoteView(${q.id})" class="w-full bg-green-50 text-green-700 border border-green-200 text-xs font-bold rounded-xl py-2.5 transition hover:bg-green-100"><i class="fa-solid fa-hammer ml-1"></i>פרטי האירוע</button>`
                        : customerWaiting
                            ? `<button onclick="window.openFamilyQuoteView(${q.id})" class="w-full bg-slate-100 text-slate-600 text-xs font-bold rounded-xl py-2.5 transition hover:bg-slate-200"><i class="fa-solid fa-eye ml-1"></i>צפה בהצעה</button>`
                            : `<button onclick="window.openFamilyQuoteView(${q.id})" class="w-full ${canRespond ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} text-xs font-bold rounded-xl py-2.5 transition">
                                ${canRespond ? '<i class="fa-solid fa-reply ml-1"></i>פתח הצעה ↙ נדרשת תגובה' : '<i class="fa-solid fa-eye ml-1"></i>צפה בהצעה'}
                            </button>`
                }
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

window.openFamilyQuoteView = function(quoteId) {
    const q = familyQuotesCache.find(x => String(x.id) === String(quoteId));
    if (!q) return;
    document.getElementById('fqv-modal')?.remove();
    const items = typeof q.items === 'string' ? JSON.parse(q.items||'[]') : (q.items||[]);
    let title='', notes='', validity='', discount=0, vatRate=18, noVat=false, introText='';
    try {
        const meta = items.find(i => i.is_quote_metadata);
        if (meta) { const m = JSON.parse(meta.data||'{}'); title=m.title||''; notes=m.notes||''; validity=m.validity||''; discount=parseFloat(m.discount||0); vatRate=parseFloat(m.vatRate||18); noVat=!!m.noVat; introText=m.introText||''; }
    } catch(e) {}
    const visibleItems = items.filter(i => !i.is_quote_metadata && !i.is_delivery_metadata && (i.name||i.item_name));
    let subtotal = visibleItems.reduce((s,i) => s + (parseFloat(i.price||0)*parseFloat(i.quantity||i.qty||1)), 0);
    const discountAmt = subtotal * discount / 100;
    const beforeVat = subtotal - discountAmt;
    const vatAmt = noVat ? 0 : beforeVat * vatRate / 100;
    const total = beforeVat + vatAmt;
    const dateStr = new Date(q.created_at).toLocaleDateString('he-IL');
    const canRespond = (q.quote_status === 'waiting_customer');
    const alreadyResponded = !!q.customer_response_type;
    const itemsHtml = visibleItems.map(i => {
        const n = i.name||i.item_name||''; const qty = parseFloat(i.quantity||i.qty||1); const price = parseFloat(i.price||0);
        return `<div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
            <span class="flex-1 text-slate-700 text-sm font-medium">${safeStr(n)}</span>
            <span class="text-slate-500 text-xs mx-3 shrink-0">×${qty}</span>
            <span class="text-slate-500 text-xs mx-2 shrink-0 dir-ltr">₪${price.toFixed(0)}</span>
            <span class="font-bold text-slate-800 text-sm dir-ltr shrink-0">₪${(qty*price).toFixed(2)}</span>
        </div>`;
    }).join('') || '<p class="text-slate-400 text-sm text-center py-3">ללא פריטים</p>';

    // כפתורי תגובה
    const responseMap = { approved:'✅ אישרת', rejected:'❌ סירבת', discount_request:'💬 ביקשת הנחה', items_request:'📋 ביקשת שינויים', message:'💬 שלחת הודעה' };
    const responseLabel = alreadyResponded ? (responseMap[q.customer_response_type]||q.customer_response_type) : '';

    // תגובות של העסק מה-quote_history
    const history = typeof q.quote_history === 'string' ? JSON.parse(q.quote_history||'[]') : (q.quote_history || []);
    const businessMessages = history.filter(e => e.type === 'business_message').sort((a,b) => new Date(a.ts)-new Date(b.ts));
    const businessMessagesHtml = businessMessages.length > 0 ? businessMessages.map(msg => {
        const dateStr = new Date(msg.ts).toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        return `<div class="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-900">
            <p class="font-bold text-xs text-purple-500 mb-1"><i class="fa-solid fa-comment ml-1"></i> הודעה מהעסק:</p>
            <p class="text-xs leading-relaxed whitespace-pre-line">${safeStr(msg.text || '')}</p>
            <p class="text-[10px] text-purple-400 mt-2 text-left">${dateStr}</p>
        </div>`;
    }).join('') : '';

    let actionHtml = '';
    if (canRespond) {
        const prevResponseHtml = alreadyResponded
            ? `<div class="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-2 text-xs text-blue-700 text-center"><i class="fa-solid fa-clock-rotate-left ml-1"></i><strong>תגובתך הקודמת:</strong> ${responseLabel}${q.customer_response ? ` — ${safeStr(q.customer_response)}` : ''}</div>`
            : '';
        actionHtml = `<div class="border-t border-slate-100 p-4 space-y-2 shrink-0 bg-white">
            ${prevResponseHtml}
            <p class="text-[10px] font-bold text-slate-500 mb-2 text-center">מה תרצה לעשות עם ההצעה?</p>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="window._fqvRespond(${quoteId},'approved','')" class="bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-600 transition"><i class="fa-solid fa-check"></i> אשר הצעה</button>
                <button onclick="window._fqvOpenRequest(${quoteId},'discount_request')" class="bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-600 transition"><i class="fa-solid fa-percent"></i> בקש הנחה</button>
                <button onclick="window._fqvOpenRequest(${quoteId},'items_request')" class="bg-purple-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-purple-600 transition"><i class="fa-solid fa-list-check"></i> בקש שינויים</button>
                <button onclick="window._fqvOpenRequest(${quoteId},'message')" class="bg-slate-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-600 transition"><i class="fa-solid fa-comment"></i> שלח הודעה</button>
            </div>
            <button onclick="window._fqvRespond(${quoteId},'rejected','')" class="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition"><i class="fa-solid fa-xmark ml-1"></i>סרב להצעה</button>
        </div>`;
    } else if (alreadyResponded) {
        actionHtml = `<div class="border-t border-slate-100 p-3 shrink-0 bg-slate-50">
            <p class="text-xs text-center font-bold text-slate-500">${responseLabel}${q.customer_response ? `: ${safeStr(q.customer_response)}` : ''}</p>
        </div>`;
    }

    const html = `<div id="fqv-modal" class="fixed inset-0 bg-slate-900/70 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style="direction:rtl;">
        <div class="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[93vh] overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 bg-indigo-600 text-white shrink-0">
                <div>
                    <h2 class="font-black text-base">${safeStr(title||'הצעת מחיר')}</h2>
                    <p class="text-[11px] text-indigo-200 mt-0.5"><i class="fa-solid fa-store ml-1"></i>${safeStr(q.business_name||'')} · ${dateStr}${validity ? ` · תוקף ${validity} יום` : ''}</p>
                </div>
                <button onclick="document.getElementById('fqv-modal').remove()" class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
                ${businessMessagesHtml}
                ${introText ? `<div class="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-line border border-slate-200">${safeStr(introText)}</div>` : ''}
                <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div class="bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 border-b border-slate-200 grid grid-cols-12 gap-1">
                        <span class="col-span-6">תיאור</span><span class="col-span-2 text-center">כמות</span><span class="col-span-2 text-center">מחיר</span><span class="col-span-2 text-center">סה"כ</span>
                    </div>
                    <div class="px-3">${itemsHtml}</div>
                    <div class="px-3 pb-3 space-y-1.5 border-t border-slate-100 pt-2">
                        <div class="flex justify-between text-xs text-slate-500"><span>סכום ביניים:</span><span dir="ltr">₪${subtotal.toFixed(2)}</span></div>
                        ${discount > 0 ? `<div class="flex justify-between text-xs text-red-500 font-bold"><span>הנחה (${discount}%):</span><span dir="ltr">-₪${discountAmt.toFixed(2)}</span></div>` : ''}
                        ${discount > 0 ? `<div class="flex justify-between text-xs text-slate-500"><span>לפני מע"מ:</span><span dir="ltr">₪${beforeVat.toFixed(2)}</span></div>` : ''}
                        ${!noVat && vatRate > 0 ? `<div class="flex justify-between text-xs text-slate-500"><span>מע"מ (${vatRate}%):</span><span dir="ltr">₪${vatAmt.toFixed(2)}</span></div>` : ''}
                        <div class="flex justify-between text-sm font-black border-t border-slate-200 pt-2 mt-1"><span>סה"כ לתשלום:</span><span dir="ltr" class="text-indigo-700">₪${total.toFixed(2)}</span></div>
                    </div>
                </div>
                ${notes ? `<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800"><strong>הערות ותנאי תשלום:</strong><br><span class="whitespace-pre-line mt-1 block">${safeStr(notes)}</span></div>` : ''}
            </div>
            ${actionHtml}
            <div id="fqv-request-panel" class="hidden border-t border-slate-100 p-4 bg-white shrink-0">
                <p id="fqv-request-label" class="text-xs font-bold text-slate-700 mb-2"></p>
                <textarea id="fqv-request-text" rows="3" placeholder="פרט את הבקשה שלך..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none resize-none"></textarea>
                <div class="flex gap-2 mt-2">
                    <button onclick="window._fqvSubmitRequest(${quoteId})" class="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition">שלח</button>
                    <button onclick="document.getElementById('fqv-request-panel').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold">ביטול</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._fqvCurrentType = '';
window._fqvOpenRequest = function(quoteId, type) {
    const labels = { discount_request: 'פרט את הבקשה להנחה (סכום / אחוז / סיבה):', items_request: 'פרט אילו שינויים / תוספות תרצה:', message: 'כתוב הודעה לעסק:' };
    window._fqvCurrentType = type;
    const panel = document.getElementById('fqv-request-panel');
    const label = document.getElementById('fqv-request-label');
    if (panel && label) { label.textContent = labels[type] || 'פרט:'; panel.classList.remove('hidden'); document.getElementById('fqv-request-text')?.focus(); }
};
window._fqvSubmitRequest = function(quoteId) {
    const text = document.getElementById('fqv-request-text')?.value?.trim() || '';
    if (!text) { showToast('error','הוסף פירוט לבקשה'); return; }
    window._fqvRespond(quoteId, window._fqvCurrentType, text);
};
window._fqvRespond = async function(quoteId, responseType, responseText) {
    try {
        const res = await fetch(`${API}/store/quotes/${quoteId}/customer-response`, {
            method: 'PATCH', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ responseType, responseText, familyGroupId: currentGroup ? currentGroup.id : null })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('fqv-modal')?.remove();
            showToast('success', responseType === 'approved' ? '✅ ההצעה אושרה!' : '📩 הבקשה נשלחה לעסק');
            await loadFamilyQuotes();
        } else showToast('error', data.error || 'שגיאה בשליחה');
    } catch(e) { showToast('error','שגיאת תקשורת'); }
};

window.openQuoteResponseModal = function(quoteId) {
    getEl('qrm-quote-id').value = quoteId;
    getEl('qrm-message').value = '';
    const radios = document.querySelectorAll('input[name="qrm-type"]');
    radios.forEach(r => r.checked = false);
    getEl('quote-response-modal').classList.remove('hidden');
};

window.closeQuoteResponseModal = function() {
    getEl('quote-response-modal').classList.add('hidden');
};

window.submitQuoteResponse = async function() {
    const quoteId = getEl('qrm-quote-id').value;
    const message = getEl('qrm-message').value.trim();
    const typeEl = document.querySelector('input[name="qrm-type"]:checked');
    if (!typeEl) { showToast('error','בחר סוג תשובה'); return; }
    const responseType = typeEl.value;
    if ((responseType === 'discount_request' || responseType === 'items_request' || responseType === 'message') && !message) {
        showToast('error','הוסף הודעה / פירוט הבקשה');
        return;
    }
    const btn = getEl('qrm-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-1"></i> שולח...'; }
    try {
        const res = await fetch(`${API}/store/quotes/${quoteId}/customer-response`, {
            method: 'PATCH',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ responseType, responseText: message, familyGroupId: currentGroup ? currentGroup.id : null })
        });
        const data = await res.json();
        if (data.success) {
            closeQuoteResponseModal();
            showToast('success','התשובה נשלחה לעסק');
            await loadFamilyQuotes();
        } else showToast('error', data.error || 'שגיאה בשליחה');
    } catch(e) { showToast('error','שגיאת תקשורת'); }
    finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane ml-1"></i> שלח תשובה'; } }
};




function updateBatteryUI() {
    const indicator = getEl('ai-battery-indicator'); if(!indicator || !currentGroup) return;
    indicator.classList.remove('hidden', 'bg-slate-100', 'text-slate-500', 'border-slate-200', 'bg-purple-100', 'text-purple-600', 'border-purple-200', 'bg-red-100', 'text-red-600', 'border-red-200');
    if (currentGroup.is_premium) { indicator.innerHTML = '⚡ ∞ (Pro)'; indicator.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'border-transparent'); } 
    else {
        const tokens = currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10; indicator.innerHTML = `⚡ ${tokens}/10`;
        if (tokens > 3) indicator.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200'); else if (tokens > 0) indicator.classList.add('bg-orange-100', 'text-orange-600', 'border-orange-200'); else indicator.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
    }
}

function handleAIResponseCheck(data) {
    if (data.error === 'BATTERY_EMPTY') {
        const modal = getEl('ai-battery-modal'); const upgradeSec = getEl('ai-upgrade-section');
        if (currentUser && currentUser.role === 'ADMIN') upgradeSec.classList.remove('hidden'); else upgradeSec.classList.add('hidden');
        if (modal) modal.classList.remove('hidden'); return false;
    }
    return true;
}

function closeAiBatteryModal() { getEl('ai-battery-modal').classList.add('hidden'); }
function upgradeToPremium() { closeAiBatteryModal(); const profileModal = getEl('profile-modal'); if(profileModal) profileModal.classList.add('hidden'); openAlertModal('Oneflow Pro 👑', 'אפשרות שדרוג למנוי פרימיום תתווסף למערכת בקרוב!'); }

// ---- מודל אישור AI (ai-warning-modal) ----
let _pendingAIAction = null;

window.showAIWarning = function(callback) {
    if (!currentGroup) { if (callback) callback(); return; }
    const today = new Date().toDateString();
    if (localStorage.getItem('ofl_ai_skip_' + today) === '1') {
        if (callback) try { callback(); } catch(e) { showToast('error', 'שגיאה בפעולת AI'); }
        return;
    }
    const tokens = currentGroup.is_premium ? '∞' : (currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10);
    const leftEl = getEl('ai-warning-left');
    if (leftEl) leftEl.innerText = tokens;
    _pendingAIAction = callback;
    const modal = getEl('ai-warning-modal');
    if (modal) modal.classList.remove('hidden');
};

window.confirmAIWarning = function() {
    const dontShow = getEl('ai-warning-dont-show');
    if (dontShow && dontShow.checked) {
        localStorage.setItem('ofl_ai_skip_' + new Date().toDateString(), '1');
    }
    const modal = getEl('ai-warning-modal');
    if (modal) modal.classList.add('hidden');
    if (_pendingAIAction) {
        const cb = _pendingAIAction;
        _pendingAIAction = null;
        try { cb(); } catch(e) { console.error('AI action error:', e); showToast('error', 'שגיאה בפעולת ה-AI'); }
    }
};

let currentAIAction = null;
function executeWithAIWarning(actionFn) {
    if(currentGroup && currentGroup.is_premium) { actionFn(); return; }
    const tokens = currentGroup ? (currentGroup.ai_tokens !== undefined ? currentGroup.ai_tokens : 10) : 0;
    if(tokens <= 0) {
        const modal = getEl('ai-battery-modal'); const upgradeSec = getEl('ai-upgrade-section');
        if (currentUser && currentUser.role === 'ADMIN' && upgradeSec) upgradeSec.classList.remove('hidden'); 
        else if(upgradeSec) upgradeSec.classList.add('hidden');
        if(modal) modal.classList.remove('hidden'); return;
    }
    
    if (localStorage.getItem('ofl_hide_ai_warning') === new Date().toLocaleDateString('he-IL')) { actionFn(); return; }
    
    currentAIAction = actionFn;
    const leftEl = getEl('ai-warning-left'); if(leftEl) leftEl.innerText = tokens;
    const warnModal = getEl('ai-warning-modal'); if(warnModal) warnModal.classList.remove('hidden');
    
    const btnContinue = getEl('btn-ai-warning-continue');
    if (btnContinue) {
        btnContinue.onclick = () => {
            const dontShow = getEl('ai-warning-dont-show');
            if (dontShow && dontShow.checked) localStorage.setItem('ofl_hide_ai_warning', new Date().toLocaleDateString('he-IL'));
            if(warnModal) warnModal.classList.add('hidden');
            if (currentAIAction) { currentAIAction(); currentAIAction = null; }
        };
    }
}
async function loadDashboard() {
    const authContainer = getEl('auth-container'); if (authContainer) authContainer.classList.add('hidden');
    const mw = getEl('main-wrapper'); if (mw) mw.classList.add('hidden');

    getEl('dashboard-container').classList.remove('hidden');
    if (currentUser) getEl('fab-container').classList.remove('hidden');
    const _isMember = currentGroup?.member_type === 'member';

    // --- הזרקת באנר השתלטות דינמי ישירות ל-Body (בטוח 100%) ---
    const saTokenLocal = localStorage.getItem('ofl_sa_token');
    let dynamicBanner = document.getElementById('dynamic-sa-banner');
    
    const activeImpersonation = localStorage.getItem('ofl_session');
    if (saTokenLocal && activeImpersonation) {
        if (!dynamicBanner) {
            dynamicBanner = document.createElement('div');
            dynamicBanner.id = 'dynamic-sa-banner';
            // שימוש ב-Inline Styles כדי לעקוף את בעיית הרינדור של Tailwind
            dynamicBanner.style.cssText = "position: fixed; top: 0; left: 0; right: 0; z-index: 9999999; display: flex; justify-content: space-between; align-items: center; width: 100%; background-color: #dc2626; color: white; padding: 0.5rem 1rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);";
            dynamicBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-user-secret" style="font-size: 1.125rem;"></i>
                    <span style="font-size: 0.875rem; font-weight: bold;">מחובר כ-Super Admin (השתלטות)</span>
                </div>
                <button onclick="exitImpersonation()" style="background-color: white; color: #dc2626; padding: 0.375rem 1rem; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    התנתק וחזור לניהול
                </button>
            `;
            document.body.appendChild(dynamicBanner);
        }
        document.body.style.paddingTop = '55px'; // דוחף את המסך למטה
    } else {
        if (dynamicBanner) dynamicBanner.remove();
        document.body.style.paddingTop = '0px';
    }
    // -----------------------------------------------------------

    const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">${currentGroup.group_code}</span>` : '';
    const _groupDisplayName = fmtGroupName(currentGroup);
    getEl('dash-group-name').innerHTML = `${safeStr(_groupDisplayName)} ${codeBadge}`; getEl('dash-nickname').innerText = fmtUserName(currentUser) || currentUser.nickname;

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) { 
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'btn-pantry-insight', 'admin-tasks-hint', 'profile-upgrade-section', 'admin-members-tools'].forEach(id => { const el=getEl(id); if(el) el.classList.remove('hidden'); });
        const reqTitle = getEl('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
        const profileUp = getEl('profile-upgrade-section');
        if (profileUp && currentGroup && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>'; }
    } else {
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=getEl(id); if(el) el.classList.remove('hidden'); });
        setTimeout(loadChildFlwWallet, 500);
        const profileUp = getEl('profile-upgrade-section'); if(profileUp) profileUp.classList.add('hidden');
        getEl('card-name').innerText = (currentUser.nickname || '').toUpperCase(); getEl('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; getEl('card-interest').innerText = `${currentUser.interest_rate || 0}%`;
        const reqTitle = getEl('req-title'); if(reqTitle) reqTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
        ['tab-members'].forEach(id => { const el=getEl(id); if(el) el.classList.add('hidden'); });
    }
    const btnAddBudget = getEl('btn-add-budget-cat'); if(btnAddBudget) btnAddBudget.classList.remove('hidden'); updateBatteryUI();
    
    try {
        if(!pollInterval) { pollInterval = setInterval(() => { try{ fetchData(); } catch(e){} try{ fetchLoans(); } catch(e){} if(isAdmin) { try{ fetchPendingUsers(); } catch(e){} } }, 30000); }
        setInterval(refreshBellBadge, 30000); refreshBellBadge();
        startMyOrdersAutoRefresh();
        try { fetchBanners(); } catch(e){}
        try { fetchAds(); } catch(e){}
        const _parallelLoads = [
            fetchMembers().catch(()=>{}),
            fetchData().catch(()=>{}),
            fetchLoans().catch(()=>{})
        ];
        if (isAdmin) _parallelLoads.push(fetchPendingUsers().catch(()=>{}));
        if (_isMember) _parallelLoads.push(loadMemberSettings().catch(()=>{}));
        await Promise.all(_parallelLoads);
        if (_isMember) { try { applyMemberLocks(); } catch(e){} }
    } catch (e) {
        showToast('error', 'שגיאה בטעינת חלק מהנתונים');
    } finally {
        const preloader = getEl('app-preloader');
        const finalizeLoad = async () => {
            // בדוק אם משתמש חבר חייב לשנות סיסמה בכניסה ראשונה
            if (currentUser?.must_change_password) { showForcePasswordChange(); return; }
            const showedWelcome = await checkGlobalWelcome(); if (!showedWelcome) { checkAndStartTour(forceTourStart); forceTourStart = false; }
        };
        if (preloader && !preloader.classList.contains('hidden')) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => { preloader.classList.add('hidden'); finalizeLoad(); }, 700); } else { finalizeLoad(); }
    }
}

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome`);
        const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser?.id}_${currentGroup?.group_code}`);
            if (seen !== data.message) {
                const textEl = document.getElementById('welcome-modal-text');
                const modalEl = document.getElementById('welcome-modal');
                if (textEl && modalEl) {
                    textEl.innerText = data.message;
                    modalEl.classList.remove('hidden');
                    window.pendingWelcomeMsg = data.message;
                    return true;
                }
            }
        }
    } catch(e) {}
    return false;
}

function showForcePasswordChange() {
    const existing = document.getElementById('force-pw-overlay');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'force-pw-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0f172a;overflow-y:auto;padding:20px;direction:rtl;';
    const prefillId = currentUser?.id_number || '';
    const prefillEmail = currentUser?.email || '';
    const prefillYear = currentUser?.birth_year || '';
    el.innerHTML = `
        <div style="background:white;border-radius:24px;padding:28px 24px;width:100%;max-width:360px;text-align:right;margin:40px auto;">
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:40px;margin-bottom:8px;">🔐</div>
                <div style="font-size:18px;font-weight:900;color:#1e293b;">ברוך הבא ל-ONEFLOW!</div>
                <div style="font-size:12px;color:#64748b;margin-top:6px;">אנא מלא את הפרטים לפני הכניסה למערכת</div>
            </div>
            <div id="force-pw-error" style="display:none;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:10px 14px;font-size:12px;color:#dc2626;margin-bottom:12px;"></div>
            <div style="background:#f8fafc;border-radius:16px;padding:16px;margin-bottom:16px;">
                <div style="font-size:11px;font-weight:800;color:#6366f1;margin-bottom:12px;display:flex;align-items:center;gap:6px;">🔑 בחירת סיסמה</div>
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">סיסמה חדשה (לפחות 4 תווים)</label>
                    <input id="force-pw-new" type="password" placeholder="הקלד סיסמה חדשה..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:14px;outline:none;box-sizing:border-box;" />
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">אימות סיסמה</label>
                    <input id="force-pw-confirm" type="password" placeholder="הקלד שוב..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:14px;outline:none;box-sizing:border-box;" />
                </div>
            </div>
            <div style="background:#f8fafc;border-radius:16px;padding:16px;margin-bottom:20px;">
                <div style="font-size:11px;font-weight:800;color:#0891b2;margin-bottom:12px;display:flex;align-items:center;gap:6px;">👤 פרטים אישיים</div>
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">מספר תעודת זהות</label>
                    <input id="force-pw-idnum" type="text" inputmode="numeric" placeholder="9 ספרות..." value="${prefillId}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:14px;outline:none;box-sizing:border-box;" />
                </div>
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">כתובת אימייל</label>
                    <input id="force-pw-email" type="email" inputmode="email" placeholder="example@gmail.com" value="${prefillEmail}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:14px;outline:none;box-sizing:border-box;direction:ltr;" />
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">שנת לידה</label>
                    <input id="force-pw-year" type="number" inputmode="numeric" min="1920" max="2020" placeholder="לדוגמה: 1990" value="${prefillYear}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:14px;outline:none;box-sizing:border-box;" />
                </div>
            </div>
            <button onclick="window._submitForcePassword()" style="width:100%;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:900;cursor:pointer;">שמור והמשך ←</button>
        </div>`;
    document.body.appendChild(el);
    document.getElementById('force-pw-new')?.focus();
}

window._submitForcePassword = async function() {
    const np = document.getElementById('force-pw-new')?.value?.trim();
    const cp = document.getElementById('force-pw-confirm')?.value?.trim();
    const idNum = document.getElementById('force-pw-idnum')?.value?.trim() || '';
    const email = document.getElementById('force-pw-email')?.value?.trim() || '';
    const year = document.getElementById('force-pw-year')?.value?.trim() || '';
    const errEl = document.getElementById('force-pw-error');
    const showErr = (msg) => { if(errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };
    if (!np || np.length < 4) { showErr('סיסמה חייבת להכיל לפחות 4 תווים'); return; }
    if (np !== cp) { showErr('הסיסמאות אינן תואמות'); return; }
    if (year && (isNaN(parseInt(year)) || parseInt(year) < 1920 || parseInt(year) > 2020)) { showErr('שנת לידה לא תקינה (1920–2020)'); return; }
    if (errEl) errEl.style.display = 'none';
    const btn = document.querySelector('#force-pw-overlay button');
    if (btn) { btn.disabled = true; btn.textContent = 'שומר...'; }
    try {
        const payload = { newPassword: np };
        if (idNum) payload.id_number = idNum;
        if (email) payload.email = email;
        if (year) payload.birth_year = parseInt(year);
        const r = await fetch(`${API}/users/${currentUser.id}/set-first-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(r => r.json());
        if (r.success) {
            currentUser.must_change_password = false;
            if (idNum) currentUser.id_number = idNum;
            if (email) currentUser.email = email;
            if (year) currentUser.birth_year = parseInt(year);
            const s = JSON.parse(localStorage.getItem('ofl_session') || '{}');
            if (s.user) {
                s.user.must_change_password = false;
                if (idNum) s.user.id_number = idNum;
                if (email) s.user.email = email;
                if (year) s.user.birth_year = parseInt(year);
                saveSession(s.user, s.group);
            }
            document.getElementById('force-pw-overlay')?.remove();
            showToast('success', 'הפרטים נשמרו בהצלחה! ✅');
            try { await checkGlobalWelcome(); } catch(e) {}
        } else {
            showErr(r.error || 'שגיאה בשמירת הפרטים');
            if (btn) { btn.disabled = false; btn.textContent = 'שמור והמשך ←'; }
        }
    } catch(e) {
        showErr('שגיאת תקשורת — נסה שוב');
        if (btn) { btn.disabled = false; btn.textContent = 'שמור והמשך ←'; }
    }
};

async function fetchData() {
    try {
        if (!currentGroup || !currentGroup.id) return; if (document.activeElement.classList.contains('price-input')) return;
        const res = await fetch(`${API}/data/${currentUser.id}`); const data = await res.json();
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        if(data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens; currentGroup.is_premium = data.group.is_premium; updateBatteryUI(); if (data.group.unlocked_modules !== undefined) { const prev = JSON.stringify(currentGroup.unlocked_modules || []); currentGroup.unlocked_modules = data.group.unlocked_modules; if (currentGroup.member_type === 'member' && prev !== JSON.stringify(data.group.unlocked_modules)) { try { applyMemberLocks(); } catch(e){} } }
            const profileUp = getEl('profile-upgrade-section');
            if (profileUp && currentUser.role === 'ADMIN' && currentGroup.is_premium) { profileUp.innerHTML = '<p class="text-sm font-bold text-green-600 text-center py-2 flex items-center justify-center gap-2"><i class="fa-solid fa-check-circle"></i> החשבון שלכם משודרג ל-Pro</p>'; }
            // עדכון המזהה למקרה שהקהילה השתנתה
            currentGroup.community_id = data.group.community_id;
            // עדכון member_type ו-family_nickname מהשרת
            const prevMemberType = currentGroup.member_type;
            if (data.group.member_type !== undefined) currentGroup.member_type = data.group.member_type;
            if (data.group.family_nickname !== undefined) currentGroup.family_nickname = data.group.family_nickname;
            // זיהוי שדרוג מחבר למשפחה
            if (prevMemberType === 'member' && data.group.member_type === 'family') {
                // הסר נעילות חבר
                try { if(typeof applyMemberLocks === 'function') applyMemberLocks(); } catch(e) {}
                // עדכן session
                try { saveSession(); } catch(e) {}
                // הצג מודל שדרוג (רק פעם אחת)
                const upgradeKey = `ofl_upgrade_shown_${currentGroup.id}`;
                if (!localStorage.getItem(upgradeKey)) {
                    localStorage.setItem(upgradeKey, '1');
                    setTimeout(() => showFamilyUpgradeModal(), 1200);
                }
            }
        }

        if (currentUser.role === 'ADMIN') {
            const balEl = getEl('user-balance'); 
            if(balEl) {
                const realBalance = data.group.admin_total_balance || 0;
                balEl.innerText = `₪${parseFloat(realBalance).toFixed(2)}`;
                balEl.className = `text-3xl font-bold font-mono tracking-tight mt-1 ${realBalance >= 0 ? 'text-green-500' : 'text-red-500'}`;
            }
        } else {
            const balEl = getEl('user-balance');
            if (balEl) {
                const childBal = parseFloat(data.user.computed_balance ?? currentUser.balance ?? 0);
                balEl.innerText = `₪${childBal.toFixed(2)}`;
                balEl.className = `text-3xl font-bold font-mono tracking-tight mt-1 ${childBal >= 0 ? 'text-green-500' : 'text-red-500'}`;
            }
        }
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;
        
        // שמירת עדכוני הקהילה והעסקים למטמון עבור הפיד והקהילות
        window.communityUpdatesCache = Array.isArray(data.community_updates) ? data.community_updates : [];
        window.communityBusinessesCache = Array.isArray(data.community_businesses) ? data.community_businesses : [];

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); if(currentUser.role === 'CHILD') loadKidAcademy(); } } catch(e) {}
        try { renderTasks(allTasks); renderPantry(); renderRecipePantrySelection(); } catch(e) {}
        try { shoppingListCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; renderShopList(); } catch(e) {}
        try { if (data.group) renderSmBanner(data.group); } catch(e) {}
        try { loadCategoryMap(); } catch(e) {}
        try { fetchBudget(); } catch(e) {}
        try { renderForecast(); } catch(e) {}
        
        // קריאה לרינדור הקהילות ממש כאן!
        try { renderFamilyCommunities(window.communityBusinessesCache); } catch(e) {}
        try { fetchCashbackInfo(); } catch(e) {}
        
        try {
            const goalsList = getEl(currentUser.role === 'ADMIN' ? 'admin-goals-list' : 'my-goals-list'); const goalsContainer = currentUser.role !== 'ADMIN' ? getEl('my-goals-container') : null; 
            if (goalsList) { 
                goalsList.innerHTML = ''; 
                if(data.goals && data.goals.length > 0) { 
                    if(goalsContainer) goalsContainer.classList.remove('hidden'); 
                    data.goals.forEach(g => { 
                        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)); const ownerBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 block mb-1">${safeStr(g.owner_name)}</span>` : ''; const adviseBtn = `<button onclick="getFamilAIAdvice(${g.target_user_id || g.user_id}, ${g.id})" class="mt-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition"><i class="fa-solid fa-wand-magic-sparkles"></i> טיפ מ-familAI</button>`;
                        goalsList.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-start gap-4 mb-2"><div class="radial-progress flex-shrink-0 mt-1" style="--pct: ${pct*3.6}deg"><span>${pct}%</span></div><div class="flex-1">${ownerBadge}<h4 class="font-bold text-slate-800">${safeStr(g.title)}</h4><p class="text-xs text-slate-500 mb-1">₪${g.current_amount} / ₪${g.target_amount}</p><div class="flex gap-2"><button onclick="openDepositModal(${g.id}, '${safeStr(g.title)}')" class="mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus"></i> הפקד</button>${adviseBtn}</div></div></div>`; 
                    }); 
                } else { if (goalsContainer) goalsContainer.classList.add('hidden'); goalsList.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין יעדים פעילים</p>'; } 
            }
        } catch(e) {}
        
        try {
            if (currentUser.role !== 'ADMIN' && data.weekly_stats) { 
                const spent = parseFloat(data.weekly_stats.spent).toFixed(1); const limit = parseFloat(data.weekly_stats.limit).toFixed(1); const pct = limit > 0 ? (spent / limit) * 100 : 0; 
                const statusEl = getEl('card-spend-status'); if(statusEl) statusEl.innerText = `₪${spent} מתוך ₪${limit}`; 
                const bar = getEl('card-spend-bar'); if(bar) { bar.style.width = `${Math.min(100, pct)}%`; bar.className = parseFloat(spent) > parseFloat(limit) ? 'bg-red-500 h-1.5 rounded-full' : 'bg-green-400 h-1.5 rounded-full'; }
                const msgEl = getEl('card-spend-msg'); if (msgEl) msgEl.innerText = parseFloat(spent) > parseFloat(limit) ? 'חרגת מהיעד!' : 'שמור על ירוק לקבלת ריבית!'; 
            }
        } catch(e) {}

        try {
            const limit = 200; const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const transRes = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=${limit}`);
            if(transRes.ok) { const transData = await transRes.json(); allTransactions = Array.isArray(transData) ? transData : []; }
        } catch(e) { allTransactions = []; }

        try { renderChildTodo(); } catch(e) {}
        try { buildAndRenderFeed(); } catch(e) {}
        try { if (window._currentFamilyTab === 'cashflow') renderCashflow(); } catch(e) {}
        try { renderQuickTiles(); } catch(e) {}
        try { renderFamilyUrgentItems(); } catch(e) {}
        try { renderChildDashboard(); } catch(e) {}
        try { enforcePermissions(); } catch(e) {}
        try { updateFamilyNavBadges(); } catch(e) {}
    } catch(e) {}
}

function showFamilAIModal(title, text) {
    getEl('familai-advisor-modal').classList.remove('hidden'); getEl('familai-modal-subtitle').innerText = title;
    if (text) { getEl('familai-advisor-loading').classList.add('hidden'); getEl('familai-advice-text').innerText = text; getEl('familai-advisor-content').classList.remove('hidden'); } 
    else { getEl('familai-advisor-loading').classList.remove('hidden'); getEl('familai-advisor-content').classList.add('hidden'); }
}

function openAIModal() { getEl('ai-modal').classList.remove('hidden'); }

async function generateAIQuiz() {
    executeWithAIWarning(async () => {
        const btn = getEl('btn-ai-gen'); if(!val('ai-topic')) return showToast('error', 'נא להזין נושא'); btn.disabled = true; btn.innerText = 'familAI חושבת... ⏳';
        try {
            const res = await fetch(`${API}/academy/ai-generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ageGroup: val('ai-age'), topic: val('ai-topic'), groupId: currentGroup.id }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showToast('success', 'מבחן ה-AI מוכן!'); getEl('ai-modal').classList.add('hidden'); getEl('ai-topic').value = ''; await fetchBundles(); openAssignModalSpecific(data.bundleId); fetchData(); } 
            else showToast('error', data.error || 'שגיאה ביצירת המבחן');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerText = 'צור אתגר'; }
    });
}

async function getFamilAIAdvice(childId, goalId) {
    executeWithAIWarning(async () => {
        showFamilAIModal('היועצת הפיננסית של המשפחה', null); getEl('familai-loading-text').innerText = 'מנתחת את הנתונים שלך...';
        try {
            const res = await fetch(`${API}/goals/familai-advice`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, goalId: goalId, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.advice) { showFamilAIModal('היועצת הפיננסית של המשפחה', data.advice); triggerConfetti(); fetchData(); } 
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'מצטערת, לא הצלחתי לייצר עצה כרגע.'); }
        } catch (e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'תקלה בתקשורת עם השרת'); }
    });
}

async function getBudgetInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('אנליסטית התקציב', null); getEl('familai-loading-text').innerText = 'בודקת על מה הוצאנו החודש...';
        try {
            const res = await fetch(`${API}/budget/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('אנליסטית התקציב', data.insight); fetchData(); }
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה ביצירת תובנות תקציב'); }
        } catch(e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function getPantryInsight() {
    executeWithAIWarning(async () => {
        showFamilAIModal('מנהלת המזווה', null); getEl('familai-loading-text').innerText = 'מחשבת כמויות ומרגלי קנייה...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showFamilAIModal('מנהלת המזווה', data.insight); fetchData(); }
            else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח המלאי'); }
        } catch(e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

async function askTutor() {
    if(currentWrongAnswers.length === 0) return; 
    executeWithAIWarning(async () => {
        const w = currentWrongAnswers[0]; getEl('btn-tutor').disabled = true; getEl('btn-tutor').innerText = 'מכינה הסבר... ⏳';
        try {
            const res = await fetch(`${API}/academy/tutor`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ question: w.q, wrongAnswer: w.wrong, correctAnswer: w.correct, groupId: currentGroup.id }) }); const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if(data.success) { showFamilAIModal('המורה הפרטית שלך', data.explanation); fetchData(); }
       } catch(e) { showToast('error', 'שגיאה בהבאת ההסבר'); } finally { 
            getEl('btn-tutor').disabled = false; 
            const logoSrc = window.currentFamilaiLogo ? window.currentFamilaiLogo : 'logo.png';
            getEl('btn-tutor').innerHTML = `<img src="${logoSrc}" alt="AI" class="w-5 h-5 object-contain rounded-full"> familAI, איפה טעיתי?`; 
        }
    });
}

// === פונקציות השף (Recipes) ===
function renderRecipePantrySelection() {
    const list = getEl('recipe-pantry-items-list'); if (!list) return; list.innerHTML = '';
    if (!pantryCache || pantryCache.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400">המזווה ריק. הוסיפו מוצרים למזווה כדי שהשף יוכל להשתמש בהם.</p>'; return; }
    pantryCache.forEach(p => {
        list.innerHTML += `<label class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-slate-100 transition"><input type="checkbox" class="recipe-pantry-cb w-3 h-3 accent-orange-500" value="${safeStr(p.item_name)}" checked><span class="text-[11px] text-slate-600 font-medium">${safeStr(p.item_name)}</span></label>`;
    });
}

function selectAllRecipePantry() {
    const cbs = document.querySelectorAll('.recipe-pantry-cb'); if(cbs.length === 0) return;
    const firstState = cbs[0].checked; cbs.forEach(cb => cb.checked = !firstState);
}

function toggleRecipeCustomInput() {
    const isCustom = getEl('recipe-ignore-pantry').checked; const customArea = getEl('recipe-custom-ingredients'); const pantryArea = getEl('recipe-pantry-selection');
    if (isCustom) { customArea.classList.remove('hidden'); pantryArea.classList.add('hidden'); } else { customArea.classList.add('hidden'); pantryArea.classList.remove('hidden'); }
}

async function generateRecipe() {
    executeWithAIWarning(async () => {
        const mealType = val('recipe-meal-type'); const diners = val('recipe-diners'); const ignorePantry = getEl('recipe-ignore-pantry').checked; const customIngredients = val('recipe-custom-ingredients');
        let pantryItems = [];
        if (!ignorePantry) {
            document.querySelectorAll('.recipe-pantry-cb:checked').forEach(cb => pantryItems.push(cb.value));
            if (pantryItems.length === 0) return showToast('error', 'יש לבחור לפחות מוצר אחד מהמזווה, או לסמן "התעלם מהמזווה"');
        } else { if (!customIngredients) return showToast('error', 'יש להקליד מצרכים חלופיים בתיבה'); }

        const btn = getEl('btn-generate-recipe'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> familAI רוקחת מתכון...';
        try {
            const res = await fetch(`${API}/recipes/generate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, mealType, diners, ignorePantry, customIngredients, pantryItems: pantryItems.join(', ') }) });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) return;
            if (data.success) {
                let formattedRecipe = data.recipe;
                formattedRecipe = formattedRecipe.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-orange-600 mt-4 mb-2">$1</h3>');
                formattedRecipe = formattedRecipe.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-slate-800 mt-5 mb-3">$1</h2>');
                formattedRecipe = formattedRecipe.replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>');
                formattedRecipe = formattedRecipe.replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal font-bold text-slate-700"><span class="font-normal">$1</span></li>');
                formattedRecipe = formattedRecipe.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
                getEl('recipe-result-content').innerHTML = formattedRecipe; getEl('recipe-result-container').classList.remove('hidden'); getEl('recipe-result-container').scrollIntoView({ behavior: 'smooth' }); triggerConfetti();
            } else { showToast('error', data.error || 'שגיאה ביצירת המתכון'); }
        } catch (e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> צור מתכון עכשיו'; }
    });
}

function copyRecipe() {
    const text = getEl('recipe-result-content').innerText;
    navigator.clipboard.writeText(text).then(() => { showToast('success', 'המתכון הועתק ללוח!'); }).catch(err => { showToast('error', 'שגיאה בהעתקה'); });
}
// ==========================

function setTaskMode(mode) {
    const mBtn = getEl('btn-mode-manual'); const aBtn = getEl('btn-mode-ai'); const mDiv = getEl('task-mode-manual'); const aDiv = getEl('task-mode-ai');
    if (mode === 'manual') { mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-blue-600 shadow-sm transition'; aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-purple-600 transition'; mDiv.classList.remove('hidden'); aDiv.classList.add('hidden'); } 
    else { aBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-purple-600 shadow-sm transition'; mBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-blue-600 transition'; aDiv.classList.remove('hidden'); mDiv.classList.add('hidden'); }
}

function closeTaskModal() { getEl('task-modal').classList.add('hidden'); }

function openTaskModal(isSelf = false) {
    getEl('task-modal').classList.remove('hidden'); getEl('task-is-self').value = isSelf;
    getEl('task-days').value = ''; getEl('task-title').value = ''; getEl('task-reward').value = ''; getEl('ai-task-topic').value = ''; getEl('ai-task-results').classList.add('hidden');
    const aiCheckEl = getEl('task-require-ai-check'); if (aiCheckEl) aiCheckEl.value = 'true';
    const knob = getEl('ai-check-knob');
    if (knob) { knob.classList.remove('translate-x-1'); knob.classList.add('translate-x-6'); }
    setTaskMode('manual'); const toggles = getEl('task-mode-toggles'); const assigneeContainer = getEl('task-assignee-container'); const rewardInput = getEl('task-reward'); const assigneeSelect = getEl('task-assignee');

    if(isSelf) { 
        getEl('task-modal-title').innerText = 'מעשה טוב'; toggles.classList.add('hidden'); assigneeContainer.classList.add('hidden'); rewardInput.placeholder = 'כמה מגיע לי? (₪)'; 
    } else { 
        getEl('task-modal-title').innerText = 'יצירת משימה'; toggles.classList.remove('hidden'); assigneeContainer.classList.remove('hidden'); rewardInput.placeholder = 'תגמול (₪)';
        if(membersCache) {
            assigneeSelect.innerHTML = '<option value="" disabled selected>בחרו ילד/ה...</option>'; let hasChildren = false;
            membersCache.forEach(m => { if (m.role !== 'ADMIN') { assigneeSelect.innerHTML += `<option value="${m.id}">${safeStr(fmtUserName(m) || m.nickname)}</option>`; hasChildren = true; } });
            if (!hasChildren) assigneeSelect.innerHTML = '<option value="" disabled selected>אין ילדים רשומים</option>';
        }
    } 
}

async function generateAITasks() {
    executeWithAIWarning(async () => {
        const btn = getEl('btn-ai-task-gen'); const assigneeId = val('task-assignee'); const topic = val('ai-task-topic'); const isSelf = val('task-is-self') === 'true'; 
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
                const resultsContainer = getEl('ai-task-results'); resultsContainer.innerHTML = '<p class="text-xs text-slate-500 mb-2 mt-1 font-bold">הקליקו על המשימה שתרצו:</p>';
                data.tasks.forEach(task => { const safeTitle = safeStr(task.title); resultsContainer.innerHTML += `<div onclick="selectAITask('${safeTitle}', ${task.reward || 0})" class="p-3 rounded-xl flex justify-between items-center bg-white shadow-sm mb-2 cursor-pointer border border-purple-100 hover:bg-purple-50 transition"><span class="text-sm font-bold text-slate-700">${safeTitle}</span><span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">₪${task.reward || 0}</span></div>`; });
                resultsContainer.classList.remove('hidden'); triggerConfetti(); fetchData();
            } else showToast('error', 'מערכת ה-AI עמוסה כרגע. אנא המתינו ונסו שוב.');
        } catch(e) { showToast('error', 'תקלה בתקשורת עם השרת'); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> חפשי רעיונות'; }
    });
}

function selectAITask(title, reward) { getEl('task-title').value = title; getEl('task-reward').value = reward; setTaskMode('manual'); }

function toggleAiCheck() {
    const current = getEl('task-require-ai-check').value === 'true';
    const newVal = !current;
    getEl('task-require-ai-check').value = newVal ? 'true' : 'false';
    const toggle = getEl('ai-check-toggle');
    const knob = getEl('ai-check-knob');
    const activeColor = toggle.classList.contains('bg-slate-800') ? 'bg-slate-800' : 'bg-purple-500';
    if (newVal) {
        toggle.classList.add(activeColor); toggle.classList.remove('bg-slate-300');
        knob.classList.remove('translate-x-1'); knob.classList.add('translate-x-6');
    } else {
        toggle.classList.remove('bg-purple-500', 'bg-slate-800'); toggle.classList.add('bg-slate-300');
        knob.classList.remove('translate-x-6'); knob.classList.add('translate-x-1');
    }
}

async function submitTask() {
    const isSelf = val('task-is-self') === 'true'; const assignee = isSelf ? currentUser.id : val('task-assignee'); const reward = val('task-reward'); const title = val('task-title'); const days = val('task-days');
    const requireAiCheck = getEl('task-require-ai-check') ? getEl('task-require-ai-check').value === 'true' : true;
    if(!isSelf && !assignee) return showToast('error', 'יש לבחור ילד למשימה'); if(!title) return showToast('error', 'יש לכתוב מה לעשות במשימה');
    const btn = getEl('btn-submit-task'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    const statusToSend = isSelf ? 'done' : 'pending';
    try {
        const res = await fetch(`${API}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: title, reward: reward || 0, assignedTo: assignee, days: days, status: statusToSend, groupId: currentGroup.id, requireAiCheck }) });
        const data = await res.json();
        if(data.success) { if(isSelf) triggerConfetti(); closeTaskModal(); showToast('success', isSelf ? 'נשלח לאישור ההורה!' : 'משימה נוצרה בהצלחה!'); fetchData(); } else showToast('error', data.error || 'שגיאה ביצירת משימה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if (btn) { btn.disabled = false; btn.innerText = 'צור משימה'; } }
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

function clickTaskProof(taskId, title) { currentVerifyTaskId = taskId; currentVerifyTaskTitle = title; getEl('task-proof-upload').click(); }

function handleTaskProofUpload(event) {
    const file = event.target.files[0]; if(!file || !currentVerifyTaskId) return;
    executeWithAIWarning(() => {
        showFamilAIModal('בקרת איכות', null); getEl('familai-loading-text').innerText = 'familAI בודקת את התמונה שלך...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/tasks/vision-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: currentVerifyTaskId, title: currentVerifyTaskTitle, imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success) { showFamilAIModal('בקרת איכות', data.message); if(data.verified) { triggerConfetti(); fetchData(); } } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח התמונה.'); }
            } catch(err) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'הקובץ עדיין גדול מדי או שגיאת תקשורת.'); }
            event.target.value = '';
        });
    });
}

function handleReceiptUpload(event) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('קופאית אוטומאטית', null); getEl('familai-loading-text').innerText = 'familAI סורקת את הקבלה... זה ייקח כ-30 שניות.';
        compressImage(file, 800, 800, 0.65, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 90000);
            try {
                const res = await fetch(`${API}/shopping/scan-receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg' }), signal: controller.signal });
                clearTimeout(timeout);
                const data = await res.json();
                if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
                getEl('familai-advisor-modal').classList.add('hidden');
                if(data.success && data.items && data.items.length) {
                    showReceiptReviewModal(data.items, data.storeName || '');
                } else if (data.error === 'parse_error') {
                    showToast('error', 'שגיאת ניתוח — נסה שוב בתמונה ברורה יותר.');
                } else if (data.error) {
                    showToast('error', data.error);
                } else {
                    showToast('error', 'לא זוהו פריטים בקבלה — נסה לצלם שוב בתאורה טובה.');
                }
            } catch(err) { 
                clearTimeout(timeout);
                getEl('familai-advisor-modal').classList.add('hidden'); 
                if(err.name === 'AbortError') showToast('error', 'הסריקה ארכה יותר מדי — נסה שוב עם תמונה קטנה יותר.');
                else showToast('error', 'שגיאת תקשורת — בדוק חיבור לאינטרנט ונסה שוב.');
            }
            event.target.value = '';
        });
    });
}

function showReceiptReviewModal(items, storeName) {
    const listEl = getEl('receipt-review-list');
    const storeLabel = getEl('receipt-store-label');
    if(storeLabel) storeLabel.textContent = storeName ? '🏪 ' + storeName : '';
    if(!listEl) return;
    window._receiptParsedItems = items;
    listEl.innerHTML = items.map((item, idx) => {
        const hasDiscount = item.discount && parseFloat(item.discount) > 0;
        const netPrice = parseFloat(item.net_unit_price) || parseFloat(item.unit_price) || 0;
        const origPrice = parseFloat(item.unit_price) || 0;
        const qty = parseFloat(item.qty) || 1;
        const disc = parseFloat(item.discount) || 0;
        const priceDisplay = hasDiscount
            ? `<span class="line-through text-slate-400 text-[10px]">₪${origPrice.toFixed(2)}</span> <span class="text-green-600 font-bold text-xs">₪${netPrice.toFixed(2)}</span> <span class="text-[9px] text-green-500">(-₪${disc.toFixed(2)})</span>`
            : `<span class="font-bold text-xs text-slate-700">₪${netPrice.toFixed(2)}</span>`;
        return `<label class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-purple-50 cursor-pointer transition">
            <input type="checkbox" class="receipt-item-cb w-4 h-4 accent-purple-600 rounded shrink-0" data-idx="${idx}" checked>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-slate-800 truncate">${safeStr(item.name)}</div>
                <div class="text-[10px] text-slate-400">${qty > 1 ? qty + ' ' + (item.unit || 'יח') + ' × ' : ''}${item.unit || 'יח'} ליחידה</div>
            </div>
            <div class="text-left shrink-0">${priceDisplay}</div>
        </label>`;
    }).join('');
    getEl('receipt-review-modal').classList.remove('hidden');
}

async function confirmReceiptItems() {
    const cbs = document.querySelectorAll('.receipt-item-cb:checked');
    const allItems = window._receiptParsedItems || [];
    const selected = Array.from(cbs).map(cb => allItems[parseInt(cb.dataset.idx)]).filter(Boolean);
    if(!selected.length) return showToast('error', 'לא נבחרו פריטים להוספה');
    getEl('receipt-review-modal').classList.add('hidden');
    try {
        const res = await fetch(`${API}/shopping/scan-receipt/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: selected, userId: currentUser.id }) });
        const data = await res.json();
        if(data.success) {
            for (const item of selected) {
                const detectedCat = getCatScore(item.name, item.normalized_name);
                const saveKey = item.normalized_name || item.name;
                if (detectedCat && detectedCat !== 'שונות' && !categoryMapCache[saveKey]) {
                    categoryMapCache[saveKey] = detectedCat;
                    fetch(`${API}/shopping/category-map`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: currentGroup.id, normalizedName: saveKey, category: detectedCat }) });
                }
            }
            showFamilAIModal('קופאית אוטומאטית', `✅ הוספתי ${data.count} פריטים מהקבלה לרשימת הקניות!`); triggerConfetti(); fetchData();
        }
        else showToast('error', 'שגיאה בשמירת הפריטים');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function startBarcodeScan(target) { currentScanTarget = target; let input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => handleProductImageUpload(e, target); input.click(); }

function handleProductImageUpload(event, target) {
    const file = event.target.files[0]; if(!file) return;
    executeWithAIWarning(() => {
        showFamilAIModal('זיהוי מוצר חכם', null); getEl('familai-loading-text').innerText = 'familAI בודקת איזה מוצר צילמת...';
        compressImage(file, 800, 800, 0.7, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                const res = await fetch(`${API}/shopping/identify-product`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', groupId: currentGroup.id }) }); const data = await res.json();
                if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
                if(data.success && data.productName) {
                    getEl('familai-advisor-modal').classList.add('hidden');
                    if (target === 'shop') { getEl('shop-item').value = data.productName; openShopModal(); } else { getEl('pantry-item').value = data.productName; openPantryModal(); }
                    showToast('success', 'המוצר זוהה בהצלחה!');
                } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', data.error || 'לא הצלחתי לזהות את המוצר בתמונה.'); }
            } catch(err) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאת תקשורת מול השרת.'); }
            event.target.value = '';
        });
    });
}

function closeBarcodeScanner() { const modal = getEl('barcode-scanner-modal'); if(modal) modal.classList.add('hidden'); }

// ======================================
// הוספה וגריעה חכמה מהמזווה (כולל שברים)
// ======================================

function renderPantry() {
    const list = getEl('pantry-list'); if(!list) return; list.innerHTML = '';
    if(pantryCache.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">המזווה/ארון ריק. הוסיפו מוצרים כדי לעקוב אחרי המלאי בבית!</p>'; return; }
    pantryCache.forEach(p => {
        const n = safeStr(p.item_name); const u = safeStr(p.unit || "יח'");
        const packQty = parseFloat(p.quantity); const upp = parseInt(p.units_per_package) || 1;
        const totalSubUnits = Math.round(packQty * upp);
        
        let qtyDisplay = '';
        if (upp > 1) {
            qtyDisplay = `
            <div class="flex flex-col items-center px-3 min-w-[75px]">
                <span class="text-2xl font-black text-slate-800 leading-none">${packQty.toFixed(2)}</span>
                <span class="text-[10px] font-bold text-slate-400 mt-1">${u}</span>
                <span class="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full mt-1.5 w-max shadow-sm tracking-tight">${totalSubUnits} יחידות</span>
            </div>`;
        } else {
            qtyDisplay = `
            <div class="flex flex-col items-center px-3 min-w-[75px]">
                <span class="text-2xl font-black text-slate-800 leading-none">${packQty}</span>
                <span class="text-xs font-bold text-slate-400 mt-1">${u}</span>
            </div>`;
        }

        const minusAmount = packQty - (1 / upp);
        const plusAmount = packQty + (1 / upp);

        const pantryDelCb = pantryMultiDeleteMode ? `<label class="absolute top-2 left-2 z-10 cursor-pointer"><input type="checkbox" class="pantry-del-cb w-5 h-5 accent-red-500 cursor-pointer rounded" data-id="${p.id}" onchange="updatePantryDeleteCount()"></label>` : '';
        list.innerHTML += `
        <div class="bg-white p-3.5 rounded-2xl border ${pantryMultiDeleteMode ? 'border-red-100' : 'border-slate-200'} shadow-sm flex flex-col mb-3 relative">${pantryDelCb}
            <div class="flex justify-between items-center mb-3">
                <div class="flex-1 pr-2">
                    <h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4>
                    <p class="text-[10px] text-slate-400 mt-1">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')} | מארז: ${upp} יח'</p>
                </div>
                <div class="flex items-center bg-slate-50 px-2 py-2 rounded-xl border border-slate-100 shadow-inner">
                    <button onclick="updatePantryQty(${p.id}, ${minusAmount})" class="text-slate-400 hover:text-red-500 w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm border border-slate-200 transition"><i class="fa-solid fa-minus text-sm"></i></button>
                    ${qtyDisplay}
                    <button onclick="updatePantryQty(${p.id}, ${plusAmount})" class="text-slate-400 hover:text-green-500 w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm border border-slate-200 transition"><i class="fa-solid fa-plus text-sm"></i></button>
                </div>
            </div>
            <div class="flex gap-2 mt-1 border-t border-slate-100 pt-3">
                <button onclick="openPantryUseModal('${n}', '${u}', ${packQty}, ${upp})" class="flex-1 bg-orange-50 text-orange-600 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-utensils text-orange-500"></i> השתמשתי</button>
                <button onclick="movePantryToCart(${p.id}, '${n}', '${u}')" class="flex-1 bg-pink-50 text-pink-600 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-pink-100 transition shadow-sm text-xs font-bold"><i class="fa-solid fa-cart-arrow-down text-pink-500"></i> חסר (לקניות)</button>
            </div>
        </div>`;
    });
}

function openPantryModal() { getEl('pantry-modal').classList.remove('hidden'); }

async function submitPantryItem() {
    const name = val('pantry-item'); const qty = parseFloat(val('pantry-quantity')) || 1; const unit = val('pantry-unit') || "יח'"; const upp = parseInt(val('pantry-upp')) || 1; 
    if(!name) return showToast('error', 'יש להזין שם מוצר');
    const btn = getEl('btn-submit-pantry'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try {
        const res = await fetch(`${API}/pantry/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit, unitsPerPackage: upp}) });
        const data = await res.json();
        if (data.success) { getEl('pantry-modal').classList.add('hidden'); val('pantry-item', ''); val('pantry-quantity', 1); getEl('pantry-unit').value = "יח'"; getEl('pantry-upp').value = 1; fetchData(); showToast('success', 'המוצר נקלט במלאי'); } 
        else { showToast('error', data.error || 'שגיאת שרת בהוספת הפריט'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'הוסף לבית'; } }
}

async function updatePantryQty(id, newQty) {
    if(newQty <= 0) { if(!confirm('המוצר אזל מהמלאי. האם למחוק את הרישום? (ניתן להעביר לרכש במקום)')) return; await fetch(`${API}/pantry/delete/${id}`, { method:'DELETE' }); } 
    else { await fetch(`${API}/pantry/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, quantity: newQty}) }); } fetchData();
}

function openPantryUseModal(name, unit, qty, upp) { 
    const totalSubUnits = Math.round(parseFloat(qty) * parseInt(upp || 1));
    getEl('use-pantry-title').innerText = `מה לקחת מ: ${name}?`; 
    getEl('use-pantry-name').value = name; 
    
    let dynContainer = getEl('pantry-dyn-container');
    if (!dynContainer) {
        const origInput = getEl('use-pantry-qty');
        if(origInput && origInput.parentElement && origInput.parentElement.parentElement) {
            dynContainer = document.createElement('div');
            dynContainer.id = 'pantry-dyn-container';
            origInput.parentElement.parentElement.insertBefore(dynContainer, origInput.parentElement);
            origInput.parentElement.style.display = 'none';
        }
    }
    
    if (dynContainer) {
        dynContainer.innerHTML = `
            <div class="text-center mb-4 bg-orange-50 text-orange-700 py-2.5 rounded-xl border border-orange-100 shadow-sm flex flex-col gap-1">
                <span class="font-bold text-sm">יתרה: ${parseFloat(qty).toFixed(2)} ${unit}</span>
                <span class="text-xs font-medium opacity-80">(סה"כ ${totalSubUnits} יחידות)</span>
            </div>
            
            <div class="space-y-3">
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1.5 ml-1">כמה יחידות לקחת?</label>
                    <input type="number" id="use-pantry-units-dyn" placeholder="יחידות בודדות" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-black text-slate-800 text-center shadow-sm focus:border-orange-500 transition">
                </div>
                
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-400 mb-1.5 ml-1">או: שימוש לפי מארז / משקל שלם</label>
                    <input type="number" step="0.1" id="use-pantry-qty-dyn" placeholder="כמה ${unit} לקחת?" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-slate-500 text-center text-sm focus:border-slate-400 transition">
                </div>
            </div>
        `;
    }
    
    const display = getEl('use-pantry-unit-display');
    if(display) display.innerText = unit || "יח'"; 
    getEl('pantry-use-modal').classList.remove('hidden'); 
}

async function submitPantryUse() {
    const name = val('use-pantry-name'); 
    const dynQty = val('use-pantry-qty-dyn');
    const origQty = val('use-pantry-qty');
    const qty = dynQty !== '' && dynQty !== undefined ? dynQty : origQty;
    
    const dynUnits = val('use-pantry-units-dyn');
    const origUnits = val('use-pantry-units');
    const units = dynUnits !== '' && dynUnits !== undefined ? dynUnits : origUnits;

    if((!qty || parseFloat(qty) <= 0) && (!units || parseFloat(units) <= 0)) return showToast('error', 'נא להזין כמות תקינה');
    
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: parseFloat(qty) || 0, usedUnits: parseFloat(units) || 0 }) }); const data = await res.json();
        if(data.success) { showToast('success', 'המלאי נגרע בהצלחה'); getEl('pantry-use-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}

async function movePantryToCart(pantryId, itemName, unit) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: itemName, quantity: 1, unit: unit, estimatedPrice: 0, userId: currentUser.id, groupId: currentGroup.id}) }); await fetch(`${API}/pantry/delete/${pantryId}`, { method:'DELETE' }); showToast('success', 'המוצר הועבר לבקשת רכש!'); fetchData(); }

function renderChildTodo() {
    const todoSection = getEl('child-todo-section'); const todoList = getEl('child-todo-list');
    if (!todoSection || !todoList) return; if (currentUser.role === 'ADMIN') { todoSection.classList.add('hidden'); return; }
    let hasItems = false; let htmlStr = '';
    const myTasks = allTasks.filter(t => String(t.assigned_to) === String(currentUser.id) && t.status === 'pending');
    myTasks.forEach(t => {
        hasItems = true; let dMsg = ''; if (t.deadline) { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? ` • <span class="text-orange-500">עוד ${diff} ימים</span>` : ` • <span class="text-red-500">פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-blue-100 shadow-sm flex justify-between items-center cursor-pointer hover:bg-blue-50 transition mb-2" onclick="switchTab('tasks')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-list-check"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(t.title)}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • משימה • תגמול: ₪${t.reward}${dMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    const myQuizzes = bundlesCache.filter(b => b.status === 'assigned');
    myQuizzes.forEach(b => {
        hasItems = true; const reward = (b.custom_reward !== null && b.custom_reward !== undefined) ? b.custom_reward : b.default_reward; let deadlineMsg = "";
        if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); deadlineMsg = diff > 0 ? ` • <span class="text-orange-500">עוד ${diff} ימים</span>` : ` • <span class="text-red-500">פג תוקף!</span>`; }
        const dateStr = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
        htmlStr += `<div class="bg-white p-3 rounded-2xl border border-purple-100 shadow-sm flex justify-between items-center cursor-pointer hover:bg-purple-50 transition mb-2" onclick="switchTab('academy')"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><i class="fa-solid fa-graduation-cap"></i></div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-500"><i class="fa-regular fa-calendar"></i> ${dateStr} • אתגר לימודי • תגמול: ₪${reward}${deadlineMsg}</p></div></div><i class="fa-solid fa-chevron-left text-slate-300"></i></div>`;
    });
    if (hasItems) { todoList.innerHTML = htmlStr; todoSection.classList.remove('hidden'); } else { todoList.innerHTML = ''; todoSection.classList.add('hidden'); }
}

function renderChildDashboard() {
    const isChild = currentUser && currentUser.role !== 'ADMIN';
    const header = getEl('child-home-header');
    const footer = getEl('child-home-footer');
    const balanceCard = getEl('tour-balance-card');
    const quickTiles = getEl('quick-tiles');

    if (!isChild) {
        if (header) header.classList.add('hidden');
        if (footer) footer.classList.add('hidden');
        return;
    }

    // Show child sections, hide admin ones
    if (header) header.classList.remove('hidden');
    if (footer) footer.classList.remove('hidden');
    if (balanceCard) balanceCard.classList.add('hidden');
    const adminBalRow = getEl('admin-balance-row');
    if (adminBalRow) adminBalRow.classList.add('hidden');
    if (quickTiles) quickTiles.classList.add('hidden');

    // Copy balance from the main balance element
    const mainBal = getEl('user-balance');
    const childBal = getEl('child-balance-display');
    if (childBal && mainBal) childBal.innerText = mainBal.innerText;

    // ילד לא רואה "אני בסופר" ועגלת קניות
    if (currentUser.role === 'CHILD') {
        // כפתור "אני בסופר" ורשימות שמורות (השורה ב-shop)
        const shopTopBtns = getEl('shop-supermarket-btns');
        if (shopTopBtns) shopTopBtns.classList.add('hidden');
        const cartFooter = getEl('cart-footer');
        if (cartFooter) cartFooter.classList.add('hidden');
    }

    // Greeting
    const greetEl = getEl('child-greeting-text');
    if (greetEl && currentUser.name) {
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב';
        greetEl.innerText = `${greet}, ${currentUser.name}! 👋`;
    }
}

function openApproveTaskModal(id, title, currentReward) { getEl('approve-task-id').value = id; getEl('approve-task-title').innerText = title; getEl('approve-task-reward').value = currentReward || 0; getEl('approve-task-modal').classList.remove('hidden'); }

async function submitTaskApproval() {
    const id = getEl('approve-task-id').value; const finalReward = getEl('approve-task-reward').value;
    getEl('approve-task-modal').classList.add('hidden'); triggerConfetti();
    const res = await fetch(`${API}/tasks/update`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ taskId: id, status: 'approved', finalReward: finalReward }) });
    const data = await res.json();
    if(data.success) { showToast('success', 'המשימה אושרה והתגמול הועבר!'); fetchData(); } else showToast('error', data.error);
}

function renderTasks(tasks) {
    const list = getEl('tasks-list'); if(!list) return; let htmlStr = ''; let count = 0;
    tasks.forEach(t => {
        const isMyTask = String(t.assigned_to) === String(currentUser.id); const isAdmin = currentUser.role === 'ADMIN'; if (!isMyTask && !isAdmin) return; count++;
        let statusColor = 'bg-white border-slate-50'; let statusBadge = ''; let actionBtn = '';
        if (t.status === 'pending') { if (isMyTask) { actionBtn = `<button onclick="clickTaskProof(${t.id}, '${safeStr(t.title)}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-1"><i class="fa-solid fa-camera"></i> סיימתי</button>`; } else { statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">ממתין לילד</span>`; } } 
        else if (t.status === 'done') { statusColor = 'bg-yellow-50 border-yellow-100'; if (isAdmin) { actionBtn = `<button onclick="openApproveTaskModal(${t.id}, '${safeStr(t.title)}', ${t.reward})" class="bg-green-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">אשר ושלם</button>`; } else { statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-lg">בבדיקה</span>`; } } 
        else if (t.status === 'approved') { statusColor = 'bg-green-50 border-green-100'; statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check"></i> בוצע</span>`; }
        const rewardDisplay = t.reward > 0 ? `<span class="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 rounded">₪${t.reward}</span>` : `<span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 rounded">אישי</span>`;
        let deadlineBadge = ''; if (t.deadline && t.status === 'pending') { const diff = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24)); if (diff > 0) deadlineBadge = `<span class="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> עוד ${diff} ימ'</span>`; else deadlineBadge = `<span class="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] ml-2 font-bold"><i class="fa-regular fa-clock"></i> פג תוקף!</span>`; }
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('he-IL') : ''; const dateBadge = dateStr ? `<span class="text-[9px] text-slate-400 mr-2"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>` : '';
        htmlStr += `<div class="card-modern p-4 flex justify-between items-center mb-2 rounded-2xl border shadow-sm ${statusColor}"><div><p class="font-bold text-slate-800">${safeStr(t.title)} ${deadlineBadge}</p><div class="flex items-center gap-2 mt-1"><span class="text-xs text-slate-500">${safeStr(t.assignee_name)}</span>${rewardDisplay}${dateBadge}</div></div><div class="flex flex-col items-end gap-1">${actionBtn}${statusBadge}</div></div>`;
    });
    if (count === 0) list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין משימות פתוחות</div>'; else list.innerHTML = htmlStr;
}

async function updateTask(id, s) { if(s==='done' || s==='completed_self') triggerConfetti(); await fetch(`${API}/tasks/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({taskId:id, status:s})}); fetchData(); }

function buildAndRenderFeed() {
    try {
        feedCache = [];
        
        // 1. הודעת מערכת (פתיחת משפחה)
        if (currentGroup && currentGroup.created_at) { 
            feedCache.push({ type: 'system', id: 'sys_creation', user_id: 0, user_name: 'מערכת', date: new Date(currentGroup.created_at), title: 'הבנק המשפחתי נפתח בהצלחה! 🎉', amount: 0, status: 'welcome' }); 
        }
        
        // 2. תנועות עובר ושב
        if(Array.isArray(allTransactions)) { 
            allTransactions.forEach(t => { 
                feedCache.push({ type: 'transaction', id: t.id, user_id: t.user_id, user_name: t.user_name || currentUser.nickname, date: t.date ? new Date(t.date) : new Date(), title: t.description, amount: t.amount, isIncome: t.type === 'income', category: t.category }); 
            }); 
        }
        
        // 3. משימות (רק מאושרות)
        if(Array.isArray(allTasks)) { 
            allTasks.forEach(t => { 
                if(t.status === 'approved') { 
                    feedCache.push({ type: 'task', id: `task_${t.id}`, user_id: t.assigned_to, user_name: t.assignee_name || currentUser.nickname, date: t.created_at ? new Date(t.created_at) : new Date(), title: `משימה: ${t.title}`, amount: t.reward, status: t.status }); 
                } 
            }); 
        }
        
        // 4. חידונים (אקדמיה)
        if(Array.isArray(bundlesCache)) { 
            bundlesCache.forEach(b => { 
                feedCache.push({ type: 'quiz', id: `quiz_${b.bundle_id}_${b.user_id || b.assigned_to_user || currentUser.id}`, user_id: b.user_id || b.assigned_to_user || currentUser.id, user_name: b.assignee_name || currentUser.nickname, date: b.assigned_at ? new Date(b.assigned_at) : (b.created_at ? new Date(b.created_at) : new Date()), title: `אתגר: ${b.title}`, amount: b.custom_reward !== null ? b.custom_reward : b.default_reward, status: b.status }); 
            }); 
        }
        
        // 5. עדכוני קהילה - טיפול בטוח באובייקטים המגיעים מהשרת
        if (window.communityUpdatesCache && Array.isArray(window.communityUpdatesCache)) {
            window.communityUpdatesCache.forEach(update => { 
                feedCache.push({
                    type: 'system',
                    id: update.id || ('comm_' + Math.random()),
                    user_id: 0,
                    user_name: 'קהילה',
                    date: update.date ? new Date(update.date) : new Date(),
                    title: update.description || update.title || 'עדכון מהקהילה',
                    amount: 0
                });
            });
        }

        // מיון לפי תאריך יורד בצורה בטוחה
        feedCache.sort((a, b) => {
            const dA = a.date instanceof Date && !isNaN(a.date) ? a.date.getTime() : 0;
            const dB = b.date instanceof Date && !isNaN(b.date) ? b.date.getTime() : 0;
            return dB - dA;
        });
        
        // טיפול בפילטר הראשי
        const filterEl = getEl('feed-user-filter');
        if (filterEl && currentUser) { 
            if(currentUser.role === 'ADMIN') filterEl.classList.remove('hidden'); 
            else filterEl.classList.add('hidden'); 
        }
        
        renderUnifiedFeed();
    } catch (err) {
        console.error("Error in buildAndRenderFeed:", err);
    }
}

function renderUnifiedFeed() {
    try {
        const list = getEl('unified-feed-list'); 
        if (!list) return;
        
        if (!currentUser) return;

        const userFilter = val('feed-user-filter') || 'all'; 
        const dateFilter = val('feed-date-filter') || 'all'; 
        
        let filtered = feedCache;
        
        // סינון לפי משתמש
        if (currentUser.role !== 'ADMIN') { 
            filtered = feedCache.filter(item => String(item.user_id) === String(currentUser.id) || item.type === 'system'); 
        } else if (userFilter !== 'all' && userFilter !== '') { 
            filtered = feedCache.filter(item => String(item.user_id) === String(userFilter) || item.type === 'system'); 
        }
        
        // סינון לפי תאריך
        if (dateFilter !== 'all') { 
            const monthsBack = parseInt(dateFilter); 
            const cutoffDate = new Date(); 
            cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); 
            filtered = filtered.filter(item => item.date && item.date >= cutoffDate); 
        }
        
        // מקסימום 30 פעולות למניעת עומס
        filtered = filtered.slice(0, 30); 
        
        // אם אין פעולות
        if(filtered.length === 0) { 
            list.innerHTML = '<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 mt-2"><i class="fa-solid fa-ghost text-4xl text-slate-200 mb-3"></i><p class="text-slate-400 text-sm font-medium">אין פעילות להצגה כרגע</p></div>'; 
            return; 
        }
        
        // ── FLOW balance widget (הורים/מנהלים בלבד) ──────────────
        let flowWidgetHtml = '';
        if (currentUser.role === 'ADMIN' && typeof familyFlowBalance !== 'undefined') {
            const flowBal = Math.floor(familyFlowBalance);
            const ilsVal = Math.floor(flowBal / 100) * 10;
            flowWidgetHtml = `<div onclick="openFlowWalletModal()" style="cursor:pointer;background:linear-gradient(135deg,#f59e0b,#d97706,#b45309);border-radius:20px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 20px rgba(245,158,11,0.35);position:relative;overflow:hidden;" id="flow-home-widget">
                <div style="position:absolute;inset:0;background:radial-gradient(circle at 80% 50%,rgba(255,255,255,0.12),transparent 60%);pointer-events:none;"></div>
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="background:rgba(255,255,255,0.2);border-radius:14px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;">🪙</div>
                    <div>
                        <div style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;margin-bottom:2px;">ארנק FLOW המשפחה</div>
                        <div style="color:white;font-size:26px;font-weight:900;line-height:1;">${flowBal} <span style="font-size:14px;">Flw</span></div>
                        ${ilsVal > 0 ? `<div style="color:rgba(255,255,255,0.75);font-size:10px;margin-top:2px;">שווה ₪${ilsVal} הנחה בקהילה</div>` : '<div style="color:rgba(255,255,255,0.65);font-size:10px;margin-top:2px;">צבור 100Flw למימוש הנחה</div>'}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                    <div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:6px 12px;color:white;font-size:11px;font-weight:700;">לארנק &larr;</div>
                    ${flowBal >= 100 ? `<div style="background:#10b981;border-radius:8px;padding:4px 10px;color:white;font-size:10px;font-weight:700;">ניתן למימוש ✓</div>` : ''}
                </div>
            </div>`;
        }

        let html = '';
        const today = new Date();

        filtered.forEach(item => {
            // טיפול בטוח בתאריכים
            if(!item.date || !(item.date instanceof Date) || isNaN(item.date.getTime())) return;
            
            const userIdNum = parseInt(item.user_id) || 0;
            const colorClass = item.type === 'system' ? 'bg-orange-50 border-orange-100' : (userColors[userIdNum % userColors.length] || 'bg-white border-slate-50'); 
            
            const userNameDisplay = item.type !== 'system' && item.user_name ? `<span class="text-xs font-bold text-slate-500 block mb-0.5">${safeStr(item.user_name)}</span>` : '';
            
            const d = item.date; 
            const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            const timeStr = d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'}); 
            const dateStr = isToday ? `היום, ${timeStr}` : `${d.toLocaleDateString('he-IL')} ${timeStr}`;
            
            let contentHtml = '';
            if (item.type === 'transaction') {
                const icon = item.isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
                const amountClass = item.isIncome ? 'text-green-600' : 'text-red-600'; 
                const prefix = item.isIncome ? '+' : '-';
                contentHtml = `<div class="flex justify-between items-center w-full"><div>${userNameDisplay}<p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div><span class="font-bold text-lg ${amountClass}" dir="ltr">${prefix}₪${parseFloat(item.amount || 0).toFixed(2)}</span></div>`;
            } else if (item.type === 'task') {
                const icon = '<i class="fa-solid fa-list-check text-blue-500 bg-blue-100 p-1.5 rounded-full text-[10px]"></i>'; 
                let statusLabel = item.status === 'pending' ? 'הוקצתה' : (item.status === 'done' ? 'ממתין לאישור' : 'הושלמה'); 
                let badgeClass = item.status === 'pending' ? 'bg-slate-100 text-slate-500' : (item.status === 'done' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600');
                contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
            } else if (item.type === 'quiz') {
                const icon = '<i class="fa-solid fa-graduation-cap text-purple-500 bg-purple-100 p-1.5 rounded-full text-[10px]"></i>'; 
                let statusLabel = item.status === 'assigned' ? 'הוקצה' : (item.status === 'completed' ? 'הושלם בהצטיינות' : 'נכשל/פג תוקף'); 
                let badgeClass = item.status === 'assigned' ? 'bg-slate-100 text-slate-500' : (item.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600');
                contentHtml = `<div class="flex justify-between items-center w-full opacity-90"><div>${userNameDisplay}<p class="font-bold text-slate-700 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr} • <span class="px-1.5 rounded ${badgeClass}">${statusLabel}</span></p></div><span class="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">₪${item.amount}</span></div>`;
            } else if (item.type === 'system') {
                const icon = '<i class="fa-solid fa-house text-orange-500 bg-orange-100 p-1.5 rounded-full text-[10px]"></i>';
                contentHtml = `<div class="flex justify-between items-center w-full"><div><p class="font-bold text-slate-800 leading-tight flex items-center gap-2 mt-0.5">${icon} <span>${safeStr(item.title)}</span></p><p class="text-[10px] text-slate-400 mt-1">${dateStr}</p></div></div>`;
            }
            
            html += `<div class="${colorClass} p-3.5 rounded-2xl shadow-sm border transform transition hover:scale-[1.01] mb-2 flex items-center">${contentHtml}</div>`;
        });
        
        const walletContainer = getEl('flow-wallet-widget-container');
        if (walletContainer) walletContainer.innerHTML = flowWidgetHtml;
        list.innerHTML = html;
    } catch (err) {
        console.error("Error in renderUnifiedFeed:", err);
    }
}

async function fetchCashflowData() {
    const list = document.getElementById('cashflow-list');
    if (!currentUser || !currentGroup) {
        if (list) list.innerHTML = '<p class="text-center text-amber-500 text-sm py-4 bg-amber-50 rounded-2xl border border-dashed border-amber-200 mt-2">ממתין לטעינת נתוני משתמש...</p>';
        return;
    }
    if (list) list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">מביא נתוני תזרים...</p>';
    try {
        const queryUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
        const res = await fetch(`${API}/transactions?groupId=${currentGroup.id}&userId=${queryUserId}&limit=200`);
        if (res.ok) {
            const data = await res.json();
            allTransactions = Array.isArray(data) ? data : [];
        } else {
            if (list) list.innerHTML = `<p class="text-center text-red-500 text-sm py-4">שגיאת שרת ${res.status}</p>`;
            return;
        }
    } catch(e) {
        if (list) list.innerHTML = '<p class="text-center text-red-500 text-sm py-4">שגיאת תקשורת עם השרת</p>';
        return;
    }
    try { renderCashflow(); } catch(e) {
        if (list) list.innerHTML = `<p class="text-center text-red-500 text-sm py-4">שגיאה: ${e.message}</p>`;
    }
}

function renderCashflow() {
    const list = getEl('cashflow-list'); if (!list) return;
    if (!currentUser) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">טוען...</p>'; return; }
    const userFilter = val('cashflow-user-filter') || 'all'; const dateFilter = val('cashflow-date-filter') || 'all';
    if (!Array.isArray(allTransactions) || allTransactions.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">אין תנועות תזרים להצגה.</p>';
        return;
    }
    let filtered = allTransactions.slice();
    try {
        if (currentUser.role !== 'ADMIN') { filtered = filtered.filter(t => String(t.user_id) === String(currentUser.id)); const cfFilter = getEl('cashflow-user-filter'); if(cfFilter) cfFilter.classList.add('hidden'); }
        else { const cfFilter = getEl('cashflow-user-filter'); if(cfFilter) cfFilter.classList.remove('hidden'); if (userFilter !== 'all' && userFilter !== '') { filtered = filtered.filter(t => String(t.user_id) === String(userFilter)); } }
        if (dateFilter !== 'all') { const monthsBack = parseInt(dateFilter); const cutoffDate = new Date(); cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack); filtered = filtered.filter(t => new Date(t.date) >= cutoffDate); }
    } catch(e) { filtered = allTransactions.slice(); }
    if (filtered.length === 0) { list.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">אין תנועות תזרים להצגה בתקופה זו.</p>'; return; }
    let html = '';
    filtered.forEach(t => {
        const isIncome = t.type === 'income'; const icon = isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
        const amountClass = isIncome ? 'text-green-600' : 'text-red-600'; const prefix = isIncome ? '+' : '-';
        const d = new Date(t.date); const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}`;
        const userName = t.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${safeStr(t.user_name)}</span>` : '';
        const catLabel = BUDGET_LABELS[t.category] || t.category || ''; const catBadge = catLabel ? `<span class="text-[9px] text-slate-400 border border-slate-200 px-1.5 rounded-full mr-2">${catLabel}</span>` : '';
        const editBtn = currentUser.role === 'ADMIN' ? `<button onclick="openEditTransactionModal(${t.id}, ${t.amount}, '${safeStr(t.description)}', '${t.category}', '${t.type}')" class="text-blue-500 bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-100 transition"><i class="fa-solid fa-pen text-xs"></i></button>` : '';
        html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between hover:border-blue-100 transition"><div class="flex-1 overflow-hidden pr-2"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${safeStr(t.description)}</span> ${userName}</p><p class="text-[10px] text-slate-400 mt-1">${dateStr} ${catBadge}</p></div><div class="flex items-center gap-3 pl-1"><span class="font-bold text-base ${amountClass} whitespace-nowrap" dir="ltr">${prefix}₪${t.amount}</span>${editBtn}</div></div>`;
    });

    list.innerHTML = html;
}

function openEditTransactionModal(id, amount, desc, cat, type) {
    getEl('edit-trans-id').value = id; getEl('edit-trans-old-amount').value = amount; getEl('edit-trans-type').value = type; getEl('edit-trans-amount').value = amount; getEl('edit-trans-desc').value = desc;
    const catSelect = getEl('edit-trans-cat'); catSelect.innerHTML = '';
    if(CATEGORIES[type]) { CATEGORIES[type].forEach(c => { const selected = c.value === cat ? 'selected' : ''; catSelect.innerHTML += `<option value="${c.value}" ${selected}>${c.label}</option>`; }); } else { catSelect.innerHTML += `<option value="${cat}" selected>${cat}</option>`; }
    getEl('edit-transaction-modal').classList.remove('hidden');
}

async function submitEditTransaction() {
    const id = val('edit-trans-id'); const amount = val('edit-trans-amount'); const desc = val('edit-trans-desc'); const cat = val('edit-trans-cat');
    if(!amount) return showToast('error', 'נא להזין סכום');
    const btn = getEl('btn-submit-edit-transaction'); if(btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try {
        const res = await fetch(`${API}/transaction/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ amount, description: desc, category: cat, requesterId: currentUser.id, groupId: currentGroup.id }) }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה עודכנה!'); getEl('edit-transaction-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה בעדכון'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'שמור שינויים'; } }
}

async function deleteTransaction() {
    const id = val('edit-trans-id'); if(!confirm('האם אתה בטוח שברצונך למחוק פעולה זו לחלוטין? היתרה תתעדכן בהתאם.')) return;
    try {
        const res = await fetch(`${API}/transaction/${id}?requesterId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json();
        if(data.success) { showToast('success', 'הפעולה נמחקה!'); getEl('edit-transaction-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function updateAssignDetails() { const select = getEl('assign-bundle-select'); const bundleId = select.value; const bundle = allBundles.find(b => b.id == bundleId); if(bundle) { getEl('assign-reward').value = bundle.reward; } }
function openAssignModal() {
    const cSelect = getEl('assign-child-select'); cSelect.innerHTML = '<option value="" disabled selected>בחר ילד...</option>';
    if(membersCache) { membersCache.forEach(m => { if(m.role !== 'ADMIN') cSelect.innerHTML += `<option value="${m.id}">${safeStr(fmtUserName(m) || m.nickname)}</option>`; }); }
    const bSelect = getEl('assign-bundle-select'); bSelect.innerHTML = '<option value="" disabled selected>בחר אתגר...</option>';
    if (allBundles && allBundles.length > 0) { allBundles.forEach(b => { bSelect.innerHTML += `<option value="${b.id}">[${b.type === 'math' ? '🔢' : (b.type === 'reading' ? '📖' : '📈')}] ${safeStr(b.title)} (${b.age_group})</option>`; }); } else { bSelect.innerHTML = '<option disabled>אין מבחנים זמינים</option>'; }
    getEl('assign-reward').value = ''; getEl('assign-days').value = ''; getEl('assign-quiz-modal').classList.remove('hidden');
}
function openAssignModalSpecific(bundleId) { openAssignModal(); setTimeout(() => { const select = getEl('assign-bundle-select'); if (select) { select.value = bundleId; updateAssignDetails(); } }, 100); }
async function submitAssignQuiz() {
    const childId = val('assign-child-select'); const bundleId = val('assign-bundle-select'); const reward = val('assign-reward'); const days = val('assign-days');
    if(!childId) return showToast('error', 'אנא בחר ילד להקצאה'); if(!bundleId) return showToast('error', 'אנא בחר אתגר להקצאה');
    const res = await fetch(`${API}/academy/assign`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: childId, bundleId: bundleId, reward: reward, days: days, groupId: currentGroup.id }) });
    const data = await res.json();
    if(data.success) { getEl('assign-quiz-modal').classList.add('hidden'); showToast('success', 'הוקצה בהצלחה'); fetchData(); } else showToast('error', data.error);
}

// ── KIDS OVERVIEW ────────────────────────────────────────────────────────────
async function loadKidsOverview() {
  const wrap = getEl('kids-overview-section');
  if (!wrap || currentUser?.role !== 'ADMIN') return;
  try {
    const res = await fetch(`${API}/kids/parent-overview/${currentGroup.id}`);
    const data = await res.json();
    if (!data.success) { wrap.innerHTML = `<p class="text-xs text-red-400 p-2">שגיאה בטעינת סקירת ילדים: ${data.error||''}</p>`; return; }

    const totalOpen = data.totalOpen || 0;
    const kids = data.kids || [];
    const history = data.history || [];
    window._kidsOverviewData = kids;

    // כותרת עם סיכום כללי
    let html = `
      <div class="mb-2">
        <div class="flex justify-between items-center mb-3 px-1">
          <h3 class="font-bold text-slate-800 text-sm">👨‍👩‍👧‍👦 סקירת ילדים</h3>
          <span class="bg-purple-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">${totalOpen} משימות פתוחות</span>
        </div>
        <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style="scroll-snap-type:x mandatory">`;

    kids.forEach(k => {
      const initials = (k.nickname || '?')[0].toUpperCase();
      const flw = parseFloat(k.flw_balance || 0).toFixed(0);
      const open = k.open_quests || 0;
      const games = k.games || [];
      const activeGames = games.filter(g => g.status === 'active');
      const doneGames   = games.filter(g => g.status === 'completed');

      // רכיב משחקים
      let gamesHtml = '';
      if (games.length === 0) {
        gamesHtml = `<div class="text-[10px] text-slate-400 text-center mt-1">אין משחקים</div>`;
      } else {
        gamesHtml = `<div class="mt-2 space-y-1">`;
        games.slice(0, 3).forEach(g => {
          const pct = g.rounds_total > 0 ? Math.round((g.rounds_used / g.rounds_total) * 100) : 0;
          const barColor = g.status === 'completed' ? 'bg-green-400' : 'bg-blue-400';
          gamesHtml += `
            <div>
              <div class="flex justify-between items-center mb-0.5">
                <span class="text-[10px] text-slate-600 font-medium truncate max-w-[100px]">${g.icon || '🎮'} ${g.game_name}</span>
                <span class="text-[9px] ${g.status === 'completed' ? 'text-green-600' : 'text-blue-600'} font-bold ml-1 whitespace-nowrap">${g.rounds_used}/${g.rounds_total}</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-1.5">
                <div class="${barColor} h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
              </div>
            </div>`;
        });
        if (games.length > 3) gamesHtml += `<div class="text-[9px] text-slate-400 text-center">+${games.length - 3} נוספים</div>`;
        gamesHtml += `</div>`;
      }

      html += `
        <div class="flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col gap-2 active:scale-95 transition-transform"
             style="min-width:148px;max-width:160px;scroll-snap-align:start;cursor:pointer"
             onclick="openKidDetailModal(${k.id})">
          <!-- אווטאר + שם -->
          <div class="flex items-center gap-2">
            <div class="relative flex-shrink-0" onclick="event.stopPropagation();triggerKidImageUpload(${k.id},this)" style="cursor:pointer">
              ${k.profile_image
                ? `<img src="${k.profile_image}" class="w-11 h-11 rounded-full object-cover border-2 border-purple-200 shadow-sm">`
                : `<div class="w-11 h-11 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-purple-200">${initials}</div>`}
              <div class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full border border-slate-200 flex items-center justify-center text-[8px] shadow">📷</div>
              <input type="file" accept="image/*" class="hidden kid-img-upload" data-kid-id="${k.id}" onchange="uploadKidProfileImage(${k.id},this)">
            </div>
            <div class="min-w-0">
              <div class="font-bold text-slate-800 text-xs truncate">${k.nickname}</div>
              <div class="text-[10px] text-yellow-600 font-bold">🪙 ${flw} FLW</div>
            </div>
          </div>
          <!-- סטטוס אתגרים -->
          <div class="flex gap-1 flex-wrap">
            ${open > 0
              ? `<span class="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">🎯 ${open} אתגר</span>`
              : `<span class="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-full">✅ הכל בוצע</span>`}
            ${activeGames.length > 0
              ? `<span class="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">🎮 ${activeGames.length} פעיל</span>`
              : ''}
            ${doneGames.length > 0
              ? `<span class="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-full">🏆 ${doneGames.length} הושלם</span>`
              : ''}
          </div>
          <!-- פס התקדמות משחקים -->
          ${gamesHtml}
        </div>`;
    });

    html += `</div>`;

    if (history.length > 0) {
      html += `<button onclick="toggleQuestActivity()" class="mt-3 text-xs text-purple-600 font-bold flex items-center gap-1 hover:underline">
        <span>📋 היסטוריית אתגרים</span><span class="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">${history.length}</span>
      </button>`;
    }
    html += `</div>`;

    wrap.innerHTML = html;

    // עדכן היסטוריה
    const actList = getEl('quest-activity-list');
    if (actList && history.length > 0) {
      actList.innerHTML = history.map(h => {
        const created = h.created_at ? new Date(h.created_at).toLocaleDateString('he-IL') : '';
        const completed = h.completed_at ? new Date(h.completed_at).toLocaleDateString('he-IL') : null;
        return `
          <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex gap-3 items-start">
            <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm
              ${completed ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}">
              ${completed ? '✅' : '⏳'}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-slate-700 text-sm truncate">${h.title || 'אתגר'}</div>
              <div class="text-[10px] text-slate-500 mt-0.5">
                ל: <span class="font-bold text-slate-600">${h.child_name || ''}</span>
                ${h.created_by_name ? ` · נוצר ע"י ${h.created_by_name}` : ''}
                · ${created}
              </div>
              ${completed ? `<div class="text-[10px] text-green-600 font-bold mt-0.5">בוצע: ${completed} · ציון ${h.score || 0}%</div>` : ''}
            </div>
            <div class="text-[10px] font-bold ${completed ? 'text-green-600' : 'text-orange-500'} whitespace-nowrap">
              ${completed ? 'הושלם' : 'פתוח'}
            </div>
          </div>`;
      }).join('');
    }
  } catch(e) { console.error('loadKidsOverview', e); if(wrap) wrap.innerHTML = `<p class="text-xs text-red-400 p-2">שגיאה: ${e.message}</p>`; }
}

function toggleQuestActivity() {
  const sec = getEl('quest-activity-section');
  if (sec) sec.classList.toggle('hidden');
}

function openKidDetailModal(kidId) {
  const kids = window._kidsOverviewData || [];
  const k = kids.find(x => x.id === kidId);
  if (!k) return;

  const initials = (k.nickname || '?')[0].toUpperCase();
  const flw = parseFloat(k.flw_balance || 0).toFixed(0);
  const open = k.open_quests || 0;
  const games = k.games || [];
  const activeGames = games.filter(g => g.status === 'active');
  const doneGames   = games.filter(g => g.status === 'completed');

  const avatarHtml = k.profile_image
    ? `<img src="${k.profile_image}" class="w-20 h-20 rounded-full object-cover border-4 border-purple-200 shadow-lg">`
    : `<div class="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg border-4 border-purple-200">${initials}</div>`;

  const fmtDate = d => d ? new Date(d).toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit',year:'2-digit'}) : null;

  const renderGame = g => {
    const pct = g.rounds_total > 0 ? Math.round((g.rounds_used / g.rounds_total) * 100) : 0;
    const isDone = g.status === 'completed';
    const opened = fmtDate(g.assigned_at);
    const closed  = fmtDate(g.expires_at);
    return `
      <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
        <div class="flex justify-between items-center mb-1.5">
          <span class="font-bold text-slate-700 text-sm">${g.icon || '🎮'} ${g.game_name}</span>
        </div>
        <div class="flex items-center gap-2 mb-1.5">
          <div class="flex-1 bg-slate-200 rounded-full h-2">
            <div class="${isDone ? 'bg-green-400' : 'bg-blue-400'} h-2 rounded-full" style="width:${pct}%"></div>
          </div>
          <span class="text-xs text-slate-500 font-bold whitespace-nowrap">${g.rounds_used}/${g.rounds_total}</span>
        </div>
        <div class="flex gap-3 text-[10px] text-slate-500">
          ${opened ? `<span>📅 נפתח: <b>${opened}</b></span>` : ''}
          ${closed  ? `<span>🏁 סיום: <b>${closed}</b></span>`  : ''}
          <span class="mr-auto text-yellow-600 font-bold">🪙 ${g.flw_per_round} FLW/סיבוב</span>
        </div>
      </div>`;
  };

  const renderQuest = q => {
    const isDone = !!q.completed_at;
    const opened = fmtDate(q.created_at);
    const closed  = fmtDate(q.completed_at);
    return `
      <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
        <div class="flex justify-between items-center mb-1">
          <span class="font-bold text-slate-700 text-sm">📋 ${q.title || 'אתגר'}</span>
          ${isDone ? `<span class="text-[10px] text-green-700 font-bold">ציון ${q.score || 0}%</span>` : ''}
        </div>
        <div class="flex gap-3 text-[10px] text-slate-500">
          ${opened ? `<span>📅 נפתח: <b>${opened}</b></span>` : ''}
          ${closed  ? `<span>✅ בוצע: <b>${closed}</b></span>`  : '<span class="text-orange-500 font-bold">⏳ פתוח</span>'}
          ${q.flw_reward ? `<span class="mr-auto text-yellow-600 font-bold">🪙 ${q.flw_reward} FLW</span>` : ''}
        </div>
      </div>`;
  };

  const activeGamesHtml  = activeGames.map(renderGame).join('') || `<p class="text-xs text-slate-400 text-center py-2">אין משחקים פעילים</p>`;
  const doneGamesHtml    = doneGames.map(renderGame).join('');
  const quests           = k.quests || [];
  const activeQuests     = quests.filter(q => !q.completed_at);
  const doneQuests       = quests.filter(q =>  q.completed_at);
  const activeQuestsHtml = activeQuests.map(renderQuest).join('') || `<p class="text-xs text-slate-400 text-center py-2">אין אתגרים פעילים</p>`;
  const doneQuestsHtml   = doneQuests.map(renderQuest).join('');

  const gamesHtml = 'unused';

  const html = `
    <div id="kid-detail-modal" class="fixed inset-0 z-50 flex items-end justify-center" onclick="if(event.target===this)closeKidDetailModal()" style="background:rgba(0,0,0,0.45)">
      <div class="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl overflow-y-auto" style="max-height:88vh;padding-bottom:env(safe-area-inset-bottom,16px)">
        <!-- ידית -->
        <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1 bg-slate-200 rounded-full"></div></div>
        <!-- כותרת -->
        <div class="flex flex-col items-center gap-2 pt-4 pb-5 border-b border-slate-100">
          <div class="relative" onclick="event.stopPropagation();triggerKidImageUploadById(${k.id})" style="cursor:pointer">
            ${avatarHtml}
            <div class="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full border-2 border-slate-200 flex items-center justify-center text-sm shadow">📷</div>
            <input type="file" accept="image/*" id="kid-modal-img-${k.id}" class="hidden" onchange="uploadKidProfileImage(${k.id},this)">
          </div>
          <h2 class="text-xl font-bold text-slate-800">${k.nickname}</h2>
          <div class="flex gap-3">
            <span class="bg-yellow-50 border border-yellow-100 text-yellow-700 font-bold text-sm px-3 py-1 rounded-full">🪙 ${flw} FLW</span>
            ${open > 0
              ? `<span class="bg-orange-50 border border-orange-100 text-orange-700 font-bold text-sm px-3 py-1 rounded-full">🎯 ${open} משימה פתוחה</span>`
              : `<span class="bg-green-50 border border-green-100 text-green-700 font-bold text-sm px-3 py-1 rounded-full">✅ הכל בוצע</span>`}
          </div>
        </div>
        <!-- גוף -->
        <div class="p-4 space-y-5">

          <!-- משחקים פעילים -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
              <h3 class="font-bold text-slate-700 text-sm">🎮 משחקים פעילים</h3>
              <span class="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">${activeGames.length}</span>
            </div>
            <div class="space-y-2">${activeGamesHtml}</div>
          </div>

          ${doneGames.length > 0 ? `
          <!-- משחקים שהסתיימו -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              <h3 class="font-bold text-slate-700 text-sm">🏆 משחקים שהושלמו</h3>
              <span class="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">${doneGames.length}</span>
            </div>
            <div class="space-y-2">${doneGamesHtml}</div>
          </div>` : ''}

          <!-- אתגרים פעילים -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
              <h3 class="font-bold text-slate-700 text-sm">🎯 אתגרים פעילים</h3>
              <span class="text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full">${activeQuests.length}</span>
            </div>
            <div class="space-y-2">${activeQuestsHtml}</div>
          </div>

          ${doneQuests.length > 0 ? `
          <!-- אתגרים שהסתיימו -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
              <h3 class="font-bold text-slate-700 text-sm">✅ אתגרים שהושלמו</h3>
              <span class="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">${doneQuests.length}</span>
            </div>
            <div class="space-y-2">${doneQuestsHtml}</div>
          </div>` : ''}

        </div>
        <!-- כפתור סגירה -->
        <div class="px-4 pb-4">
          <button onclick="closeKidDetailModal()" class="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-2xl text-sm hover:bg-slate-200 transition">סגור</button>
        </div>
      </div>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el.firstElementChild);
}

function closeKidDetailModal() {
  const m = document.getElementById('kid-detail-modal');
  if (m) m.remove();
}

function triggerKidImageUploadById(kidId) {
  const inp = document.getElementById(`kid-modal-img-${kidId}`);
  if (inp) inp.click();
}

function triggerKidImageUpload(kidId, wrapper) {
  const inp = wrapper.querySelector('.kid-img-upload');
  if (inp) inp.click();
}

async function uploadKidProfileImage(kidId, input) {
  const file = input.files[0];
  if (!file) return;
  showToast('info', '⏳ מעלה תמונה...');
  try {
    // נסה Cloudinary קודם
    const cfgRes = await fetch(`${API}/sa/settings/cloudinary_cloud_name,cloudinary_upload_preset`).catch(() => null);
    const cfg = cfgRes ? await cfgRes.json().catch(() => ({})) : {};
    const cloudName = cfg.cloudinary_cloud_name;
    const preset = cfg.cloudinary_upload_preset;

    let imageUrl;
    if (cloudName && preset) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', preset);
      fd.append('folder', 'family-flow-avatars');
      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
      const upData = await upRes.json();
      if (!upData.secure_url) throw new Error(upData.error?.message || 'שגיאת Cloudinary');
      imageUrl = upData.secure_url;
    } else {
      // fallback — שלח dataUrl לשרת
      imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    const res = await fetch(`${API}/kids/profile-image/${kidId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl })
    });
    if ((await res.json()).success) {
      showToast('success', '✅ תמונת פרופיל עודכנה');
      loadKidsOverview();
    }
  } catch(err) { showToast('error', 'שגיאה בהעלאה'); }
}

function renderAdminAcademy() {
    const list = getEl('admin-assignments-list'); if(!list || currentUser.role !== 'ADMIN') return;
    loadKidsOverview();
    let html = '<h4 class="font-bold text-slate-700 mt-2 mb-3">📚 ספריית מבחנים למשפחה</h4>';
    if (!allBundles || allBundles.length === 0) { html += '<p class="text-sm text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">אין מבחנים זמינים. לחץ על "יצירת אתגר familAI" למעלה!</p>'; } else {
        html += '<div class="space-y-2 mb-8">';
        allBundles.forEach(b => {
            const getIcon = (type) => type === 'math' ? '🔢' : (type === 'reading' ? '📖' : '📈'); const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-100 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • פרס: ₪${b.reward}</p></div></div><button onclick="openAssignModalSpecific(${b.id})" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition">הקצה לילד</button></div>`;
        }); html += '</div>';
    }
    html += '<h4 class="font-bold text-slate-700 mb-3 border-t border-slate-200 pt-6">🎯 מבחנים שהוקצו לאחרונה</h4>';
    if (!bundlesCache || bundlesCache.length === 0) { html += '<p class="text-sm text-slate-400 text-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">לא הוקצו מבחנים לאף ילד עדיין.</p>'; } else {
        html += '<div class="space-y-2 mb-4">';
        bundlesCache.forEach(b => {
            let statusColor = b.status === 'completed' ? 'text-green-500' : (b.status === 'failed' ? 'text-red-500' : 'text-orange-500'); let statusText = b.status === 'completed' ? 'הושלם' : (b.status === 'failed' ? 'נכשל' : 'ממתין'); const aDate = b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('he-IL') : '';
            html += `<div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center"><div><p class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</p><p class="text-[10px] text-slate-500 mt-0.5">הוקצה ל: <span class="font-bold text-slate-700">${safeStr(b.assignee_name)}</span> ב-${aDate}</p></div><span class="text-[10px] font-bold ${statusColor} bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${statusText}</span></div>`;
        }); html += '</div>';
    } list.innerHTML = html;

    // ── כרטיסי הקצאת משחק וקווסט — נוספים אחרי ספריית המבחנים הקיימת ──
    const academyCards = getEl('academy-new-cards');
    if(!academyCards) {
        const cardsDiv = document.createElement('div');
        cardsDiv.id = 'academy-new-cards';
        cardsDiv.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;margin-top:1.2rem;';
        cardsDiv.innerHTML = `
          <div onclick="openAssignGameModal()" style="
            background:linear-gradient(135deg,#EDE9FE,#DDD6FE);
            border:2px solid #7C3AED;border-radius:20px;padding:1.2rem;
            cursor:pointer;transition:transform 0.2s;text-align:center;
          " onmouseover="this.style.transform='scale(1.02)'"
             onmouseout="this.style.transform='scale(1)'">
            <div style="font-size:2.5rem;margin-bottom:0.4rem">🎮</div>
            <div style="font-weight:700;font-size:0.9rem;color:#5B21B6">הקצה משחק לילד</div>
            <div style="font-size:0.78rem;color:#7C3AED;margin-top:0.2rem">בחר משחק וקבע סיבובים</div>
          </div>
          <div onclick="openQuestWizard()" style="
            background:linear-gradient(135deg,#FEF3C7,#FDE68A);
            border:2px solid #F59E0B;border-radius:20px;padding:1.2rem;
            cursor:pointer;transition:transform 0.2s;text-align:center;
          " onmouseover="this.style.transform='scale(1.02)'"
             onmouseout="this.style.transform='scale(1)'">
            <div style="font-size:2.5rem;margin-bottom:0.4rem">✏️</div>
            <div style="font-weight:700;font-size:0.9rem;color:#92400E">בנה קווסט ידני</div>
            <div style="font-size:0.78rem;color:#B45309;margin-top:0.2rem">שאלות ותשובות בנושא שתבחר</div>
          </div>
        `;
        if(list) list.parentElement.appendChild(cardsDiv);
    }
}

function renderLibrary() {
    try {
        const libList = getEl('library-list'); if (!libList) return;
        const ageFilter = val('lib-age-filter') || 'all'; const catFilter = val('lib-cat-filter') || 'all';
        let filtered = Array.isArray(allBundles) ? [...allBundles] : [];
        if (ageFilter !== 'all') filtered = filtered.filter(b => b.age_group === ageFilter); if (catFilter !== 'all') filtered = filtered.filter(b => b.type === catFilter);
        if(Array.isArray(bundlesCache)) { const assignedBundleIds = bundlesCache.map(ua => Number(ua.bundle_id)); filtered = filtered.filter(b => !assignedBundleIds.includes(Number(b.id))); }
        if (filtered.length === 0) { libList.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 bg-slate-50 rounded-xl">אין מבחנים חדשים להציג כרגע.</p>'; return; }
        const getIcon = (type) => { if (type === 'math') return '<i class="fa-solid fa-calculator"></i>'; if (type === 'reading') return '<i class="fa-solid fa-book-open"></i>'; return '<i class="fa-solid fa-chart-line"></i>'; };
        let libHtml = '';
        filtered.forEach(b => {
            const cDate = b.created_at ? new Date(b.created_at).toLocaleDateString('he-IL') : '';
            libHtml += `<div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 hover:border-blue-200 transition"><div class="flex items-center gap-3"><div class="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm">${getIcon(b.type)}</div><div><h4 class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar"></i> ${cDate} • גיל ${b.age_group} • ₪${b.reward}</p></div></div><button onclick="requestChallenge(${b.id})" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-sm">התחל</button></div>`;
        }); libList.innerHTML = libHtml;
    } catch(err) { console.error(err); }
}

function renderMyAssignments(bundles) {
    const list = getEl('my-assignments-list'); const histList = getEl('academy-history-list'); const histCont = getEl('academy-history-container');
    if (!list) return; list.innerHTML = ''; if (histList) histList.innerHTML = ''; let histCount = 0; let actCount = 0;
    if(Array.isArray(bundles)) {
        bundles.forEach(b => {
            const reward = b.custom_reward !== null ? b.custom_reward : b.default_reward;
            if (b.status === 'assigned') {
                actCount++; let dMsg = ""; if (b.deadline) { const diff = Math.ceil((new Date(b.deadline) - new Date()) / (1000 * 60 * 60 * 24)); dMsg = diff > 0 ? `<span class="text-orange-500 font-bold bg-orange-50 px-1 rounded ml-2">עוד ${diff} ימים</span>` : `<span class="text-red-500 font-bold bg-red-50 px-1 rounded ml-2">איחור!</span>`; }
                list.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center mb-3"><div class="flex-1"><h4 class="font-bold text-slate-800">${safeStr(b.title)}</h4><p class="text-xs text-slate-500 mt-1">תמריץ מעבר: ₪${reward} ${dMsg}</p></div><button onclick="startQuiz(${b.bundle_id})" class="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold shadow hover:bg-blue-700 transition"><i class="fa-solid fa-play"></i> התחל</button></div>`;
            } else {
                histCount++; if(histList) { let sColor = b.status === 'completed' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'; let sText = b.status === 'completed' ? 'הושלם' : 'נכשל';
                histList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center mb-2"><div class="flex-1"><h4 class="font-bold text-slate-700 text-sm">${safeStr(b.title)}</h4><p class="text-[10px] text-slate-400 mt-1">ציון: ${b.score}% • תמריץ: ₪${b.status==='completed'?reward:0}</p></div><span class="text-[10px] font-bold px-2 py-1 rounded ${sColor}">${sText}</span></div>`; }
            }
        });
    }
    if (actCount === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין מטלות למידה פתוחות.</p>';
    if (histCount > 0 && histCont) histCont.classList.remove('hidden'); else if(histCont) histCont.classList.add('hidden');
}

async function requestChallenge(bundleId = null) {
    const btn = document.querySelector('#academy-user-view button'); if(btn) { btn.disabled = true; btn.innerText = 'מבקש...'; }
    try {
        const res = await fetch(`${API}/academy/request-challenge`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: bundleId, groupId: currentGroup.id }) }); const data = await res.json();
        if (data.success) { triggerConfetti(); showToast('success', 'הלומדה שויכה בהצלחה!'); fetchData(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בתקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = '🙋‍♂️ הגרל אתגר מהיר'; } }
}

async function startQuiz(bundleId) {
    const bundle = bundlesCache.find(b => b.bundle_id == bundleId); if(!bundle) return;
    currentQuizData = bundle; currentQuestionIndex = 0; quizScore = 0; currentWrongAnswers = []; 
    getEl('quiz-title').innerText = bundle.title; getEl('btn-tutor').classList.add('hidden'); 
    const textContainer = getEl('quiz-text-container');
    if (bundle.text_content) { textContainer.innerHTML = `<p>${bundle.text_content}</p>`; textContainer.classList.remove('hidden'); } else { textContainer.classList.add('hidden'); }
    getEl('quiz-runner-modal').classList.remove('hidden'); renderQuestion();
}

function renderQuestion() {
    const q = currentQuizData.questions[currentQuestionIndex];
    getEl('q-progress').innerText = `${currentQuestionIndex + 1} / ${currentQuizData.questions.length}`; getEl('q-text').innerText = q.q;
    const optsContainer = getEl('q-options'); optsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => { optsContainer.innerHTML += `<button onclick="submitAnswer(${idx})" class="quiz-option w-full p-4 rounded-xl text-right bg-slate-50 font-medium hover:bg-slate-100 text-slate-700">${opt}</button>`; });
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
    getEl('question-container').classList.add('hidden'); getEl('quiz-text-container').classList.add('hidden'); getEl('quiz-result').classList.remove('hidden');
    getEl('quiz-icon').innerHTML = passed ? '🏆' : '📚'; getEl('quiz-msg-title').innerText = passed ? 'כל הכבוד!' : 'לא נורא, אפשר לנסות שוב...'; getEl('quiz-msg-desc').innerText = passed ? `עברת את המבחן וזכית ב-₪${currentQuizData.custom_reward || currentQuizData.default_reward}` : `צריך ${currentQuizData.threshold}% כדי לעבור. נסה שוב!`; getEl('quiz-score-display').innerText = `ציון סופי: ${finalScore}%`;
    if (!passed && currentWrongAnswers.length > 0) getEl('btn-tutor').classList.remove('hidden');
    if (passed) triggerConfetti();
    await fetch(`${API}/academy/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, bundleId: currentQuizData.bundle_id, score: finalScore, groupId: currentGroup.id }) });
    fetchData(); 
}

function closeQuiz() { getEl('quiz-runner-modal').classList.add('hidden'); getEl('question-container').classList.remove('hidden'); getEl('quiz-result').classList.add('hidden'); }

function filterSuggestions(v) { const list = getEl('suggestions'); list.innerHTML = ''; if (!v) { list.classList.add('hidden'); return; } const filtered = FLAT_PRODUCTS.filter(p => p.name.includes(v)).slice(0, 8); if (filtered.length > 0) { list.classList.remove('hidden'); filtered.forEach(p => { const li = document.createElement('div'); li.className = 'suggestion-item'; li.innerHTML = `<div class="flex justify-between"><span>${p.name}</span><span class="text-[10px] text-slate-400">${p.category}</span></div>`; li.onclick = () => { getEl('shop-item').value = p.name; list.classList.add('hidden'); }; list.appendChild(li); }); } else { list.classList.add('hidden'); } }

async function submitShopItem() {
    const itemInput = getEl('shop-item'); const btn = getEl('btn-submit-shop');
    const item = itemInput.value.trim(); const qty = parseFloat(val('shop-quantity')) || 1; const est = parseFloat(val('shop-est-price')) || 0; const unit = val('shop-unit') || "יח'"; const upp = parseInt(val('shop-upp')) || 1;
    if(!item) return; if (btn && btn.disabled) return;
    const isKnown = FLAT_PRODUCTS.some(p => p.name === item) || categoryMapCache[item];
    if (!isKnown) {
        window._pendingShopItem = { item, qty, est, unit, upp };
        getEl('cat-picker-name').innerText = item;
        getEl('cat-picker-modal').classList.remove('hidden');
        return;
    }
    await _doSubmitShopItem(item, qty, est, unit, upp);
}

async function _doSubmitShopItem(item, qty, est, unit, upp) {
    const btn = getEl('btn-submit-shop');
    if (btn) { btn.disabled = true; btn.innerText = 'מוסיף...'; }
    try {
        const res = await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: item, quantity: qty, unit: unit, estimatedPrice: est, unitsPerPackage: upp, userId: currentUser.id, groupId: currentGroup.id}) });
        const data = await res.json();
        if (data.success) {
            const itemInput = getEl('shop-item');
            getEl('shop-modal').classList.add('hidden'); itemInput.value = ''; getEl('shop-est-price').value = ''; getEl('shop-quantity').value = 1; getEl('shop-unit').value = "יח'"; getEl('shop-upp').value = 1; getEl('suggestions').classList.add('hidden');
            if (data.alert && data.id) wisdomCache[data.id] = data.alert.msg;
            showToast('success', data.status === 'requested' ? 'הבקשה נשלחה להורה לאישור ⏳' : 'נוסף לרשימה'); fetchData();
        } else { showToast('error', data.error || 'שגיאת שרת בהוספת פריט לרכש'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } finally { if (btn) { btn.disabled = false; btn.innerText = 'הוסף'; } }
}

async function confirmCustomCategory() {
    const input = getEl('cat-custom-input');
    const category = (input.value || '').trim();
    if (!category) return showToast('error', 'יש להזין שם קטגוריה');
    input.value = '';
    await confirmCategoryPick(category);
}

async function confirmCategoryPick(category) {
    getEl('cat-picker-modal').classList.add('hidden');
    const p = window._pendingShopItem;
    if (!p) return;
    categoryMapCache[p.item] = category;
    fetch(`${API}/shopping/category-map`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, normalizedName: p.item, category }) });
    if (p._fromSupermarket) {
        await _doSmQuickAdd(p.item);
    } else {
        await _doSubmitShopItem(p.item, p.qty, p.est, p.unit, p.upp);
    }
    window._pendingShopItem = null;
}

// ==========================================
// --- AI Shopping List Generator ---
// ==========================================
async function openAiShoppingModal() {
    const modal = getEl('ai-shop-modal');
    const listEl = getEl('ai-shop-list');
    if (!modal || !listEl) return;
    listEl.innerHTML = `<div class="text-center py-12 text-slate-400"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3 text-violet-400"></i><p class="text-sm font-bold mt-2">מייצר רשימה...</p></div>`;
    modal.classList.remove('hidden');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
        const res = await fetch(`${API}/shopping/ai-generate-list`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (!handleAIResponseCheck(data)) return;
        if (!data.success) throw new Error(data.error || 'שגיאה');
        window._aiShopCategories = data.categories;
        renderAiShopList(data.categories);
    } catch(e) {
        clearTimeout(timeoutId);
        const isTimeout = e.name === 'AbortError';
        listEl.innerHTML = `<div class="text-center py-12 text-red-400"><i class="fa-solid fa-triangle-exclamation text-3xl mb-3"></i><p class="text-sm font-bold">${isTimeout ? 'הבקשה ארכה יותר מדי זמן' : 'שגיאה ביצירת הרשימה'}</p><button onclick="openAiShoppingModal()" class="mt-3 text-xs bg-violet-100 text-violet-700 px-4 py-2 rounded-xl font-bold">נסה שוב</button></div>`;
    }
}

function renderAiShopList(categories) {
    const listEl = getEl('ai-shop-list');
    if (!listEl) return;
    const catEmoji = { 'ירקות': '🥦', 'פירות': '🍊', 'שימורים': '🥫', 'יבשים': '🌾', 'דברי חלב': '🥛', 'שתיה': '🧃' };
    let html = '';
    categories.forEach((cat, ci) => {
        html += `<div>
            <div class="flex items-center gap-1.5 mb-2">
                <span class="text-base">${catEmoji[cat.name] || '🛒'}</span>
                <span class="text-xs font-black text-slate-600">${cat.name}</span>
            </div>
            <div class="space-y-1.5">`;
        cat.items.forEach((item, ii) => {
            const id = `ai-cb-${ci}-${ii}`;
            html += `<div class="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                <input type="checkbox" id="${id}" checked class="w-4 h-4 rounded accent-violet-500 shrink-0 cursor-pointer">
                <input type="text" value="${item.name}" class="flex-1 min-w-0 bg-transparent text-sm font-bold text-slate-700 outline-none" data-ai-name>
                <div class="flex items-center gap-1 shrink-0">
                    <input type="number" value="${item.qty}" min="0.5" step="0.5" class="w-12 text-center text-xs bg-white border border-slate-200 rounded-lg py-1 outline-none font-bold" data-ai-qty>
                    <span class="text-xs text-slate-400 w-6">${item.unit}</span>
                    <input type="hidden" value="${item.unit}" data-ai-unit>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    });
    listEl.innerHTML = html;
}

async function confirmAiShoppingList() {
    const listEl = getEl('ai-shop-list');
    if (!listEl) return;
    const rows = listEl.querySelectorAll('[data-ai-name]');
    const toAdd = [];
    rows.forEach(nameInput => {
        const wrapper = nameInput.closest('div.flex');
        if (!wrapper) return;
        const cb = wrapper.querySelector('input[type="checkbox"]');
        if (!cb || !cb.checked) return;
        const name = nameInput.value.trim();
        const qty = parseFloat(wrapper.querySelector('[data-ai-qty]')?.value) || 1;
        const unit = wrapper.querySelector('[data-ai-unit]')?.value || "יח'";
        if (name) toAdd.push({ name, qty, unit });
    });
    if (toAdd.length === 0) return showToast('error', 'לא נבחרו פריטים');
    getEl('ai-shop-modal').classList.add('hidden');
    showToast('success', `מוסיף ${toAdd.length} פריטים לרשימה...`);
    for (const item of toAdd) {
        try {
            await fetch(`${API}/shopping/add`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemName: item.name, quantity: item.qty, unit: item.unit, estimatedPrice: 0, unitsPerPackage: 1, userId: currentUser.id, groupId: currentGroup.id })
            });
        } catch(e) {}
    }
    fetchData();
}

async function loadCategoryMap() {
    if (!currentGroup || !currentGroup.id) return;
    try {
        const res = await fetch(`${API}/shopping/category-map?groupId=${currentGroup.id}`);
        const data = await res.json();
        if (Array.isArray(data)) { data.forEach(r => { categoryMapCache[r.normalized_name] = r.category; }); }
    } catch(e) {}
}

async function deleteItem(id) { if(!confirm('למחוק פריט דרישה זה?')) return; await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' }); showToast('success', 'נמחק בהצלחה'); fetchData(); }
function toggleShopMultiDelete() {
    shopMultiDeleteMode = !shopMultiDeleteMode;
    const btn = document.getElementById('btn-shop-multi-delete');
    const bar = document.getElementById('shop-delete-bar');
    if (btn) { btn.innerHTML = shopMultiDeleteMode ? '<i class="fa-solid fa-xmark mr-1"></i> ביטול בחירה' : '<i class="fa-solid fa-check-square mr-1"></i> בחר למחיקה'; btn.classList.toggle('bg-red-50', !shopMultiDeleteMode); btn.classList.toggle('text-red-600', !shopMultiDeleteMode); btn.classList.toggle('bg-slate-100', shopMultiDeleteMode); btn.classList.toggle('text-slate-600', shopMultiDeleteMode); }
    if (bar) bar.classList.toggle('hidden', !shopMultiDeleteMode);
    if (!shopMultiDeleteMode) updateShopDeleteCount();
    renderShopList();
}

function updateShopDeleteCount() {
    const cbs = document.querySelectorAll('.shop-del-cb:checked');
    const bar = document.getElementById('shop-delete-bar');
    const cnt = document.getElementById('shop-delete-count');
    if (cnt) cnt.textContent = cbs.length + ' פריטים נבחרו';
    if (bar) { if (shopMultiDeleteMode) { bar.classList.remove('hidden'); } }
}

async function deleteSelectedShopItems() {
    const cbs = document.querySelectorAll('.shop-del-cb:checked');
    if (cbs.length === 0) return showToast('error', 'לא נבחרו פריטים למחיקה');
    if (!confirm('למחוק ' + cbs.length + ' פריטים?')) return;
    const ids = Array.from(cbs).map(cb => cb.dataset.id);
    await Promise.all(ids.map(id => fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' })));
    showToast('success', ids.length + ' פריטים נמחקו');
    shopMultiDeleteMode = false;
    const bar = document.getElementById('shop-delete-bar');
    if (bar) bar.classList.add('hidden');
    const btn = document.getElementById('btn-shop-multi-delete');
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-check-square mr-1"></i> בחר למחיקה'; btn.classList.remove('bg-slate-100', 'text-slate-600'); btn.classList.add('bg-red-50', 'text-red-600'); }
    fetchData();
}

function togglePantryMultiDelete() {
    pantryMultiDeleteMode = !pantryMultiDeleteMode;
    const btn = document.getElementById('btn-pantry-multi-delete');
    const bar = document.getElementById('pantry-delete-bar');
    if (btn) { btn.innerHTML = pantryMultiDeleteMode ? '<i class="fa-solid fa-xmark mr-1"></i> ביטול בחירה' : '<i class="fa-solid fa-trash-can mr-1"></i> בחר למחיקה'; btn.classList.toggle('bg-red-50', !pantryMultiDeleteMode); btn.classList.toggle('text-red-500', !pantryMultiDeleteMode); btn.classList.toggle('border-red-200', !pantryMultiDeleteMode); btn.classList.toggle('bg-slate-100', pantryMultiDeleteMode); btn.classList.toggle('text-slate-600', pantryMultiDeleteMode); btn.classList.toggle('border-slate-200', pantryMultiDeleteMode); }
    if (bar) bar.classList.toggle('hidden', !pantryMultiDeleteMode);
    if (!pantryMultiDeleteMode) updatePantryDeleteCount();
    renderPantry();
}

function updatePantryDeleteCount() {
    const cbs = document.querySelectorAll('.pantry-del-cb:checked');
    const bar = document.getElementById('pantry-delete-bar');
    const cnt = document.getElementById('pantry-delete-count');
    if (cnt) cnt.textContent = cbs.length + ' פריטים נבחרו';
    if (bar && pantryMultiDeleteMode) bar.classList.remove('hidden');
}

async function deleteSelectedPantryItems() {
    const cbs = document.querySelectorAll('.pantry-del-cb:checked');
    if (cbs.length === 0) return showToast('error', 'לא נבחרו פריטים למחיקה');
    if (!confirm('למחוק ' + cbs.length + ' פריטים מהמזווה?')) return;
    const ids = Array.from(cbs).map(cb => cb.dataset.id);
    await Promise.all(ids.map(id => fetch(`${API}/pantry/delete/${id}`, { method: 'DELETE' })));
    showToast('success', ids.length + ' פריטים נמחקו');
    pantryMultiDeleteMode = false;
    const bar = document.getElementById('pantry-delete-bar');
    if (bar) bar.classList.add('hidden');
    const btn = document.getElementById('btn-pantry-multi-delete');
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-trash-can mr-1"></i> בחר למחיקה'; btn.classList.remove('bg-slate-100', 'text-slate-600', 'border-slate-200'); btn.classList.add('bg-red-50', 'text-red-500', 'border-red-200'); }
    fetchData();
}

async function clearEntireCart() {
    if(!confirm('האם אתה בטוח שברצונך למחוק את כל בקשות הרכש? פעולה זו אינה הפיכה.')) return;
    try { const res = await fetch(`${API}/shopping/clear/${currentGroup.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'הרשימה אופסה בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה בריקון הרשימה'); } } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

function toggleSelectAll() { const allItems = shoppingListCache; const anyPending = allItems.some(i => i.status === 'pending'); const targetStatus = anyPending; document.querySelectorAll('.shop-row').forEach(row => { if(row.classList.contains('missing')) return; const cb = row.querySelector('input[type="checkbox"]'); const inp = row.querySelector('.price-input'); cb.checked = targetStatus; row.classList.toggle('in-cart', targetStatus); inp.disabled = !targetStatus; }); calcRunningTotal(); allItems.forEach(i => { if(i.status !== 'bought') updateRow(i.id, 'check', targetStatus); }); }

function renderShopList() {
    if (document.activeElement.classList.contains('price-input')) return;
    const list = getEl('shop-list'); const reqList = getEl('shop-requests-list'); const reqContainer = getEl('shop-requests-container');
    const activeItems = []; const requestedItems = [];
    shoppingListCache.forEach(i => { if(i.status === 'requested') requestedItems.push(i); else activeItems.push(i); });
    
    let reqHtml = '';
    if (requestedItems.length > 0) {
        reqContainer.classList.remove('hidden');
        requestedItems.forEach(i => {
            const actions = currentUser.role === 'ADMIN' ? `<div class="flex gap-2"><button onclick="updateRow(${i.id}, 'approve_request')" class="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-green-200"><i class="fa-solid fa-check"></i></button><button onclick="deleteItem(${i.id})" class="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-200"><i class="fa-solid fa-xmark"></i></button></div>` : `<span class="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-1 rounded-lg">ממתין להורה</span>`;
            reqHtml += `<div class="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-orange-200 mb-2"><div><span class="font-bold text-slate-700">${safeStr(i.item_name)}</span><span class="text-xs text-slate-500 block">בקשה מאת: ${safeStr(i.requester_name)}</span></div>${actions}</div>`;
        });
        reqList.innerHTML = reqHtml;
    } else { reqContainer.classList.add('hidden'); }

    const isShopTabActive = getEl('tab-shop') && getEl('tab-shop').classList.contains('tab-active');

    if(activeItems.length === 0) { 
        list.innerHTML = `<div class="text-center py-12 text-slate-400">
  <i class="fa-solid fa-cart-shopping text-4xl mb-3"></i>
  <p class="font-bold text-sm">העגלה ריקה</p>
  <p class="text-xs mt-1">הוסף מוצרים מהקטלוג</p>
</div>`; 
        const f = getEl('cart-footer'); if(f) f.classList.add('hidden'); 
        const fc = getEl('fab-container'); if(fc) fc.classList.remove('fab-lifted'); 
        return; 
    }
    
    const isChild = currentUser && currentUser.role === 'CHILD';
    if (isShopTabActive && !isChild) { const f = getEl('cart-footer'); if(f) f.classList.remove('hidden'); const fc = getEl('fab-container'); if(fc) fc.classList.add('fab-lifted'); }
    else { const f = getEl('cart-footer'); if(f) f.classList.add('hidden'); const fc = getEl('fab-container'); if(fc) fc.classList.remove('fab-lifted'); }
    
    const getCatScore = (name, normalized) => {
        const lookups = [normalized, name].filter(Boolean);
        // קטגוריה ידנית של המשתמש — עדיפות עליונה
        for (const n of lookups) { if(categoryMapCache[n]) return categoryMapCache[n]; }
        // חיפוש ב-PRODUCT_DB
        for (const n of lookups) {
            for(const [cat, items] of Object.entries(PRODUCT_DB)) {
                if(items.includes(n)) return cat;
                if(items.some(p => n.includes(p) || (p.split(' ')[0].length > 2 && n.includes(p.split(' ')[0])))) return cat;
            }
        }
        return 'שונות';
    };
    activeItems.sort((a,b) => getCatScore(a.item_name, a.normalized_name).localeCompare(getCatScore(b.item_name, b.normalized_name)));
    const _shopListAd = _adsCache && _adsCache.shop_list;
    let currentCat = ''; let shopHtml = ''; let _shopItemCount = 0;
    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name, i.normalized_name); if(cat !== currentCat) { shopHtml += `<div class="category-header">${cat}</div>`; currentCat = cat; }
        _shopItemCount++;
        if(_shopItemCount === 5 && _shopListAd && _shopListAd.active && _shopListAd.img) {
            shopHtml += `<a href="${_shopListAd.link||'#'}" target="_blank" class="block w-full rounded-2xl overflow-hidden h-16 mb-2"><img src="${_shopListAd.img}" alt="" class="w-full h-full object-cover"></a>`;
        }
        const isChecked = i.status === 'in_cart'; const valPrice = i.estimated_price > 0 ? i.estimated_price : ''; 
        const savedWisdom = wisdomCache[i.id]; const showWisdom = savedWisdom && savedWisdom.length > 0;
        const unitPrice = parseFloat(i.estimated_price) || 0; const totalRowPrice = unitPrice * parseFloat(i.quantity);
        let bestPriceHtml = '';
        
        if (i.best_price && i.best_price.price_per_unit > 0) { 
            const bestP = parseFloat(i.best_price.price_per_unit).toFixed(2); 
            const dDate = new Date(i.best_price.trip_date).toLocaleDateString('he-IL');
            const sourceText = i.best_price.is_local ? 'קנית בעבר' : 'חוכמת ההמונים';
            const badgeColor = i.best_price.is_local ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600';
            const icon = i.best_price.is_local ? 'fa-clock-rotate-left' : 'fa-users';
            bestPriceHtml = `<div class="text-[9px] font-bold ${badgeColor} px-2 py-1 rounded-lg mt-1 w-fit"><i class="fa-solid ${icon}"></i> ${sourceText}: ₪${bestP}/${i.unit || "יח'"} (${safeStr(i.best_price.store_name)}, ${dDate})</div>`; 
        }

        const delCb = shopMultiDeleteMode ? `<label class="flex items-center flex-shrink-0 mr-1 cursor-pointer"><input type="checkbox" class="shop-del-cb w-5 h-5 accent-red-500 cursor-pointer rounded" data-id="${i.id}" onchange="updateShopDeleteCount()"></label>` : '';
        shopHtml += `<div class="shop-row bg-white p-3 rounded-xl border ${shopMultiDeleteMode ? 'border-red-100' : 'border-slate-100'} flex flex-col gap-2 shadow-sm mb-2 ${isChecked?'in-cart':''}" id="row-${i.id}"><div class="flex items-center gap-3">${delCb}<input type="checkbox" ${isChecked?'checked':''} onchange="updateRow(${i.id}, 'check', this.checked)" class="w-5 h-5 accent-blue-500 rounded-lg cursor-pointer flex-shrink-0"><div class="flex-1"><div class="flex justify-between items-start"><span class="text-slate-700 font-medium item-name">${safeStr(i.item_name)}</span><div class="flex gap-1"><button onclick="openEditShopItem(${i.id})" class="text-slate-300 hover:text-blue-500 text-xs px-1.5"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteItem(${i.id})" class="text-slate-300 hover:text-red-500 text-xs px-1.5"><i class="fa-solid fa-trash"></i></button></div></div><span class="text-[10px] text-slate-400">ביקש/ה: ${safeStr(i.requester_name)}</span>${bestPriceHtml}<div id="wisdom-${i.id}" class="text-xs text-blue-700 mt-2 font-medium ${showWisdom ? 'flex' : 'hidden'} bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit wisdom-alert items-center gap-2 transition-all"><i class="fa-solid fa-lightbulb text-yellow-400"></i><span>${savedWisdom || ''}</span></div></div></div><div class="flex gap-2 items-center pl-0 mt-1"><div class="relative w-24"><span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ל${safeStr(i.unit || "יח'")}</span><input type="number" id="price-${i.id}" value="${valPrice}" ${isChecked ? '' : 'disabled'} oninput="updateRow(${i.id}, 'price_calc', this.value)" onchange="updateRow(${i.id}, 'price_save', this.value)" class="price-input w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-8 pl-1 text-sm outline-none focus:border-blue-500 font-bold text-center"></div><div class="flex flex-col items-center leading-none"><span class="text-[9px] text-slate-400 mb-0.5">סה"כ</span><span class="text-xs font-bold text-slate-600" id="row-total-${i.id}">₪${totalRowPrice.toFixed(1)}</span></div><div class="flex flex-col items-center leading-none ml-auto"><span class="text-[9px] text-slate-400 mb-0.5">כמות</span><div class="flex items-center gap-1"><button onclick="adjustShopQty(${i.id},-1)" class="w-9 h-9 bg-slate-200 active:bg-red-200 text-slate-600 active:text-red-600 rounded-full text-lg font-black leading-none flex items-center justify-center transition shrink-0 touch-manipulation select-none">−</button><span class="text-xs font-bold text-slate-700 min-w-[2.8rem] text-center">${i.quantity}<br><span class="text-[9px] font-normal text-slate-400">${safeStr(i.unit || "יח'")}</span></span><button onclick="adjustShopQty(${i.id},1)" class="w-9 h-9 bg-slate-200 active:bg-green-200 text-slate-600 active:text-green-600 rounded-full text-lg font-black leading-none flex items-center justify-center transition shrink-0 touch-manipulation select-none">+</button></div></div><button onclick="toggleMissingLocal(${i.id})" class="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-500 transition mr-2" id="btn-missing-${i.id}">חסר בספק</button></div></div>`;
    });
    list.innerHTML = shopHtml; calcRunningTotal();
}

async function updateRow(id, type, value) {
    if (type === 'approve_request') { await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: 'pending'})}); }
    else if (type === 'check') { const row = getEl(`row-${id}`); const input = getEl(`price-${id}`); if(row) { row.classList.toggle('in-cart', value); input.disabled = !value; } await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: value ? 'in_cart' : 'pending'})}); } 
    else if (type === 'price_calc') { const item = shoppingListCache.find(i => i.id == id); if(item) { const unitPrice = parseFloat(value) || 0; const total = unitPrice * parseFloat(item.quantity); const totalEl = getEl(`row-total-${id}`); if(totalEl) totalEl.innerText = `₪${total.toFixed(1)}`; } calcRunningTotal(); return; }
    else if (type === 'price_save') { const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, estimatedPrice: parseFloat(value) || 0})}); const data = await res.json(); const freshWisdomDiv = getEl(`wisdom-${id}`); if(freshWisdomDiv) { if(data.alert) { wisdomCache[id] = data.alert.msg; freshWisdomDiv.querySelector('span').innerText = data.alert.msg; freshWisdomDiv.classList.remove('hidden'); freshWisdomDiv.classList.add('flex'); } else { delete wisdomCache[id]; freshWisdomDiv.classList.add('hidden'); freshWisdomDiv.classList.remove('flex'); } } const cachedItem = shoppingListCache.find(i => i.id == id); if(cachedItem) cachedItem.estimated_price = parseFloat(value) || 0; } 
    if(type === 'approve_request') fetchData(); else calcRunningTotal(); 
}

function toggleMissingLocal(id) { const row = getEl(`row-${id}`); const btn = getEl(`btn-missing-${id}`); const isMissing = row.classList.contains('missing'); if (!isMissing) { row.classList.add('missing'); row.classList.remove('in-cart'); row.querySelector('input[type="checkbox"]').checked = false; row.querySelector('input[type="checkbox"]').disabled = true; getEl(`price-${id}`).disabled = true; btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'מבוטל'; } else { row.classList.remove('missing'); row.querySelector('input[type="checkbox"]').disabled = false; btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-200'); btn.innerText = 'חסר בספק'; } calcRunningTotal(); }

function calcRunningTotal() { 
    let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        const isChecked = row.querySelector('input[type="checkbox"]').checked; const isMissing = row.classList.contains('missing'); 
        if (isChecked && !isMissing) { 
            const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
            const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; 
            total += (unitPrice * qty); 
        } 
    }); 
    getEl('cart-total-display').innerText = `₪${total.toFixed(2)}`; 
}

function openCheckoutSummary() { 
    let count = 0; let missing = 0; let total = 0; 
    document.querySelectorAll('.shop-row').forEach(row => { 
        if (row.classList.contains('missing')) missing++; 
        else if (row.querySelector('input[type="checkbox"]').checked) { 
            count++; const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id); 
            const unitPrice = parseFloat(row.querySelector('.price-input').value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; total += (unitPrice * qty); 
        } 
    }); 
    if (count === 0 && missing === 0) { showToast('error', 'לא סימנת כלום לאישור'); return; } 
    getEl('summ-count').innerText = count; getEl('summ-missing').innerText = missing; getEl('summ-total').innerText = `₪${total.toFixed(2)}`; getEl('confirm-checkout-modal').classList.remove('hidden'); 
}

async function submitFinalCheckout() {
    const store = val('checkout-store') || 'סופר כללי'; const branch = val('checkout-branch'); let total = 0; const boughtItems = []; const missingItems = [];
    document.querySelectorAll('.shop-row').forEach(row => {
        const id = row.id.replace('row-', ''); const itemData = shoppingListCache.find(i => i.id == id);
        if (row.classList.contains('missing')) { missingItems.push({ id }); } 
        else if (row.querySelector('input[type="checkbox"]').checked) {
            const unitPrice = parseFloat(getEl(`price-${id}`).value) || 0; const qty = itemData ? parseFloat(itemData.quantity) : 1; const rowTotal = unitPrice * qty; total += rowTotal;
            boughtItems.push({ id, name: itemData ? itemData.item_name : 'פריט', quantity: qty, price: rowTotal });
        }
    });
    const res = await fetch(`${API}/shopping/checkout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ totalAmount: total, userId: currentUser.id, storeName: store, branchName: branch, boughtItems, missingItems }) });
    const data = await res.json();
    if(data.success) {
        getEl('confirm-checkout-modal').classList.add('hidden');
        showToast('success', 'הקניה בוצעה ואושרה למזווה!');
        if (missingItems.length > 0) {
            window._pendingMissingItems = missingItems.map(mi => { const item = shoppingListCache.find(i => i.id == mi.id); return item ? { item_name: item.item_name, quantity: item.quantity, unit: item.unit, estimated_price: item.estimated_price, units_per_package: item.units_per_package } : null; }).filter(Boolean);
            getEl('missing-count-text').innerText = missingItems.length;
            getEl('missing-draft-modal').classList.remove('hidden');
        }
        fetchData();
    } else showToast('error', data.error);
}

async function copyList(tripId) { if(!confirm('האם לייבא את דרישת הרכש מחדש?')) return; await fetch(`${API}/shopping/copy`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tripId, userId: currentUser.id}) }); getEl('history-modal').classList.add('hidden'); showToast('success', 'הדרישה הועתקה!'); fetchData(); }

function openInviteModal() { const codeSpan = getEl('display-group-code'); if (currentGroup && currentGroup.group_code) { codeSpan.innerText = currentGroup.group_code; } else { codeSpan.innerText = 'שגיאה: חסר קוד'; } getEl('invite-modal').classList.remove('hidden'); }
function sendWhatsAppInvite(role) { 
    if (!currentGroup || !currentGroup.group_code) return showToast('error', 'קוד משפחה לא זמין כרגע'); const url = window.location.origin; const joinLink = `${url}/?code=${currentGroup.group_code}&role=${role}`; 
    let text = role === 'ADMIN' ? `היי! פתחנו בנק משפחתי ב-Oneflow Life 🚀\n\nהוגדרת כמנהל/ת במערכת.\nקוד המשפחה שלנו הוא: ${currentGroup.group_code}\nכניסה מהירה:\n🔗 ${joinLink}` : `היי! עברנו להתנהל עם Oneflow Life 🚀\n\nקוד המשפחה לכניסה הוא: ${currentGroup.group_code}\nלחץ על הקישור כדי להתחבר:\n🔗 ${joinLink}`; 
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); getEl('invite-modal').classList.add('hidden'); 
}

function toggleFab() { getEl('fab-container').classList.toggle('fab-open'); }

// ============================================================
// --- SUPERMARKET MODE (Feature 2) ---
// ============================================================

let _smFastPollInterval = null;
let _smKnownItemIds = new Set();

function openSupermarketMode() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) { showToast('error', 'אין פריטים ברשימה להתחיל קניה'); return; }
    // שמירת IDs ידועים לפני כניסה למצב סופר
    _smKnownItemIds = new Set(shoppingListCache.map(i => i.id));
    renderSupermarketList();
    getEl('supermarket-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // רישום בשרת שאני בסופר + polling מהיר
    fetch(`${API}/shopping/supermarket/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id }) }).catch(() => {});
    startSmFastPoll();
}

function closeSupermarketMode() {
    getEl('supermarket-modal').classList.add('hidden');
    document.body.style.overflow = '';
    // סיום רישום בשרת + עצירת polling מהיר
    fetch(`${API}/shopping/supermarket/end`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: currentGroup.id }) }).catch(() => {});
    stopSmFastPoll();
}

function startSmFastPoll() {
    stopSmFastPoll();
    _smFastPollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API}/data/${currentUser.id}`);
            const data = await res.json();
            if (!data || !data.shopping_list) return;
            const prevIds = _smKnownItemIds;
            const newItems = data.shopping_list.filter(i => !prevIds.has(i.id) && i.status !== 'requested');
            if (newItems.length > 0) {
                newItems.forEach(i => showSmNewItemNotification(i.item_name));
                newItems.forEach(i => _smKnownItemIds.add(i.id));
            }
            shoppingListCache = data.shopping_list;
            // עדכן את מצב הסיום גם בסופרמרקט אם המודל פתוח
            const modal = getEl('supermarket-modal');
            if (modal && !modal.classList.contains('hidden')) renderSupermarketList();
        } catch(e) {}
    }, 4000);
}

function stopSmFastPoll() {
    if (_smFastPollInterval) { clearInterval(_smFastPollInterval); _smFastPollInterval = null; }
}

function showSmNewItemNotification(itemName) {
    const existing = document.getElementById('sm-new-item-notif');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'sm-new-item-notif';
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99998;font-family:Rubik,sans-serif;direction:rtl;animation:smNotifIn 0.35s ease;';
    el.innerHTML = `<div style="background:linear-gradient(135deg,#10b981,#0d9488);color:#fff;border-radius:24px;padding:20px 28px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4);min-width:240px;max-width:300px;">
        <div style="font-size:36px;margin-bottom:8px">🛍️</div>
        <p style="font-size:11px;font-weight:600;opacity:0.85;margin:0 0 4px">נוסף לרשימה</p>
        <p style="font-size:18px;font-weight:900;margin:0">${itemName}</p>
    </div>`;
    if (!document.getElementById('sm-notif-style')) {
        const s = document.createElement('style');
        s.id = 'sm-notif-style';
        s.textContent = '@keyframes smNotifIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}';
        document.head.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function renderSmBanner(groupData) {
    const banner = getEl('sm-status-banner');
    const nameEl = getEl('sm-banner-name');
    if (!banner) return;
    const smUserId = groupData?.sm_user_id;
    if (smUserId && smUserId !== currentUser.id) {
        const name = groupData.sm_user_name || 'מישהו';
        if (nameEl) nameEl.textContent = `${name} נמצא עכשיו בסופר`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function renderSupermarketList() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    const getCatScore = (name, normalized) => { const ll = [normalized,name].filter(Boolean); for(const n of ll) { if(categoryMapCache[n]) return categoryMapCache[n]; } for(const n of ll) { for(const [cat,items] of Object.entries(PRODUCT_DB)) { if(items.includes(n)) return cat; if(items.some(p => n.includes(p)||(p.split(' ')[0].length>2&&n.includes(p.split(' ')[0])))) return cat; } } return 'שונות'; };
    activeItems.sort((a,b) => getCatScore(a.item_name, a.normalized_name).localeCompare(getCatScore(b.item_name, b.normalized_name)));
    let currentCat = ''; let html = '';
    activeItems.forEach(i => {
        const cat = getCatScore(i.item_name, i.normalized_name);
        if(cat !== currentCat) {
            html += `<div class="text-emerald-400 text-xs font-black uppercase tracking-wider px-2 pt-3 pb-1">${cat}</div>`;
            currentCat = cat;
        }
        const isChecked = i.status === 'in_cart';
        const isMissing = i._smMissing;
        html += `<div id="sm-row-${i.id}" class="flex items-center gap-3 p-4 rounded-2xl transition ${isChecked ? 'bg-emerald-800/60' : isMissing ? 'bg-red-900/40 opacity-60' : 'bg-emerald-900/60'} border ${isChecked ? 'border-emerald-500' : isMissing ? 'border-red-700' : 'border-emerald-800'}">
            <button onclick="smToggleItem(${i.id})" class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition ${isChecked ? 'bg-emerald-400 border-emerald-400 text-emerald-900' : 'border-emerald-600 text-transparent'}">${isChecked ? '<i class="fa-solid fa-check font-bold"></i>' : ''}</button>
            <div class="flex-1 min-w-0">
                <p class="text-white font-bold text-base truncate">${safeStr(i.item_name)}</p>
                <p class="text-emerald-400 text-xs">${i.quantity} ${safeStr(i.unit || "יח'")}</p>
            </div>
            <div class="flex flex-col items-end gap-1">
                <input type="number" id="sm-price-${i.id}" value="${i.estimated_price > 0 ? i.estimated_price : ''}" placeholder="₪מחיר" oninput="smUpdatePrice(${i.id}, this.value)" class="w-20 bg-emerald-950 border border-emerald-700 text-white text-sm text-center rounded-xl px-2 py-1.5 outline-none focus:border-emerald-400 placeholder-emerald-700">
                <button onclick="smToggleMissing(${i.id})" class="text-[10px] font-bold px-2 py-1 rounded-lg transition ${isMissing ? 'bg-red-700 text-white' : 'text-red-400 hover:bg-red-900/40'}">${isMissing ? 'מבוטל ✕' : 'חסר'}</button>
            </div>
        </div>`;
    });
    getEl('sm-list').innerHTML = html;
    smCalcTotal();
}

let _smPriceModalItemId = null;

function smToggleItem(id) {
    const item = shoppingListCache.find(i => i.id == id);
    if (!item) return;
    const isChecked = item.status === 'in_cart';
    const newStatus = isChecked ? 'pending' : 'in_cart';
    item.status = newStatus;
    item._smMissing = false;
    fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, status: newStatus})});
    renderSupermarketList();
    if (newStatus === 'in_cart') {
        _smPriceModalItemId = id;
        getEl('sm-price-modal-name').innerText = item.item_name;
        getEl('sm-price-modal-qty').innerText = `${item.quantity} ${item.unit || "יח'"}`;
        const inp = getEl('sm-price-modal-input');
        inp.value = item.estimated_price > 0 ? item.estimated_price : '';
        getEl('sm-price-modal').classList.remove('hidden');
        setTimeout(() => inp.focus(), 100);
    }
}

function smConfirmPrice() {
    const price = parseFloat(getEl('sm-price-modal-input').value) || 0;
    if (_smPriceModalItemId !== null) {
        smUpdatePrice(_smPriceModalItemId, price);
        const inp = getEl(`sm-price-${_smPriceModalItemId}`);
        if (inp) inp.value = price > 0 ? price : '';
    }
    getEl('sm-price-modal').classList.add('hidden');
    _smPriceModalItemId = null;
}

function smSkipPrice() {
    getEl('sm-price-modal').classList.add('hidden');
    _smPriceModalItemId = null;
}

function _getAllCategories() {
    const cats = new Set(Object.keys(PRODUCT_DB));
    Object.values(categoryMapCache).forEach(c => cats.add(c));
    return [...cats];
}

function openEditShopItem(id) {
    const item = shoppingListCache.find(i => i.id == id);
    if (!item) return;
    getEl('edit-item-id').value = id;
    getEl('edit-item-name').value = item.item_name;
    getEl('edit-item-quantity').value = item.quantity;
    const unitSel = getEl('edit-item-unit');
    const unitVal = item.unit || "יח'";
    let found = false;
    for (let opt of unitSel.options) { if (opt.value === unitVal) { opt.selected = true; found = true; break; } }
    if (!found) { const opt = new Option(unitVal, unitVal, true, true); unitSel.add(opt); }
    getEl('edit-item-price').value = item.estimated_price > 0 ? item.estimated_price : '';
    const catSel = getEl('edit-item-category');
    catSel.innerHTML = '';
    const currentCat = (() => { for(const [cat, items] of Object.entries(PRODUCT_DB)) { if(items.includes(item.item_name)) return cat; } return categoryMapCache[item.item_name] || 'שונות'; })();
    _getAllCategories().concat(['שונות']).filter((v,i,a)=>a.indexOf(v)===i).forEach(cat => {
        const opt = new Option(cat, cat, false, cat === currentCat);
        catSel.add(opt);
    });
    getEl('edit-shop-item-modal').classList.remove('hidden');
}

async function saveEditShopItem() {
    const id = getEl('edit-item-id').value;
    const name = getEl('edit-item-name').value.trim();
    const qty = parseFloat(getEl('edit-item-quantity').value) || 1;
    const unit = getEl('edit-item-unit').value;
    const price = parseFloat(getEl('edit-item-price').value) || 0;
    const category = getEl('edit-item-category').value;
    if (!name) return showToast('error', 'שם הפריט חסר');
    try {
        const res = await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({itemId: id, itemName: name, quantity: qty, unit, estimatedPrice: price})});
        const data = await res.json();
        if (data.success) {
            if (category) {
                categoryMapCache[name] = category;
                fetch(`${API}/shopping/category-map`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({groupId: currentGroup.id, normalizedName: name, category})});
            }
            const cachedItem = shoppingListCache.find(i => i.id == id);
            if (cachedItem) { cachedItem.item_name = name; cachedItem.normalized_name = name; }
            getEl('edit-shop-item-modal').classList.add('hidden');
            showToast('success', 'הפריט עודכן');
            fetchData();
        } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function adjustShopQty(id, delta) {
    const item = shoppingListCache.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(0.5, parseFloat(item.quantity) + delta);
    item.quantity = newQty;
    renderShopList();
    try {
        await fetch(`${API}/shopping/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: id, quantity: newQty }) });
    } catch(e) { item.quantity = parseFloat(item.quantity) - delta; renderShopList(); }
}

async function smQuickAdd() {
    const input = getEl('sm-quick-input');
    const name = (input.value || '').trim();
    if (!name) return;
    const isKnown = FLAT_PRODUCTS.some(p => p.name === name) || categoryMapCache[name];
    if (!isKnown) {
        input.value = '';
        window._pendingShopItem = { item: name, qty: 1, est: 0, unit: "יח'", upp: 1, _fromSupermarket: true };
        getEl('cat-picker-name').innerText = name;
        getEl('cat-custom-input').value = '';
        getEl('cat-picker-modal').classList.remove('hidden');
        return;
    }
    input.value = '';
    await _doSmQuickAdd(name);
}

async function _doSmQuickAdd(name) {
    try {
        const res = await fetch(`${API}/shopping/add`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: name, quantity: 1, unit: "יח'", estimatedPrice: 0, userId: currentUser.id, groupId: currentGroup.id})});
        const data = await res.json();
        if (data.success) { await fetchData(); renderSupermarketList(); showToast('success', `${name} נוסף לרשימה`); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function smToggleMissing(id) {
    const item = shoppingListCache.find(i => i.id == id);
    if (!item) return;
    item._smMissing = !item._smMissing;
    if (item._smMissing) { item.status = 'pending'; fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, status: 'pending'})}); }
    renderSupermarketList();
}

function smUpdatePrice(id, value) {
    const item = shoppingListCache.find(i => i.id == id);
    if (item) { item.estimated_price = parseFloat(value) || 0; }
    smCalcTotal();
    clearTimeout(window._smPriceTimer);
    window._smPriceTimer = setTimeout(() => {
        fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId: id, estimatedPrice: parseFloat(value) || 0})});
    }, 800);
}

function smCalcTotal() {
    let total = 0; let found = 0; let all = shoppingListCache.filter(i => i.status !== 'requested').length;
    shoppingListCache.filter(i => i.status !== 'requested').forEach(i => {
        if (i.status === 'in_cart') { total += (parseFloat(i.estimated_price) || 0) * (parseFloat(i.quantity) || 1); found++; }
    });
    const smTotalEl = getEl('sm-total'); if (smTotalEl) smTotalEl.innerText = `₪${total.toFixed(2)}`;
    const smProgressEl = getEl('sm-progress-text'); if (smProgressEl) smProgressEl.innerText = `${found} מתוך ${all} פריטים נמצאו`;
}

// ============================================================
// --- SAVED SHOPPING LISTS (Feature 5) ---
// ============================================================

async function openSavedListsModal() {
    getEl('saved-lists-modal').classList.remove('hidden');
    await loadSavedLists();
}

async function loadSavedLists() {
    try {
        const res = await fetch(`${API}/shopping/saved?groupId=${currentGroup.id}`);
        const data = await res.json();
        const container = getEl('saved-lists-content');
        if (!data || data.length === 0) { container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">אין רשימות שמורות עדיין</p>'; return; }
        container.innerHTML = data.map(list => `
            <div class="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-700 text-sm truncate">${safeStr(list.name)}</p>
                    <p class="text-xs text-slate-400">${(list.items || []).length} פריטים · ${new Date(list.created_at).toLocaleDateString('he-IL')}</p>
                </div>
                <button onclick="loadSavedList(${list.id})" class="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-200 transition">טען</button>
                <button onclick="deleteSavedList(${list.id})" class="bg-red-50 text-red-500 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-100 transition"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        `).join('');
    } catch(e) { showToast('error', 'שגיאה בטעינת הרשימות'); }
}

async function saveCurrentList() {
    const name = (getEl('save-list-name').value || '').trim();
    if (!name) { showToast('error', 'יש לתת שם לרשימה'); return; }
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested' && i.status !== 'in_cart');
    if (activeItems.length === 0) { showToast('error', 'אין פריטים ברשימה לשמירה'); return; }
    const itemsToSave = activeItems.map(i => ({ item_name: i.item_name, quantity: i.quantity, unit: i.unit, estimated_price: i.estimated_price, units_per_package: i.units_per_package }));
    try {
        const res = await fetch(`${API}/shopping/save`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupId: currentGroup.id, name, items: itemsToSave }) });
        const data = await res.json();
        if (data.success) { getEl('save-list-name').value = ''; showToast('success', 'הרשימה נשמרה!'); await loadSavedLists(); } else showToast('error', 'שגיאה בשמירת הרשימה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function loadSavedList(listId) {
    if (!confirm('לטעון את הרשימה השמורה לרשימת הקניות הנוכחית?')) return;
    try {
        const res = await fetch(`${API}/shopping/load-saved`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ listId, userId: currentUser.id }) });
        const data = await res.json();
        if (data.success) { getEl('saved-lists-modal').classList.add('hidden'); showToast('success', `${data.count} פריטים נטענו לרשימה!`); fetchData(); } else showToast('error', data.error || 'שגיאה בטעינת הרשימה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function deleteSavedList(listId) {
    if (!confirm('למחוק רשימה שמורה זו?')) return;
    try {
        await fetch(`${API}/shopping/saved/${listId}`, { method:'DELETE' });
        await loadSavedLists();
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

// ============================================================
// --- DRAFT FROM MISSING ITEMS (Feature 4) ---
// ============================================================

async function createDraftFromMissing() {
    const items = window._pendingMissingItems || [];
    if (items.length === 0) { getEl('missing-draft-modal').classList.add('hidden'); return; }
    try {
        for (const item of items) {
            await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ itemName: item.item_name, quantity: item.quantity, unit: item.unit, estimatedPrice: item.estimated_price, unitsPerPackage: item.units_per_package, userId: currentUser.id, groupId: currentGroup.id }) });
        }
        getEl('missing-draft-modal').classList.add('hidden');
        showToast('success', `${items.length} פריטים חסרים נוספו לרשימה חדשה!`);
        window._pendingMissingItems = [];
        fetchData();
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function openHistoryModal() { const res = await fetch(`${API}/shopping/history?groupId=${currentGroup.id}`); const trips = await res.json(); const list = getEl('history-list'); list.innerHTML = ''; if(trips.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm">אין היסטוריה עדיין</p>'; trips.forEach(t => { let itemsHtml = ''; t.items.forEach(i => itemsHtml += `<div class="text-xs flex justify-between bg-slate-100 p-2 rounded mb-1"><span>${safeStr(i.item_name)} (x${i.quantity} ${safeStr(i.unit || "יח'")})</span><span class="font-bold">₪${i.price_per_unit || 0}/${safeStr(i.unit || "יח'")}</span></div>`); list.innerHTML += `<div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div onclick="document.getElementById('trip-items-${t.id}').classList.toggle('hidden')" class="flex justify-between items-center cursor-pointer"><div><h4 class="font-bold text-slate-800">${safeStr(t.store_name)} ${t.branch_name ? `(${safeStr(t.branch_name)})` : ''}</h4><p class="text-xs text-slate-400">${new Date(t.trip_date).toLocaleDateString()} • אישור: ${safeStr(t.nickname)}</p></div><span class="font-bold text-blue-600 text-lg">₪${t.total_amount} <i class="fa-solid fa-chevron-down text-xs ml-1"></i></span></div><div id="trip-items-${t.id}" class="hidden mt-3 pt-3 border-t border-slate-50">${itemsHtml}<button onclick="copyList(${t.id})" class="w-full mt-2 bg-slate-800 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-700">יבא דרישה שוב</button></div></div>`; }); getEl('history-modal').classList.remove('hidden'); }
function openBankSettings(id, name, allowance, interest) { getEl('bank-user-id').value = id; getEl('bank-user-name').innerText = `תקציב דמי כיס: ${name}`; getEl('bank-allowance').value = allowance; getEl('bank-interest').value = interest; getEl('bank-settings-modal').classList.remove('hidden'); }
async function submitBankSettings() { const uid = val('bank-user-id'); const allowance = val('bank-allowance'); const interest = val('bank-interest'); await fetch(`${API}/admin/update-settings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: uid, allowance, interest }) }); getEl('bank-settings-modal').classList.add('hidden'); showToast('success', 'הגדרות עודכנו'); fetchMembers(); }
function openAdjustBalanceModal(id, name) { getEl('adjustment-user-id').value = id; getEl('adjustment-user-name').innerText = `עבור: ${name}`; getEl('adjustment-amount').value = ''; getEl('adjustment-reason').value = ''; toggleAdjustmentType('add'); getEl('balance-adjustment-modal').classList.remove('hidden'); }
function toggleAdjustmentType(type) { getEl('adjustment-type').value = type; const deductBtn = getEl('btn-adj-deduct'); const addBtn = getEl('btn-adj-add'); if (!deductBtn || !addBtn) return; if (type === 'deduct') { deductBtn.className = 'flex-1 py-1.5 text-sm font-bold bg-white text-red-600 rounded-lg shadow-sm transition'; addBtn.className = 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-green-600 rounded-lg transition'; } else { addBtn.className = 'flex-1 py-1.5 text-sm font-bold bg-white text-green-600 rounded-lg shadow-sm transition'; deductBtn.className = 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-red-600 rounded-lg transition'; } }
async function submitBalanceAdjustment() { const userId = val('adjustment-user-id'); const type = val('adjustment-type'); const rawAmount = parseFloat(val('adjustment-amount')); const reason = val('adjustment-reason') || (type === 'add' ? 'הפרשת דמי כיס' : 'הפחתה'); if (!rawAmount || rawAmount <= 0) return showToast('error', 'נא להזין סכום תקין'); const btn = getEl('btn-submit-adjustment'); if (btn) { btn.disabled = true; btn.innerText = 'מעדכן...'; } try { const res = await fetch(`${API}/admin/adjust-balance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminId: currentUser.id, groupId: currentGroup.id, childId: userId, type, amount: Math.abs(rawAmount), reason }) }); const data = await res.json(); if (data.success) { showToast('success', type === 'add' ? `₪${rawAmount} הועבר לחשבון הילד/ה` : `₪${rawAmount} הופחתו מחשבון הילד/ה`); getEl('balance-adjustment-modal').classList.add('hidden'); fetchData(); fetchMembers(); } else { showToast('error', data.error || 'שגיאה בעדכון'); } } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if (btn) { btn.disabled = false; btn.innerText = 'עדכן יתרה'; } } }
async function triggerPayday() { if(!confirm('האם לחלק דמי כיס וריבית לכל הילדים כעת?')) return; toggleLoader('payday', true); try { const res = await fetch(`${API}/admin/payday`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { showToast('success', `חולקו ${data.totalDistributed} ש"ח לקופות הילדים!`); fetchData(); } else { showToast('error', data.error); } } catch(e) { showToast('error', 'שגיאה בשרת'); } }
function openGoalModal() { if(currentUser.role === 'ADMIN') { getEl('goal-user-select-container').classList.remove('hidden'); } getEl('goal-title').value = ''; getEl('goal-target').value = ''; getEl('goal-modal').classList.remove('hidden'); }
function openDepositModal(id, title) { getEl('deposit-goal-id').value = id; getEl('deposit-goal-title').innerText = title; getEl('goal-deposit-modal').classList.remove('hidden'); }
async function submitGoal() { const title = val('goal-title'); const target = parseFloat(val('goal-target')) || 0; const select = getEl('goal-target-user'); const targetUserId = (currentUser.role === 'ADMIN' && getEl('goal-user-select-container').style.display !== 'none') ? select.value : null; const res = await fetch(`${API}/goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, targetUserId, title, target, groupId: currentGroup.id }) }); const data = await res.json(); if(data.success) { getEl('goal-modal').classList.add('hidden'); fetchData(); showToast('success', 'יעד הוגדר בהצלחה'); } else showToast('error', data.error); }
async function submitDeposit() { const goalId = val('deposit-goal-id'); const amount = parseFloat(val('deposit-amount')) || 0; if(!amount || amount <= 0) return; const res = await fetch(`${API}/goals/deposit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.id, goalId, amount, groupId: currentGroup.id }) }); const data = await res.json(); if (data.success) { getEl('goal-deposit-modal').classList.add('hidden'); fetchData(); showToast('success', 'העברה בוצעה'); } else showToast('error', data.error); }

function openTransactionModal(t) { 
    getEl('trans-type').value=t; getEl('trans-modal-title').innerText=t==='income'?'הכנסה':'הוצאה'; 
    const s=getEl('trans-cat'); s.innerHTML=''; CATEGORIES[t].forEach(c=>s.innerHTML+=`<option value="${c.value}">${c.label}</option>`); 
    getEl('trans-date').value = new Date().toISOString().split('T')[0]; window.toggleTransType('onetime'); getEl('transaction-modal').classList.remove('hidden'); 
}

async function submitTransaction() { 
    const amount = parseFloat(val('trans-amount')) || 0; if(!amount) return showToast('error', 'נא להזין סכום תקין'); 
    const btn = getEl('btn-submit-transaction'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    const isRecurring = val('trans-is-recurring') === 'true'; let transDate = val('trans-date'); if (!transDate) transDate = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`${API}/transaction`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId: currentUser.id, amount, description: val('trans-desc')||'פעולה', category: val('trans-cat'), type: val('trans-type'), date: transDate, isRecurring: isRecurring, endMonth: isRecurring ? val('trans-end-month') : null, groupId: currentGroup.id }) }); 
        const data = await res.json();
        if (data.success) { getEl('transaction-modal').classList.add('hidden'); showToast('success', 'נרשם בהצלחה!'); fetchData(); } else { showToast('error', data.error || 'שגיאה ברישום הפעולה'); }
    } catch(e) { showToast('error', 'שגיאת שרת בשמירת פעולה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'רשום פעולה'; } }
}

function openShopModal() { getEl('shop-modal').classList.remove('hidden'); }
function openLoanModal() { getEl('loan-modal').classList.remove('hidden'); }

async function submitLoan() { 
    const amount = parseFloat(val('loan-amount')) || 0; if(amount <= 0) return showToast('error', 'נא להזין סכום תקין');
    const btn = getEl('btn-submit-loan'); if (btn) { btn.disabled = true; btn.innerText = 'שולח...'; }
    try {
        const res = await fetch(`${API}/loans/request`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:currentUser.id, amount:amount, reason:val('loan-reason'), groupId: currentGroup.id})}); 
        const data = await res.json();
        if (data.success) { getEl('loan-modal').classList.add('hidden'); showToast('success', 'בקשת ההלוואה נשלחה להורה 📨'); fetchData(); fetchLoans(); } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאה בשליחת בקשה'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'שלח'; } }
}

async function fetchLoans() {
    try {
        if(!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/loans?groupId=${currentGroup.id}`); const loans = await res.json();
        const myLoansList = getEl('my-loans-list'); const adminLoansList = getEl('admin-loans-list'); const adminPanel = getEl('admin-loans-panel');
        if (myLoansList) {
            myLoansList.innerHTML = ''; const myLoans = loans.filter(l => String(l.user_id) === String(currentUser.id));
            if(myLoans.length === 0) myLoansList.innerHTML = '<p class="text-sm text-slate-400 py-2">אין בקשות פעילות.</p>';
            myLoans.forEach(l => {
                let statusHtml = '';
                if(l.status === 'pending') statusHtml = '<span class="text-xs text-orange-500 font-bold bg-orange-100 px-2 py-1 rounded">ממתין לאישור</span>';
                else if(l.status === 'approved') statusHtml = '<span class="text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded">אושר</span>';
                else statusHtml = '<span class="text-xs text-red-500 font-bold bg-red-100 px-2 py-1 rounded">נדחה</span>';
                myLoansList.innerHTML += `<div class="bg-white p-3 rounded-xl border border-slate-100 mb-2 flex justify-between items-center shadow-sm"><div><span class="font-bold text-slate-800">₪${l.amount}</span><p class="text-xs text-slate-500">${safeStr(l.reason)}</p></div>${statusHtml}</div>`;
            });
        }
        if (currentUser.role === 'ADMIN' && adminLoansList && adminPanel) {
            const pendingLoans = loans.filter(l => l.status === 'pending'); adminLoansList.innerHTML = '';
            if (pendingLoans.length > 0) {
                adminPanel.classList.remove('hidden');
                pendingLoans.forEach(l => { adminLoansList.innerHTML += `<div class="bg-white p-3 rounded-xl mb-2 shadow-sm border border-orange-100"><div class="flex justify-between items-center mb-2"><span class="font-bold text-slate-800">${safeStr(l.nickname)} מבקש/ת ₪${l.amount}</span><span class="text-[10px] text-slate-400">${new Date(l.created_at).toLocaleDateString('he-IL')}</span></div><p class="text-xs text-slate-600 mb-3">${safeStr(l.reason)}</p><div class="flex gap-2"><button onclick="approveLoan(${l.id}, ${l.user_id}, ${l.amount})" class="flex-1 bg-green-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-600 transition">אשר בקשה</button><button onclick="rejectLoan(${l.id})" class="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition">דחה</button></div></div>`; });
            } else { adminPanel.classList.add('hidden'); }
        }
    } catch(e) {}
}

window.approveLoan = async function(loanId, userId, amount) {
    if(!confirm(`האם לאשר העברה ע"ס ₪${amount}?`)) return;
    try { await fetch(`${API}/loans/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId, userId, amount, adminId: currentUser.id }) }); showToast('success', 'בקשה אושרה'); fetchLoans(); fetchData(); fetchMembers(); } catch(e) { showToast('error', 'שגיאה באיתור בקשה'); }
};

window.rejectLoan = async function(loanId) {
    if(!confirm('האם לדחות את הבקשה?')) return;
    try { await fetch(`${API}/loans/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loanId }) }); showToast('info', 'בקשה נדחתה'); fetchLoans(); } catch(e) { showToast('error', 'שגיאה בדחיית בקשה'); }
};

async function fetchBudget() {
    const cat = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id;
    try {
        const res = await fetch(`${API}/budget/filter?groupId=${currentGroup.id}&targetUserId=${cat}`); 
        let data = await res.json(); if (!Array.isArray(data)) data = []; 
        const list = getEl('budget-list'); list.innerHTML = '';
        const baseCategories = CATEGORIES.expense.map(c => c.value);
        data.forEach(b => { if(!CATEGORIES.expense.find(c => c.value === b.category) && !['allowance','tasks','academy','allocations','savings'].includes(b.category)) { CATEGORIES.expense.push({value: b.category, label: `🏷️ ${b.category}`}); BUDGET_LABELS[b.category] = `🏷️ ${b.category}`; } });
        baseCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); }); const childrenCategories = ['allowance', 'tasks', 'academy']; childrenCategories.forEach(catId => { if (!data.find(d => d.category === catId)) data.push({ category: catId, spent: 0, limit: 0 }); });
        let childrenTotalSpent = 0; let childrenTotalLimit = 0; let childrenItems = []; let otherItems = [];
        data.forEach(b => { if (childrenCategories.includes(b.category) || b.category === 'allocations') { childrenTotalSpent += parseFloat(b.spent) || 0; childrenTotalLimit += parseFloat(b.limit) || 0; childrenItems.push(b); } else { otherItems.push(b); } });

        const createRow = (category, spent, limit, isSub = false) => {
            const pct = limit > 0 ? (spent / limit) * 100 : 0; let color = 'bg-slate-700'; if (pct > 80) color = 'bg-orange-500'; if (pct > 100) color = 'bg-red-500';
            const limitDisplay = limit > 0 ? `₪${limit}` : 'ללא יעד'; const catName = BUDGET_LABELS[category] || category;
            const editBtn = (category !== 'allocations') ? `<button onclick="openBudgetModal('${category}', '${catName}', ${limit}); event.stopPropagation();" class="text-[10px] text-blue-600 font-bold ml-2 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition">עדכון תקציב</button>` : '';
            const textSize = isSub ? 'text-sm' : 'text-base'; const containerClass = isSub ? 'pl-2 border-r-2 border-slate-300 pr-2 mb-3' : 'mb-5';
            return `<div class="${containerClass}"><div class="flex justify-between items-end mb-1"><span class="font-bold text-slate-700 ${textSize}">${catName} ${editBtn}</span><span class="text-xs text-slate-500 font-medium">₪${spent} / ${limitDisplay}</span></div><div class="w-full bg-slate-200 rounded-full ${isSub ? 'h-1.5' : 'h-2.5'} overflow-hidden shadow-inner"><div class="${color} ${isSub ? 'h-1.5' : 'h-2.5'} rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div></div>`;
        };

        if (childrenItems.length > 0) {
            const pct = childrenTotalLimit > 0 ? (childrenTotalSpent / childrenTotalLimit) * 100 : 0; let color = 'bg-slate-600'; if (pct > 80) color = 'bg-slate-500'; if (pct > 100) color = 'bg-red-600';
            const limitDisplay = childrenTotalLimit > 0 ? `₪${childrenTotalLimit}` : 'לא הוגדר'; let subItemsHtml = ''; childrenItems.forEach(cb => { subItemsHtml += createRow(cb.category, cb.spent, cb.limit, true); });
            const childrenSectionTitle = currentUser.role === 'ADMIN' ? 'תקציבי ילדים ודמי כיס' : 'התקציב שלי';
            list.innerHTML += `<div class="mb-8 bg-slate-100 p-4 rounded-[1.5rem] border border-slate-200 shadow-sm transition-all hover:bg-slate-50"><div class="flex justify-between items-end mb-2 cursor-pointer" onclick="document.getElementById('children-budget-details').classList.toggle('hidden')"><span class="font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-users-gear text-slate-500"></i> ${childrenSectionTitle} <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i></span><span class="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">סה"כ: ₪${childrenTotalSpent} / ${limitDisplay}</span></div><div class="w-full bg-slate-300 rounded-full h-2.5 overflow-hidden mb-1 shadow-inner"><div class="${color} h-2.5 rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div></div><div id="children-budget-details" class="hidden mt-5 pt-4 border-t border-slate-200">${subItemsHtml}</div></div>`;
        }
        otherItems.forEach(b => { list.innerHTML += createRow(b.category, b.spent, b.limit, false); });
    } catch(e) {}
}

function openAddBudgetCategoryModal() { getEl('new-budget-cat-name').value = ''; getEl('add-budget-cat-modal').classList.remove('hidden'); }
async function submitNewBudgetCat() { 
    const catName = val('new-budget-cat-name'); if(!catName) return; 
    const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; 
    const btn = getEl('btn-submit-budget-cat'); if(btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try { await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:catName, limit:0, targetUserId: target})}); getEl('add-budget-cat-modal').classList.add('hidden'); fetchBudget(); } catch(e) { showToast('error', 'שגיאה בשמירת סעיף'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'הוסף לתקציב'; } }
}

function openPasteListModal() { getEl('paste-list-text').value = ''; getEl('paste-list-modal').classList.remove('hidden'); }

async function submitPastedList() {
    const text = val('paste-list-text'); if (!text.trim()) return;
    const btn = getEl('btn-submit-paste'); btn.disabled = true; btn.innerText = 'קולט...';
    const lines = text.split('\n').filter(l => l.trim() !== '');
    try {
        for (let line of lines) { await fetch(`${API}/shopping/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemName: line.trim(), quantity: 1, unit: "יח'", estimatedPrice: 0, unitsPerPackage: 1, userId: currentUser.id, groupId: currentGroup.id}) }); }
        getEl('paste-list-modal').classList.add('hidden'); showToast('success', `נקלטו ${lines.length} שורות!`); fetchData();
    } catch(e) { showToast('error', 'שגיאה בקליטה'); } finally { btn.disabled = false; btn.innerText = 'קלוט רשימה'; }
}

function exportShopToWhatsApp() {
    const activeItems = shoppingListCache.filter(i => i.status !== 'requested');
    if (activeItems.length === 0) return showToast('error', 'הרשימה ריקה');
    let text = `*רשימת קניות מ-Oneflow Life:*\n\n`; activeItems.forEach(i => { text += `• ${i.item_name} (${i.quantity} ${i.unit || "יח'"})\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function openBudgetModal(catId, catName, currentLimit) { getEl('budget-cat-name').innerText = catName; getEl('budget-cat-id').value = catId; getEl('budget-limit').value = currentLimit > 0 ? currentLimit : ''; getEl('budget-modal').classList.remove('hidden'); }
async function submitBudgetUpdate() { 
    const cat = val('budget-cat-id'); const limit = parseFloat(val('budget-limit')) || 0; 
    const target = currentUser.role === 'ADMIN' ? (val('budget-filter') || 'all') : currentUser.id; 
    const btn = getEl('btn-submit-budget-update'); if (btn) { btn.disabled = true; btn.innerText = 'שומר...'; }
    try { await fetch(`${API}/budget/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentGroup.id, category:cat, limit:limit, targetUserId: target})}); getEl('budget-modal').classList.add('hidden'); fetchBudget(); } catch(e) { showToast('error', 'שגיאת בעדכון'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'עדכן יעד'; } }
}

// -------------------------------------
// פונקציות לתשקיף חכם (Forecast)
// -------------------------------------

window.toggleForecastMode = function(mode) {
    currentForecastMode = mode;
    getEl('btn-forecast-monthly').className = mode === 'monthly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    getEl('btn-forecast-yearly').className = mode === 'yearly' ? 'flex-1 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-lg shadow-sm transition' : 'flex-1 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg transition';
    getEl('forecast-month-filter').classList.toggle('hidden', mode !== 'monthly'); getEl('forecast-year-filter').classList.toggle('hidden', mode !== 'yearly');
    renderForecast();
};

function populateForecastPeriods() {
    const mSelect = getEl('forecast-month-filter'); const ySelect = getEl('forecast-year-filter');
    if (mSelect && mSelect.options.length === 0) { const now = new Date(); for(let i=0; i<12; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); const monthStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const label = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); mSelect.innerHTML += `<option value="${monthStr}">${label}</option>`; } }
    if (ySelect && ySelect.options.length === 0) { const curYear = new Date().getFullYear(); for(let i=0; i<5; i++) { ySelect.innerHTML += `<option value="${curYear + i}">שנת ${curYear + i}</option>`; } }
}

async function renderForecast() {
    populateForecastPeriods();
    const list = getEl('forecast-list'); if(!list) return; if(!currentGroup || !currentGroup.id) return;
    const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
    const periodVal = currentForecastMode === 'monthly' ? val('forecast-month-filter') : val('forecast-year-filter');
    
    let startDate, endDate;
    if (currentForecastMode === 'monthly') {
        if (!periodVal) { const now = new Date(); startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); } 
        else { const [year, month] = periodVal.split('-'); startDate = new Date(year, parseInt(month) - 1, 1); endDate = new Date(year, parseInt(month), 0, 23, 59, 59); }
    } else {
        const year = periodVal ? parseInt(periodVal) : new Date().getFullYear(); startDate = new Date(year, 0, 1); endDate = new Date(year, 11, 31, 23, 59, 59);
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
                    for (let m = 0; m < 12; m++) { let checkStart = new Date(startDate.getFullYear(), m, 1); let checkEnd = new Date(startDate.getFullYear(), m + 1, 0, 23, 59, 59); let isActive = checkStart >= txStartMonth; if (endD && checkEnd > endD) isActive = false; if (isActive) monthsActive++; }
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
    
    if(itemsToRender.length === 0) { html = '<p class="text-center text-slate-400 py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">אין פעולות עתידיות או קבועות צפויות בתקופה זו</p>'; } 
    else {
        itemsToRender.forEach(item => {
            const isIncome = item.type === 'income'; const amt = parseFloat(item.amount); const itemDate = new Date(item.date); const isRecurring = item.is_recurring === true || String(item.is_recurring).toLowerCase() === 'true';
            if(isIncome) { totalIncome += amt; incomeData[item.category] = (incomeData[item.category] || 0) + amt; } else { totalExpense += amt; expenseData[item.category] = (expenseData[item.category] || 0) + amt; }
            if (isRecurring || itemDate > now) { if (isIncome) projectedNetChange += amt; else projectedNetChange -= amt; }
            const icon = isIncome ? '<i class="fa-solid fa-arrow-trend-up text-green-500 bg-green-100 p-1.5 rounded-full text-[10px]"></i>' : '<i class="fa-solid fa-arrow-trend-down text-red-500 bg-red-100 p-1.5 rounded-full text-[10px]"></i>';
            const amountClass = isIncome ? 'text-green-600' : 'text-red-600'; const prefix = isIncome ? '+' : '-';
            const recBadge = isRecurring ? '<span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 rounded-full font-bold ml-2 shadow-sm whitespace-nowrap">קבועה <i class="fa-solid fa-rotate text-[8px]"></i></span>' : '';
            const userName = currentUser.role === 'ADMIN' && item.user_name ? `<span class="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500 ml-1 font-normal">${safeStr(item.user_name)}</span>` : '';
            html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center justify-between text-right hover:border-slate-200 transition"><div class="flex-1 overflow-hidden"><p class="font-bold text-slate-800 leading-tight flex items-center mt-0.5">${icon} <span class="mr-2 truncate">${safeStr(item.description)}</span> ${userName} ${recBadge}</p><p class="text-[10px] text-slate-400 mt-1">${item.date_str}</p></div><span class="font-bold text-base ${amountClass} whitespace-nowrap shrink-0" dir="ltr">${prefix}₪${item.amount}</span></div>`;
        });
    }
    list.innerHTML = html;
    const projectedBalance = parseFloat(forecastCache.startingBalance) + projectedNetChange;
    getEl('forecast-net-change').innerText = `₪${projectedNetChange.toFixed(2)}`;
    getEl('forecast-net-change').className = `text-lg font-bold ${projectedNetChange >= 0 ? 'text-green-600' : 'text-red-600'}`;
    getEl('forecast-projected-balance').innerText = `₪${projectedBalance.toFixed(2)}`;
    
    drawForecastCharts({ income: totalIncome }, { expense: totalExpense }, totalIncome, totalExpense);
}

function drawForecastCharts(incomeData, expenseData, totalIncome, totalExpense) {
    const container = getEl('forecast-charts'); if(!container) return;
    container.className = "mt-6 border-t border-slate-100 pt-6 flex flex-col md:flex-row items-center justify-center gap-6";
    
    let sumsHtml = `
        <div class="flex flex-col gap-3 w-full md:w-auto text-center md:text-right">
            <div class="bg-green-50 border border-green-100 p-3 rounded-xl">
                <span class="text-[10px] text-green-600 font-bold block mb-1">סה"כ הכנסות צפויות:</span>
                <span class="text-lg font-black text-green-700">₪${totalIncome.toFixed(2)}</span>
            </div>
            <div class="bg-red-50 border border-red-100 p-3 rounded-xl">
                <span class="text-[10px] text-red-600 font-bold block mb-1">סה"כ הוצאות צפויות:</span>
                <span class="text-lg font-black text-red-700">₪${totalExpense.toFixed(2)}</span>
            </div>
        </div>
    `;

    container.innerHTML = `
        ${sumsHtml}
        <div class="w-full max-w-[200px]">
            <h4 class="text-sm font-bold text-center text-slate-600 mb-2">יחס (הכנסות/הוצאות)</h4>
            <div class="relative h-40 w-full flex justify-center"><canvas id="ratioChart"></canvas></div>
        </div>
    `;
    const ctx = getEl('ratioChart'); if(!ctx) return;
    if(forecastRatioChart) forecastRatioChart.destroy();
    if(totalIncome > 0 || totalExpense > 0) {
        forecastRatioChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['הכנסות', 'הוצאות'], datasets: [{ data: [totalIncome, totalExpense], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 2, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    } else { container.innerHTML = '<p class="text-center text-slate-400 text-xs py-4 w-full">אין פעולות עתידיות להצגת נתונים</p>'; }
}

function getForecastInsight() {
    executeWithAIWarning(async () => {
        showAIModal('רואת העתידות', null); getEl('familai-loading-text').innerText = 'מחשבת את התזרים הצפוי...';
        try {
            const periodVal = currentForecastMode === 'monthly' ? val('forecast-month-filter') : val('forecast-year-filter');
            const targetUserId = currentUser.role === 'ADMIN' ? 'all' : currentUser.id;
            const res = await fetch(`${API}/forecast/familai-insight`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, period: periodVal, mode: currentForecastMode, targetUserId: targetUserId }) }); 
            const data = await res.json();
            if(!handleAIResponseCheck(data)) { getEl('familai-advisor-modal').classList.add('hidden'); return; }
            if(data.success && data.insight) { showAIModal('רואת העתידות', data.insight); } else { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בניתוח'); }
        } catch(e) { getEl('familai-advisor-modal').classList.add('hidden'); showToast('error', 'שגיאה בתקשורת'); }
    });
}

function initAccessibility() { const saved = localStorage.getItem('ofl_accessibility'); if(saved) { try { accState = JSON.parse(saved); applyAccessibility(); } catch(e) {} } }
function applyAccessibility() { Object.keys(accState).forEach(key => { const btn = getEl(`acc-${key}`); if(accState[key]) { document.body.classList.add(`acc-${key}`); if(btn) { btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } else { document.body.classList.remove(`acc-${key}`); if(btn) { btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700'); } } }); localStorage.setItem('ofl_accessibility', JSON.stringify(accState)); }
function toggleAccess(key) { accState[key] = !accState[key]; applyAccessibility(); }
function resetAccessibility() { Object.keys(accState).forEach(k => accState[k] = false); applyAccessibility(); showToast('success', 'הגדרות הנגישות אופסו'); closeAccessibilityModal(); }
function openAccessibilityModal() { getEl('accessibility-modal').classList.remove('hidden'); }
function closeAccessibilityModal() { getEl('accessibility-modal').classList.add('hidden'); }

async function fetchMembers() {
    try {
        if (!currentGroup || !currentGroup.id) return;
        const res = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`);
        membersCache = await res.json();
        if (!Array.isArray(membersCache)) membersCache = [];

        // עדכון רשימות בחירה להורה/מנהל
        if (currentUser.role === 'ADMIN') {
            try {
                const bF = getEl('budget-filter');
                const fF = getEl('feed-user-filter');
                const gS = getEl('goal-target-user');
                const cfF = getEl('cashflow-user-filter');
                if (bF) { const cur = bF.value; bF.innerHTML = '<option value="all">כל המשפחה</option>'; membersCache.forEach(m => bF.innerHTML += `<option value="${m.id}">${safeStr(fmtUserName(m) || m.nickname)}</option>`); if (cur) bF.value = cur; }
                if (fF) { const cur = fF.value; fF.innerHTML = '<option value="all">כל בני המשפחה</option>'; membersCache.forEach(m => fF.innerHTML += `<option value="${m.id}">${safeStr(fmtUserName(m) || m.nickname)}</option>`); if (cur) fF.value = cur; }
                if (cfF) { const cur = cfF.value; cfF.innerHTML = '<option value="all">כל בני המשפחה</option>'; membersCache.forEach(m => cfF.innerHTML += `<option value="${m.id}">${safeStr(fmtUserName(m) || m.nickname)}</option>`); if (cur) cfF.value = cur; }
                if (gS) { const cur = gS.value; gS.innerHTML = '<option value="">עבור מי ביעד?</option>'; membersCache.filter(m => m.role !== 'ADMIN').forEach(m => { gS.innerHTML += `<option value="${m.id}">עבור ${safeStr(m.nickname)}</option>`; }); if (cur) gS.value = cur; }
            } catch (err) {}
        }

        // לוח "מחוברים עכשיו" — גלוי להורה בלבד
        if (currentUser.role === 'ADMIN') {
            try {
                const now = Date.now();
                const onlineThreshold = 3 * 60 * 1000; // 3 דקות
                const onlineMembers = membersCache.filter(m => m.last_seen && (now - new Date(m.last_seen).getTime()) < onlineThreshold);
                let ob = getEl('members-online-banner');
                if (!ob) {
                    const c = getEl('members-list');
                    if (c && c.parentNode) {
                        ob = document.createElement('div');
                        ob.id = 'members-online-banner';
                        c.parentNode.insertBefore(ob, c);
                    }
                }
                if (ob) {
                    if (onlineMembers.length === 0) {
                        ob.innerHTML = '';
                    } else {
                        const avatars = onlineMembers.map(m => {
                            const ini = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?';
                            const isMe = m.id === currentUser.id;
                            return `<div class="flex flex-col items-center gap-1"><div class="relative w-10 h-10"><div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isMe ? 'bg-emerald-500 text-white' : 'bg-white text-slate-700 border-2 border-emerald-200'} shadow">${ini}</div><span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></span></div><span class="text-[10px] text-slate-500 font-medium max-w-[40px] truncate">${isMe ? 'אני' : safeStr(m.nickname)}</span></div>`;
                        }).join('');
                        ob.innerHTML = `<div class="mx-0 mb-3 px-4 py-3 bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl"><div class="flex items-center justify-between mb-2"><div class="flex items-center gap-2"><span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block"></span><span class="text-xs font-black text-emerald-700">מחוברים עכשיו</span><span class="text-[10px] bg-emerald-100 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full">${onlineMembers.length}</span></div><span class="text-[10px] text-slate-400">מעודכן כל 30 שניות</span></div><div class="flex gap-3 flex-wrap">${avatars}</div></div>`;
                    }
                }
            } catch(e) {}
        }

        // רשימת בני המשפחה — גלויה לכולם
        try {
            const c = getEl('members-list');
            if (c) {
                const now = Date.now();
                const onlineThreshold = 3 * 60 * 1000;
                c.innerHTML = '';
                membersCache.forEach(m => {
                    const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?';
                    const roleLabel = m.role === 'ADMIN' ? 'הורה' : m.role === 'CHILD' ? 'ילד' : 'חבר';
                    const permsStr = safeStr(JSON.stringify(m.permissions || {}));
                    const isOnline = m.last_seen && (now - new Date(m.last_seen).getTime()) < onlineThreshold;
                    const onlineDot = isOnline ? `<span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></span>` : '';
                    const avatarWrap = `<div class="relative w-9 h-9"><div class="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">${initial}</div>${onlineDot}</div>`;
                    const adminEditBtn = (currentUser.role === 'ADMIN') ? `<button onclick="openEditMemberModal(${m.id})" class="mr-2 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm" title="עריכת פרטים"><i class="fa-solid fa-pen text-sm"></i></button>` : '';
                    const adminPermsBtn = currentUser.role === 'ADMIN' ? `<button onclick="openPermissionsModal(${m.id}, '${safeStr(m.nickname)}', '${permsStr}')" class="mr-2 text-purple-600 hover:text-purple-800 bg-purple-50 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm" title="הרשאות"><i class="fa-solid fa-user-shield text-sm"></i></button>` : '';
                    const adminRoleBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="changeUserRole(${m.id}, '${m.role}', '${safeStr(m.nickname)}')" class="mr-2 text-amber-500 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm" title="${m.role === 'ADMIN' ? 'הורד לילד' : 'קדם להורה'}"><i class="fa-solid fa-arrow-right-arrow-left text-sm"></i></button>` : '';
                    const adminDeleteBtn = (currentUser.role === 'ADMIN' && m.id !== currentUser.id) ? `<button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="mr-2 text-red-400 hover:text-red-600 bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm" title="הסר מהמשפחה"><i class="fa-solid fa-trash text-sm"></i></button>` : '';
                    c.innerHTML += `<div class="p-3 flex justify-between items-center border-b border-slate-50 last:border-0 hover:bg-slate-50 transition"><div class="flex items-center gap-3">${avatarWrap}<span class="font-bold text-sm text-slate-700">${safeStr(m.nickname) || 'משתמש'} <span class="text-[10px] font-normal text-slate-400">(${roleLabel})</span></span></div><div class="flex items-center"><span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-lg ml-2">${m.balance !== null ? `₪${m.balance}` : '🔒'}</span>${adminEditBtn}${adminRoleBtn}${adminPermsBtn}${adminDeleteBtn}</div></div>`;
                });
            }
        } catch (err) {}

        // FLW KID פאנל הורה
        try { if (currentUser.role === 'ADMIN') loadFlwKidParentPanel(); } catch(e) {}

        // חשבונות בנק של הילדים — גלוי להורה בלבד
        try {
            const a = getEl('bank-accounts-list');
            if (a && currentUser.role === 'ADMIN') {
                a.innerHTML = '';
                const children = membersCache.filter(m => m.role !== 'ADMIN');
                if (children.length === 0) {
                    a.innerHTML = '<p class="text-center text-slate-400 text-sm py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">אין ילדים רשומים כרגע במשפחה.</p>';
                } else {
                    children.forEach(m => {
                        const initial = m.nickname ? m.nickname.charAt(0).toUpperCase() : '?';
                        const permsStr = safeStr(JSON.stringify(m.permissions || {}));
                        a.innerHTML += `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-lg">${initial}</div><div><h4 class="font-bold text-slate-800 text-sm">${safeStr(m.nickname) || 'ילד'}</h4><p class="text-[10px] text-slate-400">דמי כיס: ₪${m.allowance_amount || 0} • ריבית: ${m.interest_rate || 0}%</p><p class="text-xs font-bold text-slate-700 mt-1">יתרה: <span class="text-slate-800">₪${m.balance || 0}</span></p></div></div><div class="flex gap-1 sm:gap-2"><button onclick="openAdjustBalanceModal(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center transition" title="הפרש דמי כיס"><i class="fa-solid fa-coins text-sm"></i></button><button onclick="openPermissionsModal(${m.id}, '${safeStr(m.nickname)}', '${permsStr}')" class="w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center transition" title="הרשאות"><i class="fa-solid fa-user-shield text-sm"></i></button><button onclick="openBankSettings(${m.id}, '${safeStr(m.nickname)}', ${m.allowance_amount || 0}, ${m.interest_rate || 0})" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-gear text-sm"></i></button><button onclick="deleteUser(${m.id}, '${safeStr(m.nickname)}')" class="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"><i class="fa-solid fa-trash text-sm"></i></button></div></div>`;
                    });
                }
            }
        } catch (err) {}

    } catch (e) {}
}

async function fetchPendingUsers() {
    try {
        if(!currentGroup || !currentGroup.id) return; 
        const res = await fetch(`${API}/admin/pending-users?groupId=${currentGroup.id}`); const users = await res.json(); const list = getEl('pending-list'); const container = getEl('admin-panel'); 
        if (users && users.length > 0) { 
            container.classList.remove('hidden'); list.innerHTML = ''; 
            users.forEach(u => { const roleBadge = u.role === 'ADMIN' ? '<span class="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">הורה</span>' : u.role === 'CHILD' ? '<span class="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-bold">ילד/ה</span>' : '<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">חבר</span>'; list.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded-xl mb-1 shadow-sm"><div class="flex items-center gap-2"><span class="text-sm font-bold text-slate-700">${safeStr(u.nickname)}</span>${roleBadge}</div><div class="flex gap-2"><button onclick="approveUser(${u.id})" class="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-slate-700 transition">אשר</button></div></div>`; }); 
        } else { if(container) container.classList.add('hidden'); } 
    } catch(e) {} 
}

async function approveUser(id) { await fetch(`${API}/admin/approve-user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id }) }); showToast('success', 'אושר כבן משפחה!'); fetchPendingUsers(); fetchMembers(); }

function setEditMemberRole(role) {
    const adminBtn = getEl('edit-member-role-admin');
    const childBtn = getEl('edit-member-role-child');
    const inp = getEl('edit-member-role');
    if (!adminBtn || !childBtn || !inp) return;
    const isAdmin = role === 'ADMIN';
    inp.value = isAdmin ? 'ADMIN' : 'CHILD';
    adminBtn.className = `flex-1 py-3 rounded-2xl font-bold text-sm border-2 transition flex flex-col items-center gap-1 ${isAdmin ? 'border-indigo-500 bg-indigo-500 text-white shadow' : 'border-slate-200 bg-white text-slate-500'}`;
    childBtn.className = `flex-1 py-3 rounded-2xl font-bold text-sm border-2 transition flex flex-col items-center gap-1 ${!isAdmin ? 'border-violet-500 bg-violet-500 text-white shadow' : 'border-slate-200 bg-white text-slate-500'}`;
}

async function openEditMemberModal(userId) {
    const modal = getEl('edit-member-modal');
    if (!modal) return;
    getEl('edit-member-id').value = userId;
    getEl('edit-member-nickname').value = '';
    getEl('edit-member-email').value = '';
    getEl('edit-member-phone').value = '';
    getEl('edit-member-password-display').value = '';
    getEl('edit-member-new-password').value = '';
    getEl('edit-member-name-label').textContent = 'טוען...';
    modal.classList.remove('hidden');
    try {
        const res = await fetch(`${API}/admin/user-details/${userId}?adminId=${currentUser.id}`);
        const data = await res.json();
        if (!data.success) { showToast('error', data.error || 'שגיאה'); modal.classList.add('hidden'); return; }
        const u = data.user;
        getEl('edit-member-name-label').textContent = u.nickname || '';
        getEl('edit-member-nickname').value = u.nickname || '';
        getEl('edit-member-email').value = u.email || '';
        getEl('edit-member-phone').value = u.phone || '';
        getEl('edit-member-password-display').value = u.password_hash || '';
        getEl('edit-member-password-display').type = 'password';
        setEditMemberRole(u.role === 'ADMIN' ? 'ADMIN' : 'CHILD');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); modal.classList.add('hidden'); }
}

async function saveEditMember() {
    const userId = getEl('edit-member-id').value;
    const nickname = getEl('edit-member-nickname').value.trim();
    const email = getEl('edit-member-email').value.trim();
    const phone = getEl('edit-member-phone').value.trim();
    const newPassword = getEl('edit-member-new-password').value.trim();
    const role = getEl('edit-member-role').value;
    if (!nickname) return showToast('error', 'שם משתמש הוא שדה חובה');
    if (newPassword && newPassword.length < 4) return showToast('error', 'סיסמה חייבת להכיל לפחות 4 תווים');
    const btn = getEl('btn-save-member');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> שומר...';
    try {
        const body = { adminId: currentUser.id, nickname, email, phone, role };
        if (newPassword) body.password = newPassword;
        const res = await fetch(`${API}/admin/user-details/${userId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'הפרטים עודכנו בהצלחה');
            getEl('edit-member-modal').classList.add('hidden');
            fetchMembers();
        } else showToast('error', data.error || 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> שמור'; }
}

async function changeUserRole(userId, currentRole, nickname) {
    const isCurrentlyAdmin = currentRole === 'ADMIN';
    const newRole = isCurrentlyAdmin ? 'CHILD' : 'ADMIN';
    const newLabel = isCurrentlyAdmin ? 'ילד/ה' : 'הורה';
    const curLabel = currentRole === 'ADMIN' ? 'הורה' : currentRole === 'CHILD' ? 'ילד/ה' : 'חבר';
    if (!confirm(`לשנות את תפקיד "${nickname}" מ${curLabel} ל${newLabel}?\nההרשאות יעודכנו אוטומטית.`)) return;
    try {
        const res = await fetch(`${API}/admin/change-role`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: currentUser.id, userId, newRole }) });
        const data = await res.json();
        if (data.success) { showToast('success', `תפקיד עודכן ל${newLabel} וההרשאות עודכנו`); fetchMembers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}
async function openProfileModal() {
    getEl('old-password').value = '';
    getEl('new-password').value = '';
    getEl('profile-modal').classList.remove('hidden');
    loadFamilyAddress();
    // Load phone
    try {
        const r = await fetch(`${API}/users/${currentUser.id}/phone`);
        const d = await r.json();
        if (d.success && getEl('user-phone-input')) getEl('user-phone-input').value = d.phone || '';
    } catch(e) {}
    // Load email
    try {
        const r = await fetch(`${API}/users/${currentUser.id}/email`);
        const d = await r.json();
        if (d.success && getEl('user-email-input')) getEl('user-email-input').value = d.email || '';
    } catch(e) {}
    // Load family nickname
    if (getEl('profile-family-nickname')) getEl('profile-family-nickname').value = currentGroup?.family_nickname || '';
}

async function saveUserPhone() {
    const phone = (getEl('user-phone-input')?.value || '').trim();
    try {
        const res = await fetch(`${API}/users/${currentUser.id}/phone`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data.success) showToast('success', 'מספר הטלפון נשמר!');
        else showToast('error', 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function saveUserEmail() {
    const email = (getEl('user-email-input')?.value || '').trim();
    try {
        const res = await fetch(`${API}/users/${currentUser.id}/email`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'כתובת המייל נשמרה!'); if (currentUser) currentUser.email = email; }
        else showToast('error', 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function saveFamilyAddress() {
    const city = (getEl('family-city-input')?.value || '').trim();
    const streetAddress = (getEl('family-address-input')?.value || '').trim();
    if (!city && !streetAddress) { showToast('error', 'יש למלא לפחות עיר או כתובת'); return; }
    try {
        const res = await fetch(`/api/groups/${currentGroup.id}/address`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ city, streetAddress })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'הכתובת נשמרה!');
            if (currentGroup) { currentGroup.city = city; currentGroup.street_address = streetAddress; }
            // Persist to localStorage so address survives page refresh
            try {
                const session = JSON.parse(localStorage.getItem('ofl_session') || '{}');
                if (session.group) { session.group.city = city; session.group.street_address = streetAddress; saveSession(session.user, session.group); }
            } catch(e) {}
        } else showToast('error', 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function loadFamilyAddress() {
    if (!currentGroup) return;
    if (getEl('family-city-input')) getEl('family-city-input').value = currentGroup.city || '';
    if (getEl('family-address-input')) getEl('family-address-input').value = currentGroup.street_address || '';
}

async function saveFamilyNickname() {
    const nickname = (getEl('profile-family-nickname')?.value || '').trim();
    try {
        const res = await fetch(`/api/groups/${currentGroup.id}/nickname`, {
            method: 'PATCH', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ familyNickname: nickname })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'כינוי המשפחה נשמר!');
            if (currentGroup) currentGroup.family_nickname = nickname;
        } else showToast('error', 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function submitChangePassword(e) { e.preventDefault(); const oldP = val('old-password'); const newP = val('new-password'); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = 'מעדכן...'; try { const res = await fetch(`${API}/users/${currentUser.id}/password`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) }); const data = await res.json(); if(data.success) { showToast('success', 'הסיסמה שונתה בהצלחה!'); getEl('profile-modal').classList.add('hidden'); } else { showToast('error', data.error || 'שגיאה בשינוי סיסמה'); } } catch(err) { showToast('error', 'שגיאה בתקשורת'); } finally { btn.disabled = false; btn.innerText = 'עדכון סיסמת גישה'; } }
async function deleteUser(id, name) { if(!confirm(`האם אתה בטוח שברצונך למחוק את המשתמש לצמיתות?`)) return; try { const res = await fetch(`${API}/users/${id}?adminId=${currentUser.id}`, { method: 'DELETE' }); const data = await res.json(); if(data.success) { showToast('success', 'המשתמש הוסר בהצלחה'); fetchMembers(); fetchData(); } else { showToast('error', data.error || 'שגיאה במחיקה'); } } catch(e) { showToast('error', 'שגיאה בתקשורת'); } }


// אפשרות הורדת PDF מדוח 360 הוסרה לטובת תצוגת UI נקייה ומהירה יותר

// === פונקציות המזווה - תמיכה ביחידות ===
function openPantryUseModal(name, unit, qty, upp) { 
    const totalSubUnits = Math.round(parseFloat(qty) * parseInt(upp || 1));
    getEl('use-pantry-title').innerText = `מה לקחת מ: ${name}?`; 
    getEl('use-pantry-name').value = name; 
    
    let dynContainer = getEl('pantry-dyn-container');
    if (!dynContainer) {
        const origInput = getEl('use-pantry-qty');
        if(origInput && origInput.parentElement && origInput.parentElement.parentElement) {
            dynContainer = document.createElement('div');
            dynContainer.id = 'pantry-dyn-container';
            origInput.parentElement.parentElement.insertBefore(dynContainer, origInput.parentElement);
            origInput.parentElement.style.display = 'none';
        }
    }
    
    if (dynContainer) {
        dynContainer.innerHTML = `
            <div class="text-center mb-4 bg-orange-50 text-orange-700 py-2.5 rounded-xl border border-orange-100 shadow-sm flex flex-col gap-1">
                <span class="font-bold text-sm">יתרה: ${parseFloat(qty).toFixed(2)} ${unit}</span>
                <span class="text-xs font-medium opacity-80">(סה"כ ${totalSubUnits} יחידות)</span>
            </div>
            
            <div class="space-y-3">
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1.5 ml-1">כמה יחידות לקחת?</label>
                    <input type="number" id="use-pantry-units-dyn" placeholder="יחידות בודדות" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none font-black text-slate-800 text-center shadow-sm focus:border-orange-500 transition">
                </div>
                
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-400 mb-1.5 ml-1">או: שימוש לפי מארז / משקל שלם</label>
                    <input type="number" step="0.1" id="use-pantry-qty-dyn" placeholder="כמה ${unit} לקחת?" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-slate-500 text-center text-sm focus:border-slate-400 transition">
                </div>
            </div>
        `;
    }
    
    const display = getEl('use-pantry-unit-display');
    if(display) display.innerText = unit || "יח'"; 
    getEl('pantry-use-modal').classList.remove('hidden'); 
}

async function submitPantryUse() {
    const name = val('use-pantry-name'); 
    const dynQty = val('use-pantry-qty-dyn');
    const origQty = val('use-pantry-qty');
    const qty = dynQty !== '' && dynQty !== undefined ? dynQty : origQty;
    
    const dynUnits = val('use-pantry-units-dyn');
    const origUnits = val('use-pantry-units');
    const units = dynUnits !== '' && dynUnits !== undefined ? dynUnits : origUnits;

    if((!qty || parseFloat(qty) <= 0) && (!units || parseFloat(units) <= 0)) return showToast('error', 'נא להזין כמות תקינה');
    
    try {
        const res = await fetch(`${API}/pantry/use`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: parseFloat(qty) || 0, usedUnits: parseFloat(units) || 0 }) }); const data = await res.json();
        if(data.success) { showToast('success', 'המלאי נגרע בהצלחה'); getEl('pantry-use-modal').classList.add('hidden'); fetchData(); } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאה בעדכון המלאי'); }
}
// ==========================================
// --- פונקציות שחזור קוד סביבה למייל ---
// ==========================================

function openForgotCodeModal() {
    getEl('forgot-code-email').value = '';
    getEl('forgot-code-modal').classList.remove('hidden');
}

async function submitForgotCode() {
    const email = val('forgot-code-email');
    if (!email) return showToast('error', 'נא להזין כתובת אימייל תקינה');
    
    const btn = getEl('btn-submit-forgot');
    btn.disabled = true;
    btn.innerText = 'שולח...';
    
    try {
        const res = await fetch(`${API}/forgot-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        
        const data = await res.json();
        
        if (data.success) {
            // לא מחזירים שגיאה אם המייל לא קיים כדי למנוע דליית מידע
            showToast('success', 'בקשתך התקבלה! אם המייל קיים במערכת, הקוד נשלח אליו עכשיו.');
            getEl('forgot-code-modal').classList.add('hidden');
        } else {
            showToast('error', data.error || 'אירעה שגיאה בשליחת המייל');
        }
    } catch (e) {
        showToast('error', 'שגיאת תקשורת מול השרת');
    } finally {
        btn.disabled = false;
        btn.innerText = 'שלח קוד';
    }
}
// ============================================================
// --- מודול הקהילה והעסקים המקומיים (רב קהילתי + יזמות מתוקן) ---
// ============================================================

let myConnectedCommunitiesCache = [];
let myCommunityBusinessesCache = [];
let myInitiativesCache = [];
let myCashbackCache = []; // [{community_id, community_name, balance, total_earned, is_community_manager}]

function switchFamCommunityTab(tab) {
    localStorage.setItem('ofl_comm_tab', tab);
    ['home', 'manage', 'benefits', 'promos', 'news', 'feed'].forEach(t => {
        const view = document.getElementById(`fam-comm-view-${t}`);
        if (view) view.classList.add('hidden');
    });
    const activeView = document.getElementById(`fam-comm-view-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (tab === 'home') loadCommHomeBanners();
    if (tab === 'manage') switchFamCommSubTab('join');
    if (tab === 'promos') loadCommunityFeed();
    if (tab === 'benefits') renderFamCommunityBenefits();
    if (tab === 'feed') { loadFeedSection(); }
    if (tab === 'news') {
        const communityId = myConnectedCommunitiesCache?.[0]?.id;
        if (communityId) loadCommunityArticles(communityId);
    }
}

async function loadCommunityArticles(communityId) {
    const container = document.getElementById('comm-articles-list');
    if (!container) return;
    container.innerHTML = '<p class="text-sm text-slate-400 text-center py-4">טוען מאמרים...</p>';
    try {
        const res = await fetch(`${API}/community/articles/${communityId}`);
        const data = await res.json();
        const articles = data.articles || [];
        if (!articles.length) {
            container.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">אין מאמרים עדיין</p>';
            return;
        }
        container.innerHTML = articles.map(a => {
            const date = new Date(a.published_at).toLocaleDateString('he-IL');
            const isLong = (a.body || '').length > 200;
            const shortBody = isLong ? a.body.slice(0, 200) + '...' : a.body;
            const id = `article-body-${a.id}`;
            return `<div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                ${a.image_url ? `<img src="${safeStr(a.image_url)}" class="w-full h-36 object-cover">` : ''}
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-bold text-slate-800 text-sm">${safeStr(a.title)}</h4>
                        <span class="text-[10px] text-slate-400 shrink-0 ml-2">${date}</span>
                    </div>
                    <p id="${id}" class="text-xs text-slate-600 leading-relaxed">${safeStr(shortBody)}</p>
                    ${isLong ? `<button onclick="
                        const el=document.getElementById('${id}');
                        const btn=this;
                        if(btn.dataset.expanded){el.textContent='${safeStr(shortBody)}';delete btn.dataset.expanded;btn.textContent='קרא עוד'}
                        else{el.textContent='${safeStr(a.body)}';btn.dataset.expanded=1;btn.textContent='הצג פחות'}"
                        class="text-xs text-indigo-600 font-bold mt-1 hover:underline">קרא עוד</button>` : ''}
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        container.innerHTML = '<p class="text-sm text-red-400 text-center py-4">שגיאה בטעינת מאמרים</p>';
    }
}

function switchFamCommSubTab(sub) {
    ['join', 'interests', 'pool', 'pool-archive'].forEach(t => {
        const view = document.getElementById(`fam-comm-view-${t}`);
        const btn = document.getElementById(`btn-fam-sub-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.className = 'whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
    });
    const activeView = document.getElementById(`fam-comm-view-${sub}`);
    const activeBtn = document.getElementById(`btn-fam-sub-${sub}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.className = 'whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-500 text-white transition';
    if (sub === 'pool') renderFamPools();
    if (sub === 'pool-archive') loadFamPoolArchive();
}

async function loadCommHomeBanners() {
    const el = document.getElementById('comm-home-banners-feed');
    if (!el) return;
    try {
        const res = await fetch(`${API}/community/approved-banners`);
        const data = await res.json();
        const banners = data.banners || [];
        if (!banners.length) {
            el.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">אין באנרים פעילים כרגע</p>';
            return;
        }
        el.innerHTML = banners.map(b => `
            <div class="bg-gradient-to-r from-orange-400 to-pink-500 rounded-2xl p-4 text-white shadow-md cursor-pointer" onclick="switchFamCommunityTab('promos')">
                <div class="flex items-center gap-3">
                    ${b.business_logo ? `<img src="${b.business_logo}" class="w-12 h-12 rounded-xl object-cover bg-white/20 shrink-0">` : `<div class="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><i class="fa-solid fa-store text-xl"></i></div>`}
                    <div class="flex-1 min-w-0">
                        <p class="font-black text-sm leading-tight">${safeStr(b.banner_headline || b.promo_title || '')}</p>
                        <p class="text-orange-100 text-xs mt-0.5">${safeStr(b.business_name || '')} · ${safeStr(b.community_name || '')}</p>
                        ${b.discount_pct ? `<span class="inline-block bg-white/25 text-white text-[10px] font-black px-2 py-0.5 rounded-full mt-1">-${b.discount_pct}%</span>` : ''}
                    </div>
                    <i class="fa-solid fa-chevron-left text-white/60 text-xs shrink-0"></i>
                </div>
            </div>`).join('');
    } catch(e) {
        el.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">שגיאה בטעינת באנרים</p>';
    }
}

function renderFamCommunityBenefits() {
    const bizList = document.getElementById('community-businesses-list');
    if (!bizList) return;
    if (!myCommunityBusinessesCache.length) {
        bizList.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">אין עסקים מקומיים להצגה עדיין</p>';
        return;
    }
    const bizMap = {};
    myCommunityBusinessesCache.forEach(biz => {
        const key = biz.group_code || String(biz.business_id);
        if (!bizMap[key]) bizMap[key] = { ...biz, communities: [] };
        bizMap[key].communities.push({ id: biz.community_id, name: biz.comm_name, discount_pct: biz.discount_pct, family_count: biz.family_count, min_families: biz.min_families });
    });
    bizList.innerHTML = Object.values(bizMap).map(biz => {
        const comms = biz.communities;
        const multiComm = comms.length > 1;
        const commBadges = comms.map(c => {
            const active = parseInt(c.family_count) >= (parseInt(c.min_families) || 30);
            return `<span class="text-[9px] font-bold ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'} border px-1.5 py-0.5 rounded-md">${c.discount_pct}% הנחה ב-${safeStr(c.name)}</span>`;
        }).join('');
        const actionBtn = multiComm
            ? `<button onclick="openBizCommunityPicker('${safeStr(biz.group_code)}','${safeStr(biz.business_name).replace(/'/g,"\\'")}',${JSON.stringify(comms).replace(/"/g,'&quot;')})" class="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-sm shrink-0">לחנות ▾</button>`
            : `<a href="${window.location.origin}/storefront.html?store=${safeStr(biz.group_code)}&communityId=${comms[0]?.id}" target="_blank" class="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-sm shrink-0">לחנות</a>`;
        const logoHtml = biz.biz_logo
            ? `<img src="${safeStr(biz.biz_logo)}" class="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-100 shadow-sm" onerror="this.style.display='none'">`
            : `<div class="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0"><i class="fa-solid fa-store text-xl"></i></div>`;
        return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 hover:border-emerald-100 transition-colors">
            ${logoHtml}
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-slate-800 text-sm truncate">${safeStr(biz.business_name)}</h4>
                <div class="flex flex-wrap gap-1 mt-1">${commBadges}</div>
            </div>
            ${actionBtn}
        </div>`;
    }).join('');
}

// ─── FlowPool — FAMILY ───────────────────────────────────────────────
let _activeFamPoolCommunityId = null;

async function renderFamPools() {
    const el = document.getElementById('fam-pool-list');
    if (!el) return;
    if (!currentGroup || currentGroup.type !== 'FAMILY') {
        el.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">התחבר כמשפחה כדי לראות פולים</p>';
        return;
    }
    const communities = myConnectedCommunitiesCache || [];
    if (!communities.length) {
        el.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">אינך מחובר לקהילה עדיין</p>';
        return;
    }
    const commId = _activeFamPoolCommunityId || communities[0].id;
    _activeFamPoolCommunityId = commId;

    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">טוען...</p>';
    try {
        const res = await fetch(`${API}/community/pool/community/${commId}`, {});
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        const pools = data.pools || [];

        let commSelector = '';
        if (communities.length > 1) {
            const opts = communities.map(c => `<option value="${c.id}" ${c.id == commId ? 'selected' : ''}>${safeStr(c.name)}</option>`).join('');
            commSelector = `<select onchange="_activeFamPoolCommunityId=this.value;renderFamPools()" class="modern-input py-1 text-xs mb-3 w-full">${opts}</select>`;
        }

        if (!pools.length) {
            el.innerHTML = commSelector + '<div class="text-center py-8"><i class="fa-solid fa-water text-4xl text-slate-200 mb-3"></i><p class="text-sm font-bold text-slate-500">אין פולים פעילים</p><p class="text-xs text-slate-400">פתחו פול חדש ותפנו לעסקים</p></div>';
            return;
        }

        const cards = pools.map(p => {
            const statusLabel = { open_r1: 'סיבוב 1 פתוח', open_r2: 'סיבוב 2 פתוח', closed: 'סגור', expired: 'פג תוקף' }[p.status] || p.status;
            const statusColor = { open_r1: 'bg-blue-100 text-blue-700', open_r2: 'bg-purple-100 text-purple-700', closed: 'bg-green-100 text-green-700', expired: 'bg-slate-100 text-slate-500' }[p.status] || 'bg-slate-100 text-slate-500';
            const isMine = p.initiator_type === 'family' && p.initiator_id == currentGroup.id;
            const maxP = p.max_price > 0 ? `עד ₪${Number(p.max_price).toLocaleString()}` : 'מחיר פתוח';
            return `<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer hover:shadow-md transition" onclick="openFamPoolDetail(${p.id})">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-slate-800 text-sm truncate">${safeStr(p.title)}</h4>
                        ${p.service_category ? `<span class="text-[10px] text-slate-400">${safeStr(p.service_category)}</span>` : ''}
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor} mr-2 shrink-0">${statusLabel}</span>
                </div>
                <div class="flex gap-4 text-xs text-slate-500 mt-2">
                    <span><i class="fa-solid fa-users text-blue-400 ml-1"></i>${p.member_count || 0} משפחות</span>
                    <span><i class="fa-solid fa-shekel-sign text-green-500 ml-1"></i>${maxP}</span>
                    ${isMine ? '<span class="text-amber-600 font-bold">✦ יזמת</span>' : ''}
                </div>
            </div>`;
        }).join('');

        el.innerHTML = commSelector + cards;
    } catch (e) {
        el.innerHTML = `<p class="text-xs text-red-400 text-center py-8">${e.message}</p>`;
    }
}

function openCreatePoolModal() {
    if (!myConnectedCommunitiesCache.length) {
        showToast('הצטרפו לקהילה תחילה', 'error');
        return;
    }
    document.getElementById('modal-create-pool').classList.remove('hidden');
}
function closeCreatePoolModal() {
    document.getElementById('modal-create-pool').classList.add('hidden');
}

async function createFamPool() {
    const title = document.getElementById('pool-title-input').value.trim();
    const desc = document.getElementById('pool-desc-input').value.trim();
    if (!title || !desc) { showToast('error', 'כותרת ותיאור הם שדות חובה'); return; }
    const community_id = _activeFamPoolCommunityId || (myConnectedCommunitiesCache[0] && myConnectedCommunitiesCache[0].id);
    if (!community_id) { showToast('error', 'אינך מחובר לקהילה'); return; }

    const payload = {
        communityId: community_id,
        initiatorType: 'family',
        initiatorId: currentGroup.id,
        title,
        description: desc,
        serviceCategory: document.getElementById('pool-category-input').value.trim() || null,
        maxPrice: parseFloat(document.getElementById('pool-maxprice-input').value) || 0,
        minFamilies: parseInt(document.getElementById('pool-minfam-input').value) || 2
    };

    try {
        const res = await fetch(`${API}/community/pool`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', '🌊 פול נפתח בהצלחה!');
        closeCreatePoolModal();
        renderFamPools();
    } catch (e) {
        console.error('createFamPool error:', e);
        showToast('error', e.message || 'שגיאה ביצירת פול');
    }
}

async function openFamPoolDetail(poolId) {
    const modal = document.getElementById('modal-pool-detail');
    const body = document.getElementById('pool-detail-body');
    const titleEl = document.getElementById('pool-detail-title');
    modal.classList.remove('hidden');
    body.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">טוען...</p>';
    try {
        const res = await fetch(`${API}/community/pool/${poolId}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        const p = data.pool;
        const members = data.members || [];
        const messages = data.messages || [];
        titleEl.textContent = p.title;

        const isFamInitiator = p.initiator_type === 'family' && p.initiator_id == currentGroup.id;
        const isMember = members.some(m => m.group_id == currentGroup.id);
        const isOpen = p.status === 'open_r1' || p.status === 'open_r2';

        const statusLabel = { open_r1: '🔵 סיבוב 1 פתוח', open_r2: '🟣 סיבוב 2 פתוח', closed: '✅ סגור', expired: '⏰ פג תוקף' }[p.status] || p.status;

        // טעינת הצעות למנהל/יוזמת בלבד
        let bids = [];
        if (isFamInitiator) {
            try {
                const bRes = await fetch(`${API}/community/pool/${poolId}/bids?viewerId=${currentGroup.id}&viewerType=family`);
                const bData = await bRes.json();
                if (bData.success) bids = bData.bids || [];
            } catch (_) {}
        }

        // רשימת חברות הפול (ליוזמת בלבד)
        let membersHtml = '';
        if (isFamInitiator && members.length) {
            membersHtml = `<div class="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <h4 class="text-xs font-bold text-blue-800 mb-2">👥 משפחות בפול (${members.length})</h4>
                <div class="space-y-1">
                    ${members.map(m => `<div class="flex justify-between items-center bg-white rounded-lg px-2.5 py-1.5 text-xs border border-blue-50">
                        <button onclick="removePoolMember(${p.id},${m.group_id})" class="text-[10px] text-red-400 hover:text-red-600 transition font-bold">הסר</button>
                        <span class="font-medium text-slate-700">${safeStr(m.name)}${m.group_id == currentGroup.id ? ' <span class="text-[9px] text-blue-500">(את/ה)</span>' : ''}</span>
                    </div>`).join('')}
                </div>
            </div>`;
        }

        let bidsHtml = '';
        if (isFamInitiator && bids.length) {
            bidsHtml = `<div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <h4 class="text-xs font-bold text-amber-800 mb-2">📋 הצעות עסקים (${bids.length})</h4>
                <div class="space-y-2">
                    ${bids.map(b => {
                        const storeLink = b.biz_code ? `<a href="/storefront.html?store=${safeStr(b.biz_code)}&communityId=${p.community_id}" target="_blank" class="text-blue-600 underline text-[10px]">🛒 חנות</a>` : '';
                        const phoneLink = b.biz_phone ? `<a href="tel:${safeStr(b.biz_phone)}" class="text-green-600 text-[10px]">📞 ${safeStr(b.biz_phone)}</a>` : '';
                        return `<div class="bg-white rounded-lg p-2 border border-amber-100 text-xs">
                        <div class="flex justify-between items-start mb-1">
                            <div>
                                <span class="font-bold text-slate-800 text-[12px]">🏪 ${safeStr(b.business_name || b.biz_name || '')}</span>
                                ${b.is_guest ? '<span class="text-purple-600 text-[10px] mr-1">👤 אורח</span>' : ''}
                                <div class="flex gap-2 mt-0.5">${storeLink}${phoneLink}</div>
                            </div>
                            <div class="text-left">
                                <span class="font-black text-blue-700 text-[13px]">₪${Number(b.price).toLocaleString()}</span><br>
                                ${b.status === 'pending' && p.status !== 'closed' ? `<button onclick="selectPoolBid(${p.id},${b.id})" class="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold hover:bg-green-600 transition mt-0.5">בחר ✓</button>` : `<span class="text-[10px] font-bold ${b.status==='accepted'?'text-green-600':'text-slate-400'}">${b.status==='accepted'?'✅ נבחר':''}</span>`}
                            </div>
                        </div>
                        ${b.description ? `<p class="text-slate-600 text-[11px] border-t border-slate-50 pt-1 mt-1 whitespace-pre-wrap">${safeStr(b.description)}</p>` : ''}
                    </div>`;}).join('')}
                </div>
                ${p.status === 'open_r1' ? `<button onclick="openFamPoolRound2(${p.id})" class="mt-2 w-full py-1.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition">פתח סיבוב 2 לעסקים חיצוניים</button>` : ''}
            </div>`;
        }

        const msgsHtml = messages.length ? messages.map(m => {
            const align = m.sender_type === 'family' ? 'flex-row-reverse' : 'flex-row';
            const bg = m.sender_type === 'system' ? 'bg-slate-100 text-slate-500 text-center mx-auto rounded-full px-3 py-1 text-[11px]' : m.sender_type === 'family' ? 'bg-blue-100 text-blue-800 rounded-br-none' : 'bg-slate-100 text-slate-700 rounded-bl-none';
            if (m.sender_type === 'system') return `<div class="${bg}">${safeStr(m.content)}</div>`;
            return `<div class="flex ${align}"><div class="max-w-[80%] px-3 py-2 rounded-2xl text-xs ${bg}">${safeStr(m.content)}</div></div>`;
        }).join('') : '<p class="text-xs text-slate-300 text-center py-4">אין הודעות עדיין</p>';

        body.innerHTML = `
            <div class="flex gap-2 items-center text-xs text-slate-500">
                <span>${statusLabel}</span>
                <span>·</span>
                <span><i class="fa-solid fa-users ml-1"></i>${members.length} משפחות</span>
                ${p.max_price > 0 ? `<span>· עד ₪${Number(p.max_price).toLocaleString()}</span>` : ''}
            </div>
            ${p.description ? `<p class="text-sm text-slate-600">${safeStr(p.description)}</p>` : ''}
            ${membersHtml}
            ${bidsHtml}
            ${isOpen && !isMember && !isFamInitiator ? `<button onclick="joinFamPool(${p.id})" class="w-full py-3 rounded-xl bg-blue-500 text-white font-bold text-sm hover:bg-blue-600 transition shadow-md">🌊 הצטרף לפול</button>` : ''}
            ${isFamInitiator ? `<div class="text-xs text-blue-600 font-bold text-center py-2 bg-blue-50 rounded-xl flex items-center justify-between px-3"><span><i class="fa-solid fa-crown ml-1"></i>אתם יוזמי הפול — הצטרפתם אוטומטית</span><button onclick="openEditFamPool(${p.id},'${safeStr(p.title)}','${safeStr(p.description||'')}',${p.max_price||0})" class="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition">✏️ עריכה</button></div>` : (isMember ? '<div class="text-xs text-green-600 font-bold text-center py-2 bg-green-50 rounded-xl"><i class="fa-solid fa-check ml-1"></i>אתם חברים בפול הזה</div>' : '')}
            ${p.status === 'expired' && isFamInitiator ? `
            <div class="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                <p class="text-xs font-bold text-orange-700 text-center">⏰ הפול פג תוקף — בחר פעולה:</p>
                <div class="flex gap-2">
                    <button onclick="renewFamPool(${p.id})" class="flex-1 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition">🔄 חדש תוקף (7 ימים)</button>
                    <button onclick="archiveFamPool(${p.id})" class="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition">📦 העבר לארכיב</button>
                </div>
                <button onclick="closeFamPool(${p.id})" class="w-full py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold hover:bg-green-100 transition">✅ סגור כבוע מול עסק</button>
            </div>` : ''}
            <div class="border-t border-slate-100 pt-3">
                <h4 class="text-xs font-bold text-slate-600 mb-2">💬 הודעות</h4>
                <div class="space-y-2 max-h-48 overflow-y-auto mb-3">${msgsHtml}</div>
                ${isOpen ? `<div class="flex gap-2">
                    <input id="pool-msg-input-${p.id}" type="text" class="modern-input py-2 text-xs flex-1" placeholder="שלח הודעה לפול..." onkeydown="if(event.key==='Enter')sendPoolMessage(${p.id})">
                    <button onclick="sendPoolMessage(${p.id})" class="bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 transition"><i class="fa-solid fa-paper-plane"></i></button>
                </div>` : ''}
            </div>`;
    } catch (e) {
        body.innerHTML = `<p class="text-xs text-red-400 text-center py-8">${e.message}</p>`;
    }
}
async function renewFamPool(poolId) {
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/renew`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ viewerId: currentGroup.id, days: 7 }) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', '🔄 תוקף הפול חודש ל-7 ימים!');
        openFamPoolDetail(poolId);
        renderFamPools();
    } catch(e) { showToast('error', e.message); }
}
async function archiveFamPool(poolId) {
    if (!confirm('להעביר את הפול לארכיב?')) return;
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/archive`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ viewerId: currentGroup.id }) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', '📦 הפול הועבר לארכיב');
        document.getElementById('modal-pool-detail').classList.add('hidden');
        renderFamPools();
    } catch(e) { showToast('error', e.message); }
}
async function closeFamPool(poolId) {
    if (!confirm('לסגור את הפול כבוע מול עסק?')) return;
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/select-bid`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ viewerId: currentGroup.id, bidId: null, closeOnly: true }) });
        // If no bid, just update status directly
        const res2 = await fetch(`${API}/community/pool/${poolId}/archive`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ viewerId: currentGroup.id }) });
        showToast('success', '✅ הפול נסגר');
        document.getElementById('modal-pool-detail').classList.add('hidden');
        renderFamPools();
    } catch(e) { showToast('error', e.message); }
}
function closePoolDetailModal() {
    document.getElementById('modal-pool-detail').classList.add('hidden');
}

async function restoreFamPool(poolId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'מחזיר...'; }
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/restore`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ viewerId: currentGroup.id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', '↩️ הפול הוחזר לפולים הפעילים!');
        loadFamPoolArchive();
        renderFamPools();
    } catch(e) {
        if (btn) { btn.disabled = false; btn.textContent = '↩️ החזר לפולים הפעילים'; }
        showToast('error', e.message);
    }
}

async function loadFamPoolArchive() {
    const el = document.getElementById('fam-pool-archive-list');
    if (!el || !currentGroup) return;
    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">טוען...</p>';
    try {
        const res = await fetch(`${API}/community/pool/family-archive/${currentGroup.id}`);
        const data = await res.json();
        const pools = data.pools || [];
        if (!pools.length) {
            el.innerHTML = '<div class="text-center py-12"><i class="fa-solid fa-box-archive text-4xl text-slate-200 mb-3"></i><p class="text-sm font-bold text-slate-400">הארכיב ריק</p><p class="text-xs text-slate-300 mt-1">פולים שיסגרו או יועברו לארכיב יופיעו כאן</p></div>';
            return;
        }
        const statusLabel = { archived: 'מוארכב', closed: 'נסגר — בוצע', expired: 'פג תוקף' };
        const statusColor = { archived: 'bg-slate-100 text-slate-600', closed: 'bg-green-100 text-green-700', expired: 'bg-orange-100 text-orange-700' };
        el.innerHTML = pools.map(p => {
            const st = p.status;
            const restoreBtn = st === 'archived'
                ? `<button onclick="restoreFamPool(${p.id},this)" class="mt-3 w-full py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition">↩️ החזר לפולים הפעילים</button>`
                : '';
            return `<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-slate-800 text-sm">${safeStr(p.title)}</h4>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[st] || 'bg-slate-100 text-slate-600'} mr-1 shrink-0">${statusLabel[st] || st}</span>
                </div>
                ${p.description ? `<p class="text-xs text-slate-500 mb-2 line-clamp-2">${safeStr(p.description)}</p>` : ''}
                <div class="flex gap-3 text-[11px] text-slate-400">
                    <span><i class="fa-solid fa-users ml-1"></i>${p.members_count || 0} משפחות</span>
                    ${p.bids_count > 0 ? `<span><i class="fa-solid fa-gavel ml-1"></i>${p.bids_count} הצעות</span>` : ''}
                    ${p.max_price > 0 ? `<span>עד ₪${Number(p.max_price).toLocaleString()}</span>` : ''}
                </div>
                ${restoreBtn}
            </div>`;
        }).join('');
    } catch(e) {
        el.innerHTML = `<p class="text-xs text-red-400 text-center py-8">${e.message}</p>`;
    }
}

function openEditFamPool(poolId, title, description, maxPrice) {
    const existing = document.getElementById('modal-edit-fam-pool');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-edit-fam-pool';
    modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div class="flex justify-between items-center">
                <h3 class="font-black text-slate-800 text-base">✏️ עריכת פול</h3>
                <button onclick="document.getElementById('modal-edit-fam-pool').remove()" class="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div class="space-y-2">
                <label class="text-xs font-bold text-slate-500">כותרת הפול</label>
                <input id="edit-pool-title" type="text" value="${title}" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
            </div>
            <div class="space-y-2">
                <label class="text-xs font-bold text-slate-500">תיאור הצורך</label>
                <textarea id="edit-pool-description" rows="3" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none">${description}</textarea>
            </div>
            <div class="space-y-2">
                <label class="text-xs font-bold text-slate-500">תקציב מקסימלי (₪)</label>
                <input id="edit-pool-maxprice" type="number" value="${maxPrice || ''}" placeholder="אופציונלי" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
            </div>
            <button onclick="saveEditFamPool(${poolId})" class="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition text-sm">💾 שמור שינויים</button>
        </div>`;
    document.body.appendChild(modal);
}

async function saveEditFamPool(poolId) {
    const title = document.getElementById('edit-pool-title')?.value.trim();
    const description = document.getElementById('edit-pool-description')?.value.trim();
    const maxPrice = parseFloat(document.getElementById('edit-pool-maxprice')?.value) || 0;
    if (!title) { showToast('error', 'חובה להזין כותרת'); return; }
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/edit`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ viewerId: currentGroup.id, title, description, maxPrice })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', '✅ הפול עודכן!');
        document.getElementById('modal-edit-fam-pool')?.remove();
        openFamPoolDetail(poolId);
        renderFamPools();
    } catch(e) { showToast('error', e.message); }
}

async function joinFamPool(poolId) {
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: currentGroup.id }) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', 'הצטרפת לפול! 🎉');
        openFamPoolDetail(poolId);
        renderFamPools();
    } catch (e) { console.error('joinFamPool error:', e); showToast('error', e.message || 'שגיאה'); }
}

async function selectPoolBid(poolId, bidId) {
    if (!confirm('לבחור את ההצעה הזו?')) return;
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/select-bid`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: bidId, bidId, viewerId: currentGroup.id }) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', '✅ הצעה נבחרה!');
        openFamPoolDetail(poolId);
        renderFamPools();
    } catch (e) { console.error('selectPoolBid error:', e); showToast('error', e.message || 'שגיאה'); }
}

async function openFamPoolRound2(poolId) {
    if (!confirm('לפתוח סיבוב 2 לעסקים חיצוניים?')) return;
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/open-round2`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viewerId: currentGroup.id }) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', '🟣 סיבוב 2 נפתח!');
        openFamPoolDetail(poolId);
    } catch (e) { console.error('openFamPoolRound2 error:', e); showToast('error', e.message || 'שגיאה'); }
}

async function sendPoolMessage(poolId) {
    const input = document.getElementById(`pool-msg-input-${poolId}`);
    const content = input ? input.value.trim() : '';
    if (!content) return;
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, sender_type: 'family', sender_id: currentGroup.id }) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        input.value = '';
        openFamPoolDetail(poolId);
    } catch (e) { console.error('sendPoolMessage error:', e); showToast('error', e.message || 'שגיאה'); }
}

async function removePoolMember(poolId, groupId) {
    if (!confirm('להסיר משפחה זו מהפול?')) return;
    try {
        const res = await fetch(`${API}/community/pool/${poolId}/remove-member`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, initiatorId: currentGroup.id })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'שגיאה');
        showToast('success', 'המשפחה הוסרה מהפול');
        openFamPoolDetail(poolId);
        renderFamPools();
    } catch(e) { console.error('removePoolMember:', e); showToast('error', e.message || 'שגיאה'); }
}

async function fetchCommunityData() {
    if(!currentGroup || currentGroup.type !== 'FAMILY') return;
    try {
        const res = await fetch(`${API}/community/info/${currentGroup.id}`);
        const data = await res.json();
        
        if (data.success) {
            myConnectedCommunitiesCache = data.communities || [];
            myCommunityBusinessesCache = data.businesses || [];
            renderFamilyCommunities();
            // polling אוטומטי כשיש קהילות בהמתנה — מאפשר רענון ללא פעולת משתמש
            const hasPending = myConnectedCommunitiesCache.some(c => c.status === 'pending');
            if (hasPending && !window._pendingCommRefresh) {
                window._pendingCommRefresh = setInterval(async () => {
                    await fetchCommunityData();
                    const stillPending = myConnectedCommunitiesCache.some(c => c.status === 'pending');
                    if (!stillPending) { clearInterval(window._pendingCommRefresh); window._pendingCommRefresh = null; }
                }, 15000);
            } else if (!hasPending && window._pendingCommRefresh) {
                clearInterval(window._pendingCommRefresh); window._pendingCommRefresh = null;
            }
        }

        await fetchMyInitiatives();
        await fetchCashbackInfo();
    } catch(e) { console.error('Error fetching community data', e); }
}

async function fetchCashbackInfo() {
    if(!currentGroup || currentGroup.type !== 'FAMILY') return;
    try {
        const res = await fetch(`${API}/community/cashback-info/${currentGroup.id}`);
        const data = await res.json();
        if(data.success) {
            myCashbackCache = data.communities || [];
            renderFamilyCommunities(); // re-render now that cashback data is ready
        }
    } catch(e) {}
}

async function fetchMyInitiatives() {
    try {
        const res = await fetch(`${API}/community/my-initiatives/${currentGroup.id}`);
        const data = await res.json();
        if(data.success) {
            myInitiativesCache = data.initiatives || [];
            renderMyInitiatives();
        }
    } catch(e) { console.error('Error fetching initiatives', e); }
}

function openCreateCommunityModal() {
    if (!document.getElementById('create-community-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="create-community-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[90] flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-slate-800"><i class="fa-solid fa-seedling text-green-500"></i> יזמות קהילתית</h3>
                    <button onclick="document.getElementById('create-community-modal').classList.add('hidden')" class="w-8 h-8 bg-slate-100 rounded-full text-slate-500 flex items-center justify-center hover:bg-slate-200 transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <p class="text-sm text-slate-500 mb-6">פתחו קהילה חדשה באזור שלכם, הזמינו 30 משפחות, והקהילה תופעל באופן רשמי לקבלת הנחות מעסקים!</p>
                <div class="space-y-3 mb-6">
                    <div>
                        <label class="text-xs font-bold text-slate-500 block mb-1">שם הקהילה:</label>
                        <input type="text" id="init-comm-name" class="modern-input py-2.5 text-sm" placeholder="למשל: קהילת שכונת הפארק">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 block mb-1">אזורים (ניתן להפריד בפסיק לכמה ערים/שכונות):</label>
                        <input type="text" id="init-comm-city" class="modern-input py-2.5 text-sm" placeholder="למשל: רעננה, הרצליה, כפר סבא">
                    </div>
                </div>
                <button id="btn-submit-init-comm" onclick="submitNewInitiative()" class="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition">צור קהילה</button>
            </div>
        </div>
        `);
    }
    getEl('init-comm-name').value = '';
    getEl('init-comm-city').value = '';
    getEl('create-community-modal').classList.remove('hidden');
}

async function submitNewInitiative() {
    const name = val('init-comm-name');
    const city = val('init-comm-city');
    if(!name || !city) return showToast('error', 'יש למלא שם וערים לקהילה');
    
    const btn = getEl('btn-submit-init-comm');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> פותח קהילה...';
    try {
        const res = await fetch(`${API}/community/user-create`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, city, groupId: currentGroup.id })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'הקהילה נפתחה כטיוטה! הזמינו חברים כדי להפעיל אותה.');
            getEl('create-community-modal').classList.add('hidden');
            fetchMyInitiatives();
        } else { showToast('error', data.error || 'שגיאה ביצירת קהילה'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
    finally { btn.disabled = false; btn.innerText = 'צור קהילה'; }
}

function renderMyInitiatives() {
    const container = document.getElementById('my-initiatives-container');
    if (!container) return;

    if (myInitiativesCache.length === 0) {
        container.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 text-center mt-2 shadow-sm fade-in">
            <div class="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center text-xl mx-auto mb-3 shadow-inner"><i class="fa-solid fa-seedling"></i></div>
            <h3 class="font-bold text-slate-800 mb-2">אין קהילה קיימת באזורכם?</h3>
            <p class="text-xs text-slate-500 mb-4 leading-relaxed">קחו יוזמה ופתחו קהילה מקומית דרכנו! צרפו 30 משפחות והקהילה שלכם תופעל לעסקים מקומיים.</p>
            <button onclick="openCreateCommunityModal()" class="w-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-5 py-3 rounded-xl text-sm font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus mr-1"></i> פתיחת קהילה חדשה</button>
        </div>`;
        return;
    }

    let html = `<h3 class="font-bold text-slate-800 text-sm mt-6 mb-3 border-t border-slate-200 pt-4"><i class="fa-solid fa-seedling text-green-500"></i> הקהילות שיזמתי:</h3>`;
    
    myInitiativesCache.forEach(c => {
        const famCount = parseInt(c.family_count) || 0;
        const target = 30;
        const pct = Math.min(100, (famCount / target) * 100);
        const isReady = famCount >= target || c.status === 'active';
        const color = isReady ? 'green' : 'indigo';
        const statusText = isReady ? 'פעילה' : 'בגיוס חברים';
        
        const referralLink = `${window.location.origin}/?inviteCommunityCode=${c.code}`;
        const waText = encodeURIComponent(`היי! פתחתי קהילה מקומית ב-Oneflow: "${c.name}". אם נגיע ל-30 משפחות נקבל הנחות והטבות מעסקים באזור! להצטרפות בחינם: ${referralLink}`);

        html += `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-3 fade-in">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold text-slate-800">${safeStr(c.name)} <span class="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 rounded max-w-[150px] inline-block truncate align-bottom">${safeStr(c.city)}</span></h4>
                    <p class="text-[10px] text-${color}-600 font-bold bg-${color}-50 px-2 py-0.5 rounded-lg border border-${color}-100 inline-block mt-1">סטטוס: ${statusText}</p>
                </div>
                <button onclick="window.open('https://wa.me/?text=${waText}', '_blank')" class="bg-[#25D366] text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#1ebd58] transition shadow-sm" title="שלח הזמנה לחברים בוואטסאפ"><i class="fa-brands fa-whatsapp"></i></button>
            </div>
            
            <div class="mt-3">
                <div class="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>${famCount} הצטרפו</span>
                    <span>יעד: ${target}</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner border border-slate-200">
                    <div class="bg-${color}-500 h-2 rounded-full transition-all duration-1000" style="width: ${pct}%"></div>
                </div>
                ${!isReady ? `<p class="text-[9px] text-slate-400 mt-1.5 text-center">חסרות ${target - famCount} משפחות להפעלת הקהילה</p>` : ''}
            </div>
        </div>
        `;
    });
    
    html += `<button onclick="openCreateCommunityModal()" class="w-full mt-2 bg-slate-50 text-slate-600 py-3 rounded-xl text-xs font-bold hover:bg-slate-100 transition border border-dashed border-slate-300"><i class="fa-solid fa-plus"></i> הקם קהילה נוספת</button>`;
    
    container.innerHTML = html;
}

function renderFamilyCommunities() {
    const tabContent = getEl('content-community');
    if (!tabContent) return;

    const approvedComms = myConnectedCommunitiesCache.filter(c => (c.status || 'approved') === 'approved');
    const pendingComms  = myConnectedCommunitiesCache.filter(c => c.status === 'pending');
    const isConnected   = approvedComms.length > 0;
    const hasPending    = pendingComms.length > 0;
    const hasAny        = myConnectedCommunitiesCache.length > 0;

    // ── Join sub-view ──────────────────────────────────────────
    const joinView = getEl('fam-comm-view-join');
    if (joinView) {
        const joinSection    = getEl('community-join-section');
        const connectedInfo  = getEl('community-connected-info');
        const nameDisplay    = getEl('community-name-display');

        if (hasAny) {
            if (joinSection) joinSection.classList.add('hidden');
            if (connectedInfo) {
                connectedInfo.classList.remove('hidden');
                if (nameDisplay) {
                    if (approvedComms.length === 0 && hasPending) {
                        nameDisplay.textContent = 'ממתינות לאישור';
                    } else if (approvedComms.length === 1) {
                        nameDisplay.textContent = safeStr(approvedComms[0].name);
                    } else if (approvedComms.length > 1) {
                        nameDisplay.innerHTML = `${safeStr(approvedComms[0].name)} <span class="text-orange-400 cursor-pointer underline" onclick="switchFamCommunityTab('manage');switchFamCommSubTab('join')">+${approvedComms.length - 1} נוספות</span>`;
                    }
                }
            }

            let commListHtml = `<div class="mb-4">`;

            // קהילות מאושרות
            if (approvedComms.length > 0) {
                commListHtml += `<h3 class="font-bold text-slate-800 mb-3 text-sm"><i class="fa-solid fa-house-flag text-indigo-500"></i> הקהילות שלי (${approvedComms.length}/5)</h3>
                <div class="space-y-2">`;
                approvedComms.forEach((c, idx) => {
                    const cbInfo = myCashbackCache.find(x => String(x.community_id) === String(c.id)) || {};
                    const walletBal = parseFloat(cbInfo.balance || 0).toFixed(2);
                    const isManager = cbInfo.is_community_manager;
                    const walletBadge = `<span class="text-[9px] font-bold ${parseFloat(walletBal) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'} border px-1.5 py-0.5 rounded-md"><i class="fa-solid fa-wallet mr-0.5"></i> ₪${walletBal}</span>`;
                    const managerBadge = isManager ? `<span class="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md"><i class="fa-solid fa-star mr-0.5"></i> מנהל קהילה</span>` : '';
                    const isFirst = idx === 0;
                    commListHtml += `
                    <div id="comm-card-${c.id}" class="comm-select-card cursor-pointer border-2 p-3 rounded-2xl shadow-sm fade-in transition ${isFirst ? 'border-indigo-400 bg-indigo-100' : 'border-indigo-100 bg-indigo-50 hover:border-indigo-300'}"
                         onclick="selectCommunityForReferral(${c.id},'${safeStr(c.name).replace(/'/g,"\\'")}','${safeStr(c.code || '')}')">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                ${isFirst ? `<span class="comm-selected-badge text-[9px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded-md">✓ נבחרה</span>` : ''}
                                ${isManager ? `<button onclick="event.stopPropagation();openCommunityManagerPanel(${c.id})" class="text-[10px] font-bold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition border border-transparent hover:border-purple-200"><i class="fa-solid fa-gear mr-1"></i>ניהול</button>` : ''}
                                <button onclick="event.stopPropagation();openInviteBizModal(${c.id},'${safeStr(c.name).replace(/'/g,"\\'")}')" class="text-[10px] font-bold text-teal-600 hover:bg-teal-50 px-2 py-1 rounded transition border border-transparent hover:border-teal-200"><i class="fa-solid fa-store mr-1"></i>הזמן עסק</button>
                                <button onclick="event.stopPropagation();leaveCommunity(${c.id}, '${safeStr(c.name)}')" class="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition border border-transparent hover:border-red-200">התנתק</button>
                            </div>
                            <div class="text-right">
                                <h4 class="font-bold text-indigo-900 text-sm">${safeStr(c.name)}</h4>
                                <p class="text-[10px] text-indigo-700">אזורים: ${safeStr(c.city || 'כללי')}</p>
                                <div class="flex gap-1 mt-1 justify-end">${walletBadge}${managerBadge}</div>
                            </div>
                        </div>
                    </div>`;
                });
                commListHtml += `</div>`;
            }

            // קהילות ממתינות לאישור
            if (hasPending) {
                commListHtml += `<h3 class="font-bold text-slate-800 mb-2 mt-4 text-sm"><i class="fa-solid fa-clock text-amber-500"></i> ממתינות לאישור</h3>
                <div class="space-y-2">`;
                pendingComms.forEach(c => {
                    commListHtml += `
                    <div class="bg-amber-50 border border-amber-200 p-3 rounded-2xl shadow-sm fade-in">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg border border-amber-200"><i class="fa-solid fa-hourglass-half mr-1"></i>ממתין לאישור מנהל</span>
                            <div class="text-right">
                                <h4 class="font-bold text-amber-900 text-sm">${safeStr(c.name)}</h4>
                                <p class="text-[10px] text-amber-700">אזורים: ${safeStr(c.city || 'כללי')}</p>
                            </div>
                        </div>
                    </div>`;
                });
                commListHtml += `</div>`;
            }

            // כפתור הצטרפות נוספת (רק אם מאושרות < 5)
            if (approvedComms.length < 5) {
                commListHtml += `<button onclick="document.getElementById('dyn-extra-join-section').classList.toggle('hidden')" class="w-full mt-3 bg-white border border-dashed border-slate-300 text-slate-500 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition fade-in"><i class="fa-solid fa-plus"></i> הצטרפות לקהילה נוספת</button>
                <div id="dyn-extra-join-section" class="hidden mt-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center fade-in">
                    <div class="flex gap-2 mb-2">
                        <input type="text" id="community-code-input-dyn" class="modern-input py-2 text-sm text-center font-mono uppercase tracking-widest flex-1" placeholder="קוד קהילה">
                        <button onclick="joinCommunityDyn()" class="bg-slate-900 text-white px-5 rounded-xl font-bold shadow-md hover:bg-black transition text-sm">התחבר</button>
                    </div>
                    <button onclick="openCommunityDiscoveryModal()" class="text-xs text-teal-600 hover:text-teal-800 font-medium">🗺️ גלה קהילות</button>
                </div>`;
            }
            commListHtml += `</div>`;

            let dynContainer = getEl('join-dyn-comm-list');
            if (!dynContainer) {
                dynContainer = document.createElement('div');
                dynContainer.id = 'join-dyn-comm-list';
                joinView.appendChild(dynContainer);
            }
            dynContainer.innerHTML = commListHtml;
        } else {
            if (joinSection) joinSection.classList.remove('hidden');
            if (connectedInfo) connectedInfo.classList.add('hidden');
            let dynContainer = getEl('join-dyn-comm-list');
            if (!dynContainer) {
                dynContainer = document.createElement('div');
                dynContainer.id = 'join-dyn-comm-list';
                joinView.appendChild(dynContainer);
            }
            dynContainer.innerHTML = `
            <div class="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 mb-4 mt-2 shadow-sm fade-in flex items-center gap-4 text-right">
                <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-500 text-2xl shrink-0">
                    <i class="fa-solid fa-users-rays"></i>
                </div>
                <div>
                    <h3 class="font-bold text-indigo-900 text-sm mb-0.5">הכוח של הקהילה בידיים שלכם</h3>
                    <p class="text-[10px] text-indigo-700 font-medium leading-tight">
                        התחברו לקהילות קיימות באזורכם או צרו קהילה חדשה בעצמכם כדי לקבל מידע חשוב, הטבות והנחות מעסקים מקומיים ועסקים אחרים!
                    </p>
                </div>
            </div>`;
        }
    }

    // ── Community Feed: Promotions + Bundles ─────────────────
    loadCommunityFeed();
    loadFamilyFlowWallet();
    if (myConnectedCommunitiesCache.length > 0) loadMyReferralCode();

    // ── Initiatives (appended inside join view) ───────────────
    let initContainer = getEl('my-initiatives-container');
    if (!initContainer) {
        initContainer = document.createElement('div');
        initContainer.id = 'my-initiatives-container';
        const joinViewEl = getEl('fam-comm-view-join');
        if (joinViewEl) joinViewEl.appendChild(initContainer);
        else tabContent.appendChild(initContainer);
    }

    // קריאה קריטית לרינדור יוזמות
    renderMyInitiatives();


    // הצגת עמוד הבית של עולם הקהילות
    const anyVisible = ['home','manage','benefits','promos','news','feed'].some(t => !getEl(`fam-comm-view-${t}`)?.classList.contains('hidden'));
    const requestedTab = localStorage.getItem('ofl_open_community_tab');
    if (requestedTab) {
        localStorage.removeItem('ofl_open_community_tab');
        switchFamCommunityTab(requestedTab);
    } else if (!anyVisible) {
        const savedCommTab = localStorage.getItem('ofl_comm_tab');
        if (savedCommTab && ['home','manage','benefits','promos','news','feed'].includes(savedCommTab)) {
            switchFamCommunityTab(savedCommTab);
        } else {
            switchFamCommunityTab('home');
        }
    }
    // עדכון הודעת אין קהילה בבית
    const noCommunityEl = getEl('comm-home-no-community');
    if (noCommunityEl) noCommunityEl.classList.toggle('hidden', isConnected);
}

// ============================================================
// --- COMMUNITY ADVANCED FEATURES (Family UI) ---
// ============================================================

window.openBizCommunityPicker = function(groupCode, bizName, comms) {
    const existing = getEl('biz-comm-picker-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'biz-comm-picker-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center';
    modal.innerHTML = `
    <div class="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8 shadow-2xl">
        <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-slate-800 text-base">🏪 ${safeStr(bizName)}</h3>
            <button onclick="getEl('biz-comm-picker-modal').remove()" class="text-slate-400 hover:text-red-500 text-xl">&times;</button>
        </div>
        <p class="text-xs text-slate-500 mb-3">דרך איזו קהילה לכנס לחנות?</p>
        <div class="space-y-2">
            ${comms.map(c => {
                const active = parseInt(c.family_count) >= (parseInt(c.min_families) || 30);
                const badge = active
                    ? `<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">${c.discount_pct}% הנחה פעילה ✓</span>`
                    : `<span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">${c.discount_pct}% הנחה — ${c.family_count}/${c.min_families || 30} משפחות</span>`;
                return `<a href="${window.location.origin}/storefront.html?store=${groupCode}&communityId=${c.id}" target="_blank" onclick="getEl('biz-comm-picker-modal').remove()"
                    class="flex justify-between items-center bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl px-4 py-3 transition cursor-pointer">
                    <div class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</div>
                    ${badge}
                </a>`;
            }).join('')}
        </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

async function loadCommunityFeed() {
    if (!currentGroup || currentGroup.type !== 'FAMILY') return;
    try {
        const res = await fetch(`${API}/community/family-feed/${currentGroup.id}`);
        if (!res.ok) {
            renderCommunityPromotions([]);
            return;
        }
        const data = await res.json();
        renderCommunityBanners(data.banners || []);
        renderCommunityPromotions(data.promotions || []);
        renderCommunityBundles(data.bundles || []);
        // Show news tab count badge if there's content
        const total = (data.promotions?.length || 0) + (data.bundles?.length || 0);
        const countBadge = getEl('comm-promos-count-badge');
        if (countBadge) {
            if (total > 0) { countBadge.textContent = total; countBadge.classList.remove('hidden'); }
            else { countBadge.classList.add('hidden'); }
        }
    } catch(e) { console.error('loadCommunityFeed error:', e); renderCommunityPromotions([]); }
}

function renderCommunityBanners(banners) {
    const el = getEl('comm-banners-feed');
    if (!el) return;
    if (!banners.length) { el.innerHTML = ''; return; }
    el.innerHTML = banners.map(b => {
        const storeUrl = b.group_code
            ? `${window.location.origin}/storefront.html?store=${b.group_code}&communityId=${b.community_id}`
            : '#';
        const logoHtml = b.business_logo && !b.business_logo.startsWith('data:')
            ? `<img src="${b.business_logo}" class="w-12 h-12 rounded-xl object-cover shadow border border-white shrink-0">`
            : `<div class="w-12 h-12 rounded-xl bg-white/30 flex items-center justify-center text-2xl shrink-0">🏪</div>`;
        return `<a href="${storeUrl}" class="block bg-gradient-to-l from-indigo-600 to-purple-700 text-white rounded-2xl p-4 shadow-md hover:shadow-lg transition fade-in no-underline">
            <div class="flex items-center gap-3 mb-2">
                ${logoHtml}
                <div class="flex-1 text-right">
                    <div class="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">באנר קהילה · ${safeStr(b.community_name)}</div>
                    <div class="font-black text-base leading-tight mt-0.5">${safeStr(b.banner_headline || b.title)}</div>
                </div>
            </div>
            <div class="flex justify-between items-center">
                <div class="text-[10px] text-indigo-200">לחץ לחנות ${safeStr(b.business_name)}</div>
                ${b.discount_pct > 0 ? `<span class="bg-white/20 text-white text-xs font-black px-2.5 py-1 rounded-full">${b.discount_pct}% הנחה</span>` : ''}
            </div>
        </a>`;
    }).join('');
}

function renderCommunityPromotions(promos) {
    // Render into the news tab's dedicated feed container
    const el = getEl('comm-promotions-feed');
    if (!el) return;
    if (!promos.length) {
        el.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed">אין מבצעים פעילים כרגע</p>';
        return;
    }
    el.innerHTML = promos.map(p => {
        const storeUrl = p.biz_code ? `${window.location.origin}/storefront.html?store=${safeStr(p.biz_code)}&communityId=${p.community_id}` : null;
        const storeBtn = storeUrl ? `<a href="${storeUrl}" target="_blank" class="flex-1 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition text-center">🛒 לחנות העסק</a>` : '';
        const phoneBtn = p.biz_phone ? `<a href="tel:${safeStr(p.biz_phone)}" class="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold py-1.5 px-3 rounded-xl transition text-center border border-green-100">📞 ${safeStr(p.biz_phone)}</a>` : '';
        const actionBtns = (storeBtn || phoneBtn) ? `<div class="flex gap-2 mt-2">${storeBtn}${phoneBtn}</div>` : '';
        const logoHtml = p.biz_logo
            ? `<img src="${safeStr(p.biz_logo)}" class="w-11 h-11 rounded-xl object-cover shrink-0 border border-orange-100 shadow-sm" onerror="this.style.display='none'">`
            : `<div class="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0"><i class="fa-solid fa-store text-orange-400 text-base"></i></div>`;
        return `
    <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 shadow-sm">
        <div class="flex items-start gap-3 mb-2">
            ${logoHtml}
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start gap-1">
                    <div class="font-bold text-slate-800 text-sm leading-tight">${safeStr(p.title)}</div>
                    ${p.discount_pct > 0 ? `<span class="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">${p.discount_pct}% הנחה</span>` : ''}
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5">${safeStr(p.biz_name || p.business_name)} · ${safeStr(p.comm_name || p.community_name)}</div>
            </div>
        </div>
        ${p.content ? `<p class="text-xs text-slate-600 leading-relaxed mb-2">${safeStr(p.content)}</p>` : ''}
        <div class="flex justify-between items-center pt-2 border-t border-orange-100">
            <span class="text-[10px] text-slate-400"></span>
            ${p.valid_until ? `<span class="text-[10px] text-orange-500 font-bold">⏰ עד ${new Date(p.valid_until).toLocaleDateString('he-IL')}</span>` : ''}
        </div>
        ${p.promo_code ? `<div class="mt-3 flex items-center justify-between gap-2 bg-slate-900 rounded-xl px-3 py-2"><span class="text-[10px] text-slate-300 font-bold">קוד הנחה:</span><span class="font-mono font-black text-white tracking-widest text-sm">${safeStr(p.promo_code)}</span><button onclick="navigator.clipboard.writeText('${safeStr(p.promo_code)}').then(()=>showToast('success','הקוד הועתק!'))" class="text-slate-400 hover:text-white text-xs"><i class="fa-solid fa-copy"></i></button></div>` : ''}
        ${actionBtns}
    </div>`;
    }).join('');
}

function renderCommunityBundles(bundles) {
    const el = getEl('comm-bundles-feed');
    if (!el) return;
    if (!bundles.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2 mt-2">
        <span>📦</span> חבילות קהילה
    </h4>` + bundles.map(b => {
        const names = b.business_names || [];
        const logos = b.business_logos || [];
        const bizLogosHtml = names.map((n, i) => {
            const logo = logos[i];
            return logo
                ? `<img src="${safeStr(logo)}" title="${safeStr(n)}" class="w-8 h-8 rounded-lg object-cover border border-emerald-100 shadow-sm" onerror="this.style.display='none'">`
                : `<div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center" title="${safeStr(n)}"><i class="fa-solid fa-store text-emerald-400 text-xs"></i></div>`;
        }).join('');
        return `
    <div class="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl p-4 shadow-sm mb-3">
        <div class="flex justify-between items-start mb-1">
            <div class="font-bold text-slate-800 text-sm">${safeStr(b.name)}</div>
            ${b.discount_pct > 0 ? `<span class="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 mr-2">${b.discount_pct}% הנחה</span>` : ''}
        </div>
        ${b.description ? `<p class="text-xs text-slate-600 mt-1 leading-relaxed">${safeStr(b.description)}</p>` : ''}
        <div class="flex items-center gap-1.5 mt-2 flex-wrap">
            ${bizLogosHtml}
            ${names.map(n => `<span class="text-[10px] bg-white text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold shadow-sm">${safeStr(n)}</span>`).join('')}
        </div>
        <div class="flex justify-between items-center mt-2.5 pt-2 border-t border-emerald-100">
            <span class="text-[10px] text-slate-400">${safeStr(b.community_name)}</span>
            <button onclick="purchaseCommunityBundle(${b.id},this)" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-4 rounded-xl transition">🛒 רכישה +18 Flw</button>
        </div>
    </div>`;
    }).join('');
}

window.purchaseCommunityBundle = async function(bundleId, btn) {
    if (!currentGroup) return;
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const res = await fetch(`${API}/community/bundles/${bundleId}/purchase`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id })
        });
        const data = await res.json();
        if (data.success) {
            btn.textContent = '✅ נרכש! +18 Flw';
            btn.className = btn.className.replace('bg-emerald-600 hover:bg-emerald-700','bg-green-500');
            launchFlowConfetti();
            loadFamilyFlowWallet && loadFamilyFlowWallet();
        } else { btn.textContent = data.error || '✅ רכישה'; btn.disabled = false; }
    } catch(e) { btn.disabled = false; btn.textContent = '🛒 רכישה'; }
};

// ─── FLOW COMMUNITY ACTIONS ──────────────────────────────────

window.redeemCommunityPromo = async function(promoId, btn) {
    if (!currentGroup) return;
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const res = await fetch(`${API}/community/promotions/${promoId}/redeem`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id })
        });
        const data = await res.json();
        if (data.success) {
            btn.textContent = '✅ נרשם! +3 Flw';
            btn.className = btn.className.replace('bg-orange-500 hover:bg-orange-600','bg-green-500');
            launchFlowConfetti();
            loadFamilyFlowWallet();
        } else { btn.textContent = '✅ מימשתי'; btn.disabled = false; }
    } catch(e) { btn.disabled = false; btn.textContent = '✅ מימשתי'; }
};

window.openWriteReviewModal = function(bizId, bizName) {
    const existing = document.getElementById('write-review-modal');
    if (existing) { existing.remove(); return; }
    const comms = myConnectedCommunitiesCache || [];
    const modal = document.createElement('div');
    modal.id = 'write-review-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div class="p-4 border-b flex justify-between items-center bg-amber-50">
            <h3 class="font-black text-slate-800 text-sm">⭐ ביקורת על ${safeStr(bizName)}</h3>
            <button onclick="document.getElementById('write-review-modal').remove()" class="text-slate-400 text-2xl leading-none">&times;</button>
        </div>
        <div class="p-4 space-y-3">
            <p class="text-xs text-slate-500 bg-amber-50 rounded-xl p-2 border border-amber-100">ביקורת חיובית (4–5 ⭐) מזכה אותך ב-7 Flw ואת העסק ב-8 Flw</p>
            <div>
                <label class="text-xs font-bold text-slate-600 mb-2 block">דירוג</label>
                <div class="flex gap-2 justify-center text-3xl" id="star-rating">
                    ${[1,2,3,4,5].map(i => `<span data-val="${i}" onclick="selectStar(${i})" class="cursor-pointer text-slate-300 hover:text-yellow-400 transition star-btn">★</span>`).join('')}
                </div>
                <input type="hidden" id="review-rating-val" value="0">
            </div>
            <textarea id="review-text" rows="3" placeholder="ספר על החוויה שלך..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none"></textarea>
            <button onclick="submitCommunityReview(${bizId})" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 rounded-2xl text-sm transition">⭐ שלח ביקורת</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window.selectStar = function(val) {
    document.getElementById('review-rating-val').value = val;
    document.querySelectorAll('.star-btn').forEach((s,i) => {
        s.className = s.className.replace('text-slate-300','').replace('text-yellow-400','');
        s.classList.add(i < val ? 'text-yellow-400' : 'text-slate-300');
    });
};

window.submitCommunityReview = async function(bizId) {
    const rating = parseInt(document.getElementById('review-rating-val')?.value);
    const text = document.getElementById('review-text')?.value?.trim();
    if (!rating) { return; }
    const communityId = myConnectedCommunitiesCache?.[0]?.id || null;
    try {
        const res = await fetch(`${API}/community/reviews`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ familyGroupId: currentGroup.id, businessGroupId: bizId, communityId, rating, text })
        });
        const data = await res.json();
        document.getElementById('write-review-modal')?.remove();
        if (data.success) { if (parseInt(document.getElementById('review-rating-val')?.value) >= 4) launchFlowConfetti(); loadFamilyFlowWallet(); showToast && showToast('success','תודה! הביקורת נשמרה ✅'); }
        else showToast && showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast && showToast('error','שגיאה'); }
};

// ─── FLOW CONFETTI ────────────────────────────────────────────
function launchFlowConfetti() {
    const colors = ['#f59e0b','#fbbf24','#fcd34d','#10b981','#6366f1','#ec4899','#3b82f6','#f97316'];
    if (!document.getElementById('flow-confetti-kf')) {
        const s = document.createElement('style');
        s.id = 'flow-confetti-kf';
        s.textContent = '@keyframes _fcFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}';
        document.head.appendChild(s);
    }
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999999;overflow:hidden;';
    document.body.appendChild(wrap);
    for (let i = 0; i < 90; i++) {
        const el = document.createElement('div');
        const sz = (Math.random() * 8 + 5).toFixed(1);
        const left = (Math.random() * 100).toFixed(1);
        const delay = (Math.random() * 0.6).toFixed(2);
        const dur = (Math.random() * 1.5 + 1.8).toFixed(2);
        const rot = Math.floor(Math.random() * 360);
        const br = Math.random() > 0.5 ? '50%' : '2px';
        el.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;background:${colors[i%colors.length]};border-radius:${br};left:${left}%;top:0;animation:_fcFall ${dur}s ${delay}s ease-in forwards;transform:rotate(${rot}deg);`;
        wrap.appendChild(el);
    }
    setTimeout(() => wrap.remove(), 3800);
}

// ─── FLOW WALLET (FAMILY) ────────────────────────────────────

let familyFlowBalance = 0;
let familyFlowRate = 100;
let familyFlowMinRedeem = 100;
let familyFlowRedeemQuarter = 0;
let _flwBalInitialized = false;

function triggerCoinAnimation(newBalance) {
    const chip = getEl('header-flw-chip');
    if (!chip) return;
    const rect = chip.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    for (let i = 0; i < 7; i++) {
        const coin = document.createElement('div');
        coin.style.cssText = `position:fixed;z-index:99999;font-size:20px;pointer-events:none;
            left:${Math.random()*60+20}%;bottom:80px;transition:all 0.7s cubic-bezier(.4,0,.2,1);
            transition-delay:${i*0.06}s;opacity:1;`;
        coin.textContent = '🪙';
        document.body.appendChild(coin);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                coin.style.left = targetX + 'px';
                coin.style.bottom = (window.innerHeight - targetY) + 'px';
                coin.style.opacity = '0';
                coin.style.transform = 'scale(0.3)';
            });
        });
        setTimeout(() => coin.remove(), 900 + i * 60);
    }
    setTimeout(() => {
        const numEl = getEl('header-flw-num');
        if (numEl) numEl.textContent = Math.floor(newBalance);
        if (chip) {
            chip.style.transform = 'scale(1.3)';
            setTimeout(() => { chip.style.transform = ''; }, 300);
        }
    }, 650);
}

async function loadFamilyFlowWallet() {
    if (!currentGroup || currentGroup.type !== 'FAMILY') return;
    try {
        const res = await fetch(`${API}/flow/wallet/family/${currentGroup.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const prevBal = familyFlowBalance;
        familyFlowBalance = data.balance || 0;
        familyFlowRate = data.rate || 100;
        familyFlowMinRedeem = data.min_redeem || 100;
        familyFlowRedeemQuarter = data.redeem_quarter || 0;

        // Daily login reward
        fetch(`${API}/flow/daily-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: currentGroup.id }) }).catch(() => {});

        // Update FLOW badge in news tab button
        const flowBadge = getEl('comm-news-flow-badge');
        if (flowBadge) {
            flowBadge.textContent = `Flw${Math.floor(familyFlowBalance)}`;
            flowBadge.classList.remove('hidden');
        }

        // Update header FLW chip — לילדים ה-chip מנוהל ע"י loadChildFlwWallet בלבד
        if (!currentUser || currentUser.role !== 'CHILD') {
            const chip = getEl('header-flw-chip');
            const numEl = getEl('header-flw-num');
            if (chip) {
                if (numEl) numEl.textContent = Math.floor(familyFlowBalance);
                chip.classList.remove('hidden');
                chip.classList.add('flex');
                if (_flwBalInitialized && familyFlowBalance > prevBal) {
                    triggerCoinAnimation(familyFlowBalance);
                }
            }
        }
        _flwBalInitialized = true;

        // If wallet modal is open, refresh it
        if (document.getElementById('fam-flow-wallet-modal')) renderFlowWalletContent(data);
    } catch(e) {}
}

function renderFlowWalletContent(data) {
    const content = document.getElementById('flow-wallet-content');
    if (!content) return;
    const bal = parseFloat(data.balance || 0);
    const rate = parseFloat(data.rate || 100);
    const minR = parseFloat(data.min_redeem || familyFlowMinRedeem || 100);
    const quarter = parseFloat(data.redeem_quarter || familyFlowRedeemQuarter || 0);
    const worth = Math.floor(bal / rate) * 10;
    // מי שכבר מימש בעבר יכול לממש גם ביתרה חלקית (עד איפוס הרבעון)
    const hasRedeemed = !!data.has_redeemed;
    const canRedeem = bal > 0 && (bal >= minR || hasRedeemed);

    let expiryDate = null;
    let expiryHtml = '';
    if (quarter >= 1 && quarter <= 4) {
        const now = new Date();
        const yr = now.getFullYear();
        const quarterEnds = [
            new Date(yr, 2, 31), new Date(yr, 5, 30),
            new Date(yr, 8, 30), new Date(yr, 11, 31)
        ];
        expiryDate = quarterEnds[quarter - 1];
        if (expiryDate < now) expiryDate = new Date(new Date(expiryDate).setFullYear(yr + 1));
        const expStr = expiryDate.toLocaleDateString('he-IL', {day:'2-digit', month:'2-digit', year:'numeric'});
        expiryHtml = `
        <div class="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-3">
            <div class="flex items-center gap-2">
                <span class="text-orange-500 text-sm">⏰</span>
                <div>
                    <div class="text-xs font-bold text-orange-700">תוקף קודי מימוש</div>
                    <div class="text-[10px] text-orange-500">קודים שתפיק יפוגו ב-${expStr}</div>
                </div>
            </div>
            <span class="text-xs font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-lg">${expStr}</span>
        </div>`;
    }

    content.innerHTML = `
    <div class="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl p-5 text-center mb-3 shadow-lg">
        <div class="text-5xl font-black text-white mb-1">Flw ${bal.toLocaleString('he-IL', {minimumFractionDigits:0,maximumFractionDigits:1})}</div>
        <div class="text-amber-100 text-sm">FLOW אישי</div>
        ${worth > 0 ? `<div class="mt-2 bg-white/20 rounded-xl px-3 py-1 text-white text-xs font-bold">שווה ₪${worth} הנחה אצל עסק מחובר</div>` : `<div class="mt-2 text-amber-100 text-xs">צבור ${minR} Flw כדי לממש הנחה</div>`}
    </div>
    ${expiryHtml}
    <div class="mb-4">
        <button onclick="openFlowRedeemToStore(${bal},${minR})" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-2xl text-sm transition shadow-md ${!canRedeem ? 'opacity-50 pointer-events-none' : ''}">
            🛒 ממש הנחה בחנות עסק
        </button>
        ${!canRedeem ? `<p class="text-[10px] text-slate-400 text-center mt-1">צבור ${minR} Flw כדי להתחיל לממש (יש לך ${Math.floor(bal)})</p>` : ''}
        <button onclick="openFlowRedeemModal()" class="w-full mt-2 bg-white border border-amber-300 text-amber-700 font-bold py-2 rounded-2xl text-xs transition hover:bg-amber-50">
            🎁 קבל קוד הנחה (להציג ידנית)
        </button>
    </div>
    <h4 class="font-bold text-slate-700 text-sm mb-2">📋 פעילות אחרונה</h4>
    <div class="space-y-2 max-h-52 overflow-y-auto">
        ${data.transactions?.length ? data.transactions.map(t => {
            const d = t.created_at ? new Date(t.created_at) : null;
            const dateStr = d ? d.toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit',year:'2-digit'}) : '';
            return `
        <div class="flex justify-between items-center text-xs py-2 border-b border-slate-100">
            <div>
                <span class="text-slate-600">${safeStr(t.description || '')}</span>
                ${dateStr ? `<div class="text-[10px] text-slate-400 mt-0.5">${dateStr}</div>` : ''}
            </div>
            <span class="font-bold shrink-0 mr-2 ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}">${t.amount > 0 ? '+' : ''}${parseFloat(t.amount).toFixed(0)} Flw</span>
        </div>`;
        }).join('') : '<p class="text-xs text-slate-400 text-center py-4">אין פעילות עדיין — התחל לצבור Flw!</p>'}
    </div>`;
}

window.openFamilyFlowWallet = function() { window.openFlowWalletModal(); };

window.openFlowWalletModal = async function() {
    const existing = getEl('fam-flow-wallet-modal');
    if (existing) { existing.remove(); return; }
    const modal = document.createElement('div');
    modal.id = 'fam-flow-wallet-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div class="p-4 border-b flex justify-between items-center bg-gradient-to-r from-amber-50 to-yellow-50">
            <h3 class="font-black text-slate-800 text-base">⚡ ארנק FLOW האישי שלי</h3>
            <button onclick="getEl('fam-flow-wallet-modal').remove()" class="text-slate-400 hover:text-red-500 text-2xl leading-none">&times;</button>
        </div>
        <div id="flow-wallet-content" class="p-4">
            <div class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>
        </div>
    </div>`;
    document.body.appendChild(modal);
    try {
        const res = await fetch(`${API}/flow/wallet/family/${currentGroup.id}`);
        const data = await res.json();
        renderFlowWalletContent(data);
    } catch(e) { document.getElementById('flow-wallet-content').innerHTML = '<p class="text-red-500 text-sm text-center py-6">שגיאה בטעינת הארנק</p>'; }
};

window.openFlowRedeemModal = function() {
    const comms = myConnectedCommunitiesCache || [];
    // Collect businesses — prefer myCommunityBusinessesCache (loaded from /community/info)
    const _allBiz = myCommunityBusinessesCache.length ? myCommunityBusinessesCache : (window.communityBusinessesCache || []);
    const _bizMap = {};
    _allBiz.forEach(b => { const k = b.business_id || b.id; if (!_bizMap[k]) _bizMap[k] = b; });
    const bizOptions = Object.values(_bizMap).map(b =>
        `<option value="${b.business_id || b.id}">${safeStr(b.business_name || b.name || '')}</option>`).join('');
    const existing = getEl('flow-redeem-modal');
    if (existing) { existing.remove(); return; }
    const rate = familyFlowRate || 100;
    const minR = familyFlowMinRedeem || 100;
    const quarter = familyFlowRedeemQuarter || 0;
    const qNames = ['', 'Q1 (31 מרץ)', 'Q2 (30 יוני)', 'Q3 (30 ספטמבר)', 'Q4 (31 דצמבר)'];
    const quarterNote = (quarter >= 1 && quarter <= 4) ? `<p class="text-[10px] text-orange-500 font-bold mt-1">⏰ תוקף הקוד: עד סוף ${qNames[quarter]}</p>` : '';
    const modal = document.createElement('div');
    modal.id = 'flow-redeem-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div class="p-4 border-b flex justify-between items-center bg-amber-50">
            <h3 class="font-black text-slate-800 text-base">🎁 מימוש Flw להנחה</h3>
            <button onclick="getEl('flow-redeem-modal').remove()" class="text-slate-400 hover:text-red-500 text-2xl leading-none">&times;</button>
        </div>
        <div class="p-4 space-y-3">
            <p class="text-xs text-slate-500 bg-amber-50 rounded-xl p-3 border border-amber-100">כל ${rate} Flw = ₪10 הנחה. תקבל קוד חד-פעמי להציג לעסק.</p>
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">בחר עסק לממש אצלו</label>
                <select id="redeem-biz-select" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">— בחר עסק —</option>
                    ${bizOptions}
                </select>
            </div>
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">כמות Flw לממש (מינימום ${minR})</label>
                <input type="number" id="redeem-flow-amount" min="${minR}" step="${minR}" value="${minR}" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-amber-600">
                <p class="text-[10px] text-slate-400 mt-1">יתרה: Flw${Math.floor(familyFlowBalance)} · שווי: ₪<span id="redeem-ils-preview">${Math.floor(minR / rate) * 10}</span></p>
                ${quarterNote}
            </div>
            <button onclick="submitFlowRedeem()" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-2xl text-sm transition shadow-md">🎁 קבל קוד הנחה</button>
            <div id="redeem-result" class="hidden"></div>
        </div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('redeem-flow-amount')?.addEventListener('input', e => {
        const v = parseInt(e.target.value) || 0;
        const ils = Math.floor(v / (familyFlowRate || 100)) * 10;
        const el = document.getElementById('redeem-ils-preview');
        if (el) el.textContent = ils;
    });
};

function _buildFlowToStoreModal(bal, businesses) {
    const existing = getEl('flow-to-store-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'flow-to-store-modal';
    modal.className = 'fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4';
    const bizListHtml = businesses.map(b => {
        const communityId = b.community_id || '';
        const storeCode = b.group_code || '';
        if (!storeCode) return '';
        return `<button onclick="window.goToStoreWithFlow('${storeCode}','${communityId}',${Math.floor(bal)})" class="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition text-right">
            ${b.logo_url ? `<img src="${safeStr(b.logo_url)}" class="w-10 h-10 rounded-lg object-cover shrink-0">` : `<div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><i class="fa-solid fa-store text-slate-400"></i></div>`}
            <div class="flex-1 min-w-0">
                <div class="font-bold text-slate-800 text-sm truncate">${safeStr(b.business_name || '')}</div>
                <div class="text-xs text-slate-400">${safeStr(b.comm_name || '')}</div>
            </div>
            <i class="fa-solid fa-chevron-left text-slate-300 text-xs shrink-0"></i>
        </button>`;
    }).join('');
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div class="p-4 border-b flex justify-between items-center bg-amber-50">
            <div>
                <h3 class="font-black text-slate-800 text-base">🛒 בחר עסק לממש הנחה</h3>
                <p class="text-xs text-amber-600 mt-0.5">יתרה: ${Math.floor(bal)} Flw</p>
            </div>
            <button onclick="getEl('flow-to-store-modal').remove()" class="text-slate-400 hover:text-red-500 text-2xl leading-none">&times;</button>
        </div>
        <div class="p-4 space-y-2 max-h-80 overflow-y-auto">
            ${bizListHtml || '<p class="text-sm text-slate-400 text-center py-4">לא נמצאו עסקים בקהילות שלך</p>'}
        </div>
    </div>`;
    document.body.appendChild(modal);
}

window.openFlowRedeemToStore = async function(bal, minR) {
    const existing = getEl('flow-to-store-modal');
    if (existing) { existing.remove(); return; }

    // Show loading modal immediately
    const loadingModal = document.createElement('div');
    loadingModal.id = 'flow-to-store-modal';
    loadingModal.className = 'fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4';
    loadingModal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <i class="fa-solid fa-circle-notch fa-spin text-amber-500 text-2xl mb-3"></i>
        <p class="text-slate-500 text-sm font-bold">טוען עסקים...</p>
    </div>`;
    document.body.appendChild(loadingModal);

    let rawBiz = myCommunityBusinessesCache.length ? myCommunityBusinessesCache : (window.communityBusinessesCache || []);

    // Fetch live if cache is empty
    if (!rawBiz.length && currentGroup && currentGroup.id) {
        try {
            const res = await fetch(`${API}/community/info/${currentGroup.id}`);
            const d = await res.json();
            if (d.success && d.businesses) {
                myCommunityBusinessesCache = d.businesses;
                rawBiz = d.businesses;
            }
        } catch(e) {}
    }

    // Deduplicate by group_code
    const bizMap = {};
    rawBiz.forEach(b => {
        const key = b.group_code || String(b.business_id);
        if (!bizMap[key]) bizMap[key] = { ...b, logo_url: b.biz_logo || b.logo_url };
        else if (!bizMap[key].community_id) bizMap[key].community_id = b.community_id;
    });
    const businesses = Object.values(bizMap);

    // Remove loading modal and show real one
    getEl('flow-to-store-modal')?.remove();
    if (!businesses.length) {
        showToast && showToast('info', 'אין עסקים מחוברים לקהילות שלך');
        return;
    }
    _buildFlowToStoreModal(bal, businesses);
};

// Legacy inner function for backward compat — no longer used as standalone
function _openFlowRedeemToStoreSync(bal, minR) {
    const existing = getEl('flow-to-store-modal');
    if (existing) { existing.remove(); return; }
    const rawBiz = myCommunityBusinessesCache.length ? myCommunityBusinessesCache : (window.communityBusinessesCache || []);
    const bizMap = {};
    rawBiz.forEach(b => {
        const key = b.group_code || String(b.business_id);
        if (!bizMap[key]) bizMap[key] = { ...b, logo_url: b.biz_logo || b.logo_url };
        else if (!bizMap[key].community_id) bizMap[key].community_id = b.community_id;
    });
    const businesses = Object.values(bizMap);
    if (!businesses.length) { showToast && showToast('info', 'אין עסקים'); return; }
    _buildFlowToStoreModal(bal, businesses);
}


window.goToStoreWithFlow = function(storeCode, communityId, flowBalance) {
    const familyId = currentGroup?.id || '';
    let url = `${window.location.origin}/storefront.html?store=${encodeURIComponent(storeCode)}&flowRedeem=${flowBalance}&familyGroupId=${familyId}`;
    if (communityId) url += `&communityId=${communityId}`;
    window.open(url, '_blank');
    const m = getEl('flow-to-store-modal');
    if (m) m.remove();
    const w = getEl('fam-flow-wallet-modal');
    if (w) w.remove();
};

window.submitFlowRedeem = async function() {
    const bizId = parseInt(document.getElementById('redeem-biz-select')?.value);
    const flowAmt = parseInt(document.getElementById('redeem-flow-amount')?.value);
    const minR = familyFlowMinRedeem || 100;
    if (!bizId) { showToast && showToast('error','בחר עסק'); return; }
    if (!flowAmt || flowAmt < minR) { showToast && showToast('error',`מינימום ${minR} Flw`); return; }
    if (flowAmt > familyFlowBalance) { showToast && showToast('error','אין מספיק Flw בארנק'); return; }
    try {
        const res = await fetch(`${API}/flow/redeem`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ familyGroupId: currentGroup.id, businessGroupId: bizId, flowAmount: flowAmt })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const result = document.getElementById('redeem-result');
        if (result) {
            result.classList.remove('hidden');
            result.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <div class="text-3xl font-black text-green-600 tracking-widest mb-1">${data.code}</div>
                <div class="text-xs text-slate-600">קוד הנחה של ₪${data.discountIls} — הצג לעסק!</div>
                <div class="text-[10px] text-slate-400 mt-1">הקוד חד-פעמי ותקף לשימוש אחד</div>
                ${data.expiresAt ? `<div class="text-[10px] text-orange-500 font-bold mt-1">⏰ תוקף עד: ${new Date(data.expiresAt).toLocaleDateString('he-IL')}</div>` : ''}
            </div>`;
        }
        launchFlowConfetti();
        familyFlowBalance -= flowAmt;
        loadFamilyFlowWallet();
    } catch(e) { showToast && showToast('error', e.message); }
};

// Family refers a business to their community
window.openFamReferralModal = function() {
    if (!currentGroup || currentGroup.type !== 'FAMILY') return;
    const comms = myConnectedCommunitiesCache || [];
    const existing = getEl('fam-refer-modal');
    if (existing) { existing.remove(); return; }
    const modal = document.createElement('div');
    modal.id = 'fam-refer-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-4 border-b flex justify-between items-center bg-gradient-to-r from-yellow-50 to-amber-50">
            <h3 class="font-bold text-lg text-slate-800">🌟 המלץ על עסק לקהילה</h3>
            <button onclick="getEl('fam-refer-modal').remove()" class="text-slate-400 hover:text-red-500 text-2xl leading-none">&times;</button>
        </div>
        <div class="p-4 space-y-3">
            <p class="text-xs text-slate-500 bg-amber-50 rounded-xl p-3 border border-amber-100">
                <strong>🎁 תרוויחי נקודות!</strong> כשהעסק שהמלצת עליו יאושר לקהילה — הקהילה שלך תקבל בונוס נקודות לארנק.
            </p>
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">קוד הקבוצה של העסק</label>
                <input type="text" id="fam-refer-biz-code" placeholder="הזן קוד קבוצה (לדוגמה: ABC123)" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase">
            </div>
            ${comms.length ? `
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">לאיזו קהילה?</label>
                <select id="fam-refer-comm" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
                    ${comms.map(c => `<option value="${c.id}">${safeStr(c.name)}</option>`).join('')}
                </select>
            </div>` : '<p class="text-xs text-red-400">אינך חבר בקהילה. הצטרף לקהילה תחילה.</p>'}
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">למה ממליצים? (אופציונלי)</label>
                <textarea id="fam-refer-notes" rows="2" placeholder="ספר לנו קצת על העסק..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"></textarea>
            </div>
            ${comms.length ? `<button onclick="submitFamReferral()" class="w-full bg-amber-500 text-white py-2.5 rounded-xl font-bold hover:bg-amber-600 transition">⭐ שלח המלצה</button>` : ''}
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window.submitFamReferral = async function() {
    const bizCode = getEl('fam-refer-biz-code')?.value?.trim()?.toUpperCase();
    const communityId = getEl('fam-refer-comm')?.value;
    const notes = getEl('fam-refer-notes')?.value?.trim();
    if (!bizCode || !communityId) { showToast('error', 'יש למלא קוד עסק וקהילה'); return; }
    try {
        const res = await fetch(`${API}/community/family-refer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: currentGroup.id, bizCode, communityId: parseInt(communityId), notes })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', '✅ ההמלצה נשלחה! תרוויחו נקודות כשהעסק יאושר.');
            getEl('fam-refer-modal')?.remove();
        } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
};

// ─── INTEREST COMMUNITIES & MAP DISCOVERY ──────────────────────

window.famSearchByInterest = async function() {
    const tag = (getEl('fam-interest-input')?.value || '').trim();
    const el = getEl('fam-interest-results');
    if (!tag || !el) return;
    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">מחפש...</p>';
    try {
        const res = await fetch(`${API}/communities/by-interest?tag=${encodeURIComponent(tag)}`);
        const data = await res.json();
        const list = data.communities || [];
        if (!list.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">לא נמצאו קהילות עם תגית זו</p>'; return; }
        const myIds = new Set((myConnectedCommunitiesCache || []).map(c => String(c.id)));
        el.innerHTML = list.map(c => {
            const joined = myIds.has(String(c.id));
            return `<div class="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm flex justify-between items-center">
                <div class="text-right">
                    <div class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</div>
                    <div class="text-xs text-slate-500">${safeStr(c.city || 'ארצי')} · ${c.family_count || 0} משפחות · ${c.biz_count || 0} עסקים</div>
                    <div class="text-[10px] text-teal-600 mt-0.5">תגית: ${safeStr(c.interest_tag || tag)}</div>
                </div>
                ${joined
                    ? `<span class="text-xs text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-xl">✅ חבר</span>`
                    : `<button onclick="joinCommunityByCode('${safeStr(c.code)}','${safeStr(c.name).replace(/'/g,"\\'")}',this)" class="bg-teal-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-teal-700 transition">הצטרף</button>`
                }
            </div>`;
        }).join('');
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-xs text-center py-4">שגיאה</p>'; }
};

window.joinCommunityByCode = async function(code, name, btn) {
    if (!currentGroup || !code) return;
    btn.disabled = true; btn.textContent = '...';
    try {
        const res = await fetch(`${API}/community/join`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, code })
        });
        const data = await res.json();
        if (data.success) {
            btn.textContent = '⏳ ממתין לאישור';
            btn.className = btn.className.replace(/bg-\w+-\d+\s*/g,'') + ' bg-amber-500 cursor-default';
            btn.disabled = true;
            fetchCommunityData();
        } else { btn.textContent = data.error || 'שגיאה'; btn.disabled = false; }
    } catch(e) { btn.textContent = 'שגיאת רשת'; btn.disabled = false; }
};

window.openCommunityDiscoveryModal = async function() {
    const existing = document.getElementById('community-discovery-modal');
    if (existing) { existing.remove(); return; }
    const modal = document.createElement('div');
    modal.id = 'community-discovery-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div class="p-4 border-b flex justify-between items-center bg-gradient-to-r from-teal-50 to-cyan-50">
            <h3 class="font-bold text-lg text-slate-800">🗺️ גלה קהילות</h3>
            <button onclick="document.getElementById('community-discovery-modal').remove()" class="text-slate-400 hover:text-red-500 text-2xl leading-none">&times;</button>
        </div>
        <div class="p-4 border-b">
            <div class="flex gap-2">
                <input type="text" id="discovery-city-input" placeholder="חפש לפי שם קהילה, עיר או אזור..." class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" oninput="_discoverySearchDebounce(this.value)" onkeydown="if(event.key==='Enter')searchCommunitiesByCity()">
                <button onclick="searchCommunitiesByCity()" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition">חפש</button>
            </div>
        </div>
        <div id="discovery-results" class="overflow-y-auto flex-1 p-4">
        </div>
    </div>`;
    document.body.appendChild(modal);
    // ברירת מחדל: הצג קהילות הקיימות של המשפחה
    _renderDiscoveryMyComms();
};

function _renderDiscoveryMyComms() {
    const el = getEl('discovery-results');
    if (!el) return;
    const myComms = myConnectedCommunitiesCache || [];
    if (!myComms.length) {
        el.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">עוד לא חברים בקהילה — חפשו קהילה לעיל</p>';
        return;
    }
    const approved = myComms.filter(c => (c.status || 'approved') === 'approved');
    const pending = myComms.filter(c => c.status === 'pending');
    let html = '';
    if (approved.length) {
        html += `<h4 class="text-xs font-bold text-slate-500 mb-2">✅ הקהילות שלי</h4>`;
        html += approved.map(c => `
            <div class="bg-white border border-green-100 rounded-xl p-3 mb-2 shadow-sm flex justify-between items-center">
                <div class="text-right">
                    <div class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</div>
                    <div class="text-xs text-slate-500">${safeStr(c.city || 'כללי')}</div>
                </div>
                <span class="text-xs text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">✅ חבר</span>
            </div>`).join('');
    }
    if (pending.length) {
        html += `<h4 class="text-xs font-bold text-slate-500 mb-2 mt-3">⏳ ממתינות לאישור</h4>`;
        html += pending.map(c => `
            <div class="bg-white border border-amber-100 rounded-xl p-3 mb-2 shadow-sm flex justify-between items-center">
                <div class="text-right">
                    <div class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</div>
                    <div class="text-xs text-slate-500">${safeStr(c.city || 'כללי')}</div>
                </div>
                <span class="text-xs text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">⏳ ממתין</span>
            </div>`).join('');
    }
    html += `<p class="text-[10px] text-slate-400 text-center mt-3">לחפש קהילות נוספות — הקלד שם/עיר/אזור בחיפוש</p>`;
    el.innerHTML = html;
}

let _discoverySearchTimer = null;
window._discoverySearchDebounce = function(val) {
    clearTimeout(_discoverySearchTimer);
    _discoverySearchTimer = setTimeout(() => searchCommunitiesByCity(val), 350);
};

window.searchCommunitiesByCity = async function(city) {
    const q = city !== undefined ? city : (getEl('discovery-city-input')?.value || '').trim();
    const el = getEl('discovery-results');
    if (!el) return;
    if (!q) { _renderDiscoveryMyComms(); return; }
    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">טוען...</p>';
    try {
        const res = await fetch(`${API}/communities/discover?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        let allComms = (data.byCity || []).flatMap(g => g.communities);
        // fallback: קהילות שהמשפחה חברה בהן שתואמות את החיפוש תמיד מוצגות
        const myAll = myConnectedCommunitiesCache || [];
        const ql = q.toLowerCase();
        const myMatching = myAll.filter(c => (c.name||'').toLowerCase().includes(ql) || (c.city||'').toLowerCase().includes(ql));
        const returnedIds = new Set(allComms.map(c => String(c.id)));
        myMatching.forEach(c => { if (!returnedIds.has(String(c.id))) allComms.push({ id: c.id, name: c.name, city: c.city, code: c.code, community_type: c.community_type, family_count: c.member_count || 0, biz_count: 0 }); });
        if (!allComms.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">לא נמצאו קהילות עבור "' + safeStr(q) + '"</p>'; return; }
        // קיבוץ לפי עיר
        const byCityMap = {};
        allComms.forEach(c => { const k = c.city || 'ארצי'; if (!byCityMap[k]) byCityMap[k] = []; byCityMap[k].push(c); });
        const byCity = Object.entries(byCityMap).map(([city, communities]) => ({ city, communities }));
        const myApproved = new Set(myAll.filter(c => (c.status||'approved')==='approved').map(c => String(c.id)));
        const myPending = new Set(myAll.filter(c => c.status === 'pending').map(c => String(c.id)));
        el.innerHTML = byCity.map(group => `
            <div class="mb-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <i class="fa-solid fa-location-dot text-red-400"></i> ${safeStr(group.city)}
                </h4>
                ${group.communities.map(c => {
                    const approved = myApproved.has(String(c.id));
                    const pending = myPending.has(String(c.id));
                    const typeLabel = c.community_type === 'interest' ? '🔖 עניין' : '📍 גיאוגרפית';
                    return `<div class="bg-white border border-slate-100 rounded-xl p-3 mb-2 shadow-sm flex justify-between items-center">
                        <div class="text-right">
                            <div class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</div>
                            <div class="text-xs text-slate-500">${c.family_count || 0} משפחות · ${c.biz_count || 0} עסקים · ${typeLabel}</div>
                            ${c.zone_name ? `<div class="text-[10px] text-indigo-500 mt-0.5">📍 ${safeStr(c.zone_name)}</div>` : ''}
                            ${c.interest_tags ? `<div class="text-[10px] text-teal-600 mt-0.5">${safeStr(c.interest_tags)}</div>` : ''}
                        </div>
                        ${approved
                            ? `<span class="text-xs text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">✅ חבר</span>`
                            : pending
                            ? `<span class="text-xs text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">⏳ ממתין לאישור</span>`
                            : `<button onclick="joinCommunityByCode('${safeStr(c.code)}','${safeStr(c.name).replace(/'/g,"\\'")}',this)" class="bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-700 transition">הצטרף</button>`
                        }
                    </div>`;
                }).join('')}
            </div>`).join('');
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-xs text-center py-4">שגיאה בטעינה</p>'; }
};

async function loadFamilyCommunityPromos() {
    if (!currentGroup || !currentGroup.id) return;
    try {
        const res = await fetch(`${API}/community/promos/${currentGroup.id}`);
        const data = await res.json();
        if (!data.success) return;
        renderFamilyCommunityPromos(data.promos || []);
    } catch(e) {}
}

function renderFamilyCommunityPromos(promos) {
    // מחפשים את container המבצעים (בתוך tab הטבות)
    let promosContainer = getEl('community-promos-container');
    if (!promosContainer) {
        const benefitsView = getEl('fam-comm-view-benefits');
        if (!benefitsView) return;
        promosContainer = document.createElement('div');
        promosContainer.id = 'community-promos-container';
        promosContainer.className = 'mt-5';
        benefitsView.appendChild(promosContainer);
    }
    if (!promos.length) { promosContainer.innerHTML = ''; return; }
    let html = `<h3 class="font-bold text-slate-800 mb-3 text-sm"><i class="fa-solid fa-tag text-pink-500"></i> מבצעים קהילתיים</h3><div class="space-y-3">`;
    promos.forEach(p => {
        const until = p.valid_until ? `<span class="text-[9px] text-slate-500">בתוקף עד: ${p.valid_until.slice(0,10)}</span>` : '';
        const discountBadge = p.discount_pct > 0 ? `<span class="text-[9px] font-bold bg-pink-50 text-pink-700 border border-pink-100 px-1.5 py-0.5 rounded">${p.discount_pct}% הנחה</span>` : '';
        const storeUrl = p.biz_code ? `${window.location.origin}/storefront.html?store=${safeStr(p.biz_code)}&communityId=${p.community_id}` : null;
        const storeBtn = storeUrl ? `<a href="${storeUrl}" target="_blank" class="block w-full text-center bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition mt-3">🛒 לחנות העסק — הנחת קהילה פעילה</a>` : '';
        const phoneBtn = p.biz_phone ? `<a href="tel:${safeStr(p.biz_phone)}" class="block w-full text-center bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold py-2 px-3 rounded-xl transition mt-2 border border-green-100">📞 ${safeStr(p.biz_phone)}</a>` : '';
        html += `
        <div class="bg-white border border-pink-100 rounded-2xl p-4 shadow-sm fade-in">
            <div class="flex justify-between items-start mb-2">
                <div class="flex gap-1 flex-wrap">${discountBadge}${until}</div>
                <div class="text-right">
                    <h4 class="font-bold text-slate-800 text-sm">${safeStr(p.title)}</h4>
                    <p class="text-[10px] text-slate-500">מאת: ${safeStr(p.biz_name || 'עסק')}</p>
                </div>
            </div>
            ${p.content ? `<p class="text-xs text-slate-600 mb-3 text-right leading-relaxed">${safeStr(p.content)}</p>` : ''}
            ${p.promo_code ? `<div class="mt-2 text-center"><span class="font-mono font-black text-base bg-slate-900 text-white px-4 py-1.5 rounded-xl tracking-widest">${safeStr(p.promo_code)}</span></div>` : ''}
            ${storeBtn}${phoneBtn}
        </div>`;
    });
    html += '</div>';
    promosContainer.innerHTML = html;
}

async function joinCommunity() {
    return joinCommunityDyn();
}

async function joinCommunityDyn() {
    const inputEl = getEl('community-code-input-dyn') || getEl('community-code-input');
    const code = inputEl ? inputEl.value : '';
    if(!code) return showToast('error', 'יש להזין קוד קהילה');
    const referralCode = (getEl('community-referral-input')?.value || '').trim().toUpperCase() || undefined;

    try {
        const res = await fetch(`${API}/community/join`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, code, referralCode })
        });
        const data = await res.json();
        if(data.success && data.pending) {
            showToast('info', `הבקשה לקהילת "${data.community.name}" נשלחה — ממתינה לאישור מנהל.`);
            fetchCommunityData();
            loadMyReferralCode();
        } else if(data.success) {
            const msg = data.referrerFound
                ? `הצטרפתם לקהילת ${data.community.name} 🎉 החבר שהפנה אותכם קיבל Flw FLOW`
                : `הצטרפתם בהצלחה לקהילת: ${data.community.name}`;
            showToast('success', msg);
            fetchCommunityData();
            loadMyReferralCode();
        } else if(data.pending) {
            showToast('info', data.error || 'הבקשה שלך ממתינה לאישור.');
        } else { showToast('error', data.error || 'שגיאה. ודאו שהקוד נכון וטרם הגעתם ל-5 קהילות.'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

let _myReferralCode = null;
let _selectedCommCode = null;
let _selectedCommName = null;

async function loadMyReferralCode() {
    if (!currentGroup || currentGroup.type !== 'FAMILY') return;
    try {
        const [codeRes, statsRes] = await Promise.all([
            fetch(`${API}/community/my-referral-code/${currentGroup.id}`),
            fetch(`${API}/community/my-referral-stats/${currentGroup.id}`)
        ]);
        if (!codeRes.ok) return;
        const data = await codeRes.json();
        _myReferralCode = data.code;
        const card = getEl('my-referral-code-card');
        if (card) card.classList.remove('hidden');
        // ספירת הפניות
        if (statsRes.ok) {
            const stats = await statsRes.json();
            const countEl = getEl('my-referrals-count-display');
            if (countEl) {
                countEl.textContent = stats.approved > 0
                    ? `הפנית ${stats.approved} חבר${stats.approved > 1 ? 'ים' : ''} בהצלחה`
                    : '';
            }
        }
        // אתחל עם הקהילה הראשונה אם קיימת
        const firstComm = (myConnectedCommunitiesCache || []).find(c => (c.status || 'approved') === 'approved');
        if (firstComm) selectCommunityForReferral(firstComm.id, firstComm.name, firstComm.code, true);
    } catch(e) {}
}

window.selectCommunityForReferral = function(commId, commName, commCode, silent) {
    _selectedCommCode = commCode;
    _selectedCommName = commName;
    // עדכן כרטיס קוד — מציג קוד קהילה (לכניסה), לא קוד הפניה אישי
    const commCodeSection = getEl('referral-comm-code-section');
    const commCodeDisplay = getEl('referral-comm-code-display');
    const selName = getEl('referral-comm-name-display');
    const waBtn = getEl('referral-wa-btn');
    if (commCodeSection) commCodeSection.classList.remove('hidden');
    if (commCodeDisplay) commCodeDisplay.textContent = commCode || '—';
    if (selName) selName.textContent = commName;
    if (waBtn) waBtn.classList.remove('hidden');
    // סימון ויזואלי
    document.querySelectorAll('.comm-select-card').forEach(el => {
        el.classList.remove('border-indigo-400', 'bg-indigo-100');
        el.classList.add('border-indigo-100', 'bg-indigo-50');
        const badge = el.querySelector('.comm-selected-badge');
        if (badge) badge.remove();
    });
    const card = getEl(`comm-card-${commId}`);
    if (card) {
        card.classList.remove('border-indigo-100', 'bg-indigo-50');
        card.classList.add('border-indigo-400', 'bg-indigo-100');
        const btnsDiv = card.querySelector('.flex.items-center.gap-2');
        if (btnsDiv && !btnsDiv.querySelector('.comm-selected-badge')) {
            const badge = document.createElement('span');
            badge.className = 'comm-selected-badge text-[9px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded-md';
            badge.textContent = '✓ נבחרה';
            btnsDiv.prepend(badge);
        }
    }
    if (!silent) showToast('info', `נבחרה קהילת ${commName} — כעת העתק את הקוד`);
};

window.toggleReferralInput = function() {
    const wrap = getEl('referral-input-wrap');
    if (wrap) wrap.classList.toggle('hidden');
};

window.copyReferralCode = function() {
    // מעתיק קוד קהילה (לא קוד הפניה אישי) — זה מה שהחבר צריך להזין
    const code = _selectedCommCode || getEl('referral-comm-code-display')?.textContent?.trim();
    if (!code || code === '—') { showToast('info', 'בחר קהילה תחילה'); return; }
    navigator.clipboard?.writeText(code).then(() => showToast('success', `✅ קוד ${code} הועתק!`)).catch(() => showToast('info', `קוד הקהילה: ${code}`));
};

window.shareReferralWhatsApp = function() {
    const code = _myReferralCode;
    if (!code || !_selectedCommCode) return;
    const msg = `היי! הצטרפ/י לקהילת ${_selectedCommName} ב-Oneflow 🏘️\nקוד קהילה: *${_selectedCommCode}*\nקוד הפניה שלי: *${code}*\n👉 ${window.location.origin}/?inviteCommunityCode=${_selectedCommCode}&ref=${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
};

async function leaveCommunity(commId, commName) {
    if(!confirm(`האם אתם בטוחים שברצונכם להתנתק מקהילת ${commName}? לא תוכלו לקבל הנחות מעסקים בקהילה זו.`)) return;
    try {
        const res = await fetch(`${API}/community/leave/${currentGroup.id}/${commId}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) {
            showToast('success', `התנתקתם מקהילת ${commName}`);
            fetchCommunityData();
        } else { showToast('error', data.error || 'אירעה שגיאה בניתוק מהקהילה'); }
    } catch (e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}

const familyOriginalSwitchTab = window.switchTab;
if (familyOriginalSwitchTab && !window.familySwitchTabOverridden) {
    window.switchTab = function(tabId) {
        familyOriginalSwitchTab(tabId);
        if (tabId === 'community') fetchCommunityData();
    };
    window.familySwitchTabOverridden = true;
}
// ============================================================
// --- פאנל מנהל קהילה ---
// ============================================================

async function openCommunityManagerPanel(commId) {
    try {
        const res = await fetch(`${API}/community/manager-data/${currentGroup.id}`);
        const data = await res.json();
        if (!data.success) return showToast('error', 'שגיאה בטעינת נתוני קהילה');

        const comm = data.managed_communities.find(c => c.community_id === commId);
        const wallet = data.wallets.find(w => w.community_id === commId) || { balance: 0, total_earned: 0 };
        const pending = (data.pending_businesses || []).filter(b => b.community_id === commId && b.status === 'comm_mgr_pending');
        const approved = (data.pending_businesses || []).filter(b => b.community_id === commId && b.status === 'approved');
        const pendingFamilies = (data.pending_families || []).filter(f => f.community_id === commId);
        const txs = (data.transactions || []).filter(t => t.community_id === commId).slice(0, 10);

        let modal = document.getElementById('comm-manager-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'comm-manager-modal';
            modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4';
            document.body.appendChild(modal);
        }

        const pendingFamiliesHtml = pendingFamilies.length ? pendingFamilies.map(f => `
            <div class="bg-blue-50 border border-blue-100 p-3 rounded-xl flex justify-between items-center mb-2">
                <div class="flex gap-2">
                    <button onclick="commMgrApproveFamily(${commId}, ${f.group_id})" class="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-600">אשר</button>
                    <button onclick="commMgrRejectFamily(${commId}, ${f.group_id})" class="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200">דחה</button>
                </div>
                <div class="text-right">
                    <p class="font-bold text-slate-800 text-sm">${safeStr(f.family_name)}</p>
                    <p class="text-[10px] text-slate-400">${new Date(f.joined_at).toLocaleDateString('he-IL')}</p>
                </div>
            </div>`).join('') : '<p class="text-slate-400 text-sm text-center py-3">אין בקשות ממתינות</p>';

        const pendingHtml = pending.length ? pending.map(b => `
            <div class="bg-orange-50 border border-orange-100 p-3 rounded-xl flex justify-between items-center mb-2">
                <div class="flex gap-2">
                    <button onclick="saApproveBizFromManager(${b.community_id}, ${b.business_id})" class="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-600">אשר</button>
                    <button onclick="saRejectBizFromManager(${b.community_id}, ${b.business_id})" class="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200">דחה</button>
                </div>
                <div class="text-right">
                    <p class="font-bold text-slate-800 text-sm">${safeStr(b.business_name)}</p>
                    <p class="text-[10px] text-slate-500">הנחה מוצעת: ${b.discount_pct}%</p>
                </div>
            </div>`).join('') : '<p class="text-slate-400 text-sm text-center py-4">אין בקשות ממתינות</p>';

        const approvedHtml = approved.length ? approved.map(b => `
            <div class="bg-white border border-slate-100 p-3 rounded-xl flex justify-between items-center mb-2">
                <span class="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">${b.discount_pct}% הנחה</span>
                <span class="font-bold text-slate-700 text-sm">${safeStr(b.business_name)}</span>
            </div>`).join('') : '<p class="text-slate-400 text-sm text-center py-2">אין עסקים פעילים</p>';

        const txHtml = txs.length ? txs.map(t => `
            <div class="flex justify-between items-center border-b border-slate-50 py-2">
                <span class="text-emerald-600 font-bold text-sm">+₪${parseFloat(t.amount).toFixed(2)}</span>
                <div class="text-right">
                    <p class="text-xs text-slate-700">${safeStr(t.description || '')}</p>
                    <p class="text-[10px] text-slate-400">${new Date(t.created_at).toLocaleDateString('he-IL')}</p>
                </div>
            </div>`).join('') : '<p class="text-slate-400 text-sm text-center py-4">אין תנועות עדיין</p>';

        modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto modal-scroll relative" dir="rtl">
            <button onclick="document.getElementById('comm-manager-modal').remove()" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="text-xl font-bold mb-1 text-slate-800"><i class="fa-solid fa-star text-purple-500 mr-2"></i> ניהול קהילה</h3>
            <p class="text-sm text-slate-500 mb-5">${safeStr(comm?.community_name || '')}</p>

            <!-- ארנק -->
            <div class="bg-gradient-to-l from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 mb-5">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[10px] text-amber-600 font-bold">סה"כ נצבר</p>
                        <p class="text-2xl font-black text-amber-800">₪${parseFloat(wallet.total_earned).toFixed(2)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-amber-600 font-bold"><i class="fa-solid fa-wallet mr-1"></i> ארנק קהילה</p>
                        <p class="text-3xl font-black text-amber-700">₪${parseFloat(wallet.balance).toFixed(2)}</p>
                        <p class="text-[10px] text-amber-500">יתרה זמינה</p>
                    </div>
                </div>
            </div>

            <!-- בקשות משפחות ממתינות -->
            ${pendingFamilies.length ? `<div class="mb-5 bg-blue-50 rounded-2xl p-4 border border-blue-100">
                <h4 class="font-bold text-blue-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-users text-blue-500"></i> משפחות ממתינות לאישור (${pendingFamilies.length})</h4>
                ${pendingFamiliesHtml}
            </div>` : ''}

            <!-- אישורי עסקים -->
            <div class="mb-5">
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-store text-orange-500"></i> בקשות עסקים ממתינות</h4>
                ${pendingHtml}
            </div>

            <!-- שותפים -->
            <div class="mb-5">
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-handshake text-blue-500"></i> עסקים פעילים בקהילה</h4>
                ${approvedHtml}
            </div>

            <!-- הודעות ממנהל האזור -->
            <div class="mb-5">
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-inbox text-indigo-500"></i> הודעות ממנהל האזור</h4>
                <button onclick="openCommunityManagerInbox(${commId})" class="w-full py-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm hover:bg-indigo-100 transition">
                    <i class="fa-solid fa-inbox mr-2"></i>פתח תיבת הודעות
                </button>
            </div>

            <!-- פרסום תוכן -->
            <div class="mb-5">
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-newspaper text-indigo-500"></i> פרסום תוכן לקהילה</h4>
                <div class="space-y-2">
                    <input type="text" id="cm-article-title-${commId}" placeholder="כותרת המאמר *" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-slate-50">
                    <textarea id="cm-article-body-${commId}" rows="3" placeholder="תוכן המאמר *" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-slate-50 resize-none"></textarea>
                    <input type="url" id="cm-article-image-${commId}" placeholder="קישור תמונה (אופציונלי)" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-slate-50">
                    <button onclick="cmPublishArticle(${commId})" class="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition text-sm"><i class="fa-solid fa-paper-plane ml-1"></i>פרסם מאמר</button>
                </div>
                <div id="cm-articles-${commId}" class="mt-3 space-y-2"></div>
            </div>

            <!-- תנועות ארנק -->
            <div>
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-clock-rotate-left text-emerald-500"></i> היסטוריית קאשבק</h4>
                ${txHtml}
            </div>
        </div>`;
        modal.classList.remove('hidden');
    } catch(e) { showToast('error', 'שגיאה בטעינת פאנל קהילה'); }
}

async function cmPublishArticle(commId) {
    const title = document.getElementById(`cm-article-title-${commId}`)?.value.trim();
    const body = document.getElementById(`cm-article-body-${commId}`)?.value.trim();
    const image_url = document.getElementById(`cm-article-image-${commId}`)?.value.trim() || null;
    if (!title || !body) { showToast('error', 'כותרת ותוכן הם שדות חובה'); return; }
    try {
        const r = await fetch(`${API}/community/manager/articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
            body: JSON.stringify({ community_id: commId, title, body, image_url, group_id: currentGroup?.id })
        });
        const d = await r.json();
        if (d.article) {
            showToast('success', 'המאמר פורסם בהצלחה!');
            document.getElementById(`cm-article-title-${commId}`).value = '';
            document.getElementById(`cm-article-body-${commId}`).value = '';
            document.getElementById(`cm-article-image-${commId}`).value = '';
            const list = document.getElementById(`cm-articles-${commId}`);
            if (list) {
                const div = document.createElement('div');
                div.className = 'bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 text-sm font-bold text-indigo-800';
                div.textContent = `✓ "${title}" פורסם`;
                list.prepend(div);
            }
        } else { showToast('error', d.error || 'שגיאה בפרסום'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function saApproveBizFromManager(communityId, businessId) {
    try {
        const res = await fetch(`${API}/sa/community-business/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'העסק אושר!'); document.getElementById('comm-manager-modal')?.remove(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function saRejectBizFromManager(communityId, businessId) {
    try {
        const res = await fetch(`${API}/sa/community-business/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'הבקשה נדחתה'); document.getElementById('comm-manager-modal')?.remove(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

// ── הזמן עסק לקהילה (מצד משפחה) ────────────────────────────
window.openInviteBizModal = function(commId, commName) {
    const existing = document.getElementById('invite-biz-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'invite-biz-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center';
    modal.innerHTML = `
    <div class="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8" dir="rtl">
        <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-slate-800">🏪 הזמן עסק לקהילת ${safeStr(commName)}</h3>
            <button onclick="document.getElementById('invite-biz-modal').remove()" class="text-slate-400 text-xl">&times;</button>
        </div>
        <div class="flex gap-2 mb-3">
            <input id="invite-biz-search" type="text" placeholder="חפש לפי שם עסק או קוד..." class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" oninput="_inviteBizSearchDebounce(this.value, ${commId})">
            <button onclick="_searchBizForInvite(getEl('invite-biz-search').value, ${commId})" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold">חפש</button>
        </div>
        <div id="invite-biz-results" class="space-y-2 max-h-64 overflow-y-auto"></div>
    </div>`;
    document.body.appendChild(modal);
};

let _inviteBizSearchTimer = null;
window._inviteBizSearchDebounce = function(val, commId) {
    clearTimeout(_inviteBizSearchTimer);
    _inviteBizSearchTimer = setTimeout(() => _searchBizForInvite(val, commId), 350);
};

window._searchBizForInvite = async function(q, commId) {
    const el = getEl('invite-biz-results');
    if (!el || !q.trim()) return;
    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">טוען...</p>';
    try {
        const res = await fetch(`${API}/community/search-business?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!data.businesses.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">לא נמצאו עסקים</p>'; return; }
        el.innerHTML = data.businesses.map(b => `
            <div class="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <button onclick="sendBizInvite(${commId}, ${b.id})" class="bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-600">הזמן</button>
                <div class="text-right">
                    <p class="font-bold text-slate-800 text-sm">${safeStr(b.name)}</p>
                    <p class="text-[10px] text-slate-400 font-mono">${safeStr(b.group_code)}</p>
                </div>
            </div>`).join('');
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-xs text-center py-3">שגיאה בחיפוש</p>'; }
};

window.sendBizInvite = async function(commId, bizId) {
    try {
        const res = await fetch(`${API}/community/invite-business`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, communityId: commId, businessId: bizId })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'ההזמנה נשלחה לעסק!'); document.getElementById('invite-biz-modal')?.remove(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
};

window.commMgrApproveFamily = async function(communityId, targetGroupId) {
    try {
        const res = await fetch(`${API}/community/manager/family/approve`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, communityId, targetGroupId }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'המשפחה אושרה'); openCommunityManagerPanel(communityId); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
};

window.commMgrRejectFamily = async function(communityId, targetGroupId) {
    try {
        const res = await fetch(`${API}/community/manager/family/reject`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ groupId: currentGroup.id, communityId, targetGroupId }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'הבקשה נדחתה'); openCommunityManagerPanel(communityId); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
};

// ============================================================
// --- COMMUNITY MANAGER INBOX ---
// ============================================================

let cmInboxCurrentThreadId = null;
let cmInboxCurrentCommunityId = null;

async function openCommunityManagerInbox(communityId) {
    cmInboxCurrentCommunityId = communityId;
    cmInboxCurrentThreadId = null;
    let modal = document.getElementById('cm-inbox-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cm-inbox-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9995] flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
    <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" dir="rtl" style="font-family:'Rubik',sans-serif">
        <div class="p-5 border-b border-slate-100 flex justify-between items-center">
            <button onclick="document.getElementById('cm-inbox-modal').remove()" class="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="font-black text-slate-800"><i class="fa-solid fa-inbox text-indigo-500 mr-2"></i>הודעות ממנהל האזור</h3>
        </div>
        <div id="cm-inbox-view" class="flex-1 overflow-y-auto p-4">
            <div class="text-center text-slate-400 py-6">טוען...</div>
        </div>
        <div id="cm-inbox-reply-bar" class="hidden p-4 border-t border-slate-100 space-y-2">
            <div class="flex gap-2">
                <button onclick="sendCMReply()" class="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-600 transition whitespace-nowrap">שלח</button>
                <textarea id="cm-reply-input" class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" rows="2" placeholder="כתוב תשובה..."></textarea>
            </div>
            <button onclick="showCMThreadList()" class="text-xs text-slate-400 hover:text-slate-600 font-bold">← חזרה לרשימה</button>
        </div>
        <div class="p-4 border-t border-slate-100 flex gap-2" id="cm-inbox-footer">
            <button onclick="openCMNewThread()" class="flex-1 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition">
                <i class="fa-solid fa-pen mr-1.5"></i>שלח הודעה למנהל האזור
            </button>
        </div>
    </div>`;
    modal.classList.remove('hidden');
    showCMThreadList();
}

async function showCMThreadList() {
    cmInboxCurrentThreadId = null;
    document.getElementById('cm-inbox-reply-bar').classList.add('hidden');
    document.getElementById('cm-inbox-footer').classList.remove('hidden');
    const view = document.getElementById('cm-inbox-view');
    view.innerHTML = '<div class="text-center text-slate-400 py-4">טוען...</div>';
    try {
        const res = await fetch(`${API}/community/inbox/${currentGroup.id}`);
        const data = await res.json();
        const threads = data.threads || [];
        if (!threads.length) {
            view.innerHTML = '<div class="text-center text-slate-400 py-10"><i class="fa-solid fa-inbox text-4xl text-slate-200 mb-3 block"></i>אין הודעות עדיין</div>';
            return;
        }
        view.innerHTML = threads.map(t => {
            const unread = parseInt(t.unread_count || 0);
            return `
            <div class="flex items-center gap-3 rounded-2xl px-4 py-3.5 border mb-2 cursor-pointer hover:shadow-sm transition ${unread > 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}" onclick="openCMThread(${t.id})">
                <div class="w-9 h-9 rounded-xl ${unread > 0 ? 'bg-indigo-200' : 'bg-slate-200'} flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid fa-comment-dots ${unread > 0 ? 'text-indigo-600' : 'text-slate-500'} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0 text-right">
                    <div class="flex justify-between">
                        <span class="text-[10px] text-slate-400">${new Date(t.last_message_at).toLocaleDateString('he-IL')}</span>
                        <p class="font-bold text-slate-700 text-sm truncate">${t.zone_manager_name || '—'}</p>
                    </div>
                    <p class="text-xs text-slate-500 truncate">${t.last_message || ''}</p>
                </div>
                ${unread > 0 ? `<span class="bg-indigo-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">${unread}</span>` : ''}
            </div>`;
        }).join('');
    } catch(e) { view.innerHTML = '<div class="text-red-400 text-center py-4">שגיאת תקשורת</div>'; }
}

async function openCMThread(threadId) {
    cmInboxCurrentThreadId = threadId;
    const view = document.getElementById('cm-inbox-view');
    view.innerHTML = '<div class="text-center text-slate-400 py-4">טוען...</div>';
    document.getElementById('cm-inbox-reply-bar').classList.remove('hidden');
    document.getElementById('cm-inbox-footer').classList.add('hidden');
    document.getElementById('cm-reply-input').value = '';
    try {
        const res = await fetch(`${API}/community/inbox/thread/${threadId}/${currentGroup.id}`);
        const data = await res.json();
        if (!data.success) { view.innerHTML = '<div class="text-red-400 text-center py-4">שגיאה</div>'; return; }
        view.innerHTML = `
            <p class="text-xs font-bold text-slate-400 text-center mb-3">${data.thread.subject || ''} · ${data.thread.zone_manager_name || ''}</p>
            <div class="space-y-3">
                ${(data.messages || []).map(m => {
                    const isCommunity = m.sender_type === 'community';
                    return `<div class="flex ${isCommunity ? 'justify-start' : 'justify-end'}">
                        <div class="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${isCommunity ? 'bg-slate-200 text-slate-700 rounded-bl-sm' : 'bg-indigo-500 text-white rounded-br-sm'}">
                            <p>${m.content}</p>
                            <p class="text-[10px] mt-1 ${isCommunity ? 'text-slate-400' : 'text-indigo-200'} text-left">${new Date(m.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</p>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        view.scrollTop = view.scrollHeight;
    } catch(e) { view.innerHTML = '<div class="text-red-400 text-center py-4">שגיאת תקשורת</div>'; }
}

async function sendCMReply() {
    const content = document.getElementById('cm-reply-input').value.trim();
    if (!content || !cmInboxCurrentThreadId) return;
    document.getElementById('cm-reply-input').value = '';
    try {
        const res = await fetch(`${API}/community/inbox/thread/${cmInboxCurrentThreadId}/reply`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, content })
        });
        const data = await res.json();
        if (data.success) openCMThread(cmInboxCurrentThreadId);
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function openCMNewThread() {
    const communityId = cmInboxCurrentCommunityId;
    if (!communityId) { showToast('error', 'שגיאה בזיהוי הקהילה'); return; }
    let modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4" dir="rtl" style="font-family:'Rubik',sans-serif">
        <div class="flex justify-between items-center">
            <button onclick="this.closest('.fixed').remove()" class="text-slate-400 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="font-black text-slate-800">שלח הודעה למנהל האזור</h3>
        </div>
        <div>
            <label class="text-xs font-bold text-slate-500 block mb-1.5">נושא</label>
            <input type="text" id="cm-new-subject" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" placeholder="נושא ההודעה">
        </div>
        <div>
            <label class="text-xs font-bold text-slate-500 block mb-1.5">הודעה</label>
            <textarea id="cm-new-content" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" rows="4" placeholder="כתוב את הודעתך..."></textarea>
        </div>
        <p id="cm-new-err" class="text-red-500 text-xs text-center hidden"></p>
        <div class="flex gap-2">
            <button onclick="this.closest('.fixed').remove()" class="flex-1 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition">ביטול</button>
            <button onclick="submitCMNewThread(${communityId}, this)" class="flex-1 py-2 text-sm font-bold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition">שלח</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

async function submitCMNewThread(communityId, btn) {
    const subject = document.getElementById('cm-new-subject').value.trim();
    const content = document.getElementById('cm-new-content').value.trim();
    const err = document.getElementById('cm-new-err');
    err.classList.add('hidden');
    if (!content) { err.textContent = 'תוכן ההודעה חובה'; err.classList.remove('hidden'); return; }
    btn.disabled = true; btn.textContent = 'שולח...';
    try {
        const res = await fetch(`${API}/community/inbox/new`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, communityId, subject, content })
        });
        const data = await res.json();
        if (data.success) {
            btn.closest('.fixed').remove();
            showCMThreadList();
        } else { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'שלח'; }
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'שלח'; }
}

// ============================================================
// --- ניהול קהילות דרך ממשק אדמין ראשי (Super Admin) ---
// ============================================================

let saCommunitiesCache = [];
let saBusinessesCache = [];
let saBizConnectionsCache = []; // שומר את כל החיבורים בין עסק לקהילה
let currentCommFamiliesCache = []; 

// מנגנון תגיות ערים
let createCityTags = [];
let editCityTags = [];


function addCityTag(type) {
    const input = getEl(type === 'create' ? 'sa-comm-city-input' : 'sa-edit-comm-city-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    if (!tagsArr.includes(val)) {
        tagsArr.push(val);
        updateCityTagsDisplay(type);
    }
    input.value = '';
}

// המרת תמונה לקהילה





function selectSmartBiz(id, name) {
    getEl('sa-link-biz').value = id;
    getEl('sa-smart-biz-search').value = '';
    getEl('sa-smart-biz-search').classList.add('hidden');
    getEl('sa-smart-biz-results').classList.add('hidden');
    
    const display = getEl('sa-selected-biz-display');
    display.querySelector('span').innerText = `עסק נבחר: ${name}`;
    display.classList.remove('hidden');
}

function clearSmartBizSelection() {
    getEl('sa-link-biz').value = '';
    getEl('sa-selected-biz-display').classList.add('hidden');
    const searchInput = getEl('sa-smart-biz-search');
    searchInput.classList.remove('hidden');
    searchInput.focus();
}

// -- טיפול בבקשות ממתינות --
async function loadSAPendingRequests() {
    const container = getEl('sa-pending-biz-container');
    const list = getEl('sa-pending-biz-list');
    if(!container || !list) return;

    try {
        const res = await fetch(`${API}/sa/communities/pending-businesses`);
        const data = await res.json();
        
        if (data.success && data.pending && data.pending.length > 0) {
            container.classList.remove('hidden');
            list.innerHTML = data.pending.map(p => `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex justify-between items-center hover:shadow-md transition mb-2">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">העסק: ${safeStr(p.biz_name)}</h4>
                        <p class="text-xs text-slate-500 mt-0.5">מבקש להצטרף לקהילת: <strong>${safeStr(p.comm_name)}</strong></p>
                        <p class="text-[11px] text-green-700 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded-full inline-block border border-green-200">מוכן לתת ${p.discount_pct}% הנחה לחברי הקהילה</p>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button onclick="approveSABizRequest(${p.community_id}, ${p.business_id})" class="bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition shadow-sm border border-slate-700"><i class="fa-solid fa-check mr-1"></i> אשר וצרף</button>
                        <button onclick="rejectSABizRequest(${p.community_id}, ${p.business_id})" class="bg-red-50 text-red-600 px-5 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition shadow-sm border border-red-100"><i class="fa-solid fa-xmark mr-1"></i> דחה בקשה</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.classList.add('hidden');
        }
    } catch(e) { console.error('Error loading pending requests', e); }
}

async function approveSABizRequest(communityId, businessId) {
    if(!confirm('האם לאשר את הצטרפות העסק לקהילה? הלקוחות יראו אותו מיד.')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        if((await res.json()).success) { showToast('success', 'העסק אושר וצורף לקהילה!'); loadSACommunityData(); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function rejectSABizRequest(communityId, businessId) {
    if(!confirm('האם לדחות ולהסיר את הבקשה של העסק?')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        if((await res.json()).success) { showToast('info', 'הבקשה נדחתה והוסרה מהרשימה.'); loadSACommunityData(); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

// -- טבלת קהילות כולל עיר --
function renderSACommunitiesTable() {
    const tbody = getEl('sa-communities-table-body');
    if (!tbody) return;
    
    const query = getEl('sa-search-comm') ? getEl('sa-search-comm').value.toLowerCase() : '';
    const countFilter = getEl('sa-filter-comm-count') ? getEl('sa-filter-comm-count').value : 'all';
    const multiFilter = getEl('sa-filter-comm-multi') ? getEl('sa-filter-comm-multi').checked : false; 
    
    let filtered = [...saCommunitiesCache];
    
    if (query) {
        filtered = filtered.filter(c => 
            (c.name && c.name.toLowerCase().includes(query)) || 
            (c.code && c.code.toLowerCase().includes(query)) ||
            (c.city && c.city.toLowerCase().includes(query))
        );
    }
    
    if (countFilter === 'with_families') {
        filtered = filtered.filter(c => parseInt(c.family_count || 0) > 0);
    } else if (countFilter === 'empty') {
        filtered = filtered.filter(c => parseInt(c.family_count || 0) === 0);
    } else if (countFilter === 'sort_desc') {
        filtered.sort((a, b) => parseInt(b.family_count || 0) - parseInt(a.family_count || 0));
    }

    if (multiFilter) {
        filtered = filtered.filter(c => c.city && c.city.split(',').filter(x => x.trim()).length >= 2);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">לא נמצאו קהילות שמתאימות לסינון.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map(c => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right flex items-center gap-3">
                ${c.image_url ? `<img src="${c.image_url}" class="w-8 h-8 rounded-lg object-cover shadow-sm shrink-0">` : `<div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><i class="fa-solid fa-users"></i></div>`}
                <div>
                    ${safeStr(c.name || 'ללא שם')}
                    <div class="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1 max-w-[200px] overflow-hidden">
                        ${(c.city || 'לא הוגדר').split(',').map(city => `<span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><i class="fa-solid fa-location-dot text-orange-400"></i> ${city.trim()}</span>`).join('')}
                    </div>
                </div>
            </td>
            <td class="px-4 py-4 font-mono text-orange-600 font-bold tracking-widest text-right">${safeStr(c.code || '---')}</td>
            <td class="px-4 py-4 text-right">
                <div class="text-xs text-slate-600 mb-1"><span class="text-slate-400 font-bold ml-1">מייל:</span> ${safeStr(c.manager_email || '---')}</div>
                <div class="text-xs text-slate-600"><span class="text-slate-400 font-bold ml-1">סיסמה:</span> ${safeStr(c.manager_password || '---')}</div>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold text-xs" title="משפחות מחוברות"><i class="fa-solid fa-house text-[10px]"></i> ${c.family_count || 0} משפחות</span>
                <span class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-bold text-xs ml-1" title="נפשות / משתמשים"><i class="fa-solid fa-user text-[10px]"></i> ${c.users_count || 0} משתמשים</span>
                <span class="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-bold text-xs ml-1" title="עסקים"><i class="fa-solid fa-briefcase text-[10px]"></i> ${c.business_count || 0}</span>
            </td>
            <td class="px-4 py-4 text-center">
                <button onclick="openSACommunityModal(${c.id})" class="bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-gear"></i> מחיקה וניהול</button>
            </td>
        </tr>
    `).join('');
}

function filterSACommunities() { renderSACommunitiesTable(); }


function renderSACommFamilies(query = '') {
    const famList = getEl('sa-edit-comm-families');
    if (!famList) return;
    
    let filtered = currentCommFamiliesCache;
    if (query) {
        const q = query.toLowerCase();
        filtered = currentCommFamiliesCache.filter(f => 
            (f.name && f.name.toLowerCase().includes(q)) || 
            (f.group_code && f.group_code.toLowerCase().includes(q))
        );
    }
    
    if (filtered.length === 0) {
        famList.innerHTML = `<p class="text-xs text-slate-400 p-2 bg-slate-50 border border-dashed rounded-lg text-center mt-2">${query ? 'לא נמצאו משפחות תואמות לחיפוש' : 'אין משפחות מחוברות לקהילה זו.'}</p>`;
        return;
    }
    
    famList.innerHTML = filtered.map(f => {
        const usersHtml = f.users && f.users.length > 0
            ? f.users.map(u => `<div class="text-[10px] text-slate-500 pl-2 pr-1 py-1.5 border-t border-slate-100 flex justify-between bg-slate-50/50 hover:bg-slate-100 transition"><span><i class="fa-solid ${u.role === 'ADMIN' ? 'fa-user-tie text-blue-400' : 'fa-user text-slate-400'} ml-1"></i> ${safeStr(u.nickname)}</span><span class="bg-white px-1.5 rounded shadow-sm">${u.role === 'ADMIN' ? 'מנהל/הורה' : 'חבר/ילד'}</span></div>`).join('')
            : '<div class="text-[10px] text-slate-400 pl-2 py-1.5 border-t border-slate-100 bg-slate-50/50">אין משתמשים פנימיים.</div>';

        const commId = getEl('sa-edit-comm-id') ? getEl('sa-edit-comm-id').value : '';
        const isManagerFamily = f.is_community_manager;
        return `
        <div class="bg-white rounded-lg border border-slate-200 mb-1.5 overflow-hidden shadow-sm">
            <div class="p-2.5 text-xs flex justify-between items-center cursor-pointer hover:bg-blue-50 transition group" onclick="document.getElementById('sa-comm-fam-${f.id}').classList.toggle('hidden')">
                <div class="flex items-center gap-2">
                    ${isManagerFamily ? '' : `<button onclick="event.stopPropagation();setSACommunityManager(${commId}, ${f.id}, true)" class="text-[9px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded hover:bg-purple-200 transition whitespace-nowrap">הגדר מנהל</button>`}
                    ${isManagerFamily ? `<button onclick="event.stopPropagation();setSACommunityManager(${commId}, ${f.id}, false)" class="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded hover:bg-red-100 hover:text-red-600 transition whitespace-nowrap">הסר מנהל</button>` : ''}
                </div>
                <div class="font-bold text-slate-700 flex items-center gap-2">
                    ${isManagerFamily ? '<i class="fa-solid fa-star text-purple-400 text-[10px]"></i>' : ''}
                    <i class="fa-solid fa-users text-slate-300 group-hover:text-blue-400 transition"></i> ${safeStr(f.name)}
                </div>
            </div>
            <div id="sa-comm-fam-${f.id}" class="hidden flex flex-col">
                ${usersHtml}
            </div>
        </div>`;
    }).join('');
}


async function loadCommunityBusinesses() {
    const communityId = val('sa-link-comm');
    const list = getEl('sa-comm-biz-list');
    if(!communityId) { list.innerHTML = 'יש לבחור קהילה ממעל'; return; }
    
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-2"><i class="fa-solid fa-spinner fa-spin"></i> טוען עסקים...</p>';
    try {
        const res = await fetch(`${API}/sa/community-business/${communityId}`);
        const data = await res.json();
        if(data.success) {
            if(data.connections.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">אין עסקים שנותנים הנחות לקהילה זו.</p>'; return; }
            list.innerHTML = data.connections.map(c => `
                <div class="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                    <span class="text-xs font-bold text-slate-700">${safeStr(c.business_name)} <span class="text-green-700 bg-green-100 px-1.5 py-0.5 rounded ml-1 text-[10px]">${c.discount_pct}% הנחה</span><span class="text-slate-400 text-[10px] pr-2">(${c.status === 'approved' ? 'אושר' : 'ממתין'})</span></span>
                    <button onclick="removeBizFromCommunity(${c.community_id}, ${c.business_id})" class="text-slate-400 hover:text-red-500 w-6 h-6 flex items-center justify-center transition bg-slate-50 rounded"><i class="fa-solid fa-times"></i></button>
                </div>
            `).join('');
        }
    } catch(e) { list.innerHTML = '<p class="text-xs text-red-400 text-center py-2">שגיאה בטעינת עסקים</p>'; }
}

async function removeBizFromCommunity(commId, bizId) {
    if(!confirm('להסיר את העסק מהקהילה? הלקוחות לא יקבלו יותר את ההנחה של העסק הזה.')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/${commId}/${bizId}`, {method:'DELETE'});
        if((await res.json()).success) { showToast('success', 'העסק הוסר מהקהילה.'); loadCommunityBusinesses(); loadSACommunityData(); }
    } catch(e) {}
}

// -- ניהול עסקים כולל (דרישה 5) --
function renderSABusinessesTable() {
    const tbody = getEl('sa-businesses-table-body');
    if (!tbody) return;

    const query = getEl('sa-search-businesses') ? getEl('sa-search-businesses').value.toLowerCase() : '';
    let filtered = [...saBusinessesCache];
    
    if (query) {
        filtered = filtered.filter(b => 
            (b.name && b.name.toLowerCase().includes(query)) || 
            (b.group_code && b.group_code.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-slate-400">לא נמצאו עסקים.</td></tr>`;
        return;
    }

    // מאחר ואין לנו Endpoint שמחזיר את כל החיבורים יחד, נצטרך לעשות Fetch פר עסק בעת פתיחת המודאל.
    // בטבלה נציג נתונים כלליים ונגישות לחלון הניהול
    tbody.innerHTML = filtered.map(b => `
        <tr class="hover:bg-emerald-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right">
                ${safeStr(b.name)}
                <div class="text-[10px] text-slate-500 mt-1 font-mono">קוד: ${safeStr(b.group_code)}</div>
            </td>
            <td class="px-4 py-4 text-right">
                <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">עסק רשום</span>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold text-xs" title="חיבורים מנוהלים פנימה"><i class="fa-solid fa-link"></i> בדיקה בניהול</span>
            </td>
            <td class="px-4 py-4 text-center">
                <button onclick="openSABusinessModal(${b.id})" class="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-gear"></i> ניהול חיבורים</button>
            </td>
        </tr>
    `).join('');
}

function filterSABusinessesTable() { renderSABusinessesTable(); }

async function openSABusinessModal(bizId) {
    const biz = saBusinessesCache.find(b => b.id == bizId);
    if (!biz) return;
    
    getEl('sa-edit-biz-title').innerText = biz.name;
    getEl('sa-edit-biz-code').innerText = biz.group_code;
    
    const list = getEl('sa-edit-biz-communities-list');
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> מנתח נתונים בשרת...</p>';
    
    getEl('sa-business-modal').classList.remove('hidden');

    try {
        // מכיוון שאנחנו כאדמין ראשי, יש לנו גישה לנתיב החיבורים של העסק (Biz App route)
        const res = await fetch(`${API}/biz/communities/my/${bizId}`);
        const data = await res.json();
        
        if (data.success && data.communities) {
            if (data.communities.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4 bg-white rounded-lg border border-dashed">העסק לא מחובר לאף קהילה כרגע.</p>';
            } else {
                list.innerHTML = data.communities.map(c => `
                    <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center mb-2">
                        <div>
                            <span class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</span>
                            <p class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-house"></i> ${c.families_count || 0} משפחות | <span class="font-bold text-green-600">${c.discount_pct}% הנחה</span></p>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <span class="text-[10px] ${c.status === 'approved' ? 'text-green-600 bg-green-50' : 'text-orange-500 bg-orange-50'} px-2 py-0.5 rounded font-bold">${c.status === 'approved' ? 'מחובר ופעיל' : 'ממתין לאישור'}</span>
                            <button onclick="removeBizFromCommunityInModal(${c.id}, ${bizId})" class="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition"><i class="fa-solid fa-trash"></i> נתק עסק</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch(e) {
        list.innerHTML = '<p class="text-xs text-red-500 text-center py-4">שגיאה בטעינת נתונים</p>';
    }
}

async function removeBizFromCommunityInModal(commId, bizId) {
    if(!confirm('להסיר את העסק מהקהילה? הלקוחות לא יראו יותר את ההנחה.')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/${commId}/${bizId}`, {method:'DELETE'});
        if((await res.json()).success) { 
            showToast('success', 'העסק נותק מהקהילה בהצלחה.'); 
            openSABusinessModal(bizId); // טעינה מחדש של החלון
            loadSACommunityData(); // רענון נתוני הרקע
        }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

const originalLoadSADashboard = window.loadSADashboard;
if(originalLoadSADashboard && !window.saCommLoaded) {
    window.loadSADashboard = async function() {
        const userDash = document.getElementById('dashboard-container');
        if (userDash) userDash.classList.add('hidden');
        
        await originalLoadSADashboard();
        loadSACommunityData();
        
        setTimeout(() => {
            if (userDash) userDash.classList.add('hidden');
        }, 100);
    };
window.saCommLoaded = true;
}

// ==========================================
// --- ONBOARDING WIZARD (אשף הקמה למשפחה) ---
// ==========================================
let currentWizardStep = 1;
let wizardProducts = [];

function showOnboardingWizard() {
    if (document.getElementById('onboarding-wizard-modal')) {
        document.getElementById('onboarding-wizard-modal').classList.remove('hidden');
        return;
    }

    const modalHtml = `
    <div id="onboarding-wizard-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-2 sm:p-4">
        <div class="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
            
            <div class="w-full bg-slate-100 h-1.5 shrink-0">
                <div id="wizard-progress" class="bg-indigo-600 h-1.5 transition-all duration-500" style="width: 25%;"></div>
            </div>

            <div class="bg-indigo-50 p-4 sm:p-6 text-center border-b border-indigo-100 shrink-0">
                <h2 class="text-xl sm:text-2xl font-black text-indigo-900 mb-1">ברוכים הבאים ל-Oneflow Life! 🎉</h2>
                <p class="text-indigo-600 text-xs sm:text-sm font-bold">בואו נקים את הבנק המשפחתי ב-4 צעדים קלילים</p>
            </div>

            <div class="flex-1 overflow-y-auto modal-scroll p-4 sm:p-6 bg-slate-50/50">
                <div id="wizard-step-1" class="fade-in max-w-md mx-auto">
                    <h3 class="font-bold text-slate-800 text-lg mb-4 text-center"><i class="fa-solid fa-house-chimney text-indigo-500"></i> המשפחה שלנו</h3>
                    <div class="space-y-4">
                        <div class="flex flex-col items-center justify-center mb-6">
                            <label class="text-xs font-bold text-slate-500 mb-2">תמונה משפחתית (אופציונלי):</label>
                            <div class="relative w-24 h-24 bg-white rounded-full border-2 border-dashed border-indigo-200 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition shadow-sm overflow-hidden" onclick="document.getElementById('wizard-logo-upload').click()">
                                <img id="wizard-logo-preview" class="w-full h-full object-cover hidden">
                                <i id="wizard-logo-icon" class="fa-solid fa-camera text-2xl text-indigo-300"></i>
                            </div>
                            <input type="file" id="wizard-logo-upload" accept="image/*" class="hidden" onchange="handleWizardLogo(event)">
                            <input type="hidden" id="wizard-logo-base64">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-500 block mb-1">משפט מפתח / מוטו משפחתי:</label>
                            <input type="text" id="wizard-slogan" class="modern-input py-3 w-full bg-white" placeholder="משפחה שכזאת / המשפחה הכי טובה בעולם">
                        </div>
                    </div>
                </div>

                <div id="wizard-step-2" class="hidden fade-in max-w-md mx-auto">
                    <h3 class="font-bold text-slate-800 text-lg mb-4 text-center"><i class="fa-solid fa-piggy-bank text-indigo-500"></i> תקציב חודשי</h3>
                    <p class="text-xs text-slate-500 text-center mb-6">הגדירו מהו התקציב הפנוי או ההכנסה המשותפת שתרצו לנהל ולעקוב אחריה החודש באפליקציה.</p>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <label class="text-sm font-bold text-slate-700 block mb-2">התקציב החודשי (₪):</label>
                        <input type="number" id="wizard-initial-budget" class="modern-input py-4 text-2xl font-black text-center dir-ltr text-indigo-600 bg-indigo-50/30" placeholder="0" value="0">
                        <p class="text-[10px] text-slate-400 mt-3">* אל דאגה, תוכלו לשנות או לאפס את זה בכל רגע.</p>
                    </div>
                </div>

                <div id="wizard-step-3" class="hidden fade-in max-w-xl mx-auto">
                    <h3 class="font-bold text-slate-800 text-lg mb-2 text-center"><i class="fa-solid fa-boxes-stacked text-indigo-500"></i> בניית המזווה המשפחתי</h3>
                    <p class="text-xs text-slate-500 text-center mb-4">נוסיף עכשיו את המוצרים שתמיד צריכים להיות בבית. אפשר לתת ל-AI שלנו לנחש בשבילכם!</p>
                    
                    <div class="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-6">
                        <label class="text-xs font-bold text-indigo-800 block mb-2">✨ מילוי מזווה אוטומטי ב-AI</label>
                        <div class="flex gap-2">
                            <input type="text" id="wizard-ai-prompt" class="modern-input py-2.5 text-sm flex-1 bg-white" placeholder="תארו אתכם (למשל: משפחה טבעונית, או משפחה עם תינוק)">
                            <button id="btn-wizard-ai" onclick="generateWizardCatalog()" class="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm text-sm shrink-0">מלא מזווה</button>
                        </div>
                    </div>

                    <div class="bg-white border border-slate-200 p-4 rounded-2xl mb-4 shadow-sm">
                        <label class="text-xs font-bold text-slate-700 block mb-2">✍️ הוספה ידנית</label>
                        <div class="flex gap-2">
                            <input type="text" id="wiz-add-name" placeholder="שם מוצר (חלב 3%)" class="modern-input py-2 text-xs flex-1">
                            <input type="text" id="wiz-add-cat" placeholder="קטגוריה" class="modern-input py-2 text-xs w-24 shrink-0">
                            <button onclick="addWizardProduct()" class="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 transition text-xs shrink-0">הוסף</button>
                        </div>
                    </div>

                    <div class="flex justify-between items-center mb-2 px-1">
                        <h4 class="font-bold text-slate-700 text-sm">מוצרים במזווה (<span id="wiz-prod-count">0</span>/25):</h4>
                        <button onclick="wizardProducts=[]; renderWizardProducts();" class="text-xs text-red-500 hover:underline font-bold">נקה הכל</button>
                    </div>
                    <div id="wizard-products-list" class="space-y-2 max-h-48 overflow-y-auto modal-scroll pr-1">
                        <p class="text-xs text-slate-400 text-center py-4">אין מוצרים במזווה עדיין.</p>
                    </div>
                </div>

                <div id="wizard-step-4" class="hidden fade-in text-center max-w-md mx-auto pt-4">
                    <div class="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-4xl mb-4 shadow-sm border border-green-200 mx-auto">
                        <i class="fa-brands fa-whatsapp"></i>
                    </div>
                    <h3 class="font-bold text-slate-800 text-xl mb-2">מזמינים את המשפחה</h3>
                    <p class="text-sm text-slate-500 mb-8">הסביבה מוכנה! שלחו עכשיו הזמנה לשאר בני הבית כדי שיתחילו לקבל דמי כיס ולעזור במשימות.</p>
                    
                    <button onclick="sendWhatsAppInvite('MEMBER')" class="w-full bg-[#25D366] text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-[#1ebd58] transition flex items-center justify-center gap-2 mb-3">
                        <i class="fa-brands fa-whatsapp text-lg"></i> הזמנת ילד/ה בוואטסאפ
                    </button>
                    <button onclick="sendWhatsAppInvite('ADMIN')" class="w-full bg-slate-100 text-slate-700 py-3.5 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2 mb-3">
                        <i class="fa-solid fa-user-tie text-slate-400"></i> הוספת הורה שותף
                    </button>
                </div>
            </div>

            <div class="p-4 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                <button id="wizard-btn-skip" onclick="skipWizardStep()" class="text-xs text-slate-400 font-bold hover:text-slate-600 transition underline px-2">דלג על שלב זה</button>
                <div class="flex gap-2">
                    <button id="wizard-btn-prev" onclick="prevWizardStep()" class="px-4 sm:px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition hidden">חזור</button>
                    <button id="wizard-btn-next" onclick="nextWizardStep()" class="px-6 sm:px-8 py-2.5 bg-slate-800 text-white font-bold rounded-xl shadow-md hover:bg-slate-700 transition">המשך</button>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function handleWizardLogo(event) {
    const file = event.target.files[0]; if(!file) return;
    compressImage(file, 300, 300, 0.8, (base64) => {
        getEl('wizard-logo-preview').src = base64;
        getEl('wizard-logo-preview').classList.remove('hidden');
        getEl('wizard-logo-icon').classList.add('hidden');
        getEl('wizard-logo-base64').value = base64;
    });
}

function addWizardProduct() {
    if (wizardProducts.length >= 25) return showToast('error', 'ניתן להוסיף עד 25 מוצרים בבת אחת.');
    const name = val('wiz-add-name'); const cat = val('wiz-add-cat') || 'כללי';
    if (!name) return showToast('error', 'יש להזין שם מוצר');
    wizardProducts.push({ name, category: cat });
    getEl('wiz-add-name').value = ''; getEl('wiz-add-cat').value = '';
    renderWizardProducts();
}

function removeWizardProduct(idx) { wizardProducts.splice(idx, 1); renderWizardProducts(); }

function renderWizardProducts() {
    const list = getEl('wizard-products-list');
    getEl('wiz-prod-count').innerText = wizardProducts.length;
    if (wizardProducts.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">המזווה ריק.</p>'; return; }
    list.innerHTML = wizardProducts.map((p, idx) => `
        <div class="flex justify-between items-center bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
            <div class="flex-1 pr-2 overflow-hidden">
                <div class="font-bold text-slate-700 text-sm truncate">${safeStr(p.name)}</div>
                <div class="text-[10px] text-slate-400 truncate">${safeStr(p.category)}</div>
            </div>
            <button onclick="removeWizardProduct(${idx})" class="text-red-400 hover:text-red-600 w-6 h-6 flex items-center justify-center shrink-0"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
    `).join('');
}

async function generateWizardCatalog() {
    const prompt = val('wizard-ai-prompt');
    if(!prompt) return showToast('error', 'רשמו למשל: משפחה של 5 נפשות שומרת כשרות');
    const btn = getEl('btn-wizard-ai'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        const res = await fetch(`${API}/ai/generate-catalog`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ promptText: prompt, type: 'FAMILY', groupId: currentGroup.id })
        });
        const data = await res.json();
        if (data.success && data.items) {
            data.items.forEach(i => { if (wizardProducts.length < 25) wizardProducts.push(i); });
            renderWizardProducts(); showToast('success', 'המזווה התמלא!');
        } else { showToast('error', data.error || 'שגיאה ביצירת מזווה'); }
    } catch(e) { showToast('error', 'שגיאת רשת מול ה-AI'); }
    finally { btn.disabled = false; btn.innerText = 'מלא מזווה'; }
}

function updateWizardUI() {
    [1, 2, 3, 4].forEach(s => getEl(`wizard-step-${s}`).classList.add('hidden'));
    getEl(`wizard-step-${currentWizardStep}`).classList.remove('hidden');
    getEl('wizard-progress').style.width = `${(currentWizardStep / 4) * 100}%`;
    
    getEl('wizard-btn-prev').classList.toggle('hidden', currentWizardStep === 1);
    const btnNext = getEl('wizard-btn-next');
    if (currentWizardStep === 4) {
        btnNext.innerText = 'סיום והתחלת עבודה 🚀';
        btnNext.classList.remove('bg-slate-800'); btnNext.classList.add('bg-indigo-600');
    } else {
        btnNext.innerText = 'המשך';
        btnNext.classList.add('bg-slate-800'); btnNext.classList.remove('bg-indigo-600');
    }
}

async function nextWizardStep() {
    const btnNext = getEl('wizard-btn-next');
    
    if (currentWizardStep === 1) { // שמירת לוגו וסלוגן
        btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            // משתמש ב-Settings Store סתם כדי לשמור את התמונה והסלוגן המשפחתי גם אם זה Family
            await fetch(`${API}/store/settings`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ groupId: currentGroup.id, isActive: false, slogan: val('wizard-slogan'), logoUrl: val('wizard-logo-base64') || null })
            });
        } catch(e) {}
    }
    
    else if (currentWizardStep === 2) { // שמירת תקציב התחלתי
        const budget = parseFloat(val('wizard-initial-budget')) || 0;
        if (budget > 0) {
            btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                await fetch(`${API}/transaction`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ userId: currentUser.id, amount: budget, description: 'תקציב התחלתי פנוי', category: 'salary', type: 'income', groupId: currentGroup.id })
                });
            } catch(e) {}
        }
    }
    
    else if (currentWizardStep === 3) { // העלאת מוצרי מזווה
        if (wizardProducts.length > 0) {
            btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ממלא מזווה...';
            try {
                for (let p of wizardProducts) {
                    await fetch(`${API}/pantry/add`, {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ groupId: currentGroup.id, itemName: p.name, quantity: 1, unit: "יח'", unitsPerPackage: 1 })
                    });
                }
            } catch(e) {}
        }
    }
    
   else if (currentWizardStep === 4) { // סיום
        btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מסיים...';
        try {
            await fetch(`${API}/groups/onboard`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: currentGroup.id }) });
            currentGroup.is_onboarded = true;
            saveSession(); // <-- התיקון למניעת קפיצה!
            getEl('onboarding-wizard-modal').classList.add('hidden');
            triggerConfetti(); fetchData();
        } catch(e) {}
        return;
    }
    currentWizardStep++;
    updateWizardUI();
}

function prevWizardStep() {
    if (currentWizardStep > 1) { currentWizardStep--; updateWizardUI(); }
}

function skipWizardStep() {
    if (currentWizardStep === 4) nextWizardStep(); // סיום
    else { currentWizardStep++; updateWizardUI(); }
}

// --- ניהול תמונת זהות משפחתית ---
window.handleFamilyPhotoUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showToast('info', 'מעלה ומעבד תמונה...');
    compressImage(file, 600, 600, 0.8, async (base64) => {
        
        // 1. תצוגה מיידית למשתמש ושמירה במטמון לפני תשובת שרת
        if (currentGroup) currentGroup.logo_url = base64;
        const headerImg = getEl('header-group-img');
        const headerFallback = getEl('header-group-icon-fallback');
        const mgmtImg = getEl('mgmt-group-logo-preview');
        const mgmtIcon = getEl('mgmt-group-logo-icon');

        if (headerImg) { headerImg.src = base64; headerImg.classList.remove('hidden'); }
        if (headerFallback) headerFallback.classList.add('hidden');
        if (mgmtImg) { mgmtImg.src = base64; mgmtImg.classList.remove('hidden'); }
        if (mgmtIcon) mgmtIcon.classList.add('hidden');

        // 2. שמירה בשרת
        try {
            const res = await fetch(`${API}/store/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId: currentGroup.id,
                    logoUrl: base64,
                    isActive: true
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('success', 'תמונת המשפחה עודכנה בהצלחה!');
            } else {
                showToast('error', 'שגיאה בשמירת התמונה בשרת');
            }
        } catch (e) {
            showToast('error', 'תקלת רשת בעדכון תמונה');
        }
    });
};

// =====================================
// ניהול הרשאות ופיצ'רים (Feature Flags)
// =====================================
const ALL_TABS = [
    { id: 'feed', name: 'ראשי 🏠' },
    { id: 'tasks', name: 'משימות הבית ✅' },
    { id: 'shop', name: 'רשימת סופר 🛒' },
    { id: 'myorders', name: 'משלוחים 🛵' },
    { id: 'bank', name: 'הבנק המשפחתי 🏦' },
    { id: 'cashflow', name: 'תזרים עו"ש 💸' },
    { id: 'community', name: 'קהילה מקומית 🏘️' },
    { id: 'academy', name: 'לומדות חינוך 🎓' },
    { id: 'members', name: 'ניהול משפחה 👨‍👩‍👧‍👦' },
    { id: 'budget', name: 'ניהול תקציב 📊' },
    { id: 'pantry', name: 'ניהול מזווה 📦' },
    { id: 'recipes', name: 'שף פרטי 👨‍🍳' },
    { id: 'forecast', name: 'תשקיף כלכלי 📅' },
    { id: 'home-maintenance', name: 'ניהול הבית 🔧' }
];

const ROLE_DEFAULTS = {
    'ADMIN': ALL_TABS.map(t => t.id),
    'MANAGER': ['feed', 'tasks', 'shop', 'pantry', 'academy', 'recipes', 'home-maintenance'],
    'SENIOR': ['feed', 'tasks', 'shop', 'pantry', 'academy'],
    'MEMBER': ['feed', 'tasks', 'shop', 'academy'],
    'CHILD': ['feed', 'tasks', 'shop', 'academy', 'bank', 'cashflow', 'community']
};

function enforcePermissions() {
    if (!currentUser || !currentGroup) return;
    const isAdmin = currentUser.role === 'ADMIN';
    let userTabs = [];
    try {
        const perms = typeof currentUser.permissions === 'string' ? JSON.parse(currentUser.permissions) : (currentUser.permissions || {});
        const hasCustomTabs = perms.tabs && perms.tabs.length > 1;
        userTabs = hasCustomTabs ? perms.tabs : (ROLE_DEFAULTS[currentUser.role] || ROLE_DEFAULTS['MEMBER']);
    } catch(e) { userTabs = ROLE_DEFAULTS[currentUser.role] || ROLE_DEFAULTS['MEMBER']; }

    // קריאת הרשאות הפיצ'רים מהסופר-אדמין (Feature Flags)
    // במערכת המשפחתית שמות המודולים טיפה שונים, אנחנו עושים תאימות:
    let features = { store: true, academy: true, calendar: true, finance: true, inventory: true, crm: true, deliveries: true, ai: true, cashflow: true, budget: true, forecast: true, tasks: true, community: true, members: true, recipes: true };
    
    if (currentGroup.features) {
        try { features = typeof currentGroup.features === 'string' ? JSON.parse(currentGroup.features) : currentGroup.features; } catch(e) {}
    }

    // 1. הסתרה מוחלטת לפי תפקיד הילד/הורה (Role) - מבוצע רק עבור מי שאינו הורה מנהל
    ALL_TABS.forEach(tab => {
        const btn = getEl(`tab-${tab.id}`);
        if(btn) {
            if (userTabs.includes(tab.id) || isAdmin) {
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        }
    });

    // 2. אכיפת מנעולים (Feature Flags) שנסגרו ע"י הסופר-אדמין לכלל המשפחה
    const enforceModule = (flag, tabId, moduleName) => {
        const btn = getEl(`tab-${tabId}`);
        if (!btn || btn.style.display === 'none') return;
        // ילד לא נחסם על טאבים שמותרים לו לפי תפקידו
        if (currentUser.role === 'CHILD' && userTabs.includes(tabId)) return;

        const isModuleActive = flag !== undefined ? flag : true;

        if (!isModuleActive) {
            // המודול ננעל - הופכים לאפור ושמים מנעול
            btn.classList.add('locked-module', 'opacity-60', 'grayscale');
            btn.dataset.lockedName = moduleName;
            if (!btn.querySelector('.fa-lock')) {
                btn.innerHTML = `<i class="fa-solid fa-lock text-red-500 ml-1"></i> ` + btn.innerHTML;
            }
        } else {
            // שחרור מנעול
            btn.classList.remove('locked-module', 'opacity-60', 'grayscale');
            const lockIcon = btn.querySelector('.fa-lock');
            if (lockIcon) lockIcon.remove();
        }
    };

    // הפעלת האכיפה לפי המודולים במסך העריכה באדמין:
    enforceModule(features.store, 'shop', 'רשימת קניות חכמה');
    enforceModule(features.academy, 'academy', 'מרכז הכשרות ואתגרים');
    enforceModule(features.finance, 'bank', 'הבנק המשפחתי ודמי כיס');
    enforceModule(features.inventory, 'pantry', 'ניהול מלאי בבית');
    enforceModule(features.crm, 'myorders', 'הזמנות מקהילות'); 
    enforceModule(features.cashflow, 'cashflow', 'מעקב תזרים הוצאות');
    enforceModule(features.budget, 'budget', 'תקציבים ויעדים לילדים');
    enforceModule(features.forecast, 'forecast', 'תשקיף משפחתי עתידי');
    enforceModule(features.tasks, 'tasks', 'ניהול משימות וצ\'ופרים');
    enforceModule(features.community, 'community', 'חיבור לקהילות שכונתיות');
    enforceModule(features.members, 'members', 'ניהול משתמשי המשפחה');
    // פוד קוסט של עסקים, מתורגם למתכונים אצל משפחות:
    enforceModule(features.foodcost, 'recipes', 'מתכונים חכמים ממלאי'); 
 
    // הגבלת אלמנטים של העוזרת הווירטואלית AI
    const aiBtnMain = getEl('btn-global-ai');
    if (features.ai !== undefined && !features.ai) {
        if (aiBtnMain) aiBtnMain.style.display = 'none';
        document.querySelectorAll('.fa-wand-magic-sparkles').forEach(icon => {
            const parentBtn = icon.closest('button');
            if (parentBtn && !parentBtn.classList.contains('locked-module')) {
                parentBtn.classList.add('opacity-50', 'grayscale', 'cursor-not-allowed');
                parentBtn.onclick = (e) => { e.stopPropagation(); openLockedModuleModal('כלי בינה מלאכותית חכמים'); };
            }
        });
    }

    // וידוא שהמשתמש לא תקוע בטאב נעול
    const activeTabs = document.querySelectorAll('.tab-active');
    activeTabs.forEach(activeBtn => {
        if (activeBtn.style.display === 'none' || activeBtn.classList.contains('locked-module')) {
            if(activeBtn.id !== 'tab-feed') switchTab('feed');
        }
    });
    try { updateFamilyGroupNavVisibility(); } catch(e) {}
}

// =====================================
// מודול Upsell וחלון מודול נעול
// =====================================
window.openLockedModuleModal = function(moduleName) {
    let modal = getEl('locked-module-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'locked-module-modal';
        modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 fade-in';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative text-center border border-slate-100">
                <button onclick="document.getElementById('locked-module-modal').classList.add('hidden')" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 bg-slate-50 rounded-full transition border border-slate-100"><i class="fa-solid fa-xmark"></i></button>
                <div class="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl shadow-inner border border-slate-200">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <h3 class="text-2xl font-black text-slate-800 mb-2">פיצ'ר נעול 🔒</h3>
                <p class="text-sm text-slate-500 mb-8 leading-relaxed">היכולת להשתמש ב-<strong id="locked-module-name" class="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"></strong> סגורה בחבילה הנוכחית שלכם.<br>רוצים לפתוח את הנעילה ולהרחיב את המערכת?</p>
                <button id="btn-req-unlock" class="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                    שליחת בקשה לשדרוג חבילה <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    getEl('locked-module-name').innerText = moduleName;
    const btn = getEl('btn-req-unlock');
    btn.onclick = () => requestModuleUnlock(moduleName);
    
    modal.classList.remove('hidden');
};

window.requestModuleUnlock = async function(moduleName) {
    const btn = getEl('btn-req-unlock');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח פנייה...';
    
    try {
        const payload = {
            groupId: currentGroup.id,
            groupName: currentGroup.name,
            userId: currentUser.id,
            userName: currentUser.nickname,
            userEmail: currentGroup.admin_email || 'לא ידוע',
            subject: `בקשת שדרוג חבילה / משפחה: פתיחת ${moduleName}`,
            description: `היי צוות, אשמח לקבל פרטים ועלויות לגבי הוספת המודול "${moduleName}" למערכת המשפחתית שלנו. אנא צרו איתי קשר.`
        };

        const res = await fetch(`${API}/support/ticket`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('success', 'מעולה! שלחנו פנייה לצוות. נחזור אליכם בהקדם האפשרי.');
            getEl('locked-module-modal').classList.add('hidden');
            try { triggerConfetti(); } catch(e){}
        } else {
            showToast('error', data.error || 'שגיאה בשליחת הפנייה');
        }
    } catch(e) {
        showToast('error', 'שגיאת רשת. נסו שוב מאוחר יותר.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'שליחת בקשה לשדרוג חבילה <i class="fa-solid fa-paper-plane"></i>';
    }
};

// יירוט לחיצות על טאבים נעולים (כדי שלא יכנסו לעמוד ריק)
if (!window.switchTabOverridden) {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabId) {
        const targetBtn = document.getElementById(`tab-${tabId}`);
        if (targetBtn && targetBtn.classList.contains('locked-module')) {
            const modName = targetBtn.dataset.lockedName || 'מודול נעול';
            if(typeof openLockedModuleModal === 'function') openLockedModuleModal(modName);
            return; // מונע כניסה למסך
        }
        originalSwitchTab(tabId);
        setTimeout(enforcePermissions, 50);
    };
    window.switchTabOverridden = true;
}

// קריאה ראשונית כשכל הדף נטען
setTimeout(enforcePermissions, 1500);

// ============================================================
// --- FAMILY GROUP NAV ---
// ============================================================
const FAMILY_GNAV_GROUPS = {
    home:   ['shop', 'myorders', 'pantry', 'recipes', 'home-maintenance'],
    money:  ['bank', 'cashflow', 'budget', 'forecast'],
    family: ['tasks', 'academy', 'community', 'members']
};

const _fgnavOriginalParents = {};

window.toggleFamilyNavDropdown = function(group) {
    const dd = document.getElementById(`fgnav-dropdown-${group}`);
    if (!dd) return;
    const isOpen = !dd.classList.contains('hidden');
    window.closeFamilyNavDropdowns();
    if (isOpen) return;

    const btn = document.getElementById(`fgnav-group-${group}`);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    if (!_fgnavOriginalParents[group]) _fgnavOriginalParents[group] = dd.parentElement;
    document.body.appendChild(dd);

    const ddWidth = 170;
    let leftPos = rect.left;
    if (leftPos + ddWidth > window.innerWidth - 8) leftPos = window.innerWidth - ddWidth - 8;
    if (leftPos < 8) leftPos = 8;

    dd.style.cssText = `position:fixed; top:${rect.bottom + 4}px; left:${leftPos}px; right:auto; z-index:99999;`;
    dd.classList.remove('hidden');
};

window.closeFamilyNavDropdowns = function() {
    Object.keys(FAMILY_GNAV_GROUPS).forEach(g => {
        const dd = document.getElementById(`fgnav-dropdown-${g}`);
        if (!dd) return;
        dd.classList.add('hidden');
        dd.removeAttribute('style');
        const orig = _fgnavOriginalParents[g];
        if (orig && dd.parentElement !== orig) orig.appendChild(dd);
    });
};

function updateFamilyGroupNavActiveState(tabId) {
    const feedBtn = document.getElementById('fgnav-btn-feed');
    if (feedBtn) {
        feedBtn.className = tabId === 'feed'
            ? 'fgnav-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 transition-all duration-150'
            : 'fgnav-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-150';
    }
    let activeGroup = null;
    for (const [g, tabs] of Object.entries(FAMILY_GNAV_GROUPS)) {
        if (tabs.includes(tabId)) { activeGroup = g; break; }
    }
    Object.keys(FAMILY_GNAV_GROUPS).forEach(g => {
        const btn = document.getElementById(`fgnav-btn-${g}`);
        if (!btn) return;
        btn.classList.toggle('bg-indigo-600', g === activeGroup);
        btn.classList.toggle('text-white', g === activeGroup);
        btn.classList.toggle('text-slate-400', g !== activeGroup);
    });
}

function updateFamilyGroupNavVisibility() {
    Object.entries(FAMILY_GNAV_GROUPS).forEach(([g, tabs]) => {
        const groupEl = document.getElementById(`fgnav-group-${g}`);
        if (!groupEl) return;
        const hasVisible = tabs.some(id => {
            const btn = document.getElementById(`tab-${id}`);
            return btn && btn.style.display !== 'none';
        });
        groupEl.style.display = hasVisible ? '' : 'none';
    });
}

function syncFamilyBellBadge() {
    const src  = document.getElementById('bell-badge');
    const dest = document.getElementById('fgnav-bell-badge');
    if (!src || !dest) return;
    const hidden = src.classList.contains('hidden');
    dest.classList.toggle('hidden', hidden);
    if (!hidden) dest.textContent = src.textContent;
}

function updateFamilyNavBadges() {
    const isAdmin = currentUser?.role === 'ADMIN';
    const homeCount = isAdmin
        ? (shoppingListCache || []).filter(i => i.status === 'pending_approval').length
        : (allTasks || []).filter(t => t.status === 'pending' && String(t.assigned_to) === String(currentUser?.id)).length;
    const homeBadge = document.getElementById('fgnav-badge-home');
    if (homeBadge) { homeBadge.textContent = homeCount > 9 ? '9+' : homeCount; homeBadge.classList.toggle('hidden', homeCount === 0); }

    const familyCount = isAdmin
        ? (allTasks || []).filter(t => t.status === 'completed' || t.status === 'done').length
        : (bundlesCache || []).filter(b => b.status === 'assigned').length;
    const familyBadge = document.getElementById('fgnav-badge-family');
    if (familyBadge) { familyBadge.textContent = familyCount > 9 ? '9+' : familyCount; familyBadge.classList.toggle('hidden', familyCount === 0); }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// סגירת dropdown בלחיצה מחוץ לנאב
document.addEventListener('click', function(e) {
    if (e.target.closest('#family-group-nav')) return;
    const inDropdown = Object.keys(FAMILY_GNAV_GROUPS).some(g => {
        const dd = document.getElementById(`fgnav-dropdown-${g}`);
        return dd && !dd.classList.contains('hidden') && dd.contains(e.target);
    });
    if (!inDropdown) window.closeFamilyNavDropdowns?.();
});

// עטיפת switchTab לעדכון group nav
(function() {
    const _prev = window.switchTab;
    window.switchTab = function(tabId) {
        _prev(tabId);
        try { updateFamilyGroupNavActiveState(tabId); closeFamilyNavDropdowns(); syncFamilyBellBadge(); } catch(e) {}
    };
})();

// הוספת מזהה גרסה בתחתית המסך
(function addVersionBadge() {
    if (!document.getElementById('oneflow-version-badge')) {
        const badge = document.createElement('div');
        badge.id = 'oneflow-version-badge';
        badge.innerHTML = 'גרסה 2.1.8 (סנכרון מלא לסופר-אדמין ושליטה בחבילות)';
        badge.className = 'w-full text-center mt-8 pb-4 text-slate-400 text-xs font-mono';
        document.body.appendChild(badge);
    }
})();
// =========================================================
// --- מנגנון מיתוג גלובלי ומסך התחברות חכם ---
// =========================================================

window.loginSliderInterval = null;
window.currentLoginSlideIndex = 0;

window.initPublicConfig = async function() {
    try {
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/system/public-config`);
        const data = await res.json();
        
        if (data.success) {
            if (data.globalAiLogo) {
                // 1. שמירה במשתנה גלובלי לכל המערכת
                window.currentFamilaiLogo = data.globalAiLogo;

                // 2. עדכון סמל הדפדפן (Favicon)
                const link = document.querySelector("link[rel~='icon']");
                if (link) link.href = data.globalAiLogo;
                document.querySelectorAll("link[rel='shortcut icon'], link[rel='apple-touch-icon']").forEach(l => l.href = data.globalAiLogo);

                // 2b. עדכון og:image לשיתוף וואצאפ/סושיאל
                ['og:image','og:image:secure_url'].forEach(prop => {
                    const m = document.querySelector(`meta[property="${prop}"]`);
                    if (m) m.content = data.globalAiLogo;
                });

                // 3. עדכון בועת העוזרת החכמה המרחפת!
                // מאתרים את כל הכפתורים שמפעילים את מודאל ה-AI
                const aiTriggers = document.querySelectorAll('[onclick*="openFamilaiChatModal"]');
                aiTriggers.forEach(trigger => {
                    // מחפשים את תגית התמונה שבתוך הבועה (כרגע logo.png) ומחליפים אותה
                    const img = trigger.querySelector('img');
                    if (img) {
                        img.src = data.globalAiLogo;
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '50%';
                    }
                });
            }

            // בניית קרוסלת ההתחברות (Login Slider)
            if (data.loginSlides && data.loginSlides.length > 0) {
                const scroll = document.getElementById('login-slider-scroll');
                const dots = document.getElementById('login-slider-dots');
                
                if (scroll && dots) {
                    scroll.classList.remove('overflow-x-auto');
                    scroll.classList.add('overflow-hidden');
                    scroll.style.overflow = 'hidden';
                    scroll.style.touchAction = 'none'; 
                    
                    let slidesHtml = '';
                    let dotsHtml = '';
                    
                    data.loginSlides.forEach((slide, idx) => {
                        slidesHtml += `
                        <div class="min-w-full w-full h-full shrink-0 snap-center relative flex justify-center items-center">
                            <img src="${slide.image}" class="w-full h-full object-cover z-0 pointer-events-none select-none">
                        </div>`;
                        dotsHtml += `<button onclick="window.goToLoginSlide(${idx}, ${data.loginSlides.length})" id="login-dot-${idx}" class="rounded-full transition-all duration-300 ${idx === 0 ? 'bg-white w-5 h-2' : 'bg-white/40 hover:bg-white/80 w-2 h-2'} shadow-sm backdrop-blur-sm border border-black/10 z-30 relative focus:outline-none"></button>`;
                    });
                    
                    scroll.innerHTML = slidesHtml;
                    dots.innerHTML = data.loginSlides.length > 1 ? dotsHtml : ''; 
                    
                    if (data.loginSlides.length > 1) {
                        window.startLoginAutoScroll(data.loginSlides.length);
                    }
                }
            }
        }
    } catch(e) { console.error('Failed to load public config', e); }
};
window.startLoginAutoScroll = function(total) {
    if (window.loginSliderInterval) clearInterval(window.loginSliderInterval);
    window.loginSliderInterval = setInterval(() => {
        window.currentLoginSlideIndex++;
        if (window.currentLoginSlideIndex >= total) {
            window.currentLoginSlideIndex = 0;
        }
        window.goToLoginSlide(window.currentLoginSlideIndex, total);
    }, 4500); 
};

window.goToLoginSlide = function(index, totalSlides) {
    window.currentLoginSlideIndex = index;
    const scroll = document.getElementById('login-slider-scroll');
    if (scroll) {
        const w = scroll.clientWidth;
        const isRTL = window.getComputedStyle(scroll).direction === 'rtl';
        scroll.scrollTo({ left: index * w * (isRTL ? -1 : 1), behavior: 'smooth' });
    }
    
    const dotsDiv = document.getElementById('login-slider-dots');
    const total = totalSlides || (dotsDiv ? dotsDiv.children.length : 0);
    window.updateLoginDots(total);
    
    if (total > 1) {
        window.startLoginAutoScroll(total);
    }
};

window.updateLoginDots = function(total) {
    for (let i = 0; i < total; i++) {
        const dot = document.getElementById(`login-dot-${i}`);
        if (dot) {
            dot.className = `rounded-full transition-all duration-300 shadow-sm backdrop-blur-sm border border-black/10 z-30 relative focus:outline-none ${i === window.currentLoginSlideIndex ? 'bg-white w-5 h-2' : 'bg-white/40 hover:bg-white/80 w-2 h-2'}`;
        }
    }
};

// הפעלה בעת טעינת החלון
window.addEventListener('load', () => {
    setTimeout(() => {
        window.initPublicConfig();
    }, 200);
});

// ==========================================
// פניות שירות ותמונות משפחה - גרסה סופית ותקינה
// ==========================================
window.renderGroupInfo = function() {
    if (!currentGroup) return;
    
    const nameEl = document.getElementById('dash-group-name');
    if (nameEl) {
        const codeBadge = currentGroup.group_code ? `<span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mr-2 tracking-widest">${currentGroup.group_code}</span>` : '';
        nameEl.innerHTML = `${safeStr(currentGroup.family_nickname || currentGroup.name)} ${codeBadge}`;
    }

    const logo = currentGroup.logo || currentGroup.logo_url || currentGroup.image_url;
    const headerImg = document.getElementById('header-group-img');
    const headerFallback = document.getElementById('header-group-icon-fallback');
    const mgmtPreview = document.getElementById('mgmt-group-logo-preview');
    const mgmtIcon = document.getElementById('mgmt-group-logo-icon');

    // התיקון: בדיקה הרבה יותר סלחנית כדי שהתמונה תוצג תמיד
    if (logo && logo.length > 50) { 
        if (headerImg) { headerImg.src = logo; headerImg.classList.remove('hidden'); }
        if (headerFallback) headerFallback.classList.add('hidden');
        if (mgmtPreview) { mgmtPreview.src = logo; mgmtPreview.classList.remove('hidden'); }
        if (mgmtIcon) mgmtIcon.classList.add('hidden');
    } else {
        if (headerImg) headerImg.classList.add('hidden');
        if (headerFallback) headerFallback.classList.remove('hidden');
        if (mgmtPreview) mgmtPreview.classList.add('hidden');
        if (mgmtIcon) mgmtIcon.classList.remove('hidden');
    }
};

// ===== מודל שדרוג משפחה (חבר → משפחה) =====
window._upgradePhotoBase64 = null;

window.showFamilyUpgradeModal = function() {
    const modal = document.getElementById('family-upgrade-modal'); if (!modal) return;
    const nickInput = document.getElementById('upgrade-family-nickname');
    if (nickInput) nickInput.value = currentGroup?.family_nickname || '';
    const prev = document.getElementById('upgrade-photo-preview-wrap');
    if (prev) prev.classList.add('hidden');
    window._upgradePhotoBase64 = null;
    modal.classList.remove('hidden');
    try { confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } }); } catch(e) {}
};

window.closeUpgradeModal = function() {
    const modal = document.getElementById('family-upgrade-modal'); if (modal) modal.classList.add('hidden');
};

window.onUpgradePhotoSelected = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const max = 512; let w = img.width, h = img.height;
            if (w > h) { if (w > max) { h = h * max / w; w = max; } } else { if (h > max) { w = w * max / h; h = max; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            window._upgradePhotoBase64 = canvas.toDataURL('image/jpeg', 0.85);
            const prev = document.getElementById('upgrade-photo-preview');
            const wrap = document.getElementById('upgrade-photo-preview-wrap');
            if (prev) prev.src = window._upgradePhotoBase64;
            if (wrap) wrap.classList.remove('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.saveUpgradeModal = async function() {
    const btn = document.getElementById('btn-save-upgrade'); if (btn) { btn.disabled = true; btn.textContent = 'שומר...'; }
    try {
        const nickname = (document.getElementById('upgrade-family-nickname')?.value || '').trim();
        const updates = [];
        if (nickname || window._upgradePhotoBase64) {
            if (nickname) updates.push(fetch(`${API}/groups/${currentGroup.id}/nickname`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ familyNickname: nickname }) }));
            if (window._upgradePhotoBase64) updates.push(fetch(`${API}/groups/${currentGroup.id}/logo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo: window._upgradePhotoBase64 }) }));
            await Promise.all(updates);
            if (nickname) currentGroup.family_nickname = nickname;
            if (window._upgradePhotoBase64) currentGroup.logo = window._upgradePhotoBase64;
            saveSession();
            try { window.renderGroupInfo(); } catch(e) {}
        }
        closeUpgradeModal();
        showToast('success', '🎉 ברוכים הבאים למשפחה מלאה!');
    } catch(e) { showToast('error', 'שגיאה בשמירה, נסה שוב'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'שמור והמשך'; } }
};

window.openTicketsModal = function() {
    const modal = document.getElementById('tickets-modal');
    if (modal) modal.classList.remove('hidden');
    if (typeof fetchMyTickets === 'function') fetchMyTickets();
};

window.fetchMyTickets = async function() {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!token || !currentGroup) return;

        const res = await fetch(`${API}/tickets/${currentGroup.id}`, {
            headers: { 'Authorization': token }
        });
        const data = await res.json();
        
        const list = document.getElementById('user-tickets-list');
        if (!list) return;

        if (data.success) {
            if (!data.tickets || data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            list.innerHTML = data.tickets.map(t => `
                <div class="bg-white p-3 rounded-lg border ${t.status === 'resolved' ? 'border-green-200' : 'border-slate-200'}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-slate-800 text-sm">${t.subject}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2">${t.content}</p>
                    ${t.admin_reply ? `<div class="bg-slate-50 p-2 rounded text-xs border border-slate-100"><strong class="text-blue-600">תשובת צוות:</strong> ${t.admin_reply}</div>` : ''}
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Error fetching tickets', err);
    }
};

window.submitTicket = async function() {
    const subjectEl = document.getElementById('ticket-subject');
    const contentEl = document.getElementById('ticket-content');
    
    if (!subjectEl || !contentEl) return;

    const subject = subjectEl.value;
    const content = contentEl.value;
    
    if (!subject || !content) {
        if (typeof showToast === 'function') showToast('error', 'נא למלא נושא ותוכן פנייה');
        return;
    }
    
    try {
        const token = localStorage.getItem('ofl_token');
        const res = await fetch(`${API}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ 
                groupId: currentGroup.id, 
                userId: currentUser.id, 
                subject: subject, 
                content: content 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            if (typeof showToast === 'function') showToast('success', 'הפנייה נשלחה בהצלחה!');
            subjectEl.value = '';
            contentEl.value = '';
            const modal = document.getElementById('tickets-modal');
            if (modal) modal.classList.add('hidden');
            if (typeof fetchMyTickets === 'function') fetchMyTickets();
        }
    } catch (err) { 
        console.error('Error submitting ticket:', err); 
    }
};
window.previewFamilyPhoto = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    compressImage(file, 600, 600, 0.8, (base64) => {
        window.tempFamilyLogoBase64 = base64;
        
        // תצוגה מקדימה חיה
        const confirmPreview = document.getElementById('photo-confirm-preview');
        if (confirmPreview) confirmPreview.src = base64;
        
        const confirmModal = document.getElementById('photo-confirm-modal');
        if (confirmModal) confirmModal.classList.remove('hidden');
    });
    event.target.value = '';
};

window.cancelFamilyPhoto = function() {
    window.tempFamilyLogoBase64 = null;
    document.getElementById('photo-confirm-modal').classList.add('hidden');
};

window.saveFamilyPhoto = async function() {
    if (!window.tempFamilyLogoBase64) return;
    const btn = document.getElementById('btn-modal-save-photo');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שומר...'; }
    try {
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/groups/${currentGroup.id}/logo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_token') || '' },
            body: JSON.stringify({ logo: window.tempFamilyLogoBase64 })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('success', 'התמונה נשמרה בהצלחה!');
            const modal = document.getElementById('photo-confirm-modal');
            if (modal) modal.classList.add('hidden');
            
            currentGroup.logo = window.tempFamilyLogoBase64;
            currentGroup.image_url = window.tempFamilyLogoBase64;
            
            // גיבוי קשיח ואגרסיבי לזיכרון המקומי כדי שהתמונה תשרוד גם אם השרת לא מחזיר אותה
            localStorage.setItem(`ofl_hard_logo_${currentGroup.id}`, window.tempFamilyLogoBase64);
            saveSession();
            
            if (typeof window.renderGroupInfo === 'function') window.renderGroupInfo(); 
        } else {
            showToast('error', 'שגיאה בשמירה בשרת');
        }
    } catch(e) {
        showToast('error', 'שגיאת רשת');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = 'שמור תמונה'; }
    }
};

window.openPermissionsModal = function(userId, userName, encodedPermsStr) {
    document.getElementById('perms-user-id').value = userId;
    document.getElementById('perms-user-name').innerText = userName;
    
    let userTabs = [];
    try {
        const decodedStr = decodeURIComponent(encodedPermsStr);
        const p = JSON.parse(decodedStr);
        userTabs = p.tabs || [];
    } catch(e) {
        userTabs = ['feed']; 
    }
    
    const container = document.getElementById('perms-checkboxes');
    container.innerHTML = ALL_TABS.map(tab => {
        const isFeed = tab.id === 'feed';
        const isChecked = isFeed || userTabs.includes(tab.id);
        return `
        <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-blue-200 transition">
            <input type="checkbox" value="${tab.id}" class="perm-cb w-4 h-4 accent-blue-600 rounded" ${isChecked ? 'checked' : ''} ${isFeed ? 'disabled' : ''}>
            <span class="text-sm font-bold text-slate-700">${tab.name}</span>
        </label>
        `;
    }).join('');
    
    document.getElementById('permissions-modal').classList.remove('hidden');
};

window.savePermissions = async function() {
    const userId = document.getElementById('perms-user-id').value;
    const cbs = document.querySelectorAll('.perm-cb');
    const selectedTabs = Array.from(cbs).filter(cb => cb.checked || cb.disabled).map(cb => cb.value);
    
    const btn = document.getElementById('btn-save-perms');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שומר...';
    
    try {
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/users/${userId}/permissions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_token') || '' },
            body: JSON.stringify({ tabs: selectedTabs })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('success', 'הרשאות עודכנו בהצלחה!');
            document.getElementById('permissions-modal').classList.add('hidden');
            fetchMembers(); 
        } else {
            showToast('error', data.error || 'שגיאה בעדכון הרשאות');
        }
    } catch(e) {
        showToast('error', 'שגיאת רשת');
    } finally {
        btn.disabled = false;
        btn.innerText = 'שמור הרשאות';
    }
};
// ==========================================
// OVERRIDE: תצוגת קריאות שירות (תמיכה) למשפחה
// ==========================================

window.fetchMyTickets = async function() {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!token || !currentGroup) return;
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/tickets/${currentGroup.id}`, {
            headers: { 'Authorization': token }
        });
        const data = await res.json();
        
        const list = document.getElementById('user-tickets-list');
        if (!list) return;
        
        if (data.success && data.tickets) {
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            list.innerHTML = data.tickets.map(t => `
                <div class="bg-white p-3 rounded-lg border ${t.status === 'resolved' ? 'border-green-200' : 'border-slate-200'}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-slate-800 text-sm">${t.subject}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2">${t.content}</p>
                    ${t.admin_reply ? `<div class="bg-slate-50 p-2 rounded text-xs border border-slate-100"><strong class="text-blue-600">תשובת צוות:</strong> ${t.admin_reply}</div>` : ''}
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Error fetching tickets:', err);
    }
};

window.submitTicket = async function(event) {
    if (event) event.preventDefault();
    const subjectEl = document.getElementById('ticket-subject');
    const contentEl = document.getElementById('ticket-content');
    
    if (!subjectEl || !contentEl) return;
    const subject = subjectEl.value;
    const content = contentEl.value;
    
    if (!subject || !content) {
        if (typeof showToast === 'function') showToast('error', 'נא למלא נושא ותוכן פנייה');
        return;
    }

    const btn = event && event.currentTarget ? event.currentTarget : document.querySelector('#tickets-modal button.bg-blue-600');
    let originalText = '';
    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';
        btn.disabled = true;
    }
    
    try {
        const token = localStorage.getItem('ofl_token');
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ 
                group_id: currentGroup.id, 
                user_id: currentUser.id, 
                subject: subject, 
                content: content 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            if (typeof showToast === 'function') showToast('success', 'הפנייה נשלחה בהצלחה!');
            subjectEl.value = '';
            contentEl.value = '';
            fetchMyTickets(); // רענן מיד את הרשימה להצגת הקריאה החדשה למשפחה
        } else {
            if (typeof showToast === 'function') showToast('error', data.error || 'שגיאה בשליחה');
        }
    } catch (err) { 
        console.error('Error submitting ticket:', err); 
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// האזנה חכמה לפתיחת המודאל מכל מקום במסך - מושך את הקריאות מיד עם פתיחת החלונית
document.addEventListener('click', (e) => {
    if (e.target.closest('[onclick*="tickets-modal"]')) {
        setTimeout(() => {
            const modal = document.getElementById('tickets-modal');
            if(modal && !modal.classList.contains('hidden')) {
                if (typeof fetchMyTickets === 'function') fetchMyTickets();
            }
        }, 100);
    }
});
// ==========================================
// OVERRIDE FINAL: פתרון תצוגת הקריאות למשפחה בחלונית
// ==========================================

window.fetchMyTickets = async function() {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!currentGroup || !currentGroup.id) return;
        
        // בחירת נתיב API מדויק כדי למנוע שגיאות ניתוב (404) גם בלוקאל וגם בפרודקשן
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/tickets/${currentGroup.id}`, {
            headers: { 'Authorization': token || '' }
        });
        const data = await res.json();
        
        const list = document.getElementById('user-tickets-list');
        if (!list) return;
        
        if (data.success && data.tickets) {
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            
            // בניית ה-HTML של הקריאות והזרקתן לחלונית
            list.innerHTML = data.tickets.map(t => `
                <div class="bg-white p-3 rounded-xl border ${t.status === 'resolved' ? 'border-green-200' : 'border-slate-200'} mb-2 shadow-sm transition hover:shadow-md">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="font-bold text-slate-800 text-sm"><i class="fa-regular fa-comment-dots text-slate-400 ml-1"></i> ${safeStr(t.subject)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 leading-relaxed">${safeStr(t.content)}</p>
                    ${t.admin_reply ? `<div class="bg-indigo-50 p-2.5 rounded-lg text-xs border border-indigo-100 mt-2"><strong class="text-indigo-600 mb-1 block"><i class="fa-solid fa-headset"></i> תשובת צוות תמיכה:</strong>${safeStr(t.admin_reply)}</div>` : ''}
                </div>
            `).join('');
        } else {
             list.innerHTML = '<p class="text-xs text-red-400 text-center py-6">שגיאה בטעינת הנתונים.</p>';
        }
    } catch (err) {
        console.error('Error fetching tickets in client:', err);
    }
};

// וידוא שהרשימה נטענת אוטומטית ברגע שהלקוח לוחץ על כפתור פתיחת מודאל התמיכה (האוזניות)
const _originalOpenTicketsModal = window.openTicketsModal;
window.openTicketsModal = function() {
    if (typeof _originalOpenTicketsModal === 'function') _originalOpenTicketsModal();
    else {
        const modal = document.getElementById('tickets-modal');
        if (modal) modal.classList.remove('hidden');
    }
    // קריאה לרענון הרשימה מיד עם פתיחת החלון
    if (typeof fetchMyTickets === 'function') fetchMyTickets();
};
// ==========================================
// OVERRIDE FINAL: ניהול פניות מתקדם למשפחות (נושאים + שרשור צ'אט)
// ==========================================

// משכתב את פונקציית פתיחת המודאל כדי להזריק רשימת בחירת נושאים במקום טקסט חופשי
window.openTicketsModal = function() {
    const modal = document.getElementById('tickets-modal');
    if (modal) modal.classList.remove('hidden');
    
    const subjInput = document.getElementById('ticket-subject');
    if (subjInput && subjInput.tagName === 'INPUT') {
        const select = document.createElement('select');
        select.id = 'ticket-subject';
        select.className = subjInput.className;
        select.innerHTML = `
            <option value="" disabled selected>בחרו נושא פנייה...</option>
            <option value="בעיה טכנית / באג">בעיה טכנית / באג</option>
            <option value="שאלה לגבי שימוש באפליקציה">שאלה לגבי שימוש באפליקציה</option>
            <option value="בקשה להוספת פיצ'ר">בקשה להוספת פיצ'ר</option>
            <option value="ניהול מנוי ותשלומים">ניהול מנוי ותשלומים</option>
            <option value="אחר">אחר</option>
        `;
        subjInput.parentNode.replaceChild(select, subjInput);
    }

    if (typeof fetchMyTickets === 'function') fetchMyTickets();
};

window.fetchMyTickets = async function() {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!currentGroup || !currentGroup.id) return;
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        // מושכים מהנתיב המלא של support_tickets שמחזיר גם את הלוג של השיחה!
        const res = await fetch(`${apiPath}/support/tickets/my/${currentGroup.id}`, {
            headers: { 'Authorization': token || '' }
        });
        const data = await res.json();
        
        const list = document.getElementById('user-tickets-list');
        if (!list) return;
        
        if (data.success && data.tickets) {
            // שומרים זמנית את הפניות כדי שנוכל לפתוח אותן בפירוט
            window.familyTicketsCache = data.tickets; 
            
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl mt-2">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            
            list.innerHTML = data.tickets.map(t => {
                let lastReply = '';
                let parsedLog = [];
                try { parsedLog = typeof t.log === 'string' ? JSON.parse(t.log) : (t.log || []); } catch(e){}
                
                // מחפשים תגובה אחרונה של איש צוות
                const staffReplies = parsedLog.filter(l => l.isStaff);
                if (staffReplies.length > 0) {
                    lastReply = staffReplies[staffReplies.length - 1].message;
                }
                
                return `
                <div onclick="openFamilyTicket(${t.id})" class="bg-white p-3 rounded-xl border cursor-pointer ${t.status === 'resolved' ? 'border-green-200' : 'border-slate-200'} mb-2 shadow-sm transition hover:shadow-md hover:border-blue-300">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="font-bold text-slate-800 text-sm"><i class="fa-regular fa-comment-dots text-slate-400 ml-1"></i> ${safeStr(t.subject)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 leading-relaxed truncate">${safeStr(t.description)}</p>
                    ${lastReply ? `<div class="bg-indigo-50 p-2.5 rounded-lg text-xs border border-indigo-100 mt-2 truncate"><strong class="text-indigo-600 mb-1 block"><i class="fa-solid fa-headset"></i> צוות ענה לאחרונה:</strong>${safeStr(lastReply)}</div>` : ''}
                    <div class="text-[10px] text-blue-500 font-bold text-left w-full mt-2">לחץ לפירוט והמשך שיחה <i class="fa-solid fa-chevron-left"></i></div>
                </div>
                `;
            }).join('');
        } else {
             list.innerHTML = '<p class="text-xs text-red-400 text-center py-6">שגיאה בטעינת הנתונים.</p>';
        }
    } catch (err) {
        console.error('Error fetching tickets in client:', err);
    }
};

window.openFamilyTicket = function(id) {
    const ticket = (window.familyTicketsCache || []).find(t => t.id === id);
    if(!ticket) return;

    let modal = document.getElementById('family-ticket-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'family-ticket-detail-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(modal);
    }

    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}

    const logHtml = parsedLog.map(l => {
        const isMe = !l.isStaff;
        const alignClass = isMe ? 'bg-blue-50 border-blue-100 mr-auto rounded-tr-none' : 'bg-indigo-50 border-indigo-100 ml-auto rounded-tl-none';
        const nameClass = isMe ? 'text-blue-600' : 'text-indigo-600';
        const icon = isMe ? 'fa-user' : 'fa-headset';
        const d = new Date(l.date);
        const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
        return `
            <div class="p-3 rounded-xl border w-[85%] mb-3 shadow-sm ${alignClass}">
                <div class="flex justify-between items-center mb-1 text-[10px]">
                    <span class="font-bold ${nameClass}"><i class="fa-solid ${icon}"></i> ${safeStr(l.sender)}</span>
                    <span class="text-slate-400">${dateStr}</span>
                </div>
                <p class="text-sm text-slate-700 whitespace-pre-wrap">${safeStr(l.message)}</p>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 class="font-bold text-slate-800 text-sm truncate pr-8 pl-4"><i class="fa-solid fa-ticket text-blue-500 ml-1"></i> ${safeStr(ticket.subject)}</h3>
                <button onclick="document.getElementById('family-ticket-detail-modal').classList.add('hidden')" class="absolute top-3 left-3 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-times"></i></button>
            </div>
            
            <div id="family-ticket-log" class="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                ${logHtml}
            </div>

            <div class="p-4 bg-white border-t border-slate-100">
                <textarea id="family-ticket-reply-text" rows="2" class="modern-input w-full py-2 text-sm mb-2 resize-none" placeholder="הקלידו תגובה למנהלי המערכת..."></textarea>
                <button onclick="replyFamilyTicket(${ticket.id})" id="btn-family-ticket-reply" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i></button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    // גוללים למטה כדי לראות את ההודעה האחרונה
    const logContainer = document.getElementById('family-ticket-log');
    setTimeout(() => { logContainer.scrollTop = logContainer.scrollHeight; }, 50);
};

window.replyFamilyTicket = async function(id) {
    const input = document.getElementById('family-ticket-reply-text');
    const text = input.value.trim();
    if(!text) return typeof showToast === 'function' ? showToast('error', 'נא לכתוב תגובה') : alert('נא לכתוב תגובה');
    
    const btn = document.getElementById('btn-family-ticket-reply');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
        const token = localStorage.getItem('ofl_token');
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/support/tickets/${id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token || '' },
            body: JSON.stringify({ 
                message: text, 
                userName: currentUser ? currentUser.nickname : 'לקוח', 
                isStaff: false 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            input.value = '';
            if (typeof showToast === 'function') showToast('success', 'התגובה נשלחה לצוות');
            await fetchMyTickets(); 
            openFamilyTicket(id); 
        } else {
            if (typeof showToast === 'function') showToast('error', data.error || 'שגיאה בשליחה');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('error', 'שגיאת רשת');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i>';
    }
};
// ==========================================
// OVERRIDE FINAL: מנגנון התראות על תגובות מצוות התמיכה (משפחות)
// ==========================================

// פונקציות עזר לשמירת מצב הקריאה בדפדפן (מי קרא איזו קריאה וכמה הודעות היו בה)
window.getReadTicketsState = function() {
    try { return JSON.parse(localStorage.getItem('ofl_tickets_read_state')) || {}; } 
    catch(e) { return {}; }
};

window.markTicketAsRead = function(ticketId, logLength) {
    const state = window.getReadTicketsState();
    state[ticketId] = logLength;
    localStorage.setItem('ofl_tickets_read_state', JSON.stringify(state));
    window.updateTicketsBadgeUI(); 
};

window.checkIfUnread = function(ticket) {
    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}
    
    if (parsedLog.length > 0) {
        const lastMsg = parsedLog[parsedLog.length - 1];
        if (lastMsg.isStaff) {
            const state = window.getReadTicketsState();
            const savedLength = state[ticket.id] || 0;
            if (parsedLog.length > savedLength) {
                return true;
            }
        }
    }
    return false;
};

// עדכון בועת ההתראה על אייקון האוזניות מחוץ למודאל
window.updateTicketsBadgeUI = function() {
    if (!window.familyTicketsCache) return;
    const unreadCount = window.familyTicketsCache.filter(t => window.checkIfUnread(t)).length;
    
    const triggerBtns = document.querySelectorAll('[onclick*="openTicketsModal"]');
    triggerBtns.forEach(btn => {
        const existingBadge = btn.querySelector('.ticket-unread-badge');
        if (existingBadge) existingBadge.remove();
        
        if (unreadCount > 0) {
            btn.style.position = 'relative';
            const badge = document.createElement('span');
            badge.className = 'ticket-unread-badge absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-pulse';
            badge.innerText = unreadCount;
            btn.appendChild(badge);
        }
    });
};

// שכתוב הפונקציה כדי שתתמוך ב-Silent Load (משיכת נתונים ברקע בלי לשבש את המסך)
window.fetchMyTickets = async function(silent = false) {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!currentGroup || !currentGroup.id) return;
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/support/tickets/my/${currentGroup.id}`, {
            headers: { 'Authorization': token || '' }
        });
        const data = await res.json();
        
        if (data.success && data.tickets) {
            window.familyTicketsCache = data.tickets; 
            window.updateTicketsBadgeUI(); // עדכון הבועה על האייקון מיד לאחר המשיכה
            
            const list = document.getElementById('user-tickets-list');
            if (!list || silent) return;
            
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl mt-2">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            
            list.innerHTML = data.tickets.map(t => {
                let lastReply = '';
                let parsedLog = [];
                try { parsedLog = typeof t.log === 'string' ? JSON.parse(t.log) : (t.log || []); } catch(e){}
                
                const staffReplies = parsedLog.filter(l => l.isStaff);
                if (staffReplies.length > 0) {
                    lastReply = staffReplies[staffReplies.length - 1].message;
                }
                
                const isUnread = window.checkIfUnread(t);
                const unreadBadge = isUnread ? `<span class="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 shadow-sm animate-pulse">תגובה חדשה!</span>` : '';
                
                return `
                <div onclick="openFamilyTicket(${t.id})" class="bg-white p-3 rounded-xl border cursor-pointer ${isUnread ? 'border-red-300 shadow-md bg-red-50/10' : (t.status === 'resolved' ? 'border-green-200' : 'border-slate-200')} mb-2 shadow-sm transition hover:shadow-md hover:border-blue-300 relative">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="font-bold text-slate-800 text-sm flex items-center">
                            <i class="fa-regular fa-comment-dots text-slate-400 ml-1"></i> 
                            <span class="truncate max-w-[120px] inline-block mr-1">${safeStr(t.subject)}</span>
                            ${unreadBadge}
                        </span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 leading-relaxed truncate">${safeStr(t.description)}</p>
                    ${lastReply ? `<div class="bg-indigo-50 p-2.5 rounded-lg text-xs border border-indigo-100 mt-2 truncate"><strong class="text-indigo-600 mb-1 block"><i class="fa-solid fa-headset"></i> צוות ענה לאחרונה:</strong>${safeStr(lastReply)}</div>` : ''}
                    <div class="text-[10px] text-blue-500 font-bold text-left w-full mt-2">לחץ לפירוט והמשך שיחה <i class="fa-solid fa-chevron-left"></i></div>
                </div>
                `;
            }).join('');
        } else {
             const list = document.getElementById('user-tickets-list');
             if(list && !silent) list.innerHTML = '<p class="text-xs text-red-400 text-center py-6">שגיאה בטעינת הנתונים.</p>';
        }
    } catch (err) {
        console.error('Error fetching tickets in client:', err);
    }
};

window.openFamilyTicket = function(id) {
    const ticket = (window.familyTicketsCache || []).find(t => t.id === id);
    if(!ticket) return;

    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}
    
    // סימון הקריאה כנקראה (מעדכן את מונה ההודעות עבור ה-ID הזה ומכבה התראות)
    window.markTicketAsRead(id, parsedLog.length);

    let modal = document.getElementById('family-ticket-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'family-ticket-detail-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(modal);
    }

    const logHtml = parsedLog.map(l => {
        const isMe = !l.isStaff;
        const alignClass = isMe ? 'bg-blue-50 border-blue-100 mr-auto rounded-tr-none' : 'bg-indigo-50 border-indigo-100 ml-auto rounded-tl-none';
        const nameClass = isMe ? 'text-blue-600' : 'text-indigo-600';
        const icon = isMe ? 'fa-user' : 'fa-headset';
        const d = new Date(l.date);
        const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
        return `
            <div class="p-3 rounded-xl border w-[85%] mb-3 shadow-sm ${alignClass}">
                <div class="flex justify-between items-center mb-1 text-[10px]">
                    <span class="font-bold ${nameClass}"><i class="fa-solid ${icon}"></i> ${safeStr(l.sender)}</span>
                    <span class="text-slate-400">${dateStr}</span>
                </div>
                <p class="text-sm text-slate-700 whitespace-pre-wrap">${safeStr(l.message)}</p>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 class="font-bold text-slate-800 text-sm truncate pr-8 pl-4"><i class="fa-solid fa-ticket text-blue-500 ml-1"></i> ${safeStr(ticket.subject)}</h3>
                <button onclick="document.getElementById('family-ticket-detail-modal').classList.add('hidden'); window.fetchMyTickets();" class="absolute top-3 left-3 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-times"></i></button>
            </div>
            
            <div id="family-ticket-log" class="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                ${logHtml}
            </div>

            <div class="p-4 bg-white border-t border-slate-100">
                <textarea id="family-ticket-reply-text" rows="2" class="modern-input w-full py-2 text-sm mb-2 resize-none" placeholder="הקלידו תגובה לצוות התמיכה..."></textarea>
                <button onclick="replyFamilyTicket(${ticket.id})" id="btn-family-ticket-reply" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i></button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    const logContainer = document.getElementById('family-ticket-log');
    setTimeout(() => { logContainer.scrollTop = logContainer.scrollHeight; }, 50);
    
    // רענון הרשימה מאחורי הקלעים כדי להעלים את תגית "תגובה חדשה!" מהרשימה עצמה באופן מיידי
    fetchMyTickets(true); 
};

// משלבים קריאה שקטה לקבלת הפניות ברקע, כדי להציג את בועת ההתראה מיד כשהמשתמש פותח את האפליקציה!
const _origFetchDataForTicketsBadge = window.fetchData;
if (_origFetchDataForTicketsBadge && !window.hookedTicketsBadge) {
    window.fetchData = async function() {
        await _origFetchDataForTicketsBadge();
        // מושכים קריאות באופן שקט (Silent) פעם בכמה זמן כדי לעדכן רק את ה-Badge באייקון האוזניות
        if (typeof window.fetchMyTickets === 'function') window.fetchMyTickets(true);
    };
    window.hookedTicketsBadge = true;
}
// ==========================================
// OVERRIDE FINAL: התראות קריאות שירות בזמן אמת (פולינג עצמאי)
// ==========================================

// פונקציות עזר לשמירת מצב הקריאה בדפדפן
window.getReadTicketsState = function() {
    try { return JSON.parse(localStorage.getItem('ofl_tickets_read_state')) || {}; } 
    catch(e) { return {}; }
};

window.markTicketAsRead = function(ticketId, logLength) {
    const state = window.getReadTicketsState();
    state[ticketId] = logLength;
    localStorage.setItem('ofl_tickets_read_state', JSON.stringify(state));
    window.updateTicketsBadgeUI(); 
};

window.checkIfUnread = function(ticket) {
    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}
    
    if (parsedLog.length > 0) {
        const lastMsg = parsedLog[parsedLog.length - 1];
        if (lastMsg.isStaff) {
            const state = window.getReadTicketsState();
            const savedLength = state[ticket.id] || 0;
            if (parsedLog.length > savedLength) {
                return true;
            }
        }
    }
    return false;
};

// עדכון בועת ההתראה על אייקון האוזניות מחוץ למודאל
window.updateTicketsBadgeUI = function() {
    if (!window.familyTicketsCache) return;
    const unreadCount = window.familyTicketsCache.filter(t => window.checkIfUnread(t)).length;
    
    const triggerBtns = document.querySelectorAll('[onclick*="openTicketsModal"]');
    triggerBtns.forEach(btn => {
        const existingBadge = btn.querySelector('.ticket-unread-badge');
        if (existingBadge) existingBadge.remove();
        
        if (unreadCount > 0) {
            btn.style.position = 'relative';
            const badge = document.createElement('span');
            badge.className = 'ticket-unread-badge absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-pulse z-50';
            badge.innerText = unreadCount;
            btn.appendChild(badge);
        }
    });
};

// שכתוב הפונקציה כדי שתתמוך ב-Silent Load (משיכת נתונים ברקע)
window.fetchMyTickets = async function(silent = false) {
    try {
        const token = localStorage.getItem('ofl_token');
        if (!currentGroup || !currentGroup.id) return;
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/support/tickets/my/${currentGroup.id}`, {
            headers: { 'Authorization': token || '' }
        });
        const data = await res.json();
        
        if (data.success && data.tickets) {
            window.familyTicketsCache = data.tickets; 
            window.updateTicketsBadgeUI(); // עדכון הבועה על האייקון מיד לאחר המשיכה
            
            const list = document.getElementById('user-tickets-list');
            const modal = document.getElementById('tickets-modal');
            const isModalOpen = modal && !modal.classList.contains('hidden');
            
            // אם המשיכה שקטה והמודאל בכלל סגור, אפשר לעצור פה ולחסוך רינדור HTML מיותר
            if (silent && !isModalOpen) return;
            
            if (!list) return;
            
            if (data.tickets.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl mt-2">אין קריאות פתוחות כרגע.</p>';
                return;
            }
            
            list.innerHTML = data.tickets.map(t => {
                let lastReply = '';
                let parsedLog = [];
                try { parsedLog = typeof t.log === 'string' ? JSON.parse(t.log) : (t.log || []); } catch(e){}
                
                const staffReplies = parsedLog.filter(l => l.isStaff);
                if (staffReplies.length > 0) {
                    lastReply = staffReplies[staffReplies.length - 1].message;
                }
                
                const isUnread = window.checkIfUnread(t);
                const unreadBadge = isUnread ? `<span class="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 shadow-sm animate-pulse">תגובה חדשה!</span>` : '';
                
                return `
                <div onclick="openFamilyTicket(${t.id})" class="bg-white p-3 rounded-xl border cursor-pointer ${isUnread ? 'border-red-300 shadow-md bg-red-50/10' : (t.status === 'resolved' ? 'border-green-200' : 'border-slate-200')} mb-2 shadow-sm transition hover:shadow-md hover:border-blue-300 relative">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="font-bold text-slate-800 text-sm flex items-center">
                            <i class="fa-regular fa-comment-dots text-slate-400 ml-1"></i> 
                            <span class="truncate max-w-[120px] inline-block mx-1">${safeStr(t.subject)}</span>
                            ${unreadBadge}
                        </span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            t.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }">${t.status === 'resolved' ? 'סגור' : t.status === 'in_progress' ? 'בטיפול' : 'פתוח'}</span>
                    </div>
                    <p class="text-xs text-slate-600 mb-2 leading-relaxed truncate">${safeStr(t.description)}</p>
                    ${lastReply ? `<div class="bg-indigo-50 p-2.5 rounded-lg text-xs border border-indigo-100 mt-2 truncate"><strong class="text-indigo-600 mb-1 block"><i class="fa-solid fa-headset"></i> צוות ענה לאחרונה:</strong>${safeStr(lastReply)}</div>` : ''}
                    <div class="text-[10px] text-blue-500 font-bold text-left w-full mt-2">לחץ לפירוט והמשך שיחה <i class="fa-solid fa-chevron-left"></i></div>
                </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error fetching tickets in client:', err);
    }
};

window.openFamilyTicket = function(id) {
    const ticket = (window.familyTicketsCache || []).find(t => t.id === id);
    if(!ticket) return;

    let parsedLog = [];
    try { parsedLog = typeof ticket.log === 'string' ? JSON.parse(ticket.log) : (ticket.log || []); } catch(e){}
    
    // סימון הקריאה כנקראה - מאפס את בועת ההתראה
    window.markTicketAsRead(id, parsedLog.length);

    let modal = document.getElementById('family-ticket-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'family-ticket-detail-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(modal);
    }

    const logHtml = parsedLog.map(l => {
        const isMe = !l.isStaff;
        const alignClass = isMe ? 'bg-blue-50 border-blue-100 mr-auto rounded-tr-none' : 'bg-indigo-50 border-indigo-100 ml-auto rounded-tl-none';
        const nameClass = isMe ? 'text-blue-600' : 'text-indigo-600';
        const icon = isMe ? 'fa-user' : 'fa-headset';
        const d = new Date(l.date);
        const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
        return `
            <div class="p-3 rounded-xl border w-[85%] mb-3 shadow-sm ${alignClass}">
                <div class="flex justify-between items-center mb-1 text-[10px]">
                    <span class="font-bold ${nameClass}"><i class="fa-solid ${icon}"></i> ${safeStr(l.sender)}</span>
                    <span class="text-slate-400">${dateStr}</span>
                </div>
                <p class="text-sm text-slate-700 whitespace-pre-wrap">${safeStr(l.message)}</p>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 class="font-bold text-slate-800 text-sm truncate pr-8 pl-4"><i class="fa-solid fa-ticket text-blue-500 ml-1"></i> ${safeStr(ticket.subject)}</h3>
                <button onclick="document.getElementById('family-ticket-detail-modal').classList.add('hidden'); window.fetchMyTickets(false);" class="absolute top-3 left-3 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-times"></i></button>
            </div>
            
            <div id="family-ticket-log" class="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                ${logHtml}
            </div>

            <div class="p-4 bg-white border-t border-slate-100">
                <textarea id="family-ticket-reply-text" rows="2" class="modern-input w-full py-2 text-sm mb-2 resize-none" placeholder="הקלידו תגובה לצוות התמיכה..."></textarea>
                <button onclick="replyFamilyTicket(${ticket.id})" id="btn-family-ticket-reply" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i></button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    const logContainer = document.getElementById('family-ticket-log');
    setTimeout(() => { logContainer.scrollTop = logContainer.scrollHeight; }, 50);
    
    // רענון שקט כדי להעלים את התגית מהרשימה מאחור
    window.fetchMyTickets(true); 
};

window.replyFamilyTicket = async function(id) {
    const input = document.getElementById('family-ticket-reply-text');
    const text = input.value.trim();
    if(!text) return typeof showToast === 'function' ? showToast('error', 'נא לכתוב תגובה') : alert('נא לכתוב תגובה');
    
    const btn = document.getElementById('btn-family-ticket-reply');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
        const token = localStorage.getItem('ofl_token');
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/support/tickets/${id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token || '' },
            body: JSON.stringify({ 
                message: text, 
                userName: currentUser ? currentUser.nickname : 'לקוח', 
                isStaff: false 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            input.value = '';
            if (typeof showToast === 'function') showToast('success', 'התגובה נשלחה לצוות');
            await fetchMyTickets(true); 
            openFamilyTicket(id); 
        } else {
            if (typeof showToast === 'function') showToast('error', data.error || 'שגיאה בשליחה');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('error', 'שגיאת רשת');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'שליחת תגובה <i class="fa-solid fa-paper-plane mr-1"></i>';
    }
};

// ==========================================
// OVERRIDE FINAL: מודול תיבת הודעות (Inbox) למשפחות בזמן אמת
// ==========================================

window.familyInboxCache = [];

window.fetchInboxMessages = async function(silent = false) {
    try {
        if (!currentGroup || !currentGroup.id) return;
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        
        const res = await fetch(`${apiPath}/inbox/${currentGroup.id}`);
        const data = await res.json();
        
        if (data.success && data.messages) {
            window.familyInboxCache = data.messages;
            window.updateInboxBadgeUI();
            
            const modal = document.getElementById('inbox-modal');
            const isModalOpen = modal && !modal.classList.contains('hidden');
            
            // נרנדר את הרשימה רק אם המודאל פתוח או אם זו קריאה יזומה מהמשתמש
            if (!silent || isModalOpen) {
                window.renderInboxList();
            }
        }
    } catch(e) {
        console.error('Error fetching inbox:', e);
    }
};

window.updateInboxBadgeUI = function() {
    const unreadCount = window.familyInboxCache.filter(m => !m.is_read).length;
    const badge = document.getElementById('unread-inbox-badge');
    if (!badge) return;
    
    if (unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.classList.remove('hidden');
        badge.classList.add('animate-pulse');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('animate-pulse');
    }
};

window.openInboxModal = function() {
    const modal = document.getElementById('inbox-modal');
    if (modal) {
        modal.classList.remove('hidden');
        window.fetchInboxMessages(false);
    }
};

window.renderInboxList = function() {
    const list = document.getElementById('inbox-messages-list');
    if (!list) return;
    
    if (window.familyInboxCache.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">אין הודעות בתיבה.</p>';
        return;
    }
    
    list.innerHTML = window.familyInboxCache.map(m => {
        const isUnread = !m.is_read;
        const bgClass = isUnread ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-slate-100 shadow-sm opacity-80';
        const iconClass = isUnread ? 'fa-envelope text-blue-500' : 'fa-envelope-open text-slate-400';
        const d = new Date(m.created_at);
        const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
        
        return `
        <div onclick="openInboxMessage(${m.id})" class="p-3 rounded-xl border cursor-pointer transition hover:shadow-md mb-2 ${bgClass}">
            <div class="flex justify-between items-start mb-1">
                <div class="flex items-center gap-2">
                    <i class="fa-solid ${iconClass}"></i>
                    <h4 class="font-bold text-sm ${isUnread ? 'text-slate-800' : 'text-slate-600'}">${safeStr(m.subject)}</h4>
                </div>
                ${isUnread ? '<span class="w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-sm animate-pulse"></span>' : ''}
            </div>
            <div class="flex justify-between items-center mt-2">
                <span class="text-[10px] text-slate-500 bg-white/50 px-2 py-0.5 rounded-md border border-slate-200">מאת: ${safeStr(m.sender_name)}</span>
                <span class="text-[10px] text-slate-400">${dateStr}</span>
            </div>
        </div>
        `;
    }).join('');
};

window.openInboxMessage = async function(id) {
    const msg = window.familyInboxCache.find(m => m.id === id);
    if (!msg) return;
    
    if (!msg.is_read) {
        msg.is_read = true;
        window.updateInboxBadgeUI();
        window.renderInboxList(); 
        
        try {
            const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
            await fetch(`${apiPath}/inbox/${id}/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isRead: true })
            });
        } catch(e) { console.error('Error marking as read', e); }
    }
    
    let msgModal = document.getElementById('inbox-read-modal');
    if (!msgModal) {
        msgModal = document.createElement('div');
        msgModal.id = 'inbox-read-modal';
        msgModal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 fade-in';
        document.body.appendChild(msgModal);
    }
    
    const d = new Date(msg.created_at);
    const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
    
    // זיהוי החתימה הדיגיטלית המעודכנת מהסופר אדמין
    const isRichHtml = msg.content && (msg.content.includes('') || (msg.content.includes('<div') && msg.content.includes('style=')));
    
    const displayContent = isRichHtml 
        ? `<div class="w-full overflow-y-auto max-h-[65vh] bg-slate-50">${msg.content}</div>`
        : `<div class="p-6 overflow-y-auto max-h-[60vh] text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">${safeStr(msg.content)}</div>`;
    
    msgModal.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative border border-slate-200">
            <div class="p-5 border-b border-slate-100 bg-blue-50/50 flex justify-between items-start shrink-0">
                <div class="pr-8">
                    <h3 class="font-bold text-slate-800 text-lg leading-tight mb-2">${safeStr(msg.subject)}</h3>
                    <div class="flex items-center gap-2 text-xs text-slate-500">
                        <span class="bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100"><i class="fa-solid fa-user-circle text-blue-400"></i> ${safeStr(msg.sender_name)}</span>
                        <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                    </div>
                </div>
                <button onclick="document.getElementById('inbox-read-modal').classList.add('hidden')" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm border border-slate-200"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            ${displayContent}
            
            <div class="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
                <button onclick="document.getElementById('inbox-read-modal').classList.add('hidden')" class="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition w-full text-sm">הבנתי וקראתי</button>
            </div>
        </div>
    `;
    
    msgModal.classList.remove('hidden');
};

// --- הפעלת מנוע פולינג (Polling) עצמאי משולב ---
if (window.ticketPollIntervalId) {
    clearInterval(window.ticketPollIntervalId);
}
// נריץ בדיקה שקטה כל 15 שניות, באופן בלתי תלוי
window.ticketPollIntervalId = setInterval(() => {
    if (window.currentUser && window.currentGroup && window.currentGroup.id) {
        if (typeof window.fetchMyTickets === 'function') window.fetchMyTickets(true);
        if (typeof window.fetchInboxMessages === 'function') window.fetchInboxMessages(true);
    }
}, 15000);

// משיכה ראשונית בעליית המערכת (לאחר טעינת היוזר)
const _origFetchDataForInbox = window.fetchData;
if (_origFetchDataForInbox && !window.hookedInboxFetch) {
    window.fetchData = async function() {
        await _origFetchDataForInbox();
        if (typeof window.fetchInboxMessages === 'function') window.fetchInboxMessages(true);
    };
    window.hookedInboxFetch = true;
}
// ==========================================
// OVERRIDE: מודול צ'אט משפחתי משופר (מהירות מירבית + באנר קבוע)
// ==========================================

window.teamChatCache = [];
window.lastReadChatCount = parseInt(localStorage.getItem('ofl_chat_read_count') || '0');

window.openTeamChatModal = function() {
    const modal = document.getElementById('team-chat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        window.loadTeamChat(false);
    }
};

window.loadTeamChat = async function(silent = true) {
    try {
        if (!currentGroup || !currentGroup.id) return;
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/chat/${currentGroup.id}`);
        const data = await res.json();
        
        if (data.success && data.messages) {
            const newMessages = data.messages;
            if (newMessages.length > window.lastReadChatCount) {
                const unread = newMessages.length - window.lastReadChatCount;
                const badge = document.getElementById('team-chat-unread-badge');
                if (badge) { badge.innerText = unread; badge.classList.remove('hidden'); }
            }
            const modal = document.getElementById('team-chat-modal');
            const isChatOpen = modal && !modal.classList.contains('hidden');
            if (isChatOpen) {
                window.lastReadChatCount = newMessages.length;
                localStorage.setItem('ofl_chat_read_count', window.lastReadChatCount.toString());
                const badge = document.getElementById('team-chat-unread-badge');
                if (badge) badge.classList.add('hidden');
                if (newMessages.length !== window.teamChatCache.length || !silent) {
                    window.teamChatCache = newMessages;
                    window.renderTeamChat();
                }
            } else { window.teamChatCache = newMessages; }
        }
    } catch(e) { console.error('Error fetching chat:', e); }
};

window.renderTeamChat = function() {
    const container = document.getElementById('team-chat-messages');
    if (!container) return;
    
    // 1. טיפול בבאנר מקובע (Sticky) מחוץ לאזור הגלילה
    let stickyBanner = document.getElementById('team-chat-sticky-banner');
    if (!stickyBanner) {
        stickyBanner = document.createElement('div');
        stickyBanner.id = 'team-chat-sticky-banner';
        // עיצוב שמשתלב עם כותרת המודאל ומונע גלילה
        stickyBanner.className = 'shrink-0 z-10 bg-emerald-50 px-4 pb-2 border-b border-emerald-100';
        container.parentNode.insertBefore(stickyBanner, container);
    }

    if (currentUser.role === 'ADMIN') {
        stickyBanner.innerHTML = `
            <div class="bg-indigo-900 text-indigo-100 text-[10px] py-1.5 px-3 rounded-xl text-center shadow-sm">
                <i class="fa-solid fa-clock-rotate-left mr-1 text-indigo-300"></i> ההיסטוריה נמחקת אוטומטית אחרי 3 חודשים
            </div>
        `;
    } else {
        stickyBanner.innerHTML = '';
        stickyBanner.className = 'hidden';
    }

    // 2. רינדור הודעות הצ'אט עצמן
    if (window.teamChatCache.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-10 mt-10"><i class="fa-regular fa-comments text-4xl mb-3 opacity-50"></i><p class="text-sm">אין הודעות עדיין.<br>תהיו הראשונים לכתוב!</p></div>';
        return;
    }
    
    let html = '';
    window.teamChatCache.forEach(msg => {
        const isMe = String(msg.user_id) === String(currentUser.id);
        const alignWrapper = isMe ? 'justify-end' : 'justify-start';
        
        const userColorIndex = parseInt(msg.user_id) % userColors.length;
        const colorClasses = userColors[userColorIndex].split(' '); 
        const bubbleBg = isMe ? 'bg-emerald-500 text-white shadow-emerald-200' : colorClasses[0] + ' text-slate-800 border ' + colorClasses[1] + ' shadow-sm';
        
        const nameColor = isMe ? 'text-emerald-100' : 'text-slate-400';
        const d = new Date(msg.created_at);
        const timeStr = d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
        
        html += `
            <div class="flex w-full ${alignWrapper} mb-3 fade-in">
                <div class="max-w-[85%] flex flex-col ${isMe ? 'items-end text-left' : 'items-start text-right'}">
                    <span class="text-[9px] font-bold ${nameColor} mb-0.5 px-1">${isMe ? 'אני' : safeStr(msg.user_name)}</span>
                    <div class="px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-tight shadow-sm ${bubbleBg} ${isMe ? 'rounded-tl-none' : 'rounded-tr-none'}">
                        ${safeStr(msg.message)}
                    </div>
                    <span class="text-[8px] text-slate-400 mt-1 px-1 opacity-70">${timeStr}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
};

window.sendTeamChatMessage = async function() {
    const input = document.getElementById('team-chat-input');
    const text = input.value.trim();
    if (!text) return;
    const btn = document.getElementById('btn-send-team-chat');
    btn.disabled = true;
    try {
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_token') || '' },
            body: JSON.stringify({ groupId: currentGroup.id, userId: currentUser.id, message: text })
        });
        if ((await res.json()).success) { 
            input.value = ''; 
            await window.loadTeamChat(false); 
        }
    } catch(e) {} finally { btn.disabled = false; input.focus(); }
};

window.downloadChatHistory = function() {
    if (window.teamChatCache.length === 0) return showToast('info', 'אין הודעות לייצוא');
    let text = `היסטוריית צ'אט משפחתית - ${currentGroup.name}\n`;
    text += `הופק בתאריך: ${new Date().toLocaleString('he-IL')}\n`;
    text += `------------------------------------------\n\n`;
    
    window.teamChatCache.forEach(m => {
        const d = new Date(m.created_at);
        const time = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL')}`;
        text += `[${time}] ${m.user_name}: ${m.message}\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FamilyChat_${currentGroup.name}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'הקובץ מוכן להורדה!');
};

// --- מערכת סנכרון צ'אט מהירה במיוחד (זמן אמת) ---
if (window.chatFastPollIntervalId) clearInterval(window.chatFastPollIntervalId);
window.chatFastPollIntervalId = setInterval(() => {
    if (window.currentUser && window.currentGroup && window.currentGroup.id) {
        const modal = document.getElementById('team-chat-modal');
        // אם הצ'אט פתוח, משוך נתונים כל שנייה אחת (1000ms)!
        if (modal && !modal.classList.contains('hidden')) {
            window.loadTeamChat(true); 
        }
    }
}, 1000);

// טיימר נפרד לעדכון הבועה כשהצ'אט סגור (3 שניות לחסוך סוללה)
if (window.chatSlowPollIntervalId) clearInterval(window.chatSlowPollIntervalId);
window.chatSlowPollIntervalId = setInterval(() => {
    if (window.currentUser && window.currentGroup && window.currentGroup.id) {
        const modal = document.getElementById('team-chat-modal');
        if (!modal || modal.classList.contains('hidden')) {
            window.loadTeamChat(true); 
        }
    }
}, 3000);

const _origFetchDataForChat = window.fetchData;
if (_origFetchDataForChat && !window.hookedChatFetch) {
    window.fetchData = async function() {
        await _origFetchDataForChat();
        if (typeof window.loadTeamChat === 'function') window.loadTeamChat(true);
    };
    window.hookedChatFetch = true;
}
// ==========================================
// OVERRIDE FINAL: מודול העוזרת החכמה של המשפחה (FamilAI)
// ==========================================

// פונקציית הפתיחה מחוברת לבועה של העוזרת שבנית ב-HTML
window.openFamilaiChatModal = function() {
    const modal = document.getElementById('familai-chat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const input = document.getElementById('familai-chat-input');
        if (input) setTimeout(() => input.focus(), 100);
        
        const container = document.getElementById('familai-chat-messages');
        if (container) setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
    }
};

window.sendFamilaiChatMessage = async function() {
    const input = document.getElementById('familai-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    const container = document.getElementById('familai-chat-messages');
    const btn = document.getElementById('btn-send-familai-chat');
    const indicator = document.getElementById('familai-typing-indicator');
    
    // ציור הודעת המשתמש בצד שמאל
    const timeStr = new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
    container.innerHTML += `
        <div class="flex w-full justify-end fade-in mt-2">
            <div class="max-w-[85%] flex flex-col items-end text-left">
                <span class="text-[9px] font-bold text-slate-400 mb-1 px-1">אני</span>
                <div class="px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tl-none">
                    ${safeStr(text)}
                </div>
                <span class="text-[8px] text-slate-400 mt-1 px-1 opacity-70">${timeStr}</span>
            </div>
        </div>
    `;
    
    input.value = '';
    btn.disabled = true;
    indicator.classList.remove('hidden');
    indicator.classList.add('flex');
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);

    try {
        const contextData = {
            family_name: currentGroup.name,
            user_name: fmtUserName(currentUser) || currentUser.nickname,
            user_role: currentUser.role,
            members: membersCache.map(m => ({name: fmtUserName(m) || m.nickname, role: m.role, balance: m.balance})),
            pantry: pantryCache.map(p => ({item: p.item_name, qty: p.quantity, unit: p.unit, updated: p.updated_at})),
            shopping_list: shoppingListCache.map(s => ({item: s.item_name, qty: s.quantity, status: s.status})),
            tasks: allTasks.filter(t => t.status !== 'approved').map(t => ({title: t.title, assigned_to: t.assignee_name, reward: t.reward, status: t.status})),
            recent_transactions: allTransactions.slice(0, 40).map(tx => ({desc: tx.description, amount: tx.amount, type: tx.type, date: tx.date})),
            my_communities: (myConnectedCommunitiesCache||[]).map(c => ({id: c.id, name: c.name, type: c.type})),
            flow_balance: familyFlowBalance
        };
        
        const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
        const res = await fetch(`${apiPath}/family/chat-assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_token') || '' },
            body: JSON.stringify({ 
                groupId: currentGroup.id, 
                userId: currentUser.id, 
                query: text,
                context: JSON.stringify(contextData)
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            if (data.action_type === 'OPEN_TAB' && data.action_data?.tab) {
                switchTab(data.action_data.tab);
            }
            let formattedAns = data.answer;
            formattedAns = formattedAns.replace(/\*\*(.*?)\*\*/g, '<strong class="text-purple-700">$1</strong>');
            formattedAns = formattedAns.replace(/\n/g, '<br>');
            
            const aiTime = new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
            // כאן מתבצעת הזרקת תמונת העוזרת במקום אייקון רובוט גנרי
            const aiAvatarHtml = window.currentFamilaiLogo ? `<img src="${window.currentFamilaiLogo}" class="w-4 h-4 rounded-full object-cover shadow-sm inline-block">` : `<i class="fa-solid fa-robot"></i>`;
            
            container.innerHTML += `
                <div class="flex w-full justify-start mt-2 fade-in">
                    <div class="max-w-[85%] flex flex-col items-start text-right">
                        <span class="text-[10px] font-bold text-purple-600 mb-1 px-1 flex items-center gap-1">${aiAvatarHtml} FamilAI</span>
                        <div class="px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-sm bg-white border border-purple-100 text-slate-800 rounded-tr-none">
                            ${formattedAns}
                        </div>
                        <span class="text-[8px] text-slate-400 mt-1 px-1 opacity-70">${aiTime}</span>
                    </div>
                </div>
            `;
            fetchData();
        } else {
            if (data.error === 'BATTERY_EMPTY') {
                showToast('error', 'נגמרה סוללת ה-AI שלכם!');
            } else {
                showToast('error', data.error || 'שגיאה בקבלת תשובה מ-FamilAI');
            }
        }
    } catch(e) {
        showToast('error', 'שגיאת תקשורת מול ה-AI');
    } finally {
        btn.disabled = false;
        indicator.classList.remove('flex');
        indicator.classList.add('hidden');
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
        input.focus();
    }
};
// מנגנון הגנה עליון: שומר על ההרשאות ועל התמונה מלהימחק בריענון!
const _originalFetchDataForPermsAndLogo = window.fetchData;
if (_originalFetchDataForPermsAndLogo && !window.hookedPermsAndLogoFetch) {
    window.fetchData = async function() {
        await _originalFetchDataForPermsAndLogo();
        
        try {
            // 1. שחזור התמונה מהגיבוי הקשיח המקומי (פותר את היעלמות התמונה בריענון!)
            if (currentGroup && currentGroup.id) {
                const hardLogo = localStorage.getItem(`ofl_hard_logo_${currentGroup.id}`);
                if (hardLogo && hardLogo.length > 50) {
                    currentGroup.logo = hardLogo;
                    currentGroup.logo_url = hardLogo;
                    currentGroup.image_url = hardLogo;
                    if (typeof window.renderGroupInfo === 'function') window.renderGroupInfo();
                }
            }
            
            // 2. עדכון הרשאות רציף מול השרת לילדים / בדיקת גיבוי תמונה מהשרת
            if (currentUser && currentUser.id) {
                const apiPath = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:3000/api' : '/api';
                const res = await fetch(`${apiPath}/data/${currentUser.id}`); 
                const data = await res.json();
                
                // גיבוי תמונה מהשרת למקרה שאין לנו במטמון המקומי
                if (data && data.group && (data.group.image_url || data.group.logo || data.group.logo_url)) {
                    const sLogo = data.group.image_url || data.group.logo || data.group.logo_url;
                    if (sLogo.length > 50) {
                        currentGroup.logo = sLogo;
                        localStorage.setItem(`ofl_hard_logo_${currentGroup.id}`, sLogo);
                        if (typeof window.renderGroupInfo === 'function') window.renderGroupInfo();
                    }
                }

                // סידור הרשאות ילדים חיות
                if (data && data.user && data.user.permissions !== undefined) {
                    currentUser.permissions = data.user.permissions;
                    saveSession();
                    if(typeof enforcePermissions === 'function') enforcePermissions();
                }
            }
        } catch(e) {}
    };
    window.hookedPermsAndLogoFetch = true;
}
// ==========================================
// OVERRIDE FINAL: BRUTE FORCE IMPERSONATION BANNER (V3 - UNIFIED GHOST DESIGN)
// מנגנון אוטונומי לסביבת משפחות - תואם ויזואלית לעסקים וסוגר טאב בניתוק
// ==========================================

window.exitImpersonation = function() {
    localStorage.removeItem('ofl_session');
    // סגירת הטאב הנוכחי שבו בוצעה ההשתלטות
    window.close();
    // ליתר ביטחון, אם הדפדפן חוסם סגירה אוטומטית, נרענן לדף הבית
    setTimeout(() => { window.location.href = '/'; }, 100);
};

setInterval(() => {
    const saTokenLocal = localStorage.getItem('ofl_sa_token');
    let bruteBanner = document.getElementById('brute-force-sa-banner');
    
    const activeSession = localStorage.getItem('ofl_session');
    if (saTokenLocal && activeSession) {
        if (document.body.style.paddingTop !== '45px') {
            document.body.style.paddingTop = '45px';
        }
        
        if (!bruteBanner) {
            // שליפת שם הלקוח (המשפחה) מהסשן
            let customerName = 'לקוח';
            try {
                const session = JSON.parse(activeSession);
                if (session && session.group) customerName = session.group.name;
            } catch(e) {}

            bruteBanner = document.createElement('div');
            bruteBanner.id = 'brute-force-sa-banner';
            
            // עיצוב Ghost אדום - זהה לחלוטין לעסקים
            bruteBanner.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 2147483647 !important; display: flex !important; justify-content: space-between !important; align-items: center !important; width: 100% !important; background-color: #dc2626 !important; color: white !important; padding: 0 20px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important; font-family: 'Rubik', sans-serif !important; direction: rtl !important; height: 45px !important; box-sizing: border-box !important;";
            
            bruteBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-ghost animate-pulse" style="font-size: 18px;"></i>
                    <span style="font-size: 13px; font-weight: bold; letter-spacing: 0.3px;">מצב תמיכה והשתלטות! אתה צופה כרגע בנתוני הלקוח: ${customerName}</span>
                </div>
                <button onclick="exitImpersonation()" style="background-color: white !important; color: #dc2626 !important; padding: 5px 15px !important; border-radius: 8px !important; font-size: 11px !important; font-weight: 900 !important; border: 2px solid rgba(255,255,255,0.2) !important; cursor: pointer !important; text-transform: uppercase !important; transition: all 0.2s !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;">
                    התנתקות
                </button>
            `;
            
            document.documentElement.appendChild(bruteBanner);
        }
    } else {
        if (bruteBanner) bruteBanner.remove();
        if (document.body.style.paddingTop === '45px') {
            document.body.style.paddingTop = '0px';
        }
    }
}, 500);

// ── ACTIVITY FEED ──────────────────────────────────────────────
const ACTION_ICONS = { finance:'💰', task:'✅', shopping:'🛒', pantry:'📦', business:'🏪', user:'👤' };

async function openActivityPanel() {
  getEl('activity-panel').classList.remove('hidden');
  if (currentUser?.role === 'ADMIN') {
    getEl('activity-filters').classList.remove('hidden');
    const sel = getEl('filter-user');
    sel.innerHTML = '<option value="">כל המשתמשים</option>';
    if (membersCache) membersCache.forEach(m => sel.innerHTML += `<option value="${m.id}">${safeStr(m.nickname)}</option>`);
  }
  ['filter-days','filter-type','filter-user'].forEach(id => {
    const el = getEl(id);
    if (el) el.addEventListener('change', loadActivityFeed);
  });
  await loadActivityFeed();
}

function closeActivityPanel() {
  getEl('activity-panel').classList.add('hidden');
  const badge = getEl('bell-badge');
  if (badge) badge.classList.add('hidden');
}

async function loadActivityFeed() {
  const days = getEl('filter-days')?.value || 30;
  const type = getEl('filter-type')?.value || 'all';
  const filterUser = getEl('filter-user')?.value || '';
  const list = getEl('activity-list');
  list.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">טוען...</div>';
  try {
    let url = `${API}/activity?userId=${currentUser.id}&days=${days}`;
    if (type !== 'all') url += `&actionType=${type}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success || !data.activities.length) {
      list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין פעולות להצגה</div>';
      return;
    }
    let acts = data.activities;
    if (filterUser) acts = acts.filter(a => String(a.user_id) === String(filterUser));
    list.innerHTML = acts.map(a => {
      const icon = ACTION_ICONS[a.action_type] || '•';
      const time = new Date(a.created_at).toLocaleString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const who = a.nickname || a.user_name || 'מערכת';
      return `<div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
        <div class="flex items-start gap-2">
          <span class="text-lg flex-shrink-0">${icon}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-700 leading-snug">${safeStr(a.description)}</p>
            <p class="text-xs text-slate-400 mt-1">${safeStr(who)} · ${time}</p>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { list.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">שגיאה בטעינה</div>'; }
}

async function refreshBellBadge() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API}/activity?userId=${currentUser.id}&days=1&limit=1`);
    const data = await res.json();
    const badge = getEl('bell-badge');
    if (!badge) return;
    const count = data.unreadCount || 0;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch(e) {}
}

// ── QUICK ACCESS TILES ─────────────────────────────────────────
function renderQuickTiles() {
  const container = getEl('quick-tiles');
  if (!container) return;
  const shopCount = (shoppingListCache || []).filter(i => i.status === 'pending' || i.status === 'in_cart').length;
  const pantryCount = (pantryCache || []).length;
  const taskCount = (allTasks || []).filter(t => t.status === 'pending').length;
  const tiles = [
    { fa:'fa-cart-shopping',  label:'קניות',        badge: shopCount,   tab:'shop',             bg:'#ecfdf5', grad:'linear-gradient(135deg,#34d399,#0d9488)', badge_bg:'#059669' },
    { fa:'fa-box-open',       label:'מזווה',         badge: pantryCount, tab:'pantry',           bg:'#fff7ed', grad:'linear-gradient(135deg,#fb923c,#ea580c)', badge_bg:'#c2410c' },
    { fa:'fa-chart-pie',      label:'תקציב',         badge: null,        tab:'cashflow',         bg:'#eff6ff', grad:'linear-gradient(135deg,#60a5fa,#4f46e5)', badge_bg:'#2563eb' },
    { fa:'fa-people-group',   label:'הקהילה שלי',    badge: null,        tab:'community',        bg:'#faf5ff', grad:'linear-gradient(135deg,#c084fc,#db2777)', badge_bg:'#7c3aed' },
    { fa:'fa-list-check',     label:'משימות',        badge: taskCount,   tab:'tasks',            bg:'#f0fdf4', grad:'linear-gradient(135deg,#4ade80,#16a34a)', badge_bg:'#15803d' },
    { fa:'fa-wrench',         label:'ניהול הבית',    badge: null,        tab:'home-maintenance', bg:'#fefce8', grad:'linear-gradient(135deg,#fbbf24,#d97706)', badge_bg:'#b45309' },
    { fa:'fa-clipboard-list', label:'הזמנות שלי',    badge: null,        tab:'myorders',         bg:'#fff1f2', grad:'linear-gradient(135deg,#fb7185,#e11d48)', badge_bg:'#be123c', fullWidth: true },
  ];
  const isMember = currentGroup?.member_type === 'member';
  const unlockedMods = currentGroup?.unlocked_modules || [];
  container.innerHTML = tiles.map(t => {
    const isMyOrders = t.tab === 'myorders';
    const fullWidthStyle = t.fullWidth ? 'grid-column:1/-1;' : '';
    const locked = isMember && !isMyOrders && !unlockedMods.includes(t.tab);
    if (locked) {
      return `<button onclick="showMemberModuleUpgrade('${t.tab}')"
          style="background:#f8fafc;border:1.5px solid rgba(0,0,0,0.06);opacity:0.7;${fullWidthStyle}"
          class="relative rounded-2xl p-3.5 flex flex-col items-center gap-2 shadow-sm cursor-pointer">
          <div style="background:linear-gradient(135deg,#94a3b8,#64748b)" class="w-11 h-11 rounded-xl flex items-center justify-center shadow-md mb-0.5">
            <i class="fa-solid fa-lock text-white text-lg"></i>
          </div>
          <span class="text-[11px] font-bold text-slate-400 text-center leading-tight">${t.label}</span>
        </button>`;
    }
    const fullWidthInner = t.fullWidth ? 'flex-row gap-3 justify-center' : 'flex-col';
    return `<button onclick="switchTab('${t.tab}')"
      style="background:${t.bg};border:1.5px solid rgba(0,0,0,0.06);${fullWidthStyle}"
      class="relative rounded-2xl p-3.5 flex ${fullWidthInner} items-center gap-2 shadow-sm hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer">
      <div style="background:${t.grad}" class="w-11 h-11 rounded-xl flex items-center justify-center shadow-md ${t.fullWidth ? 'flex-shrink-0' : 'mb-0.5'}">
        <i class="fa-solid ${t.fa} text-white text-lg"></i>
      </div>
      <span class="text-[11px] font-bold text-slate-600 ${t.fullWidth ? 'text-base' : 'text-center'} leading-tight">${t.label}</span>
      ${t.badge !== null && t.badge > 0 ? `<span style="background:${t.badge_bg}" class="absolute -top-1.5 -right-1.5 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md">${t.badge}</span>` : ''}
    </button>`;
  }).join('');
}

// ── FAMILY URGENT ITEMS — "מה מחכה לך" ──────────────────────
async function renderFamilyUrgentItems() {
    const section = document.getElementById('family-urgent-section');
    const list    = document.getElementById('family-urgent-list');
    const badge   = document.getElementById('family-urgent-badge');
    if (!section || !list || !currentGroup) return;

    const isAdmin = currentUser?.role === 'ADMIN';
    const now     = new Date();
    const todayStr = now.toDateString();
    const items   = [];

    const C = {
        high:   { bg:'bg-red-50',   border:'border-red-100',   ibg:'bg-red-100',   txt:'text-red-600' },
        medium: { bg:'bg-amber-50', border:'border-amber-100', ibg:'bg-amber-100', txt:'text-amber-700' },
        low:    { bg:'bg-slate-50', border:'border-slate-100', ibg:'bg-slate-100', txt:'text-slate-500' }
    };

    if (isAdmin) {
        // ─ משימות ממתינות לאישור ─
        const pendingApproval = (allTasks || []).filter(t => t.status === 'completed' || t.status === 'done');
        if (pendingApproval.length > 0)
            items.push({ icon:'✅', urgency:'high',
                title:`${pendingApproval.length} משימות ממתינות לאישורך`,
                sub: pendingApproval.slice(0,2).map(t => t.title).join(', '),
                tab:'tasks', actionLabel:'אשר' });

        // ─ פריטי קניות ממתינים לאישור ─
        const pendingShop = (shoppingListCache || []).filter(i => i.status === 'pending_approval');
        if (pendingShop.length > 0)
            items.push({ icon:'🛒', urgency:'high',
                title:`${pendingShop.length} בקשות קניה ממתינות`,
                sub: pendingShop.slice(0,2).map(i => i.name).join(', '),
                tab:'shop', actionLabel:'בדוק' });

        // ─ משימות שעברו דד-ליין ─
        const overdue = (allTasks || []).filter(t =>
            t.status === 'pending' && t.deadline && new Date(t.deadline) < now
        );
        if (overdue.length > 0)
            items.push({ icon:'⏰', urgency:'medium',
                title:`${overdue.length} משימות שעברו דד-ליין`,
                sub: overdue.slice(0,2).map(t => t.title).join(', '),
                tab:'tasks', actionLabel:'ראה' });

        // ─ מלאי מזווה נמוך ─
        const lowPantry = (pantryCache || []).filter(p => parseFloat(p.quantity) <= 1);
        if (lowPantry.length > 0)
            items.push({ icon:'📦', urgency:'low',
                title:`${lowPantry.length} פריטים במזווה כמעט נגמרו`,
                sub: lowPantry.slice(0,3).map(p => p.item_name).join(', '),
                tab:'pantry', actionLabel:'עדכן' });

        // ─ תחזוקה ותקלות בבית ─
        try {
            const [hmMRes, hmFRes] = await Promise.all([
                fetch(`/api/equipment/maintenance/${currentGroup.id}`),
                fetch(`/api/equipment/faults/${currentGroup.id}`)
            ]);
            const hmMData = await hmMRes.json();
            const hmFData = await hmFRes.json();
            if (hmMData.success) {
                const today2 = new Date(); today2.setHours(0,0,0,0);
                const in7 = new Date(today2); in7.setDate(today2.getDate() + 7);
                const urgMaint = hmMData.records.filter(m => {
                    if (m.status === "completed" || !m.scheduled_date) return false;
                    const sd = new Date(m.scheduled_date); sd.setHours(0,0,0,0);
                    return sd <= in7;
                });
                if (urgMaint.length > 0) {
                    const late = urgMaint.filter(m => new Date(m.scheduled_date) < today2);
                    items.push({ icon:"🔧", urgency: late.length > 0 ? "high" : "medium",
                        title:`${urgMaint.length} תחזוקות בית ממתינות${late.length > 0 ? " (" + late.length + " באיחור)" : ""}`,
                        sub: urgMaint[0].description || "", tab:"home-maintenance", actionLabel:"טפל" });
                }
            }
            if (hmFData.success) {
                const openF = hmFData.faults.filter(f => f.status !== "resolved");
                if (openF.length > 0) {
                    const crit = openF.filter(f => f.severity === "critical" || f.severity === "high");
                    items.push({ icon:"⚠️", urgency: crit.length > 0 ? "high" : "medium",
                        title:`${openF.length} תקלות בית פתוחות`,
                        sub: openF[0].title || "", tab:"home-maintenance", actionLabel:"טפל" });
                }
            }
        } catch(e) {}

    } else {
        // ─ ילד/חבר משפחה ─
        // משימות אישיות לסגירה
        const myTasks = (allTasks || []).filter(t => {
            if (t.status === 'approved' || t.status === 'cancelled') return false;
            if (t.assigned_to && String(t.assigned_to) !== String(currentUser?.id)) return false;
            return t.status === 'pending';
        });
        if (myTasks.length > 0) {
            const overdue = myTasks.filter(t => t.deadline && new Date(t.deadline) < now);
            items.push({ icon:'✅', urgency: overdue.length > 0 ? 'high' : 'medium',
                title:`${myTasks.length} משימות שלך ממתינות`,
                sub: myTasks.slice(0,2).map(t => t.title).join(', '),
                tab:'tasks', actionLabel:'בצע' });
        }

        // אתגרי אקדמיה ממתינים
        const myAcademy = (bundlesCache || []).filter(b => b.status === 'assigned');
        if (myAcademy.length > 0)
            items.push({ icon:'🎓', urgency:'medium',
                title:`${myAcademy.length} אתגרי אקדמיה ממתינים לך`,
                sub: myAcademy.slice(0,2).map(b => b.title).join(', '),
                tab:'academy', actionLabel:'התחל' });
    }

    if (items.length === 0) { section.classList.add('hidden'); return; }

    list.innerHTML = items.map((item, i) => {
        const c = C[item.urgency] || C.low;
        const sep = i < items.length - 1 ? `border-b ${c.border}` : '';
        return `<div class="flex items-center gap-3 px-4 py-3 ${c.bg} ${sep} cursor-pointer active:opacity-70 transition-opacity"
                     onclick="switchTab('${item.tab}')">
          <div class="w-9 h-9 rounded-xl ${c.ibg} flex items-center justify-center flex-shrink-0 text-base">${item.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold text-slate-800 leading-tight">${item.title}</div>
            <div class="text-[10px] text-slate-400 mt-0.5 truncate">${item.sub}</div>
          </div>
          <span class="text-[10px] font-bold ${c.txt} bg-white border ${c.border} rounded-full px-2.5 py-1 flex-shrink-0 whitespace-nowrap">${item.actionLabel} →</span>
        </div>`;
    }).join('');

    if (badge) badge.textContent = items.length;
    section.classList.remove('hidden');
}

// ════════════════════════════════════════════════
// ★ HELP SYSTEM — תוכן עזרה לכל מודול (משפחה)
// ════════════════════════════════════════════════
window._currentFamilyTab = 'feed';

const FAMILY_HELP_CONTENT = {
    feed: {
        icon: '🏠', title: 'לוח ראשי',
        what: 'דשבורד אישי — יתרת הכסף שלך, משימות פתוחות ופעולות דחופות.',
        what_admin: 'דשבורד משפחתי — סיכום יתרות כלל בני המשפחה, משימות פתוחות ופעולות דחופות.',
        tips: [
            '💰 הכרטיס הגדול מציג את יתרת הכסף האישית שלך',
            '⚡ "מה מחכה לך" — פעולות דחופות הדורשות תשומת לב',
            '🎯 הכרטיסים הקטנים — קישורים מהירים לפעולות נפוצות',
            '🔔 לחץ על הפעמון לצפייה בכל הפעילות האחרונה',
        ],
        tips_admin: [
            '👨‍👩‍👧 אתה רואה סיכום של כלל המשפחה — יתרות, בקשות ומשימות',
            '⚡ "מה מחכה לך" — בקשות קנייה ודיווחי משימות הממתינות לאישורך',
            '🔔 כל פעולת ילד מופיעה בעדכונים — אישור, תגמול, חסימה',
            '🎯 לחץ על כרטיס ילד לצפייה מהירה בפעילותו',
            '⚙️ עבור ל"ניהול משפחה" להגדרות מלאות',
        ]
    },
    shop: {
        icon: '🛒', title: 'בקשות קנייה',
        what: 'שלח בקשות לרכישת מוצרים, ועקוב אחר הסטטוס עד לאישור ההורה.',
        what_admin: 'ניהול בקשות קנייה של בני המשפחה — אשר, דחה, או קנה בעצמך.',
        tips: [
            '➕ לחץ "+ בקשה" לפתיחת בקשת קנייה חדשה',
            '📝 ציין את שם המוצר, כמות ומחיר משוער',
            '⏳ הבקשה נשלחת לאישור ההורה — המתן!',
            '✅ לאחר אישור — המוצר יירכש ויגיע!',
            '🛍️ ניתן לעקוב אחר סטטוס כל בקשה',
        ],
        tips_admin: [
            '📋 כל בקשות הקנייה של הילדים מוצגות כאן',
            '✅ לחץ "אשר" לאישור הרכישה — הילד מקבל הודעה',
            '❌ לחץ "דחה" + סיבה — הילד יראה את ההסבר',
            '🛒 ניתן גם לקנות מיד דרך עסקים מקומיים בקהילה',
            '💰 רכישה מאושרת מנכה אוטומטית מיתרת הארנק המשפחתי',
        ]
    },
    myorders: {
        icon: '🛵', title: 'הזמנות מעסקים',
        what: 'עקוב אחר הזמנות שביצעת מעסקים מקומיים בקהילה — מזון, מוצרים ומשלוחים.',
        what_admin: 'סיכום כל הזמנות המשפחה מעסקים מקומיים — בכל הסטטוסים.',
        tips: [
            '🏪 הזמנות נוצרות כשמזמינים מחנות עסק מקומי בקהילה',
            '🟡 "התקבל בעסק" — ההזמנה נקלטה ובטיפול',
            '📦 "באריזה / הכנה" — העסק מכין את ההזמנה',
            '🛵 "בדרך אליך" — השליח בדרך, מגיע בקרוב!',
            '✅ "נמסר" — ההזמנה הושלמה בהצלחה',
        ],
        tips_admin: [
            '📋 ראה את כל הזמנות המשפחה — שלך וגם של הילדים',
            '🔍 סנן לפי ילד ספציפי או לפי סטטוס',
            '📞 יש בעיה עם הזמנה? לחץ על ההזמנה לפרטי קשר העסק',
            '💰 עלויות ההזמנות נרשמות אוטומטית בהיסטוריה הכספית',
            '📊 עבור ל"תקציב" לראות כמה הוצאת על הזמנות החודש',
        ]
    },
    bank: {
        icon: '🐷', title: 'הארנק שלי',
        what: 'ארנק כספי אישי — יתרה, היסטוריה ויעדי חיסכון.',
        what_admin: 'ניהול הכספים המשפחתי — יתרות כלל הילדים, תגמולים ובקשות מקדמה.',
        tips: [
            '💰 יתרתך הנוכחית — כסף שהצטבר ממשימות ולימוד',
            '🎯 הגדר יעד חיסכון — לאיזה מטרה אתה חוסך?',
            '📈 הפס מציג את ההתקדמות לקראת היעד',
            '💸 ניתן לבקש מקדמה — ממתינה לאישור ההורה',
            '🏆 הגע ליעד וקבל בונוס!',
        ],
        tips_admin: [
            '👨‍👩‍👧 ראה יתרת ארנק של כל ילד בנפרד',
            '💸 אשר או דחה בקשות מקדמה מהילדים',
            '🎁 הענק בונוס ידני לילד שהצטיין',
            '🔄 העבר כסף בין ילדים או הוסף/הורד יתרה ידנית',
            '📊 עבור להיסטוריה לראות מאיפה הגיע כל שקל',
        ]
    },
    cashflow: {
        icon: '📜', title: 'היסטוריה',
        what: 'צפייה בכל הפעולות הכספיות שלך — הכנסות, הוצאות ותגמולים.',
        what_admin: 'היסטוריה כספית מלאה של כלל המשפחה — כולל פירוט לפי ילד.',
        tips: [
            '📋 ראה את כל הפעולות הכספיות לפי תאריך',
            '🟢 ירוק = כסף שנכנס (שכר, בונוס, תגמול)',
            '🔴 אדום = כסף שיצא (רכישה, הוצאה)',
            '🔍 חפש פעולה ספציפית לפי שם או סכום',
            '📊 ראה סיכום הכנסות/הוצאות לחודש',
        ],
        tips_admin: [
            '👨‍👩‍👧 בחר "כל המשפחה" לצפייה מאוחדת או סנן לפי ילד',
            '🟢 ירוק = תגמולים, בונוסים; 🔴 אדום = רכישות, הוצאות',
            '📊 ייצא את ההיסטוריה לאקסל לניתוח מעמיק',
            '🔍 חפש לפי ילד, תאריך, סוג פעולה',
            '📅 השווה חודשים לבדיקת מגמות הוצאה',
        ]
    },
    academy: {
        icon: '🎓', title: 'אקדמיה',
        what: 'למד, ענה על שאלות נכון — ותרוויח כסף אמיתי! אתגרים מותאמים אישית.',
        what_admin: 'ניהול אתגרי הלמידה לבני המשפחה — הקצה אתגרים, עקוב אחר התקדמות ותגמל.',
        tips: [
            '🎲 לחץ "הגרל אתגר מהיר" לאתגר רנדומלי',
            '📚 הספרייה — אלפי מבחנים לפי גיל ונושא',
            '💰 כל תשובה נכונה = כסף לארנק שלך',
            '🏆 השלם את כל שאלות האתגר לקבלת הבונוס המלא',
            '📖 ניתן לחזור על אתגרים שהוקצו לך',
        ],
        tips_admin: [
            '➕ הקצה אתגר לילד ספציפי עם בונוס כספי',
            '📚 בחר מהספרייה לפי גיל, נושא ורמת קושי',
            '📊 עקוב אחר ניקוד וסיום אתגרים לכל ילד',
            '💰 הגדר את סכום הבונוס לכל אתגר — מוטיבציה!',
            '🏆 ראה דירוג ילדים לפי הישגים לימודיים',
        ]
    },
    tasks: {
        icon: '✅', title: 'משימות',
        what: 'המשימות שהוקצו לך — בצע, דווח וקבל תגמול!',
        what_admin: 'ניהול משימות המשפחה — צור, הקצה, אשר ותגמל.',
        tips: [
            '📋 ראה את כל המשימות הפעילות שלך',
            '📸 לחץ "דיווח סיום" + צלם הוכחת ביצוע',
            '⏰ שים לב לתאריכי יעד — אל תפספס!',
            '💰 לאחר אישור ההורה — הבונוס נזקף לארנק',
            '📋 משימת SOP = בצע שלב אחר שלב לפי הנוהל',
        ],
        tips_admin: [
            '➕ לחץ "צור משימה" — הגדר שם, תיאור, תאריך יעד ובונוס',
            '👦 הקצה לילד ספציפי או לכל המשפחה',
            '📸 ילד מדווח + מצרף צילום הוכחה — אתה מאשר',
            '✅ לחץ "אשר" לאחר בדיקת ההוכחה — הבונוס עובר אוטומטית',
            '📋 SOP = רצף שלבים עם בדיקת כל שלב בנפרד',
        ]
    },
    community: {
        icon: '👥', title: 'קהילה',
        what: 'קהילות מקומיות — צפה בעסקים בשכונה, הזמן משלוחים ונצל הטבות בלעדיות לחברים.',
        what_admin: 'ניהול חברות הקהילה של המשפחה — הצטרפות, הטבות ועדכונים מקומיים.',
        tips: [
            '🏪 ראה עסקים מקומיים שמציעים הטבות לחברי הקהילה',
            '🛒 לחץ על עסק \u2192 "הזמן" לביצוע הזמנה ממנו',
            '🏷️ הטבות ומבצעים זמינים רק לחברי הקהילה',
            '📢 קרא עדכונים ואירועים שפרסמו עסקים ושכנים',
            '📦 הזמנות מהעסק מופיעות ב"הזמנות מעסקים" שלך',
        ],
        tips_admin: [
            '🏘️ הצטרף לקהילה שכונתית — גישה להטבות ומבצעים בלעדיים',
            '🏪 ראה את כל העסקים המקומיים המשתתפים',
            '📢 פרסם בקשה לשכנים (שירות, עזרה, שיתוף)',
            '📋 עקוב אחר ההזמנות של כל בני המשפחה מהקהילה',
            '⭐ דרג עסקים מקומיים ועזור לשכנים לבחור',
        ]
    },
    members: {
        icon: '👨‍👩‍👧', title: 'ניהול משפחה',
        what: 'פרטי חברות המשפחה שלך — ניתן לראות מידע בסיסי על הקבוצה.',
        what_admin: 'ניהול מלא של חברי המשפחה — הוספה, תפקידים, הגדרות גישה ומעקב.',
        tips: [
            '👀 ראה מי שייך לקבוצה המשפחתית שלך',
            '📋 הצג את יתרתך ופעילותך האחרונה',
        ],
        tips_admin: [
            '➕ לחץ "הוסף חבר" לצירוף בן/בת משפחה',
            '👦 הגדר שם, גיל ותפקיד (ילד / הורה / אחר) לכל חבר',
            '💰 ראה את יתרת הכסף ופעילות כל ילד',
            '📊 עקוב אחר ביצועי כל ילד — משימות, לימוד ותגמולים',
            '⚙️ קבע מה כל ילד רואה ומה מוסתר ממנו',
        ]
    },
    budget: {
        icon: '📊', title: 'תקציב משפחתי',
        what: 'צפה בתקציב המשפחתי — כמה הוצאנו ומה נשאר (נגיש להורה בלבד).',
        what_admin: 'הגדר יעדי הוצאות משפחתיים ועקוב בזמן אמת אחרי עמידה בתקציב.',
        tips: [
            '📊 ראה את הקטגוריות וסכומי ההוצאה',
            '🟢 ירוק = בתקציב; 🔴 אדום = חריגה',
        ],
        tips_admin: [
            '➕ הגדר קטגוריות הוצאה — מזון, בידור, לימודים...',
            '🎯 הגדר תקציב חודשי לכל קטגוריה',
            '📈 המערכת מחשבת אוטומטית את ההוצאות בפועל',
            '🔴 קטגוריות שחרגו מסומנות באדום — פעל מייד',
            '📅 עבור בין תצוגה חודשית לשנתית להשוואה',
        ]
    },
    pantry: {
        icon: '📦', title: 'מזווה',
        what: 'מעקב אחר מה יש בבית — מזון, ניקיון ומוצרים נחוצים.',
        tips: [
            '➕ הוסף מוצר למזווה עם כמות ותאריך תפוגה',
            '🔴 מוצרים שאזלו מסומנים להשלמה',
            '📅 שים לב לתאריכי תפוגה — הימנע מבזבוז',
            '🛒 ניתן לשלוח מוצרים ישירות לרשימת הקנייה',
            '✨ familAI יכולה להמליץ מתכונים לפי מה שיש',
        ],
        tips_admin: [
            '➕ הוסף מוצר עם כמות, יחידה ותאריך תפוגה',
            '🔴 המערכת מתריעה על מוצרים שאזלו או עומדים לפוג',
            '🛒 שלח מוצרים חסרים ישירות לרשימת הקנייה',
            '✨ familAI מנתחת את המזווה ומציעה מתכונים חכמים',
            '📊 ראה היסטוריית צריכה לכל מוצר',
        ]
    },
    recipes: {
        icon: '🍳', title: 'מתכונים',
        what: 'מצא וצור מתכונים מהמרכיבים שיש לך בבית — עם עזרת AI.',
        tips: [
            '✨ לחץ "צור מתכון" ו-familAI תבנה מתכון מהמזווה שלך',
            '🥕 בחר מרכיבים ספציפיים שרוצים להשתמש בהם',
            '👨‍👩‍👧 ציין כמה סועדים לכוונון הכמויות',
            '📋 העתק את המתכון לשמירה או שיתוף',
            '🔄 ניסית מתכון? ניתן לבקש גרסה משופרת',
        ],
        tips_admin: [
            '✨ familAI יוצרת מתכון חכם מהמרכיבים שיש במזווה',
            '🥕 בחר מרכיבים ספציפיים שרוצים להשתמש בהם',
            '👨‍👩‍👧 ציין מספר סועדים וסוגי תזונה (צמחוני, ללא גלוטן...)',
            '📋 שמור מתכונים מועדפים לשימוש חוזר',
            '🔄 בקש וריאציות — אותם מרכיבים, טעם שונה',
        ]
    },
    forecast: {
        icon: '📅', title: 'תחזית',
        what: 'תצוגה של תחזית ההוצאות המשפחתיות הצפויות.',
        what_admin: 'תכנון הוצאות עתידיות — ראה לאן הולך הכסף המשפחתי ותכנן מראש.',
        tips: [
            '📊 ראה את ההוצאות הצפויות לחודשים הקרובים',
            '📆 עבור בין תצוגה חודשית לשנתית',
        ],
        tips_admin: [
            '➕ הוסף הוצאה עתידית צפויה (חופשה, ציוד לבית...)',
            '📆 עבור בין תצוגה חודשית לשנתית',
            '📊 הגרף מציג תחזית תזרים לחודשים הבאים',
            '🎯 תכנן רכישות גדולות מראש',
            '💡 עזר לכל המשפחה לחסוך ביחד ליעד משותף',
        ]
    },
    'home-maintenance': {
        icon: '🔧', title: 'ניהול הבית',
        what: 'מעקב אחר ציוד ומכשירים בבית — תחזוקה, תקלות ואנשי קשר לתיקונים.',
        what_admin: 'ניהול נכסי הבית — מכשירים, אחזקה תקופתית, תקלות ואנשי קשר לשירות.',
        tips: [
            '🔧 ראה את רשימת המכשירים/הציוד בבית',
            '⚠️ הגש דיווח תקלה — ההורה יקבל התראה',
            '📞 מצא אנשי קשר לתיקון בנושאים שונים',
        ],
        tips_admin: [
            '➕ הוסף מכשיר/ציוד — דגם, תאריך רכישה, אחריות',
            '🔧 תזמן תחזוקה תקופתית (מזגן, דוד, מסנן...)',
            '⚠️ ניהול תקלות — פתח, עקוב, סגור לאחר תיקון',
            '📞 שמור אנשי קשר של בעלי מקצוע לפי קטגוריה',
            '📅 המערכת מתריעה כשמועד תחזוקה מתקרב',
        ]
    },
};

function openFamilyHelp() {
    const tab = window._currentFamilyTab || 'feed';
    const help = FAMILY_HELP_CONTENT[tab];
    const sheet = document.getElementById('family-help-sheet');
    if (!sheet) return;
    const isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER');
    if (!help) {
        document.getElementById('family-help-icon').textContent = '❓';
        document.getElementById('family-help-title').textContent = 'עזרה';
        document.getElementById('family-help-what').textContent = 'לפרטים נוספים פנה להורה או למנהל המשפחה.';
        document.getElementById('family-help-tips').innerHTML = '';
        sheet.classList.remove('hidden');
        return;
    }
    const what = (isAdmin && help.what_admin) ? help.what_admin : help.what;
    const tips = (isAdmin && help.tips_admin) ? help.tips_admin : help.tips;
    document.getElementById('family-help-icon').textContent = help.icon;
    document.getElementById('family-help-title').textContent = help.title;
    document.getElementById('family-help-what').textContent = what;
    document.getElementById('family-help-tips').innerHTML = tips
        .map(t => `<li class="flex items-start gap-2 text-sm text-slate-700 bg-white border border-slate-100 rounded-xl p-3 shadow-sm leading-relaxed">${t}</li>`)
        .join('');
    sheet.classList.remove('hidden');
}

function closeFamilyHelp() {
    const sheet = document.getElementById('family-help-sheet');
    if (sheet) sheet.classList.add('hidden');
}

// ============================================================
// === ניהול הבית — HOME MAINTENANCE MODULE ==================
// ============================================================

let hmItems = [], hmMaintenance = [], hmFaults = [], hmContacts = [];
let hmMaintenanceFilter = 'all', hmFaultsFilter = 'all';
let hmFaultNotes = {};

const HM_CAT_COLORS = { 'מקרר/הקפאה':'bg-blue-100 text-blue-700','תנור/אפייה':'bg-orange-100 text-orange-700','מזגן':'bg-cyan-100 text-cyan-700','חשמל':'bg-yellow-100 text-yellow-700','אינסטלציה':'bg-indigo-100 text-indigo-700','רכב':'bg-violet-100 text-violet-700','כללי':'bg-slate-100 text-slate-600' };
const HM_STATUS_COLORS = { 'active':'bg-emerald-100 text-emerald-700','inactive':'bg-amber-100 text-amber-700','disposed':'bg-red-100 text-red-700' };
const HM_STATUS_LABELS = { 'active':'פעיל','inactive':'לא פעיל','disposed':'הושלך' };
const HM_MTYPE_LABELS = { 'periodic':'תקופתי','repair':'תיקון','inspection':'בדיקה' };
const HM_MTYPE_COLORS = { 'periodic':'bg-blue-100 text-blue-700','repair':'bg-orange-100 text-orange-700','inspection':'bg-violet-100 text-violet-700' };
const HM_SEV_COLORS = { 'low':'bg-slate-100 text-slate-600','medium':'bg-amber-100 text-amber-700','high':'bg-orange-100 text-orange-700','critical':'bg-red-100 text-red-700' };
const HM_SEV_LABELS = { 'low':'נמוכה','medium':'בינונית','high':'גבוהה','critical':'קריטית' };
const HM_FSTATUS_LABELS = { 'open':'פתוח','in_progress':'בטיפול','resolved':'נסגר' };
const HM_FSTATUS_COLORS = { 'open':'bg-red-100 text-red-700','in_progress':'bg-blue-100 text-blue-700','resolved':'bg-emerald-100 text-emerald-700' };

async function loadHomeMaintenance() {
    if (!currentGroup) return;
    loadFamilyServiceCalls().catch(()=>{});
    await Promise.all([fetchHMItems(), fetchHMMaintenance(), fetchHMFaults(), fetchHMContacts()]);
    switchHomeMaintenanceTab('items');
    checkHMNotifications();
}

async function checkHMNotifications() {
    try {
        const res = await fetch(`/api/equipment/notifications/check/${currentGroup.id}`, { method: 'POST' });
        const data = await res.json();
        if (data.success && data.created > 0) {
            const badge = document.getElementById('fgnav-bell-badge');
            if (badge) { badge.textContent = (parseInt(badge.textContent)||0) + data.created; badge.classList.remove('hidden'); }
        }
    } catch(e) {}
}

async function fetchHMItems() {
    try { const r = await fetch(`/api/equipment/items/${currentGroup.id}`); const d = await r.json(); if (d.success) hmItems = d.items; renderHMItems(); } catch(e) {}
}
async function fetchHMMaintenance() {
    try { const r = await fetch(`/api/equipment/maintenance/${currentGroup.id}`); const d = await r.json(); if (d.success) hmMaintenance = d.records; renderHMMaintenance(); updateHMBadge(); } catch(e) {}
}
async function fetchHMFaults() {
    try { const r = await fetch(`/api/equipment/faults/${currentGroup.id}`); const d = await r.json(); if (d.success) hmFaults = d.faults; renderHMFaults(); updateHMBadge(); } catch(e) {}
}
async function fetchHMContacts() {
    try {
        const r = await fetch(`/api/equipment/technicians/${currentGroup.id}`);
        const d = await r.json();
        if (d.success) hmContacts = d.technicians || [];
        renderHMContacts();
    } catch(e) { console.error('fetchHMContacts error:', e); }
}

function updateHMBadge() {
    const badge = getEl('tab-home-maintenance-badge');
    if (!badge) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const in7 = new Date(today); in7.setDate(today.getDate() + 7);
    const urgMaint = hmMaintenance.filter(m => !m.status === 'completed' && m.scheduled_date && new Date(m.scheduled_date) <= in7).length;
    const openFaults = hmFaults.filter(f => f.status !== 'resolved').length;
    const total = urgMaint + openFaults;
    if (total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
}

function switchHomeMaintenanceTab(tab) {
    ['items','maintenance','faults','contacts'].forEach(t => {
        const v = getEl(`hm-view-${t}`); if (v) v.classList.toggle('hidden', t !== tab);
        const b = getEl(`hm-tab-${t}`);
        if (b) b.className = `flex-1 py-2 text-xs font-bold rounded-xl transition ${t === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`;
    });
    if (tab === 'items') renderHMItems();
    if (tab === 'maintenance') renderHMMaintenance();
    if (tab === 'faults') renderHMFaults();
    if (tab === 'contacts') renderHMContacts();
}

// --- ITEMS ---
function renderHMItems() {
    const list = getEl('hm-items-list'); if (!list) return;
    if (!hmItems.length) { list.innerHTML = `<div class="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><i class="fa-solid fa-screwdriver-wrench text-4xl mb-3 opacity-30 block"></i><p class="text-sm font-medium">אין ציוד רשום עדיין</p></div>`; return; }
    list.innerHTML = hmItems.map(item => {
        const catColor = HM_CAT_COLORS[item.category] || 'bg-slate-100 text-slate-600';
        const stColor = HM_STATUS_COLORS[item.status] || '';
        const stLabel = HM_STATUS_LABELS[item.status] || item.status;
        const mCount = hmMaintenance.filter(m => m.equipment_id === item.id && m.status !== 'completed').length;
        const fCount = hmFaults.filter(f => f.equipment_id === item.id && f.status !== 'resolved').length;
        let warrantyHtml = '';
        if (item.warranty_expiry) {
            const exp = new Date(item.warranty_expiry);
            const diff = Math.ceil((exp - new Date()) / 86400000);
            warrantyHtml = `<span class="text-[10px] ${diff < 0 ? 'text-red-500' : diff < 30 ? 'text-amber-500' : 'text-slate-400'}"><i class="fa-regular fa-calendar ml-1"></i>${diff < 0 ? 'אחריות פגה' : 'אחריות עד ' + exp.toLocaleDateString('he-IL')}</span>`;
        }
        return `<div class="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-sm">
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="font-bold text-slate-800 text-sm">${safeStr(item.name)}</h4>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${catColor}">${safeStr(item.category)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${stColor}">${stLabel}</span>
                    </div>
                    ${item.serial_number ? `<p class="text-[11px] text-slate-400">מ"ס: ${safeStr(item.serial_number)}</p>` : ''}
                    ${warrantyHtml}
                    <div class="flex gap-2 mt-2 flex-wrap">
                        ${mCount > 0 ? `<span class="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><i class="fa-solid fa-wrench ml-1"></i>${mCount} תחזוקה</span>` : ''}
                        ${fCount > 0 ? `<span class="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100"><i class="fa-solid fa-triangle-exclamation ml-1"></i>${fCount} תקלות</span>` : ''}
                    </div>
                </div>
                <div class="flex gap-2 mr-2 shrink-0">
                    <button onclick="openHMHistory(${item.id})" title="היסטוריה" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-indigo-50 transition text-slate-400 hover:text-indigo-600"><i class="fa-solid fa-clock-rotate-left text-xs"></i></button>
                    <button onclick="openHMItemModal(${item.id})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition text-slate-500"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="deleteHMItem(${item.id})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-50 transition text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function openHMItemModal(id = null) {
    let modal = getEl('hm-item-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-item-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="hmitem-modal-title" class="font-black text-slate-800 text-base">הוספת ציוד</h3>
                    <button onclick="getEl('hm-item-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <input type="hidden" id="hmitem-id">
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">שם הציוד / המכשיר *</label><input id="hmitem-name" type="text" placeholder="למשל: מקרר סמסונג, מזגן ביתי..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">קטגוריה</label>
                        <select id="hmitem-category" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="מקרר/הקפאה">מקרר/הקפאה</option><option value="תנור/אפייה">תנור/אפייה</option><option value="מזגן">מזגן</option><option value="חשמל">חשמל</option><option value="אינסטלציה">אינסטלציה</option><option value="רכב">רכב</option><option value="כללי" selected>כללי</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">מספר סידורי / דגם</label><input id="hmitem-serial" type="text" placeholder="אופציונלי" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div class="flex gap-3">
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">תאריך רכישה</label><input id="hmitem-purchase" type="date" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">פקיעת אחריות</label><input id="hmitem-warranty" type="date" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">סטטוס</label>
                        <select id="hmitem-status" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="active">פעיל</option><option value="inactive">לא פעיל</option><option value="disposed">הושלך</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">איש קשר לתיקון</label><select id="hmitem-technician" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"><option value="">ללא שיוך</option></select></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">הערות</label><textarea id="hmitem-notes" rows="2" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea></div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMItem()" class="w-full bg-slate-800 text-white font-black py-3 rounded-2xl text-sm hover:bg-slate-700 transition shadow-md">שמור</button></div>
            </div>
        </div>`);
        modal = getEl('hm-item-modal');
    }
    const item = id ? hmItems.find(x => x.id === id) : null;
    getEl('hmitem-modal-title').textContent = item ? 'עריכת ציוד' : 'הוספת ציוד';
    getEl('hmitem-id').value = item ? item.id : '';
    getEl('hmitem-name').value = item ? item.name : '';
    getEl('hmitem-category').value = item ? item.category : 'כללי';
    getEl('hmitem-serial').value = item ? (item.serial_number || '') : '';
    getEl('hmitem-purchase').value = item?.purchase_date ? item.purchase_date.split('T')[0] : '';
    getEl('hmitem-warranty').value = item?.warranty_expiry ? item.warranty_expiry.split('T')[0] : '';
    getEl('hmitem-status').value = item ? item.status : 'active';
    getEl('hmitem-notes').value = item ? (item.notes || '') : '';
    const techSel = getEl('hmitem-technician');
    techSel.innerHTML = '<option value="">ללא שיוך</option>' + hmContacts.map(t => `<option value="${t.id}">${safeStr(t.name)}${t.company_name ? ' — ' + safeStr(t.company_name) : ''}</option>`).join('');
    techSel.value = item ? (item.technician_id || '') : '';
    modal.classList.remove('hidden');
}

async function submitHMItem() {
    const id = getEl('hmitem-id').value;
    const name = getEl('hmitem-name').value.trim();
    if (!name) { showToast('error', 'שם הציוד חובה'); return; }
    try {
        const res = await fetch('/api/equipment/items', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: id||null, groupId: currentGroup.id, name,
                category: getEl('hmitem-category').value, serialNumber: getEl('hmitem-serial').value||null,
                purchaseDate: getEl('hmitem-purchase').value||null, warrantyExpiry: getEl('hmitem-warranty').value||null,
                status: getEl('hmitem-status').value, notes: getEl('hmitem-notes').value||null,
                technicianId: getEl('hmitem-technician').value||null }) });
        const data = await res.json();
        if (data.success) { showToast('success', id ? 'עודכן' : 'נוסף'); getEl('hm-item-modal').classList.add('hidden'); await fetchHMItems(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteHMItem(id) {
    if (!confirm('למחוק ציוד זה?')) return;
    try { await fetch(`/api/equipment/items/${id}`, { method: 'DELETE' }); showToast('info', 'נמחק'); await fetchHMItems(); } catch(e) {}
}

// --- MAINTENANCE ---
function filterHMMaintenance(f) {
    hmMaintenanceFilter = f;
    ['all','pending','overdue','completed'].forEach(x => {
        const btn = getEl(`hmf-maint-${x}`);
        if (btn) btn.className = `shrink-0 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${x === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`;
    });
    renderHMMaintenance();
}

function renderHMMaintenance() {
    const list = getEl('hm-maintenance-list'); if (!list) return;
    const today = new Date(); today.setHours(0,0,0,0);
    let filtered = hmMaintenance.map(m => {
        let cs = m.status;
        if (m.status === 'pending' && m.scheduled_date && new Date(m.scheduled_date) < today) cs = 'overdue';
        return { ...m, cs };
    });
    if (hmMaintenanceFilter !== 'all') filtered = filtered.filter(m => m.cs === hmMaintenanceFilter);
    if (!filtered.length) { list.innerHTML = `<div class="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><p class="text-sm">אין רשומות תחזוקה</p></div>`; return; }
    list.innerHTML = filtered.map(m => {
        const tColor = HM_MTYPE_COLORS[m.maintenance_type] || 'bg-slate-100 text-slate-600';
        const tLabel = HM_MTYPE_LABELS[m.maintenance_type] || m.maintenance_type;
        let statusBadge;
        if (m.cs === 'completed') statusBadge = '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">בוצע ✓</span>';
        else if (m.cs === 'overdue') statusBadge = '<span class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold animate-pulse">פג תוקף ⚠</span>';
        else statusBadge = '<span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">ממתין</span>';
        const dateStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString('he-IL') : '—';
        return `<div class="bg-white border ${m.cs === 'overdue' ? 'border-red-200 bg-red-50/20' : 'border-slate-100'} rounded-2xl p-4 mb-3 shadow-sm">
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class="font-bold text-slate-800 text-sm">${safeStr(m.equipment_name)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${tColor}">${tLabel}</span>
                        ${statusBadge}
                    </div>
                    ${m.description ? `<p class="text-xs text-slate-500 mb-1">${safeStr(m.description)}</p>` : ''}
                    <div class="flex items-center gap-3 flex-wrap text-[10px] text-slate-400">
                        <span><i class="fa-regular fa-calendar ml-1"></i>${dateStr}</span>
                        ${m.technician_name ? `<span><i class="fa-solid fa-user-gear ml-1"></i>${safeStr(m.technician_name)}</span>` : ''}
                        ${m.cost ? `<span class="text-slate-600 font-bold">₪${parseFloat(m.cost).toLocaleString()}</span>` : ''}
                    </div>
                </div>
                <div class="flex flex-col gap-2 mr-2 shrink-0">
                    ${m.cs !== 'completed' ? `<button onclick="completeHMMaintenance(${m.id})" class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg font-bold hover:bg-emerald-100 transition">✓ בצע</button>` : ''}
                    <button onclick="openHMMaintenanceModal(${m.id})" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="deleteHMMaintenance(${m.id})" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function openHMMaintenanceModal(id = null) {
    let modal = getEl('hm-maint-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-maint-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="hmmaint-modal-title" class="font-black text-slate-800 text-base">הוספת תחזוקה</h3>
                    <button onclick="getEl('hm-maint-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <input type="hidden" id="hmmaint-id">
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">ציוד *</label><select id="hmmaint-equipment" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></select></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">סוג</label>
                        <select id="hmmaint-type" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="periodic">תקופתי</option><option value="repair">תיקון</option><option value="inspection">בדיקה</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">תיאור</label><textarea id="hmmaint-desc" rows="2" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea></div>
                    <div class="flex gap-3">
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">תאריך מתוכנן</label><input id="hmmaint-date" type="date" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">עלות</label><input id="hmmaint-cost" type="number" placeholder="₪" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">חזרה אוטומטית (ימים)</label><input id="hmmaint-interval" type="number" placeholder="ריק = ללא חזרה" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div id="hmmaint-tech-row"><label class="text-xs font-bold text-slate-500 mb-1 block">איש קשר לתיקון</label>
                        <div class="flex gap-2">
                            <input id="hmmaint-tech-name" type="text" placeholder="שם" class="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <input id="hmmaint-tech-phone" type="tel" placeholder="טלפון" class="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                        </div>
                    </div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMMaintenance()" class="w-full bg-slate-800 text-white font-black py-3 rounded-2xl text-sm hover:bg-slate-700 transition shadow-md">שמור</button></div>
            </div>
        </div>`);
        modal = getEl('hm-maint-modal');
    }
    const rec = id ? hmMaintenance.find(x => x.id === id) : null;
    getEl('hmmaint-modal-title').textContent = rec ? 'עריכת תחזוקה' : 'הוספת תחזוקה';
    getEl('hmmaint-id').value = rec ? rec.id : '';
    const eqSel = getEl('hmmaint-equipment');
    eqSel.innerHTML = '<option value="">בחר ציוד...</option>' + hmItems.map(i => `<option value="${i.id}">${safeStr(i.name)}</option>`).join('');
    eqSel.value = rec ? rec.equipment_id : '';
    getEl('hmmaint-type').value = rec ? rec.maintenance_type : 'periodic';
    getEl('hmmaint-desc').value = rec ? (rec.description || '') : '';
    getEl('hmmaint-date').value = rec?.scheduled_date ? rec.scheduled_date.split('T')[0] : '';
    getEl('hmmaint-cost').value = rec ? (rec.cost || '') : '';
    getEl('hmmaint-interval').value = rec ? (rec.interval_days || '') : '';
    getEl('hmmaint-tech-name').value = rec ? (rec.technician_name || '') : '';
    getEl('hmmaint-tech-phone').value = rec ? (rec.technician_phone || '') : '';
    modal.classList.remove('hidden');
}

async function submitHMMaintenance() {
    const id = getEl('hmmaint-id').value;
    const equipmentId = getEl('hmmaint-equipment').value;
    if (!equipmentId) { showToast('error', 'יש לבחור ציוד'); return; }
    try {
        const res = await fetch('/api/equipment/maintenance', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: id||null, groupId: currentGroup.id, equipmentId,
                maintenanceType: getEl('hmmaint-type').value, description: getEl('hmmaint-desc').value||null,
                scheduledDate: getEl('hmmaint-date').value||null, cost: getEl('hmmaint-cost').value||null,
                technicianName: getEl('hmmaint-tech-name').value||null, technicianPhone: getEl('hmmaint-tech-phone').value||null,
                intervalDays: getEl('hmmaint-interval').value||null }) });
        const data = await res.json();
        if (data.success) { showToast('success', id ? 'עודכן' : 'נוסף'); getEl('hm-maint-modal').classList.add('hidden'); await fetchHMMaintenance(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function completeHMMaintenance(id) {
    try {
        const res = await fetch(`/api/equipment/maintenance/${id}/complete`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
        const data = await res.json();
        if (data.success) { showToast('success', data.nextScheduled ? 'בוצע! תחזוקה הבאה תוזמנה' : 'בוצע!'); await fetchHMMaintenance(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) {}
}

async function deleteHMMaintenance(id) {
    if (!confirm('למחוק?')) return;
    try { await fetch(`/api/equipment/maintenance/${id}`, { method: 'DELETE' }); showToast('info', 'נמחק'); await fetchHMMaintenance(); } catch(e) {}
}

// --- FAULTS ---
function filterHMFaults(f) {
    hmFaultsFilter = f;
    ['all','open','in_progress','resolved'].forEach(x => {
        const btn = getEl(`hmf-fault-${x}`);
        if (btn) btn.className = `shrink-0 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${x === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`;
    });
    renderHMFaults();
}

function renderHMFaults() {
    const list = getEl('hm-faults-list'); if (!list) return;
    let filtered = hmFaultsFilter === 'all' ? hmFaults : hmFaults.filter(f => f.status === hmFaultsFilter);
    // קריאות שירות מהעסק — מוצגות תמיד בראש הרשימה
    const activeSC = (familyServiceCalls || []).filter(c => c.status !== 'cancelled' && c.status !== 'done');
    const scHtml = activeSC.map(c => {
        const SC_ST = { new:'ממתינה', seen:'נצפתה', in_progress:'בטיפול', pending_parts:'ממתין לחלקים' };
        const sc_bg = { new:'border-blue-300 bg-blue-50', seen:'border-indigo-300 bg-indigo-50', in_progress:'border-amber-300 bg-amber-50', pending_parts:'border-purple-300 bg-purple-50' };
        const createdStr = c.created_at ? new Date(c.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'}) : '';
        const scheduledStr = c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : null;
        const borderBg = sc_bg[c.status] || 'border-slate-200 bg-white';
        return `<div onclick="openFamilyCallModal(${c.id})" class="border-r-4 ${borderBg} rounded-2xl p-3 mb-2 cursor-pointer active:scale-[0.99] transition shadow-sm" style="touch-action:manipulation;">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span class="text-[9px] font-black text-indigo-600 bg-white border border-indigo-200 px-1.5 py-0.5 rounded-full">🏢 קריאת שירות מהעסק</span>
                        ${c.business_name ? `<span class="text-[9px] text-slate-500">${safeStr(c.business_name)}</span>` : ''}
                    </div>
                    <div class="text-sm font-bold text-slate-800 truncate">${safeStr(c.title)}</div>
                    ${createdStr ? `<div class="text-[10px] text-slate-400">${createdStr}</div>` : ''}
                    ${scheduledStr ? `<div class="text-[10px] text-blue-600 font-bold">📅 ${scheduledStr}</div>` : '<div class="text-[10px] text-amber-600 font-bold">⚠️ ללא תאריך טיפול</div>'}
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current shrink-0">${SC_ST[c.status]||c.status}</span>
            </div>
        </div>`;
    }).join('');
    if (!filtered.length && !activeSC.length) { list.innerHTML = `<div class="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><i class="fa-solid fa-circle-check text-3xl mb-2 opacity-30 block"></i><p class="text-sm">אין תקלות</p></div>`; return; }
    if (!filtered.length) { list.innerHTML = scHtml; return; }
    list.innerHTML = scHtml + filtered.map(f => {
        const sColor = HM_SEV_COLORS[f.severity] || 'bg-slate-100 text-slate-600';
        const sLabel = HM_SEV_LABELS[f.severity] || f.severity;
        const stColor = HM_FSTATUS_COLORS[f.status] || 'bg-slate-100 text-slate-600';
        const stLabel = HM_FSTATUS_LABELS[f.status] || f.status;
        const dateStr = new Date(f.created_at).toLocaleDateString('he-IL');
        const notesCount = parseInt(f.notes_count) || 0;
        return `<div class="bg-white border ${f.severity === 'critical' ? 'border-red-200' : 'border-slate-100'} rounded-2xl p-4 mb-3 shadow-sm">
            <div class="flex items-start gap-3">
                ${f.image_url ? `<img src="${f.image_url}" class="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-100 cursor-pointer" onclick="window.open('${f.image_url}','_blank')">` : ''}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="font-bold text-slate-800 text-sm">${safeStr(f.title)}</h4>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${sColor}">${sLabel}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${stColor}">${stLabel}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 mb-2">${safeStr(f.equipment_name)} · ${dateStr}</p>
                    <div class="flex gap-1 border-b border-slate-100 mb-2">
                        <button onclick="showHMFaultTab(${f.id},'details')" id="hmftab-details-${f.id}" class="text-[11px] font-bold px-3 py-1 rounded-t-lg border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50">פרטים</button>
                        <button onclick="showHMFaultTab(${f.id},'notes')" id="hmftab-notes-${f.id}" class="text-[11px] font-bold px-3 py-1 rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-slate-600">הערות${notesCount ? ` <span class="bg-indigo-100 text-indigo-700 rounded-full px-1.5">${notesCount}</span>` : ''}</button>
                    </div>
                    <div id="hmftab-content-details-${f.id}">
                        ${f.scheduled_date ? `<p class="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg mb-1.5 flex items-center gap-1"><i class="fa-solid fa-calendar-check"></i> מתוזמן ל: ${new Date(f.scheduled_date).toLocaleString('he-IL', {dateStyle:'short',timeStyle:'short'})}</p>` : ''}
                        ${f.description ? `<p class="text-xs text-slate-500">${safeStr(f.description)}</p>` : ''}
                        ${f.resolution_notes ? `<p class="text-xs text-emerald-700 mt-1 bg-emerald-50 px-2 py-1 rounded-lg"><i class="fa-solid fa-check-circle ml-1"></i>${safeStr(f.resolution_notes)}</p>` : ''}
                        ${f.fault_tech_name ? `<p class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-user-gear text-slate-400 ml-1"></i> ${safeStr(f.fault_tech_name)}${f.fault_tech_company ? ' — ' + safeStr(f.fault_tech_company) : ''}</p>` : ''}
                        ${(() => {
                            const phone = f.fault_tech_phone || (() => { const item = hmItems.find(i => i.id === f.equipment_id); return item?.technician_phone; })();
                            if (!phone || f.status === 'resolved') return '';
                            const techName = f.fault_tech_name || 'איש קשר';
                            const waMsg = encodeURIComponent(`שלום ${techName}, יש לנו בעיה: "${f.title}"${f.scheduled_date ? '. תאריך מבוקש: ' + new Date(f.scheduled_date).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}) : ''}`);
                            return `<div class="flex gap-1.5 mt-2 flex-wrap">
                                <a href="tel:${phone.replace(/\D/g,'')}" class="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-100"><i class="fa-solid fa-phone"></i> חייג</a>
                                <a href="https://wa.me/${phone.replace(/\D/g,'')}?text=${waMsg}" target="_blank" class="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100"><i class="fa-brands fa-whatsapp"></i> וואצאפ</a>
                                <a href="https://waze.com/ul?q=${encodeURIComponent(techName)}&navigate=yes" target="_blank" class="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100"><i class="fa-solid fa-location-arrow"></i> Waze</a>
                            </div>`;
                        })()}
                    </div>
                    <div id="hmftab-content-notes-${f.id}" class="hidden">
                        <div id="hm-fnotes-list-${f.id}" class="space-y-1.5 mb-2 max-h-40 overflow-y-auto"></div>
                        <button onclick="openHMAddNote(${f.id})" class="w-full text-[11px] font-bold text-indigo-600 border border-dashed border-indigo-200 rounded-xl py-1.5 hover:bg-indigo-50 transition">+ הוסף הערה</button>
                    </div>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="openHMFaultStatusPopup(${f.id})" title="שינוי סטטוס" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><i class="fa-solid fa-arrows-rotate text-xs"></i></button>
                    <button onclick="openHMFaultModal(${f.id})" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="deleteHMFault(${f.id})" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function showHMFaultTab(faultId, tab) {
    const dBtn = getEl(`hmftab-details-${faultId}`), nBtn = getEl(`hmftab-notes-${faultId}`);
    const dDiv = getEl(`hmftab-content-details-${faultId}`), nDiv = getEl(`hmftab-content-notes-${faultId}`);
    if (!dBtn) return;
    const active = 'text-[11px] font-bold px-3 py-1 rounded-t-lg border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50';
    const inactive = 'text-[11px] font-bold px-3 py-1 rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-slate-600';
    if (tab === 'details') { dBtn.className = active; nBtn.className = inactive; dDiv.classList.remove('hidden'); nDiv.classList.add('hidden'); }
    else { nBtn.className = active; dBtn.className = inactive; nDiv.classList.remove('hidden'); dDiv.classList.add('hidden'); await fetchAndRenderHMFaultNotes(faultId); }
}

async function fetchAndRenderHMFaultNotes(faultId) {
    const container = getEl(`hm-fnotes-list-${faultId}`); if (!container) return;
    try {
        const res = await fetch(`/api/equipment/faults/${faultId}/notes`);
        const data = await res.json();
        if (!data.success) return;
        hmFaultNotes[faultId] = data.notes;
        const stColors = { open: 'bg-orange-100 text-orange-700', in_progress: 'bg-blue-100 text-blue-700', resolved: 'bg-emerald-100 text-emerald-700' };
        const stLabels = { open: 'פתוח', in_progress: 'בטיפול', resolved: 'טופל' };
        if (!data.notes.length) { container.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-2">אין הערות עדיין</p>`; return; }
        container.innerHTML = data.notes.map(n => `<div class="bg-slate-50 rounded-xl px-3 py-2 text-xs">
            <div class="flex items-center justify-between gap-2 mb-0.5">
                <span class="text-slate-400 text-[10px]">${new Date(n.created_at).toLocaleDateString('he-IL')}</span>
                ${n.status_to ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${stColors[n.status_to]||''}">${stLabels[n.status_to]||n.status_to}</span>` : ''}
            </div>
            <p class="text-slate-600">${safeStr(n.note)}</p>
        </div>`).join('');
    } catch(e) {}
}

function openHMFaultModal(id = null) {
    let modal = getEl('hm-fault-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-fault-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="hmfault-modal-title" class="font-black text-slate-800 text-base">דיווח בעיה</h3>
                    <button onclick="getEl('hm-fault-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <input type="hidden" id="hmfault-id">
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">ציוד *</label><select id="hmfault-equipment" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></select></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">כותרת הבעיה *</label><input id="hmfault-title" type="text" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">פירוט</label><textarea id="hmfault-desc" rows="3" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">שלח לאיש קשר (איש מקצוע)</label>
                        <select id="hmfault-technician" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="">ללא שיוך לאיש קשר</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">תאריך ושעה מבוקשים (אופציונלי)</label>
                        <input id="hmfault-scheduled" type="datetime-local" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                    </div>
                    <div class="flex gap-3">
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">דחיפות</label>
                            <select id="hmfault-severity" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                                <option value="low">נמוכה</option><option value="medium" selected>בינונית</option><option value="high">גבוהה</option><option value="critical">קריטית</option>
                            </select>
                        </div>
                        <div class="flex-1"><label class="text-xs font-bold text-slate-500 mb-1 block">סטטוס</label>
                            <select id="hmfault-status" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                                <option value="open">פתוח</option><option value="in_progress">בטיפול</option><option value="resolved">טופל</option>
                            </select>
                        </div>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">הוספת תמונה</label>
                        <label class="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                            <i class="fa-solid fa-camera text-slate-400"></i>
                            <span id="hmfault-img-label" class="text-xs text-slate-400">לחץ להוספת תמונה</span>
                            <input type="file" accept="image/*" class="hidden" onchange="handleHMFaultImage(this)">
                        </label>
                        <img id="hmfault-img-preview" class="hidden w-full max-h-40 object-contain rounded-xl border border-slate-100 mt-2">
                    </div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMFault()" class="w-full bg-red-600 text-white font-black py-3 rounded-2xl text-sm hover:bg-red-700 transition shadow-md">שמור</button></div>
            </div>
        </div>`);
        modal = getEl('hm-fault-modal');
    }
    const fault = id ? hmFaults.find(x => x.id === id) : null;
    getEl('hmfault-modal-title').textContent = fault ? 'עריכת בעיה' : 'דיווח בעיה';
    getEl('hmfault-id').value = fault ? fault.id : '';
    const eqSel = getEl('hmfault-equipment');
    eqSel.innerHTML = '<option value="">בחר ציוד...</option>' + hmItems.map(i => `<option value="${i.id}">${safeStr(i.name)}</option>`).join('');
    eqSel.value = fault ? fault.equipment_id : '';
    getEl('hmfault-title').value = fault ? fault.title : '';
    getEl('hmfault-desc').value = fault ? (fault.description || '') : '';
    getEl('hmfault-severity').value = fault ? fault.severity : 'medium';
    getEl('hmfault-status').value = fault ? fault.status : 'open';
    // בורר איש קשר
    const techSel = getEl('hmfault-technician');
    techSel.innerHTML = '<option value="">ללא שיוך לאיש קשר</option>' + (hmContacts||[]).map(t => `<option value="${t.id}">${safeStr(t.name)}${t.company_name ? ' — ' + safeStr(t.company_name) : ''}</option>`).join('');
    techSel.value = fault ? (fault.technician_id || '') : '';
    // תאריך מבוקש
    const schedEl = getEl('hmfault-scheduled');
    if (schedEl) schedEl.value = fault?.scheduled_date ? new Date(fault.scheduled_date).toISOString().slice(0,16) : '';
    window._hmFaultImageData = fault ? (fault.image_url || null) : null;
    const preview = getEl('hmfault-img-preview');
    if (fault?.image_url) { preview.src = fault.image_url; preview.classList.remove('hidden'); getEl('hmfault-img-label').textContent = 'תמונה קיימת'; }
    else { preview.classList.add('hidden'); getEl('hmfault-img-label').textContent = 'לחץ להוספת תמונה'; }
    modal.classList.remove('hidden');
}

function handleHMFaultImage(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { window._hmFaultImageData = e.target.result; const p = getEl('hmfault-img-preview'); p.src = e.target.result; p.classList.remove('hidden'); getEl('hmfault-img-label').textContent = file.name; };
    reader.readAsDataURL(file);
}

async function submitHMFault() {
    const id = getEl('hmfault-id').value;
    const equipmentId = getEl('hmfault-equipment').value;
    const title = getEl('hmfault-title').value.trim();
    if (!equipmentId) { showToast('error', 'יש לבחור ציוד'); return; }
    if (!title) { showToast('error', 'כותרת חובה'); return; }
    const statusVal = getEl('hmfault-status').value;
    const technicianId = getEl('hmfault-technician')?.value || null;
    const scheduledDate = getEl('hmfault-scheduled')?.value || null;
    let resolvedDate = null;
    if (statusVal === 'resolved') {
        const existing = id ? hmFaults.find(x => x.id === parseInt(id)) : null;
        resolvedDate = existing?.resolved_date ? existing.resolved_date.split('T')[0] : new Date().toISOString().split('T')[0];
    }
    try {
        const res = await fetch('/api/equipment/faults', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: id||null, groupId: currentGroup.id, equipmentId, title,
                description: getEl('hmfault-desc').value||null, imageUrl: window._hmFaultImageData||null,
                severity: getEl('hmfault-severity').value, status: statusVal, resolvedDate,
                technicianId: technicianId||null, scheduledDate: scheduledDate||null }) });
        const data = await res.json();
        if (data.success) {
            showToast('success', id ? 'עודכן' : 'נרשם');
            getEl('hm-fault-modal').classList.add('hidden');
            await fetchHMFaults();
            // אם נבחר איש קשר — הצע שליחת וואצאפ
            if (!id && technicianId) {
                const tech = (hmContacts||[]).find(t => t.id == technicianId);
                if (tech?.phone) {
                    const msg = `שלום ${safeStr(tech.name)}, יש לנו בעיה ב"${title}". ${getEl('hmfault-desc').value ? 'פירוט: ' + getEl('hmfault-desc').value : ''} ${scheduledDate ? 'תאריך מבוקש: ' + new Date(scheduledDate).toLocaleString('he-IL') : ''}`;
                    if (confirm(`לשלוח וואצאפ ל-${tech.name}?`)) {
                        window.open(`https://wa.me/${tech.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
                    }
                }
            }
        }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteHMFault(id) {
    if (!confirm('למחוק?')) return;
    try { await fetch(`/api/equipment/faults/${id}`, { method: 'DELETE' }); showToast('info', 'נמחק'); await fetchHMFaults(); } catch(e) {}
}

function openHMFaultStatusPopup(faultId) {
    const fault = hmFaults.find(f => f.id === faultId); if (!fault) return;
    let modal = getEl('hm-fault-status-popup');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-fault-status-popup" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[100] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-4 border-b border-slate-100">
                    <h3 class="font-black text-slate-800 text-sm">שינוי סטטוס</h3>
                    <button onclick="getEl('hm-fault-status-popup').classList.add('hidden')" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
                <div class="p-4 space-y-3">
                    <input type="hidden" id="hmfsp-id">
                    <p id="hmfsp-title" class="text-xs font-bold text-slate-500 truncate"></p>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">סטטוס חדש</label>
                        <select id="hmfsp-status" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                            <option value="open">פתוח</option><option value="in_progress">בטיפול</option><option value="resolved">טופל</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">הערה</label>
                        <textarea id="hmfsp-note" rows="3" placeholder="מה עודכן?" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea>
                    </div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMFaultStatus()" class="w-full bg-indigo-600 text-white font-black py-3 rounded-2xl text-sm hover:bg-indigo-700 transition">עדכן סטטוס</button></div>
            </div>
        </div>`);
        modal = getEl('hm-fault-status-popup');
    }
    getEl('hmfsp-id').value = fault.id;
    getEl('hmfsp-title').textContent = fault.title;
    getEl('hmfsp-status').value = fault.status;
    getEl('hmfsp-note').value = '';
    modal.classList.remove('hidden');
}

async function submitHMFaultStatus() {
    const id = getEl('hmfsp-id').value;
    const status = getEl('hmfsp-status').value;
    const note = getEl('hmfsp-note').value.trim();
    try {
        const res = await fetch(`/api/equipment/faults/${id}/status`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status, note, groupId: currentGroup.id }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'סטטוס עודכן'); getEl('hm-fault-status-popup').classList.add('hidden'); await fetchHMFaults(); setTimeout(() => showHMFaultTab(parseInt(id), 'notes'), 50); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function openHMAddNote(faultId) {
    const fault = hmFaults.find(f => f.id === faultId); if (!fault) return;
    let modal = getEl('hm-add-note-popup');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-add-note-popup" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[100] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-4 border-b border-slate-100">
                    <h3 class="font-black text-slate-800 text-sm">הוספת הערה</h3>
                    <button onclick="getEl('hm-add-note-popup').classList.add('hidden')" class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
                <div class="p-4 space-y-3">
                    <input type="hidden" id="hmanp-id">
                    <p id="hmanp-title" class="text-xs font-bold text-slate-500 truncate"></p>
                    <textarea id="hmanp-note" rows="4" placeholder="כתוב הערה..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMNote()" class="w-full bg-indigo-600 text-white font-black py-3 rounded-2xl text-sm hover:bg-indigo-700 transition">שמור הערה</button></div>
            </div>
        </div>`);
        modal = getEl('hm-add-note-popup');
    }
    getEl('hmanp-id').value = faultId;
    getEl('hmanp-title').textContent = fault.title;
    getEl('hmanp-note').value = '';
    modal.classList.remove('hidden');
    setTimeout(() => getEl('hmanp-note').focus(), 100);
}

async function submitHMNote() {
    const faultId = getEl('hmanp-id').value;
    const note = getEl('hmanp-note').value.trim();
    if (!note) { showToast('error', 'יש לכתוב הערה'); return; }
    try {
        const res = await fetch(`/api/equipment/faults/${faultId}/notes`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ note, groupId: currentGroup.id }) });
        const data = await res.json();
        if (data.success) { showToast('success', 'הערה נשמרה'); getEl('hm-add-note-popup').classList.add('hidden'); await fetchHMFaults(); setTimeout(() => showHMFaultTab(parseInt(faultId), 'notes'), 50); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function sendHMFaultWhatsApp(faultId) {
    const fault = hmFaults.find(f => f.id === faultId); if (!fault) return;
    const item = hmItems.find(i => i.id === fault.equipment_id); if (!item?.technician_phone) return;
    const msg = `שלום, יש לנו בעיה בבית:\n*${fault.title}*\nציוד: ${item.name}\n${fault.description ? 'פירוט: ' + fault.description : ''}`;
    window.open(`https://wa.me/${item.technician_phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
}

// --- CONTACTS (אנשי קשר לתיקונים) ---
function renderHMContacts() {
    const list = getEl('hm-contacts-list'); if (!list) return;
    if (!hmContacts.length) { list.innerHTML = `<div class="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><i class="fa-solid fa-address-book text-4xl mb-3 opacity-30 block"></i><p class="text-sm font-medium">אין אנשי קשר עדיין</p></div>`; return; }
    list.innerHTML = hmContacts.map(t => {
        const oneflowBadge = t.oneflow_verified ? `<span class="inline-flex items-center gap-1 text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200"><i class="fa-solid fa-circle-check"></i> ONEFLOW LIFE</span>` : '';
        const sendCallBtn = t.business_group_id ? `<button onclick="openServiceCallWizard(${t.id})" class="flex items-center gap-1 text-[10px] text-orange-700 font-black bg-orange-50 px-2 py-1 rounded-lg border border-orange-200 active:scale-95 transition" style="touch-action:manipulation;"><i class="fa-solid fa-wrench"></i> שלח קריאה</button>` : '';
        const linkBtn = !t.business_group_id ? `<button onclick="openLinkBusinessModal(${t.id})" class="flex items-center gap-1 text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 active:scale-95 transition" style="touch-action:manipulation;"><i class="fa-solid fa-link"></i> קשר ל-ONEFLOW LIFE</button>` : '';
        return `<div class="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-sm">
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-0.5">
                    <h4 class="font-bold text-slate-800 text-sm">${safeStr(t.name)}</h4>
                    ${oneflowBadge}                </div>
                ${t.company_name ? `<p class="text-[11px] text-indigo-600 font-medium">${safeStr(t.company_name)}</p>` : ''}
                ${t.specialty ? `<p class="text-[11px] text-slate-400">${safeStr(t.specialty)}</p>` : ''}
                <div class="flex gap-2 mt-2 flex-wrap">
                    ${t.phone ? `<a href="tel:${safeStr(t.phone)}" class="flex items-center gap-1 text-[10px] text-slate-600 font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-200"><i class="fa-solid fa-phone text-emerald-500"></i> ${safeStr(t.phone)}</a>` : ''}
                    ${t.phone ? `<a href="https://wa.me/${t.phone.replace(/\D/g,'')}" target="_blank" class="flex items-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 px-2 py-1 rounded-lg border border-green-200"><i class="fa-brands fa-whatsapp"></i> וואצאפ</a>` : ''}
                    ${sendCallBtn}${linkBtn}
                </div>
            </div>
            <div class="flex gap-2 mr-2 shrink-0">
                <button onclick="openHMContactModal(${t.id})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500"><i class="fa-solid fa-pen text-xs"></i></button>
                <button onclick="deleteHMContact(${t.id})" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>
    </div>`;
    }).join('');
}

// ─── SERVICE CALL WIZARD (Family side) ──────────────────────────────────────
let familyServiceCalls = [];

async function loadFamilyServiceCalls() {
    try {
        const r = await fetch(`/api/service-calls/family/${currentGroup.id}`);
        const d = await r.json();
        familyServiceCalls = d.calls || [];
        renderBusinessServiceCallsTab();
        try { renderHMFaults(); } catch(e) {}
    } catch(e) {}
}

function renderBusinessServiceCallsTab() {
    const list = getEl('my-service-calls-list');
    if (!list) return;
    const ST_LABEL = { new:'ממתינה לטיפול', seen:'נצפתה', in_progress:'בטיפול', pending_parts:'ממתין לחלקים', done:'הושלם', cancelled:'בוטל' };
    const ST_COLOR = { new:'border-blue-400', seen:'border-indigo-400', in_progress:'border-amber-400', pending_parts:'border-purple-400', done:'border-green-400', cancelled:'border-slate-300' };
    const ST_BG   = { new:'bg-blue-50', seen:'bg-indigo-50', in_progress:'bg-amber-50', pending_parts:'bg-purple-50', done:'bg-green-50', cancelled:'bg-slate-50' };
    const ST_TEXT = { new:'text-blue-700', seen:'text-indigo-700', in_progress:'text-amber-700', pending_parts:'text-purple-700', done:'text-green-700', cancelled:'text-slate-500' };
    const typeFilter = window._scTypeFilter || 'all';
    // עדכן כפתורי סינון
    ['all','external','internal'].forEach(t => {
        const btn = getEl(`sc-type-filter-${t}`);
        if (btn) btn.className = `text-[10px] px-2.5 py-1 rounded-lg font-bold transition ${t === typeFilter ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`;
    });
    const allActive = (familyServiceCalls || []).filter(c => c.status !== 'cancelled');
    const allFaults = (hmFaults || []).filter(f => f.status !== 'resolved');
    const active = typeFilter === 'internal' ? [] : allActive;
    const openFaults = typeFilter === 'external' ? [] : allFaults;
    if (!active.length && !openFaults.length) {
        list.innerHTML = `<div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <i class="fa-solid fa-wrench text-3xl text-slate-300 mb-2 block"></i>
            <p class="text-sm font-bold text-slate-500">${(allActive.length || allFaults.length) ? 'אין קריאות התואמות את הסינון.' : 'אין קריאות שירות פעילות'}</p>
            <p class="text-xs text-slate-400 mt-1">${(allActive.length || allFaults.length) ? '' : 'לפתיחת קריאה — כנסו לאיש קשר ובחרו "קריאת שירות"'}</p>
        </div>`;
        return;
    }
    const faultsHtml = openFaults.map(f => {
        const sev = { low:'🟢', normal:'🔵', medium:'🟠', high:'🔴', critical:'🚨' }[f.severity] || '⚠️';
        const stF = { open:'פתוחה', in_progress:'בטיפול' }[f.status] || f.status;
        return `<div onclick="switchTab('home-maintenance');setTimeout(()=>{switchHomeMaintenanceTab('faults')},150)" class="border-r-4 border-orange-300 bg-orange-50 rounded-2xl p-3 mb-2 cursor-pointer active:scale-[0.99] transition shadow-sm" style="touch-action:manipulation;">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                        <span class="text-[9px] font-black text-orange-700 bg-white border border-orange-200 px-1.5 py-0.5 rounded-full">🏠 תקלה בבית</span>
                    </div>
                    <div class="text-sm font-bold text-slate-800 truncate">${sev} ${safeStr(f.title)}</div>
                    <div class="text-[10px] text-slate-500">${safeStr(f.equipment_name||'')} · ${stF}</div>
                </div>
                <span class="text-[9px] font-bold text-orange-600 bg-white border border-orange-200 px-2 py-0.5 rounded-full shrink-0">פרטים →</span>
            </div>
        </div>`;
    }).join('');
    const scHtml = active.map(c => {
        const borderCls = ST_COLOR[c.status] || 'border-slate-300';
        const bgCls = ST_BG[c.status] || 'bg-white';
        const textCls = ST_TEXT[c.status] || 'text-slate-600';
        const stLabel = ST_LABEL[c.status] || c.status;
        const createdStr = c.created_at ? new Date(c.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'}) : '';
        const scheduledStr = c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : null;
        const noDateFlag = (c.status !== 'done' && c.status !== 'cancelled' && !c.scheduled_at) ? `<span class="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">⚠️ ללא תאריך</span>` : '';
        const partsFlag = c.parts_status === 'parts_ready' ? `<span class="text-[9px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">✅ חלקים מוכנים</span>`
                        : (c.parts_status === 'pending_parts' || c.parts_status === 'waiting_delivery') ? `<span class="text-[9px] bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-bold">📦 ממתין לחלקים</span>` : '';
        return `<div onclick="openFamilyCallModal(${c.id})" class="border-r-4 ${borderCls} ${bgCls} rounded-2xl p-3 mb-2 cursor-pointer active:scale-[0.99] transition bg-white shadow-sm" style="touch-action:manipulation;">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-800 truncate">${safeStr(c.title)}</div>
                    <div class="text-[10px] text-slate-500">${c.business_name ? safeStr(c.business_name) : 'בעל מקצוע'}${createdStr ? ' · ' + createdStr : ''}</div>
                    ${scheduledStr ? `<div class="text-[10px] text-blue-600 font-bold mt-0.5">📅 ${scheduledStr}</div>` : ''}
                    ${(noDateFlag || partsFlag) ? `<div class="flex gap-1 flex-wrap mt-1">${noDateFlag}${partsFlag}</div>` : ''}
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border ${borderCls} ${textCls}">${stLabel}</span>
                    ${c.price_quote ? `<span class="text-[9px] text-indigo-700 font-bold">₪${parseFloat(c.price_quote).toFixed(0)}</span>` : ''}
                    ${c.rating ? `<span class="text-[10px]">${'⭐'.repeat(c.rating)}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
    list.innerHTML = scHtml + faultsHtml;
}

window.openFamilyCallModal = async function(callId) {
    const call = familyServiceCalls.find(c => c.id === callId);
    if (!call) return;
    let messages = [];
    try { const r = await fetch(`/api/service-calls/${callId}/messages`); const d = await r.json(); messages = d.messages||[]; } catch(e) {}
    document.getElementById('fam-sc-modal')?.remove();
    const SC_STATUS_LABELS_FAM = { new:'ממתינה', seen:'נצפתה', in_progress:'בטיפול', pending_parts:'ממתין לחלקים', done:'הושלם', cancelled:'בוטל' };
    const msgHtml = messages.map(m => `<div class="flex ${m.sender_type==='family'?'justify-start':'justify-end'} mb-2">
        <div class="max-w-[80%] ${m.sender_type==='family'?'bg-slate-100 text-slate-800':'bg-indigo-500 text-white'} rounded-2xl px-3 py-2 text-xs">
            <div class="font-bold text-[10px] mb-1 opacity-70">${safeStr(m.sender_name||m.sender_type)}</div>
            ${safeStr(m.message)}
        </div>
    </div>`).join('');

    const partsHtml = call.parts_status ? (() => {
        const partsLabels = { pending_parts:'⏳ ממתין לחלקים', waiting_delivery:'🚚 חלקים בדרך', parts_ready:'✅ חלקים מוכנים' };
        const partsBgs = { pending_parts:'bg-purple-50 border-purple-200 text-purple-700', waiting_delivery:'bg-blue-50 border-blue-200 text-blue-700', parts_ready:'bg-green-50 border-green-200 text-green-700' };
        return `<div class="rounded-2xl p-3 border ${partsBgs[call.parts_status]||'bg-slate-50 border-slate-200 text-slate-600'}">
            <div class="text-[10px] font-bold mb-1">מצב חלקים</div>
            <div class="text-xs font-bold">${partsLabels[call.parts_status]||call.parts_status}</div>
        </div>`;
    })() : '';

    const canCancel = call.status === 'new' || call.status === 'seen';
    const canRate = call.status === 'done' && !call.rating;
    const alreadyRated = call.status === 'done' && call.rating;

    const rateHtml = canRate ? `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3">
        <div class="text-[10px] font-bold text-amber-700 mb-2">⭐ דרג את השירות</div>
        <div class="flex gap-2 justify-center" id="fam-sc-stars-${callId}">
            ${[1,2,3,4,5].map(n => `<button onclick="rateFamilyServiceCall(${callId},${n})" class="text-2xl text-slate-300 hover:text-amber-400 active:scale-90 transition" style="touch-action:manipulation;">★</button>`).join('')}
        </div>
    </div>` : alreadyRated ? `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
        <span class="text-sm font-bold text-amber-700">הדירוג שלך: ${'⭐'.repeat(call.rating)}</span>
    </div>` : '';

    const html = `<div id="fam-sc-modal" class="fixed inset-0 bg-white z-[9990] flex flex-col" style="direction:rtl;">
        <div class="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white shrink-0">
            <button onclick="document.getElementById('fam-sc-modal').remove()" class="text-xl"><i class="fa-solid fa-xmark"></i></button>
            <div class="flex-1 min-w-0">
                <div class="font-black text-sm truncate">${safeStr(call.title)}</div>
                <div class="text-[10px] opacity-80">${call.business_name ? safeStr(call.business_name) : 'בעל מקצוע'}</div>
            </div>
            <span class="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-lg">${SC_STATUS_LABELS_FAM[call.status]||call.status}</span>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div class="bg-slate-50 rounded-2xl p-3 text-sm space-y-1.5">
                ${call.created_at ? `<p class="text-[10px] text-slate-400">נפתחה: ${new Date(call.created_at).toLocaleDateString('he-IL',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>` : ''}
                ${call.description ? `<p class="text-slate-700 mt-1">${safeStr(call.description)}</p>` : ''}
                ${call.address ? `<p class="text-xs text-slate-500"><i class="fa-solid fa-location-dot ml-1 text-indigo-400"></i>${safeStr(call.address)}</p>` : ''}
                ${call.requested_date ? `<p class="text-xs text-slate-500"><i class="fa-solid fa-calendar ml-1 text-amber-400"></i>תאריך מבוקש: ${new Date(call.requested_date).toLocaleDateString('he-IL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>` : ''}
                ${call.scheduled_at ? `<p class="text-xs font-bold text-blue-700 bg-blue-50 rounded-lg px-2 py-1 inline-flex items-center gap-1"><i class="fa-solid fa-calendar-check"></i> תאריך טיפול מתוזמן: ${new Date(call.scheduled_at).toLocaleDateString('he-IL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>` : `<p class="text-[10px] text-amber-600 font-bold">⚠️ טרם תוזמן תאריך טיפול</p>`}
                ${call.price_quote ? `<div class="p-2 bg-indigo-50 rounded-xl text-xs font-bold text-indigo-800">הצעת מחיר מהעסק: ₪${parseFloat(call.price_quote).toFixed(0)}</div>` : ''}
            </div>
            ${partsHtml}
            ${rateHtml}
            <div class="bg-slate-50 rounded-2xl p-3">
                <div class="text-[10px] font-bold text-slate-500 mb-2">💬 שיחה עם בעל המקצוע</div>
                <div id="fam-sc-chat-${callId}" class="min-h-[80px] max-h-48 overflow-y-auto mb-2">${msgHtml || '<p class="text-center text-slate-400 text-xs py-4">אין הודעות עדיין</p>'}</div>
                ${call.status !== 'done' && call.status !== 'cancelled' ? `<div class="flex gap-2">
                    <input type="text" id="fam-sc-msg-${callId}" placeholder="כתוב הודעה..." class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <button onclick="sendFamilyScMessage(${callId})" class="bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-black active:scale-95 transition"><i class="fa-solid fa-paper-plane"></i></button>
                </div>` : ''}
            </div>
            ${canCancel ? `<button onclick="cancelFamilyServiceCall(${callId})" class="w-full border border-red-200 text-red-500 font-bold py-3 rounded-2xl text-sm hover:bg-red-50 transition active:scale-95" style="touch-action:manipulation;">ביטול קריאה</button>` : ''}
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Chat polling every 10s
    if (window._famScChatInterval) clearInterval(window._famScChatInterval);
    window._famScChatInterval = setInterval(async () => {
        const chatEl = document.getElementById(`fam-sc-chat-${callId}`);
        if (!chatEl || !document.getElementById('fam-sc-modal')) { clearInterval(window._famScChatInterval); return; }
        try {
            const r2 = await fetch(`/api/service-calls/${callId}/messages`);
            const d2 = await r2.json();
            chatEl.innerHTML = (d2.messages||[]).map(m => `<div class="flex ${m.sender_type==='family'?'justify-start':'justify-end'} mb-2"><div class="max-w-[80%] ${m.sender_type==='family'?'bg-slate-100 text-slate-800':'bg-indigo-500 text-white'} rounded-2xl px-3 py-2 text-xs"><div class="font-bold text-[10px] mb-1 opacity-70">${safeStr(m.sender_name||m.sender_type)}</div>${safeStr(m.message)}</div></div>`).join('') || '<p class="text-center text-slate-400 text-xs py-4">אין הודעות עדיין</p>';
            chatEl.scrollTop = chatEl.scrollHeight;
        } catch(e) {}
    }, 10000);
};

window.sendFamilyScMessage = async function(callId) {
    const input = document.getElementById(`fam-sc-msg-${callId}`);
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    try {
        await fetch(`/api/service-calls/${callId}/messages`, { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ senderType: 'family', senderName: currentUser?.nickname || 'משפחה', message: msg }) });
        const r = await fetch(`/api/service-calls/${callId}/messages`);
        const d = await r.json();
        const chatEl = document.getElementById(`fam-sc-chat-${callId}`);
        if (chatEl) {
            chatEl.innerHTML = (d.messages||[]).map(m => `<div class="flex ${m.sender_type==='family'?'justify-start':'justify-end'} mb-2">
                <div class="max-w-[80%] ${m.sender_type==='family'?'bg-slate-100 text-slate-800':'bg-indigo-500 text-white'} rounded-2xl px-3 py-2 text-xs">
                    <div class="font-bold text-[10px] mb-1 opacity-70">${safeStr(m.sender_name||m.sender_type)}</div>
                    ${safeStr(m.message)}
                </div>
            </div>`).join('');
            chatEl.scrollTop = chatEl.scrollHeight;
        }
    } catch(e) {}
};

window.cancelFamilyServiceCall = async function(callId) {
    if (!confirm('לבטל את הקריאה?')) return;
    try {
        const r = await fetch(`/api/service-calls/${callId}`, { method:'DELETE' });
        if (r.ok) {
            document.getElementById('fam-sc-modal')?.remove();
            await loadFamilyServiceCalls();
            if (typeof showToast === 'function') showToast('success', 'הקריאה בוטלה');
        }
    } catch(e) {}
};

window.rateFamilyServiceCall = async function(callId, rating) {
    try {
        const r = await fetch(`/api/service-calls/${callId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rating }) });
        if (r.ok) {
            const idx = familyServiceCalls.findIndex(c => c.id === callId);
            if (idx >= 0) familyServiceCalls[idx].rating = rating;
            const starsEl = document.getElementById(`fam-sc-stars-${callId}`);
            if (starsEl) starsEl.parentElement.outerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center"><span class="text-sm font-bold text-amber-700">הדירוג שלך: ${'⭐'.repeat(rating)}</span></div>`;
            renderBusinessServiceCallsTab();
            if (typeof showToast === 'function') showToast('success', 'תודה על הדירוג!');
        }
    } catch(e) {}
};

window.openServiceCallWizard = function(technicianId) {
    const tech = hmContacts.find(t => t.id === technicianId);
    if (!tech) return;
    document.getElementById('sc-wizard-modal')?.remove();
    const html = `<div id="sc-wizard-modal" class="fixed inset-0 bg-slate-900/60 z-[9992] flex items-end justify-center sm:items-center sm:p-4" style="direction:rtl;">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between px-4 py-4 border-b border-slate-100 bg-gradient-to-l from-indigo-50">
                <div>
                    <h3 class="font-black text-slate-800 text-base">🔧 קריאת שירות חדשה</h3>
                    <p class="text-xs text-indigo-600 font-medium mt-0.5">אל: ${safeStr(tech.name)}${tech.company_name ? ' · ' + safeStr(tech.company_name) : ''} <span class="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-black">ONEFLOW LIFE</span></p>
                </div>
                <button onclick="document.getElementById('sc-wizard-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100"><i class="fa-solid fa-xmark text-slate-500"></i></button>
            </div>
            <div class="p-4 space-y-3 overflow-y-auto max-h-[65vh]">
                <input type="hidden" id="scw-tech-id" value="${technicianId}">
                <input type="hidden" id="scw-biz-id" value="${tech.business_group_id}">
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">תיאור הבעיה *</label>
                    <textarea id="scw-title" rows="2" placeholder="למשל: המזגן לא מקרר, ברז דולף..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea>
                </div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">כתובת הטיפול</label>
                    <input id="scw-address" type="text" value="${[currentGroup?.city, currentGroup?.street_address].filter(Boolean).join(', ')}" placeholder="הרחוב שלך..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                </div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">פרטים נוספים (אופציונלי)</label>
                    <textarea id="scw-desc" rows="2" placeholder="הוסף מידע שיעזור לבעל המקצוע..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea>
                </div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">תאריך מועדף לטיפול (אופציונלי)</label>
                    <input id="scw-requested-date" type="datetime-local" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                </div>
                <div><label class="text-xs font-bold text-slate-500 mb-1 block">עדיפות</label>
                    <div class="grid grid-cols-4 gap-2">
                        ${[['low','נמוכה','🟢'],['normal','רגילה','🔵'],['high','גבוהה','🟠'],['urgent','דחוף','🔴']].map(([v,l,e]) =>
                            `<button type="button" onclick="scwSetPriority('${v}',this)" id="scwp-${v}" class="scwp-btn border rounded-xl py-2 text-xs font-bold text-slate-600 transition ${v==='normal'?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-slate-200'}" style="touch-action:manipulation;">${e}<br>${l}</button>`).join('')}
                    </div>
                    <input type="hidden" id="scw-priority" value="normal">
                </div>
            </div>
            <div class="p-4 border-t border-slate-100">
                <button onclick="submitServiceCallWizard()" class="w-full bg-indigo-600 text-white font-black py-3 rounded-2xl text-sm hover:bg-indigo-700 transition shadow-md">שלח קריאה → ${safeStr(tech.name)}</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.scwSetPriority = function(val, btn) {
    document.getElementById('scw-priority').value = val;
    document.querySelectorAll('.scwp-btn').forEach(b => b.className = b.className.replace('border-indigo-400 bg-indigo-50 text-indigo-700','border-slate-200').replace('border-indigo-400','border-slate-200'));
    btn.classList.remove('border-slate-200'); btn.classList.add('border-indigo-400','bg-indigo-50','text-indigo-700');
};

window.submitServiceCallWizard = async function() {
    const title = document.getElementById('scw-title')?.value?.trim();
    if (!title) { if(typeof showToast==='function') showToast('error','נא לתאר את הבעיה'); return; }
    const address = document.getElementById('scw-address')?.value?.trim();
    const desc = document.getElementById('scw-desc')?.value?.trim();
    const priority = document.getElementById('scw-priority')?.value || 'normal';
    const bizIdRaw = document.getElementById('scw-biz-id')?.value;
    const businessGroupId = (bizIdRaw && bizIdRaw !== 'null' && bizIdRaw !== 'undefined') ? parseInt(bizIdRaw) || null : null;
    const techIdRaw = document.getElementById('scw-tech-id')?.value;
    const techId = (techIdRaw && techIdRaw !== 'null' && techIdRaw !== 'undefined') ? parseInt(techIdRaw) || null : null;
    const requestedDate = document.getElementById('scw-requested-date')?.value || null;
    const customerName = currentUser?.nickname || currentUser?.name || null;
    try {
        const r = await fetch('/api/service-calls', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ familyGroupId: currentGroup.id, businessGroupId, technicianContactId: techId, title, description: desc||null, address: address||null, priority, createdByUserId: currentUser?.id, customerName, requestedDate }) });
        const d = await r.json();
        if (!r.ok) { if(typeof showToast==='function') showToast('error', d.error || 'שגיאה בשליחת הקריאה'); return; }
        document.getElementById('sc-wizard-modal')?.remove();
        if (typeof showToast === 'function') showToast('success', 'הקריאה נשלחה! 🎉');
        await loadFamilyServiceCalls();
        if (typeof switchTab === 'function') switchTab('myorders');
    } catch(e) { if(typeof showToast==='function') showToast('error','שגיאה בשליחת הקריאה'); }
};

window.openLinkBusinessModal = async function(techId) {
    document.getElementById('hm-link-biz-modal')?.remove();
    const isNew = (techId === null || techId === undefined);
    const subtitle = isNew
        ? 'חפש עסק ONEFLOW LIFE — אם נמצא, ייצור קשר חדש אוטומטית ותוכל לשלוח קריאות ישירות.'
        : 'חפש את שם העסק של בעל המקצוע ב-ONEFLOW LIFE כדי לאפשר שליחת קריאות ישירות.';
    const html = `<div id="hm-link-biz-modal" class="fixed inset-0 bg-slate-900/60 z-[9993] flex items-end justify-center sm:items-center sm:p-4" style="direction:rtl;">
        <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between px-4 py-4 border-b border-slate-100">
                <h3 class="font-black text-slate-800 text-base">🔍 חיפוש עסק ONEFLOW LIFE</h3>
                <button onclick="document.getElementById('hm-link-biz-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100"><i class="fa-solid fa-xmark text-slate-500"></i></button>
            </div>
            <div class="p-4 space-y-3">
                <p class="text-xs text-slate-500">${subtitle}</p>
                <input type="hidden" id="hm-link-tech-id" value="${techId ?? ''}">
                <select id="hm-link-type" onchange="searchBusinessForLink(document.getElementById('hm-link-search').value)" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none mb-1">
                    <option value="">כל סוגי העסקים</option>
                    <option value="electrician">חשמלאי</option>
                    <option value="plumber">אינסטלטור</option>
                    <option value="ac_tech">מיזוג אוויר</option>
                    <option value="carpenter">נגר</option>
                    <option value="painter">צבעי</option>
                    <option value="locksmith">מנעולן</option>
                    <option value="cleaner">ניקיון</option>
                    <option value="restaurant">מסעדה</option>
                    <option value="other">אחר</option>
                </select>
                <input id="hm-link-search" type="text" placeholder="שם עסק, טלפון..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none" oninput="searchBusinessForLink(this.value)" autofocus>
                <div id="hm-link-results" class="space-y-2 max-h-48 overflow-y-auto"></div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('hm-link-search')?.focus(), 100);
};

window.searchBusinessForLink = async function(q) {
    const el = document.getElementById('hm-link-results');
    if (!el || q.length < 2) { if(el) el.innerHTML = ''; return; }
    try {
        const bizType = document.getElementById('hm-link-type')?.value || '';
        const typeParam = bizType ? `&type=${encodeURIComponent(bizType)}` : '';
        const r = await fetch(`/api/groups/search-business?q=${encodeURIComponent(q)}${typeParam}`);
        const d = await r.json();
        if (!d.groups?.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">לא נמצאו עסקים</p>'; return; }
        const techIdVal = document.getElementById('hm-link-tech-id')?.value || '';
        el.innerHTML = d.groups.map(g => `<button onclick="linkTechToBusiness(${techIdVal||'null'}, ${g.id}, '${safeStr(g.name).replace(/'/g,"\\'")}', '${safeStr(g.phone||'').replace(/'/g,"\\'")}')" class="w-full text-right border border-slate-200 rounded-xl px-3 py-2.5 text-sm hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center gap-2 active:scale-[0.98]" style="touch-action:manipulation;">
            <i class="fa-solid fa-store text-indigo-400 shrink-0"></i>
            <div class="flex-1 min-w-0"><div class="font-bold text-slate-800 text-xs">${safeStr(g.name)}</div><div class="text-[10px] text-slate-400">${g.business_type||'עסק'}${g.phone ? ' · ' + safeStr(g.phone) : ''}</div></div>
            <i class="fa-solid fa-link text-indigo-400 text-xs shrink-0"></i>
        </button>`).join('');
    } catch(e) {}
};

window.linkTechToBusiness = async function(techId, bizGroupId, bizName, bizPhone) {
    try {
        let newTech = null;
        if (!techId) {
            const r = await fetch('/api/equipment/technicians', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ groupId: currentGroup.id, name: bizName || 'בעל מקצוע', phone: bizPhone || null, businessGroupId: bizGroupId }) });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'שגיאת שרת');
            newTech = d.technician;
        } else {
            const r = await fetch(`/api/equipment/technicians/${techId}/link-business`, { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ businessGroupId: bizGroupId }) });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'שגיאה בקישור');
            newTech = d.technician;
        }
        // Immediately update local cache so contact appears even if fetchHMContacts is slow
        if (newTech && typeof hmContacts !== 'undefined') {
            hmContacts = [...(hmContacts||[]).filter(c => c.id !== newTech.id), newTech];
            if (typeof renderHMContacts === 'function') renderHMContacts();
        }
        document.getElementById('hm-link-biz-modal')?.remove();
        switchHomeMaintenanceTab('contacts');
        if(typeof showToast==='function') showToast('success', 'הוקשר בהצלחה! 🎉');
        fetchHMContacts(); // refresh in background without awaiting
    } catch(e) { console.error('linkTechToBusiness error:', e); if(typeof showToast==='function') showToast('error', e.message || 'שגיאה'); }
};

function openHMContactModal(id = null) {
    let modal = getEl('hm-contact-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-contact-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="hmcontact-modal-title" class="font-black text-slate-800 text-base">הוספת איש קשר לתיקון</h3>
                    <button onclick="getEl('hm-contact-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <input type="hidden" id="hmcontact-id">
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">שם *</label><input id="hmcontact-name" type="text" placeholder="למשל: יוסי האינסטלטור" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">שם חברה</label><input id="hmcontact-company" type="text" placeholder="אופציונלי" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">התמחות</label><input id="hmcontact-specialty" type="text" placeholder="למשל: אינסטלציה, חשמל, מזגנים..." class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">טלפון</label><input id="hmcontact-phone" type="tel" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">מייל</label><input id="hmcontact-email" type="email" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"></div>
                    <div><label class="text-xs font-bold text-slate-500 mb-1 block">הערות</label><textarea id="hmcontact-notes" rows="2" class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"></textarea></div>
                </div>
                <div class="p-4 border-t border-slate-100"><button onclick="submitHMContact()" class="w-full bg-slate-800 text-white font-black py-3 rounded-2xl text-sm hover:bg-slate-700 transition shadow-md">שמור</button></div>
            </div>
        </div>`);
        modal = getEl('hm-contact-modal');
    }
    const contact = id ? hmContacts.find(x => x.id === id) : null;
    getEl('hmcontact-modal-title').textContent = contact ? 'עריכת איש קשר' : 'הוספת איש קשר לתיקון';
    getEl('hmcontact-id').value = contact ? contact.id : '';
    getEl('hmcontact-name').value = contact ? contact.name : '';
    getEl('hmcontact-company').value = contact ? (contact.company_name || '') : '';
    getEl('hmcontact-specialty').value = contact ? (contact.specialty || '') : '';
    getEl('hmcontact-phone').value = contact ? (contact.phone || '') : '';
    getEl('hmcontact-email').value = contact ? (contact.email || '') : '';
    getEl('hmcontact-notes').value = contact ? (contact.notes || '') : '';
    modal.classList.remove('hidden');
}

async function submitHMContact() {
    const id = getEl('hmcontact-id').value;
    const name = getEl('hmcontact-name').value.trim();
    if (!name) { showToast('error', 'שם חובה'); return; }
    try {
        const res = await fetch('/api/equipment/technicians', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: id||null, groupId: currentGroup.id, name,
                companyName: getEl('hmcontact-company').value||null, specialty: getEl('hmcontact-specialty').value||null,
                phone: getEl('hmcontact-phone').value||null, email: getEl('hmcontact-email').value||null,
                notes: getEl('hmcontact-notes').value||null }) });
        const data = await res.json();
        if (data.success) { showToast('success', id ? 'עודכן' : 'נוסף'); getEl('hm-contact-modal').classList.add('hidden'); await fetchHMContacts(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteHMContact(id) {
    if (!confirm('למחוק?')) return;
    try { await fetch(`/api/equipment/technicians/${id}`, { method: 'DELETE' }); showToast('info', 'נמחק'); await fetchHMContacts(); } catch(e) {}
}

// --- HISTORY ---
let hmHistItemId = null, hmHistData = [], hmHistTypeFilter = 'all', hmHistPeriodFilter = 'all';

async function openHMHistory(itemId) {
    const item = hmItems.find(x => x.id === itemId); if (!item) return;
    hmHistItemId = itemId; hmHistTypeFilter = 'all'; hmHistPeriodFilter = 'all';
    let modal = getEl('hm-history-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `<div id="hm-history-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[99] flex items-end justify-center sm:items-center sm:p-4">
            <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" style="max-height:88vh">
                <div class="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                    <div><h3 id="hmhist-title" class="font-black text-slate-800 text-base">היסטוריה</h3><p id="hmhist-subtitle" class="text-xs text-slate-400 mt-0.5"></p></div>
                    <button onclick="getEl('hm-history-modal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-4 border-b border-slate-100 space-y-2 shrink-0">
                    <input id="hmhist-search" type="text" placeholder="חיפוש..." oninput="renderHMHistFiltered()" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none">
                    <div class="flex gap-2 flex-wrap">
                        <div class="flex gap-0.5 bg-slate-100 rounded-xl p-1">
                            <button onclick="setHMHistFilter('type','all')" id="hmhf-type-all" class="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-white text-slate-700 shadow-sm">הכל</button>
                            <button onclick="setHMHistFilter('type','maintenance')" id="hmhf-type-maintenance" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">🔧 תחזוקה</button>
                            <button onclick="setHMHistFilter('type','fault')" id="hmhf-type-fault" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">⚠️ בעיות</button>
                        </div>
                        <div class="flex gap-0.5 bg-slate-100 rounded-xl p-1">
                            <button onclick="setHMHistFilter('period','all')" id="hmhf-period-all" class="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-white text-slate-700 shadow-sm">הכל</button>
                            <button onclick="setHMHistFilter('period','month')" id="hmhf-period-month" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">חודש</button>
                            <button onclick="setHMHistFilter('period','3months')" id="hmhf-period-3months" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">3 חודשים</button>
                            <button onclick="setHMHistFilter('period','year')" id="hmhf-period-year" class="text-[11px] px-2.5 py-1 rounded-lg font-bold text-slate-400">שנה</button>
                        </div>
                    </div>
                </div>
                <div id="hmhist-list" class="overflow-y-auto flex-1 p-4"></div>
            </div>
        </div>`);
        modal = getEl('hm-history-modal');
    }
    getEl('hmhist-title').textContent = `היסטוריה: ${item.name}`;
    getEl('hmhist-subtitle').textContent = 'טוען...';
    getEl('hmhist-search').value = '';
    modal.classList.remove('hidden');
    try {
        const res = await fetch(`/api/equipment/items/${itemId}/history?groupId=${currentGroup.id}`);
        const data = await res.json();
        if (data.success) { hmHistData = data.history; getEl('hmhist-subtitle').textContent = `${hmHistData.length} רשומות`; renderHMHistFiltered(); }
    } catch(e) { getEl('hmhist-subtitle').textContent = 'שגיאה בטעינה'; }
}

function setHMHistFilter(filterType, value) {
    if (filterType === 'type') { hmHistTypeFilter = value; ['all','maintenance','fault'].forEach(v => { const b = getEl(`hmhf-type-${v}`); if (b) b.className = `text-[11px] px-2.5 py-1 rounded-lg font-bold ${v === value ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`; }); }
    else { hmHistPeriodFilter = value; ['all','month','3months','year'].forEach(v => { const b = getEl(`hmhf-period-${v}`); if (b) b.className = `text-[11px] px-2.5 py-1 rounded-lg font-bold ${v === value ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`; }); }
    renderHMHistFiltered();
}

function renderHMHistFiltered() {
    const list = getEl('hmhist-list'); if (!list) return;
    const search = (getEl('hmhist-search')?.value || '').trim().toLowerCase();
    const periodMs = { month: 30, '3months': 90, year: 365 };
    const now = new Date();
    let filtered = hmHistData.filter(r => {
        if (hmHistTypeFilter !== 'all' && r.type !== hmHistTypeFilter) return false;
        if (hmHistPeriodFilter !== 'all') { const d = periodMs[hmHistPeriodFilter]; const c = new Date(now); c.setDate(c.getDate() - d); if (!r.event_date || new Date(r.event_date) < c) return false; }
        if (search) { const h = `${r.title} ${r.description||''} ${r.technician_name||''} ${r.resolution_notes||''}`.toLowerCase(); if (!h.includes(search)) return false; }
        return true;
    });
    if (!filtered.length) { list.innerHTML = `<div class="text-center py-10 text-slate-400"><i class="fa-solid fa-magnifying-glass text-2xl mb-2 opacity-30 block"></i><p class="text-sm">אין רשומות התואמות</p></div>`; return; }
    const mStatusLabels = { pending:'ממתין', completed:'בוצע', overdue:'באיחור' };
    const mStatusColors = { pending:'bg-amber-100 text-amber-700', completed:'bg-emerald-100 text-emerald-700', overdue:'bg-red-100 text-red-700' };
    list.innerHTML = filtered.map(r => {
        const dateStr = r.event_date ? new Date(r.event_date).toLocaleDateString('he-IL') : '';
        if (r.type === 'maintenance') {
            const stColor = mStatusColors[r.status] || 'bg-slate-100 text-slate-600';
            return `<div class="flex gap-3 mb-3"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 text-sm">🔧</div>
                <div class="flex-1 bg-blue-50 rounded-xl p-3">
                    <div class="flex items-center gap-2 flex-wrap mb-0.5"><span class="font-bold text-xs text-slate-800">${safeStr(r.title)}</span>${r.maintenance_type ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">${HM_MTYPE_LABELS[r.maintenance_type]||r.maintenance_type}</span>` : ''}<span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${stColor}">${mStatusLabels[r.status]||r.status}</span></div>
                    <p class="text-[10px] text-slate-400">${dateStr}${r.technician_name ? ' · ' + safeStr(r.technician_name) : ''}${r.cost ? ' · ₪' + r.cost : ''}</p>
                    ${r.description && r.description !== r.title ? `<p class="text-[11px] text-slate-500 mt-0.5">${safeStr(r.description)}</p>` : ''}
                </div></div>`;
        } else {
            return `<div class="flex gap-3 mb-3"><div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 text-sm">⚠️</div>
                <div class="flex-1 bg-red-50 rounded-xl p-3">
                    <div class="flex items-center gap-2 flex-wrap mb-0.5"><span class="font-bold text-xs text-slate-800">${safeStr(r.title)}</span><span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${HM_SEV_COLORS[r.severity]||''}">${HM_SEV_LABELS[r.severity]||''}</span><span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${HM_FSTATUS_COLORS[r.status]||''}">${HM_FSTATUS_LABELS[r.status]||r.status}</span></div>
                    <p class="text-[10px] text-slate-400">${dateStr}</p>
                    ${r.description ? `<p class="text-[11px] text-slate-500">${safeStr(r.description)}</p>` : ''}
                    ${r.resolution_notes ? `<p class="text-[11px] text-emerald-700 mt-1 bg-emerald-50 px-2 py-0.5 rounded-lg">${safeStr(r.resolution_notes)}</p>` : ''}
                </div></div>`;
        }
    }).join('');
}

// ─── ONEFLOWLIFE MEMBER DASHBOARD ────────────────────────────────────────────
// ===== MEMBER TYPE — Module Locking + Upgrade Popups =====

const MEMBER_MODULES = {
  bank:              { icon:'🏦', name:'הבנק המשפחתי',       tagline:'הזמנות שלך — בתמונה הכלכלית המלאה', desc:'נהל הכנסות, הוצאות ודמי כיס לכל בני הבית ממקום אחד. כל הזמנה שתבצע מהעסקים שמחוברים אליך נרשמת אוטומטית — ותמיד תדע בדיוק לאן הכסף הולך.' },
  cashflow:          { icon:'💸', name:'תזרים הוצאות',         tagline:'כמה הוצאת החודש? בדיוק עכשיו תדע', desc:'מעקב חכם אחרי כל עסקה — כולל הזמנות, תשלומי מנויים ותיקונים מהעסקים שלך. גרף אחד, תמונה ברורה, שליטה מלאה.' },
  budget:            { icon:'📊', name:'ניהול תקציב',           tagline:'אל תגלה בסוף החודש', desc:'הגדר תקציב לכל קטגוריה — אוכל, בילויים, תחזוקה. הזמנות מהעסקים המחוברים אליך נספרות אוטומטית, ותקבל התראה לפני שחורגים.' },
  forecast:          { icon:'📅', name:'תשקיף עתידי',           tagline:'ראה 6 חודשים קדימה — לפני שהם מגיעים', desc:'תכנן הוצאות עתידיות, מנויים קבועים והזמנות חוזרות. AI שמנתח את ההרגלים שלך ומייצר תמונה כלכלית עתידית מדויקת.' },
  tasks:             { icon:'✅', name:'משימות וצ\'ופרים',       tagline:'הפוך משימות לפרסים — ממש', desc:'הקצה משימות לילדים ובני הבית, קבע פרסי כסף אמיתיים, ועקוב אחרי ביצוע. כשהמשפחה עובדת יחד — כולם מרוויחים.' },
  shop:              { icon:'🛒', name:'רשימת קניות חכמה',      tagline:'לא תשכח שום דבר — לעולם', desc:'רשימת קניות משותפת לכל המשפחה בזמן אמת. הוסף פריטים מהמזווה, שתף עם בן/בת הזוג, וסנכרן עם ההזמנות שלך מהעסקים באזור.' },
  pantry:            { icon:'📦', name:'מזווה חכם',              tagline:'תמיד תדע מה נגמר — לפני שנגמר', desc:'מעקב אחרי מלאי הבית: מזון, ניקיון, תרופות. כשמשהו אוזל — הזמן ישירות מהעסק המועדף שלך בלחיצה אחת.' },
  recipes:           { icon:'👨‍🍳', name:'שף פרטי AI',            tagline:'ארוחה מושלמת — ממה שכבר יש לך', desc:'מתכונים מותאמים אישית על בסיס מה שיש לך במזווה. AI שיודע מה הזמנת השבוע ומציע ארוחות שמשלימות את מה שכבר קנית.' },
  community:         { icon:'🏘️', name:'קהילה מקומית',           tagline:'הכוח של השכונה — ביד', desc:'גלה עסקים חדשים, קרא המלצות שכנים ותיאום קניות קבוצתיות. יותר עסקים לבחור — יותר כוח מיקוח ברשת שלך.' },
  members:           { icon:'👨‍👩‍👧‍👦', name:'ניהול משפחה',          tagline:'כולם בפנים — כל אחד בתפקידו', desc:'הוסף בני משפחה, הגדר הרשאות מותאמות לכל גיל ותפקיד. ניהול מלא של מי רואה מה ומי יכול לעשות מה.' },
  academy:           { icon:'🎓', name:'אקדמיה פיננסית',         tagline:'ילדים שמבינים כסף — מתחילים מהבית', desc:'אתגרי ידע פיננסי אינטראקטיביים לילדים עם פרסי כסף אמיתיים. כישורי חיים שהם ישאו איתם לאורך שנים.' },
  'home-maintenance':{ icon:'🔧', name:'ניהול הבית',              tagline:'הבית שלך — מתועד ומנוהל', desc:'עקוב אחרי תחזוקות, ביטוחים, ספקים וקריאות שירות. מחובר לעסקי התיקונים שמחוברים אליך — כל ההיסטוריה במקום אחד.' },
  'kids-wallet':     { icon:'👧', name:'ארנק דיגיטלי לילדים',   tagline:'הכסף של הילד — שקוף, חי, ומחנך', desc:'כל ילד מקבל ארנק דיגיטלי משלו עם יתרה, היסטוריית הוצאות והכנסות ומטרות חיסכון. אתה רואה הכל בזמן אמת — הם לומדים אחריות כלכלית. פרסי המשימות מועברים ישירות לארנק שלהם.' },
  'kids-mode':       { icon:'🧒', name:'מסך ילדים',               tagline:'הממשק שגורם להם לרצות להיכנס', desc:'הילד נכנס — המערכת מזהה אותו ומציגה לו בדיוק מה שלו: המשימות שממתינות, הפרסים שצבר, הוצאות והכנסות של הארנק שלו. ממשק שמרגיש "שלו" — לא של ההורים.' },
  'supermarket-mode':{ icon:'🛒', name:'מצב "אני בסופר"',          tagline:'קניות בזמן אמת — כולם בסנכרון', desc:'פתח מצב סופר בקנייה: כל מוצר שתסמן "נלקח" נעלם מהרשימה של כולם. מחיר יקר? קבל השוואה. מוצר חסר? בני הבית מוסיפים בזמן אמת.' },
  'ai-assistant':    { icon:'🤖', name:'עוזרת אישית AI',           tagline:'מנהלת הבית החכמה שרצית', desc:'AI שמכירה את המשפחה שלך: יודעת מה הזמנת, מה הוצאת, מה קניתם. שאל "מה לבשל הערב?" או "כמה הוצאנו על אוכל?" — תשובה מיידית מבוססת נתוני האמת שלך.' },
  'expense-tracking':{ icon:'📈', name:'מעקב הוצאות שוטף',         tagline:'מאה הוצאות קטנות — תמונה אחת גדולה', desc:'כל הוצאה נרשמת — חד פעמית, קבועה חודשית, מנוי שנתי. הזמנות מהעסקים המחוברים אליך נכנסות אוטומטית — אפס הקלדה ידנית.' },
};

async function loadMemberSettings() {
    try {
        const r = await fetch(`${API}/settings/member-content`);
        if (r.ok) window._memberContentSettings = await r.json();
        else window._memberContentSettings = {};
    } catch(e) { window._memberContentSettings = {}; }
}

// Lock all tabs for member type (except feed + myorders)
function applyMemberLocks() {
    const unlockedMods = currentGroup?.unlocked_modules || [];
    const ALWAYS_OPEN_TABS = ['feed', 'myorders'];
    const ALWAYS_OPEN_DROPS = ['myorders']; // fgdrop- items always open for members

    // --- Lock scrollable tab bar ---
    document.querySelectorAll('[id^="tab-"]').forEach(btn => {
        const tabId = btn.id.replace('tab-', '');
        if (ALWAYS_OPEN_TABS.includes(tabId) || unlockedMods.includes(tabId)) return;
        btn.classList.add('opacity-40', 'grayscale');
        btn.style.position = 'relative';
        if (!btn.querySelector('.member-lock-icon')) {
            const lk = document.createElement('span');
            lk.className = 'member-lock-icon';
            lk.style.cssText = 'position:absolute;top:2px;right:2px;font-size:8px;';
            lk.textContent = '\u{1F512}';
            btn.appendChild(lk);
        }
        btn.style.pointerEvents = 'auto';
        btn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); showMemberModuleUpgrade(tabId); };
    });

    // --- Lock top-nav dropdown items (fgdrop-*) ---
    document.querySelectorAll('[id^="fgdrop-"]').forEach(btn => {
        const tabId = btn.id.replace('fgdrop-', '');
        if (ALWAYS_OPEN_DROPS.includes(tabId) || unlockedMods.includes(tabId)) return;
        btn.style.opacity = '0.45';
        btn.style.pointerEvents = 'auto';
        const origOnclick = btn.getAttribute('onclick');
        btn.setAttribute('onclick', `event.stopPropagation();closeFamilyNavDropdowns();showMemberModuleUpgrade('${tabId}')`);
    });

    // --- Refresh quick tiles (lock icons already handled in renderQuickTiles) ---
    try { renderQuickTiles(); } catch(e) {}
}

// ===== MEMBER FEED DASHBOARD =====
window._mfOrdersCache = [];
window._mfFilter = { search: '', period: 'all', sort: 'desc' };
window._mfActiveTab = 'orders';

window.fetchMemberFeedOrders = async function() {
    const list = document.getElementById('mf-orders-list');
    if (!list || !currentUser) return;
    list.innerHTML = '<p style="font-size:11px;color:#94a3b8;text-align:center;padding:24px;background:#f8fafc;border-radius:12px;border:1px dashed #e2e8f0;">טוען הזמנות... <i class="fa-solid fa-spinner fa-spin ml-1"></i></p>';
    try {
        const res = await fetch(`${API}/store/orders/my/${currentUser.id}`);
        const data = await res.json();
        if (data.success) {
            const newOrders = data.orders || [];
            // Check for status changes and add notifications
            if (window._previousMfOrdersCache) {
                const oldMap = new Map((window._previousMfOrdersCache || []).map(o => [o.id, o]));
                newOrders.forEach(newOrder => {
                    const oldOrder = oldMap.get(newOrder.id);
                    if (oldOrder && oldOrder.status !== newOrder.status) {
                        // Order status changed - add bell badge notification
                        const badge = getEl('bell-badge');
                        if (badge) {
                            const count = parseInt(badge.textContent || '0') + 1;
                            badge.textContent = count;
                            badge.classList.remove('hidden');
                        }
                    }
                });
            }
            window._previousMfOrdersCache = newOrders;
            window._mfOrdersCache = newOrders;
            renderMemberFeedOrders();
        } else {
            list.innerHTML = `<p style="font-size:11px;color:#ef4444;text-align:center;padding:20px;">${data.error || 'שגיאה בטעינה'}</p>`;
        }
    } catch(e) {
        if (list) list.innerHTML = '<p style="font-size:11px;color:#ef4444;text-align:center;padding:20px;">שגיאת תקשורת</p>';
    }
};

window.renderMemberFeedOrders = function() {
    const list = document.getElementById('mf-orders-list');
    if (!list) return;
    let items = [...(window._mfOrdersCache || [])];
    const { search, period, sort } = window._mfFilter;
    if (search) items = items.filter(o => (o.business_name || '').includes(search) || (o.status || '').includes(search));
    if (period !== 'all') {
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
        const cutoff = new Date(Date.now() - days * 86400000);
        items = items.filter(o => new Date(o.created_at) >= cutoff);
    }
    items.sort((a, b) => sort === 'desc' ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at));
    if (!items.length) {
        list.innerHTML = '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:32px;background:#f8fafc;border-radius:12px;border:1px dashed #e2e8f0;">אין הזמנות להצגה</p>';
        return;
    }
    const statusColor = { pending:'#f59e0b', confirmed:'#3b82f6', delivered:'#10b981', cancelled:'#ef4444', processing:'#8b5cf6', new:'#ef4444', shipped:'#8b5cf6', delivering:'#8b5cf6', completed:'#10b981', ready:'#f59e0b', done:'#10b981' };
    const statusLabel = { pending:'ממתין', confirmed:'אושר', delivered:'נמסר', cancelled:'בוטל', processing:'בהכנה', new:'חדש', shipped:'בדרך אליך', delivering:'בדרך אליך', completed:'סופק', ready:'מוכן', done:'הושלם' };
    list.innerHTML = items.map(o => {
        const sc = statusColor[o.status] || '#64748b';
        const sl = statusLabel[o.status] || o.status;
        const dt = o.created_at ? new Date(o.created_at).toLocaleDateString('he-IL') : '';
        return '<div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:8px;direction:rtl;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
                '<div style="font-size:13px;font-weight:800;color:#1e293b;">' + safeStr(o.business_name || 'עסק') + '</div>' +
                '<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:8px;background:' + sc + '22;color:' + sc + ';">' + sl + '</span>' +
            '</div>' +
            (o.items_summary ? '<div style="font-size:11px;color:#64748b;margin-bottom:4px;">' + safeStr(o.items_summary) + '</div>' : '') +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<span style="font-size:11px;color:#94a3b8;">' + dt + '</span>' +
                (o.total_price ? '<span style="font-size:13px;font-weight:800;color:#1e293b;" dir="ltr">₪' + Number(o.total_price).toLocaleString() + '</span>' : '') +
            '</div>' +
        '</div>';
    }).join('');
};

window.filterMemberFeedOrders = function() {
    const inp = document.getElementById('mf-orders-search');
    if (inp) window._mfFilter.search = inp.value;
    renderMemberFeedOrders();
};

window.setMemberFeedPeriod = function(period) {
    window._mfFilter.period = period;
    document.querySelectorAll('[data-mfp]').forEach(btn => {
        const on = btn.dataset.mfp === period;
        btn.style.background = on ? '#6d28d9' : '#f1f5f9';
        btn.style.color = on ? 'white' : '#64748b';
    });
    renderMemberFeedOrders();
};

window.toggleMemberFeedSort = function() {
    window._mfFilter.sort = window._mfFilter.sort === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('mf-sort-btn');
    if (btn) btn.textContent = window._mfFilter.sort === 'desc' ? 'חדש\u2192ישן' : 'ישן\u2192חדש';
    renderMemberFeedOrders();
};

window.switchMemberFeedTab = function(tab) {
    window._mfActiveTab = tab;
    ['orders','faults','quotes'].forEach(t => {
        const sec = document.getElementById('mf-section-' + t);
        const btn = document.getElementById('mf-tab-' + t);
        if (sec) sec.style.display = t === tab ? 'block' : 'none';
        if (btn) {
            btn.style.background = t === tab ? 'white' : 'transparent';
            btn.style.color = t === tab ? '#334155' : '#94a3b8';
            btn.style.fontWeight = t === tab ? '900' : '700';
            btn.style.boxShadow = t === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none';
        }
    });
    if (tab === 'faults') loadMemberFeedFaults();
    if (tab === 'quotes') loadMemberFeedQuotes();
};

window.loadMemberFeedFaults = async function() {
    const list = document.getElementById('mf-faults-list');
    if (!list || !currentGroup) return;
    list.innerHTML = '<p style="font-size:11px;color:#94a3b8;text-align:center;padding:24px;"><i class="fa-solid fa-spinner fa-spin"></i></p>';
    try {
        const res = await fetch(`${API}/family/service-calls/${currentGroup.id}`);
        const data = await res.json();
        const calls = data.calls || [];
        if (!calls.length) { list.innerHTML = '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:32px;background:#f8fafc;border-radius:12px;border:1px dashed #e2e8f0;">אין קריאות שירות פתוחות</p>'; return; }
        list.innerHTML = calls.map(c => {
            const dt = c.created_at ? new Date(c.created_at).toLocaleDateString('he-IL') : '';
            return '<div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:8px;direction:rtl;">' +
                '<div style="font-size:13px;font-weight:800;color:#1e293b;margin-bottom:4px;">' + safeStr(c.title || 'קריאת שירות') + '</div>' +
                (c.business_name ? '<div style="font-size:11px;color:#6d28d9;font-weight:700;margin-bottom:3px;">\uD83C\uDFE2 ' + safeStr(c.business_name) + '</div>' : '') +
                '<div style="font-size:11px;color:#94a3b8;">' + dt + '</div>' +
            '</div>';
        }).join('');
    } catch(e) { list.innerHTML = '<p style="font-size:11px;color:#ef4444;text-align:center;padding:20px;">שגיאת תקשורת</p>'; }
};

window.loadMemberFeedQuotes = async function() {
    const list = document.getElementById('mf-quotes-list');
    if (!list || !currentGroup) return;
    list.innerHTML = '<p style="font-size:11px;color:#94a3b8;text-align:center;padding:24px;"><i class="fa-solid fa-spinner fa-spin"></i></p>';
    try {
        const res = await fetch(`${API}/family/quotes/${currentGroup.id}`);
        const data = await res.json();
        const quotes = data.quotes || [];
        if (!quotes.length) { list.innerHTML = '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:32px;background:#f8fafc;border-radius:12px;border:1px dashed #e2e8f0;">אין הצעות מחיר</p>'; return; }
        list.innerHTML = quotes.map(q => {
            const dt = q.created_at ? new Date(q.created_at).toLocaleDateString('he-IL') : '';
            const sc = q.status === 'approved' ? '#10b981' : q.status === 'rejected' ? '#ef4444' : '#f59e0b';
            const sl = q.status === 'approved' ? 'אושרה' : q.status === 'rejected' ? 'נדחתה' : 'ממתינה';
            return '<div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:8px;direction:rtl;">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;">' +
                    '<div style="font-size:13px;font-weight:800;color:#1e293b;">' + safeStr(q.business_name || 'עסק') + '</div>' +
                    '<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:8px;background:' + sc + '22;color:' + sc + ';">' + sl + '</span>' +
                '</div>' +
                '<div style="font-size:11px;color:#94a3b8;">' + dt + (q.total_price ? ' \u2022 \u20AA' + Number(q.total_price).toLocaleString() : '') + '</div>' +
            '</div>';
        }).join('');
    } catch(e) { list.innerHTML = '<p style="font-size:11px;color:#ef4444;text-align:center;padding:20px;">שגיאת תקשורת</p>'; }
};


window.showMemberModuleUpgrade = function(moduleKey) {
    const mod = MEMBER_MODULES[moduleKey] || { icon: '🔒', name: moduleKey, tagline: 'מודול זה דורש שדרוג', desc: 'צור קשר עם המנהל לפתיחת המודול.' };
    const _mcs2 = window._memberContentSettings || {};
    const _modSet = (_mcs2.memberModuleSettings || {})[moduleKey] || {};
    if (_modSet.enabled === false) return;
    document.getElementById('member-upgrade-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'member-upgrade-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:9999;display:flex;align-items:flex-end;justify-content:center;direction:rtl;';
    overlay.innerHTML = `<div style="background:white;width:100%;max-width:480px;border-radius:28px 28px 0 0;padding:24px 20px 32px;box-shadow:0 -8px 32px rgba(0,0,0,0.15);text-align:right;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <button onclick="document.getElementById('member-upgrade-overlay').remove()" style="width:32px;height:32px;background:#f1f5f9;border:none;border-radius:50%;font-size:14px;cursor:pointer;color:#64748b;">✕</button>
            <div style="font-size:28px;">${mod.icon}</div>
        </div>
        <div style="font-size:18px;font-weight:900;color:#1e293b;margin-bottom:4px;">🔒 ${_modSet.title ? safeStr(_modSet.title) : safeStr(mod.name)}</div>
        <div style="font-size:13px;font-weight:700;color:#7c3aed;margin-bottom:10px;">"${safeStr(mod.tagline)}"</div>
        ${(_modSet.text || mod.desc) ? '<div style="font-size:13px;color:#475569;line-height:1.6;margin-bottom:' + (_modSet.img ? '10px' : '20px') + ';background:#f8fafc;border-radius:12px;padding:12px;">' + safeStr(_modSet.text || mod.desc) + '</div>' : ''}
        ${_modSet.img ? '<img src="' + _modSet.img + '" style="width:100%;max-height:150px;object-fit:contain;border-radius:12px;margin-bottom:16px;">' : ''}
        <div id="member-upgrade-result" style="margin-bottom:8px;"></div>
        <button onclick="window._submitModuleRequest('${moduleKey}','${safeStr(mod.name).replace(/'/g,"&#39;")}')"
            style="width:100%;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;border:none;border-radius:16px;padding:14px;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:8px;">
            📤 שלח בקשת שדרוג לניהול
        </button>
        <div style="font-size:10px;color:#94a3b8;text-align:center;">המנהל יקבל את בקשתך ויוכל לפתוח את המודול עבורך</div>
    </div>`;
    document.body.appendChild(overlay);
};

window._submitModuleRequest = async function(moduleKey, moduleName) {
    const resEl = document.getElementById('member-upgrade-result');
    try {
        const r = await fetch(`${API}/member/request-module`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: currentGroup.id, moduleKey, moduleName })
        }).then(r => r.json());
        if (r.success) {
            if (resEl) resEl.innerHTML = '<div style="background:#f0fdf4;color:#16a34a;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;text-align:center;">✅ הבקשה נשלחה! המנהל יחזור אליך.</div>';
            const btn = document.querySelector('#member-upgrade-overlay button[onclick*="_submitModuleRequest"]');
            if (btn) btn.disabled = true;
        } else {
            if (resEl) resEl.innerHTML = '<div style="color:#ef4444;font-size:12px;text-align:center;">שגיאה — נסה שוב</div>';
        }
    } catch(e) {
        if (resEl) resEl.innerHTML = '<div style="color:#ef4444;font-size:12px;text-align:center;">שגיאת תקשורת</div>';
    }
};

// ===== END MEMBER TYPE =====

async function renderMemberDashboard() {
    // Hide family containers, show member dashboard
    const dc = getEl('dashboard-container'); if (dc) dc.classList.add('hidden');
    const fab = getEl('fab-container'); if (fab) fab.classList.add('hidden');
    let el = document.getElementById('member-dashboard-root');
    if (!el) {
        el = document.createElement('div');
        el.id = 'member-dashboard-root';
        el.style.cssText = 'position:fixed;inset:0;overflow-y:auto;background:#f8fafc;direction:rtl;z-index:50;';
        document.body.appendChild(el);
    }
    el.innerHTML = `<div style="max-width:480px;margin:0 auto;padding:16px 12px 80px;">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <button onclick="window._memberLogout()" style="background:#f1f5f9;border:none;border-radius:12px;padding:8px 14px;font-size:12px;font-weight:700;color:#64748b;cursor:pointer;">יציאה</button>
            <div style="text-align:right;">
                <div style="font-size:18px;font-weight:900;color:#1e293b;">שלום, ${safeStr(fmtUserName(currentUser) || currentUser.nickname)} 👋</div>
                <div style="font-size:11px;color:#94a3b8;">החשבון האישי שלך ב-ONEFLOW</div>
            </div>
        </div>

        <!-- Trial Banner -->
        <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:20px;padding:14px 16px;margin-bottom:16px;color:white;text-align:right;">
            <div style="font-size:13px;font-weight:900;margin-bottom:2px;">🎁 חודש ראשון בחינם!</div>
            <div style="font-size:11px;opacity:0.85;">גישה לכל ההזמנות, מנויים ונתונים שלך במקום אחד</div>
        </div>

        <!-- Notifications -->
        <div id="member-notifs-section" style="margin-bottom:12px;"></div>

        <!-- Businesses -->
        <div id="member-biz-list">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">טוען...</div>
        </div>
    </div>`;

    // Load notifications
    _memberLoadNotifications(currentGroup.id);

    // Load businesses
    try {
        const r = await fetch(`${API}/member/my-businesses/${currentGroup.id}`);
        const d = await r.json();
        const bizsEl = document.getElementById('member-biz-list');
        if (!bizsEl) return;
        const businesses = d.businesses || [];
        if (!businesses.length) {
            bizsEl.innerHTML = `<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px;">עדיין לא קושרת לעסקים. בקש מהמסלקאה/המאמן שלך לחבר אותך.</div>`;
            return;
        }
        const pending = businesses.filter(b => b.status === 'pending');
        const active  = businesses.filter(b => b.status === 'active');

        let html = '';

        // Pending requests section
        if (pending.length) {
            html += `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:20px;padding:14px;margin-bottom:16px;">
                <div style="font-size:13px;font-weight:900;color:#92400e;margin-bottom:10px;">⏳ בקשות קישור ממתינות לאישורך</div>
                ${pending.map(b => `
                <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #fde68a;">
                    <div style="font-size:22px;">${_memberBizIcon(b.business_type)}</div>
                    <div style="flex:1;text-align:right;">
                        <div style="font-size:13px;font-weight:800;color:#1e293b;">${safeStr(b.business_name)}</div>
                        <div style="font-size:10px;color:#92400e;">${_memberBizTypeLabel(b.business_type)} · ${b.linked_by_admin_name ? 'ע"י '+safeStr(b.linked_by_admin_name) : ''}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
                        <button onclick="window._memberRespond(${b.id},'approve')" style="background:#10b981;color:white;border:none;border-radius:10px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;">✅ אשר</button>
                        <button onclick="window._memberRespond(${b.id},'reject')" style="background:#f1f5f9;color:#ef4444;border:1px solid #fca5a5;border-radius:10px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;">✕ דחה</button>
                    </div>
                </div>`).join('')}
            </div>`;
        }

        const memberUnlockedModules = d.unlocked_modules || [];

        // Active businesses
        html += active.map(b => {
            const isRepair = b.business_type === 'maintenance_repair';
            const isRestaurant = b.business_type === 'restaurant';
            const bizNameEsc = safeStr(b.business_name).replace(/'/g,"&#39;");
            return `
            <div id="biz-section-${b.business_group_id}" style="background:white;border:1px solid #e2e8f0;border-radius:20px;padding:14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    <div style="width:38px;height:38px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
                        ${_memberBizIcon(b.business_type)}
                    </div>
                    <div style="flex:1;text-align:right;">
                        <div style="font-size:13px;font-weight:800;color:#1e293b;">${safeStr(b.business_name)}</div>
                        <div style="font-size:10px;color:#94a3b8;">${_memberBizTypeLabel(b.business_type)}</div>
                    </div>
                    ${isRepair ? `<button onclick="window._memberNewServiceCall('${b.business_group_id}','${bizNameEsc}')" style="background:#e0e7ff;color:#4f46e5;border:none;border-radius:10px;padding:6px 10px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0;">➕ קריאה חדשה</button>` : ''}
                </div>
                <div id="orders-${b.business_group_id}" style="text-align:center;color:#94a3b8;font-size:12px;padding:8px;">טוען...</div>
                ${isRestaurant ? `<div id="quotes-${b.business_group_id}"></div>` : ''}
            </div>`;
        }).join('');

        bizsEl.innerHTML = html || `<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px;">עדיין לא קושרת לעסקים.</div>`;

        // Load orders + quotes for active businesses only
        for (const b of active) {
            _memberLoadOrders(b.business_group_id, b.business_type);
            if (b.business_type === 'restaurant') _memberLoadQuotes(b.business_group_id);
        }
    } catch(e) {
        const bizsEl = document.getElementById('member-biz-list');
        if(bizsEl) bizsEl.innerHTML = `<div style="text-align:center;padding:24px;color:#ef4444;font-size:12px;">שגיאה בטעינת הנתונים</div>`;
    }
}

window._memberLogout = function() {
    localStorage.removeItem('ofl_session');
    window.location.reload();
};

async function _memberLoadNotifications(groupId) {
    const el = document.getElementById('member-notifs-section');
    if (!el) return;
    try {
        const r = await fetch(`${API}/alerts/notifications?groupId=${groupId}&limit=10`);
        const d = await r.json();
        const notifs = d.notifications || [];
        const unread = notifs.filter(n => !n.is_read);
        if (!notifs.length) { el.innerHTML = ''; return; }
        const statusDot = unread.length ? `<span style="background:#ef4444;color:white;font-size:10px;font-weight:700;border-radius:999px;padding:1px 7px;margin-right:6px;">${unread.length}</span>` : '';
        el.innerHTML = `<div style="background:white;border:1px solid #e2e8f0;border-radius:20px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <button onclick="_memberMarkAllNotifsRead(${groupId})" style="background:none;border:none;font-size:11px;color:#94a3b8;cursor:pointer;">סמן הכל כנקרא</button>
                <div style="font-size:13px;font-weight:800;color:#1e293b;text-align:right;">${statusDot}עדכונים מהעסקים שלך</div>
            </div>
            ${notifs.slice(0,5).map(n => {
                const dt = new Date(n.created_at).toLocaleDateString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
                const unreadStyle = !n.is_read ? 'background:#f0fdf4;border-right:3px solid #10b981;' : '';
                return `<div style="padding:8px 0;${unreadStyle}border-bottom:1px solid #f1f5f9;text-align:right;">
                    <div style="font-size:12px;color:#1e293b;font-weight:${n.is_read?'500':'700'}">${n.message}</div>
                    <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${dt}</div>
                </div>`;
            }).join('')}
        </div>`;
        if (unread.length) {
            try { await fetch(`${API}/alerts/notifications/read-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groupId }) }); } catch(e) {}
        }
    } catch(e) {}
}

async function _memberMarkAllNotifsRead(groupId) {
    try {
        await fetch(`${API}/alerts/notifications/read-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groupId }) });
        _memberLoadNotifications(groupId);
    } catch(e) {}
}

window._memberRespond = async function(linkId, decision) {
    try {
        const r = await fetch(`${API}/member/link/${linkId}/respond`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision })
        }).then(r => r.json());
        if (r.success) renderMemberDashboard();
    } catch(e) { alert('שגיאת תקשורת'); }
};

async function _memberLoadOrders(bizGroupId, bizType) {
    const el = document.getElementById(`orders-${bizGroupId}`);
    if (!el) return;
    try {
        const r = await fetch(`${API}/member/my-orders/${bizGroupId}/${currentGroup.id}`);
        const d = await r.json();
        const orders = d.orders || [];
        if (!orders.length) { el.innerHTML = `<div style="color:#94a3b8;font-size:12px;text-align:center;padding:8px;">אין היסטוריה עדיין</div>`; return; }
        const resolvedType = d.type || bizType;
        el.innerHTML = orders.map(o => {
            if (resolvedType === 'sport') {
                const statusColor = { active:'#10b981', frozen:'#3b82f6', expired:'#ef4444', cancelled:'#94a3b8' }[o.status] || '#94a3b8';
                const statusLabel = { active:'פעיל', frozen:'מוקפא', expired:'פג תוקף', cancelled:'בוטל' }[o.status] || o.status;
                const end = o.end_date ? new Date(o.end_date).toLocaleDateString('he-IL') : '—';
                const sess = o.sessions_total ? `${o.sessions_total-(o.sessions_used||0)}/${o.sessions_total} כניסות` : '';
                const canFreeze = o.status === 'active';
                const canUnfreeze = o.status === 'frozen';
                return `<div style="background:#f8fafc;border-radius:12px;padding:10px 12px;margin-bottom:8px;text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                        <span style="font-size:10px;font-weight:700;background:${statusColor}20;color:${statusColor};padding:2px 8px;border-radius:20px;">${statusLabel}</span>
                        <span style="font-size:12px;font-weight:800;color:#1e293b;">${safeStr(o.type_name||'מנוי')}</span>
                    </div>
                    <div style="font-size:10px;color:#94a3b8;margin-bottom:${canFreeze||canUnfreeze?'6':'0'}px;">${sess}${sess?' · ':''}עד ${end}</div>
                    ${canFreeze ? `<button onclick="window._memberFreeze(${o.id},'${bizGroupId}')" style="font-size:10px;font-weight:700;background:#dbeafe;color:#1d4ed8;border:none;border-radius:8px;padding:5px 0;cursor:pointer;width:100%;">❄️ הקפא מנוי</button>` : ''}
                    ${canUnfreeze ? `<button onclick="window._memberUnfreeze(${o.id},'${bizGroupId}')" style="font-size:10px;font-weight:700;background:#d1fae5;color:#065f46;border:none;border-radius:8px;padding:5px 0;cursor:pointer;width:100%;">▶️ שחרר הקפאה</button>` : ''}
                </div>`;
            } else if (resolvedType === 'maintenance_repair') {
                const SC_STATUS = { new:'חדשה', seen:'נצפתה', in_progress:'בטיפול', pending_parts:'ממתין לחלקים', done:'הושלם', cancelled:'בוטל' };
                const SC_COLOR = { new:'#6366f1', seen:'#3b82f6', in_progress:'#f59e0b', pending_parts:'#f97316', done:'#10b981', cancelled:'#94a3b8' };
                const statusLabel = SC_STATUS[o.status] || o.status;
                const statusColor = SC_COLOR[o.status] || '#94a3b8';
                const date = o.created_at ? new Date(o.created_at).toLocaleDateString('he-IL') : '';
                const scheduled = o.scheduled_at ? ` · תור: ${new Date(o.scheduled_at).toLocaleDateString('he-IL')}` : '';
                const price = o.price_quote ? ` · ₪${parseFloat(o.price_quote).toFixed(0)}` : '';
                const canCancel = !['done','cancelled'].includes(o.status);
                const canRate = o.status === 'done' && !o.rating;
                const titleEsc = safeStr(o.title||'קריאת שירות').replace(/'/g,"&#39;");
                return `<div style="background:#f8fafc;border-radius:12px;padding:10px 12px;margin-bottom:8px;text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                        <div style="display:flex;gap:6px;flex-shrink:0;">
                            <button onclick="window._memberOpenScDetails(${o.id},'${titleEsc}','${o.status}',${o.price_quote||0},'${bizGroupId}')" style="font-size:10px;font-weight:700;background:#e0e7ff;color:#4f46e5;border:none;border-radius:8px;padding:3px 8px;cursor:pointer;">💬 פרטים</button>
                            ${canCancel ? `<button onclick="window._memberCancelSc(${o.id},'${bizGroupId}')" style="font-size:10px;font-weight:700;background:#fee2e2;color:#ef4444;border:none;border-radius:8px;padding:3px 8px;cursor:pointer;">ביטול</button>` : ''}
                        </div>
                        <span style="font-size:12px;font-weight:800;color:#1e293b;">${safeStr(o.title||'קריאת שירות')}</span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-size:10px;font-weight:700;background:${statusColor}20;color:${statusColor};padding:2px 8px;border-radius:20px;">${statusLabel}</span>
                        <span style="font-size:10px;color:#94a3b8;">${date}${scheduled}${price}</span>
                    </div>
                    ${canRate ? `<div style="margin-top:6px;text-align:center;font-size:11px;color:#92400e;">דרג: ${[1,2,3,4,5].map(r=>`<span onclick="window._memberRateSc(${o.id},${r},'${bizGroupId}')" style="cursor:pointer;font-size:18px;">⭐</span>`).join('')}</div>` : ''}
                    ${o.rating ? `<div style="margin-top:4px;text-align:center;font-size:11px;color:#92400e;">הדירוג שלך: ${'⭐'.repeat(o.rating)}</div>` : ''}
                </div>`;
            } else if (resolvedType === 'restaurant') {
                const REST_STATUS = { new:'חדשה', preparing:'בהכנה', ready:'מוכן', delivered:'נמסר', cancelled:'בוטל' };
                const REST_COLOR = { new:'#6366f1', preparing:'#f59e0b', ready:'#10b981', delivered:'#64748b', cancelled:'#94a3b8' };
                const statusLabel = REST_STATUS[o.status] || o.status;
                const statusColor = REST_COLOR[o.status] || '#94a3b8';
                const date = o.created_at ? new Date(o.created_at).toLocaleDateString('he-IL') : '';
                const deliveryTag = o.is_delivery ? ' · 🛵 משלוח' : ' · 🥡 איסוף';
                const isDelivered = o.status === 'delivered' && (o.is_delivery === 1 || o.is_delivery === true || o.is_delivery === 'true');
                const hasRated = o.customer_rating;
                let itemsSummary = '';
                try {
                    const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
                    if (items.length) itemsSummary = items.slice(0,3).map(it => safeStr(it.name||it.title||'')).filter(Boolean).join(', ');
                } catch(e2) {}
                const confirmationUI = isDelivered ? (hasRated ?
                    `<div style="margin-top:6px;background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:6px 8px;text-align:center;font-size:10px;font-weight:700;color:#15803d;">✅ קיבלת ודירגת — תודה!</div>` :
                    `<div style="margin-top:6px;display:flex;gap:4px;">
                        <button onclick="window.confirmOrderReceipt(${o.id}, false)" style="flex:1;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;padding:6px;font-size:10px;font-weight:700;cursor:pointer;">❌ לא קיבלתי</button>
                        <button onclick="window.confirmOrderReceipt(${o.id}, true)" style="flex:1;background:#dcfce7;color:#15803d;border:none;border-radius:8px;padding:6px;font-size:10px;font-weight:700;cursor:pointer;">✅ כן, קיבלתי</button>
                    </div>`) : '';
                return `<div style="background:#f8fafc;border-radius:12px;padding:10px 12px;margin-bottom:8px;text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                        <span style="font-size:10px;font-weight:700;background:${statusColor}20;color:${statusColor};padding:2px 8px;border-radius:20px;">${statusLabel}</span>
                        <span style="font-size:12px;font-weight:800;color:#1e293b;">${safeStr(o.order_number||'הזמנה')}</span>
                    </div>
                    <div style="font-size:10px;color:#94a3b8;">${date}${deliveryTag}${o.total_amount?' · ₪'+parseFloat(o.total_amount).toFixed(0):''}</div>
                    ${itemsSummary ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">${itemsSummary}</div>` : ''}
                    ${confirmationUI}
                </div>`;
            } else {
                const date = o.created_at ? new Date(o.created_at).toLocaleDateString('he-IL') : '';
                return `<div style="background:#f8fafc;border-radius:12px;padding:10px 12px;margin-bottom:8px;text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
                        <span style="font-size:11px;font-weight:700;color:#64748b;">${date}</span>
                        <span style="font-size:12px;font-weight:800;color:#1e293b;">${safeStr(o.order_number||'הזמנה')}</span>
                    </div>
                    <div style="font-size:10px;color:#94a3b8;">${o.total_amount ? '₪'+parseFloat(o.total_amount).toFixed(0) : ''} ${o.status||''}</div>
                </div>`;
            }
        }).join('');
    } catch(e) { if(el) el.innerHTML = `<div style="color:#ef4444;font-size:12px;padding:8px;">שגיאה</div>`; }
}

function _memberBizIcon(type) {
    const icons = { sport:'🏋️', restaurant:'🍕', retail:'🛍️', services:'💼', construction:'🏗️', maintenance_repair:'🔧', logistics:'🚚', healthcare:'🏥', beauty:'💅', education:'🎓', events:'🎉', food_production:'🏭' };
    return icons[type] || '🏢';
}
function _memberBizTypeLabel(type) {
    const labels = { sport:'ספורט / כושר', restaurant:'מסעדה / בית קפה', retail:'חנות', services:'שירותים', construction:'בנייה', maintenance_repair:'תחזוקה', logistics:'לוגיסטיקה', healthcare:'בריאות', beauty:'יופי', education:'חינוך', events:'אירועים', food_production:'ייצור מזון' };
    return labels[type] || type;
}

// ONEFLOWLIFE MEMBER — interactive actions

window._memberOpenScDetails = async function(callId, title, status, priceQuote, bizGroupId) {
    let modal = document.getElementById('member-sc-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'member-sc-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;';
    const SC_STATUS = { new:'חדשה', seen:'נצפתה', in_progress:'בטיפול', pending_parts:'ממתין לחלקים', done:'הושלם', cancelled:'בוטל' };
    const statusLabel = SC_STATUS[status] || status;
    const canCancel = !['done','cancelled'].includes(status);
    const canRate = status === 'done';
    modal.innerHTML = `
        <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-height:85vh;overflow-y:auto;padding:20px 16px 32px;direction:rtl;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <button onclick="document.getElementById('member-sc-modal')?.remove()" style="background:#f1f5f9;border:none;border-radius:12px;padding:6px 14px;font-size:12px;font-weight:700;color:#64748b;cursor:pointer;">סגור</button>
                <div style="text-align:right;">
                    <div style="font-size:14px;font-weight:900;color:#1e293b;">${safeStr(title)}</div>
                    <div style="font-size:11px;color:#94a3b8;">${statusLabel}${priceQuote ? ' · ₪'+parseFloat(priceQuote).toFixed(0) : ''}</div>
                </div>
            </div>
            <div id="member-sc-chat-${callId}" style="background:#f8fafc;border-radius:16px;padding:12px;min-height:80px;max-height:260px;overflow-y:auto;margin-bottom:12px;">
                <div style="text-align:center;color:#94a3b8;font-size:12px;">טוען שיחה...</div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:12px;">
                <button onclick="window._memberSendScMsg(${callId},'${bizGroupId}')" style="background:#4f46e5;color:white;border:none;border-radius:12px;padding:10px 16px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;">שלח</button>
                <input id="member-sc-msg-input-${callId}" type="text" placeholder="כתוב הודעה..." style="flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;direction:rtl;outline:none;" onkeydown="if(event.key==='Enter')window._memberSendScMsg(${callId},'${bizGroupId}')"/>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${canCancel ? `<button onclick="window._memberCancelSc(${callId},'${bizGroupId}')" style="background:#fee2e2;color:#ef4444;border:none;border-radius:12px;padding:8px 16px;font-size:11px;font-weight:700;cursor:pointer;">ביטול קריאה</button>` : ''}
                ${canRate ? `<div style="width:100%;text-align:center;padding:8px;background:#fffbeb;border-radius:12px;">
                    <div style="font-size:11px;color:#92400e;margin-bottom:4px;font-weight:700;">דרג את השירות</div>
                    ${[1,2,3,4,5].map(r=>`<span onclick="window._memberRateSc(${callId},${r},'${bizGroupId}')" style="cursor:pointer;font-size:22px;">⭐</span>`).join('')}
                </div>` : ''}
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    try {
        const r = await fetch(`/api/service-calls/${callId}/messages`);
        const d = await r.json();
        const chatEl = document.getElementById(`member-sc-chat-${callId}`);
        if (chatEl) {
            const msgs = d.messages || [];
            chatEl.innerHTML = msgs.length ? msgs.map(m => `<div style="display:flex;justify-content:${m.sender_type==='family'?'flex-start':'flex-end'};margin-bottom:8px;">
                <div style="max-width:80%;background:${m.sender_type==='family'?'#f1f5f9':'#4f46e5'};color:${m.sender_type==='family'?'#1e293b':'white'};border-radius:12px;padding:8px 12px;font-size:12px;">
                    <div style="font-size:9px;opacity:0.7;margin-bottom:2px;font-weight:700;">${safeStr(m.sender_name||m.sender_type)}</div>
                    ${safeStr(m.message)}
                </div>
            </div>`).join('') : '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:16px;">אין הודעות עדיין</div>';
            chatEl.scrollTop = chatEl.scrollHeight;
        }
    } catch(e) {}
};

window._memberSendScMsg = async function(callId, bizGroupId) {
    const input = document.getElementById(`member-sc-msg-input-${callId}`);
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    try {
        await fetch(`/api/service-calls/${callId}/messages`, { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ senderType:'family', senderName: currentUser?.nickname || 'לקוח', message: msg }) });
        const r2 = await fetch(`/api/service-calls/${callId}/messages`);
        const d2 = await r2.json();
        const chatEl = document.getElementById(`member-sc-chat-${callId}`);
        if (chatEl) {
            chatEl.innerHTML = (d2.messages||[]).map(m => `<div style="display:flex;justify-content:${m.sender_type==='family'?'flex-start':'flex-end'};margin-bottom:8px;">
                <div style="max-width:80%;background:${m.sender_type==='family'?'#f1f5f9':'#4f46e5'};color:${m.sender_type==='family'?'#1e293b':'white'};border-radius:12px;padding:8px 12px;font-size:12px;">
                    <div style="font-size:9px;opacity:0.7;margin-bottom:2px;font-weight:700;">${safeStr(m.sender_name||m.sender_type)}</div>
                    ${safeStr(m.message)}
                </div>
            </div>`).join('');
            chatEl.scrollTop = chatEl.scrollHeight;
        }
    } catch(e) {}
};

window._memberCancelSc = async function(callId, bizGroupId) {
    if (!confirm('לבטל את הקריאה?')) return;
    try {
        const r = await fetch(`/api/service-calls/${callId}`, { method:'DELETE' });
        if (r.ok) {
            document.getElementById('member-sc-modal')?.remove();
            _memberLoadOrders(bizGroupId, 'maintenance_repair');
        }
    } catch(e) {}
};

window._memberRateSc = async function(callId, rating, bizGroupId) {
    try {
        await fetch(`/api/service-calls/${callId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rating }) });
        document.getElementById('member-sc-modal')?.remove();
        _memberLoadOrders(bizGroupId, 'maintenance_repair');
    } catch(e) {}
};

window._memberFreeze = async function(membershipId, bizGroupId) {
    if (!confirm('להקפיא את המנוי?')) return;
    try {
        const r = await fetch(`/api/sport/members/${membershipId}/freeze`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
        if (r.ok) _memberLoadOrders(bizGroupId, 'sport');
    } catch(e) {}
};

window._memberUnfreeze = async function(membershipId, bizGroupId) {
    if (!confirm('לשחרר את ההקפאה?')) return;
    try {
        const r = await fetch(`/api/sport/members/${membershipId}/unfreeze`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
        if (r.ok) _memberLoadOrders(bizGroupId, 'sport');
    } catch(e) {}
};

// פתיחת קריאת שירות חדשה מדשבורד חבר
window._memberNewServiceCall = function(bizGroupId, bizName) {
    document.getElementById('member-new-sc-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'member-new-sc-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;';
    modal.innerHTML = `
        <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-height:85vh;overflow-y:auto;padding:20px 16px 32px;direction:rtl;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <button onclick="document.getElementById('member-new-sc-modal')?.remove()" style="background:#f1f5f9;border:none;border-radius:12px;padding:6px 14px;font-size:12px;font-weight:700;color:#64748b;cursor:pointer;">סגור</button>
                <div style="text-align:right;">
                    <div style="font-size:14px;font-weight:900;color:#1e293b;">🔧 קריאת שירות חדשה</div>
                    <div style="font-size:11px;color:#94a3b8;">${safeStr(bizName)}</div>
                </div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">תיאור הבעיה *</label>
                <textarea id="mnsc-title" rows="2" placeholder="למשל: המזגן לא מקרר, ברז דולף..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;direction:rtl;outline:none;resize:none;box-sizing:border-box;"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">כתובת הטיפול</label>
                <input id="mnsc-address" type="text" placeholder="הרחוב שלך..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;direction:rtl;outline:none;box-sizing:border-box;"/>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">פרטים נוספים (אופציונלי)</label>
                <textarea id="mnsc-desc" rows="2" style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;direction:rtl;outline:none;resize:none;box-sizing:border-box;"></textarea>
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">עדיפות</label>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
                    ${[['low','נמוכה','🟢'],['normal','רגילה','🔵'],['high','גבוהה','🟠'],['urgent','דחוף','🔴']].map(([v,l,e])=>`<button type="button" onclick="document.getElementById('mnsc-priority').value='${v}';document.querySelectorAll('.mnsc-prio-btn').forEach(b=>b.style.borderColor='#e2e8f0');this.style.borderColor='#4f46e5'" class="mnsc-prio-btn" style="border:2px solid ${v==='normal'?'#4f46e5':'#e2e8f0'};border-radius:10px;padding:8px 4px;font-size:11px;font-weight:700;cursor:pointer;background:white;">${e}<br>${l}</button>`).join('')}
                </div>
                <input type="hidden" id="mnsc-priority" value="normal"/>
            </div>
            <button onclick="window._memberSubmitNewSc('${bizGroupId}')" style="width:100%;background:#4f46e5;color:white;border:none;border-radius:14px;padding:14px;font-size:13px;font-weight:900;cursor:pointer;">שלח קריאה ←</button>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

window._memberSubmitNewSc = async function(bizGroupId) {
    const title = document.getElementById('mnsc-title')?.value?.trim();
    if (!title) { alert('נא לתאר את הבעיה'); return; }
    const address = document.getElementById('mnsc-address')?.value?.trim() || null;
    const desc = document.getElementById('mnsc-desc')?.value?.trim() || null;
    const priority = document.getElementById('mnsc-priority')?.value || 'normal';
    try {
        const r = await fetch('/api/service-calls', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
                familyGroupId: currentGroup.id,
                businessGroupId: parseInt(bizGroupId),
                title, description: desc, address, priority,
                customerName: currentUser?.nickname || null,
                customerPhone: currentUser?.phone || null,
                createdByUserId: currentUser?.id || null
            })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('member-new-sc-modal')?.remove();
            _memberLoadOrders(bizGroupId, 'maintenance_repair');
        } else { alert(d.error || 'שגיאה בשליחה'); }
    } catch(e) { alert('שגיאת תקשורת'); }
};

// טעינת הצעות מחיר למסעדה בדשבורד חבר
async function _memberLoadQuotes(bizGroupId) {
    const el = document.getElementById(`quotes-${bizGroupId}`);
    if (!el) return;
    try {
        const r = await fetch(`${API}/store/quotes/family/${currentGroup.id}?userId=${currentUser?.id||''}`);
        const d = await r.json();
        const quotes = (d.quotes||[]).filter(q => String(q.group_id) === String(bizGroupId));
        if (!quotes.length) return;
        // add to familyQuotesCache so openFamilyQuoteView can find them
        quotes.forEach(q => {
            if (!familyQuotesCache.find(x => x.id === q.id)) familyQuotesCache.push(q);
        });
        const QS = { waiting_customer:'ממתינה לתגובתך', customer_approved:'אישרת', waiting_business:'בבדיקת העסק', cancelled:'בוטלה' };
        const QC = { waiting_customer:'#f59e0b', customer_approved:'#10b981', waiting_business:'#6366f1', cancelled:'#94a3b8' };
        el.innerHTML = `<div style="border-top:1px solid #f1f5f9;padding-top:8px;margin-top:4px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px;">📋 הצעות מחיר</div>
            ${quotes.map(q => {
                const qs = q.quote_status || (q.status==='quote'?'waiting_customer':q.status);
                const qColor = QC[qs] || '#94a3b8';
                const qLabel = QS[qs] || qs;
                const date = q.created_at ? new Date(q.created_at).toLocaleDateString('he-IL') : '';
                const total = q.total_amount ? '₪'+parseFloat(q.total_amount).toFixed(0) : '';
                return `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
                    <button onclick="openFamilyQuoteView(${q.id})" style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;">צפה</button>
                    <div style="text-align:right;">
                        <div style="font-size:12px;font-weight:800;color:#1e293b;">${safeStr(q.quote_title||'הצעת מחיר')}</div>
                        <div style="font-size:10px;color:#92400e;">${qLabel}${total?' · '+total:''}${date?' · '+date:''}</div>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    } catch(e) {}
}

// SA: שדרוג חבר למשפחה

window.saSetMemberModules = async function(groupId) {
    const MODULES = ['full_orders','full_service_calls','community','calendar'];
    const selected = MODULES.filter(k => document.getElementById(`samod-${k}`)?.checked);
    try {
        const r = await fetch(`${API}/sa/groups/${groupId}/modules`, {
            method: 'PATCH', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ modules: selected })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('sa-modules-modal')?.remove();
            if (typeof showToast === 'function') showToast('success', '✅ מודולים עודכנו');
            if (typeof loadSAData === 'function') loadSAData();
        } else { alert(d.error || 'שגיאה'); }
    } catch(e) { alert('שגיאת תקשורת'); }
};

// ============================================================
// ===== הפעילות שלי — עסקים שקישרו את המשפחה =======================

const _ACTIVITY_CAT = {
    beauty:             { icon: '💅', label: 'יופי וטיפוח' },
    gym:                { icon: '💪', label: 'כושר וספורט' },
    sport:              { icon: '🏋️', label: 'ספורט' },
    restaurant:         { icon: '🍽️', label: 'מסעדה' },
    maintenance_repair: { icon: '🔧', label: 'תיקונים ואחזקה' },
    construction:       { icon: '🏗️', label: 'בנייה ושיפוץ' },
    services:           { icon: '🛎️', label: 'שירותים' },
    healthcare:         { icon: '🏥', label: 'בריאות' },
    events:             { icon: '🎉', label: 'אירועים' },
    other:              { icon: '🏢', label: 'עסקים נוספים' },
};

let _activityAllBiz = [];

async function loadMyActivities() {
    const el = document.getElementById('my-activities-list');
    if (!el || !currentGroup) return;
    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען...</p>';
    try {
        const d = await fetch(`${API}/family/linked-businesses/${currentGroup.id}`).then(r => r.json());
        _activityAllBiz = d.businesses || [];

        if (!_activityAllBiz.length) {
            el.innerHTML = `
                <div class="text-center py-10 text-slate-400">
                    <div class="text-3xl mb-2">🏢</div>
                    <p class="text-sm font-bold text-slate-500">עדיין אין פעילות</p>
                    <p class="text-xs mt-1">כאשר עסק יוסיף אותך כלקוח, הוא יופיע כאן</p>
                </div>`;
            return;
        }

        // Build search + filter controls (only non-pending types)
        const types = [...new Set(_activityAllBiz.map(b => b.business_type || 'other'))];
        const filterPills = ['all', ...types].map(t => {
            const cat = _ACTIVITY_CAT[t] || { icon: '🏢', label: t };
            return `<button class="act-filter-pill shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${t === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}" data-type="${t}" onclick="window._actFilter(this)">
                ${t === 'all' ? 'הכל' : cat.icon + ' ' + cat.label}
            </button>`;
        }).join('');

        el.innerHTML = `
            <div class="mb-3 space-y-2">
                <div class="relative">
                    <input id="act-search" type="search" placeholder="חפש עסק..." oninput="window._actSearch(this.value)"
                        class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm pr-9 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400" />
                    <i class="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                </div>
                ${types.length > 1 ? `<div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">${filterPills}</div>` : ''}
            </div>
            <div id="act-biz-list"></div>`;

        _actRender('all', '');
    } catch(e) {
        el.innerHTML = '<p class="text-xs text-red-500 text-center py-6">שגיאה בטעינת הנתונים</p>';
    }
}

window._actRespond = async function(linkId, decision) {
    try {
        const res = await fetch(`${API}/member/link/${linkId}/respond`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ decision })
        });
        const d = await res.json();
        if (d.success) {
            showToast('success', decision === 'approve' ? 'הקישור אושר!' : 'הקישור נדחה');
            loadMyActivities();
        } else showToast('error', 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
};

window._actFilter = function(btn) {
    document.querySelectorAll('.act-filter-pill').forEach(b => {
        b.className = b.className.replace(/bg-indigo-600 text-white border-indigo-600/, 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300');
    });
    btn.className = btn.className.replace('bg-white text-slate-600 border-slate-200 hover:border-indigo-300', 'bg-indigo-600 text-white border-indigo-600');
    const search = document.getElementById('act-search')?.value || '';
    _actRender(btn.dataset.type, search);
};

window._actSearch = function(q) {
    const active = document.querySelector('.act-filter-pill.bg-indigo-600')?.dataset.type || 'all';
    _actRender(active, q);
};

function _actRender(filterType, searchQ) {
    const listEl = document.getElementById('act-biz-list');
    if (!listEl) return;
    const q = (searchQ || '').trim().toLowerCase();

    const visible = _activityAllBiz.filter(b => {
        if (filterType !== 'all' && (b.business_type || 'other') !== filterType) return false;
        if (q && !b.business_name?.toLowerCase().includes(q)) return false;
        return true;
    });

    // Group by type preserving order
    const groups = {};
    for (const b of visible) {
        const t = b.business_type || 'other';
        if (!groups[t]) groups[t] = [];
        groups[t].push(b);
    }

    let html = '';
    for (const [type, bizsOfType] of Object.entries(groups)) {
        const cat = _ACTIVITY_CAT[type] || { icon: '🏢', label: 'עסקים נוספים' };
        const realBizs = bizsOfType;
        const showHeader = filterType === 'all' || (Object.keys(groups).length > 1);

        html += `<div class="mb-5" data-cat="${type}">`;
        if (showHeader) {
            html += `<div class="flex items-center gap-2 mb-2.5 px-1 border-b border-slate-100 pb-1.5">
                <span class="text-lg">${cat.icon}</span>
                <h3 class="text-sm font-black text-slate-700">${cat.label}</h3>
                ${realBizs.length > 0 ? `<span class="text-[10px] font-bold text-slate-400 mr-auto">${realBizs.length} עסקים</span>` : ''}
            </div>`;
        }
        html += `<div class="space-y-2">`;

        for (const b of realBizs) {
            const storeLink = b.group_code ? `${window.location.origin}/storefront.html?store=${b.group_code}${b.community_id ? '&communityId=' + b.community_id : ''}` : '';
            const linkedDate = b.linked_at ? new Date(b.linked_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
            const bizId = b.business_group_id;
            const bizType = b.business_type || 'other';
            const isPending = b.status === 'pending';

            if (isPending) {
                html += `<div class="biz-act-wrapper rounded-2xl overflow-hidden shadow-sm border border-amber-200 bg-amber-50" data-biz-id="${bizId}">
                    <div class="flex items-center gap-3 p-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-xl flex-shrink-0">${cat.icon}</div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <p class="font-black text-slate-800 text-sm truncate">${safeStr(b.business_name)}</p>
                                <span class="text-[9px] font-black bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">⏳ ממתין לאישורך</span>
                            </div>
                            <p class="text-[10px] text-amber-700 mt-0.5">${b.linked_by_admin_name ? 'בקשה מ' + safeStr(b.linked_by_admin_name) : cat.label}${linkedDate ? ' · ' + linkedDate : ''}</p>
                        </div>
                        <div class="flex flex-col gap-1.5 shrink-0">
                            <button onclick="window._actRespond(${b.link_id},'approve')" class="bg-emerald-500 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold whitespace-nowrap">✅ אשר</button>
                            <button onclick="window._actRespond(${b.link_id},'reject')" class="bg-white text-red-500 border border-red-200 rounded-lg px-3 py-1.5 text-[11px] font-bold whitespace-nowrap">✕ דחה</button>
                        </div>
                    </div>
                </div>`;
                continue;
            }

            html += `<div class="biz-act-wrapper rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white" data-biz-id="${bizId}">
                <div class="flex items-center gap-3 p-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center text-xl flex-shrink-0">${cat.icon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <p class="font-black text-slate-800 text-sm truncate">${safeStr(b.business_name)}</p>
                            <span id="biz-appt-pending-badge-${bizId}" class="hidden text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full">⏳ ממתין לאישורך</span>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5">${cat.label}${linkedDate ? ' · מ-' + linkedDate : ''}</p>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${storeLink ? `<a href="${storeLink}" target="_blank" rel="noopener" class="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl px-2.5 py-2 text-[10px] font-bold hover:bg-indigo-100 transition flex flex-col items-center gap-0.5">
                            <i class="fa-solid fa-store text-xs"></i><span>חנות</span>
                        </a>` : ''}
                        <button onclick="window._bizQuickActions(${bizId},'${bizType}','${(b.business_name||'').replace(/'/g,"\\'")}','${b.group_code||''}')"
                            class="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-lg font-black flex items-center justify-center hover:opacity-90 transition shadow-sm">+</button>
                        <button onclick="window._toggleBizAccordion(this,${bizId},'${bizType}')"
                            class="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition text-sm">
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="biz-accordion hidden border-t border-slate-100">
                    <div class="p-3 text-center text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען...</div>
                </div>
            </div>`;
        }



        html += `</div></div>`;
    }

    if (!html) {
        html = `<div class="text-center py-8 text-slate-400">
            <div class="text-2xl mb-1">🔍</div>
            <p class="text-sm">לא נמצאו עסקים תואמים</p>
        </div>`;
    }

    listEl.innerHTML = html;
}

// ─── BIZ QUICK ACTIONS ────────────────────────────────────────────────────────

const _BIZ_ACTIONS_MAP = {
    beauty:             [{ icon:'📅', label:'קבע תור', action:'beauty_book' }, { icon:'💌', label:'ייעוץ מקדים', action:'beauty_rfq' }, { icon:'✉️', label:'שלח הודעה', action:'message' }],
    sport:              [{ icon:'💳', label:'רכוש מנוי', action:'storefront' }, { icon:'✉️', label:'שלח הודעה', action:'message' }],
    gym:                [{ icon:'💳', label:'רכוש מנוי', action:'storefront' }, { icon:'✉️', label:'שלח הודעה', action:'message' }],
    restaurant:         [{ icon:'🛒', label:'בצע הזמנה', action:'storefront' }, { icon:'🍽️', label:'הזמן שולחן', action:'table_reservation' }, { icon:'✉️', label:'שלח הודעה', action:'message' }],
    maintenance_repair: [{ icon:'🔧', label:'פתח קריאת שירות', action:'service_call' }, { icon:'✉️', label:'שלח הודעה', action:'message' }],
    logistics:          [{ icon:'📦', label:'בקש הצעת מחיר', action:'storefront' }, { icon:'✉️', label:'שלח הודעה', action:'message' }],
};

window._bizQuickActions = function(bizGroupId, bizType, bizName, groupCode) {
    const biz = _activityAllBiz.find(b => b.business_group_id == bizGroupId) || {};
    const lf = biz.licensed_features || null;
    const defaultActions = _BIZ_ACTIONS_MAP[bizType] || [{ icon:'🌐', label:'בקר בחנות', action:'storefront' }, { icon:'✉️', label:'שלח הודעה', action:'message' }];
    const actionKeyMap = { storefront:'ss_storefront', beauty_rfq:'ss_rfq', service_call:'ss_service_call', message:'ss_message', table_reservation:'ss_table_reservation' };
    const actions = lf ? defaultActions.filter(a => { const k = actionKeyMap[a.action]; return !k || lf[k] !== false; }) : defaultActions;
    const storeUrl = groupCode ? `${window.location.origin}/storefront.html?store=${groupCode}` : null;
    const btns = actions.map(a => {
        let handler = '';
        if (a.action === 'storefront' && storeUrl) handler = `
            const newWindow = window.open('${storeUrl}&familyGroupId=${currentGroup?.id||''}','_blank');
            const checkFocus = setInterval(() => {
                if (newWindow?.closed) {
                    clearInterval(checkFocus);
                    if (window._currentFamilyTab === 'myorders') {
                        setTimeout(() => {
                            const subTab = sessionStorage.getItem('myorders_sub_tab') || 'orders';
                            if (subTab === 'orders') fetchMyOrders();
                        }, 500);
                    }
                }
            }, 500);
            document.getElementById('biz-qs-sheet')?.remove();
        `;
        else if (a.action === 'beauty_book' && storeUrl) handler = `window.open('${storeUrl}&action=book&familyGroupId=${currentGroup?.id||''}','_blank');document.getElementById('biz-qs-sheet')?.remove()`;
        else if (a.action === 'beauty_rfq') handler = `document.getElementById('biz-qs-sheet')?.remove();window._familyNewRfqModal&&window._familyNewRfqModal(${bizGroupId},'${bizName.replace(/'/g,"\\'")}',null)`;
        else if (a.action === 'service_call') handler = `document.getElementById('biz-qs-sheet')?.remove();window._memberNewServiceCall(${bizGroupId},'${bizName.replace(/'/g,"\\'")}')`;
        else if (a.action === 'table_reservation') handler = `document.getElementById('biz-qs-sheet')?.remove();window._tableReservationModal(${bizGroupId},'${bizName.replace(/'/g,"\\'")}')`;
        else if (a.action === 'message') handler = `document.getElementById('biz-qs-sheet')?.remove();window._bizMessageModal(${bizGroupId},'${bizName.replace(/'/g,"\\'")}')`;
        else handler = `document.getElementById('biz-qs-sheet')?.remove()`;
        return `<button onclick="${handler}" class="flex items-center gap-3 w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 transition">
            <span class="text-xl">${a.icon}</span>${a.label}
        </button>`;
    }).join('');
    const sheet = document.createElement('div');
    sheet.id = 'biz-qs-sheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;direction:rtl;';
    sheet.innerHTML = `<div style="background:white;border-radius:24px 24px 0 0;padding:20px;width:100%;max-width:480px;margin:0 auto;">
        <div style="width:40px;height:4px;background:#e2e8f0;border-radius:4px;margin:0 auto 16px;"></div>
        <p style="font-weight:900;font-size:14px;color:#1e293b;margin-bottom:12px;">פעולות מהירות — ${safeStr(bizName)}</p>
        <div style="display:flex;flex-direction:column;gap:8px;">${btns}</div>
        <button onclick="document.getElementById('biz-qs-sheet')?.remove()" style="width:100%;margin-top:12px;padding:12px;background:#f1f5f9;border:none;border-radius:16px;font-weight:700;font-size:13px;color:#64748b;cursor:pointer;">ביטול</button>
    </div>`;
    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
    document.body.appendChild(sheet);
};

window._bizMessageModal = function(bizGroupId, bizName) {
    const modal = document.createElement('div');
    modal.id = 'biz-msg-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;';
    modal.innerHTML = `<div style="background:white;border-radius:24px;padding:24px;width:100%;max-width:400px;">
        <p style="font-weight:900;font-size:16px;color:#1e293b;margin-bottom:4px;">✉️ שלח הודעה ל-${safeStr(bizName)}</p>
        <p style="font-size:11px;color:#94a3b8;margin-bottom:16px;">ההודעה תגיע ל-Inbox של העסק</p>
        <textarea id="biz-msg-text" rows="4" placeholder="כתוב את הודעתך כאן..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;font-size:14px;resize:none;box-sizing:border-box;outline:none;"></textarea>
        <div id="biz-msg-err" style="display:none;color:#dc2626;font-size:12px;margin-top:6px;"></div>
        <div style="display:flex;gap:8px;margin-top:12px;">
            <button onclick="document.getElementById('biz-msg-modal')?.remove()" style="flex:1;padding:12px;background:#f1f5f9;border:none;border-radius:14px;font-weight:700;font-size:13px;color:#64748b;cursor:pointer;">ביטול</button>
            <button onclick="window._sendBizMessage(${bizGroupId})" style="flex:2;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;border-radius:14px;font-weight:900;font-size:13px;cursor:pointer;">שלח הודעה ✉️</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    document.getElementById('biz-msg-text')?.focus();
};

window._sendBizMessage = async function(bizGroupId) {
    const txt = document.getElementById('biz-msg-text')?.value?.trim();
    const errEl = document.getElementById('biz-msg-err');
    if (!txt) { if(errEl) { errEl.textContent = 'נא לכתוב הודעה'; errEl.style.display = 'block'; } return; }
    const btn = document.querySelector('#biz-msg-modal button:last-child');
    if (btn) { btn.disabled = true; btn.textContent = 'שולח...'; }
    try {
        const r = await fetch(`${API}/inbox/customer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: bizGroupId, name: currentUser?.nickname || 'לקוח', contact: currentUser?.phone || '', subject: 'פנייה מלקוח ONEFLOW', content: txt, customerGroupId: currentGroup?.id || null })
        }).then(r => r.json());
        if (r.success) {
            document.getElementById('biz-msg-modal')?.remove();
            showToast('success', 'ההודעה נשלחה ✅');
        } else { if(errEl) { errEl.textContent = r.error || 'שגיאה בשליחה'; errEl.style.display = 'block'; } if(btn){ btn.disabled=false; btn.textContent='שלח הודעה ✉️'; } }
    } catch(e) { if(errEl){ errEl.textContent='שגיאת תקשורת'; errEl.style.display='block'; } if(btn){ btn.disabled=false; btn.textContent='שלח הודעה ✉️'; } }
};

window._orderRatingModal = function(orderId, bizGroupId) {
    document.getElementById('order-rating-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'order-rating-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;';
    modal.innerHTML = `<div style="background:white;border-radius:24px;padding:24px;width:100%;max-width:380px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <button onclick="document.getElementById('order-rating-modal')?.remove()" style="background:#f1f5f9;border:none;border-radius:12px;width:32px;height:32px;cursor:pointer;font-size:16px;color:#64748b;">✕</button>
            <div style="text-align:right;">
                <p style="font-weight:900;font-size:15px;color:#1e293b;">⭐ דרג את ההזמנה</p>
                <p style="font-size:11px;color:#94a3b8;">הזמנה #${orderId}</p>
            </div>
        </div>
        <div style="text-align:center;margin-bottom:16px;">
            <p style="font-size:13px;color:#475569;font-weight:700;margin-bottom:10px;">בחר דירוג:</p>
            <div id="rating-stars" style="display:flex;justify-content:center;gap:8px;font-size:32px;">
                ${[1,2,3,4,5].map(n=>`<span onclick="window._setRatingStar(${n})" data-val="${n}" style="cursor:pointer;opacity:0.3;transition:opacity 0.1s;">⭐</span>`).join('')}
            </div>
            <p id="rating-label" style="font-size:11px;color:#94a3b8;margin-top:6px;height:16px;"></p>
        </div>
        <textarea id="rating-notes" rows="3" placeholder="הערות (אופציונלי)..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px;font-size:13px;resize:none;box-sizing:border-box;outline:none;margin-bottom:12px;"></textarea>
        <div id="rating-err" style="display:none;color:#dc2626;font-size:12px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;">
            <button onclick="document.getElementById('order-rating-modal')?.remove()" style="flex:1;padding:12px;background:#f1f5f9;border:none;border-radius:14px;font-weight:700;font-size:13px;color:#64748b;cursor:pointer;">ביטול</button>
            <button id="rating-submit-btn" onclick="window._submitOrderRating(${orderId},'${bizGroupId}')" style="flex:2;padding:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;border-radius:14px;font-weight:900;font-size:13px;cursor:pointer;">שלח דירוג ⭐</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
};
window._setRatingStar = function(val) {
    const labels = ['','גרוע 😞','לא טוב 😕','בסדר 😐','טוב 😊','מצוין! 🤩'];
    document.querySelectorAll('#rating-stars span').forEach((s,i) => { s.style.opacity = (i < val) ? '1' : '0.3'; });
    const lbl = document.getElementById('rating-label');
    if (lbl) lbl.textContent = labels[val] || '';
    document.getElementById('rating-stars').dataset.rating = val;
};
window._submitOrderRating = async function(orderId, bizGroupId) {
    const rating = parseInt(document.getElementById('rating-stars')?.dataset?.rating || 0);
    const notes = document.getElementById('rating-notes')?.value?.trim();
    const errEl = document.getElementById('rating-err');
    if (!rating) { if(errEl){errEl.textContent='בחר דירוג'; errEl.style.display='block';} return; }
    const btn = document.getElementById('rating-submit-btn');
    if(btn){btn.disabled=true; btn.textContent='שולח...';}
    try {
        const r = await fetch(`${API}/store/orders/${orderId}/customer-feedback`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ rating, notes, received: true, familyGroupId: currentGroup?.id })
        }).then(r=>r.json());
        if(r.success){
            document.getElementById('order-rating-modal')?.remove();
            showToast('success','תודה על הדירוג! ⭐');
            // Update confirmation container in both tabs
            const confirmContainer = document.getElementById(`order-confirm-${orderId}`);
            if (confirmContainer) {
                confirmContainer.innerHTML = `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:6px 10px;font-size:11px;font-weight:700;color:#15803d;text-align:center;">✅ קיבלת ודירגת — תודה!</div>`;
            }
            // Refresh the accordion if open (with delay so user sees success message)
            if(bizGroupId && currentGroup){
                setTimeout(async () => {
                    const wrapper = document.querySelector(`[data-biz-id="${bizGroupId}"]`);
                    const accordion = wrapper?.querySelector('.biz-accordion');
                    if(accordion){
                        delete accordion.dataset.loaded;
                        accordion.innerHTML='<p class="p-4 text-xs text-slate-400 text-center"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען...</p>';
                        const res = await fetch(`${API}/family/business-activity/${currentGroup.id}/${bizGroupId}`).then(r=>r.json());
                        _renderBizAccordion(accordion, res, 'restaurant');
                    }
                }, 1500);
            }
        } else {
            if(errEl){errEl.textContent=r.error||'שגיאה';errEl.style.display='block';}
            if(btn){btn.disabled=false;btn.textContent='שלח דירוג ⭐';}
        }
    } catch(e){ if(errEl){errEl.textContent='שגיאת תקשורת';errEl.style.display='block';} if(btn){btn.disabled=false;} }
};

window._tableReservationModal = function(bizGroupId, bizName) {
    const today = new Date().toISOString().split('T')[0];
    const modal = document.createElement('div');
    modal.id = 'table-res-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;';
    modal.innerHTML = `<div style="background:white;border-radius:24px;padding:24px;width:100%;max-width:400px;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <button onclick="document.getElementById('table-res-modal')?.remove()" style="background:#f1f5f9;border:none;border-radius:12px;width:32px;height:32px;cursor:pointer;font-size:16px;color:#64748b;">✕</button>
            <div style="text-align:right;">
                <p style="font-weight:900;font-size:15px;color:#1e293b;">🍽️ הזמנת שולחן</p>
                <p style="font-size:11px;color:#94a3b8;">${safeStr(bizName)}</p>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
                <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;text-align:right;">📅 תאריך</label>
                <input type="date" id="tres-date" min="${today}" value="${today}"
                    onchange="window._loadTableAvailabilityForModal(${bizGroupId}, this.value)"
                    style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:14px;box-sizing:border-box;direction:ltr;text-align:left;">
            </div>
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    <span id="tres-slots-label" style="font-size:11px;color:#94a3b8;"></span>
                    <label style="font-size:11px;font-weight:700;color:#64748b;text-align:right;">🕐 בחר שעה</label>
                </div>
                <input type="hidden" id="tres-time">
                <div id="tres-time-slots" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                    <p style="grid-column:1/-1;font-size:11px;color:#94a3b8;text-align:center;padding:12px 0;"><i class="fa-solid fa-spinner fa-spin"></i> טוען זמינות...</p>
                </div>
            </div>
            <div>
                <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;text-align:right;">👥 מספר סועדים</label>
                <input type="number" id="tres-guests" min="1" max="30" value="2"
                    style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:14px;box-sizing:border-box;text-align:center;">
            </div>
            <div>
                <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;text-align:right;">📝 הערות (אופציונלי)</label>
                <textarea id="tres-notes" rows="2" placeholder="אלרגיות, אירוע מיוחד, העדפת ישיבה..."
                    style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:13px;resize:none;box-sizing:border-box;direction:rtl;"></textarea>
            </div>
            <div id="tres-err" style="display:none;color:#dc2626;font-size:12px;text-align:center;"></div>
            <button onclick="window._submitTableReservation(${bizGroupId},'${bizName.replace(/'/g,"\\'")}',this)"
                style="width:100%;padding:14px;background:linear-gradient(135deg,#f97316,#ea580c);color:white;border:none;border-radius:16px;font-weight:900;font-size:14px;cursor:pointer;">
                🍽️ שלח בקשת הזמנה
            </button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    // טעינת זמינות לתאריך היום מיד עם פתיחת ה-modal
    window._loadTableAvailabilityForModal(bizGroupId, today);
};

window._loadTableAvailabilityForModal = async function(bizGroupId, dateStr, preSelectedTime) {
    if (!dateStr) return;
    const slotsEl = document.getElementById('tres-time-slots');
    const labelEl = document.getElementById('tres-slots-label');
    if (!slotsEl) return;

    slotsEl.innerHTML = '<p style="grid-column:1/-1;font-size:11px;color:#94a3b8;text-align:center;padding:12px 0;"><i class="fa-solid fa-spinner fa-spin"></i> טוען זמינות...</p>';
    if (labelEl) labelEl.textContent = '';

    try {
        const res = await fetch(`${API}/public/restaurants/${bizGroupId}/availability/${dateStr}`);
        const data = await res.json();

        if (!data.success || !data.slots?.length) {
            slotsEl.innerHTML = '<p style="grid-column:1/-1;font-size:11px;color:#ef4444;text-align:center;padding:12px 0;">אין זמינות בתאריך זה</p>';
            return;
        }

        slotsEl.innerHTML = data.slots.map(slot => {
            const isDisabled = !slot.available;
            const label = isDisabled ? 'תפוס' : `${slot.tables} שולחנות`;
            const baseStyle = 'border:none;border-radius:10px;padding:8px 4px;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.15s;line-height:1.4;';
            const style = isDisabled
                ? baseStyle + 'background:#f1f5f9;color:#94a3b8;cursor:not-allowed;opacity:0.7;'
                : baseStyle + 'background:white;color:#374151;border:1.5px solid #e2e8f0;';
            return `<button type="button" ${isDisabled ? 'disabled' : ''} data-slot="${slot.time}"
                onclick="document.getElementById('tres-time').value='${slot.time}';window._highlightSelectedTimeModal('${slot.time}')"
                style="${style}">
                ${slot.time}<br><span style="font-size:9px;font-weight:500;color:${isDisabled?'#94a3b8':'#6b7280'};">${label}</span>
            </button>`;
        }).join('');

        // אם יש שעה שנבחרה מראש (למשל ב-_acceptTableAlt) — מסמנים אותה
        if (preSelectedTime) {
            document.getElementById('tres-time').value = preSelectedTime;
            window._highlightSelectedTimeModal(preSelectedTime);
        }
    } catch(e) {
        slotsEl.innerHTML = '<p style="grid-column:1/-1;font-size:11px;color:#ef4444;text-align:center;padding:12px 0;">שגיאה בטעינת זמינות</p>';
    }
};

window._highlightSelectedTimeModal = function(selectedTime) {
    document.querySelectorAll('#tres-time-slots button').forEach(btn => {
        if (btn.dataset.slot === selectedTime) {
            btn.style.background = '#eff6ff';
            btn.style.border = '2px solid #3b82f6';
            btn.style.color = '#1d4ed8';
        } else if (!btn.disabled) {
            btn.style.background = 'white';
            btn.style.border = '1.5px solid #e2e8f0';
            btn.style.color = '#374151';
        }
    });
    const labelEl = document.getElementById('tres-slots-label');
    if (labelEl) labelEl.textContent = selectedTime ? `נבחרה: ${selectedTime}` : '';
};

window._submitTableReservation = async function(bizGroupId, bizName, btn) {
    const date   = document.getElementById('tres-date')?.value;
    const time   = document.getElementById('tres-time')?.value;
    const guests = document.getElementById('tres-guests')?.value || '2';
    const notes  = document.getElementById('tres-notes')?.value?.trim() || '';
    const errEl  = document.getElementById('tres-err');
    if (!date || !time) { if(errEl){errEl.textContent='נא לבחור תאריך ושעה';errEl.style.display='block';} return; }
    if (btn) { btn.disabled = true; btn.textContent = '⏳ שולח...'; }
    const dateHe = new Date(date).toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' });
    const title = `${currentUser?.nickname || 'לקוח'} — ${guests} סועדים`;
    try {
        const r = await fetch(`${API}/calendar/events`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                groupId: bizGroupId,
                title,
                customerPhone: currentUser?.phone || '',
                notes: notes || null,
                eventDate: date,
                startTime: time,
                status: 'pending',
                customerGroupId: currentGroup?.id || null,
                numGuests: parseInt(guests) || 2,
                callType: 'table_reservation'
            })
        }).then(r => r.json());
        if (r.success) {
            const modal = document.getElementById('table-res-modal');
            const origEventId = modal?.dataset?.origEventId;
            modal?.remove();
            if (origEventId) {
                fetch(`${API}/calendar/events/${origEventId}/status`, {
                    method: 'PUT', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ status: 'cancelled' })
                }).catch(() => {});
                showToast('success', r.status === 'approved' ? `ההזמנה אושרה! שולחן ${r.assignedTable} מחכה לך 🍽️✅` : 'הבקשה החדשה נשלחה וממתינה לאישור המסעדה ✅');
            } else {
                showToast('success', r.status === 'approved' ? `ההזמנה אושרה! שולחן ${r.assignedTable} מחכה לך 🍽️✅` : 'בקשת ההזמנה נשלחה! המסעדה תאשר בקרוב ✅');
            }
            // רענן accordion כדי שההזמנה תופיע מיד בצד הלקוח
            const wrapper = document.querySelector(`[data-biz-id="${bizGroupId}"]`);
            const accordion = wrapper?.querySelector('.biz-accordion');
            if (accordion && currentGroup) {
                delete accordion.dataset.loaded;
                accordion.innerHTML = '<p class="p-4 text-xs text-slate-400 text-center"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען...</p>';
                fetch(`${API}/family/business-activity/${currentGroup.id}/${bizGroupId}`)
                    .then(r => r.json())
                    .then(res => _renderBizAccordion(accordion, res, res.type || 'restaurant'))
                    .catch(() => {});
            }
        } else { if(errEl){errEl.textContent=r.error||'שגיאה בשליחה';errEl.style.display='block';} if(btn){btn.disabled=false;btn.textContent='🍽️ שלח בקשת הזמנה';} }
    } catch(e) { if(errEl){errEl.textContent='שגיאת תקשורת';errEl.style.display='block';} if(btn){btn.disabled=false;btn.textContent='🍽️ שלח בקשת הזמנה';} }
};

window._clientConfirmBeautyAppt = async function(apptId, action, btn) {
    if (!currentGroup) return;
    if (btn) { btn.disabled = true; btn.textContent = action === 'confirm' ? 'שומר...' : 'דוחה...'; }
    try {
        const r = await fetch(`${API}/family/${currentGroup.id}/beauty/appointments/${apptId}/client-confirm`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        }).then(r => r.json());
        if (r.success) {
            showToast('success', action === 'confirm' ? 'התור אושר ✅' : 'התור נדחה');
            const wrapper = btn.closest('.biz-act-wrapper');
            const accordion = wrapper?.querySelector('.biz-accordion');
            const bizGroupId = wrapper?.dataset?.bizId;
            if (accordion && bizGroupId && currentGroup) {
                delete accordion.dataset.loaded;
                accordion.innerHTML = '<p class="p-4 text-xs text-slate-400 text-center"><i class="fa-solid fa-spinner fa-spin ml-1"></i> טוען...</p>';
                const res = await fetch(`${API}/family/business-activity/${currentGroup.id}/${bizGroupId}`).then(r => r.json());
                _renderBizAccordion(accordion, res, res.type);
            }
        } else { showToast('error', r.error || 'שגיאה'); if(btn){ btn.disabled=false; btn.textContent=action==='confirm'?'✅ אשר תור':'✕ דחה'; } }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); if(btn){ btn.disabled=false; } }
};

window._clientConfirmAp = (id, btn) => window._clientConfirmBeautyAppt(id, 'confirm', btn);
window._clientRejectAp  = (id, btn) => window._clientConfirmBeautyAppt(id, 'decline', btn);

// לקוח בחר שעה חלופית מתוך הזמנת שולחן שנדחתה
window._acceptTableAlt = function(bizGroupId, bizName, dateStr, time, origEventId) {
    document.getElementById('table-res-modal')?.remove();
    window._tableReservationModal(parseInt(bizGroupId), bizName);
    setTimeout(() => {
        const dateEl = document.getElementById('tres-date');
        if (dateEl) dateEl.value = dateStr;
        // מסמן ה-modal כבקשה חלופית כדי לבטל האירוע הישן אחרי submit
        const modal = document.getElementById('table-res-modal');
        if (modal && origEventId) modal.dataset.origEventId = origEventId;
        // טוען זמינות לתאריך החלופי + מסמן את השעה המוצעת
        window._loadTableAvailabilityForModal(parseInt(bizGroupId), dateStr, time);
    }, 150);
};

// לקוח דחה את כל החלופות — מסמן האירוע כ-cancelled
window._declineAllTableAlts = async function(eventId) {
    if (!confirm('לבטל את כל הבקשה?')) return;
    try {
        await fetch(`${API}/calendar/events/${eventId}/status`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ status: 'cancelled' })
        });
        showToast('info', 'הבקשה בוטלה');
        // רענן accordion
        const acc = document.querySelector('.biz-accordion');
        if (acc) { delete acc.dataset.loaded; acc.click?.(); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
};

window._bizSortAppts = function(btn) {
    const acc = btn.closest('.biz-accordion');
    if (!acc?._rawData) return;
    const dir = btn.dataset.dir;
    // toggle pill colors
    acc.querySelectorAll('.biz-sort-btn').forEach(b => {
        b.className = b.className.replace('bg-indigo-600 text-white border-indigo-600', 'bg-white text-slate-500 border-slate-200');
    });
    btn.className = btn.className.replace('bg-white text-slate-500 border-slate-200', 'bg-indigo-600 text-white border-indigo-600');
    const listEl = acc.querySelector('.biz-appt-list');
    if (!listEl) return;
    const act = acc._rawData.activity || {};
    const appts = act.appointments || [];
    const calEvts = act.calendarEvents || [];
    const fmtDT = d => d ? new Date(d).toLocaleString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
    const ref = id => `<span class="text-[9px] font-mono text-slate-300 ml-1">#${String(id).padStart(4,'0')}</span>`;
    const sLabel = { completed:'הושלם', cancelled:'בוטל', pending:'ממתין', confirmed:'מאושר', scheduled:'מתוכנן', no_show:'לא הגיע' };
    const sColor = a => a.status==='completed'?'bg-green-100 text-green-700':a.status==='cancelled'?'bg-red-100 text-red-600':'bg-blue-100 text-blue-700';
    let active = appts.filter(a => a.status !== 'pending_client');
    let approved = calEvts.filter(e => e.status === 'approved' || e.status === 'done');
    if (dir === 'asc') { active = [...active].reverse(); approved = [...approved].reverse(); }
    listEl.innerHTML = active.map(a => {
        const seg = a.segments?.[0];
        return `<div class="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
            <div class="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-sm shrink-0">📅</div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-slate-700 truncate">${seg?.service_name||'טיפול'}${ref(a.id)}</p>
                <p class="text-[10px] text-slate-400">${fmtDT(a.start_time||a.created_at)}</p>
            </div>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sColor(a)}">${sLabel[a.status]||a.status}</span>
        </div>`;
    }).join('') + approved.map(e => {
        const dt = new Date(e.event_date).toLocaleDateString('he-IL') + ' ' + (e.start_time||'').slice(0,5);
        return `<div class="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
            <div class="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-sm shrink-0">📅</div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-slate-700 truncate">${e.service_name||e.title||'תור'}${ref(e.id)}</p>
                <p class="text-[10px] text-slate-400">${dt}${e.duration_mins?' · '+e.duration_mins+' דק':''}</p>
            </div>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">מאושר</span>
        </div>`;
    }).join('') || '<p class="text-xs text-slate-400 text-center py-3">אין תורים</p>';
};

window._bizSortList = function(btn) {
    const acc = btn.closest('.biz-accordion');
    if (!acc?._rawData || !acc?._listRenderers) return;
    const dir       = btn.dataset.dir;
    const listCls   = btn.dataset.list;
    const dataKey   = btn.dataset.key;
    const dateField = btn.dataset.date;
    acc.querySelectorAll('.biz-sort-btn').forEach(b => {
        b.className = b.className.replace('bg-indigo-600 text-white border-indigo-600', 'bg-white text-slate-500 border-slate-200');
    });
    btn.className = btn.className.replace('bg-white text-slate-500 border-slate-200', 'bg-indigo-600 text-white border-indigo-600');
    const listEl = acc.querySelector('.' + listCls);
    if (!listEl) return;
    const renderer = acc._listRenderers[dataKey];
    if (!renderer) return;
    const items = [...((acc._rawData.activity || {})[dataKey] || [])];
    items.sort((a, b) => {
        const da = new Date(a[dateField] || 0).getTime();
        const db = new Date(b[dateField] || 0).getTime();
        return dir === 'asc' ? da - db : db - da;
    });
    listEl.innerHTML = items.map(renderer).join('') ||
        '<p class="text-xs text-slate-400 text-center py-3">אין פריטים</p>';
};

// ─── BIZ ACCORDION ────────────────────────────────────────────────────────────

window._toggleBizAccordion = async function(btn, bizGroupId, bizType) {
    const wrapper = btn.closest('.biz-act-wrapper');
    if (!wrapper) return;
    const accordion = wrapper.querySelector('.biz-accordion');
    if (!accordion) return;
    const chevron = btn.querySelector('i');
    const isOpen = !accordion.classList.contains('hidden');
    if (isOpen) {
        accordion.classList.add('hidden');
        if (chevron) { chevron.classList.remove('fa-chevron-up'); chevron.classList.add('fa-chevron-down'); }
        return;
    }
    accordion.classList.remove('hidden');
    if (chevron) { chevron.classList.remove('fa-chevron-down'); chevron.classList.add('fa-chevron-up'); }
    const loadedAt = accordion.dataset.loaded ? parseInt(accordion.dataset.loaded) : 0;
    if (Date.now() - loadedAt < 30000) return; // cache 30s
    accordion.dataset.loaded = String(Date.now());
    try {
        const r = await fetch(`${API}/family/business-activity/${currentGroup.id}/${bizGroupId}`).then(r => r.json());
        _renderBizAccordion(accordion, r, bizType);
        // Show badge if there are pending_client appointments
        const pendingCount = (r.activity?.appointments || []).filter(a => a.status === 'pending_client').length;
        const badge = document.getElementById(`biz-appt-pending-badge-${bizGroupId}`);
        if (badge) pendingCount > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');
    } catch(e) {
        accordion.innerHTML = '<p class="p-4 text-xs text-red-500 text-center">שגיאה בטעינת ההיסטוריה</p>';
    }
};

function _renderBizAccordion(el, data, bizType) {
    const act = data.activity || {};
    const fmtDate = d => d ? new Date(d).toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
    const fmtDateTime = d => d ? new Date(d).toLocaleString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';

    // Build tabs + items per type
    const tabs = [];
    const sections = {};
    const listRenderers = {};

    if (bizType === 'beauty') {
        const appts = act.appointments || [];
        const rfqs  = act.rfqs || [];
        const allCalEvts = act.calendarEvents || [];
        const approvedCalEvts = allCalEvts.filter(e => e.status === 'approved' || e.status === 'done');
        const pendingAppts = appts.filter(a => a.status === 'pending_client');
        const activeAppts  = appts.filter(a => a.status !== 'pending_client');
        const apptStatusLabel = { completed:'הושלם', cancelled:'בוטל', pending:'ממתין', confirmed:'מאושר', scheduled:'מתוכנן', no_show:'לא הגיע' };
        const apptStatusColor = a => a.status==='completed'?'bg-green-100 text-green-700':a.status==='cancelled'?'bg-red-100 text-red-600':'bg-blue-100 text-blue-700';
        const apptRef = id => `<span class="text-[9px] font-mono text-slate-300 ml-1">#${String(id).padStart(4,'0')}</span>`;
        const renderApptRow = a => {
            const seg = a.segments?.[0];
            return `<div class="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                <div class="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-sm shrink-0">📅</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-700 truncate">${seg?.service_name || 'טיפול'}${apptRef(a.id)}</p>
                    <p class="text-[10px] text-slate-400">${fmtDateTime(a.start_time || a.created_at)}</p>
                </div>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${apptStatusColor(a)}">${apptStatusLabel[a.status]||a.status}</span>
            </div>`;
        };
        const renderApprovedCalRow = e => {
            const dt = new Date(e.event_date).toLocaleDateString('he-IL') + ' ' + (e.start_time||'').slice(0,5);
            return `<div class="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                <div class="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-sm shrink-0">📅</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-700 truncate">${e.service_name || e.title || 'תור'}${apptRef(e.id)}</p>
                    <p class="text-[10px] text-slate-400">${dt}${e.duration_mins?' · '+e.duration_mins+' דק':''}</p>
                </div>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">מאושר</span>
            </div>`;
        };
        const renderPendingRow = a => {
            const seg = a.segments?.[0];
            const dt = fmtDateTime(a.start_time || a.created_at);
            return `<div class="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-2">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-black text-slate-800 truncate">${seg?.service_name || 'טיפול'}${apptRef(a.id)}</p>
                        <p class="text-[10px] text-slate-500">${dt}</p>
                    </div>
                    <span class="text-[9px] font-black bg-amber-400 text-white px-1.5 py-0.5 rounded-full shrink-0">⏳ ממתין לאישורך</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="window._clientConfirmAp(${a.id},this)" class="flex-1 bg-green-500 text-white text-[11px] font-black py-1.5 rounded-lg hover:bg-green-600 transition active:scale-95">✅ אשר תור</button>
                    <button onclick="window._clientRejectAp(${a.id},this)" class="flex-1 bg-slate-200 text-slate-600 text-[11px] font-black py-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 transition active:scale-95">✕ דחה</button>
                </div>
            </div>`;
        };
        const totalAppts = activeAppts.length + approvedCalEvts.length;
        const pendingLabel = pendingAppts.length > 0 ? `בקשות תור (${pendingAppts.length}) 🔔` : 'בקשות תור';
        tabs.push({ id:'all', label:'הכל' }, { id:'cal_evts', label: pendingLabel }, { id:'appts', label:`תורים (${totalAppts})` }, { id:'rfqs', label:`ייעוץ (${rfqs.length})` });
        // appts section: sort pills + list
        const buildApptHtml = (sortDir) => {
            let rows = [...activeAppts];
            let calRows = [...approvedCalEvts];
            if (sortDir === 'asc') { rows.reverse(); calRows.reverse(); }
            return rows.map(renderApptRow).join('') + calRows.map(renderApprovedCalRow).join('');
        };
        const sortControls = `<div class="flex gap-1.5 mb-2">
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-indigo-600 text-white border-indigo-600 transition" data-dir="desc" onclick="window._bizSortAppts(this)">חדש ראשון</button>
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-white text-slate-500 border-slate-200 transition" data-dir="asc" onclick="window._bizSortAppts(this)">ישן ראשון</button>
        </div>`;
        const apptHtml = totalAppts > 0
            ? sortControls + `<div class="biz-appt-list">${buildApptHtml('desc')}</div>`
            : '<p class="text-xs text-slate-400 text-center py-3">אין תורים</p>';
        const pendingHtml = pendingAppts.length > 0
            ? pendingAppts.map(renderPendingRow).join('')
            : '<p class="text-xs text-slate-400 text-center py-3">אין בקשות ממתינות</p>';
        const rfqHtml = rfqs.length ? rfqs.map(r => `<div class="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                <div class="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-sm shrink-0">💌</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-700 truncate">${r.service_description || 'פנייה'}</p>
                    <p class="text-[10px] text-slate-400">${fmtDate(r.created_at)}</p>
                </div>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">${r.status||''}</span>
            </div>`).join('') : '<p class="text-xs text-slate-400 text-center py-3">אין פניות ייעוץ</p>';
        sections.cal_evts = pendingHtml;
        sections.appts = apptHtml;
        sections.rfqs  = rfqHtml;
        sections.all   = (totalAppts + rfqs.length + pendingAppts.length === 0) ? '<p class="text-xs text-slate-400 text-center py-4">אין פעילות עדיין</p>' : pendingHtml + apptHtml + rfqHtml;

    } else if (bizType === 'sport' || bizType === 'gym') {
        const mems   = act.memberships || [];
        const checks = act.checkins || [];
        const _ref = id => id ? `<span class="text-[9px] font-mono text-slate-300 ml-1">#${String(id).padStart(4,'0')}</span>` : '';
        const renderMem = m => `<div class="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm shrink-0">💳</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-700">${m.type_name || 'מנוי'}${_ref(m.id)}</p>
                    <p class="text-[10px] text-slate-400">${fmtDate(m.start_date)} – ${fmtDate(m.end_date)}</p>
                </div>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${m.status==='active'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">${m.status==='active'?'פעיל':'לא פעיל'}</span>
            </div>`;
        listRenderers.memberships = renderMem;
        tabs.push({ id:'all', label:'הכל' }, { id:'membership', label:`מנוי (${mems.length})` }, { id:'checkins', label:`כניסות (${checks.length})` });
        const memSortControls = `<div class="flex gap-1.5 mb-2">
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-indigo-600 text-white border-indigo-600 transition" data-dir="desc" data-list="biz-mem-list" data-key="memberships" data-date="start_date" onclick="window._bizSortList(this)">חדש ראשון</button>
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-white text-slate-500 border-slate-200 transition" data-dir="asc" data-list="biz-mem-list" data-key="memberships" data-date="start_date" onclick="window._bizSortList(this)">ישן ראשון</button>
        </div>`;
        const memHtml = mems.length
            ? memSortControls + `<div class="biz-mem-list">${mems.map(renderMem).join('')}</div>`
            : '<p class="text-xs text-slate-400 text-center py-3">אין מנוי</p>';
        const checkHtml = checks.length ? checks.map(c => `<div class="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                <div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm shrink-0">✅</div>
                <p class="text-xs text-slate-600 flex-1">${fmtDateTime(c.checked_in_at)}</p>
            </div>`).join('') : '<p class="text-xs text-slate-400 text-center py-3">אין כניסות</p>';
        sections.membership = memHtml;
        sections.checkins   = checkHtml;
        sections.all = (mems.length + checks.length === 0) ? '<p class="text-xs text-slate-400 text-center py-4">אין פעילות עדיין</p>' : memHtml + checkHtml;

    } else if (bizType === 'restaurant' || bizType === 'services') {
        const orders = act.orders || [];
        const quotes = act.quotes || [];
        const tableRes = (act.tableReservations || []);
        const _ref = id => id ? `<span class="text-[9px] font-mono text-slate-300 ml-1">#${String(id).padStart(4,'0')}</span>` : '';
        const _ordStatus = { pending_approval:'ממתין לאישור ⏳', new:'חדש 🔴', confirmed:'אושר', processing:'בהכנה 🍳', ready:'מוכן לאיסוף ✅', shipped:'בדרך אליך 🛵', delivering:'בדרך אליך 🛵', done:'הושלם ✅', completed:'סופק ✅', cancelled:'בוטל ❌', pending:'ממתין' };
        const _ordStatusColor = s => s==='done'||s==='completed'?'bg-green-100 text-green-700':s==='cancelled'?'bg-red-100 text-red-600':s==='ready'?'bg-orange-100 text-orange-700':s==='shipped'?'bg-purple-100 text-purple-700':s==='processing'||s==='confirmed'?'bg-blue-100 text-blue-700':s==='pending_approval'?'bg-yellow-100 text-yellow-700':'bg-slate-100 text-slate-600';
        const isDelivery = o => !!(o.is_delivery == 1 || o.is_delivery === true || o.is_delivery === 'true');
        const isConfirmable = o => !o.customer_rating && (o.status === 'completed' || o.status === 'shipped') && isDelivery(o);
        const canRateNonDelivery = o => !o.customer_rating && (o.status === 'completed' || o.status === 'shipped') && !isDelivery(o);
        const ratingStars = o => o.customer_rating ? '⭐'.repeat(o.customer_rating) : '';
        const renderOrd = o => {
            console.log('[activities accordion] Rendering order:', { id: o.id, status: o.status });
            const detId = `biz-ord-det-${o.id}`;
            let itemsArr = [];
            try { itemsArr = Array.isArray(o.items) ? o.items : JSON.parse(o.items||'[]'); } catch(e) {}
            itemsArr = (itemsArr||[]).filter(i => i && (i.name||i.item_name));
            const itemsHtml = itemsArr.length
                ? itemsArr.map(i => `<div class="flex justify-between items-center py-0.5"><span class="text-slate-600">${safeStr(i.name||i.item_name)}</span><span class="text-slate-400 dir-ltr">×${i.qty||i.quantity||1}${parseFloat(i.price||0)>0?' ₪'+(parseFloat(i.price)*(parseFloat(i.qty||i.quantity||1))).toFixed(0):''}</span></div>`).join('')
                : '';
            const bizId = el.closest('[data-biz-id]')?.dataset?.bizId||'';
            const hasDetail = !!(itemsHtml || o.notes || isConfirmable(o) || canRateNonDelivery(o));
            const confirmUI = isConfirmable(o)
                ? `<div id="order-confirm-${o.id}" class="mt-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p class="text-[10px] font-bold text-slate-600 text-center mb-1.5">קיבלת את ההזמנה?</p>
                    <div class="flex gap-1.5">
                        <button onclick="event.stopPropagation();confirmOrderReceipt(${o.id},false)" style="flex:1;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;padding:5px 4px;font-size:10px;font-weight:800;cursor:pointer;">❌ לא קיבלתי</button>
                        <button onclick="event.stopPropagation();confirmOrderReceipt(${o.id},true)" style="flex:1;background:#dcfce7;color:#15803d;border:none;border-radius:8px;padding:5px 4px;font-size:10px;font-weight:800;cursor:pointer;">✅ כן, קיבלתי</button>
                    </div>
                  </div>`
                : (o.customer_rating
                    ? `<div class="mt-1.5 text-center text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg p-1.5">✅ קיבלת ודירגת — תודה!</div>`
                    : (canRateNonDelivery(o)
                        ? `<div class="mt-1.5"><button onclick="event.stopPropagation();window._orderRatingModal(${o.id},'${bizId}')" class="text-[10px] font-black bg-yellow-50 border border-yellow-200 text-yellow-700 px-2.5 py-1 rounded-lg hover:bg-yellow-100 transition">⭐ דרג את ההזמנה</button></div>`
                        : ''));
            return `<div class="border-b border-slate-50 last:border-0">
                <div class="flex items-center gap-2 py-2 ${hasDetail?'cursor-pointer':''}" ${hasDetail?`onclick="const d=document.getElementById('${detId}');if(d){d.classList.toggle('hidden');}"`:''}>
                    <div class="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-sm shrink-0">🛒</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-slate-700">הזמנה${_ref(o.id)} <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDelivery(o)?'bg-indigo-50 text-indigo-600':'bg-green-50 text-green-700'}">${isDelivery(o)?'🛵 משלוח':'🏃 איסוף עצמי'}</span>${ratingStars(o)?` <span class="text-yellow-500">${ratingStars(o)}</span>`:''}</p>
                        <p class="text-[10px] text-slate-400">${fmtDate(o.created_at)}${parseFloat(o.total_price||0)>0?' · ₪'+parseFloat(o.total_price).toFixed(0):''}${itemsArr.length?' · '+itemsArr.length+' פריטים':''}</p>
                    </div>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${_ordStatusColor(o.status)}">${_ordStatus[o.status]||o.status||''}</span>
                    ${hasDetail?'<span class="text-slate-300 text-[10px]">▼</span>':''}
                </div>
                ${hasDetail?`<div id="${detId}" class="hidden pb-2 pr-2">
                    ${itemsHtml?`<div class="bg-slate-50 rounded-lg p-2 text-[10px] mb-1.5">${itemsHtml}</div>`:''}
                    ${o.notes?`<p class="text-[10px] text-slate-500 truncate">📝 ${safeStr(o.notes)}</p>`:''}
                    ${confirmUI}
                </div>`:''}
            </div>`;
        };
        const _quoteStatusMap = {
            'waiting_customer': 'בהמתנה ללקוח',
            'waiting_approval': 'בהמתנה לאישור',
            'rejected': 'נדחה',
            'approved': 'אושרה',
            'converted_to_order': 'הומרה להזמנה',
            'cancelled': 'בוטלה',
            'accepted': 'התקבלה',
            'quote': 'טיוטה'
        };
        const _quoteStatusColor = s => {
            const status = (s || '').toLowerCase();
            if (status.includes('waiting_customer') || status.includes('בהמתנה')) return 'bg-blue-100 text-blue-700';
            if (status.includes('rejected') || status.includes('נדחה')) return 'bg-red-100 text-red-700';
            if (status.includes('approved') || status.includes('אושרה')) return 'bg-green-100 text-green-700';
            if (status.includes('converted') || status.includes('הומרה')) return 'bg-purple-100 text-purple-700';
            return 'bg-yellow-100 text-yellow-700';
        };
        const renderQuote = q => {
            const statusVal = q.quote_status || q.status || 'quote';
            const displayStatus = _quoteStatusMap[statusVal] || statusVal;
            const colorClass = _quoteStatusColor(statusVal);
            return `<div onclick="window._openQuoteFromActivity(${q.id})" class="flex items-center gap-2 py-2 px-2 border-b border-slate-50 last:border-0 hover:bg-yellow-50 cursor-pointer rounded transition">
                <div class="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center text-sm shrink-0">📋</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-700">הצעה${_ref(q.id)}</p>
                    <p class="text-[10px] text-slate-400">${fmtDate(q.created_at)}</p>
                </div>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colorClass}">${displayStatus}</span>
            </div>`;
        };
        listRenderers.orders = renderOrd;
        listRenderers.quotes = renderQuote;
        const pendingRes = tableRes.filter(r => r.status === 'pending');
        const resLabel = pendingRes.length > 0 ? `שולחנות (${tableRes.length}) 🔔` : `שולחנות (${tableRes.length})`;
        tabs.push({ id:'all', label:'הכל' }, { id:'reservations', label: resLabel }, { id:'orders', label:`הזמנות (${orders.length})` }, { id:'quotes', label:`הצעות (${quotes.length})` });
        const ordSortControls = `<div class="flex gap-1.5 mb-2">
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-indigo-600 text-white border-indigo-600 transition" data-dir="desc" data-list="biz-ord-list" data-key="orders" data-date="created_at" onclick="window._bizSortList(this)">חדש ראשון</button>
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-white text-slate-500 border-slate-200 transition" data-dir="asc" data-list="biz-ord-list" data-key="orders" data-date="created_at" onclick="window._bizSortList(this)">ישן ראשון</button>
        </div>`;
        const ordHtml = orders.length
            ? ordSortControls + `<div class="biz-ord-list">${orders.map(renderOrd).join('')}</div>`
            : '<p class="text-xs text-slate-400 text-center py-3">אין הזמנות</p>';
        const qHtml = quotes.length
            ? `<div class="biz-quote-list">${quotes.map(renderQuote).join('')}</div>`
            : '<p class="text-xs text-slate-400 text-center py-3">אין הצעות</p>';
        const _resStatusColor = s => s==='approved'?'bg-green-100 text-green-700':s==='pending'?'bg-amber-100 text-amber-700':s==='rejected'?'bg-red-100 text-red-600':'bg-slate-100 text-slate-500';
        const _resStatusLabel = s => ({approved:'אושר ✅', pending:'ממתין לאישור ⏳', cancelled:'בוטל', rejected:'נדחה ❌'}[s]||s||'');
        const renderRes = r => {
            const dt = r.event_date ? new Date(String(r.event_date).split('T')[0]+'T12:00:00').toLocaleDateString('he-IL', {weekday:'short',day:'numeric',month:'numeric'}) : '';
            const tm = r.start_time ? String(r.start_time).slice(0,5) : '';
            const tableInfo = r.reserved_table_number ? ` · שולחן ${r.reserved_table_number}` : '';
            const dateStr = r.event_date ? String(r.event_date).split('T')[0] : '';
            const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
            const isToday = dateStr === todayStr;
            const wrapperCls = isToday
                ? 'border-b border-orange-100 last:border-0 bg-orange-50 rounded-xl mx-0.5 mb-1'
                : 'border-b border-slate-50 last:border-0';
            const iconCls = isToday ? 'bg-orange-100' : 'bg-amber-50';
            const todayBadge = isToday ? '<span class="text-[9px] font-black text-white bg-orange-500 px-1.5 py-0.5 rounded-full mr-1">היום!</span>' : '';
            // חלופות: כשנדחה והמסעדה שלחה אפשרויות אחרות
            let altsHtml = '';
            if (r.status === 'rejected') {
                let alts = [];
                try { alts = Array.isArray(r.alternatives_json) ? r.alternatives_json : JSON.parse(r.alternatives_json || '[]'); } catch(e2) {}
                if (alts.length) {
                    const bizId = el.closest('[data-biz-id]')?.dataset?.bizId || '';
                    const bizName = el.closest('[data-biz-id]')?.dataset?.bizName || '';
                    altsHtml = `<div class="mt-2 pt-2 border-t border-red-100">
                        <p class="text-[10px] font-bold text-slate-600 mb-1.5">⏰ בחר מועד חלופי:</p>
                        <div class="flex flex-wrap gap-1.5">
                            ${alts.map(t => `<button onclick="window._acceptTableAlt('${bizId}','${bizName}','${dateStr}','${t}',${r.id})" class="text-[11px] font-bold bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1.5 rounded-full hover:bg-amber-100 transition active:scale-95">${t}</button>`).join('')}
                            <button onclick="window._declineAllTableAlts(${r.id})" class="text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-full hover:bg-red-50 hover:text-red-500 transition">✕ לא מתאים</button>
                        </div>
                    </div>`;
                }
            }
            const hasDetails = !!altsHtml || !!r.notes;
            const detailId = `res-detail-${r.id}`;
            const chevron = hasDetails ? `<span class="text-slate-300 text-[10px] transition-transform" id="res-chev-${r.id}">▼</span>` : '';
            return `<div class="${wrapperCls}">
                <div class="flex items-center gap-2 py-2 ${isToday ? 'px-2' : ''} cursor-pointer" onclick="window._toggleResDetail('${detailId}','res-chev-${r.id}')">
                    <div class="w-8 h-8 rounded-lg ${iconCls} flex items-center justify-center text-sm shrink-0">${isToday ? '🗓️' : '🍽️'}</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold ${isToday ? 'text-orange-700' : 'text-slate-700'}">${todayBadge}${dt} ${tm}${tableInfo}${_ref(r.id)}</p>
                        <p class="text-[10px] ${isToday ? 'text-orange-500' : 'text-slate-400'}">${r.num_guests ? r.num_guests + ' סועדים' : ''}${r.notes ? ' · ' + r.notes : ''}</p>
                    </div>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${_resStatusColor(r.status)}">${_resStatusLabel(r.status)}</span>
                    ${chevron}
                </div>
                ${altsHtml ? `<div id="${detailId}" class="hidden pb-2 ${isToday ? 'px-2' : ''}">${altsHtml}</div>` : ''}
            </div>`;
        };
        window._toggleResDetail = function(detailId, chevId) {
            const det = document.getElementById(detailId);
            const chev = document.getElementById(chevId);
            if (!det) return;
            det.classList.toggle('hidden');
            if (chev) chev.style.transform = det.classList.contains('hidden') ? '' : 'rotate(180deg)';
        };
        const resHtml = tableRes.length
            ? `<div>${tableRes.map(renderRes).join('')}</div>`
            : '<p class="text-xs text-slate-400 text-center py-3">אין הזמנות שולחן</p>';
        sections.reservations = resHtml;
        sections.orders = ordHtml;
        sections.quotes = qHtml;
        sections.all = (orders.length + quotes.length + tableRes.length === 0) ? '<p class="text-xs text-slate-400 text-center py-4">אין פעילות עדיין</p>' : resHtml + ordHtml + qHtml;

    } else if (bizType === 'maintenance_repair') {
        const calls = act.serviceCalls || [];
        const workOrders = act.workOrders || [];
        const _ref = id => id ? `<span class="text-[9px] font-mono text-slate-300 ml-1">#${String(id).padStart(4,'0')}</span>` : '';
        const _callStatusMap = {new:'חדש',scheduled:'נקבע',processing:'בטיפול',in_progress:'בטיפול',done:'הושלם',cancelled:'בוטל',quote:'הצעה',pending_payment:'ממתין תשלום',pending_parts:'ממתין חלקים'};
        const renderCall = c => {
            const payments = Array.isArray(c.payments) ? c.payments : [];
            const totalCharged = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
            const totalReceived = payments.reduce((s, p) => s + parseFloat(p.received_amount || (p.status === 'received' ? p.amount : 0) || 0), 0);
            const statusColor = c.status==='done' ? 'bg-green-100 text-green-700' : c.status==='cancelled' ? 'bg-red-100 text-red-600' : c.payment_status==='pending_payment'||c.payment_status==='partial' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
            const statusLabel = c.payment_status === 'paid' ? 'שולם' : c.payment_status === 'partial' ? 'שולם חלקית' : c.payment_status === 'pending_payment' ? 'ממתין תשלום' : _callStatusMap[c.status]||c.status||'';
            let milestoneRows = '';
            if (payments.length > 0) {
                milestoneRows = `<div class="bg-slate-50 rounded-lg px-2 py-1 mt-1 space-y-0">${payments.map(p => {
                    const isPaid = p.status === 'received';
                    const dueStr = p.due_date ? new Date(p.due_date).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'}) : '';
                    return `<div class="flex items-center gap-1 py-0.5">
                        <span class="text-[10px] ${isPaid?'text-green-600':'text-slate-400'}">${isPaid?'✅':'⏳'}</span>
                        <span class="text-[10px] text-slate-600 flex-1">${p.milestone_name||'תחנת תשלום'}</span>
                        <span class="text-[10px] font-bold ${isPaid?'text-green-700':'text-slate-700'}">₪${parseFloat(p.amount||0).toLocaleString('he-IL',{maximumFractionDigits:0})}</span>
                        ${dueStr?`<span class="text-[9px] text-slate-400 mr-1">${dueStr}</span>`:''}
                    </div>`;
                }).join('')}</div>`;
            }
            return `<div class="py-2 border-b border-slate-50 last:border-0">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-sm shrink-0">🔧</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-slate-700 truncate">${c.issue_description||c.title||'קריאת שירות'}${_ref(c.id)}</p>
                        <p class="text-[10px] text-slate-400">${fmtDate(c.created_at)}</p>
                    </div>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusColor}">${statusLabel}</span>
                </div>
                ${totalCharged > 0 ? `<div class="mr-10 mt-0.5">
                    <div class="flex items-center gap-3 text-[10px] text-slate-500">
                        <span>חויב: <b class="text-slate-700">₪${totalCharged.toLocaleString('he-IL',{maximumFractionDigits:0})}</b></span>
                        <span>שולם: <b class="text-green-700">₪${totalReceived.toLocaleString('he-IL',{maximumFractionDigits:0})}</b></span>
                    </div>
                    ${milestoneRows}
                </div>` : ''}
            </div>`;
        };
        const renderWorkOrder = wo => {
            const payments = Array.isArray(wo.payments) ? wo.payments : [];
            const totalCharged = parseFloat(wo.total_amount || 0);
            const totalReceived = payments.reduce((s, p) => s + parseFloat(p.received_amount || (p.status === 'received' ? p.amount : 0) || 0), 0);
            const woStatusMap = {processing:'בטיפול',done:'הושלם',cancelled:'בוטל',pending_payment:'ממתין תשלום'};
            const woStatusLabel = woStatusMap[wo.payment_status] || woStatusMap[wo.status] || wo.status || '';
            const woStatusColor = wo.payment_status === 'paid' || wo.status === 'done' ? 'bg-green-100 text-green-700' : wo.payment_status === 'pending_payment' || wo.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
            const paymentStatusLabel = wo.payment_status === 'paid' ? 'שולם במלואו' : wo.payment_status === 'partial' ? 'שולם חלקית' : wo.payment_status === 'pending_payment' ? 'ממתין לתשלום' : '';
            let milestoneRows = '';
            if (payments.length > 0) {
                milestoneRows = payments.map(p => {
                    const isPaid = p.status === 'received';
                    const dueStr = p.due_date ? new Date(p.due_date).toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit'}) : '';
                    return `<div class="flex items-center gap-1 py-0.5">
                        <span class="text-[10px] ${isPaid ? 'text-green-600' : 'text-slate-500'}">${isPaid ? '✅' : '⏳'}</span>
                        <span class="text-[10px] text-slate-600 flex-1">${p.milestone_name||'תחנת תשלום'}</span>
                        <span class="text-[10px] font-bold ${isPaid ? 'text-green-700' : 'text-slate-700'}">₪${parseFloat(p.amount||0).toLocaleString('he-IL',{maximumFractionDigits:0})}</span>
                        ${dueStr ? `<span class="text-[9px] text-slate-400 mr-1">${dueStr}</span>` : ''}
                    </div>`;
                }).join('');
            }
            return `<div class="py-2 border-b border-slate-50 last:border-0">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm shrink-0">📋</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-slate-700 truncate">${wo.quote_title||'פקודת עבודה'}${_ref(wo.id)}</p>
                        <p class="text-[10px] text-slate-400">${fmtDate(wo.created_at)}</p>
                    </div>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${woStatusColor}">${woStatusLabel}</span>
                </div>
                ${totalCharged > 0 ? `<div class="mr-10 mt-1">
                    <div class="flex items-center gap-3 text-[10px] text-slate-500 mb-1">
                        <span>סה"כ: <b class="text-slate-700">₪${totalCharged.toLocaleString('he-IL',{maximumFractionDigits:0})}</b></span>
                        <span>שולם: <b class="text-green-700">₪${totalReceived.toLocaleString('he-IL',{maximumFractionDigits:0})}</b></span>
                        ${paymentStatusLabel ? `<span class="text-amber-600 font-bold">${paymentStatusLabel}</span>` : ''}
                    </div>
                    ${milestoneRows ? `<div class="bg-slate-50 rounded-lg px-2 py-1 space-y-0">${milestoneRows}</div>` : ''}
                </div>` : ''}
            </div>`;
        };
        listRenderers.serviceCalls = renderCall;
        listRenderers.workOrders = renderWorkOrder;
        tabs.push({ id:'all', label:'הכל' }, { id:'calls', label:`קריאות (${calls.length})` });
        if (workOrders.length) tabs.push({ id:'workorders', label:`פקודות עבודה (${workOrders.length})` });
        const callSortControls = `<div class="flex gap-1.5 mb-2">
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-indigo-600 text-white border-indigo-600 transition" data-dir="desc" data-list="biz-calls-list" data-key="serviceCalls" data-date="created_at" onclick="window._bizSortList(this)">חדש ראשון</button>
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-white text-slate-500 border-slate-200 transition" data-dir="asc" data-list="biz-calls-list" data-key="serviceCalls" data-date="created_at" onclick="window._bizSortList(this)">ישן ראשון</button>
        </div>`;
        const callsHtml = calls.length
            ? callSortControls + `<div class="biz-calls-list">${calls.map(renderCall).join('')}</div>`
            : '<p class="text-xs text-slate-400 text-center py-3">אין קריאות שירות</p>';
        const woHtml = workOrders.length
            ? `<div class="biz-workorders-list">${workOrders.map(renderWorkOrder).join('')}</div>`
            : '<p class="text-xs text-slate-400 text-center py-3">אין פקודות עבודה</p>';
        sections.calls = callsHtml;
        sections.workorders = woHtml;
        const allCombined = (calls.length === 0 && workOrders.length === 0)
            ? '<p class="text-xs text-slate-400 text-center py-4">אין פעילות עדיין</p>'
            : (calls.length ? callsHtml : '') + (workOrders.length ? `<div class="mt-2">${woHtml}</div>` : '');
        sections.all = allCombined;

    } else if (bizType === 'logistics') {
        const orders = act.logisticsOrders || [];
        const _ref = id => id ? `<span class="text-[9px] font-mono text-slate-300 ml-1">#${String(id).padStart(4,'0')}</span>` : '';
        const _logStatusLabel = s => ({new:'חדש',confirmed:'אושר',assigned:'שויך',picked_up:'נאסף',in_transit:'בדרך',arrived:'הגיע',delivered:'נמסר',partial:'חלקי',failed_attempt:'לא ענה',returned:'הוחזר',cancelled:'בוטל',pending_quote:'ממתין הצעה',quote_sent:'הצעה נשלחה'}[s]||s||'');
        const renderLogOrd = o => `<div class="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm shrink-0">📦</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-700">${o.order_number ? o.order_number : ''}${_ref(o.id)}</p>
                    <p class="text-[10px] text-slate-400">${o.delivery_address||''} · ${fmtDate(o.created_at)}</p>
                </div>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">${_logStatusLabel(o.status)}</span>
            </div>`;
        listRenderers.logisticsOrders = renderLogOrd;
        tabs.push({ id:'all', label:'הכל' }, { id:'orders', label:`משלוחים (${orders.length})` });
        const logSortControls = `<div class="flex gap-1.5 mb-2">
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-indigo-600 text-white border-indigo-600 transition" data-dir="desc" data-list="biz-log-list" data-key="logisticsOrders" data-date="created_at" onclick="window._bizSortList(this)">חדש ראשון</button>
            <button class="biz-sort-btn text-[10px] font-bold px-2 py-1 rounded-full border bg-white text-slate-500 border-slate-200 transition" data-dir="asc" data-list="biz-log-list" data-key="logisticsOrders" data-date="created_at" onclick="window._bizSortList(this)">ישן ראשון</button>
        </div>`;
        const ordHtml = orders.length
            ? logSortControls + `<div class="biz-log-list">${orders.map(renderLogOrd).join('')}</div>`
            : '<p class="text-xs text-slate-400 text-center py-3">אין משלוחים</p>';
        sections.orders = ordHtml;
        sections.all    = orders.length ? ordHtml : '<p class="text-xs text-slate-400 text-center py-4">אין פעילות עדיין</p>';

    } else {
        tabs.push({ id:'all', label:'הכל' });
        sections.all = '<p class="text-xs text-slate-400 text-center py-4">אין פעילות עדיין</p>';
    }

    // Log tab — unified timeline
    const logItems = act.log || [];
    if (logItems.length > 0) {
        const typeIcon = { appointment:'📅', beauty_appt:'💅', order:'🛒', service_call:'🔧' };
        const statusLabels = { pending:'ממתין', approved:'אושר', confirmed:'אושר', completed:'הושלם', done:'הושלם', cancelled:'בוטל' };
        tabs.push({ id:'log', label:'לוג' });
        sections.log = '<div class="relative pr-4">' + logItems.map((item, i) => {
            const dt = new Date(item.time).toLocaleString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
            const icon = typeIcon[item.type] || '•';
            const status = statusLabels[item.status || item.direction] || '';
            return `<div class="flex gap-2 mb-2 relative">
                <div class="absolute right-0 top-3 bottom-0 border-r border-dashed border-slate-200"></div>
                <div class="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] shrink-0 relative z-10">${icon}</div>
                <div class="flex-1 min-w-0 py-1">
                    <p class="text-xs text-slate-700 truncate">${item.label || ''} ${status ? '<span class="text-[9px] text-slate-400">('+status+')</span>' : ''}</p>
                    <p class="text-[9px] text-slate-400">${dt}</p>
                </div>
            </div>`;
        }).join('') + '</div>';
    }

    // Messages tab — always present for all business types
    const msgs = act.messages || [];
    {
        tabs.push({ id:'messages', label:`הודעות${msgs.length ? ' ('+msgs.length+')' : ''}` });
        sections.messages = (msgs.length ? msgs.map(m => {
            const isMine = m.direction === 'inbound';
            const dt = new Date(m.created_at).toLocaleString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
            return `<div class="flex ${isMine ? 'justify-end' : 'justify-start'} mb-2">
                <div class="max-w-[80%] px-3 py-2 rounded-2xl text-xs ${isMine ? 'bg-indigo-600 text-white rounded-bl-none' : 'bg-slate-100 text-slate-700 rounded-br-none'}">
                    <p class="leading-relaxed">${safeStr(m.content)}</p>
                    <p class="text-[9px] mt-1 opacity-70 text-left">${dt}</p>
                </div>
            </div>`;
        }).join('') : '<p class="text-xs text-slate-400 text-center py-3">אין הודעות עדיין</p>') + `<div class="mt-3 pt-3 border-t border-slate-100">
            <textarea id="biz-acc-msg-${el.closest('[data-biz-id]')?.dataset?.bizId||''}" rows="2" placeholder="כתוב הודעה לעסק..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-indigo-400"></textarea>
            <button onclick="window._sendBizAccordionMsg(this)" class="mt-1.5 w-full bg-indigo-600 text-white rounded-xl py-2 text-xs font-bold hover:bg-indigo-700 transition">שלח הודעה</button>
        </div>`;
    }

    // If there are pending items → prefer pending tab
    const _resTab = tabs.find(t => t.id === 'reservations');
    const defaultTabId = tabs.find(t => t.id === 'cal_evts') ? 'cal_evts' : (_resTab?.label?.includes('🔔') ? 'reservations' : tabs[0]?.id);
    const tabPills = tabs.map(t => {
        const isDefault = t.id === defaultTabId;
        const isPendingTab = t.id === 'cal_evts';
        const cls = isDefault ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200';
        const dot = isPendingTab && !isDefault ? ' 🔔' : '';
        return `<button class="biz-acc-tab shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition ${cls}" data-tab="${t.id}" onclick="window._switchBizTab(this,'${t.id}')">${t.label}${dot}</button>`;
    }).join('');

    el.innerHTML = `<div class="p-3">
        <div class="flex gap-2 mb-3 hide-scrollbar overflow-x-auto">${tabPills}</div>
        <div class="biz-acc-content">${sections[defaultTabId] || ''}</div>
    </div>`;
    el._sections      = sections;
    el._bizType       = bizType;
    el._rawData       = data;
    el._listRenderers = listRenderers;
};

window._switchBizTab = function(btn, tabId) {
    const acc = btn.closest('.biz-accordion');
    if (!acc) return;
    acc.querySelectorAll('.biz-acc-tab').forEach(b => {
        b.className = b.className
            .replace('bg-indigo-600 text-white border-indigo-600', 'bg-white text-slate-500 border-slate-200')
            .replace('bg-amber-500 text-white border-amber-500', 'bg-white text-slate-500 border-slate-200');
    });
    const activeColor = tabId === 'cal_evts' ? 'bg-amber-500 text-white border-amber-500' : 'bg-indigo-600 text-white border-indigo-600';
    btn.className = btn.className.replace('bg-white text-slate-500 border-slate-200', activeColor);
    const content = acc.querySelector('.biz-acc-content');
    if (content && acc._sections) content.innerHTML = acc._sections[tabId] || '';
};

window._sendBizAccordionMsg = async function(btn) {
    const wrapper = btn.closest('.biz-act-wrapper');
    const bizId = wrapper?.dataset?.bizId;
    if (!bizId) return;
    const ta = wrapper.querySelector(`#biz-acc-msg-${bizId}`);
    const txt = ta?.value?.trim();
    if (!txt) return;
    btn.disabled = true; btn.textContent = 'שולח...';
    try {
        const biz = _activityAllBiz.find(b => b.business_group_id == bizId) || {};
        const r = await fetch(`${API}/inbox/customer`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: parseInt(bizId), name: currentUser?.nickname||'לקוח', contact: currentUser?.phone||'', subject:'פנייה מלקוח ONEFLOW', content: txt, customerGroupId: currentGroup?.id||null })
        }).then(r=>r.json());
        if (r.success) {
            if (ta) ta.value = '';
            // Invalidate accordion cache so next open reloads
            const _accWrapper = btn.closest('.biz-act-wrapper');
            if (_accWrapper) { const _acc = _accWrapper.querySelector('.biz-accordion'); if (_acc) delete _acc.dataset.loaded; }
            // Add message to UI optimistically
            const msgArea = btn.closest('.biz-acc-content');
            const bubble = document.createElement('div');
            bubble.className = 'flex justify-end mb-2';
            bubble.innerHTML = `<div class="max-w-[80%] px-3 py-2 rounded-2xl text-xs bg-indigo-600 text-white rounded-bl-none"><p class="leading-relaxed">${safeStr(txt)}</p><p class="text-[9px] mt-1 opacity-70 text-left">עכשיו</p></div>`;
            const replyBox = btn.closest('div.mt-3');
            if (replyBox) replyBox.insertAdjacentElement('beforebegin', bubble);
            showToast('success','ההודעה נשלחה ✅');
        } else { showToast('error', r.error||'שגיאה'); }
    } catch(e) { showToast('error','שגיאת תקשורת'); }
    btn.disabled = false; btn.textContent = 'שלח הודעה';
};

// ===== BEAUTY RFQ — FAMILY SIDE (P4) =======================
// ============================================================

window._beautyRfqState = { businesses: [], rfqs: [] };

async function _prefetchBeautyRfqs() {
    if (!currentGroup) return;
    try {
        const [bizRes, rfqRes] = await Promise.all([
            fetch(`${API}/beauty/businesses`).then(r=>r.json()),
            fetch(`${API}/beauty/rfq/family/${currentGroup.id}`).then(r=>r.json())
        ]);
        window._beautyRfqState.businesses = bizRes.businesses || [];
        window._beautyRfqState.rfqs = rfqRes.rfqs || [];
    } catch(e) {}
}

async function loadFamilyBeautyRfqInline() {
    const el = document.getElementById('activities-beauty-rfq') || document.getElementById('myorders-beauty-content'); if (!el) return;
    if (!currentGroup) { el.innerHTML = '<p class="text-slate-400 text-center py-6 text-sm">נא להתחבר תחילה</p>'; return; }
    if (!window._beautyRfqState.businesses.length && !window._beautyRfqState.rfqs.length) {
        el.innerHTML = `<div class="flex items-center justify-center py-8 text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin mr-2"></i> טוען...</div>`;
        await _prefetchBeautyRfqs();
    }
    _renderFamilyBeautyRfqInline();
}

// kept for backwards compat (called from _openFamilyRfq reload)
async function loadFamilyBeautyRfq() {
    await _prefetchBeautyRfqs();
    _renderFamilyBeautyRfqInline();
}

function _rfqStatusLabel(status) {
    const map = {
        new: { label: 'נשלח ✉️', cls: 'bg-blue-100 text-blue-700' },
        questionnaire_sent: { label: 'ממתין לתשובות 📋', cls: 'bg-yellow-100 text-yellow-700' },
        client_responded: { label: 'ענינו ✅', cls: 'bg-indigo-100 text-indigo-700' },
        plan_sent: { label: 'תוכנית טיפול 📄', cls: 'bg-purple-100 text-purple-700' },
        accepted: { label: 'תוכנית אושרה 🎉', cls: 'bg-green-100 text-green-700' },
        rejected: { label: 'נדחה', cls: 'bg-red-100 text-red-600' }
    };
    const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-500' };
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}">${s.label}</span>`;
}

function _renderFamilyBeautyRfqInline() {
    const el = document.getElementById('activities-beauty-rfq') || document.getElementById('myorders-beauty-content'); if (!el) return;
    const { businesses, rfqs } = window._beautyRfqState;

    const rfqCards = rfqs.length === 0
        ? `<div class="text-center py-8 text-slate-400 text-sm">
            <i class="fa-solid fa-paper-plane text-3xl mb-3 block opacity-30"></i>
            עדיין לא שלחת פנייה לשום מכון — בחר מכון למטה
           </div>`
        : rfqs.map(rfq => {
            const needsAction = rfq.status === 'questionnaire_sent' || rfq.status === 'plan_sent';
            return `<div class="bg-white rounded-2xl border ${needsAction ? 'border-purple-300 shadow-purple-50' : 'border-slate-100'} shadow-sm p-4 cursor-pointer hover:shadow-md transition"
                onclick="window._openFamilyRfq(${rfq.id})">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-lg shrink-0">💅</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap mb-0.5">
                            <p class="text-sm font-bold text-slate-800">${rfq.business_name || 'מכון יופי'}</p>
                            ${_rfqStatusLabel(rfq.status)}
                            ${needsAction ? '<span class="text-[9px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full animate-pulse">נדרשת פעולה</span>' : ''}
                        </div>
                        <p class="text-[11px] text-slate-500 truncate">${rfq.service_description || '—'}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">${rfq.updated_at ? new Date(rfq.updated_at).toLocaleDateString('he-IL') : ''}</p>
                    </div>
                    <i class="fa-solid fa-chevron-left text-slate-300 text-xs mt-1 shrink-0"></i>
                </div>
            </div>`;
        }).join('');

    const bizCards = businesses.length === 0
        ? `<p class="text-slate-400 text-sm text-center py-4">אין מכוני יופי רשומים בפלטפורמה כרגע</p>`
        : businesses.map(b => `
        <div class="bg-white rounded-2xl border border-pink-100 shadow-sm p-3 flex items-center gap-3 hover:shadow-md transition">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-lg shrink-0">💅</div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-slate-800">${b.name}</p>
                ${b.city ? `<p class="text-[11px] text-slate-400">${b.city}</p>` : ''}
                ${b.description ? `<p class="text-[10px] text-slate-500 truncate">${b.description}</p>` : ''}
            </div>
            <button onclick="window._familyNewRfqModal(${b.id}, '${(b.name||'').replace(/'/g,"\\'")}', this)"
                class="shrink-0 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-3 py-2 rounded-xl text-xs font-black shadow-sm hover:opacity-90 transition">
                שלח פנייה
            </button>
        </div>`).join('');

    el.innerHTML = `
<div class="space-y-4">
    <!-- header -->
    <div class="bg-gradient-to-l from-pink-50 to-purple-50 rounded-2xl border border-pink-200 p-4">
        <h2 class="text-base font-black text-slate-800 flex items-center gap-2 mb-1">
            <span class="text-2xl">💅</span> שירותי יופי וקוסמטיקה
        </h2>
        <p class="text-xs text-slate-500">פנה/י למכון יופי, ענה/י על שאלות והתאם/י טיפול בדיוק בשבילך</p>
    </div>

    <!-- my rfqs -->
    ${rfqs.length > 0 ? `<div>
        <h3 class="text-xs font-black text-slate-600 mb-2 px-1 uppercase tracking-wide">הפניות שלי</h3>
        <div class="space-y-2">${rfqCards}</div>
    </div>` : rfqCards}

    <!-- discovery -->
    <div>
        <h3 class="text-xs font-black text-slate-600 mb-2 px-1 uppercase tracking-wide">מכוני יופי בפלטפורמה</h3>
        <div class="space-y-2">${bizCards}</div>
    </div>
</div>`;
}

window._familyNewRfqModal = function(bizId, bizName, btn) {
    const html = `
<div id="family-rfq-modal" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div class="bg-gradient-to-r from-pink-500 to-purple-600 px-5 py-4 flex items-center justify-between">
            <div>
                <h3 class="font-black text-white text-base">פנייה ל-${bizName}</h3>
                <p class="text-pink-100 text-xs">תאר/י מה את/ה מחפש/ת</p>
            </div>
            <button onclick="document.getElementById('family-rfq-modal').remove()" class="text-white/70 hover:text-white text-xl"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="p-5 space-y-4 overflow-y-auto flex-1">
            <div>
                <label class="text-xs font-bold text-slate-600 block mb-1">מה השירות שמעניין אותך? *</label>
                <textarea id="rfq-desc" rows="4" placeholder="לדוגמה: רוצה לצבוע את השיער, מחפשת עיצוב גבות, ניסיתי מוצר X בעבר..." class="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"></textarea>
            </div>
            <div class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
                <i class="fa-solid fa-circle-info mt-0.5 shrink-0"></i>
                <span>לאחר שליחת הפנייה, המכון עשוי לשלוח שאלון קצר להתאמת הטיפול האידיאלי עבורך.</span>
            </div>
        </div>
        <div class="p-5 border-t">
            <button onclick="window._submitFamilyRfq(${bizId})" class="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-2xl text-sm font-black shadow-sm hover:opacity-90 transition">שלח פנייה 💌</button>
        </div>
    </div>
</div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._submitFamilyRfq = async function(bizId) {
    const desc = document.getElementById('rfq-desc')?.value?.trim();
    if (!desc) { showToast ? showToast('error','נא תארי את הבקשה') : alert('נא תארי את הבקשה'); return; }
    if (!currentGroup) return;
    try {
        const r = await fetch(`${API}/beauty/rfq`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ business_group_id: bizId, client_family_id: currentGroup.id, service_description: desc })
        }).then(r=>r.json());
        document.getElementById('family-rfq-modal')?.remove();
        if (r.id || r.success) {
            if (window.showToast) showToast('success', 'הפנייה נשלחה! המכון יחזור אליך בקרוב 💌');
            else alert('הפנייה נשלחה!');
            loadFamilyBeautyRfqInline();
        } else {
            if (window.showToast) showToast('error', r.error || 'שגיאה');
            else alert(r.error || 'שגיאה');
        }
    } catch(e) {
        if (window.showToast) showToast('error', 'שגיאת תקשורת');
        else alert('שגיאת תקשורת');
    }
};

window._openFamilyRfq = async function(rfqId) {
    const rfq = window._beautyRfqState.rfqs.find(r => r.id === rfqId); if (!rfq) return;
    const status = rfq.status;
    const qData = rfq.questionnaire_data || {};
    const plan = rfq.treatment_plan || {};
    const msgs = rfq.messages || [];

    let actionSection = '';
    if (status === 'questionnaire_sent' && qData.questions && qData.questions.length > 0) {
        const qFields = qData.questions.map((q, i) => `
            <div><label class="text-xs font-bold text-slate-600 block mb-1">${q}</label>
                <input id="rfq-ans-${i}" type="text" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"/></div>`).join('');
        actionSection = `
            <div class="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
                <p class="text-xs font-black text-purple-700">📋 המכון שלח שאלון — ענה/י כדי לקבל הצעה:</p>
                ${qFields}
                <button onclick="window._submitRfqAnswers(${rfqId}, ${qData.questions.length})" class="w-full bg-purple-600 text-white py-2.5 rounded-xl text-xs font-black hover:bg-purple-700 transition">שלח תשובות</button>
            </div>`;
    } else if (status === 'plan_sent' && plan.sessions) {
        const sessRows = plan.sessions.map(s => `<li class="text-xs text-slate-600">• ${s.name || s.service || 'טיפול'} ${s.duration_min ? '· ' + s.duration_min + ' דק׳' : ''} ${s.price ? '· ₪' + s.price : ''}</li>`).join('');
        actionSection = `
            <div class="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
                <p class="text-xs font-black text-green-700">📄 תוכנית הטיפול שלך מוכנה!</p>
                ${plan.title ? `<p class="text-sm font-bold text-slate-800">${plan.title}</p>` : ''}
                <ul class="space-y-1">${sessRows}</ul>
                ${plan.total_price ? `<p class="text-sm font-black text-slate-800">סה"כ: ₪${plan.total_price}</p>` : ''}
                <div class="flex gap-2 mt-2">
                    <button onclick="window._acceptRfqPlan(${rfqId})" class="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-xs font-black hover:bg-green-700 transition">אשר תוכנית ✅</button>
                    ${plan.payment_link ? `<a href="${plan.payment_link}" target="_blank" class="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-black hover:bg-blue-700 transition text-center">שלם עכשיו 💳</a>` : ''}
                </div>
            </div>`;
    }

    const msgHtml = msgs.length === 0 ? `<p class="text-slate-400 text-xs text-center py-2">אין הודעות עדיין</p>`
        : msgs.map(m => `<div class="flex ${m.from === 'client' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[80%] px-3 py-2 rounded-2xl text-xs ${m.from === 'client' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'}">
                ${m.text}
                <div class="text-[9px] opacity-60 mt-0.5 text-right">${new Date(m.ts).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>`).join('');

    const html = `
<div id="family-rfq-detail-modal" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div class="bg-gradient-to-r from-pink-500 to-purple-600 px-5 py-4 flex items-center justify-between">
            <div>
                <h3 class="font-black text-white text-base">${rfq.business_name || 'מכון יופי'}</h3>
                <div class="mt-0.5">${_rfqStatusLabel(status)}</div>
            </div>
            <button onclick="document.getElementById('family-rfq-detail-modal').remove()" class="text-white/70 hover:text-white text-xl"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="overflow-y-auto flex-1 p-5 space-y-4">
            <div class="bg-slate-50 rounded-xl px-3 py-2">
                <p class="text-[10px] text-slate-400 mb-0.5">הבקשה שלי</p>
                <p class="text-xs text-slate-700">${rfq.service_description || '—'}</p>
            </div>
            ${actionSection}
            <!-- messages -->
            <div>
                <p class="text-xs font-bold text-slate-600 mb-2">הודעות</p>
                <div class="space-y-2 max-h-40 overflow-y-auto mb-3">${msgHtml}</div>
                <div class="flex gap-2">
                    <input id="rfq-msg-input" type="text" placeholder="כתוב/י הודעה..." class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"/>
                    <button onclick="window._sendRfqMsg(${rfqId})" class="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-purple-700 transition">שלח</button>
                </div>
            </div>
        </div>
    </div>
</div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window._submitRfqAnswers = async function(rfqId, count) {
    const answers = [];
    for (let i = 0; i < count; i++) {
        answers.push(document.getElementById(`rfq-ans-${i}`)?.value?.trim() || '');
    }
    try {
        const r = await fetch(`${API}/beauty/rfq/${rfqId}/client-response`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers, photos: [] })
        }).then(r=>r.json());
        document.getElementById('family-rfq-detail-modal')?.remove();
        if (r.success) {
            if (window.showToast) showToast('success', 'תשובותיך נשלחו ✅');
            loadFamilyBeautyRfqInline();
        } else { if (window.showToast) showToast('error', r.error || 'שגיאה'); }
    } catch(e) { if (window.showToast) showToast('error', 'שגיאת תקשורת'); }
};

window._acceptRfqPlan = async function(rfqId) {
    try {
        const r = await fetch(`${API}/beauty/rfq/${rfqId}/accept`, { method: 'POST' }).then(r=>r.json());
        document.getElementById('family-rfq-detail-modal')?.remove();
        if (r.success) {
            if (window.showToast) showToast('success', 'תוכנית הטיפול אושרה! 🎉');
            loadFamilyBeautyRfqInline();
        } else { if (window.showToast) showToast('error', r.error || 'שגיאה'); }
    } catch(e) { if (window.showToast) showToast('error', 'שגיאת תקשורת'); }
};

window._sendRfqMsg = async function(rfqId) {
    const text = document.getElementById('rfq-msg-input')?.value?.trim();
    if (!text) return;
    try {
        const r = await fetch(`${API}/beauty/rfq/${rfqId}/message`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'client', text })
        }).then(r=>r.json());
        if (r.success) {
            document.getElementById('family-rfq-detail-modal')?.remove();
            loadFamilyBeautyRfqInline().then(() => window._openFamilyRfq(rfqId));
        }
    } catch(e) {}
};

window._editQuoteFromActivity = function(quoteId) {
    window.open(`/business.html?editQuoteId=${quoteId}`, '_blank');
};

window._openQuoteFromActivity = async function(quoteId) {
    // Show loading state
    const loader = document.createElement('div');
    loader.className = 'fixed inset-0 bg-black/30 flex items-center justify-center z-50';
    loader.innerHTML = '<div class="bg-white rounded-xl px-5 py-3 text-sm font-bold text-slate-700 shadow-lg">טוען הצעה...</div>';
    document.body.appendChild(loader);

    try {
        // Fetch full quote data from family quotes API
        const userId = window.currentUser?.id || '';
        const res = await fetch(`${API}/store/quotes/family/${currentGroup.id}?userId=${userId}`);
        const data = await res.json();
        loader.remove();

        if (!data.success) { showToast('error', 'שגיאה בטעינת הנתונים'); return; }

        const quote = (data.quotes || []).find(q => String(q.id) === String(quoteId));
        if (!quote) { showToast('error', 'לא נמצאה הצעת מחיר'); return; }

        let itemsHtml = '';
        const items = Array.isArray(quote.items) ? quote.items : (typeof quote.items === 'string' ? JSON.parse(quote.items||'[]') : []);
        let metaData = null;
        let subtotal = 0;

        items.forEach(i => {
            if (i.is_quote_metadata || i.catalogId === 999999) {
                if (i.is_quote_metadata) {
                    try { metaData = JSON.parse(i.data||'{}'); } catch(e) {}
                }
                return;
            }
            const price = parseFloat(i.price_at_order || i.price || i.unit_price || 0);
            const qty = parseFloat(i.quantity || 1);
            const lineTotal = price * qty;
            subtotal += lineTotal;
            itemsHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:13px; direction:rtl;">
                <span style="flex:1; text-align:right;">${safeStr(i.item_name || i.name || '')}</span>
                <span style="width:40px; text-align:center; color:#64748b;">x${qty}</span>
                <span style="width:70px; text-align:left; direction:ltr; color:#64748b;">₪${price.toFixed(2)}</span>
                <span style="width:80px; text-align:left; direction:ltr; font-weight:bold;">₪${lineTotal.toFixed(2)}</span>
            </div>`;
        });

        const statusMap = {
            'waiting_customer': 'בהמתנה ללקוח',
            'waiting_approval': 'בהמתנה לאישור',
            'rejected': 'נדחה',
            'approved': 'אושרה',
            'converted_to_order': 'הומרה להזמנה',
            'cancelled': 'בוטלה',
            'quote': 'טיוטה'
        };
        const statusVal = quote.quote_status || quote.status || 'quote';
        const displayStatus = statusMap[statusVal] || statusVal;
        const createdDate = new Date(quote.created_at).toLocaleDateString('he-IL');
        const bizName = quote.business_name || '';
        const quoteNum = String(quoteId).padStart(4,'0');

        // Build notes from metaData or raw notes field
        if (!metaData && quote.notes) {
            try { metaData = JSON.parse(quote.notes); } catch(e) {}
        }

        // Price breakdown
        const discountPct = parseFloat(metaData?.discount || 0);
        const noVat = !!(metaData?.noVat);
        const vatRate = parseFloat(metaData?.vatRate ?? 18);
        const afterDiscount = discountPct > 0 ? subtotal * (1 - discountPct / 100) : subtotal;
        const vatAmount = noVat ? 0 : afterDiscount * (vatRate / 100);
        const calcTotal = afterDiscount + vatAmount;
        const totalToShow = parseFloat(quote.total_amount || calcTotal || 0);

        let priceBreakdownHtml = '';
        if (subtotal > 0) {
            priceBreakdownHtml = `<div class="border-t border-slate-100 pt-3 space-y-1.5 text-sm">`;
            if (discountPct > 0) {
                priceBreakdownHtml += `
                    <div class="flex justify-between text-slate-500"><span>סכום לפני הנחה:</span><span dir="ltr">₪${subtotal.toFixed(2)}</span></div>
                    <div class="flex justify-between text-red-500"><span>הנחה (${discountPct}%):</span><span dir="ltr">-₪${(subtotal - afterDiscount).toFixed(2)}</span></div>
                    <div class="flex justify-between text-slate-600"><span>נטו לפני מע"מ:</span><span dir="ltr">₪${afterDiscount.toFixed(2)}</span></div>`;
            } else {
                priceBreakdownHtml += `<div class="flex justify-between text-slate-500"><span>נטו לפני מע"מ:</span><span dir="ltr">₪${subtotal.toFixed(2)}</span></div>`;
            }
            if (!noVat && vatRate > 0) {
                priceBreakdownHtml += `<div class="flex justify-between text-slate-500"><span>מע"מ (${vatRate}%):</span><span dir="ltr">₪${vatAmount.toFixed(2)}</span></div>`;
            }
            priceBreakdownHtml += `
                <div class="flex justify-between font-black text-base border-t border-slate-200 pt-2 mt-1">
                    <span dir="ltr" class="text-indigo-700">₪${totalToShow.toFixed(2)}</span>
                    <span class="text-slate-700">סה"כ לתשלום:</span>
                </div>
            </div>`;
        } else {
            priceBreakdownHtml = `<div class="border-t border-slate-100 pt-3">
                <div class="flex justify-between font-black text-base">
                    <span dir="ltr" class="text-indigo-700">₪${totalToShow.toFixed(2)}</span>
                    <span class="text-slate-700">סה"כ לתשלום:</span>
                </div>
            </div>`;
        }

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
            <div class="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-yellow-50 to-amber-50 sticky top-0 rounded-t-2xl">
                <h2 class="text-base font-black text-slate-800">📋 הצעת מחיר #${quoteNum}</h2>
                <button onclick="this.closest('.fixed').remove()" class="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 text-lg">✕</button>
            </div>
            <div class="p-5 space-y-4">
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div><p class="text-[10px] font-bold text-slate-400 mb-0.5">תאריך</p><p class="font-semibold text-slate-800">${createdDate}</p></div>
                    <div><p class="text-[10px] font-bold text-slate-400 mb-0.5">סטטוס</p><span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">${displayStatus}</span></div>
                    ${bizName ? `<div class="col-span-2"><p class="text-[10px] font-bold text-slate-400 mb-0.5">עסק</p><p class="font-semibold text-slate-800">${safeStr(bizName)}</p></div>` : ''}
                    ${quote.customer_name ? `<div class="col-span-2"><p class="text-[10px] font-bold text-slate-400 mb-0.5">לקוח</p><p class="font-semibold text-slate-800">${safeStr(quote.customer_name)}</p></div>` : ''}
                </div>

                ${itemsHtml ? `<div class="border-t border-slate-100 pt-3">
                    <div class="grid grid-cols-4 text-[10px] font-bold text-slate-400 pb-1 border-b border-slate-100 mb-1">
                        <span class="col-span-2 text-right">פריט</span><span class="text-center">כמות</span><span class="text-left">מחיר</span><span class="text-left">סה"כ</span>
                    </div>
                    ${itemsHtml}
                </div>` : '<p class="text-xs text-slate-400 text-center py-2">אין פירוט פריטים</p>'}

                ${priceBreakdownHtml}

                ${metaData && metaData.introText ? `<div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
                    <p class="font-bold text-xs text-blue-500 mb-1">הקדמה מהעסק:</p>
                    <p class="text-xs leading-relaxed" style="white-space:pre-line;">${safeStr(metaData.introText)}</p>
                </div>` : ''}

                ${metaData && metaData.notes ? `<div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p class="font-bold text-xs text-amber-600 mb-1">תנאים והערות:</p>
                    <p class="text-xs text-amber-900 leading-relaxed" style="white-space:pre-line;">${safeStr(metaData.notes)}</p>
                </div>` : ''}

                <div class="border-t border-slate-100 pt-4 flex gap-2">
                    <button onclick="this.closest('.fixed').remove()" class="flex-1 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition">סגור</button>
                    <button onclick="this.closest('.fixed').remove(); switchTab('myorders'); switchMyOrdersTab('quotes'); loadFamilyQuotes();" class="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition">📋 פתח בהצעות שלי</button>
                </div>
            </div>
        </div>`;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    } catch(e) {
        loader.remove();
        showToast('error', 'שגיאה בטעינת ההצעה');
    }
};

// ============================================================
// GAME IFRAME HANDLER
// ============================================================

let _activeAssignmentId = null;

function openGame(assignmentId, gameFilePath, childName, flwPerRound, gameId, startLevel, financeAge) {
  _activeAssignmentId = assignmentId;

  const overlay = document.createElement('div');
  overlay.id = 'game-overlay';
  overlay.style.cssText = `
    position:fixed; top:0; left:0; right:0; bottom:0;
    background:#0A0F1E; z-index:9999;
    display:flex; flex-direction:column;
  `;

  overlay.innerHTML = `
    <div style="
      background:linear-gradient(135deg,#00A896,#007A6E);
      padding:0.7rem 1rem;
      display:flex; align-items:center; justify-content:space-between;
    ">
      <span style="color:white;font-weight:700;font-size:1rem">🎮 Oneflow Kids</span>
      <button onclick="closeGame()" style="
        background:rgba(255,255,255,0.2); border:none; color:white;
        border-radius:50px; padding:0.3rem 0.9rem; cursor:pointer; font-size:0.85rem;
      ">✕ סגור</button>
    </div>
    <iframe id="game-iframe" src="/${gameFilePath}"
      style="flex:1; border:none; width:100%;" allow="autoplay"></iframe>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const iframe = document.getElementById('game-iframe');
  iframe.onload = () => {
    iframe.contentWindow.postMessage({
      type: 'INIT',
      userId: currentUser?.id,
      childName: childName || currentUser?.nickname,
      flwReward: flwPerRound || 10,
      gameId: gameId,
      assignmentId: assignmentId,
      startLevel: startLevel || 1,
      age: financeAge || null,
      token: localStorage.getItem('family_token') || ''
    }, '*');
  };
}

function closeGame() {
  const overlay = document.getElementById('game-overlay');
  if(overlay) overlay.remove();
  document.body.style.overflow = '';
  _activeAssignmentId = null;
}

window.addEventListener('message', async (event) => {
  const data = event.data;
  if(!data?.type) return;

  if(data.type === 'GAME_COMPLETE') {
    if(_activeAssignmentId) {
      try {
        const res = await fetch('/api/kids/use-round', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId: _activeAssignmentId,
            childUserId: currentUser?.id,
            score: data.score || 0,
            flwEarned: data.flwEarned || 0
          })
        });
        const result = await res.json();
        showGameCompleteMessage(data, result);
      } catch(err) {
        console.error('use-round error:', err);
      }
    }
  }

  if(data.type === 'CLOSE_GAME') {
    closeGame();
    if(typeof loadKidAcademy === 'function') loadKidAcademy();
  }
});

function showGameCompleteMessage(gameData, roundResult) {
  const msg = document.createElement('div');
  msg.style.cssText = `
    position:fixed; top:50%; left:50%;
    transform:translate(-50%,-50%);
    background:white; border-radius:20px; padding:2rem; text-align:center;
    z-index:10000; box-shadow:0 20px 60px rgba(0,0,0,0.3); min-width:280px;
  `;

  const exhausted = roundResult.exhausted;
  const roundsLeft = roundResult.roundsLeft || 0;

  msg.innerHTML = `
    <div style="font-size:3rem;margin-bottom:0.5rem">${exhausted ? '🏁' : '🎉'}</div>
    <div style="font-size:1.3rem;font-weight:900;margin-bottom:0.3rem">
      ${exhausted ? 'כל הסיבובים הושלמו!' : 'כל הכבוד!'}
    </div>
    <div style="color:#7A9EA8;font-size:0.9rem;margin-bottom:1rem">
      ${exhausted ? 'ההורה יכול להקצות סיבובים נוספים' : `נשארו עוד ${roundsLeft} סיבובים`}
    </div>
    <div style="
      background:linear-gradient(135deg,#FF6B2B,#FF4500); color:white;
      border-radius:50px; padding:0.5rem 1.5rem;
      font-size:1.2rem; font-weight:900;
      display:inline-block; margin-bottom:1.2rem;
    ">+${gameData.flwEarned || 0} 🪙 FLW</div>
    <br>
    <button onclick="this.parentElement.remove();${exhausted ? 'closeGame()' : ''}"
      style="
        background:linear-gradient(135deg,#00A896,#007A6E);
        color:white; border:none; border-radius:50px;
        padding:0.7rem 2rem; font-size:1rem; cursor:pointer; font-weight:700;
      ">${exhausted ? '🏠 חזרה' : '🎮 המשך לשחק'}</button>
  `;

  document.body.appendChild(msg);
  setTimeout(() => { if(msg.parentElement) msg.remove(); }, 5000);
}

// ============================================================
// FLW KID — מטבעות ילד (ארנק, מימוש, הגדרות הורה)
// ============================================================

let _kidFlwConfig = {}; // flw_value_ils per child

async function loadChildFlwWallet() {
    if (!currentUser || currentUser.role !== 'CHILD') return;
    try {
        const [walletRes, configRes] = await Promise.all([
            fetch(`/api/kids/wallet/${currentUser.id}`),
            fetch(`/api/kids/config/${currentUser.id}`)
        ]);
        const walletData = await walletRes.json();
        const configData = await configRes.json();
        const w = walletData.wallet || {};
        const cfg = configData.config || {};
        const valueIls = parseFloat(cfg.flw_value_ils || 0.10);
        const balance = parseFloat(w.balance_flw || 0);

        const el = id => document.getElementById(id);
        if (el('kid-flw-balance')) el('kid-flw-balance').textContent = Math.floor(balance);
        if (el('kid-flw-lifetime')) el('kid-flw-lifetime').textContent = Math.floor(w.lifetime_flw || 0);
        if (el('kid-flw-redeemed')) el('kid-flw-redeemed').textContent = Math.floor(w.redeemed_flw || 0);
        if (el('kid-flw-value-ils')) el('kid-flw-value-ils').textContent = `₪${(balance * valueIls).toFixed(2)}`;

        window._kidFlwBalance = balance;
        window._kidFlwValueIls = valueIls;

        // עדכון chip כותרת עבור ילד — מציג יתרה אישית בלבד
        const chip = document.getElementById('header-flw-chip');
        const numEl = document.getElementById('header-flw-num');
        if (chip) {
            if (numEl) numEl.textContent = Math.floor(balance);
            chip.onclick = openKidRedeemModal;
            chip.title = 'ארנק מטבעות אישי';
            chip.classList.remove('hidden');
            chip.classList.add('flex');
        }
    } catch(e) {}
}

function openKidRedeemModal() {
    const balance = window._kidFlwBalance || 0;
    const el = id => document.getElementById(id);
    if (el('kid-redeem-balance-display')) el('kid-redeem-balance-display').textContent = Math.floor(balance);
    if (el('kid-redeem-amount')) el('kid-redeem-amount').value = '';
    if (el('kid-redeem-ils-preview')) el('kid-redeem-ils-preview').textContent = '₪0';
    document.getElementById('kid-redeem-modal').classList.remove('hidden');
}

function updateKidRedeemPreview(val) {
    const amt = parseFloat(val) || 0;
    const rate = window._kidFlwValueIls || 0.10;
    const el = document.getElementById('kid-redeem-ils-preview');
    if (el) el.textContent = `₪${(amt * rate).toFixed(2)}`;
}

async function submitKidRedeem() {
    const amt = parseFloat(document.getElementById('kid-redeem-amount')?.value);
    if (!amt || amt <= 0) return showToast('error', 'נא להזין כמות');
    const balance = window._kidFlwBalance || 0;
    if (amt > balance) return showToast('error', 'יתרה לא מספיקה');
    try {
        // שמירת בקשת מימוש בטבלת notifications/transactions - נשתמש ב-redeem endpoint
        const res = await fetch('/api/kids/redeem-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ childUserId: currentUser.id, flwAmount: amt, groupId: currentGroup?.id })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('kid-redeem-modal').classList.add('hidden');
            showToast('success', `בקשה נשלחה! ₪${(amt * (window._kidFlwValueIls || 0.10)).toFixed(2)} ממתינים לאישור ההורה`);
            loadChildFlwWallet();
        } else {
            showToast('error', data.error || 'שגיאה בשליחת בקשה');
        }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

// ─── הורה: טעינת פאנל FLW KID ───────────────────────────────

async function loadFlwKidParentPanel() {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    const panel = document.getElementById('flw-kid-parent-panel');
    const list  = document.getElementById('flw-kid-children-list');
    if (!panel || !list) return;

    // אם membersCache ריק — טען קודם
    if (!membersCache || membersCache.length === 0) {
        try {
            const r = await fetch(`/api/group/members?groupId=${currentGroup?.id}`);
            membersCache = await r.json();
            if (!Array.isArray(membersCache)) membersCache = [];
        } catch(e) {}
    }
    const children = (membersCache || []).filter(m => m.role === 'CHILD');
    if (children.length === 0) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    // טעינת ארנקים וקונפיגים לכל הילדים במקביל
    const rows = await Promise.all(children.map(async c => {
        try {
            const [wRes, cfRes, reqRes] = await Promise.all([
                fetch(`/api/kids/wallet/${c.id}`),
                fetch(`/api/kids/config/${c.id}`),
                fetch(`/api/kids/redeem-requests?childId=${c.id}&groupId=${currentGroup?.id}`)
            ]);
            const w   = (await wRes.json()).wallet || {};
            const cfg = (await cfRes.json()).config || { flw_value_ils: 0.10 };
            const reqs = (await reqRes.json()).requests || [];
            return { child: c, wallet: w, config: cfg, pendingRequests: reqs };
        } catch { return { child: c, wallet: {}, config: { flw_value_ils: 0.10 }, pendingRequests: [] }; }
    }));

    list.innerHTML = rows.map(({ child, wallet, config, pendingRequests }) => {
        const balance  = parseFloat(wallet.balance_flw || 0);
        const lifetime = parseFloat(wallet.lifetime_flw || 0);
        const valueIls = parseFloat(config.flw_value_ils || 0.10);
        const ini      = child.nickname.charAt(0).toUpperCase();
        const pendingHtml = pendingRequests.length > 0
            ? pendingRequests.map(r => `
                <div class="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mt-2">
                    <span class="text-xs text-yellow-800">בקשת מימוש: <strong>${r.flw_amount} FLW</strong> = ₪${(r.flw_amount * valueIls).toFixed(2)}</span>
                    <button onclick="openApproveKidRedeem(${child.id},'${child.nickname}',${r.flw_amount},${r.id},${valueIls})"
                        class="text-xs bg-green-500 text-white px-3 py-1 rounded-full font-bold">אשר</button>
                </div>`).join('')
            : '';
        return `
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-black text-lg">${ini}</div>
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${child.nickname}</p>
                        <p class="text-xs text-purple-600">₪${valueIls.toFixed(2)} למטבע</p>
                    </div>
                </div>
                <button onclick="openFlwKidConfig(${child.id},'${child.nickname}',${valueIls},${config.max_daily_flw||50})"
                    class="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition">
                    <i class="fa-solid fa-gear text-sm"></i>
                </button>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-purple-50 rounded-xl py-2"><p class="text-xs text-purple-500 font-bold">יתרה</p><p class="font-black text-purple-700 text-lg">${Math.floor(balance)}</p></div>
                <div class="bg-slate-50 rounded-xl py-2"><p class="text-xs text-slate-400 font-bold">שווי</p><p class="font-black text-slate-700">₪${(balance*valueIls).toFixed(2)}</p></div>
                <div class="bg-green-50 rounded-xl py-2"><p class="text-xs text-green-500 font-bold">נצבר סה"כ</p><p class="font-black text-green-700">${Math.floor(lifetime)}</p></div>
            </div>
            ${pendingHtml}
        </div>`;
    }).join('');
}

function openFlwKidConfig(childId, childName, valueIls, maxDaily) {
    document.getElementById('flw-kid-config-child-id').value = childId;
    document.getElementById('flw-kid-config-child-name').textContent = `הגדרות עבור: ${childName}`;
    document.getElementById('flw-kid-config-value').value = valueIls;
    document.getElementById('flw-kid-config-max').value   = maxDaily;
    document.getElementById('flw-kid-config-modal').classList.remove('hidden');
}

async function saveFlwKidConfig() {
    const childId  = document.getElementById('flw-kid-config-child-id')?.value;
    const valueIls = parseFloat(document.getElementById('flw-kid-config-value')?.value);
    const maxDaily = parseInt(document.getElementById('flw-kid-config-max')?.value);
    if (!childId || isNaN(valueIls) || valueIls <= 0) return showToast('error', 'ערך לא תקין');
    try {
        const res = await fetch('/api/kids/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ familyGroupId: currentGroup?.id, childUserId: parseInt(childId), flwValueIls: valueIls, maxDailyFlw: maxDaily || 50, autoApprove: false })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('flw-kid-config-modal').classList.add('hidden');
            showToast('success', 'הגדרות נשמרו');
            loadFlwKidParentPanel();
        } else { showToast('error', data.error || 'שגיאה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function openApproveKidRedeem(childId, childName, flwAmount, requestId, valueIls) {
    document.getElementById('flw-approve-child-id').value    = childId;
    document.getElementById('flw-approve-flw-amount').value  = flwAmount;
    document.getElementById('flw-approve-child-name').textContent = `ילד/ה: ${childName}`;
    document.getElementById('flw-approve-amount').textContent = `${flwAmount} 🪙 FLW`;
    document.getElementById('flw-approve-ils').textContent   = `= ₪${(flwAmount * valueIls).toFixed(2)}`;
    window._flwApproveRequestId = requestId;
    document.getElementById('flw-kid-approve-modal').classList.remove('hidden');
}

async function approveKidRedeem() {
    const childId   = document.getElementById('flw-approve-child-id')?.value;
    const flwAmount = parseFloat(document.getElementById('flw-approve-flw-amount')?.value);
    const requestId = window._flwApproveRequestId;
    try {
        const res = await fetch('/api/kids/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ childUserId: parseInt(childId), flwAmount, parentUserId: currentUser.id, requestId })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('flw-kid-approve-modal').classList.add('hidden');
            showToast('success', `מימוש אושר! ₪${data.ilsAmount} הועבר לחשבון הילד`);
            loadFlwKidParentPanel();
            fetchData();
        } else { showToast('error', data.error || 'שגיאה במימוש'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

// ============================================================
// ASSIGN GAME MODAL (הורה)
// ============================================================

let _selectedGameId = null;
let _selectedRounds = 3;
let _selectedChildIdForGame = null;
let _selectedLevel = 1;
let _assignGames = [];

const GAME_LEVELS_BY_PATH = {
  'games/english-alphabet-1.html': [
    { level: 1, label: 'אותיות בסיסיות', ages: '4–6' },
    { level: 2, label: 'צלילים ומילים', ages: '6–8' },
    { level: 3, label: 'מילים ומשפטים', ages: '8–10' },
    { level: 4, label: 'אוצר מילים מתקדם', ages: '12–14' },
  ],
  'games/hebrew-letters-1.html': [
    { level: 1, label: 'אותיות בסיסיות', ages: '4–6' },
    { level: 2, label: 'אותיות ומילים', ages: '6–8' },
    { level: 3, label: 'קריאה ומשמעות', ages: '8–10' },
    { level: 4, label: 'שורשים ודקדוק', ages: '12–14' },
  ],
  'games/math-1.html': [
    { level: 1, label: 'ספירה', ages: '4–6' },
    { level: 2, label: 'חיבור וחיסור', ages: '6–8' },
    { level: 3, label: 'כפל וחילוק', ages: '8–12' },
    { level: 4, label: 'שברים ואחוזים', ages: '12–14' },
  ],
};

async function openAssignGameModal() {
  try {
    const [gamesRes, membersRes] = await Promise.all([
      fetch(`/api/kids/games?userId=${currentUser?.id}`),
      fetch(`/api/group/members?groupId=${currentGroup?.id}`)
    ]);
    const gamesData   = await gamesRes.json();
    const membersData = await membersRes.json();
    const gamesRaw = gamesData.games || [];
    const games    = gamesRaw.filter((g, i, arr) => arr.findIndex(x => x.title === g.title) === i);
    const allMembers = Array.isArray(membersData) ? membersData : (membersData.members || []);
    const children = allMembers.filter(m => m.role !== 'ADMIN');

    _selectedGameId = null;
    _selectedRounds = 3;
    _selectedChildIdForGame = null;
    _selectedLevel = 1;
    _assignGames = games;

    const modal = document.createElement('div');
    modal.id = 'assign-game-modal';
    modal.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      z-index:5000; display:flex; align-items:center; justify-content:center; padding:1rem;
    `;

    modal.innerHTML = `
      <div style="
        background:white; border-radius:24px; padding:2rem;
        max-width:420px; width:100%; max-height:90vh; overflow-y:auto;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
          <h2 style="font-size:1.3rem;font-weight:900">🎮 הקצה משחק לילד</h2>
          <button onclick="document.getElementById('assign-game-modal').remove()"
            style="background:none;border:none;font-size:1.5rem;cursor:pointer">✕</button>
        </div>

        <label style="font-size:0.85rem;font-weight:700;color:#555;display:block;margin-bottom:0.4rem">לאיזה ילד?</label>
        <select id="game-assign-child-select" onchange="_selectedChildIdForGame=this.value" style="
          width:100%;padding:0.8rem;border:2px solid #E0E0E0;
          border-radius:12px;font-size:1rem;margin-bottom:1rem;
        ">
          <option value="">בחר ילד...</option>
          ${children.map(c => `<option value="${c.id}">${c.nickname}</option>`).join('')}
        </select>

        <label style="font-size:0.85rem;font-weight:700;color:#555;display:block;margin-bottom:0.4rem">איזה משחק?</label>
        <div id="games-picker" style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1rem">
          ${games.length === 0
            ? '<p style="color:#999;text-align:center;grid-column:1/-1">אין משחקים פעילים</p>'
            : games.map(g => {
                const badge = g.badge || (g.created_at && (Date.now() - new Date(g.created_at).getTime()) < 30*24*60*60*1000 ? 'חדש ✨' : '');
                const badgeStyle = badge.includes('מומלץ') ? 'background:linear-gradient(135deg,#7C3AED,#5B21B6)'
                                 : badge.includes('פופולרי') ? 'background:linear-gradient(135deg,#EF4444,#DC2626)'
                                 : badge.includes('בטא') ? 'background:linear-gradient(135deg,#0EA5E9,#0284C7)'
                                 : 'background:linear-gradient(135deg,#FF6B2B,#F59E0B)';
                return `
              <div onclick="selectGameForAssign(this,'${g.id}')" data-game-id="${g.id}"
                style="border:2px solid #E0E0E0;border-radius:14px;padding:0.8rem;
                       text-align:center;cursor:pointer;transition:all 0.2s;background:white;position:relative">
                ${badge ? `<span style="position:absolute;top:6px;right:6px;${badgeStyle};color:white;font-size:0.58rem;font-weight:900;padding:2px 6px;border-radius:20px;letter-spacing:0.03em">${badge}</span>` : ''}
                <div style="font-size:2rem">${g.thumbnail_emoji || '🎮'}</div>
                <div style="font-size:0.8rem;font-weight:700;margin-top:0.3rem">${g.title}</div>
                <div style="font-size:0.7rem;color:#999">${g.subject}</div>
              </div>`;
              }).join('')}
        </div>

        <div id="age-level-section" style="display:none;margin-bottom:1rem">
          <label style="font-size:0.85rem;font-weight:700;color:#555;display:block;margin-bottom:0.4rem">רמה לפי גיל</label>
          <div id="age-level-picker" style="display:flex;flex-direction:column;gap:0.5rem"></div>
        </div>

        <label style="font-size:0.85rem;font-weight:700;color:#555;display:block;margin-bottom:0.4rem">כמה סיבובים?</label>
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
          ${[1,2,3,5,10].map(n => `
            <button onclick="setRounds(this,${n})" class="rounds-btn"
              style="flex:1;padding:0.6rem 0;border:2px solid #E0E0E0;
                     border-radius:10px;font-size:1rem;font-weight:700;
                     cursor:pointer;background:white;transition:all 0.2s;
                     ${n===3?'border-color:#7C3AED;background:#7C3AED;color:white;':''}">${n}</button>
          `).join('')}
        </div>
        <input type="hidden" id="assign-rounds" value="3">

        <div id="finance-age-wrap" style="display:none;margin-bottom:1rem">
          <label style="font-size:0.82rem;font-weight:700;color:#555;display:block;margin-bottom:0.4rem">🎓 רמת גיל למשחק הכלכלה</label>
          <select id="finance-age-select" style="width:100%;padding:0.8rem;border:2px solid #E0E0E0;border-radius:12px;font-size:0.95rem">
            <option value="10">גיל 10-11 — כסף בסיסי</option>
            <option value="12">גיל 11-12 — תקציב חכם</option>
            <option value="13">גיל 13-14 — כסף עובד</option>
            <option value="15">גיל 15-16 — חשיבה פיננסית</option>
          </select>
        </div>

        <label style="font-size:0.85rem;font-weight:700;color:#555;display:block;margin-bottom:0.4rem">FLW לסיבוב מוצלח</label>
        <input type="number" id="assign-flw" value="10" min="1" max="50"
          style="width:100%;padding:0.8rem;border:2px solid #E0E0E0;
                 border-radius:12px;font-size:1rem;margin-bottom:1.5rem;">

        <button onclick="submitGameAssignment()"
          style="width:100%;background:linear-gradient(135deg,#7C3AED,#5B21B6);
                 color:white;border:none;border-radius:50px;
                 padding:1rem;font-size:1.1rem;font-weight:700;cursor:pointer">
          🎮 הקצה משחק
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
  } catch(e) {
    showToast('error', 'שגיאה בטעינת הנתונים');
  }
}

function selectGameForAssign(el, gameId) {
  document.querySelectorAll('#games-picker > div').forEach(d => {
    d.style.border = '2px solid #E0E0E0';
    d.style.background = 'white';
  });
  el.style.border = '2px solid #7C3AED';
  el.style.background = '#F5F3FF';
  _selectedGameId = gameId;
  _selectedLevel = 1;

  // הצג רמות לפי גיל
  const game = _assignGames.find(g => String(g.id) === String(gameId));
  const levels = game ? (GAME_LEVELS_BY_PATH[game.file_path] || []) : [];
  const section = document.getElementById('age-level-section');
  const picker = document.getElementById('age-level-picker');
  if(!section || !picker) return;

  const financeWrap = document.getElementById('finance-age-wrap');
  if(financeWrap) financeWrap.style.display = (game && game.subject === 'finance') ? 'block' : 'none';

  if(levels.length === 0) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  picker.innerHTML = levels.map((lv, i) => `
    <div onclick="selectLevelForAssign(this,${lv.level})" data-level="${lv.level}"
      style="border:2px solid ${i===0?'#7C3AED':'#E0E0E0'};border-radius:12px;padding:0.6rem 1rem;
             cursor:pointer;display:flex;align-items:center;justify-content:space-between;
             background:${i===0?'#F5F3FF':'white'};transition:all 0.2s">
      <div>
        <div style="font-weight:700;font-size:0.9rem">רמה ${lv.level} — ${lv.label}</div>
        <div style="font-size:0.75rem;color:#999">גיל ${lv.ages}</div>
      </div>
      ${i===0?'<span style="color:#7C3AED;font-size:1.1rem">✓</span>':''}
    </div>
  `).join('');
}

function selectLevelForAssign(el, level) {
  document.querySelectorAll('#age-level-picker > div').forEach(d => {
    d.style.border = '2px solid #E0E0E0';
    d.style.background = 'white';
    const check = d.querySelector('span');
    if(check) check.remove();
  });
  el.style.border = '2px solid #7C3AED';
  el.style.background = '#F5F3FF';
  if(!el.querySelector('span')) {
    const chk = document.createElement('span');
    chk.style.cssText = 'color:#7C3AED;font-size:1.1rem';
    chk.textContent = '✓';
    el.appendChild(chk);
  }
  _selectedLevel = level;
}

function setRounds(el, n) {
  document.querySelectorAll('.rounds-btn').forEach(b => {
    b.style.border = '2px solid #E0E0E0';
    b.style.background = 'white';
    b.style.color = '#333';
  });
  el.style.border = '2px solid #7C3AED';
  el.style.background = '#7C3AED';
  el.style.color = 'white';
  _selectedRounds = n;
  const inp = document.getElementById('assign-rounds');
  if(inp) inp.value = n;
}

async function submitGameAssignment() {
  const childId = _selectedChildIdForGame;
  const flw     = document.getElementById('assign-flw')?.value || 10;

  if(!childId) return alert('נא לבחור ילד');
  if(!_selectedGameId) return alert('נא לבחור משחק');

  try {
    const res = await fetch('/api/kids/assign-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyGroupId: currentGroup?.id,
        childUserId: parseInt(childId),
        gameId: parseInt(_selectedGameId),
        roundsTotal: _selectedRounds,
        flwPerRound: parseInt(flw) || 10,
        parentUserId: currentUser?.id,
        startLevel: _selectedLevel || 1,
        financeAge: parseInt(document.getElementById('finance-age-select')?.value) || null
      })
    });
    const data = await res.json();
    if(data.success) {
      document.getElementById('assign-game-modal')?.remove();
      showToast('success', `✅ המשחק הוקצה! ${_selectedRounds} סיבובים מחכים לילד 🎮`);
    } else {
      showToast('error', data.error || 'שגיאה בהקצאה');
    }
  } catch(e) {
    showToast('error', 'שגיאה בתקשורת');
  }
}

// ============================================================
// QUEST WIZARD (הורה — בניית קווסט ידני)
// ============================================================

function openQuestWizard() {
  const _prefill = window._prefillQuestData || null;
  if(window._prefillQuestData) delete window._prefillQuestData;

  let questQuestions = _prefill?.questions || [];
  let wizardStep = 1;
  let questData = _prefill ? {
    title: _prefill.title, subject: _prefill.subject,
    description: _prefill.description,
    flwReward: _prefill.flw_reward, passScore: _prefill.pass_score
  } : {};
  let _selectedChildIdForQuest = null;
  let _shareChoice = 'private';

  const modal = document.createElement('div');
  modal.id = 'quest-wizard-modal';
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.5);
    z-index:5000; display:flex; align-items:center; justify-content:center; padding:1rem;
  `;

  function renderStep() {
    const inner = document.getElementById('quest-wizard-inner');
    if(!inner) return;

    if(wizardStep === 1) {
      inner.innerHTML = `
        <h3 style="font-size:1.1rem;font-weight:900;margin-bottom:1.2rem">שלב 1 — פרטי הקווסט</h3>

        <label style="font-size:0.82rem;font-weight:700;color:#555;display:block;margin-bottom:0.3rem">שם הקווסט *</label>
        <input id="qw-title" placeholder="לדוגמה: חשבון פרק 3" value="${questData.title||''}"
          style="width:100%;padding:0.8rem;border:2px solid #E0E0E0;border-radius:12px;font-size:1rem;margin-bottom:0.8rem">

        <label style="font-size:0.82rem;font-weight:700;color:#555;display:block;margin-bottom:0.3rem">נושא</label>
        <select id="qw-subject"
          style="width:100%;padding:0.8rem;border:2px solid #E0E0E0;border-radius:12px;font-size:1rem;margin-bottom:0.8rem">
          <option value="math" ${questData.subject==='math'?'selected':''}>🔢 מתמטיקה</option>
          <option value="hebrew" ${questData.subject==='hebrew'?'selected':''}>📖 עברית</option>
          <option value="english" ${questData.subject==='english'?'selected':''}>🇬🇧 אנגלית</option>
          <option value="science" ${questData.subject==='science'?'selected':''}>🔬 מדעים</option>
          <option value="general" ${questData.subject==='general'?'selected':''}>🌟 כללי</option>
        </select>

        <label style="font-size:0.82rem;font-weight:700;color:#555;display:block;margin-bottom:0.3rem">הוראות לילד (אופציונלי)</label>
        <textarea id="qw-desc" placeholder="הוראות, רמזים או הקשר..."
          style="width:100%;padding:0.8rem;border:2px solid #E0E0E0;border-radius:12px;
                 font-size:0.95rem;height:80px;resize:none;margin-bottom:0.8rem"
        >${questData.description||''}</textarea>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:1.2rem">
          <div>
            <label style="font-size:0.82rem;font-weight:700;color:#555;display:block;margin-bottom:0.3rem">FLW לזכייה</label>
            <input type="number" id="qw-flw" value="${questData.flwReward||15}" min="1" max="100"
              style="width:100%;padding:0.8rem;border:2px solid #E0E0E0;border-radius:12px;font-size:1rem">
          </div>
          <div>
            <label style="font-size:0.82rem;font-weight:700;color:#555;display:block;margin-bottom:0.3rem">ציון מינימום</label>
            <input type="number" id="qw-pass" value="${questData.passScore||70}" min="50" max="100"
              style="width:100%;padding:0.8rem;border:2px solid #E0E0E0;border-radius:12px;font-size:1rem">
          </div>
        </div>

        <button onclick="wizardNext1()"
          style="width:100%;background:linear-gradient(135deg,#F59E0B,#D97706);
                 color:white;border:none;border-radius:50px;padding:0.9rem;
                 font-size:1.1rem;font-weight:700;cursor:pointer">
          הבא — הוסף שאלות →
        </button>
      `;
    }

    else if(wizardStep === 2) {
      inner.innerHTML = `
        <h3 style="font-size:1.1rem;font-weight:900;margin-bottom:0.5rem">שלב 2 — שאלות (${questQuestions.length} כרגע)</h3>
        <div style="font-size:0.82rem;color:#999;margin-bottom:1rem">מינימום שאלה אחת</div>

        <div id="qw-questions-list" style="max-height:250px;overflow-y:auto;margin-bottom:1rem">
          ${questQuestions.map((q,i) => `
            <div style="
              background:#F9FAFB;border:1px solid #E0E0E0;border-radius:12px;
              padding:0.8rem;margin-bottom:0.5rem;
              display:flex;justify-content:space-between;align-items:flex-start;
            ">
              <div style="flex:1">
                <div style="font-size:0.9rem;font-weight:700">${i+1}. ${q.question}</div>
                <div style="font-size:0.78rem;color:#22C55E;margin-top:0.2rem">✓ ${q.correct}</div>
              </div>
              <button onclick="removeQuestion(${i})"
                style="background:none;border:none;color:#EF4444;font-size:1.2rem;cursor:pointer;padding:0 0.3rem">✕</button>
            </div>
          `).join('')}
        </div>

        <div style="background:#F0FDF4;border:2px solid #86EFAC;border-radius:16px;padding:1rem;margin-bottom:1rem">
          <div style="font-size:0.85rem;font-weight:700;margin-bottom:0.5rem">➕ שאלה חדשה</div>
          <input id="qw-q-text" placeholder="כתוב את השאלה..."
            style="width:100%;padding:0.7rem;border:1.5px solid #D0D0D0;
                   border-radius:10px;font-size:0.95rem;margin-bottom:0.5rem">
          <select id="qw-q-type"
            onchange="document.getElementById('qw-options-area').style.display=this.value==='multiple_choice'?'block':'none'"
            style="width:100%;padding:0.7rem;border:1.5px solid #D0D0D0;
                   border-radius:10px;font-size:0.95rem;margin-bottom:0.5rem">
            <option value="multiple_choice">בחירה מרובה (4 אפשרויות)</option>
            <option value="number">תשובה מספרית</option>
            <option value="open_text">תשובה חופשית</option>
          </select>
          <div id="qw-options-area">
            ${['א','ב','ג','ד'].map((letter,i) => `
              <input id="qw-opt-${i}" placeholder="אפשרות ${letter}"
                style="width:100%;padding:0.6rem;border:1.5px solid #D0D0D0;
                       border-radius:10px;font-size:0.9rem;margin-bottom:0.4rem">
            `).join('')}
          </div>
          <input id="qw-q-correct" placeholder="תשובה נכונה *"
            style="width:100%;padding:0.7rem;border:1.5px solid #22C55E;
                   border-radius:10px;font-size:0.95rem;margin-bottom:0.5rem">
          <button onclick="addQuestion()"
            style="width:100%;background:#22C55E;color:white;border:none;
                   border-radius:50px;padding:0.7rem;font-size:0.95rem;font-weight:700;cursor:pointer">
            ✅ הוסף שאלה
          </button>
        </div>

        <div style="display:flex;gap:0.7rem">
          <button onclick="wizardStep=1;renderStep()"
            style="flex:1;background:#F3F4F6;color:#555;border:none;
                   border-radius:50px;padding:0.8rem;cursor:pointer;font-weight:700">← חזרה</button>
          <button onclick="wizardNext2()"
            style="flex:2;background:linear-gradient(135deg,#F59E0B,#D97706);
                   color:white;border:none;border-radius:50px;
                   padding:0.8rem;font-size:1rem;font-weight:700;cursor:pointer">
            הבא — בחר ילד →
          </button>
        </div>
      `;
    }

    else if(wizardStep === 3) {
      inner.innerHTML = `
        <h3 style="font-size:1.1rem;font-weight:900;margin-bottom:1.2rem">שלב 3 — לאיזה ילד?</h3>
        <div id="qw-children-list" style="margin-bottom:1.5rem">טוען ילדים...</div>
        <div style="background:#FEF3C7;border-radius:16px;padding:1rem;margin-bottom:1rem;font-size:0.88rem;color:#92400E">
          <strong>סיכום:</strong><br>
          📝 ${questData.title}<br>
          ❓ ${questQuestions.length} שאלות<br>
          🪙 ${questData.flwReward} FLW לזכייה<br>
          🎯 ציון מינימום: ${questData.passScore}%
        </div>
        <div id="qw-share-row" style="margin-bottom:1.2rem">
          <div style="font-size:0.78rem;color:#888;margin-bottom:0.4rem;font-weight:600">שיתוף הקווסט</div>
          <div style="display:flex;flex-direction:column;gap:0.4rem">
            <button class="qw-share-btn" data-v="private"
              style="background:#EDE9FE;color:#5B21B6;border:2px solid #7C3AED;
                     border-radius:10px;padding:0.5rem 0.8rem;font-size:0.8rem;font-weight:700;cursor:pointer;text-align:right">
              🔒 לשימוש אישי בלבד
            </button>
            ${communityId ? `<button class="qw-share-btn" data-v="community"
              style="background:#F3F4F6;color:#374151;border:2px solid #E5E7EB;
                     border-radius:10px;padding:0.5rem 0.8rem;font-size:0.8rem;font-weight:700;cursor:pointer;text-align:right">
              🏘️ שתף לקהילה — ${communityName}
            </button>` : ''}
            <button class="qw-share-btn" data-v="public"
              style="background:#F3F4F6;color:#374151;border:2px solid #E5E7EB;
                     border-radius:10px;padding:0.5rem 0.8rem;font-size:0.8rem;font-weight:700;cursor:pointer;text-align:right">
              🌍 שתף לכל המשפחות במערכת
            </button>
          </div>
        </div>
        <div style="display:flex;gap:0.7rem">
          <button onclick="wizardStep=2;renderStep()"
            style="flex:1;background:#F3F4F6;color:#555;border:none;
                   border-radius:50px;padding:0.8rem;cursor:pointer;font-weight:700">← חזרה</button>
          <button onclick="submitQuest()"
            style="flex:2;background:linear-gradient(135deg,#F59E0B,#D97706);
                   color:white;border:none;border-radius:50px;
                   padding:0.8rem;font-size:1rem;font-weight:700;cursor:pointer">
            🚀 שלח קווסט!
          </button>
        </div>
      `;

      const communityId = currentGroup?.communityId || currentGroup?.community_id || null;
      const communityName = currentGroup?.communityName || currentGroup?.community_name || 'הקהילה שלי';

      fetch(`/api/group/members?groupId=${currentGroup?.id}`)
        .then(r => r.json())
        .then(data => {
          const allMembers = Array.isArray(data) ? data : (data.members || []);
          const children = allMembers.filter(m => m.role === 'CHILD');
          const el = document.getElementById('qw-children-list');
          if(!el) return;
          el.innerHTML = children.length === 0
            ? '<p style="color:#999;text-align:center">אין ילדים במשפחה</p>'
            : children.map(c => `
                <div onclick="selectQuestChild(this,'${c.id}','${c.nickname}')"
                  style="border:2px solid #E0E0E0;border-radius:14px;padding:0.8rem 1rem;
                         cursor:pointer;display:flex;align-items:center;gap:0.8rem;
                         margin-bottom:0.5rem;transition:all 0.2s;background:white">
                  <span style="font-size:1.6rem">${c.avatar_emoji||'👦'}</span>
                  <span style="font-weight:700">${c.nickname}</span>
                </div>
              `).join('');

          const shareEl = document.getElementById('qw-share-row');
          if(shareEl) shareEl.style.display = '';
        }).catch(() => {
          const el = document.getElementById('qw-children-list');
          if(el) el.innerHTML = '<p style="color:#999">שגיאה בטעינת ילדים</p>';
        });

      document.querySelectorAll('.qw-share-btn').forEach(btn => {
        btn.onclick = function() {
          document.querySelectorAll('.qw-share-btn').forEach(b => {
            b.style.background = '#F3F4F6'; b.style.color = '#374151';
            b.style.border = '2px solid #E5E7EB';
          });
          this.style.background = '#EDE9FE'; this.style.color = '#5B21B6';
          this.style.border = '2px solid #7C3AED';
          _shareChoice = this.dataset.v;
        };
      });
    }
  }

  window.wizardNext1 = function() {
    const title = document.getElementById('qw-title')?.value.trim();
    if(!title) return alert('נא להזין שם לקווסט');
    questData = {
      title,
      subject: document.getElementById('qw-subject')?.value || 'general',
      description: document.getElementById('qw-desc')?.value || '',
      flwReward: parseInt(document.getElementById('qw-flw')?.value) || 15,
      passScore: parseInt(document.getElementById('qw-pass')?.value) || 70
    };
    wizardStep = 2;
    renderStep();
  };

  window.addQuestion = function() {
    const text    = document.getElementById('qw-q-text')?.value.trim();
    const correct = document.getElementById('qw-q-correct')?.value.trim();
    const type    = document.getElementById('qw-q-type')?.value || 'multiple_choice';
    if(!text || !correct) return alert('נא למלא שאלה ותשובה נכונה');
    const options = type === 'multiple_choice'
      ? [0,1,2,3].map(i => document.getElementById(`qw-opt-${i}`)?.value.trim()).filter(Boolean)
      : [];
    questQuestions.push({ question: text, type, correct, options });
    renderStep();
  };

  window.removeQuestion = function(i) {
    questQuestions.splice(i, 1);
    renderStep();
  };

  window.wizardNext2 = function() {
    if(questQuestions.length === 0) return alert('נא להוסיף לפחות שאלה אחת');
    wizardStep = 3;
    renderStep();
  };

  window.selectQuestChild = function(el, childId) {
    document.querySelectorAll('#qw-children-list > div').forEach(d => {
      d.style.border = '2px solid #E0E0E0';
      d.style.background = 'white';
    });
    el.style.border = '2px solid #F59E0B';
    el.style.background = '#FFFBEB';
    _selectedChildIdForQuest = childId;
  };

  window.submitQuest = async function() {
    if(!_selectedChildIdForQuest) return alert('נא לבחור ילד');
    try {
      const res = await fetch('/api/kids/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyGroupId: currentGroup?.id,
          childUserId: parseInt(_selectedChildIdForQuest),
          title: questData.title,
          subject: questData.subject,
          description: questData.description,
          flwReward: questData.flwReward,
          passScore: questData.passScore,
          questions: questQuestions,
          createdBy: currentUser?.id
        })
      });
      const data = await res.json();
      if(data.success) {
        if(data.questId && _shareChoice && _shareChoice !== 'private'){
          const communityId = currentGroup?.communityId || currentGroup?.community_id || null;
          fetch('/api/quest-library/share', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ questId:data.questId, visibility:_shareChoice,
              communityId: _shareChoice==='community' ? communityId : null,
              userId: currentUser?.id })
          });
        }
        modal.remove();
        showToast('success', `✅ הקווסט "${questData.title}" נשלח לילד! 🎯`);
      } else {
        showToast('error', data.error || 'שגיאה ביצירת הקווסט');
      }
    } catch(e) {
      showToast('error', 'שגיאה בתקשורת');
    }
  };

  modal.innerHTML = `
    <div style="
      background:white; border-radius:24px; padding:1.5rem;
      max-width:420px; width:100%; max-height:90vh; overflow-y:auto;
    ">
      <div style="margin-bottom:0.8rem;border-bottom:1px solid rgba(0,0,0,0.08);padding-bottom:0.8rem">
        <div style="font-size:0.8rem;color:#999;margin-bottom:0.5rem">📚 בחר מהמאגר</div>
        <button onclick="openQuestLibrary()" style="width:100%;
          background:linear-gradient(135deg,#EDE9FE,#DDD6FE);
          color:#5B21B6;border:2px solid #7C3AED;border-radius:50px;
          padding:0.7rem;font-family:'Heebo',sans-serif;
          font-size:0.9rem;font-weight:700;cursor:pointer">
          🗂️ מאגר קווסטים מוכנים
        </button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2 style="font-size:1.2rem;font-weight:900">✏️ בניית קווסט</h2>
        <button onclick="document.getElementById('quest-wizard-modal').remove()"
          style="background:none;border:none;font-size:1.5rem;cursor:pointer">✕</button>
      </div>
      <div style="display:flex;gap:0.4rem;margin-bottom:1.2rem">
        ${[1,2,3].map(s => `
          <div style="flex:1;height:4px;border-radius:50px;
            background:${wizardStep>=s?'#F59E0B':'#E0E0E0'};transition:background 0.3s"></div>
        `).join('')}
      </div>
      <div id="quest-wizard-inner"></div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
  renderStep();
}

// ============================================================
// KID ACADEMY — טעינת משחקים וקווסטים מוקצים לילד
// ============================================================

async function loadKidAcademy() {
  const userId = currentUser?.id;
  if(!userId) return;

  const container = document.getElementById('kid-academy-content');
  if(!container) return;

  try {
    const [assignRes, questRes] = await Promise.all([
      fetch(`/api/kids/assignments/${userId}`),
      fetch(`/api/kids/quests/${userId}`)
    ]);
    const assignData = await assignRes.json();
    const questData  = await questRes.json();

    const assignments = assignData.assignments || [];
    const quests      = questData.quests || [];

    let html = '';

    if(assignments.length > 0) {
      html += `<div style="font-weight:700;font-size:1rem;margin-bottom:0.7rem">🎮 המשחקים שלי</div>`;
      assignments.forEach(a => {
        html += `
          <div style="
            background:linear-gradient(135deg,#EDE9FE,#DDD6FE);
            border:2px solid #7C3AED;border-radius:16px;
            padding:1rem;margin-bottom:0.7rem;
            display:flex;align-items:center;gap:0.8rem;
          ">
            <span style="font-size:2.5rem">${a.thumbnail_emoji || '🎮'}</span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:0.95rem">${a.title}</div>
              <div style="font-size:0.8rem;color:#7C3AED">
                נשארו ${a.rounds_left} סיבובים · ${a.flw_per_round} FLW לסיבוב
              </div>
            </div>
            <button onclick="openGame(${a.id},'${a.file_path}','${currentUser?.nickname}',${a.flw_per_round},${a.game_id},${a.start_level||1},${a.finance_age||'null'})"
              ${a.rounds_left <= 0 ? 'disabled' : ''}
              style="
                background:${a.rounds_left > 0 ? '#7C3AED' : '#9CA3AF'};
                color:white;border:none;border-radius:50px;
                padding:0.5rem 1rem;font-size:0.85rem;font-weight:700;
                cursor:${a.rounds_left > 0 ? 'pointer' : 'default'};
              ">${a.rounds_left > 0 ? '🎮 שחק' : 'נגמר'}</button>
          </div>
        `;
      });
    }

    if(quests.length > 0) {
      html += `<div style="font-weight:700;font-size:1rem;margin-top:1rem;margin-bottom:0.7rem">🎯 הקווסטים שלי</div>`;
      quests.forEach(q => {
        html += `
          <div style="
            background:linear-gradient(135deg,#FEF3C7,#FDE68A);
            border:2px solid #F59E0B;border-radius:16px;
            padding:1rem;margin-bottom:0.7rem;
          ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
              <div style="font-weight:700">${q.title}</div>
              <span style="background:#F59E0B;color:white;border-radius:50px;
                           padding:0.2rem 0.7rem;font-size:0.75rem;font-weight:700">
                🪙 ${q.flw_reward} FLW
              </span>
            </div>
            ${q.description ? `<div style="font-size:0.82rem;color:#92400E;margin-bottom:0.7rem">${q.description}</div>` : ''}
            <button onclick="startQuest(${q.id},'${q.title}',${q.flw_reward},${q.pass_score})"
              style="width:100%;background:#F59E0B;color:white;border:none;border-radius:50px;
                     padding:0.6rem;font-weight:700;cursor:pointer;font-size:0.9rem">
              🎯 התחל קווסט (${q.question_count} שאלות)
            </button>
          </div>
        `;
      });
    }

    if(assignments.length === 0 && quests.length === 0) {
      html = `
        <div style="text-align:center;padding:2rem;color:#999">
          <div style="font-size:3rem;margin-bottom:0.5rem">🎮</div>
          <div style="font-size:0.95rem">
            אין משחקים או קווסטים כרגע<br>
            <span style="font-size:0.85rem">ההורה יקצה לך בקרוב!</span>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  } catch(e) {
    console.error('loadKidAcademy error:', e);
  }
}

async function startQuest(questId, title, flwReward, passScore) {
  try {
    const res = await fetch(`/api/kids/quests/${questId}/questions`);
    const data = await res.json();
    const questions = data.questions || [];
    if(questions.length === 0) return alert('הקווסט ריק');
    openQuestPlayer(questId, title, questions, flwReward, passScore);
  } catch(e) {
    showToast('error', 'שגיאה בטעינת הקווסט');
  }
}

function openQuestPlayer(questId, title, questions, flwReward, passScore) {
  let currentQ = 0;
  let answers = [];

  const overlay = document.createElement('div');
  overlay.id = 'quest-player';
  overlay.style.cssText = `
    position:fixed; inset:0; background:#F0FAFA;
    z-index:9999; display:flex; flex-direction:column;
  `;

  function renderQ() {
    const q = questions[currentQ];
    const opts = q.options_json || [];
    const pct = Math.round((currentQ / questions.length) * 100);

    overlay.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#F59E0B,#D97706);
        padding:0.8rem 1rem;
        display:flex;align-items:center;justify-content:space-between;
      ">
        <span style="color:white;font-weight:700">${title}</span>
        <span style="color:white;font-size:0.85rem">${currentQ+1}/${questions.length}</span>
      </div>
      <div style="height:4px;background:#FDE68A">
        <div style="height:100%;width:${pct}%;background:#D97706;transition:width 0.4s"></div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:1.2rem;max-width:500px;margin:0 auto;width:100%">
        <div style="background:white;border-radius:20px;padding:1.5rem;text-align:center;
                    box-shadow:0 4px 16px rgba(0,0,0,0.08);margin-bottom:1rem">
          <div style="font-size:1.1rem;font-weight:700;line-height:1.5">${q.question_text}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
          ${opts.length > 0
            ? opts.map((opt, i) => `
                <button onclick="selectAnswer(this,'${opt.replace(/'/g, "\\'")}',${i})"
                  class="quest-opt-btn"
                  style="background:white;border:3px solid #E0E0E0;border-radius:16px;
                         padding:1rem 0.5rem;font-size:1rem;font-weight:700;cursor:pointer;
                         transition:all 0.2s;">${opt}</button>
              `).join('')
            : `<input id="quest-open-ans"
                 placeholder="${q.answer_type === 'number' ? 'הכנס מספר...' : 'כתוב תשובה...'}"
                 type="${q.answer_type === 'number' ? 'number' : 'text'}"
                 style="grid-column:1/-1;padding:1rem;border:3px solid #E0E0E0;
                        border-radius:16px;font-size:1.1rem;text-align:center;">`
          }
        </div>
        <button id="quest-next-btn" onclick="nextQuestQ()" style="display:none;
          width:100%;margin-top:1rem;
          background:linear-gradient(135deg,#F59E0B,#D97706);
          color:white;border:none;border-radius:50px;
          padding:0.9rem;font-size:1.1rem;font-weight:700;cursor:pointer">
          ${currentQ < questions.length - 1 ? 'הבא ←' : '🏆 סיום!'}
        </button>
      </div>
    `;
  }

  window.selectAnswer = function(btn, val) {
    document.querySelectorAll('.quest-opt-btn').forEach(b => {
      b.style.border = '3px solid #E0E0E0';
      b.style.background = 'white';
    });
    btn.style.border = '3px solid #F59E0B';
    btn.style.background = '#FEF3C7';
    answers[currentQ] = val;
    const nb = document.getElementById('quest-next-btn');
    if(nb) nb.style.display = 'block';
  };

  window.nextQuestQ = async function() {
    const openInput = document.getElementById('quest-open-ans');
    if(openInput) answers[currentQ] = openInput.value;
    if(!answers[currentQ]) return alert('נא לענות על השאלה');

    currentQ++;
    if(currentQ >= questions.length) {
      try {
        const res = await fetch(`/api/kids/quests/${questId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childUserId: currentUser?.id, answers })
        });
        const result = await res.json();
        showQuestResult(result);
      } catch(e) {
        showToast('error', 'שגיאה בשליחת התוצאות');
      }
    } else {
      renderQ();
    }
  };

  function showQuestResult(result) {
    overlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  min-height:100vh;padding:2rem;text-align:center;">
        <div style="font-size:4rem;margin-bottom:0.5rem">${result.passed ? '🏆' : '💪'}</div>
        <div style="font-size:1.8rem;font-weight:900;margin-bottom:0.5rem;
                    color:${result.passed ? '#F59E0B' : '#EF4444'}">
          ${result.passed ? 'כל הכבוד! עברת!' : 'ניסיון טוב!'}
        </div>
        <div style="font-size:1rem;color:#666;margin-bottom:1.5rem">
          ${result.correct} מתוך ${result.total} נכון (${result.score}%)
        </div>
        <div style="background:white;border-radius:20px;padding:1.5rem 2rem;
                    margin-bottom:1.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
          <div style="font-size:0.85rem;color:#999;margin-bottom:0.3rem">FLW שצברת</div>
          <div style="font-size:3rem;font-weight:900;color:#F59E0B">+${result.flwEarned} 🪙</div>
        </div>
        <button onclick="document.getElementById('quest-player').remove();if(typeof loadKidAcademy==='function')loadKidAcademy();"
          style="background:linear-gradient(135deg,#F59E0B,#D97706);color:white;border:none;
                 border-radius:50px;padding:1rem 3rem;font-size:1.2rem;font-weight:700;cursor:pointer">
          🏠 חזרה לאקדמיה
        </button>
      </div>
    `;
  }

  document.body.appendChild(overlay);
  renderQ();
}
// ─── END KIDS GAMES & QUESTS UI ──────────────────────────────────────────────

// ============================================================
// QUEST SHARE DIALOG
// ============================================================

function showQuestShareDialog(questId) {
  const dlg = document.createElement('div');
  dlg.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:7000;
    display:flex;align-items:center;justify-content:center;padding:1rem`;

  const communityId = currentGroup?.communityId || currentGroup?.community_id || null;
  const communityName = currentGroup?.communityName || currentGroup?.community_name || 'הקהילה שלי';

  dlg.innerHTML = `
    <div style="background:white;border-radius:24px;padding:1.6rem;max-width:380px;width:100%;text-align:center">
      <div style="font-size:2rem;margin-bottom:0.5rem">🎯</div>
      <h3 style="font-size:1.1rem;font-weight:900;margin-bottom:0.4rem">הקווסט נשלח בהצלחה!</h3>
      <p style="font-size:0.85rem;color:#666;margin-bottom:1.2rem">רוצה לשתף אותו כדי שהורים נוספים יוכלו להשתמש בו?</p>
      <div style="display:flex;flex-direction:column;gap:0.6rem">
        <button id="qshare-private"
          style="width:100%;background:#F3F4F6;color:#374151;border:2px solid #E5E7EB;
                 border-radius:50px;padding:0.75rem;font-size:0.9rem;font-weight:700;cursor:pointer">
          🔒 רק אני
        </button>
        ${communityId ? `
        <button id="qshare-community"
          style="width:100%;background:linear-gradient(135deg,#EDE9FE,#DDD6FE);color:#5B21B6;
                 border:2px solid #7C3AED;border-radius:50px;padding:0.75rem;font-size:0.9rem;font-weight:700;cursor:pointer">
          🏘️ לקהילה — ${communityName}
        </button>` : ''}
        <button id="qshare-public"
          style="width:100%;background:linear-gradient(135deg,#FEF3C7,#FDE68A);color:#92400E;
                 border:2px solid #F59E0B;border-radius:50px;padding:0.75rem;font-size:0.9rem;font-weight:700;cursor:pointer">
          🌍 לכל המשפחות במערכת
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(dlg);

  async function doShare(visibility, cid) {
    dlg.remove();
    if(visibility === 'private') return;
    await fetch('/api/quest-library/share', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ questId, visibility, communityId: cid || null, userId: currentUser?.id })
    });
    showToast('success', visibility === 'community'
      ? `🏘️ הקווסט שותף לקהילת ${communityName}!`
      : '🌟 תודה! הקווסט שותף לכלל המשפחות!');
  }

  dlg.querySelector('#qshare-private').onclick = () => doShare('private');
  if(communityId) dlg.querySelector('#qshare-community').onclick = () => doShare('community', communityId);
  dlg.querySelector('#qshare-public').onclick = () => doShare('public');
}

// ============================================================
// QUEST LIBRARY UI
// ============================================================

async function openQuestLibrary() {
  const overlay = document.createElement('div');
  overlay.id = 'quest-library-modal';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:6000;
    display:flex;align-items:center;justify-content:center;padding:1rem`;

  overlay.innerHTML = `
    <div style="background:white;border-radius:24px;padding:1.5rem;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2 style="font-size:1.2rem;font-weight:900">🗂️ מאגר קווסטים מוכנים</h2>
        <button onclick="document.getElementById('quest-library-modal').remove()"
          style="background:none;border:none;font-size:1.5rem;cursor:pointer">✕</button>
      </div>
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
        <select id="qlib-subject" onchange="window.filterQLib()"
          style="flex:1;padding:0.6rem;border:2px solid #E0E0E0;border-radius:12px;font-size:0.9rem">
          <option value="">כל הנושאים</option>
          <option value="math">🔢 מתמטיקה</option>
          <option value="hebrew">📖 עברית</option>
          <option value="english">🇬🇧 אנגלית</option>
          <option value="science">🔬 מדעים</option>
          <option value="general">🌟 כללי</option>
        </select>
        <select id="qlib-sort" onchange="window.filterQLib()"
          style="flex:1;padding:0.6rem;border:2px solid #E0E0E0;border-radius:12px;font-size:0.9rem">
          <option value="popular">הכי פופולרי</option>
          <option value="rating">דירוג גבוה</option>
          <option value="newest">חדש ביותר</option>
        </select>
      </div>
      <div id="qlib-list" style="min-height:200px;display:flex;align-items:center;justify-content:center">
        <div style="color:#999">טוען...</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  window.filterQLib();
}

window.filterQLib = async function() {
  const subject = document.getElementById('qlib-subject')?.value || '';
  const sort = document.getElementById('qlib-sort')?.value || 'popular';
  const listEl = document.getElementById('qlib-list');
  if(!listEl) return;
  listEl.innerHTML = '<div style="color:#999">טוען...</div>';

  try {
    const params = new URLSearchParams({ sort });
    if(subject) params.set('subject', subject);
    const res = await fetch('/api/quest-library?' + params.toString());
    const data = await res.json();
    const quests = data.quests || [];

    if(!quests.length) {
      listEl.innerHTML = '<div style="color:#999;text-align:center;padding:2rem">לא נמצאו קווסטים</div>';
      return;
    }

    const subjectEmoji = {math:'🔢',hebrew:'📖',english:'🇬🇧',science:'🔬',history:'🏛️',finance:'💰',geography:'🌍',values:'💎',music:'🎵',health:'🏃',technology:'💻',environment:'🌱',general:'🌟'};

    listEl.innerHTML = quests.map(q => `
      <div style="border:1px solid #E5E7EB;border-radius:14px;padding:0.85rem 1rem;
                  margin-bottom:0.6rem;background:white;display:flex;align-items:center;gap:0.8rem">
        <div style="font-size:1.8rem;flex-shrink:0">${subjectEmoji[q.subject]||'📚'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:0.92rem;color:#1e1b4b;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.title}</div>
          <div style="font-size:0.72rem;color:#6B7280;margin-top:0.15rem;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.description||''}</div>
          <div style="display:flex;gap:0.6rem;margin-top:0.3rem;font-size:0.7rem;color:#9CA3AF">
            <span>⭐ ${parseFloat(q.rating_avg||0).toFixed(1)}</span>
            <span>🎯 ${q.use_count||0}</span>
            <span>🪙 ${q.flw_reward} FLW</span>
            ${q.is_featured?'<span style="color:#D97706;font-weight:700">מומלץ</span>':''}
          </div>
        </div>
        <button onclick="useLibQuest(${q.id})"
          style="flex-shrink:0;background:linear-gradient(135deg,#7C3AED,#5B21B6);
                 color:white;border:none;border-radius:50px;padding:0.5rem 1rem;
                 font-size:0.8rem;font-weight:700;cursor:pointer;white-space:nowrap">
          בחר ←
        </button>
      </div>
    `).join('');
  } catch(e) {
    listEl.innerHTML = '<div style="color:#e53e3e">שגיאה בטעינת המאגר</div>';
  }
};

async function useLibQuest(questId) {
  try {
    const res = await fetch(`/api/quest-library/${questId}/questions`);
    const data = await res.json();
    if(!data.quest) return showToast('error', 'שגיאה בטעינת הקווסט');

    await fetch(`/api/quest-library/${questId}/use`, { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId: currentUser?.id }) });

    document.getElementById('quest-library-modal')?.remove();
    document.getElementById('quest-wizard-modal')?.remove();

    const quest = data.quest;
    const rawQs = data.questions || [];

    window._prefillQuestData = {
      title: quest.title,
      subject: quest.subject,
      description: quest.description || '',
      flw_reward: quest.flw_reward,
      pass_score: quest.pass_score,
      questions: rawQs.map(q => ({
        question: q.question_text,
        type: q.answer_type,
        correct: q.correct_answer,
        options: q.options_json ? (typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json) : []
      }))
    };

    setTimeout(() => {
      openQuestWizard();
      showToast('success', `📚 "${quest.title}" נטען — בחר ילד ושלח`);
    }, 100);
  } catch(e) {
    showToast('error', 'שגיאה בטעינת הקווסט');
  }
}


// ─── PWA INSTALL PROMPT ───────────────────────────────────────
(function initPwaInstall() {
    let deferredPrompt = null;
    const DISMISS_KEY = 'ofl_pwa_dismissed';

    function isIos() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent);
    }
    function isInStandaloneMode() {
        return window.navigator.standalone === true ||
               window.matchMedia('(display-mode: standalone)').matches;
    }
    function showPwaBanner(mode) {
        if (localStorage.getItem(DISMISS_KEY)) return;
        if (document.getElementById('pwa-install-banner')) return;

        let bodyHtml = '';
        if (mode === 'android') {
            bodyHtml = `<p class="text-sm text-slate-600 mb-4">הוסף את <strong>Family Flow</strong> למסך הבית כדי לגשת במהירות ולהשתמש גם ללא חיבור.</p>
                <button onclick="window._pwaDoInstall()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl text-sm transition mb-2">📲 התקן עכשיו</button>`;
        } else {
            bodyHtml = `<p class="text-sm text-slate-600 mb-3">כדי להוסיף את האפליקציה למסך הבית ב-iPhone / iPad:</p>
                <ol class="text-sm text-slate-700 space-y-2 text-right mb-4">
                    <li>1. לחץ על כפתור <strong>שתף</strong> <span class="text-blue-600">⎙</span> בסרגל Safari</li>
                    <li>2. גלול ובחר <strong>"הוסף למסך הבית"</strong></li>
                    <li>3. לחץ <strong>הוסף</strong> בפינה הימנית העליונה</li>
                </ol>`;
        }

        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:16px;background:#fff;border-top:2px solid #e2e8f0;border-radius:20px 20px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,0.18);max-width:480px;margin:0 auto;';
        banner.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <img src="/logo.png" alt="" style="height:36px;border-radius:8px;" onerror="this.style.display='none'">
                    <span class="font-black text-slate-800 text-base">Family Flow</span>
                </div>
                <button onclick="window._pwaDismiss()" style="font-size:20px;line-height:1;color:#94a3b8;background:none;border:none;cursor:pointer;">✕</button>
            </div>
            ${bodyHtml}
            <button onclick="window._pwaDismiss()" class="w-full text-xs text-slate-400 py-1">לא עכשיו</button>
        `;
        document.body.appendChild(banner);
    }

    window._pwaDoInstall = async function() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') localStorage.setItem(DISMISS_KEY, '1');
        const b = document.getElementById('pwa-install-banner');
        if (b) b.remove();
    };

    window._pwaDismiss = function() {
        localStorage.setItem(DISMISS_KEY, '1');
        const b = document.getElementById('pwa-install-banner');
        if (b) b.remove();
    };

    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(() => showPwaBanner('android'), 3000);
    });

    if (isIos() && !isInStandaloneMode()) {
        setTimeout(() => showPwaBanner('ios'), 3000);
    }
})();

// ─── WEEKLY REPORT ────────────────────────────────────────────
async function openWeeklyReport(weeksAgo=0) {
  const overlay = document.createElement('div');
  overlay.id = 'weekly-report-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:#F0F4FF;z-index:7000;overflow-y:auto;font-family:'Heebo',sans-serif`;

  overlay.innerHTML = `
    <div style="max-width:480px;margin:0 auto;padding:0 0 2rem">
      <div style="background:linear-gradient(135deg,#1E40AF,#1D4ED8);padding:1rem;position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-family:'Fredoka One',sans-serif;color:white;font-size:1.1rem">📊 דוח שבועי</div>
          <div id="report-period" style="font-size:0.72rem;color:rgba(255,255,255,0.6)">טוען...</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.4rem">
          <button onclick="openWeeklyReport(${weeksAgo+1})" style="background:rgba(255,255,255,0.15);border:none;color:white;border-radius:8px;padding:0.3rem 0.6rem;font-size:0.78rem;cursor:pointer">← שבוע קודם</button>
          ${weeksAgo>0?`<button onclick="openWeeklyReport(${weeksAgo-1})" style="background:rgba(255,255,255,0.15);border:none;color:white;border-radius:8px;padding:0.3rem 0.6rem;font-size:0.78rem;cursor:pointer">הבא →</button>`:''}
          <button onclick="document.getElementById('weekly-report-overlay').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;width:32px;height:32px;font-size:1rem;cursor:pointer">✕</button>
        </div>
      </div>
      <div id="report-content" style="padding:1rem">
        <div style="text-align:center;padding:3rem;color:#94A3B8"><div style="font-size:2rem">⏳</div><div style="margin-top:0.5rem">טוען דוח...</div></div>
      </div>
    </div>`;

  document.getElementById('weekly-report-overlay')?.remove();
  document.body.appendChild(overlay);

  try {
    const res = await fetch(`/api/family/weekly-report/${currentGroup?.id}?weeks=${weeksAgo}`);
    const data = await res.json();
    if(!data.success) throw new Error(data.error);
    const start = new Date(data.period.start);
    const end   = new Date(data.period.end);
    const fmt   = d=>`${d.getDate()}/${d.getMonth()+1}`;
    document.getElementById('report-period').textContent = `${fmt(start)} — ${fmt(end)}${weeksAgo===0?' (השבוע)':''}`;
    renderWeeklyReport(data.report);
  } catch(e){
    document.getElementById('report-content').innerHTML = `<div style="text-align:center;padding:2rem;color:#EF4444">שגיאה בטעינת הדוח</div>`;
  }
}

function renderWeeklyReport(report) {
  const subjectNames = {math:'מתמטיקה',hebrew:'עברית',english:'אנגלית',science:'מדעים',history:'היסטוריה',finance:'כלכלה',geography:'גיאוגרפיה',values:'ערכים',music:'מוזיקה',health:'בריאות',technology:'טכנולוגיה',environment:'סביבה',logic:'לוגיקה',life:'ניהול זמן',general:'כללי'};

  if(!report.length){
    document.getElementById('report-content').innerHTML = `<div style="text-align:center;padding:3rem;color:#94A3B8"><div style="font-size:3rem">👨‍👩‍👧</div><div style="margin-top:0.5rem">אין ילדים במשפחה עדיין</div></div>`;
    return;
  }

  let html = report.map(r => {
    const c = r.child;
    const delta = r.flwDelta;
    const deltaColor = delta>0?'#22C55E':delta<0?'#EF4444':'#94A3B8';
    const allScores = [...r.games.map(g=>g.avg_score||0),...r.quests.map(q=>q.score||0)];
    const avgScore = allScores.length ? Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length) : null;

    return `
    <div style="background:white;border-radius:20px;margin-bottom:1rem;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
      <div style="background:linear-gradient(135deg,#1E40AF,#4F46E5);padding:1rem;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:0.6rem">
          <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem">👦</div>
          <div>
            <div style="font-weight:900;color:white;font-size:1rem">${c.nickname}</div>
            <div style="font-size:0.72rem;color:rgba(255,255,255,0.6)">${r.games.length} משחקים · ${r.quests.length} קווסטים</div>
          </div>
        </div>
        <div style="text-align:center">
          <div style="font-family:'Fredoka One',sans-serif;font-size:1.8rem;color:#FFD600;line-height:1">${r.flwWeek}</div>
          <div style="font-size:0.65rem;color:rgba(255,255,255,0.6)">FLW השבוע</div>
          <div style="font-size:0.72rem;font-weight:700;color:${deltaColor}">${delta>0?'+'+delta:delta} vs שבוע קודם</div>
        </div>
      </div>
      <div style="padding:0.9rem">
        ${avgScore!==null?`
        <div style="display:flex;align-items:center;gap:0.5rem;background:#F8FAFF;border-radius:12px;padding:0.6rem 0.8rem;margin-bottom:0.8rem">
          <div style="font-size:1.4rem">${avgScore>=80?'🏆':avgScore>=60?'⭐':'💪'}</div>
          <div style="flex:1">
            <div style="font-size:0.7rem;color:#94A3B8;font-weight:700">ציון ממוצע השבוע</div>
            <div style="height:6px;background:#E0E0E0;border-radius:50px;margin-top:0.25rem;overflow:hidden">
              <div style="height:100%;width:${avgScore}%;border-radius:50px;background:${avgScore>=80?'#22C55E':avgScore>=60?'#F59E0B':'#EF4444'}"></div>
            </div>
          </div>
          <div style="font-family:'Fredoka One',sans-serif;font-size:1.2rem;color:${avgScore>=80?'#22C55E':avgScore>=60?'#F59E0B':'#EF4444'}">${avgScore}%</div>
        </div>`:''}
        ${r.games.length?`
        <div style="margin-bottom:0.8rem">
          <div style="font-size:0.72rem;font-weight:700;color:#64748B;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.05em">🎮 משחקים</div>
          ${r.games.map(g=>`
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid #F5F5F5">
            <span style="font-size:1.2rem">${g.thumbnail_emoji||'🎮'}</span>
            <div style="flex:1"><div style="font-size:0.82rem;font-weight:700">${g.title}</div><div style="font-size:0.68rem;color:#94A3B8">${g.plays} פעמים</div></div>
            <div style="text-align:left"><div style="font-size:0.78rem;font-weight:700;color:${g.avg_score>=80?'#22C55E':g.avg_score>=60?'#F59E0B':'#EF4444'}">${g.avg_score||0}%</div><div style="font-size:0.65rem;color:#94A3B8">🪙${g.flw_earned||0}</div></div>
          </div>`).join('')}
        </div>`:`<div style="font-size:0.82rem;color:#94A3B8;text-align:center;padding:0.5rem;margin-bottom:0.8rem">לא שיחק השבוע</div>`}
        ${r.quests.length?`
        <div style="margin-bottom:0.8rem">
          <div style="font-size:0.72rem;font-weight:700;color:#64748B;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.05em">🎯 קווסטים</div>
          ${r.quests.map(q=>`
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid #F5F5F5">
            <span>${q.score>=80?'✅':'📊'}</span>
            <div style="flex:1"><div style="font-size:0.82rem;font-weight:700">${q.title}</div><div style="font-size:0.68rem;color:#94A3B8">${subjectNames[q.subject]||q.subject}</div></div>
            <div style="font-size:0.82rem;font-weight:700;color:${q.score>=80?'#22C55E':q.score>=60?'#F59E0B':'#EF4444'}">${q.score}%</div>
          </div>`).join('')}
        </div>`:''}
        ${r.subjects.length?`
        <div style="margin-bottom:0.8rem">
          <div style="font-size:0.72rem;font-weight:700;color:#64748B;margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em">📈 לפי נושא</div>
          ${r.subjects.map(s=>`
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem">
            <div style="font-size:0.72rem;color:#64748B;width:68px;text-align:right;flex-shrink:0">${subjectNames[s.subject]||s.subject}</div>
            <div style="flex:1;height:6px;background:#F0F0F0;border-radius:50px;overflow:hidden"><div style="height:100%;width:${s.avg}%;border-radius:50px;background:${s.avg>=80?'#22C55E':s.avg>=60?'#F59E0B':'#EF4444'}"></div></div>
            <div style="font-size:0.72rem;font-weight:700;width:28px;color:${s.avg>=80?'#22C55E':s.avg>=60?'#F59E0B':'#EF4444'}">${s.avg}%</div>
          </div>`).join('')}
        </div>`:''}
        ${r.recommendations.length?`
        <div style="border-top:1px solid #F0F0F0;padding-top:0.8rem">
          <div style="font-size:0.72rem;font-weight:700;color:#64748B;margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em">💡 המלצות לפעולה</div>
          ${r.recommendations.map(rec=>`
          <div style="display:flex;align-items:flex-start;gap:0.4rem;padding:0.5rem 0.7rem;border-radius:10px;margin-bottom:0.4rem;background:${rec.type==='good'?'#F0FDF4':rec.type==='warn'?'#FFF7ED':'#EFF6FF'}">
            <span style="flex-shrink:0">${rec.type==='good'?'✅':rec.type==='warn'?'⚠️':'💡'}</span>
            <div style="font-size:0.82rem;font-weight:700;color:${rec.type==='good'?'#16A34A':rec.type==='warn'?'#D97706':'#1D4ED8'}">${rec.text}</div>
          </div>`).join('')}
        </div>`:''}
      </div>
    </div>`;
  }).join('');

  document.getElementById('report-content').innerHTML = html;
}

// ===== COMMUNITY FEED =====

const feedState = {
  page: 1,
  communityId: null,
  groupId: null,
  loading: false,
  hasMore: true,
  selectedPostType: 'general',
  newPostImageUrl: null,
  cachedHTML: '',   // שמירת HTML הפוסטים בין מעברי טאבים
};

async function loadFeedSection(forceReload = false) {
  const list = document.getElementById('feed-posts-list');
  // אם יש cache — שחזר מיד ואל תטעין מחדש
  if (!forceReload && feedState.cachedHTML) {
    if (list) list.innerHTML = feedState.cachedHTML;
    renderFeedCommunityFilters();
    return;
  }
  feedState.page = 1;
  feedState.hasMore = true;
  feedState.cachedHTML = '';
  if (list) list.innerHTML = '';
  renderFeedCommunityFilters();
  await fetchFeedPosts(true);
}

function renderFeedCommunityFilters() {
  const container = document.getElementById('feed-community-filter');
  if (!container) return;
  const comms = myConnectedCommunitiesCache || currentCommunities || [];
  if (!comms.length) return;

  const allBtn = document.getElementById('feed-filter-all');
  container.innerHTML = '';
  if (allBtn) container.appendChild(allBtn);

  comms.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'feed-filter-btn';
    btn.textContent = c.name;
    btn.style.cssText = 'background:#F3F4F6;color:#555;border:none;border-radius:50px;padding:0.25rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap';
    btn.onclick = () => setFeedFilter('community', c.id);
    container.appendChild(btn);
    loadGroupFilters(c.id);
  });
}

async function loadGroupFilters(communityId) {
  try {
    const res = await fetch(`${API}/community/${communityId}/groups?familyId=${currentGroup?.id}`);
    const data = await res.json();
    const container = document.getElementById('feed-group-filter');
    if (!container || !data.groups?.length) return;
    data.groups.forEach(g => {
      if (document.getElementById(`gf-${g.id}`)) return;
      const btn = document.createElement('button');
      btn.id = `gf-${g.id}`;
      btn.className = 'feed-filter-btn';
      btn.textContent = `${g.icon_emoji} ${g.name}`;
      btn.style.cssText = 'background:#F3F4F6;color:#555;border:none;border-radius:50px;padding:0.2rem 0.7rem;font-size:0.72rem;font-weight:700;cursor:pointer;white-space:nowrap';
      btn.onclick = () => setFeedFilter('group', g.id);
      container.appendChild(btn);
    });
  } catch(e) {}
}

function setFeedFilter(type, id) {
  if (type === 'community') {
    feedState.communityId = id;
    feedState.groupId = null;
    document.querySelectorAll('.feed-filter-btn').forEach(b => {
      b.style.background = '#F3F4F6';
      b.style.color = '#555';
    });
    const comms = myConnectedCommunitiesCache || currentCommunities || [];
    const btn = id
      ? [...document.querySelectorAll('.feed-filter-btn')].find(b => b.textContent.trim() === comms.find(c => c.id == id)?.name)
      : document.getElementById('feed-filter-all');
    if (btn) { btn.style.background = '#1D4ED8'; btn.style.color = 'white'; }
  } else {
    feedState.groupId = id;
  }
  feedState.page = 1;
  const list = document.getElementById('feed-posts-list');
  if (list) list.innerHTML = '';
  fetchFeedPosts(true);
}

async function fetchFeedPosts(reset = false) {
  if (feedState.loading) return;
  feedState.loading = true;
  const params = new URLSearchParams({
    familyId: currentGroup?.id,
    page: feedState.page,
    limit: 15,
    ...(feedState.communityId ? { communityId: feedState.communityId } : {}),
    ...(feedState.groupId ? { groupId: feedState.groupId } : {}),
  });
  try {
    const res = await fetch(`${API}/community/feed?${params}`);
    const data = await res.json();
    if (!data.success) return;
    const list = document.getElementById('feed-posts-list');
    if (!list) return;
    if (reset) list.innerHTML = '';
    if (!data.posts.length && reset) {
      list.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:2rem 1rem;font-size:0.85rem">אין פוסטים בפיד עדיין.<br>היו ראשונים לפרסם! ✨</div>';
    }
    data.posts.forEach(post => list.insertAdjacentHTML('beforeend', renderPostCard(post)));
    feedState.hasMore = data.hasMore;
    feedState.page++;
    feedState.cachedHTML = list.innerHTML;
    const loadMore = document.getElementById('feed-load-more');
    if (loadMore) loadMore.style.display = data.hasMore ? 'block' : 'none';
  } catch(e) { console.error('Feed error:', e); }
  finally { feedState.loading = false; }
}

function renderPostCard(post) {
  const typeConfig = {
    general:        { icon:'💬', color:'#64748B', label:'כללי' },
    question:       { icon:'❓', color:'#2563EB', label:'שאלה' },
    deal:           { icon:'🏷️', color:'#16A34A', label:'מבצע' },
    event:          { icon:'📅', color:'#EA580C', label:'אירוע' },
    recommendation: { icon:'⭐', color:'#7C3AED', label:'המלצה' },
    promo:          { icon:'🏪', color:'#B45309', label:'מבצע עסקי' },
  };
  const t = typeConfig[post.post_type] || typeConfig.general;
  const isPromo = post.post_type === 'promo';
  const timeAgo = formatTimeAgo(post.created_at);

  return `
  <div class="feed-post-card" data-post-id="${post.id}"
    style="background:white;border-radius:16px;margin-bottom:0.8rem;overflow:hidden;
      box-shadow:0 1px 6px rgba(0,0,0,0.07);
      ${isPromo ? 'border:2px solid #F59E0B;' : 'border:1px solid #F0F0F0;'}">
    <div style="padding:0.8rem 0.9rem 0.4rem;display:flex;align-items:center;gap:0.5rem">
      <div style="width:36px;height:36px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">
        ${post.author_avatar ? `<img src="${post.author_avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : '👨‍👩‍👧'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:0.85rem;color:#111">${post.is_pinned ? '📌 ' : ''}${escHtml(post.author_name)}</div>
        ${(post.author_user_name || post.publisher_name) ? `<div style="font-size:0.72rem;color:#475569;font-weight:600">✍️ ${escHtml(post.author_user_name || post.publisher_name)}</div>` : ''}
        <div style="font-size:0.7rem;color:#94A3B8">${post.community_name} · ${timeAgo}${post.group_name ? ` · <span style="color:#7C3AED">${post.group_icon||''}${post.group_name}</span>` : ''}</div>
      </div>
      <div style="background:${t.color}15;color:${t.color};border-radius:50px;padding:0.15rem 0.5rem;font-size:0.68rem;font-weight:700;white-space:nowrap">${t.icon} ${t.label}</div>
    </div>
    <div style="padding:0.3rem 0.9rem 0.6rem;font-size:0.9rem;line-height:1.55;color:#1E293B">${escHtml(post.content)}</div>
    ${post.image_url ? `<div style="padding:0 0.9rem 0.6rem"><img src="${post.image_url}" alt="" style="width:100%;border-radius:12px;max-height:280px;object-fit:cover"></div>` : ''}
    <div style="padding:0.5rem 0.9rem 0.7rem;border-top:1px solid #F5F5F5;display:flex;align-items:center;gap:0">
      <button onclick="toggleFeedLike(${post.id},this)" data-liked="${post.liked_by_me}"
        style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:0.3rem;padding:0.4rem 0.6rem;border-radius:8px;color:${post.liked_by_me ? '#EF4444' : '#64748B'};font-size:0.82rem;font-weight:700;transition:all 0.15s">
        ${post.liked_by_me ? '❤️' : '🤍'} ${post.likes_count}
      </button>
      <button onclick="openFeedComments(${post.id})"
        style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:0.3rem;padding:0.4rem 0.6rem;border-radius:8px;color:#64748B;font-size:0.82rem;font-weight:700">
        💬 ${post.comments_count}
      </button>
      <button onclick="shareFeedPost(${post.id})"
        style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:0.3rem;padding:0.4rem 0.6rem;border-radius:8px;color:#64748B;font-size:0.82rem;font-weight:700">
        ↗️ ${post.shares_count || 0}
      </button>
      <button onclick="reportFeedPost(${post.id})"
        style="background:none;border:none;cursor:pointer;margin-right:auto;padding:0.4rem 0.5rem;color:#CBD5E1;font-size:0.82rem">
        🚩
      </button>
    </div>
  </div>`;
}

async function toggleFeedLike(postId, btn) {
  try {
    const res = await fetch(`${API}/community/posts/${postId}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: currentGroup?.id })
    });
    const data = await res.json();
    if (data.success) {
      btn.dataset.liked = data.liked;
      const count = parseInt(btn.textContent.match(/\d+/)?.[0] || 0);
      btn.innerHTML = `${data.liked ? '❤️' : '🤍'} ${data.liked ? count + 1 : Math.max(0, count - 1)}`;
      btn.style.color = data.liked ? '#EF4444' : '#64748B';
    }
  } catch(e) {}
}

async function openFeedComments(postId) {
  const existing = document.getElementById('comments-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'comments-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:5500;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:80vh;display:flex;flex-direction:column">
      <div style="padding:0.9rem 1rem;border-bottom:1px solid #F0F0F0;display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:900;font-size:0.95rem">💬 תגובות</div>
        <button onclick="document.getElementById('comments-modal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <div id="comments-list" style="overflow-y:auto;flex:1;padding:0.8rem"><div style="text-align:center;color:#94A3B8;padding:1rem">טוען...</div></div>
      <div style="padding:0.7rem;border-top:1px solid #F0F0F0;display:flex;gap:0.4rem">
        <input id="comment-input" placeholder="כתוב תגובה..." style="flex:1;padding:0.6rem 0.9rem;border:1.5px solid #E0E0E0;border-radius:50px;font-family:'Heebo',sans-serif;font-size:0.88rem;outline:none">
        <button onclick="submitComment(${postId})" style="background:#1D4ED8;color:white;border:none;border-radius:50px;padding:0.6rem 1rem;font-weight:700;cursor:pointer;font-size:0.85rem">שלח</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  try {
    const res = await fetch(`${API}/community/posts/${postId}/comments`);
    const data = await res.json();
    const list = document.getElementById('comments-list');
    if (!list) return;
    if (!data.comments?.length) {
      list.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:1rem">אין תגובות עדיין. היו ראשונים!</div>';
      return;
    }
    list.innerHTML = data.comments.map(c => `
      <div style="margin-bottom:0.8rem">
        <div style="display:flex;gap:0.5rem;align-items:flex-start">
          <div style="width:30px;height:30px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0">👤</div>
          <div style="flex:1;background:#F8FAFF;border-radius:12px;padding:0.5rem 0.7rem">
            <div style="font-weight:700;font-size:0.78rem;color:#1D4ED8;margin-bottom:0.05rem">${escHtml(c.author_name)}</div>
            ${c.author_user_name ? `<div style="font-size:0.68rem;color:#64748B;margin-bottom:0.1rem">✍️ ${escHtml(c.author_user_name)}</div>` : ''}
            <div style="font-size:0.85rem;color:#1E293B">${escHtml(c.content)}</div>
          </div>
        </div>
      </div>`).join('');
  } catch(e) {
    const list = document.getElementById('comments-list');
    if (list) list.innerHTML = '<div style="text-align:center;color:#EF4444">שגיאה בטעינת תגובות</div>';
  }
}

async function submitComment(postId) {
  const input = document.getElementById('comment-input');
  const content = input?.value?.trim();
  if (!content) return;
  try {
    await fetch(`${API}/community/posts/${postId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: currentGroup?.id, userId: currentUser?.id, content })
    });
    input.value = '';
    openFeedComments(postId);
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) {
      const commentBtn = [...card.querySelectorAll('button')].find(b => b.textContent.includes('💬'));
      if (commentBtn) {
        const n = parseInt(commentBtn.textContent.match(/\d+/)?.[0] || 0);
        commentBtn.textContent = `💬 ${n + 1}`;
      }
    }
  } catch(e) {}
}

async function shareFeedPost(postId) {
  const comms = myConnectedCommunitiesCache || currentCommunities || [];
  const other = comms.filter(c => c.id !== feedState.communityId);
  if (!other.length) { showToast('info', 'אין קהילות נוספות לשתף אליהן'); return; }
  const names = other.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
  const idx = parseInt(prompt(`לאיזו קהילה לשתף?\n${names}`));
  if (!idx || idx < 1 || idx > other.length) return;
  try {
    await fetch(`${API}/community/posts/${postId}/share`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: currentGroup?.id, targetCommunityId: other[idx - 1].id })
    });
    showToast('success', 'הפוסט שותף בהצלחה! ↗️');
  } catch(e) {}
}

async function reportFeedPost(postId) {
  const reason = prompt('מה הסיבה לדיווח?\n(אופציונלי)');
  if (reason === null) return;
  try {
    await fetch(`${API}/community/posts/${postId}/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: currentGroup?.id, reason })
    });
    showToast('info', 'הדיווח התקבל. נבדוק בהקדם.');
  } catch(e) {}
}

function openNewPostModal() {
  const modal = document.getElementById('new-post-modal');
  if (!modal) return;
  const sel = document.getElementById('new-post-community');
  const comms = myConnectedCommunitiesCache || currentCommunities || [];
  if (sel) sel.innerHTML = comms.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  feedState.selectedPostType = 'general';
  feedState.newPostImageUrl = null;
  const contentEl = document.getElementById('new-post-content');
  if (contentEl) contentEl.value = '';
  const preview = document.getElementById('post-image-preview');
  if (preview) preview.innerHTML = '';
  document.querySelectorAll('.post-type-btn').forEach((b, i) => {
    b.style.background = i === 0 ? '#EFF6FF' : '#F9FAFB';
    b.style.color = i === 0 ? '#1D4ED8' : '#555';
    b.style.borderColor = i === 0 ? '#1D4ED8' : '#E0E0E0';
  });
  modal.style.display = 'flex';
}

function closeNewPostModal() {
  const modal = document.getElementById('new-post-modal');
  if (modal) modal.style.display = 'none';
}

function selectPostType(btn, type) {
  feedState.selectedPostType = type;
  document.querySelectorAll('.post-type-btn').forEach(b => {
    b.style.background = '#F9FAFB'; b.style.color = '#555'; b.style.borderColor = '#E0E0E0';
  });
  btn.style.background = '#EFF6FF'; btn.style.color = '#1D4ED8'; btn.style.borderColor = '#1D4ED8';
}

function previewPostImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    feedState.newPostImageUrl = e.target.result;
    const preview = document.getElementById('post-image-preview');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" style="max-height:120px;border-radius:8px;margin-top:0.3rem">`;
  };
  reader.readAsDataURL(file);
}

async function submitNewPost() {
  const content = document.getElementById('new-post-content')?.value?.trim();
  const communityId = document.getElementById('new-post-community')?.value;
  if (!content) { showToast('error', 'כתוב משהו לפני פרסום'); return; }
  if (!communityId) { showToast('error', 'בחר קהילה'); return; }
  try {
    const res = await fetch(`${API}/community/posts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyId: currentGroup?.id,
        userId: currentUser?.id,
        communityId: parseInt(communityId),
        postType: feedState.selectedPostType,
        content,
        imageUrl: feedState.newPostImageUrl || null,
      })
    });
    const data = await res.json();
    if (data.success) {
      closeNewPostModal();
      showToast('success', 'הפוסט פורסם! +3 Flw 🎉');
      const comms = myConnectedCommunitiesCache || currentCommunities || [];
      const list = document.getElementById('feed-posts-list');
      const postMatchesFilter = !feedState.communityId || feedState.communityId == parseInt(communityId);
      if (list && postMatchesFilter) {
        list.insertAdjacentHTML('afterbegin', renderPostCard({
          ...data.post,
          author_name: fmtGroupName(currentGroup) || 'המשפחה שלי',
          author_avatar: currentGroup?.image_url || currentGroup?.logo_url || null,
          author_user_name: fmtUserName(currentUser) || currentUser?.nickname || '',
          publisher_name: '',
          community_name: comms.find(c => c.id == communityId)?.name || '',
          liked_by_me: false,
        }));
        feedState.cachedHTML = list.innerHTML;
      } else if (list) {
        // הפוסט פורסם לקהילה אחרת מהמסנן הפעיל — טוען מחדש
        loadFeedSection(true);
      }
    } else { showToast('error', data.error || 'שגיאה בפרסום'); }
  } catch(e) { showToast('error', 'שגיאה בפרסום'); }
}

function loadMoreFeedPosts() { fetchFeedPosts(false); }

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTimeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'עכשיו';
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
  return `לפני ${Math.floor(diff / 86400)} ימים`;
}

// ===== END COMMUNITY FEED =====
