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

// --- PRELOADER SAFETY ---
function hidePreloader() {
    const preloader = document.getElementById('app-preloader');
    if (preloader && !preloader.classList.contains('hidden')) {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.classList.add('hidden'), 500);
    }
}

window.onload = async () => {
    // שסתום ביטחון - אם אחרי 3 שניות האפליקציה לא נפתחה, נכבה את מסך הטעינה בכוח
    setTimeout(hidePreloader, 3000);
    
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code');
    if (inviteCode) {
        const joinInput = document.getElementById('join-code');
        if(joinInput) joinInput.value = inviteCode;
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
function selectType(t) { const input = document.getElementById('create-type'); if(input) input.value = t; }
function openTosModal(e) { if(e) { e.preventDefault(); e.stopPropagation(); } document.getElementById('tos-modal').classList.remove('hidden'); }
function closeTosModal() { document.getElementById('tos-modal').classList.add('hidden'); }

async function handleLogin(e) { 
    e.preventDefault(); forceTourStart = false; 
    authAction('login', { groupCode: val('login-code'), nickname: val('login-nickname'), password: val('login-password') }); 
}

async function handleCreate(e) { 
    e.preventDefault(); 
    if(!document.getElementById('create-tos').checked) return showToast('error', 'יש לאשר את התקנון');
    forceTourStart = true;
    authAction('groups', { type: val('create-type'), groupName: val('create-group-name'), adminEmail: val('create-email'), adminNickname: val('create-nickname'), birthYear: val('create-year'), password: val('create-password') }); 
}

async function handleJoin(e) { 
    e.preventDefault(); 
    if(!document.getElementById('join-tos').checked) return showToast('error', 'יש לאשר את התקנון');
    forceTourStart = true;
    const res = await fetch(`${API}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ groupCode: val('join-code'), role: 'MEMBER', nickname: val('join-nickname'), birthYear: val('join-year'), password: val('join-password') }) }); 
    const d = await res.json();
    if(d.success) { showToast('success', 'בקשה נשלחה!'); switchView('login'); } else showToast('error', d.error);
}

async function authAction(endpoint, body) {
    try {
        const res = await fetch(`${API}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        const data = await res.json();
        if(data.success) {
            currentUser = data.user; currentGroup = data.group;
            localStorage.setItem('ofl_session', JSON.stringify({user:currentUser, group:currentGroup}));
            await loadDashboard();
        } else showToast('error', data.error);
    } catch(e) { showToast('error', 'שגיאת חיבור לשרת'); }
}

// --- DASHBOARD ---
async function loadDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
    document.getElementById('fab-container').classList.remove('hidden');
    
    document.getElementById('dash-group-name').innerText = currentGroup.name;
    document.getElementById('dash-nickname').innerText = currentUser.nickname;
    document.getElementById('user-balance').innerText = `₪${currentUser.balance || 0}`;

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) document.getElementById('bank-admin-view').classList.remove('hidden');
    else document.getElementById('bank-child-view').classList.remove('hidden');

    hidePreloader();
    
    setTimeout(() => {
        const tourKey = `ofl_tour_${currentUser.id}_${currentGroup.group_code}`;
        if (forceTourStart || !localStorage.getItem(tourKey)) {
            localStorage.setItem(tourKey, 'done');
            if (currentUser.role === 'ADMIN') startAdminTour(); else startChildTour();
        }
    }, 1000);
}

function switchTab(t) {
    ['feed','tasks','shop','bank','academy','members','budget','pantry'].forEach(x => {
        const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden');
        const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active');
    });
    const target = document.getElementById(`content-${t}`); if(target) target.classList.remove('hidden');
    const btn = document.getElementById(`tab-${t}`); if(btn) btn.classList.add('tab-active');
}

function startAdminTour() {
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג',
        rtl: true, steps: [
            { title: "ברוכים הבאים!", intro: "אני familAI, נעים להכיר." },
            { element: '#user-balance', title: "הארנק המשותף", intro: "כאן רואים את היתרה שלכם." },
            { element: '#tour-fab-btn', title: "פעולות", intro: "כאן מוסיפים הוצאות או הכנסות." }
        ]
    });
    intro.start();
}

function startChildTour() {
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג',
        rtl: true, steps: [
            { title: "היי! 🎉", intro: "מוכן לנהל את הכסף שלך? בוא נתחיל." },
            { element: '#user-balance', title: "הארנק שלי", intro: "כאן תראה כמה כסף יש לך בחשבון." },
            { element: '#tab-bank', title: "בנק ויעדים", intro: "כאן תוכל לחסוך כסף לדברים שאתה רוצה." }
        ]
    });
    intro.start();
}

// --- UTILS ---
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function showToast(t,m) { const el=document.getElementById('toast'); if(!el) return; document.getElementById('toast-message').innerText=m; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),3000); }
function toggleFab() { document.getElementById('fab-container').classList.toggle('fab-open'); }
function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(dir) { document.getElementById('slider-scroll').scrollBy({ left: dir * -150, behavior: 'smooth' }); }
function openProfileModal() { document.getElementById('profile-modal').classList.remove('hidden'); }
function triggerManualTour() { document.getElementById('profile-modal').classList.add('hidden'); if(currentUser.role==='ADMIN') startAdminTour(); else startChildTour(); }
