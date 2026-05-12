// Oneflow Life - Super Admin Logic Application

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
const getEl = id => document.getElementById(id);
const val = id => getEl(id) ? getEl(id).value : '';
const safeStr = str => (str || '').toString().replace(/'/g, "\\'").replace(/"/g, "&quot;");

let saToken = null;
let saAllGroups = [];
let saAllUsers = [];
let saCommunitiesCache = [];
let saBusinessesCache = [];
let saTicketsCache = [];
let saPartnersCache = []; // <-- הוספנו משתנה זה
let currentCommFamiliesCache = [];
let createCityTags = [];
let editCityTags = [];
window.onload = () => {
    const savedToken = localStorage.getItem('ofl_sa_token');
    if (savedToken) {
        saToken = savedToken;
        getEl('auth-container').classList.add('hidden');
        getEl('sa-dashboard-container').classList.remove('hidden');
        loadSAData();
    }
};

function showToast(t, m) {
    const el = getEl('toast');
    const icon = getEl('toast-icon');
    el.classList.remove('hidden');
    getEl('toast-message').innerText = m;
    icon.className = t === 'success' ? 'fa-solid fa-check text-green-400' : 'fa-solid fa-xmark text-red-400';
    setTimeout(() => el.classList.add('hidden'), 3000);
}

async function handleSALogin(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API}/superadmin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: val('sa-code'), password: val('sa-password') })
        });
        const data = await res.json();
        if (data.success) {
            saToken = data.token;
            localStorage.setItem('ofl_sa_token', saToken);
            getEl('auth-container').classList.add('hidden');
            getEl('sa-dashboard-container').classList.remove('hidden');
            loadSAData();
        } else {
            showToast('error', data.error);
        }
    } catch (err) { showToast('error', 'שגיאת תקשורת'); }
}

function logoutSA() {
    saToken = null;
    localStorage.removeItem('ofl_sa_token');
    getEl('sa-dashboard-container').classList.add('hidden');
    getEl('auth-container').classList.remove('hidden');
    getEl('sa-code').value = '';
    getEl('sa-password').value = '';
}

function switchSATab(tabId) {
    ['pulse', 'stats', 'comm', 'content', 'users', 'biz', 'support', 'partners', 'inbox'].forEach(t => {
        const view = document.getElementById(`sa-view-${t}`);
        const btn = document.getElementById(`btn-sa-tab-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.className = 'flex-1 py-3 px-4 text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl transition';
    });
    const activeView = document.getElementById(`sa-view-${tabId}`);
    const activeBtn = document.getElementById(`btn-sa-tab-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) {
        if (tabId === 'pulse') {
            activeBtn.className = 'flex-1 py-3 px-4 text-sm font-bold bg-slate-800 text-white rounded-xl shadow-sm transition flex items-center justify-center gap-2';
        } else if(tabId === 'support') {
            activeBtn.className = 'flex-1 py-3 px-4 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl shadow-sm transition flex items-center justify-center gap-1';
        } else if (tabId === 'inbox') {
            activeBtn.className = 'flex-1 py-3 px-4 text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm transition flex items-center justify-center gap-1';
        } else {
            activeBtn.className = 'flex-1 py-3 px-4 text-sm font-bold bg-white text-slate-800 rounded-xl shadow-sm transition';
        }
    }
}

// לוגיקת רינדור ה-Live Pulse (דופק חי ואנומליות)
function renderLivePulse(activityData, stats) {
    const stream = getEl('pulse-live-stream');
    if (!stream) return;

    // חישוב KPIs שמוצגים בדשבורד החי
    const totalUsers = (stats.familyUsers || 0) + (stats.businessUsers || 0);
    getEl('pulse-active-users').innerText = totalUsers;
    
    // סינון הזמנות (הדמיה לפי פעילות רכש/קופה)
    const ordersCount = activityData.filter(a => a.description.includes('רכש') || a.description.includes('קופה') || a.description.includes('תור')).length;
    getEl('pulse-orders-today').innerText = ordersCount;
    
    // הדמיה של קריאות AI
    const aiReqs = activityData.filter(a => a.description.includes('AI') || a.description.includes('חפיפה')).length;
    getEl('pulse-ai-reqs').innerText = aiReqs * 2 || '--'; // מוכפל להדמיית נפח

    // זיהוי שגיאות ואנומליות
    const errorCount = activityData.filter(a => a.description.includes('שגיאה') || a.description.includes('נמחק') || a.description.includes('תקלה')).length;
    const errorsEl = getEl('pulse-errors');
    errorsEl.innerText = errorCount;
    if (errorCount > 0) {
        errorsEl.classList.replace('text-orange-400', 'text-red-500');
        errorsEl.parentElement.classList.add('animate-pulse', 'border-red-500');
    } else {
        errorsEl.classList.replace('text-red-500', 'text-orange-400');
        errorsEl.parentElement.classList.remove('animate-pulse', 'border-red-500');
    }

    // הקפצת אנומליה ויזואלית אם יש יותר מ-3 תקלות בדוח האחרון
    const anomalyAlert = getEl('pulse-anomaly-alert');
    if (anomalyAlert) {
        if (errorCount >= 3) {
            anomalyAlert.classList.remove('hidden');
        } else {
            anomalyAlert.classList.add('hidden');
        }
    }

    // רינדור הלוגים בזמן אמת בתצוגה כהה
    if (activityData.length === 0) {
        stream.innerHTML = '<p class="text-slate-400 text-center py-4">אין פעילות בדקות האחרונות.</p>';
        return;
    }

    stream.innerHTML = activityData.slice(0, 15).map(a => {
        let icon = '<i class="fa-solid fa-bolt text-slate-400"></i>';
        let bgGlow = '';
        
        if (a.is_financial) {
            icon = '<i class="fa-solid fa-coins text-green-400"></i>';
            bgGlow = 'border-l-2 border-l-green-500/50';
        }
        if (a.description.includes('AI') || a.description.includes('חפיפה')) {
            icon = '<i class="fa-solid fa-microchip text-purple-400"></i>';
            bgGlow = 'border-l-2 border-l-purple-500/50';
        }
        if (a.description.includes('שגיאה') || a.description.includes('נמחק')) {
            icon = '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>';
            bgGlow = 'border-l-2 border-l-red-500/50';
        }

        const amountHtml = a.is_financial ? `<span class="text-green-400 font-mono font-bold tracking-wider dir-ltr ml-3">+₪${a.amount}</span>` : '';
        const timeStr = new Date(a.date).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit', second:'2-digit'});

        return `
        <div class="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition ${bgGlow}">
            <div class="flex items-center gap-3">
                <span class="text-slate-400 font-mono text-[10px] w-14 text-left">${timeStr}</span>
                <span class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shadow-inner text-sm">${icon}</span>
                <span class="text-slate-200 font-medium">${safeStr(a.description)}</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-[10px] bg-white/10 text-slate-300 px-2 py-1 rounded-md border border-white/10 truncate max-w-[120px]"><i class="fa-solid fa-house-user mr-1 text-slate-500"></i> ${safeStr(a.group_name)}</span>
                ${amountHtml}
            </div>
        </div>`;
    }).join('');
}

async function loadSATickets() {
    const list = getEl('sa-tickets-list');
    if(!list) return;
    list.innerHTML = '<p class="text-center text-slate-400 py-4"><i class="fa-solid fa-circle-notch fa-spin"></i> טוען קריאות שירות...</p>';
    try {
        const res = await fetch(`${API}/superadmin/tickets`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) {
            saTicketsCache = data.tickets || [];
            renderSATickets();
        } else {
            list.innerHTML = '<p class="text-center text-red-500 text-sm">שגיאה בטעינת קריאות</p>';
        }
    } catch(e) { list.innerHTML = '<p class="text-center text-red-500 text-sm">שגיאת תקשורת</p>'; }
}

function renderSATickets() {
    const list = getEl('sa-tickets-list');
    if (!list) return;
    if (saTicketsCache.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-400 text-sm py-8 border border-dashed border-slate-200 rounded-xl bg-white">אין קריאות שירות פתוחות במערכת.</p>';
        return;
    }

    let html = '';
    const statusMap = {
        'open': { text: 'פתוח (ממתין)', color: 'bg-red-100 text-red-600 border-red-200' },
        'in_progress': { text: 'בטיפול', color: 'bg-orange-100 text-orange-600 border-orange-200' },
        'resolved': { text: 'טופל (סגור)', color: 'bg-green-100 text-green-600 border-green-200 opacity-70' }
    };

    saTicketsCache.forEach(t => {
        const st = statusMap[t.status] || statusMap['open'];
        const dateStr = new Date(t.created_at).toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'});
        
        html += `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-3 relative transition hover:shadow-md">
            <div class="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                <div class="pr-2">
                    <h4 class="font-bold text-slate-800 text-sm">${safeStr(t.subject)}</h4>
                    <p class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-building mr-1"></i> ${safeStr(t.group_name)} | <i class="fa-solid fa-user mx-1"></i> ${safeStr(t.user_name)}</p>
                    <p class="text-[9px] text-slate-400 mt-0.5">${dateStr}</p>
                </div>
                <span class="text-[10px] font-bold px-2 py-1 rounded border ${st.color} whitespace-nowrap">${st.text}</span>
            </div>
            
            <div class="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3 max-h-32 overflow-y-auto modal-scroll leading-relaxed">${safeStr(t.description)}</div>
            
            <div class="flex gap-2 items-center bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                <span class="text-[10px] font-bold text-slate-500">סטטוס פנייה:</span>
                <select onchange="updateSATicketStatus(${t.id}, this.value)" class="modern-input py-1.5 px-2 text-xs bg-white flex-1 font-bold shadow-sm" style="width: auto; padding: 5px;">
                    <option value="open" ${t.status === 'open' ? 'selected' : ''}>פתוח (ממתין)</option>
                    <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>בטיפול ע"י הצוות</option>
                    <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>טופל / נסגר</option>
                </select>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

async function updateSATicketStatus(id, status) {
    try {
        const res = await fetch(`${API}/superadmin/tickets/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'סטטוס קריאה עודכן בהצלחה');
            loadSATickets();
        } else {
            showToast('error', 'שגיאה בעדכון הסטטוס');
        }
    } catch(e) { showToast('error', 'שגיאת תקשורת בעדכון הסטטוס'); }
}

async function updateSACredentials() {
    const newUsername = val('sa-new-username');
    const newPassword = val('sa-new-password');
    const newEmail = val('sa-new-email');
    if (!newUsername || !newPassword) return showToast('error', 'יש להזין שם משתמש וסיסמה חדשים');
    if (!confirm('האם אתה בטוח שברצונך לשנות את פרטי המנהל הראשי?')) return;
    try {
        const res = await fetch(`${API}/superadmin/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ newUsername, newPassword, newEmail }) });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'פרטי המנהל הראשי עודכנו בהצלחה!');
        } else { showToast('error', data.error || 'שגיאה בעדכון פרטים'); }
    } catch (e) { showToast('error', 'שגיאת תקשורת מול השרת'); }
}
async function loadSAData() {
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);

        const setVal = (id, v) => { const e = getEl(id); if (e) e.value = v || ''; };
        
        const setImgPreview = (baseId, val) => {
            setVal(baseId + '-img', val);
            const preview = getEl(baseId + '-preview');
            const placeholder = getEl(baseId + '-placeholder') || getEl(baseId + '-icon');
            if (val && val.length > 10) {
                if (preview) { preview.src = val.startsWith('http') || val.startsWith('data:') ? val : '/' + val; preview.classList.remove('hidden'); preview.style.display = 'block'; }
                if (placeholder) { placeholder.classList.add('hidden'); placeholder.style.display = 'none'; }
            } else {
                if (preview) { preview.src = ''; preview.classList.add('hidden'); preview.style.display = 'none'; }
                if (placeholder) { placeholder.classList.remove('hidden'); placeholder.style.display = 'flex'; }
            }
        };

        setVal('sa-new-username', data.saUsername);
        setVal('sa-new-email', data.saEmail);
        setVal('sa-welcome-msg', data.welcomeMsg);
        setVal('sa-biz-welcome-msg', data.businessWelcomeMsg);
        
        setVal('sa-banner-top-text', data.adBannerTextTop);
        setVal('sa-banner-top-link', data.adBannerLinkTop);
        setImgPreview('sa-banner-top', data.adBannerImgTop);
        
        setVal('sa-banner-bottom-text', data.adBannerTextBottom);
        setVal('sa-banner-bottom-link', data.adBannerLinkBottom);
        setImgPreview('sa-banner-bottom', data.adBannerImgBottom);
        
        setVal('sa-biz-banner-top-text', data.bizBannerTextTop);
        setVal('sa-biz-banner-top-link', data.bizBannerLinkTop);
        setImgPreview('sa-biz-banner-top', data.bizBannerImgTop);
        
        setVal('sa-biz-banner-bottom-text', data.bizBannerTextBottom);
        setVal('sa-biz-banner-bottom-link', data.bizBannerLinkBottom);
        setImgPreview('sa-biz-banner-bottom', data.bizBannerImgBottom);
        const setTxt = (id, v) => { const e = getEl(id); if (e) e.innerText = v || 0; };
        if (data.stats) {
            setTxt('sa-stat-families', data.stats.families);
            setTxt('sa-stat-businesses', data.stats.businesses);
            setTxt('sa-stat-family-users', data.stats.familyUsers);
            setTxt('sa-stat-biz-users', data.stats.businessUsers);
        }

        if (data.activity && data.stats) {
            renderLivePulse(data.activity, data.stats);
        }
        
        const actList = getEl('sa-activity-list');
        if (actList) {
            actList.innerHTML = data.activity.map(a => {
                const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">פעולה</span>`;
                return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span> | ${safeStr(a.group_name)} | <span class="font-bold">${safeStr(a.user_name)}</span> | ${safeStr(a.description)}</div> ${amountHtml}</div>`;
            }).join('');
            if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין במערכת...</p>';
        }

        saAllGroups = data.groups || [];
        saAllUsers = data.users || [];
        
        // טעינת ההגדרות הגלובליות החדשות!
        window.loginSlidesCache = data.loginSlides || [];
        
        const globalAiLogoPreview = getEl('sa-global-ai-logo-preview');
        const globalAiLogoIcon = getEl('sa-global-ai-logo-icon');
        getEl('sa-global-ai-logo-base64').value = data.globalAiLogo || '';
        if (data.globalAiLogo) {
            if(globalAiLogoPreview) { globalAiLogoPreview.src = data.globalAiLogo; globalAiLogoPreview.classList.remove('hidden'); }
            if(globalAiLogoIcon) globalAiLogoIcon.classList.add('hidden');
        } else {
            if(globalAiLogoPreview) { globalAiLogoPreview.src = ''; globalAiLogoPreview.classList.add('hidden'); }
            if(globalAiLogoIcon) globalAiLogoIcon.classList.remove('hidden');
        }
        
        if(typeof renderLoginSlidesAdmin === 'function') renderLoginSlidesAdmin();
        if(typeof renderSAGroups === 'function') renderSAGroups();
        if(typeof loadSACommunityData === 'function') loadSACommunityData();
        if(typeof loadSATickets === 'function') loadSATickets();
        if(typeof loadSAPartners === 'function') loadSAPartners();
        
    } catch (e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
}

window.saveAllBanners = async function() {
    try {
        const payload = {
            topText: val('sa-banner-top-text'), topLink: val('sa-banner-top-link'), topImg: val('sa-banner-top-img'),
            bottomText: val('sa-banner-bottom-text'), bottomLink: val('sa-banner-bottom-link'), bottomImg: val('sa-banner-bottom-img'),
            bizTopText: val('sa-biz-banner-top-text'), bizTopLink: val('sa-biz-banner-top-link'), bizTopImg: val('sa-biz-banner-top-img'),
            bizBottomText: val('sa-biz-banner-bottom-text'), bizBottomLink: val('sa-biz-banner-bottom-link'), bizBottomImg: val('sa-biz-banner-bottom-img'),
            globalAiLogo: val('sa-global-ai-logo-base64'),
            loginSlides: window.loginSlidesCache
        };

        const res = await fetch(`${API}/superadmin/banners`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'ההגדרות והמיתוג הגלובלי נשמרו בהצלחה!'); } else { showToast('error', 'שגיאה בשמירת נתונים'); }
    } catch (e) { showToast('error', 'תקלת רשת מול השרת'); }
};

// --- פונקציות ניהול מיתוג ושקופיות סופר אדמין ---
window.loginSlidesCache = [];

window.handleGlobalLogoUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 512;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/png'); // שומרים PNG בשביל שקיפות הלוגו
            
            getEl('sa-global-ai-logo-base64').value = base64;
            getEl('sa-global-ai-logo-preview').src = base64;
            getEl('sa-global-ai-logo-preview').classList.remove('hidden');
            if(getEl('sa-global-ai-logo-icon')) getEl('sa-global-ai-logo-icon').classList.add('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.clearGlobalLogo = function() {
    getEl('sa-global-ai-logo-base64').value = '';
    getEl('sa-global-ai-logo-preview').src = '';
    getEl('sa-global-ai-logo-preview').classList.add('hidden');
    if(getEl('sa-global-ai-logo-icon')) getEl('sa-global-ai-logo-icon').classList.remove('hidden');
};

window.addLoginSlideImage = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/png');
            
            window.loginSlidesCache.push({ id: 'slide_' + Date.now(), image: base64, active: true });
            if(typeof window.renderLoginSlidesAdmin === 'function') window.renderLoginSlidesAdmin();
            event.target.value = '';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.toggleLoginSlide = function(idx) {
    if(window.loginSlidesCache[idx]) {
        window.loginSlidesCache[idx].active = !window.loginSlidesCache[idx].active;
        if(typeof window.renderLoginSlidesAdmin === 'function') window.renderLoginSlidesAdmin();
    }
};

window.deleteLoginSlide = function(idx) {
    window.loginSlidesCache.splice(idx, 1);
    if(typeof window.renderLoginSlidesAdmin === 'function') window.renderLoginSlidesAdmin();
};

window.renderLoginSlidesAdmin = function() {
    const list = getEl('sa-login-slides-list');
    if(!list) return;
    if(window.loginSlidesCache.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed">אין שקופיות. יוצג כרטיס האשראי כברירת מחדל.</p>';
        return;
    }
    
    list.innerHTML = window.loginSlidesCache.map((s, idx) => `
        <div class="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl mb-2">
            <div class="flex items-center gap-3">
                <img src="${s.image}" class="w-12 h-12 object-contain bg-slate-200/50 rounded-lg">
                <span class="text-xs font-bold text-slate-700">שקופית ${idx + 1}</span>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="window.toggleLoginSlide(${idx})" class="text-[10px] font-bold px-2 py-1 rounded-lg transition ${s.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}">${s.active ? 'מוצג' : 'מוסתר'}</button>
                <button onclick="window.deleteLoginSlide(${idx})" class="w-7 h-7 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
            </div>
        </div>
    `).join('');
};
async function saveWelcomeMsg(type = 'FAMILY') {
    const body = type === 'BUSINESS' ? { businessWelcomeMsg: val('sa-biz-welcome-msg') } : { welcomeMsg: val('sa-welcome-msg') };
    try {
        const res = await fetch(`${API}/superadmin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify(body) });
        if ((await res.json()).success) { showToast('success', 'הודעת הפתיחה נשמרה בהצלחה!'); } else { showToast('error', 'שגיאה בשמירת ההודעה'); }
    } catch (e) { showToast('error', 'תקלת תקשורת בשמירת ההודעה'); }
}

function renderSAGroups() {
    const groupsList = getEl('sa-groups-list');
    let gHtml = '';
    const term = val('sa-search-group').toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    if (filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו סביבות התואמות לחיפוש.</p>'; return; }

    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => `
            <div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm">
                <span>${safeStr(u.nickname)} <span class="text-[10px] text-slate-400">(${u.role === 'ADMIN' ? 'הורה/מנהל' : 'בן משפחה/עובד'})</span></span>
                <div class="flex gap-1">
                    <button onclick="openSAEditUserModal(${u.id}, '${safeStr(u.nickname)}')" class="text-blue-400 hover:text-blue-600 bg-white p-1 rounded shadow-sm transition"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm transition"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים רשומים.</p>';
        const isPro = g.is_premium ? '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">PRO</span>' : '';
        const aiTokens = g.is_premium ? '∞' : (g.ai_tokens !== undefined ? g.ai_tokens : 10);
        const proToggleBtn = g.is_premium ? `<button onclick="saTogglePremium(${g.id}, false)" class="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-crown"></i> בטל Pro</button>` : `<button onclick="saTogglePremium(${g.id}, true)" class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded text-[10px] font-bold hover:opacity-90 transition"><i class="fa-solid fa-crown"></i> הפעל Pro</button>`;
        const typeBadge = g.type === 'BUSINESS' ? '<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-blue-200"><i class="fa-solid fa-briefcase mr-1"></i> עסק</span>' : '<span class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-emerald-200"><i class="fa-solid fa-house mr-1"></i> משפחה</span>';
        const createdDate = g.created_at ? new Date(g.created_at).toLocaleDateString('he-IL') : 'לא ידוע';

        // מציאת אדמין להשתלטות
        const adminUser = saAllUsers.find(u => u.group_id === g.id && u.role === 'ADMIN') || saAllUsers.find(u => u.group_id === g.id);
        const impersonateBtn = adminUser ? `<button onclick="impersonateGroup(${g.id}, ${adminUser.id})" class="bg-slate-800 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-slate-700 transition flex items-center gap-1 shadow-sm"><i class="fa-solid fa-user-secret"></i> כניסה לסביבה</button>` : '';

        gHtml += `
        <div class="bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm">
            <div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid ${g.type === 'BUSINESS' ? 'fa-building' : 'fa-users'}"></i></div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm flex items-center">${safeStr(g.name)} ${isPro} ${typeBadge}</h3>
                        <p class="text-xs text-slate-500 font-mono tracking-widest mt-0.5">קוד: ${g.group_code} | ⚡ ${aiTokens} | <span class="font-sans text-[10px]">הוקם: ${createdDate}</span></p>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-down text-slate-300"></i>
            </div>
            <div id="sa-group-details-${g.id}" class="hidden p-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                <div class="mt-3 mb-2 flex justify-between items-center gap-2 flex-wrap">
                    <h4 class="text-xs font-bold text-slate-600">פעולות:</h4>
                    <div class="flex gap-2">
                        ${impersonateBtn}
                        <button onclick="openSAEditGroupModal(${g.id}, '${safeStr(g.name)}', '${safeStr(g.admin_email)}')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-200 transition"><i class="fa-solid fa-pen"></i> ערוך פרטים</button>
                        ${proToggleBtn}
                        <button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחיקה</button>
                    </div>
                </div>
                ${uHtml}
            </div>
        </div>`;
    });
    groupsList.innerHTML = gHtml;
}

window.impersonateGroup = function(groupId, userId) {
    if(!confirm('השתלטות: אתה עומד להיכנס למערכת ב"מצב תמיכה" בסביבה המקורית של הלקוח בטאב חדש. להמשיך?')) return;
    
    // משיכת נתוני הסביבה והמשתמש מתוך הנתונים שכבר נטענו באדמין
    const targetGroup = saAllGroups.find(g => g.id === groupId);
    const targetUser = saAllUsers.find(u => u.id === userId);
    
    if (targetGroup && targetUser) {
        // מנקים סשן ישן אם קיים כדי לא לערבב נתונים
        localStorage.removeItem('ofl_session');
        
        // מרכיבים סשן גישה כ-Admin רגיל של הסביבה הנבחרת
        // (אין צורך למחוק את טוקן הסופר-אדמין, כי טאב האדמין נשאר פתוח)
        localStorage.setItem('ofl_session', JSON.stringify({ user: targetUser, group: targetGroup, isImpersonating: true }));
        
        showToast('success', 'פותח סביבת לקוח בטאב חדש...');
        
        // השהייה קלה כדי לוודא שהזיכרון נשמר, ואז פתיחה בטאב חדש
        setTimeout(() => {
            const targetUrl = targetGroup.type === 'BUSINESS' ? '/business.html' : '/';
            window.open(targetUrl, '_blank');
        }, 400);
    } else {
        showToast('error', 'שגיאה: לא ניתן למצוא נתוני קבוצה או משתמש בסביבה זו.');
    }
};
function filterSAGroups() { renderSAGroups(); }

async function saDeleteUser(id) {
    if (!confirm('למחוק משתמש זה מהמערכת כליל?')) return;
    await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken } });
    showToast('success', 'משתמש נמחק');
    loadSAData();
}

async function saDeleteGroup(id) {
    if (!confirm('האם למחוק סביבה זו לצמיתות?')) return;
    await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken } });
    showToast('success', 'הסביבה נמחקה לחלוטין');
    loadSAData();
}

async function saTogglePremium(id, enable) {
    if (!confirm(`האם אתה בטוח שברצונך ${enable ? 'להפעיל' : 'לבטל'} את מנוי ה-PRO לסביבה זו?`)) return;
    try {
        const res = await fetch(`${API}/superadmin/groups/${id}/premium`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ is_premium: enable, isPremium: enable, enable: enable })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', `מנוי PRO ${enable ? 'הופעל' : 'בוטל'} בהצלחה!`);
            loadSAData();
        } else {
            showToast('error', data.error || 'שגיאה בעדכון הסטטוס');
        }
    } catch (e) {
        showToast('error', 'שגיאת רשת בעדכון סטטוס מנוי');
    }
}

function openSAEditGroupModal(id, name, email) {
    const group = saAllGroups.find(g => g.id === id);
    
    getEl('sa-edit-group-id').value = id;
    getEl('sa-edit-group-name').value = name;
    getEl('sa-edit-group-email').value = email || '';
    
    // שליפה חכמה של ההרשאות - במידה ואין בשרת, נותן ברירת מחדל הכל פתוח (true) לעסק קיים
    let f = { store: true, b2b: true, academy: true, calendar: true, finance: true, inventory: true, crm: true, deliveries: true, foodcost: true, ai: true, timeclock: true, cashflow: true, budget: true, forecast: true, tasks: true, community: true, members: true, shifts: true };
    
    if (group && group.features) {
        try {
            f = typeof group.features === 'string' ? JSON.parse(group.features) : group.features;
        } catch(e) {}
    }
    
    // החלת ההגדרות על כל הצ'קבוקסים
    const setCb = (id, val) => { const el = getEl(id); if (el) el.checked = !!val; };
    setCb('flag-store', f.store);
    setCb('flag-b2b', f.b2b);
    setCb('flag-academy', f.academy);
    setCb('flag-calendar', f.calendar);
    setCb('flag-finance', f.finance);
    setCb('flag-inventory', f.inventory);
    setCb('flag-crm', f.crm);
    setCb('flag-deliveries', f.deliveries);
    setCb('flag-foodcost', f.foodcost);
    setCb('flag-ai', f.ai);
    setCb('flag-timeclock', f.timeclock !== undefined ? f.timeclock : true);
    setCb('flag-cashflow', f.cashflow !== undefined ? f.cashflow : true);
    setCb('flag-budget', f.budget !== undefined ? f.budget : true);
    setCb('flag-forecast', f.forecast !== undefined ? f.forecast : true);
    setCb('flag-tasks', f.tasks !== undefined ? f.tasks : true);
    setCb('flag-community', f.community !== undefined ? f.community : true);
    setCb('flag-members', f.members !== undefined ? f.members : true);
    setCb('flag-shifts', f.shifts !== undefined ? f.shifts : true); // הטאב החדש

    getEl('sa-edit-group-modal').classList.remove('hidden');
}

async function saveSAEditGroup() {
    const id = val('sa-edit-group-id');
    const name = val('sa-edit-group-name');
    const adminEmail = val('sa-edit-group-email');
    
    const getCb = (id) => { const el = getEl(id); return el ? el.checked : true; };

    const flags = {
        store: getCb('flag-store'),
        b2b: getCb('flag-b2b'),
        academy: getCb('flag-academy'),
        calendar: getCb('flag-calendar'),
        finance: getCb('flag-finance'),
        inventory: getCb('flag-inventory'),
        crm: getCb('flag-crm'),
        deliveries: getCb('flag-deliveries'),
        foodcost: getCb('flag-foodcost'),
        ai: getCb('flag-ai'),
        timeclock: getCb('flag-timeclock'),
        cashflow: getCb('flag-cashflow'),
        budget: getCb('flag-budget'),
        forecast: getCb('flag-forecast'),
        tasks: getCb('flag-tasks'),
        community: getCb('flag-community'),
        members: getCb('flag-members'),
        shifts: getCb('flag-shifts')
    };

    if (!name || !adminEmail) return showToast('error', 'שם ומייל לא יכולים להיות ריקים');
    
    try {
        // שמירה מקומית כדי שלא ייעלם ברענון האדמין
        const groupIndex = saAllGroups.findIndex(g => g.id === parseInt(id));
        if(groupIndex > -1) {
            saAllGroups[groupIndex].name = name;
            saAllGroups[groupIndex].admin_email = adminEmail;
            saAllGroups[groupIndex].features = flags; 
        }

        const res = await fetch(`${API}/sa/groups/${id}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, 
            body: JSON.stringify({ name, adminEmail, features: flags }) 
        });
        
        showToast('success', 'פרטי הסביבה וההרשאות עודכנו בהצלחה!');
        getEl('sa-edit-group-modal').classList.add('hidden');
        renderSAGroups();
        
    } catch (e) { showToast('error', 'שגיאת רשת בשמירת ההרשאות'); }
}

// פונקציית כפתורי הבחירה המהירה (Select All / Deselect All)
window.toggleAllSAFlags = function(checked) {
    document.querySelectorAll('.flag-cb').forEach(cb => cb.checked = checked);
};

// לוגיקת הפצת הודעות אמיתיות לתיבת ה-Inbox של הלקוחות
getEl('sa-inbox-target-type')?.addEventListener('change', (e) => {
    if (e.target.value === 'specific') {
        getEl('sa-inbox-specific-biz-wrapper').classList.remove('hidden');
    } else {
        getEl('sa-inbox-specific-biz-wrapper').classList.add('hidden');
    }
});

window.sendSABroadcastMessage = async function() {
    const subject = val('sa-inbox-subject');
    const content = val('sa-inbox-content');
    const targetType = val('sa-inbox-target-type');
    const targetValue = val('sa-inbox-target-value');
    
    if (!subject || !content) return showToast('error', 'חובה להזין נושא ותוכן להודעה');
    if (targetType === 'specific' && !targetValue) return showToast('error', 'יש להזין מזהה (ID) של הנמען');
    
    if (!confirm('האם אתה בטוח? הודעה זו תישלח לתיבות ה-Inbox של קהל היעד הנבחר.')) return;
    
    const btn = getEl('btn-sa-inbox-send');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> משגר למסד הנתונים...'; }
    
    try {
        const res = await fetch(`${API}/sa/inbox/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ targetType, targetValue, subject, content })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('success', `ההודעה שוגרה בהצלחה ל-${data.count || 0} נמענים!`);
            getEl('sa-inbox-subject').value = '';
            getEl('sa-inbox-content').value = '';
        } else {
            showToast('error', data.error || 'שגיאה בשליחת הודעה לשרת');
        }
    } catch(e) {
        showToast('error', 'שגיאת תקשורת מול השרת');
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> שגר לתיבת ההודעות'; }
    }
};

function openSAEditUserModal(id, nickname) {
    getEl('sa-edit-user-id').value = id;
    getEl('sa-edit-user-name').value = nickname;
    getEl('sa-edit-user-pass').value = '';
    getEl('sa-edit-user-modal').classList.remove('hidden');
}

async function saveSAEditUser() {
    const id = val('sa-edit-user-id');
    const nickname = val('sa-edit-user-name');
    const password = val('sa-edit-user-pass');
    if (!nickname) return showToast('error', 'כינוי לא יכול להיות ריק');
    try {
        const res = await fetch(`${API}/sa/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, password }) });
        if ((await res.json()).success) {
            showToast('success', 'המשתמש עודכן בהצלחה!');
            getEl('sa-edit-user-modal').classList.add('hidden');
            loadSAData();
        } else showToast('error', 'שגיאה בעדכון משתמש');
    } catch (e) { showToast('error', 'שגיאת רשת'); }
}

// --- קהילות ועסקים ---
async function loadSACommunityData() {
    try {
        const tbody = getEl('sa-communities-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> מפענח נתוני קהילות...</td></tr>`;

        try {
            const commRes = await fetch(`${API}/sa/communities`, { headers: { 'Authorization': saToken || '' } });
            const commData = await commRes.json();
            
            if(commData.success) {
                saCommunitiesCache = commData.communities || [];
                
                const totalCommunities = saCommunitiesCache.length;
                const totalCommMembers = saCommunitiesCache.reduce((sum, c) => sum + parseInt(c.family_count || 0), 0);
                const totalApprovedConnections = saCommunitiesCache.reduce((sum, c) => sum + parseInt(c.business_count || 0), 0);

                if (getEl('sa-stat-communities')) getEl('sa-stat-communities').innerText = totalCommunities;
                if (getEl('sa-stat-connections')) getEl('sa-stat-connections').innerText = totalApprovedConnections;

                renderSACommunitiesTable();
            } else {
                if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-red-500 bg-red-50 rounded-xl">שגיאת שרת: ${commData.error}</td></tr>`;
            }
        } catch(e) { 
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-red-500">שגיאת תקשורת בטעינת קהילות</td></tr>`;
        }

        try {
            let bizRes = await fetch(`${API}/sa/businesses`, { headers: { 'Authorization': saToken || '' } });
            if (!bizRes.ok) bizRes = await fetch(`${API}/store/coupons/all`); 
            
            if (bizRes.ok) {
                const bizData = await bizRes.json();
                if(bizData.success) {
                    saBusinessesCache = bizData.businesses || [];
                    renderSABusinessesTable();
                }
            }
        } catch(e) {}

        loadSAPendingRequests();

    } catch(e) { console.error('General error in loadSACommunityData:', e); }
}

function handleSmartCommSearch() {
    const input = getEl('sa-smart-comm-search');
    const resultsContainer = getEl('sa-smart-comm-results');
    const query = input.value.toLowerCase().trim();
    
    if (!query) {
        resultsContainer.classList.add('hidden');
        return;
    }

    const filtered = saCommunitiesCache.filter(c => 
        (c.name && c.name.toLowerCase().includes(query)) || 
        (c.city && c.city.toLowerCase().includes(query)) ||
        (String(c.family_count) === query)
    ).slice(0, 10);

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div class="p-3 text-sm text-slate-500 text-center">לא נמצאו קהילות תואמות.</div>';
    } else {
        resultsContainer.innerHTML = filtered.map(c => `
            <div onclick="selectSmartComm(${c.id}, '${safeStr(c.name)}')" class="p-3 border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition">
                <div class="font-bold text-slate-800 text-sm flex justify-between">
                    <span>${safeStr(c.name)}</span>
                    <span class="text-[10px] bg-slate-100 text-slate-500 px-2 rounded-full flex items-center gap-1"><i class="fa-solid fa-house"></i> ${c.family_count || 0} משפחות</span>
                </div>
                <div class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-location-dot text-indigo-400"></i> אזורים: ${safeStr(c.city || 'כללי')}</div>
            </div>
        `).join('');
    }
    resultsContainer.classList.remove('hidden');
}

function selectSmartComm(id, name) {
    getEl('sa-link-comm').value = id;
    getEl('sa-smart-comm-search').value = '';
    getEl('sa-smart-comm-search').classList.add('hidden');
    getEl('sa-smart-comm-results').classList.add('hidden');
    
    const display = getEl('sa-selected-comm-display');
    display.querySelector('span').innerText = `קהילה נבחרה: ${name}`;
    display.classList.remove('hidden');
    
    loadCommunityBusinesses();
}

function clearSmartCommSelection() {
    getEl('sa-link-comm').value = '';
    getEl('sa-selected-comm-display').classList.add('hidden');
    const searchInput = getEl('sa-smart-comm-search');
    searchInput.classList.remove('hidden');
    searchInput.focus();
    getEl('sa-comm-biz-list').innerHTML = 'יש לבחור קהילה ממעל';
}

function handleSmartBizSearch() {
    const input = getEl('sa-smart-biz-search');
    const resultsContainer = getEl('sa-smart-biz-results');
    const query = input.value.toLowerCase().trim();
    
    if (!query) {
        resultsContainer.classList.add('hidden');
        return;
    }

    const filtered = saBusinessesCache.filter(b => 
        (b.name && b.name.toLowerCase().includes(query))
    ).slice(0, 10);

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div class="p-3 text-sm text-slate-500 text-center">לא נמצאו עסקים תואמים.</div>';
    } else {
        resultsContainer.innerHTML = filtered.map(b => `
            <div onclick="selectSmartBiz(${b.id}, '${safeStr(b.name)}')" class="p-3 border-b border-slate-100 hover:bg-emerald-50 cursor-pointer transition">
                <div class="font-bold text-slate-800 text-sm flex items-center gap-2"><i class="fa-solid fa-store text-emerald-500"></i> ${safeStr(b.name)}</div>
            </div>
        `).join('');
    }
    resultsContainer.classList.remove('hidden');
}

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

async function openSACommunityModal(id) {
    const comm = saCommunitiesCache.find(c => c.id == id);
    if(!comm) return;
    
    getEl('sa-edit-comm-id').value = comm.id;
    getEl('sa-edit-comm-title').innerText = comm.name;
    getEl('sa-edit-comm-name').value = comm.name;
    getEl('sa-edit-comm-code').value = comm.code;
    getEl('sa-edit-comm-email').value = comm.manager_email;
    getEl('sa-edit-comm-pass').value = comm.manager_password;
    
    editCityTags = comm.city ? comm.city.split(',').map(c => c.trim()).filter(c => c) : [];
    updateCityTagsDisplay('edit');

    getEl('sa-edit-comm-image-base64').value = '';
    const imgPreview = getEl('sa-edit-comm-img-preview');
    const placeholder = getEl('sa-edit-comm-img-placeholder');
    if (comm.image_url) {
        imgPreview.src = comm.image_url;
        imgPreview.classList.remove('hidden');
        if(placeholder) placeholder.classList.add('hidden');
    } else {
        imgPreview.src = '';
        imgPreview.classList.add('hidden');
        if(placeholder) placeholder.classList.remove('hidden');
    }
    
    getEl('sa-edit-comm-fam-count').innerText = comm.family_count || 0;
    getEl('sa-edit-comm-biz-count').innerText = comm.business_count || 0;
    
    const searchInput = getEl('sa-search-comm-fam');
    if (searchInput) searchInput.value = '';
    
    const famList = getEl('sa-edit-comm-families');
    const bizList = getEl('sa-edit-comm-businesses');
    famList.innerHTML = '<p class="text-xs text-slate-400 p-2">טוען נתונים...</p>';
    bizList.innerHTML = '<p class="text-xs text-slate-400 p-2">טוען נתונים...</p>';
    
    getEl('sa-community-modal').classList.remove('hidden');
    
    try {
        const res = await fetch(`${API}/sa/communities/${id}/details`);
        const data = await res.json();
        if(data.success) {
            currentCommFamiliesCache = data.families || [];
            renderSACommFamilies();
            
            if(data.businesses.length === 0) {
                bizList.innerHTML = '<p class="text-xs text-slate-400 p-2 bg-slate-50 border border-dashed rounded-lg text-center mt-2">אין עסקים נותני הנחה.</p>';
            } else {
                bizList.innerHTML = data.businesses.map(b => `<div class="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm mb-1.5 text-xs flex justify-between items-center"><span class="font-bold text-slate-700 flex items-center gap-2"><i class="fa-solid fa-store text-slate-300"></i> ${safeStr(b.name)}</span><span class="text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-100">${b.discount_pct}% הנחה</span></div>`).join('');
            }
        }
    } catch(e) {
        famList.innerHTML = '<p class="text-xs text-red-400 p-2">שגיאה בטעינה</p>';
        bizList.innerHTML = '<p class="text-xs text-red-400 p-2">שגיאה בטעינה</p>';
    }
}

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

        return `
        <div class="bg-white rounded-lg border border-slate-200 mb-1.5 overflow-hidden shadow-sm">
            <div class="p-2.5 text-xs flex justify-between items-center cursor-pointer hover:bg-blue-50 transition group" onclick="document.getElementById('sa-comm-fam-${f.id}').classList.toggle('hidden')">
                <div class="font-bold text-slate-700 flex items-center gap-2">
                    <i class="fa-solid fa-users text-slate-300 group-hover:text-blue-400 transition"></i> ${safeStr(f.name)}
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tracking-widest border border-slate-200">קוד: ${safeStr(f.group_code || '---')}</span>
                    <i class="fa-solid fa-chevron-down text-[10px] text-slate-300"></i>
                </div>
            </div>
            <div id="sa-comm-fam-${f.id}" class="hidden flex flex-col">
                ${usersHtml}
            </div>
        </div>`;
    }).join('');
}

function filterSACommFamilies() {
    const query = getEl('sa-search-comm-fam') ? getEl('sa-search-comm-fam').value : '';
    renderSACommFamilies(query);
}

async function saveSACommunityEdit() {
    const id = val('sa-edit-comm-id');
    const name = val('sa-edit-comm-name');
    const code = val('sa-edit-comm-code');
    const email = val('sa-edit-comm-email');
    const pass = val('sa-edit-comm-pass');
    const cityData = val('sa-edit-comm-city-data'); 
    const imageUrl = val('sa-edit-comm-image-base64');
    
    if(!name || !code) return showToast('error', 'שם וקוד חובה');
    if(!cityData) return showToast('error', 'חובה להגדיר לפחות אזור גאוגרפי אחד לקהילה');

    try {
        const res = await fetch(`${API}/sa/communities/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, city: cityData, code, managerEmail: email, managerPassword: pass, imageUrl}) });
        if((await res.json()).success) {
            showToast('success', 'הקהילה עודכנה בהצלחה!');
            getEl('sa-community-modal').classList.add('hidden');
            loadSACommunityData();
        } else showToast('error', 'שגיאה בעדכון הקהילה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteSACommunity() {
    const id = val('sa-edit-comm-id');
    if(!confirm('אזהרה: מחיקת הקהילה תנתק את כל המשפחות והעסקים המקושרים אליה. פעולה זו בלתי הפיכה! האם להמשיך?')) return;
    try {
        const res = await fetch(`${API}/sa/communities/${id}`, { method: 'DELETE' });
        if((await res.json()).success) {
            showToast('success', 'הקהילה נמחקה לחלוטין!');
            getEl('sa-community-modal').classList.add('hidden');
            loadSACommunityData();
        } else showToast('error', 'שגיאה במחיקת הקהילה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function createSACommunity() {
    const name = val('sa-comm-name'); 
    const code = val('sa-comm-code'); 
    const email = val('sa-comm-email'); 
    const pass = val('sa-comm-pass');
    const cityData = val('sa-comm-city-data'); 
    const imageUrl = val('sa-comm-image-base64');
    
    if(!name || !code || !cityData) return showToast('error', 'שם הקהילה, ערים וקוד - שדות חובה.');
    
    const btn = document.querySelector('button[onclick="createSACommunity()"]');
    if(btn) { btn.disabled = true; btn.innerText = 'מקים...'; }
    
    try {
        const res = await fetch(`${API}/sa/communities`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, city: cityData, code, managerEmail: email, managerPassword: pass, imageUrl})});
        const data = await res.json();
        if(data.success) { 
            showToast('success', 'קהילה הוקמה בהצלחה!'); 
            getEl('sa-comm-name').value=''; getEl('sa-comm-city-input').value=''; getEl('sa-comm-code').value=''; getEl('sa-comm-email').value=''; getEl('sa-comm-pass').value=''; 
            getEl('sa-comm-image-base64').value=''; const prevCont = getEl('sa-comm-img-preview-container'); if(prevCont) prevCont.classList.add('hidden');
            createCityTags = []; updateCityTagsDisplay('create');
            loadSACommunityData(); 
        } else { 
            showToast('error', data.error || 'שגיאה ביצירת הקהילה'); 
        }
    } catch(e) { 
        showToast('error', 'שגיאת תקשורת מול השרת'); 
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = 'הקמת קהילה'; }
    }
}

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
            openSABusinessModal(bizId); 
            loadSACommunityData(); 
        }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function linkBizToCommunity() {
    const communityId = val('sa-link-comm'); 
    const businessId = val('sa-link-biz'); 
    let discountPct = val('sa-link-discount');
    discountPct = discountPct ? parseFloat(discountPct) : 0;
    
    if(!communityId || !businessId) return showToast('error', 'חובה לבחור קהילה ועסק');
    
    try {
        const res = await fetch(`${API}/sa/community-business`, { 
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                'Authorization': typeof saToken !== 'undefined' ? saToken : (localStorage.getItem('ofl_sa_token') || '')
            }, 
            body: JSON.stringify({ communityId, businessId, discountPct })
        });
        
        const data = await res.json();
        if(data.success) { 
            showToast('success', 'העסק שויך לקהילה!'); 
            if(typeof loadCommunityBusinesses === 'function') loadCommunityBusinesses(); 
            if(typeof loadSACommunityData === 'function') loadSACommunityData(); 
            if(typeof clearSmartBizSelection === 'function') clearSmartBizSelection(); 
        } else { 
            showToast('error', data.error || 'שגיאה בחיבור העסק'); 
        }
    } catch(e) { 
        showToast('error', 'שגיאת תקשורת מול השרת'); 
    }
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

function updateCityTagsDisplay(type) {
    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    const container = getEl(type === 'create' ? 'sa-comm-city-tags' : 'sa-edit-comm-city-tags');
    const dataInput = getEl(type === 'create' ? 'sa-comm-city-data' : 'sa-edit-comm-city-data');
    if (!container || !dataInput) return;

    if (tagsArr.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-slate-400 w-full text-center my-auto">לא נבחרו ערים. חובה לבחור לפחות עיר אחת.</p>';
        dataInput.value = '';
        return;
    }

    container.innerHTML = tagsArr.map((city, index) => `
        <div class="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-orange-200 shadow-sm animate-bounce-in">
            ${city}
            <button onclick="removeCityTag('${type}', ${index})" class="text-orange-500 hover:text-red-500 transition focus:outline-none"><i class="fa-solid fa-times"></i></button>
        </div>
    `).join('');
    dataInput.value = tagsArr.join(', ');
}

window.addCityTag = function(type) {
    const input = getEl(type === 'create' ? 'sa-comm-city-input' : 'sa-edit-comm-city-input');
    if (!input) return;
    const valStr = input.value.trim();
    if (!valStr) return;

    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    if (!tagsArr.includes(valStr)) {
        tagsArr.push(valStr);
        updateCityTagsDisplay(type);
    }
    input.value = '';
}

window.removeCityTag = function(type, index) {
    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    tagsArr.splice(index, 1);
    updateCityTagsDisplay(type);
}

window.handleCommImageUpload = function(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width; let height = img.height;
            const maxSize = 600;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            
            if (type === 'create') {
                getEl('sa-comm-image-base64').value = base64;
                getEl('sa-comm-img-preview').src = base64;
                getEl('sa-comm-img-preview-container').classList.remove('hidden');
            } else {
                getEl('sa-edit-comm-image-base64').value = base64;
                getEl('sa-edit-comm-img-preview').src = base64;
                getEl('sa-edit-comm-img-preview').classList.remove('hidden');
                const placeholder = getEl('sa-edit-comm-img-placeholder');
                if (placeholder) placeholder.classList.add('hidden');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

window.handleBannerImageUpload = function(event, targetInputId, previewId) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxWidth = 1200; 
            
            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            
            const targetInput = document.getElementById(targetInputId);
            if (targetInput) targetInput.value = base64;
            
            const previewImg = document.getElementById(previewId);
            if (previewImg) {
                previewImg.src = base64;
                previewImg.classList.remove('hidden');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ==========================================
// --- ניהול קריאות שירות (Super Admin) ---
// ==========================================
let saCurrentTicketId = null;

async function loadSATickets() {
    const list = getEl('sa-tickets-full-list');
    if(!list) return;
    list.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3"></i><p>טוען קריאות שירות...</p></div>';
    try {
        const res = await fetch(`${API}/superadmin/tickets`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) {
            saTicketsCache = data.tickets || [];
            renderSATickets();
        } else {
            list.innerHTML = '<div class="col-span-full text-center text-red-500">שגיאה בטעינת קריאות</div>';
        }
    } catch(e) { list.innerHTML = '<div class="col-span-full text-center text-red-500">שגיאת תקשורת</div>'; }
}

function filterSATickets() { renderSATickets(); }

function renderSATickets() {
    const list = getEl('sa-tickets-full-list');
    if (!list) return;
    
    const query = val('sa-search-tickets').toLowerCase().trim();
    let filtered = saTicketsCache;
    
    if (query) {
        filtered = filtered.filter(t => 
            String(t.id).includes(query) || 
            (t.subject && t.subject.toLowerCase().includes(query)) ||
            (t.group_name && t.group_name.toLowerCase().includes(query)) ||
            (t.user_name && t.user_name.toLowerCase().includes(query))
        );
    }
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">לא נמצאו קריאות התואמות לחיפוש.</div>';
        return;
    }

    let html = '';
    const statusMap = {
        'open': { text: 'פתוח (ממתין)', color: 'bg-red-100 text-red-700 border-red-200' },
        'in_progress': { text: 'בטיפול', color: 'bg-orange-100 text-orange-700 border-orange-200' },
        'resolved': { text: 'סגור', color: 'bg-green-100 text-green-700 border-green-200 opacity-60' }
    };

    filtered.forEach(t => {
        const st = statusMap[t.status] || statusMap['open'];
        const dateStr = new Date(t.created_at).toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'});
        
        html += `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition cursor-pointer" onclick="openSATicketModal(${t.id})">
            <div>
                <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div class="pr-2">
                        <span class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mb-2 inline-block">קריאה #${t.id}</span>
                        <h4 class="font-bold text-slate-800 text-base leading-tight">${safeStr(t.subject)}</h4>
                        <p class="text-[11px] text-slate-500 mt-1.5"><i class="fa-solid fa-building mr-1 text-slate-300"></i> ${safeStr(t.group_name)}</p>
                    </div>
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-md border ${st.color} whitespace-nowrap">${st.text}</span>
                </div>
                <p class="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">${safeStr(t.description)}</p>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 font-bold bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span><i class="fa-solid fa-user mr-1"></i> ${safeStr(t.user_name)}</span>
                <span><i class="fa-regular fa-clock mr-1"></i> ${dateStr}</span>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

function openSATicketModal(id) {
    const t = saTicketsCache.find(x => x.id === id);
    if(!t) return;
    
    saCurrentTicketId = id;
    getEl('sa-ticket-modal-id').innerText = t.id;
    getEl('sa-ticket-modal-subject').innerText = t.subject;
    getEl('sa-ticket-modal-group').innerText = t.group_name || 'לא ידוע';
    getEl('sa-ticket-modal-user').innerText = t.user_name || 'לא ידוע';
    
    getEl('sa-ticket-reply-text').value = '';
    getEl('sa-ticket-reply-status').value = t.status;
    
    let logArr = [];
    try { logArr = typeof t.log === 'string' ? JSON.parse(t.log) : (t.log || []); } catch(e) {}
    
    const logContainer = getEl('sa-ticket-log');
    if (logArr.length === 0) {
        logContainer.innerHTML = `<div class="bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-600 shadow-sm">${safeStr(t.description)}</div>`;
    } else {
        logContainer.innerHTML = logArr.map(entry => {
            const isStaff = entry.isStaff;
            const alignClass = isStaff ? 'self-end bg-blue-100 border-blue-200 text-blue-900 rounded-tr-none ml-8' : 'self-start bg-white border-slate-200 text-slate-700 rounded-tl-none mr-8';
            const iconHtml = isStaff ? '<i class="fa-solid fa-headset text-blue-500 text-xs ml-1"></i>' : '<i class="fa-solid fa-user text-slate-400 text-xs ml-1"></i>';
            const timeStr = new Date(entry.date).toLocaleString('he-IL', {dateStyle:'short', timeStyle:'short'});
            
            return `
            <div class="flex flex-col ${isStaff ? 'items-end' : 'items-start'} mb-3 fade-in">
                <div class="p-3 rounded-xl border shadow-sm text-sm whitespace-pre-wrap leading-relaxed ${alignClass}">
                    ${safeStr(entry.message)}
                </div>
                <div class="text-[9px] text-slate-400 mt-1 font-bold flex items-center gap-1">
                    ${iconHtml} ${safeStr(entry.sender)} • ${timeStr}
                </div>
            </div>`;
        }).join('');
    }
    
    getEl('sa-ticket-modal').classList.remove('hidden');
    setTimeout(() => { logContainer.scrollTop = logContainer.scrollHeight; }, 50);
}

async function submitSATicketReply() {
    const text = val('sa-ticket-reply-text');
    const status = val('sa-ticket-reply-status');
    
    if(!text.trim() && !status) return showToast('error', 'יש להזין טקסט או לשנות סטטוס');
    
    const btn = getEl('btn-sa-ticket-reply');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';
    
    try {
        const payload = { message: text || `(סטטוס שונה ל-${status})`, userName: 'צוות תמיכה', isStaff: true, newStatus: status || null };
        const res = await fetch(`${API}/support/tickets/${saCurrentTicketId}/reply`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify(payload)
        });
        if((await res.json()).success) {
            showToast('success', 'התגובה נשלחה והסטטוס עודכן!');
            getEl('sa-ticket-reply-text').value = '';
            await loadSATickets();
            openSATicketModal(saCurrentTicketId); 
        } else { showToast('error', 'שגיאה בעדכון'); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
    finally { btn.disabled = false; btn.innerHTML = 'שלח תגובה ועדכן <i class="fa-solid fa-paper-plane"></i>'; }
}

async function updateSATicketStatus(id, status) {
    try {
        const res = await fetch(`${API}/superadmin/tickets/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'סטטוס קריאה עודכן בהצלחה');
            loadSATickets();
        } else {
            showToast('error', 'שגיאה בעדכון הסטטוס');
        }
    } catch(e) { showToast('error', 'שגיאת תקשורת בעדכון הסטטוס'); }    
}
// ==========================================
// --- ניהול שותפים ומטמיעים (Partners) ---
// ==========================================

let mockPartnerCounter = 1;

async function loadSAPartners() {
    // השהייה קטנה להדמיית טעינה מהשרת
    setTimeout(() => {
        renderSAPartnersTable();
    }, 300);
}

function renderSAPartnersTable() {
    const tbody = getEl('sa-partners-table-body');
    if (!tbody) return;

    if (saPartnersCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">אין שותפים רשומים במערכת עדיין.</td></tr>`;
        return;
    }

    tbody.innerHTML = saPartnersCache.map(p => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><i class="fa-solid fa-user-tie"></i></div>
                <div>
                    ${safeStr(p.name)}
                    <div class="text-[10px] text-slate-500 mt-0.5">נוצר: ${new Date(p.created_at).toLocaleDateString('he-IL')}</div>
                </div>
            </td>
            <td class="px-4 py-4 text-slate-600 text-right dir-ltr font-mono text-sm">${safeStr(p.email)}</td>
            <td class="px-4 py-4 text-center">
                <span class="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold text-xs"><i class="fa-solid fa-link"></i> ${p.clients_count || 0} לקוחות</span>
            </td>
            <td class="px-4 py-4 text-center">
                <button onclick="deleteSAPartner(${p.id})" class="text-red-400 hover:text-red-600 bg-red-50 w-8 h-8 rounded-lg shadow-sm transition inline-flex items-center justify-center"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openSAAddPartnerModal() {
    let modal = getEl('sa-add-partner-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sa-add-partner-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 fade-in';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative">
                <button onclick="document.getElementById('sa-add-partner-modal').classList.add('hidden')" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                <h3 class="text-xl font-bold mb-4 text-slate-800"><i class="fa-solid fa-user-plus text-emerald-500 mr-2"></i> הוספת שותף/מטמיע</h3>
                
                <label class="text-xs font-bold text-slate-500 mb-1 block">שם מלא / שם העסק:</label>
                <input type="text" id="sa-partner-name" class="modern-input mb-3" placeholder="למשל: סוכנות הטמעות בע&quot;מ">
                
                <label class="text-xs font-bold text-slate-500 mb-1 block">כתובת אימייל להתחברות:</label>
                <input type="email" id="sa-partner-email" class="modern-input mb-3 text-left dir-ltr" placeholder="partner@email.com">
                
                <label class="text-xs font-bold text-slate-500 mb-1 block">סיסמה ראשונית:</label>
                <input type="text" id="sa-partner-pass" class="modern-input mb-6 text-left dir-ltr" placeholder="12345678">
                
                <div class="flex gap-3">
                    <button onclick="document.getElementById('sa-add-partner-modal').classList.add('hidden')" class="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition">ביטול</button>
                    <button onclick="saveNewPartner()" class="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-md hover:bg-emerald-600 transition">שמור וצור</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.classList.remove('hidden');
    }
    
    getEl('sa-partner-name').value = '';
    getEl('sa-partner-email').value = '';
    getEl('sa-partner-pass').value = '';
}

async function saveNewPartner() {
    const name = val('sa-partner-name');
    const email = val('sa-partner-email');
    const password = val('sa-partner-pass');
    
    if (!name || !email || !password) return showToast('error', 'יש למלא את כל השדות');
    
    // סימולציה של שמירה בשרת לטובת ה-UI
    const newPartner = {
        id: mockPartnerCounter++,
        name: name,
        email: email,
        created_at: new Date().toISOString(),
        clients_count: 0
    };
    
    saPartnersCache.push(newPartner);
    
    showToast('success', 'שותף חדש הוקם בהצלחה (בזיכרון הזמני)!');
    getEl('sa-add-partner-modal').classList.add('hidden');
    renderSAPartnersTable();
}

async function deleteSAPartner(id) {
    if(!confirm('האם אתה בטוח שברצונך למחוק שותף זה? الفעולה לא תמחק את לקוחותיו, אך תנתק אותם ממנו.')) return;
    
    // מחיקה מההדמיה בזיכרון המקומי
    saPartnersCache = saPartnersCache.filter(p => p.id !== id);
    showToast('success', 'השותף נמחק בהצלחה');
    renderSAPartnersTable();
}
// ==========================================
// OVERRIDE FINAL: פתיחת השתלטות בטאב חדש (פתרון בעיית הניתוב הראשוני)
// ==========================================
window.impersonateGroup = function(groupId, userId) {
    const targetGroup = saAllGroups.find(g => g.id === groupId);
    const targetUser = saAllUsers.find(u => u.id === userId);
    
    if (targetGroup && targetUser) {
        // 1. ניקוי מוחלט של סשנים קודמים לפני התחלה
        localStorage.removeItem('ofl_session');
        
        // 2. כתיבה מחדש של הסשן המדויק
        const sessionData = { 
            user: targetUser, 
            group: targetGroup, 
            isImpersonating: true 
        };
        
        localStorage.setItem('ofl_session', JSON.stringify(sessionData));
        showToast('success', 'יוצר חיבור לסביבת הלקוח...');
        
        // 3. פתיחה בטאב חדש עם מנגנון מניעת Cache (מוסיף חותמת זמן ל-URL)
        setTimeout(() => {
            const baseUrl = targetGroup.type === 'BUSINESS' ? '/business.html' : '/';
            const cleanUrl = `${baseUrl}?session_refresh=${Date.now()}`;
            window.open(cleanUrl, '_blank');
        }, 300);
    } else {
        showToast('error', 'שגיאה: נתוני הלקוח לא נמצאו בזיכרון המנהל.');
    }
};
