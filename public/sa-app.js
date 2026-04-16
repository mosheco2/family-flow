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
    ['stats', 'comm', 'content', 'users', 'biz', 'support'].forEach(t => {
        const view = document.getElementById(`sa-view-${t}`);
        const btn = document.getElementById(`btn-sa-tab-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.className = 'flex-1 py-3 px-4 text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl transition';
    });
    const activeView = document.getElementById(`sa-view-${tabId}`);
    const activeBtn = document.getElementById(`btn-sa-tab-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) {
        if(tabId === 'support') {
            activeBtn.className = 'flex-1 py-3 px-4 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl shadow-sm transition';
        } else {
            activeBtn.className = 'flex-1 py-3 px-4 text-sm font-bold bg-white text-slate-800 rounded-xl shadow-sm transition';
        }
    }
}
async function loadSAData() {
    try {
        const res = await fetch(`${API}/superadmin/data`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.error) return showToast('error', 'שגיאת שרת: ' + data.error);

        const setVal = (id, v) => { const e = getEl(id); if (e) e.value = v || ''; };
        setVal('sa-new-username', data.saUsername);
        setVal('sa-new-email', data.saEmail);
        setVal('sa-welcome-msg', data.welcomeMsg);
        setVal('sa-biz-welcome-msg', data.businessWelcomeMsg);
        setVal('sa-banner-top-text', data.adBannerTextTop);
        setVal('sa-banner-top-link', data.adBannerLinkTop);
        setVal('sa-banner-top-img', data.adBannerImgTop);
        setVal('sa-banner-bottom-text', data.adBannerTextBottom);
        setVal('sa-banner-bottom-link', data.adBannerLinkBottom);
        setVal('sa-banner-bottom-img', data.adBannerImgBottom);
        setVal('sa-biz-banner-top-text', data.bizBannerTextTop);
        setVal('sa-biz-banner-top-link', data.bizBannerLinkTop);
        setVal('sa-biz-banner-top-img', data.bizBannerImgTop);
        setVal('sa-biz-banner-bottom-text', data.bizBannerTextBottom);
        setVal('sa-biz-banner-bottom-link', data.bizBannerLinkBottom);
        setVal('sa-biz-banner-bottom-img', data.bizBannerImgBottom);

        const setTxt = (id, v) => { const e = getEl(id); if (e) e.innerText = v || 0; };
        if (data.stats) {
            setTxt('sa-stat-families', data.stats.families);
            setTxt('sa-stat-businesses', data.stats.businesses);
            setTxt('sa-stat-family-users', data.stats.familyUsers);
            setTxt('sa-stat-biz-users', data.stats.businessUsers);
        }

        const actList = getEl('sa-activity-list');
        if (actList) {
            actList.innerHTML = data.activity.map(a => {
                const amountHtml = a.is_financial ? `<span class="font-bold text-slate-800 dir-ltr">(₪${a.amount})</span>` : `<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">הרשמה</span>`;
                return `<div class="text-xs border-b pb-2 mb-2 flex justify-between items-center"><div class="flex-1"><span class="font-bold text-slate-700">${new Date(a.date).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span> | ${safeStr(a.group_name)} | <span class="font-bold">${safeStr(a.user_name)}</span> | ${safeStr(a.description)}</div> ${amountHtml}</div>`;
            }).join('');
            if (data.activity.length === 0) actList.innerHTML = '<p class="text-slate-400 text-sm">אין פעילות עדיין במערכת...</p>';
        }
        saAllGroups = data.groups || [];
        saAllUsers = data.users || [];
        renderSAGroups();
        loadSACommunityData();
        
        if (typeof loadSATickets === 'function') {
            loadSATickets();
        }
    } catch (e) { showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
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

async function saveAllBanners() {
    try {
        const res = await fetch(`${API}/superadmin/banners`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({
                topText: val('sa-banner-top-text'), topLink: val('sa-banner-top-link'), topImg: val('sa-banner-top-img'),
                bottomText: val('sa-banner-bottom-text'), bottomLink: val('sa-banner-bottom-link'), bottomImg: val('sa-banner-bottom-img'),
                bizTopText: val('sa-biz-banner-top-text'), bizTopLink: val('sa-biz-banner-top-link'), bizTopImg: val('sa-biz-banner-top-img'),
                bizBottomText: val('sa-biz-banner-bottom-text'), bizBottomLink: val('sa-biz-banner-bottom-link'), bizBottomImg: val('sa-biz-banner-bottom-img')
            })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'הבאנרים נשמרו בהצלחה!'); } else { showToast('error', 'שגיאה בשמירת הבאנרים'); }
    } catch (e) { showToast('error', 'תקלת רשת מול השרת'); }
}

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
                    <h4 class="text-xs font-bold text-slate-600">משתמשים:</h4>
                    <div class="flex gap-2">
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
    getEl('sa-edit-group-id').value = id;
    getEl('sa-edit-group-name').value = name;
    getEl('sa-edit-group-email').value = email || '';
    getEl('sa-edit-group-modal').classList.remove('hidden');
}

async function saveSAEditGroup() {
    const id = val('sa-edit-group-id');
    const name = val('sa-edit-group-name');
    const adminEmail = val('sa-edit-group-email');
    if (!name || !adminEmail) return showToast('error', 'שם ומייל לא יכולים להיות ריקים');
    try {
        const res = await fetch(`${API}/sa/groups/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ name, adminEmail }) });
        if ((await res.json()).success) {
            showToast('success', 'פרטי הסביבה עודכנו בהצלחה');
            getEl('sa-edit-group-modal').classList.add('hidden');
            loadSAData();
        } else showToast('error', 'שגיאה בעדכון הנתונים');
    } catch (e) { showToast('error', 'שגיאת רשת'); }
}

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
