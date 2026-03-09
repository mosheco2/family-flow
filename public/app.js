// תיקון סגנונות הרמטי לספריית הסיור - מונע בריחת חלוניות ושומר על מיקום כפתורים מרחפים
const introStyle = document.createElement('style');
introStyle.innerHTML = `
    /* שחרור מיקומים כדי למנוע קלקול אלמנטים צפים (כמו כפתור הפלוס) */
    .introjs-showElement {
        z-index: 9999998 !important;
        transform: none !important;
    }
    .introjs-fixParent {
        z-index: auto !important;
        opacity: 1.0 !important;
        transform: none !important;
        filter: none !important;
    }
    /* שחרור הגבלות חיתוך כדי שההארה והבועה לא יחתכו בנייד */
    body.introjs-active .slider-container,
    body.introjs-active .slider-scroll,
    body.introjs-active .overflow-hidden {
        overflow: visible !important;
    }
    /* מניעת הסתרה ע"י ההדר העליון */
    body.introjs-active header.sticky {
        z-index: 1 !important;
    }
    .introjs-overlay { z-index: 9999996 !important; }
    .introjs-helperLayer { z-index: 9999997 !important; }
    .introjs-tooltipReferenceLayer { z-index: 9999998 !important; }
    .introjs-tooltip { z-index: 9999999 !important; }

    /* 🔥 התיקון המנצח למובייל: הבועה תמיד במרכז המסך ולא בורחת בגלל כיוון ימין-לשמאל 🔥 */
    @media (max-width: 768px) {
        .introjs-tooltipReferenceLayer {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            right: auto !important;
            bottom: auto !important;
            width: 90vw !important;
        }
        .introjs-tooltip {
            position: relative !important;
            max-width: 350px !important;
            margin: 0 auto !important;
            left: auto !important;
            right: auto !important;
            top: auto !important;
            bottom: auto !important;
        }
        .introjs-arrow { display: none !important; } /* הסתרת החץ כי הבועה מרכזית */
    }
`;
document.head.appendChild(introStyle);

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let currentUser = null; let currentGroup = null; let pollInterval = null; let saToken = null;
let membersCache = []; let shoppingListCache = []; let wisdomCache = {};
let bundlesCache = []; let allBundles = []; let pantryCache = [];
let allTasks = []; let allTransactions = []; let feedCache = [];
let currentVerifyTaskId = null; let currentVerifyTaskTitle = null; let currentWrongAnswers = [];
let forceTourStart = false; // דגל להפעלה מובטחת אחרי הרשמה

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

// Accessibility State
let accState = { 'text-lg': false, 'grayscale': false, 'contrast': false, 'readable-font': false, 'highlight-links': false };

const hidePreloaderAndShowAuth = (view = 'login') => {
    document.getElementById('auth-container').classList.remove('hidden');
    switchView(view);
    const preloader = document.getElementById('app-preloader');
    if (preloader) {
        preloader.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => preloader.classList.add('hidden'), 700);
    }
};

window.onload = async () => { 
    initAccessibility();

    const failsafeTimer = setTimeout(() => {
        const preloader = document.getElementById('app-preloader');
        if (preloader && !preloader.classList.contains('hidden')) {
            console.warn('⚠️ שרת איטי או שגיאה בטעינה - מפעיל Failsafe למסך הטעינה');
            hidePreloaderAndShowAuth('login');
        }
    }, 7000);

    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code'); const inviteRole = urlParams.get('role');
    
    if (inviteCode) { 
        document.getElementById('join-code').value = inviteCode; 
        if(inviteRole) document.getElementById('join-role').value = inviteRole; 
        clearTimeout(failsafeTimer);
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
                    clearTimeout(failsafeTimer); 
                    await loadDashboard(); 
                } else {
                    localStorage.removeItem('ofl_session');
                    clearTimeout(failsafeTimer);
                    hidePreloaderAndShowAuth('login');
                }
            } else {
                localStorage.removeItem('ofl_session');
                clearTimeout(failsafeTimer);
                hidePreloaderAndShowAuth('login');
            }
        } catch(e) { 
            localStorage.removeItem('ofl_session');
            clearTimeout(failsafeTimer);
            hidePreloaderAndShowAuth('login');
        } 
    } else { 
        clearTimeout(failsafeTimer);
        hidePreloaderAndShowAuth('login');
    }
};

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
    fetchBanners(); // משיכת באנרים למסך הניהול
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken }});
        const data = await res.json();
        
        if (data.error) {
            console.error('Admin Data Error:', data.error);
            showToast('error', 'שגיאת שרת: ' + data.error);
            return;
        }

        document.getElementById('sa-welcome-msg').value = data.welcomeMsg || '';
        
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

async function saveWelcomeMsg() {
    const msg = document.getElementById('sa-welcome-msg').value;
    await fetch(`${API}/superadmin/settings`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
        body: JSON.stringify({ welcomeMsg: msg })
    });
    showToast('success', 'הודעת הפתיחה נשמרה בהצלחה!');
}

async function checkGlobalWelcome() {
    try {
        const res = await fetch(`${API}/settings/welcome`);
        const data = await res.json();
        if (data.message && data.message.trim() !== '') {
            const seen = localStorage.getItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`);
            if (seen !== data.message) {
                document.getElementById('welcome-modal-text').innerText = data.message;
                document.getElementById('welcome-modal').classList.remove('hidden');
                window.pendingWelcomeMsg = data.message;
                return true; 
            }
        }
    } catch(e) {}
    return false;
}

function closeWelcomeModal() {
    document.getElementById('welcome-modal').classList.add('hidden');
    if (window.pendingWelcomeMsg) {
        localStorage.setItem(`ofl_welcome_${currentUser.id}_${currentGroup.group_code}`, window.pendingWelcomeMsg);
    }
    checkAndStartTour(forceTourStart);
    forceTourStart = false; // איפוס
}

function checkAndStartTour(force = false) {
    setTimeout(() => {
        try {
            const tourKey = `ofl_tour_${currentUser.role}_${currentUser.id}_${currentGroup.group_code}`;
            if (force || !localStorage.getItem(tourKey)) {
                localStorage.setItem(tourKey, 'true');
                switchTab('feed'); 
                if (currentUser.role === 'ADMIN') startAdminTour();
                else startChildTour();
            }
        } catch(e) { console.error('Tour Start Error:', e); }
    }, 1000); 
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

function startAdminTour() {
    switchTab('feed');
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'התחל לעבוד!', skipLabel: 'דלג',
        showProgress: true, rtl: true, hidePrev: false, showBullets: true,
        scrollToElement: true,
        disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים! 👋", intro: "איזה כיף שהצטרפתם ל-Oneflow Life. הכנו לכם כלים מתקדמים לניהול חכם של כלכלת המשפחה. בואו נעשה סיור קצר." },
            { element: '#tour-header', title: "האזור שלכם", intro: "כאן תראו את קוד המשפחה הייחודי שלכם - אותו תשלחו לשאר בני הבית. לחיצה על 'תפריט' תאפשר לשנות סיסמה ולהפעיל את הסיור מחדש.", position: 'bottom' },
            { element: '#user-balance', title: "הארנק המשותף 💳", intro: "כאן תראו את היתרה הפנויה של המשפחה בכל רגע נתון. זה המדד הראשי שלכם.", position: 'bottom' },
            { element: '#tour-fab-btn', title: "הוספה מהירה ⚡", intro: "לחיצה על כפתור הפלוס השחור תאפשר לכם לרשום הוצאה או הכנסה בזריזות מכל מסך באפליקציה.", position: 'top' },
            { element: '#tab-shop', title: "סופר חכם 🛒", intro: "רשימת הקניות המשפחתית: הילדים יבקשו מוצרים, אתם תאשרו. בנוסף - תוכלו פשוט לצלם את הקבלה בסיום הקנייה, ו-familAI תעדכן את העגלה לבד!", position: 'bottom' },
            { element: '#tab-pantry', title: "מזווה ומלאי 📦", intro: "עקבו כאן אחרי מוצרים קבועים בבית (כמו קפה או סוכר). כשהמלאי אוזל, בלחיצת כפתור אחת המוצר יעבור ישירות לרשימת הקניות.", position: 'bottom' },
            { element: '#tab-bank', title: "ניהול הבנק 🏦", intro: "במקום לתת כסף מזומן: הגדירו כאן דמי כיס שבועיים וריביות לילדים שחוסכים. ניתן לחלק את דמי הכיס בלחיצת כפתור פעם בשבוע.", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות בית ✅", intro: "הגדירו משימות בבית (למשל: סידור החדר) ותמחרו אותן. הילדים יצלמו כשיסיימו, וה-AI יאשר את העברת התגמול לארנק שלהם!", position: 'bottom' },
            { element: '#tab-academy', title: "אקדמיה פיננסית 🎓", intro: "רוצים שהילדים ילמדו? בקשו מה-AI לייצר אתגר לימודי (בנושא חשבון, חיסכון וכו'). ילד שיענה נכון - יתוגמל בכסף לקופה שלו.", position: 'bottom' },
            { element: '#tab-budget', title: "תקציב 📊", intro: "הגדירו תקרת תקציב לכל קטגוריה (סופר, דלק, מסעדות). היועצת הפיננסית שלנו תנתח את ההוצאות ותיתן לכם טיפים לחיסכון.", position: 'bottom' },
            { element: '#tab-recipes', title: "שף AI 👨‍🍳", intro: "לא יודעים מה לבשל? ה-AI יבדוק מה יש לכם במזווה וייצר לכם מתכון מנצח בשניות!", position: 'bottom' },
            { element: '#tab-members', title: "הזמנת המשפחה 👨‍👩‍👧‍👦", intro: "הזמינו עכשיו את השותף/ה או הילדים להצטרף אליכם בקליק אחד בוואטסאפ. בהצלחה!", position: 'bottom' }
        ]
    });

    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return;
        const id = targetElement.id;
        
        if(id === 'tab-shop') switchTab('shop'); 
        else if(id === 'tab-pantry') switchTab('pantry'); 
        else if(id === 'tab-bank') switchTab('bank'); 
        else if(id === 'tab-tasks') switchTab('tasks'); 
        else if(id === 'tab-academy') switchTab('academy'); 
        else if(id === 'tab-budget') switchTab('budget'); 
        else if(id === 'tab-recipes') switchTab('recipes'); 
        else if(id === 'tab-members') switchTab('members'); 
        else switchTab('feed'); 
        
        if (targetElement.classList && targetElement.classList.contains('tab-btn')) {
            const scrollContainer = document.getElementById('slider-scroll');
            if (scrollContainer) {
                scrollContainer.style.scrollBehavior = 'auto'; // ביטול זמני של ההחלקה
                const scrollPos = targetElement.offsetLeft - (scrollContainer.offsetWidth / 2) + (targetElement.offsetWidth / 2);
                scrollContainer.scrollLeft = scrollPos;
                setTimeout(() => { scrollContainer.style.scrollBehavior = 'smooth'; }, 50); // החזרת ההחלקה
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

function startChildTour() {
    switchTab('feed');
    const intro = introJs();
    intro.setOptions({
        nextLabel: 'הבא', prevLabel: 'חזור', doneLabel: 'הבנתי!', skipLabel: 'דלג',
        showProgress: true, rtl: true, hidePrev: false, showBullets: true,
        scrollToElement: true,
        disableInteraction: true,
        steps: [
            { title: "ברוכים הבאים ל-Oneflow Life! 🎉", intro: "מוכנים לנהל את הכסף שלכם כמו גדולים? בואו נכיר את האפליקציה שתעזור לכם להרוויח ולחסוך." },
            { element: '#user-balance', title: "הארנק שלי 💳", intro: "כאן למעלה תוכלו לראות בדיוק כמה כסף פנוי יש לכם עכשיו בחשבון האישי.", position: 'bottom' },
            { element: '#tab-shop', title: "הסופרמרקט 🛒", intro: "מתחשק לכם חטיף או משהו טעים? תוכלו לבקש כאן להוסיף מוצרים לרשימת הקניות של ההורים.", position: 'bottom' },
            { element: '#tab-pantry', title: "מה יש בבית? 📦", intro: "כאן תוכלו להציץ במזווה ולראות אילו מוצרים כבר קיימים אצלכם בבית.", position: 'bottom' },
            { element: '#tab-bank', title: "הבנק והיעדים 🏦", intro: "כאן תראו מתי אתם מקבלים דמי כיס. הכי חשוב: תוכלו לפתוח 'קופת חיסכון' כדי לחסוך למשהו גדול שאתם רוצים לקנות!", position: 'bottom' },
            { element: '#tab-tasks', title: "משימות ותגמולים ✅", intro: "ההורים יכולים להשאיר לכם כאן משימות. סיימתם משימה? צלמו אותה וקבלו את הכסף ישר לארנק!", position: 'bottom' },
            { element: '#tab-academy', title: "האקדמיה הפיננסית 🎓", intro: "מי אמר שללמוד זה משעמם? כנסו לאקדמיה, ענו נכון על חידונים - ותרוויחו בונוסים שווים.", position: 'bottom' },
            { element: '#tab-budget', title: "מעקב תקציב 📊", intro: "כאן תוכלו לעקוב אחרי ההוצאות שלכם (על מה בזבזתם החודש) וללמוד לשלוט בכסף שלכם.", position: 'bottom' },
            { element: '#tab-recipes', title: "שף AI 👨‍🍳", intro: "בא לכם משהו טעים? בואו נבדוק איזה מתכון אפשר להכין מהדברים שיש בבית!", position: 'bottom' }
        ]
    });

    intro.onbeforechange(function(targetElement) { 
        if(!targetElement) return;
        const id = targetElement.id;

        if(id === 'tab-shop') switchTab('shop'); 
        else if(id === 'tab-pantry') switchTab('pantry'); 
        else if(id === 'tab-bank') switchTab('bank'); 
        else if(id === 'tab-tasks') switchTab('tasks'); 
        else if(id === 'tab-academy') switchTab('academy'); 
        else if(id === 'tab-budget') switchTab('budget'); 
        else if(id === 'tab-recipes') switchTab('recipes'); 
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

function switchView(view) { ['login','create','join', 'sa-login'].forEach(v => document.getElementById(`view-${v}`).classList.add('hidden')); document.getElementById(`view-${view}`).classList.remove('hidden'); }
function selectType(t) { document.getElementById('create-type').value=t; document.getElementById('type-family').className=`flex-1 p-3 rounded-xl border-2 text-center transition ${t==='FAMILY'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; document.getElementById('type-group').className=`flex-1 p-3 rounded-xl border-2 text-center transition ${t==='GROUP'?'border-blue-500 bg-blue-50 text-blue-600 font-bold':'border-slate-100 text-slate-400'}`; }

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
        } else showToast('error', data.error); 
    } catch(e) { showToast('error', 'שגיאה בחיבור לשרת'); } finally { toggleLoader('login', false); } 
}

function logout() { localStorage.removeItem('ofl_session'); location.reload(); }
function scrollTabs(direction) { document.getElementById('slider-scroll').scrollBy({ left: direction * -150, behavior: 'smooth' }); }

function switchTab(t) { 
    ['feed','tasks','shop','bank','academy','members','budget','pantry','recipes'].forEach(x => { const el = document.getElementById(`content-${x}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`tab-${x}`); if(btn) btn.classList.remove('tab-active'); }); 
    document.getElementById(`content-${t}`).classList.remove('hidden'); document.getElementById(`tab-${t}`).classList.add('tab-active'); 
    if (t !== 'shop') { const footer = document.getElementById('cart-footer'); if (footer) footer.classList.add('hidden'); document.getElementById('fab-container').classList.remove('fab-lifted'); } else { try { renderShopList(); } catch(e) {} }
    if (t === 'pantry') renderPantry();
    if (t === 'recipes') renderRecipePantrySelection();
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
        ['admin-panel','btn-add-task','budget-filter','bank-admin-view','academy-admin-view','btn-scan-receipt','admin-shop-tools','btn-budget-insight', 'admin-tasks-hint'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ממתינים לאישור';
    } else { 
        ['btn-self-task','bank-child-view','academy-user-view'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
        document.getElementById('card-name').innerText = currentUser.nickname.toUpperCase(); 
        document.getElementById('card-allowance').innerText = `₪${currentUser.allowance_amount || 0}`; 
        document.getElementById('card-interest').innerText = `${currentUser.interest_rate || 0}%`; 
        document.getElementById('req-title').innerHTML = '<i class="fa-solid fa-hourglass-half"></i> הבקשות שלי לקניות';
    }
    
    document.getElementById('btn-add-budget-cat').classList.remove('hidden');
    
    try {
        if(!pollInterval) pollInterval = setInterval(() => { fetchData(); if(isAdmin) fetchPendingUsers(); }, 30000);
        fetchBanners();
        await fetchMembers(); 
        if(isAdmin) fetchPendingUsers(); 
        await fetchData();
    } catch (e) {
        console.error('Error fetching dashboard data:', e);
        showToast('error', 'שגיאה בטעינת חלק מהנתונים');
    } finally {
        const preloader = document.getElementById('app-preloader'); 
        
        const finalizeLoad = async () => {
            const showedWelcome = await checkGlobalWelcome();
            if (!showedWelcome) {
                checkAndStartTour(forceTourStart);
                forceTourStart = false;
            }
        };

        if (preloader && !preloader.classList.contains('hidden')) { 
            preloader.classList.add('opacity-0', 'pointer-events-none'); 
            setTimeout(() => {
                preloader.classList.add('hidden');
                finalizeLoad();
            }, 700); 
        } else {
            finalizeLoad();
        }
    }
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
        if (!data || !data.user) return;
        
        currentUser.balance = data.user.balance; 
        const balEl = document.getElementById('user-balance'); if(balEl) balEl.innerText = `₪${currentUser.balance}`;
        
        allTasks = Array.isArray(data.tasks) ? data.tasks : []; bundlesCache = Array.isArray(data.quiz_bundles) ? data.quiz_bundles : []; pantryCache = Array.isArray(data.pantry) ? data.pantry : [];
        if (data.all_bundles && data.all_bundles.length > 0) allBundles = data.all_bundles;

        try { if (currentUser.role === 'ADMIN') renderAdminAcademy(); else { renderMyAssignments(bundlesCache); renderLibrary(); } } catch(e) { console.error('Academy err:', e); }
        try { renderTasks(allTasks); renderPantry(); renderRecipePantrySelection(); } catch(e) { console.error('Tasks/Pantry err:', e); }
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
