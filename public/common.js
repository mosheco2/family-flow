// ==========================================
// Oneflow - Core & Common Functionality
// ==========================================

let API = '/api';
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
    API = 'http://localhost:3000/api';
}

// Global State
let currentUser = null; 
let currentGroup = null; 
let saToken = null; 
let saAllGroups = []; 
let saAllUsers = [];
let deferredPrompt = null;
let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

const userColors = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100', 'bg-pink-50 border-pink-100'];

// ==========================================
// Initialization & Routing
// ==========================================

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

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
    const inviteCode = urlParams.get('code'); 
    const inviteRole = urlParams.get('role');
    
    if (inviteCode) { 
        document.getElementById('join-code').value = inviteCode; 
        if(inviteRole) document.getElementById('join-role').value = inviteRole; 
        clearTimeout(failsafeTimer); 
        hidePreloaderAndShowAuth('join'); 
        return; 
    }
    
    const savedSAToken = localStorage.getItem('ofl_sa_token');
    if (savedSAToken) {
        saToken = savedSAToken; 
        clearTimeout(failsafeTimer); 
        document.getElementById('auth-container').classList.add('hidden'); 
        document.getElementById('sa-dashboard-container').classList.remove('hidden');
        const preloader = document.getElementById('app-preloader'); 
        if (preloader) { 
            preloader.classList.add('opacity-0', 'pointer-events-none'); 
            setTimeout(() => preloader.classList.add('hidden'), 700); 
        }
        loadSAData(); 
        return;
    }

    const saved = localStorage.getItem('ofl_session'); 
    if(saved) { 
        try { 
            const session = JSON.parse(saved); 
            if(session && session.user && session.user.id) { 
                currentUser = session.user; 
                currentGroup = session.group; 
                clearTimeout(failsafeTimer); 
                routeAppBasedOnType(); 
                return; 
            }
        } catch(e) { localStorage.removeItem('ofl_session'); } 
    }
    
    clearTimeout(failsafeTimer); 
    hidePreloaderAndShowAuth('login');
};

function routeAppBasedOnType() {
    const isBusinessPage = window.location.pathname.includes('business.html');
    
    if (currentGroup && currentGroup.type === 'BUSINESS') {
        if (isBusinessPage) {
            if (typeof loadBusinessDashboard === 'function') {
                loadBusinessDashboard();
            } else {
                console.error("loadBusinessDashboard missing");
                showToast('error', 'שגיאה בטעינת המודול העסקי');
                hidePreloaderAndShowAuth('login');
            }
        } else {
            window.location.href = '/business.html'; 
        }
    } else {
        if (!isBusinessPage) {
            if (typeof loadFamilyDashboard === 'function') {
                loadFamilyDashboard();
            } else {
                console.error("loadFamilyDashboard missing");
                showToast('error', 'שגיאה בטעינת מודול המשפחות');
                hidePreloaderAndShowAuth('login');
            }
        } else {
            window.location.href = '/index.html'; 
        }
    }
}

// ==========================================
// UI Helpers & Utilities
// ==========================================

function val(id) { 
    const el = document.getElementById(id);
    return el ? el.value : ''; 
}

function showToast(t, m) { 
    const el = document.getElementById('toast'); 
    if (!el) { console.warn('Toast Message:', m); return; } 
    const icon = document.getElementById('toast-icon'); 
    el.classList.remove('hidden'); 
    document.getElementById('toast-message').innerText = m; 
    if (icon) icon.className = t === 'success' ? 'fa-solid fa-check text-green-400' : 'fa-solid fa-xmark text-red-400'; 
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
    if(typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); 
}

function triggerShake() { 
    const app = document.getElementById('main-wrapper'); 
    if(app) {
        app.classList.add('shake-effect'); 
        setTimeout(() => app.classList.remove('shake-effect'), 500); 
    }
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

function openAlertModal(title, text) { 
    const titleEl = document.getElementById('generic-alert-title'); 
    const textEl = document.getElementById('generic-alert-text'); 
    const modal = document.getElementById('generic-alert-modal'); 
    if(titleEl && textEl && modal) { titleEl.innerText = title; textEl.innerText = text; modal.classList.remove('hidden'); } 
}

function openTosModal(e, docKey) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const modal = document.getElementById('tos-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    const contentEl = document.getElementById('tos-modal-content');
    if(!contentEl) return;
    const key = docKey || (window._tosDocKey || 'legal_tos_family');
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
    contentEl.innerHTML = '<p class="text-slate-400 text-center py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</p>';
    fetch(`${API_BASE}/public/legal/${key}`)
        .then(r => r.json())
        .then(data => {
            if(data.success && data.content) {
                contentEl.innerHTML = data.content;
            } else {
                contentEl.innerHTML = '<p class="text-slate-400 text-center py-4">לא נמצא תוכן למסמך זה.</p>';
            }
        })
        .catch(() => {
            contentEl.innerHTML = '<p class="text-red-400 text-center py-4">שגיאה בטעינת המסמך.</p>';
        });
}
function closeTosModal() { const modal = document.getElementById('tos-modal'); if(modal) modal.classList.add('hidden'); }

// ==========================================
// PWA & Welcome Screen
// ==========================================

function setupPwaInstallSection() {
    const section = document.getElementById('pwa-install-section'); 
    const iosDiv = document.getElementById('pwa-ios-instructions'); 
    const androidDiv = document.getElementById('pwa-android-instructions'); 
    const btnInstall = document.getElementById('btn-install-pwa');
    if(!section || !iosDiv || !androidDiv || !btnInstall) return;
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) { section.classList.add('hidden'); return; }
    
    section.classList.remove('hidden');
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    if (isIOS) { 
        iosDiv.classList.remove('hidden'); androidDiv.classList.add('hidden'); 
    } else {
        iosDiv.classList.add('hidden'); androidDiv.classList.remove('hidden');
        btnInstall.onclick = async () => {
            if (deferredPrompt) { 
                deferredPrompt.prompt(); 
                const { outcome } = await deferredPrompt.userChoice; 
                if (outcome === 'accepted') section.classList.add('hidden'); 
                deferredPrompt = null; 
            } else showToast('info', 'כדי להתקין, פתחו את תפריט הדפדפן ובחרו "התקן אפליקציה".');
        };
    }
}

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome`); 
        const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) { 
                const textEl = document.getElementById('welcome-modal-text');
                const modalEl = document.getElementById('welcome-modal');
                if(textEl && modalEl) {
                    textEl.innerText = data.message; 
                    setupPwaInstallSection(); 
                    modalEl.classList.remove('hidden'); 
                    window.pendingWelcomeMsg = data.message; 
                    return true; 
                }
            }
        }
    } catch(e) {} 
    return false;
}

function closeWelcomeModal() { 
    const modal = document.getElementById('welcome-modal');
    if(modal) modal.classList.add('hidden'); 
    if (window.pendingWelcomeMsg) { 
        localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg); 
    } 
    if (typeof checkAndStartTour === 'function') {
        checkAndStartTour(window.forceTourStart || false); 
    }
    window.forceTourStart = false; 
}

// ==========================================
// Authentication
// ==========================================

function hidePreloaderAndShowAuth(view = 'login') {
    const authCont = document.getElementById('auth-container');
    if(authCont) authCont.classList.remove('hidden'); 
    switchView(view);
    const preloader = document.getElementById('app-preloader');
    if (preloader) { 
        preloader.classList.add('opacity-0', 'pointer-events-none'); 
        setTimeout(() => preloader.classList.add('hidden'), 700); 
    }
}

function switchView(view) { 
    ['login','create','join', 'sa-login'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    }); 
    const target = document.getElementById(`view-${view}`);
    if(target) target.classList.remove('hidden'); 
}

function selectType(t) { 
    document.getElementById('create-type').value=t; 
    document.getElementById('type-family').className=`flex-1 p-4 rounded-2xl border-2 text-center transition ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold hover:bg-slate-50'}`; 
    document.getElementById('type-business').className=`flex-1 p-4 rounded-2xl border-2 text-center transition ${t==='BUSINESS'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400 font-bold hover:bg-slate-50'}`; 
}

async function handleLogin(e) { 
    e.preventDefault(); 
    window.forceTourStart = false; 
    authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }, 'login'); 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    const tos = document.getElementById('create-tos');
    if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    
    const marketing = document.getElementById('create-marketing');
    const marketingConsent = marketing ? marketing.checked : false;

    window.forceTourStart = true; 
    authAction('groups', { 
        type: val('create-type'), 
        groupName: val('create-group-name'), 
        adminEmail: val('create-email'), 
        adminNickname: val('create-nickname'), 
        birthYear: val('create-year'), 
        password: val('create-password'),
        marketingConsent: marketingConsent
    }, 'create'); 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    const tos = document.getElementById('join-tos');
    if(tos && !tos.checked) return showToast('error', 'יש לאשר את התקנון כדי להמשיך'); 
    
    window.forceTourStart = true; 
    toggleLoader('join', true);
    try {
        const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: val('join-role'), nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
        const d = await res.json(); 
        if(d.success) { 
            showToast('success', 'בקשתך נשלחה בהצלחה! יש להמתין לאישור מנהל הסביבה.'); 
            window.history.replaceState({}, document.title, window.location.pathname); 
            switchView('login'); 
        } else showToast('error', d.error); 
    } catch(err) {
        showToast('error', 'שגיאת תקשורת: ' + err.message);
    } finally {
        toggleLoader('join', false);
    }
}

async function authAction(endpoint, body, loaderId = 'login') { 
    toggleLoader(loaderId, true); 
    try { 
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); 
        const data = await res.json(); 
        if(data.success) { 
            currentUser = data.user; 
            currentGroup = data.group; 
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup})); 
            routeAppBasedOnType(); 
        } else {
            showToast('error', data.error); 
        }
    } catch(e) { 
        console.error('Auth Error:', e);
        showToast('error', 'שגיאה בחיבור לשרת: ' + e.message); 
    } finally { 
        toggleLoader(loaderId, false); 
    } 
}

function logout() { localStorage.removeItem('ofl_session'); location.reload(); }

// ==========================================
// Accessibility
// ==========================================

function initAccessibility() { const saved = localStorage.getItem('ofl_accessibility'); if(saved) { try { accState = JSON.parse(saved); applyAccessibility(); } catch(e) {} } }
function applyAccessibility() {
    Object.keys(accState).forEach(key => {
        const btn = document.getElementById(`acc-${key}`);
        if(accState[key]) { 
            document.body.classList.add(`acc-${key}`); 
            if(btn) { btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700'); } 
        } else { 
            document.body.classList.remove(`acc-${key}`); 
            if(btn) { btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-700'); btn.classList.add('border-slate-200', 'bg-slate-50', 'text-slate-700'); } 
        }
    });
    localStorage.setItem('ofl_accessibility', JSON.stringify(accState));
}
function toggleAccess(key) { accState[key] = !accState[key]; applyAccessibility(); }
function resetAccessibility() { Object.keys(accState).forEach(k => accState[k] = false); applyAccessibility(); showToast('success', 'הגדרות הנגישות אופסו'); closeAccessibilityModal(); }
function openAccessibilityModal() { const el = document.getElementById('accessibility-modal'); if(el) el.classList.remove('hidden'); }
function closeAccessibilityModal() { const el = document.getElementById('accessibility-modal'); if(el) el.classList.add('hidden'); }

// ==========================================
// Super Admin & Banners
// ==========================================

async function handleSALogin(e) {
    e.preventDefault();
    toggleLoader('sa-login', true);
    try {
        const res = await fetch(`${API}/superadmin/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: val('sa-code'), password: val('sa-password')}) }); 
        const data = await res.json();
        if(data.success) { 
            saToken = data.token; 
            localStorage.setItem('ofl_sa_token', saToken); 
            document.getElementById('auth-container').classList.add('hidden'); 
            document.getElementById('sa-dashboard-container').classList.remove('hidden'); 
            loadSAData(); 
        } else { showToast('error', data.error); }
    } catch(err) { showToast('error', 'שגיאת תקשורת מול השרת: ' + err.message); }
    finally { toggleLoader('sa-login', false); }
}

function logoutSA() { 
    saToken = null; 
    localStorage.removeItem('ofl_sa_token'); 
    document.getElementById('sa-dashboard-container').classList.add('hidden'); 
    document.getElementById('auth-container').classList.remove('hidden'); 
    switchView('login'); 
}

async function loadSAData() {
    fetchBanners();
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }}); 
        const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);
        
        const wMsg = document.getElementById('sa-welcome-msg');
        if(wMsg) wMsg.value = data.welcomeMsg || '';

        saAllGroups = data.groups || []; 
        saAllUsers = data.users || []; 

        const families = saAllGroups.filter(g => g.type !== 'BUSINESS');
        const businesses = saAllGroups.filter(g => g.type === 'BUSINESS');
        
        if(document.getElementById('sa-stat-families')) document.getElementById('sa-stat-families').innerText = families.length;
        if(document.getElementById('sa-stat-businesses')) document.getElementById('sa-stat-businesses').innerText = businesses.length;
        if(document.getElementById('sa-stat-fam-users')) document.getElementById('sa-stat-fam-users').innerText = saAllUsers.filter(u => families.some(f => f.id === u.group_id)).length;
        if(document.getElementById('sa-stat-biz-users')) document.getElementById('sa-stat-biz-users').innerText = saAllUsers.filter(u => businesses.some(b => b.id === u.group_id)).length;

        renderSAGroups();
    } catch(e) { showToast('error', 'שגיאה בטעינת נתוני ניהול: ' + e.message); }
}

function renderSAGroups(filterText = '') {
    const groupsList = document.getElementById('sa-groups-list'); 
    if(!groupsList) return;
    
    let gHtml = ''; 
    const term = filterText.toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    
    if(filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו סביבות התואמות לחיפוש.</p>'; return; }
    
    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `<div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm"><span>${u.nickname} <span class="text-[10px] text-slate-400">(${u.role})</span></span><button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm"><i class="fa-solid fa-trash"></i></button></div>`).join('');
        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים בסביבה זו.</p>';
        
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">Pro</span>' : '';
        const groupTypeBadge = g.type === 'BUSINESS' ? '<span class="bg-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">עסק</span>' : '<span class="bg-purple-100 text-purple-700 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">משפחה</span>';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        const proToggleBtn = g.is_premium ? `<button onclick="saTogglePremium(${g.id}, false)" class="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-crown"></i> בטל Pro</button>` : `<button onclick="saTogglePremium(${g.id}, true)" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded text-[10px] font-bold hover:opacity-90 transition"><i class="fa-solid fa-crown"></i> הפעל Pro</button>`;
        
        gHtml += `<div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm"><div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')"><div class="flex items-center"><div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid fa-users"></i></div><div><h3 class="font-bold text-slate-800 text-sm flex items-center">${g.name} ${groupTypeBadge} ${isPro}</h3><p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens}</p></div></div><i class="fa-solid fa-chevron-down text-slate-300"></i></div><div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50"><div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap"><h4 class="text-xs font-bold text-slate-600">משתמשים:</h4><div class="flex gap-2">${proToggleBtn}<button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחק סביבה</button></div></div>${uHtml}</div></div>`;
    }); 
    groupsList.innerHTML = gHtml;
}

function filterSAGroups() { const term = document.getElementById('sa-search-group').value; renderSAGroups(term); }

async function saDeleteUser(id) { 
    if(!confirm('למחוק משתמש זה מהמערכת כליל?')) return; 
    await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); 
    showToast('success', 'משתמש נמחק'); 
    loadSAData(); 
}

async function saDeleteGroup(id) { 
    if(!confirm('האם למחוק סביבה זו לצמיתות?')) return; 
    await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken }}); 
    showToast('success', 'הסביבה נמחקה לחלוטין'); 
    loadSAData(); 
}

async function saveWelcomeMsg() { 
    await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ welcomeMsg: val('sa-welcome-msg') }) }); 
    showToast('success', 'הודעת הפתיחה נשמרה!'); 
}

async function saTogglePremium(groupId, enable) {
    const label = enable ? 'להפעיל' : 'לבטל'; 
    if (!confirm(`האם ${label} מנוי Pro לסביבה זו?`)) return;
    try {
        const res = await fetch(`${API}/superadmin/groups/${groupId}/premium`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ enable }) }); 
        const data = await res.json();
        if (data.success) { showToast('success', enable ? 'מנוי Pro הופעל!' : 'מנוי Pro בוטל'); loadSAData(); } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

function applyBannersToDOM(banners) {
    const saTopText = document.getElementById('sa-banner-top-text'); const saTopLink = document.getElementById('sa-banner-top-link'); const saTopImg = document.getElementById('sa-banner-top-img'); const saBottomText = document.getElementById('sa-banner-bottom-text'); const saBottomLink = document.getElementById('sa-banner-bottom-link'); const saBottomImg = document.getElementById('sa-banner-bottom-img');
    if(saTopText) saTopText.value = banners.banner_top_text || ''; if(saTopLink) saTopLink.value = banners.banner_top_link || ''; if(saTopImg) saTopImg.value = banners.banner_top_img || ''; if(saBottomText) saBottomText.value = banners.banner_bottom_text || ''; if(saBottomLink) saBottomLink.value = banners.banner_bottom_link || ''; if(saBottomImg) saBottomImg.value = banners.banner_bottom_img || '';
    
    const appTop = document.getElementById('app-banner-top'); const appBottom = document.getElementById('app-banner-bottom');
    const renderBanner = (el, text, link, img) => {
        if(!el) return;
        if(text || img) { 
            let html = ''; 
            if(img) html += `<img src="/${img}" alt="Banner" class="w-full object-cover block">`; 
            if(text) html += `<span class="py-3 px-4 block w-full text-center">${text}</span>`; 
            el.innerHTML = html; 
            el.href = link || '#'; 
            if(!link) { el.removeAttribute('target'); el.style.cursor = 'default'; } else { el.target = '_blank'; el.style.cursor = 'pointer'; } 
            el.classList.remove('hidden'); el.classList.add('flex'); 
        } else { 
            el.classList.add('hidden'); el.classList.remove('flex'); 
        }
    };
    renderBanner(appTop, banners.banner_top_text, banners.banner_top_link, banners.banner_top_img); 
    renderBanner(appBottom, banners.banner_bottom_text, banners.banner_bottom_link, banners.banner_bottom_img);
}

async function fetchBanners() {
    try {
        const cached = localStorage.getItem('ofl_banners'); 
        if(cached) { try { applyBannersToDOM(JSON.parse(cached)); } catch(e) {} }
        const res = await fetch(`${API}/banners`); const data = await res.json();
        if(data.success && data.banners) { localStorage.setItem('ofl_banners', JSON.stringify(data.banners)); applyBannersToDOM(data.banners); }
    } catch(e) {}
}

async function saveBanners() {
    const topText = val('sa-banner-top-text'); const topLink = val('sa-banner-top-link'); const topImg = val('sa-banner-top-img');
    const bottomText = val('sa-banner-bottom-text'); const bottomLink = val('sa-banner-bottom-link'); const bottomImg = val('sa-banner-bottom-img');
    
    try {
        const res = await fetch(`${API}/superadmin/banners`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, 
            body: JSON.stringify({ topText, topLink, topImg, bottomText, bottomLink, bottomImg }) 
        });
        const data = await res.json();
        if(data.success) { showToast('success', 'הבאנרים נשמרו והתעדכנו באפליקציה!'); fetchBanners(); } else { showToast('error', 'שגיאה בשמירת הבאנרים'); }
    } catch(e) { showToast('error', 'תקלת רשת מול השרת'); }
}

function handleAIResponseCheck(data) {
    if (data.error === 'BATTERY_EMPTY') {
        const modal = document.getElementById('ai-battery-modal'); 
        const upgradeSec = document.getElementById('ai-upgrade-section');
        if (currentUser.role === 'ADMIN') upgradeSec.classList.remove('hidden'); else upgradeSec.classList.add('hidden');
        if(modal) modal.classList.remove('hidden'); 
        return false;
    }
    return true;
}

function closeAiBatteryModal() { 
    const modal = document.getElementById('ai-battery-modal');
    if(modal) modal.classList.add('hidden'); 
}

function upgradeToPremium() { 
    closeAiBatteryModal(); 
    const profileModal = document.getElementById('profile-modal'); 
    if(profileModal) profileModal.classList.add('hidden'); 
    openAlertModal('Oneflow Pro 👑', 'אפשרות שדרוג למנוי פרימיום תתווסף למערכת בקרוב!'); 
}

// ==========================================
// Display Helpers — Group Names & User Names
// ==========================================

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
