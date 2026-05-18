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
let saPartnersCache = [];
let currentCommFamiliesCache = [];
let createCityTags = [];
let editCityTags = [];

window.onload = () => {
    const savedToken = localStorage.getItem('ofl_sa_token');
    const savedUser = localStorage.getItem('ofl_sa_user');
    if (savedToken && savedUser) {
        saToken = savedToken;
        window.currentSAUser = JSON.parse(savedUser);
        
        // סנכרון שם המשתמש המחובר בסרגל העליון (סעיף 3)
        const nameEl = getEl('topbar-user-name');
        if (nameEl && window.currentSAUser.name) {
            nameEl.innerText = window.currentSAUser.name;
        }
        
        getEl('auth-container').classList.add('hidden');
        getEl('sa-dashboard-container').classList.remove('hidden');
        applyUserPermissions();
        loadSAData();
        window.switchSATab('pulse');
        
        // טעינה ורינדור ראשוני של תיבת ההתראות והמונה
        window.renderSANotifications();
    }
};

window.applyUserPermissions = function() {
    if (!window.currentSAUser) return;
    const perms = window.currentSAUser.permissions || [];
    const isMaster = perms.includes('all');
    
    // הוספנו את הטאבים ה"פתוחים" למפת ההרשאות כדי שהלולאה תסיר מהם את ה-hidden
    const tabRequirements = {
        'pulse': 'open',
        'dashboard': 'open',
        'clients': 'open',
        'support': 'support', 'devops': 'devops', 'stats': 'stats',
        'comm': 'comm', 'biz': 'biz', 'content': 'content',
        'hr': 'users', 'inbox': 'marketing', 'partners': 'all'
    };

    Object.keys(tabRequirements).forEach(tab => {
        const btn = getEl(`btn-sa-tab-${tab}`);
        if (!btn) return;
        
        btn.classList.remove('opacity-40'); 
        
        // מוצג אם זה מאסטר, אם הטאב פתוח לכולם, או אם יש למשתמש הרשאה ספציפית
        if (isMaster || tabRequirements[tab] === 'open' || perms.includes(tabRequirements[tab])) {
            btn.classList.remove('hidden');
            btn.classList.add('flex'); // תצוגת בלוק פלקס ל-Sidebar
        } else {
            btn.classList.add('hidden');
            btn.classList.remove('flex');
        }
    });
};

window.checkTabAccess = function(tabId) {
    if (!window.currentSAUser) return false;
    const perms = window.currentSAUser.permissions || [];
    
    // מעודכן לאפשר גישה גם לדשבורד
    if (perms.includes('all') || tabId === 'pulse' || tabId === 'dashboard' || tabId === 'clients') return true;
    
    const req = {
        'support': 'support', 'devops': 'devops', 'stats': 'stats',
        'comm': 'comm', 'biz': 'biz', 'content': 'content', 
        'hr': 'users', 'inbox': 'marketing', 'partners': 'all'
    };
    
    if (req[tabId] && !perms.includes(req[tabId])) return false;
    return true;
};

// פתיחה וסגירה של סרגל הצד במסכי מובייל
window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('sa-sidebar');
    const backdrop = document.getElementById('sa-sidebar-backdrop');
    if (sidebar && backdrop) {
        sidebar.classList.toggle('translate-x-full');
        backdrop.classList.toggle('hidden');
    }
};

window.updateSADashboard = async function() {
    try {
        if (window.checkTabAccess('support')) {
            if (saTicketsCache.length === 0) {
                const resT = await fetch(`${API}/superadmin/tickets`, { headers: { 'Authorization': saToken } });
                const dataT = await resT.json();
                if (dataT.success) saTicketsCache = dataT.tickets || [];
            }
            const openTickets = saTicketsCache.filter(t => t.status === 'open' || t.status === 'in_progress').length;
            if(getEl('dash-open-tickets')) getEl('dash-open-tickets').innerText = openTickets;
        } else {
            if(getEl('dash-open-tickets')) getEl('dash-open-tickets').innerText = '🔒';
        }
        
        if (window.checkTabAccess('devops')) {
            if (typeof devKanbanTasks !== 'undefined' && devKanbanTasks.length === 0) {
                const resK = await fetch(`${API}/sa/dev/tasks`, { headers: { 'Authorization': saToken } });
                const dataK = await resK.json();
                if (dataK.success) devKanbanTasks = dataK.tasks || [];
            }
            const openTasks = typeof devKanbanTasks !== 'undefined' ? devKanbanTasks.filter(t => t.status === 'backlog' || t.status === 'in_progress').length : 0;
            if(getEl('dash-open-tasks')) getEl('dash-open-tasks').innerText = openTasks;
        } else {
            if(getEl('dash-open-tasks')) getEl('dash-open-tasks').innerText = '🔒';
        }

        if (window.checkTabAccess('comm')) {
            const resC = await fetch(`${API}/sa/communities/pending-businesses`, { headers: { 'Authorization': saToken } });
            const dataC = await resC.json();
            if (dataC.success && dataC.pending) {
                if(getEl('dash-pending-biz')) getEl('dash-pending-biz').innerText = dataC.pending.length;
            }
        } else {
            if(getEl('dash-pending-biz')) getEl('dash-pending-biz').innerText = '🔒';
        }
    } catch(e) { console.error('Error updating dashboard', e); }
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
            window.currentSAUser = data.user;
            localStorage.setItem('ofl_sa_token', saToken);
            localStorage.setItem('ofl_sa_user', JSON.stringify(data.user));
            
            getEl('auth-container').classList.add('hidden');
            getEl('sa-dashboard-container').classList.remove('hidden');
            applyUserPermissions();
            loadSAData();
            window.switchSATab('pulse');
        } else { showToast('error', data.error); }
    } catch(err) { showToast('error', 'שגיאת התחברות'); }
}

function logoutSA() {
    saToken = null;
    localStorage.removeItem('ofl_sa_token');
    getEl('sa-dashboard-container').classList.add('hidden');
    getEl('auth-container').classList.remove('hidden');
    getEl('sa-code').value = '';
    getEl('sa-password').value = '';
}

window.switchSATab = function(tabId) {
    if (typeof window.checkTabAccess === 'function' && !window.checkTabAccess(tabId)) {
        return showToast('error', 'אין לך הרשאה לגשת למודול זה.');
    }

    if (tabId === 'pulse') updateSADashboard();

    const allTabs = ['dashboard', 'pulse', 'devops', 'support', 'stats', 'comm', 'biz', 'inbox', 'content', 'clients', 'hr', 'partners'];
    let activeTabTitle = 'לוח בקרה';

    allTabs.forEach(t => {
        const view = document.getElementById(`sa-view-${t}`);
        const btn = document.getElementById(`btn-sa-tab-${t}`);
        
        if (view) view.classList.add('hidden');
        
        if (btn) {
            // איפוס עיצוב לכפתור לא פעיל (Dark Sidebar style)
            if (!btn.classList.contains('hidden')) {
                btn.className = 'flex w-full text-right px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition items-center gap-3';
            }
        }
    });
    
    const activeView = document.getElementById(`sa-view-${tabId}`);
    const activeBtn = document.getElementById(`btn-sa-tab-${tabId}`);
    
    if (activeView) activeView.classList.remove('hidden');
    
    if (activeBtn) {
        // עיצוב כפתור פעיל מודרני
        activeBtn.className = 'flex w-full text-right px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition items-center gap-3';
        activeTabTitle = activeBtn.innerText.trim();
    }

    // עדכון כותרת בסרגל העליון (Topbar)
    const topbarTitle = document.getElementById('sa-topbar-title');
    if (topbarTitle) topbarTitle.innerText = activeTabTitle;

    // עדכון שם משתמש
    const topUser = document.getElementById('topbar-user-name');
    if (topUser && window.currentSAUser) topUser.innerText = window.currentSAUser.name || 'Super Admin';

    // סגירת התפריט במובייל לאחר בחירת מסך
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sa-sidebar');
        if (sidebar && !sidebar.classList.contains('translate-x-full')) {
            window.toggleMobileSidebar();
        }
    }

    // טעינת נתונים פר טאב
    if (tabId === 'dashboard') updateSADashboard();
    if (tabId === 'hr') loadSAHRData();
    if (tabId === 'devops') { loadProductMatrix(); loadDevTasks(); }
    if (tabId === 'support') loadSATickets();
    if (tabId === 'clients') loadSAData();
    if (tabId === 'partners') loadSAPartners();
};

window.updateSADashboard = async function() {
    try {
        if (saTicketsCache.length === 0 && window.checkTabAccess('support')) {
            const resT = await fetch(`${API}/superadmin/tickets`, { headers: { 'Authorization': saToken } });
            const dataT = await resT.json();
            if (dataT.success) saTicketsCache = dataT.tickets || [];
        }
        const openTickets = saTicketsCache.filter(t => t.status === 'open' || t.status === 'in_progress').length;
        if(getEl('dash-open-tickets')) getEl('dash-open-tickets').innerText = openTickets;
        
        if (typeof devKanbanTasks !== 'undefined' && devKanbanTasks.length === 0 && window.checkTabAccess('devops')) {
            const resK = await fetch(`${API}/sa/dev/tasks`, { headers: { 'Authorization': saToken } });
            const dataK = await resK.json();
            if (dataK.success) devKanbanTasks = dataK.tasks || [];
        }
        const openTasks = typeof devKanbanTasks !== 'undefined' ? devKanbanTasks.filter(t => t.status === 'backlog' || t.status === 'in_progress').length : 0;
        if(getEl('dash-open-tasks')) getEl('dash-open-tasks').innerText = openTasks;

        if (window.checkTabAccess('comm')) {
            const resC = await fetch(`${API}/sa/communities/pending-businesses`, { headers: { 'Authorization': saToken } });
            const dataC = await resC.json();
            if (dataC.success && dataC.pending) {
                if(getEl('dash-pending-biz')) getEl('dash-pending-biz').innerText = dataC.pending.length;
            }
        }
    } catch(e) { console.error('Error updating dashboard', e); }
};

window.switchDevTab = function(tabId) {
    ['matrix', 'kanban', 'release'].forEach(t => {
        const view = document.getElementById(`dev-content-${t}`);
        const btn = document.getElementById(`btn-dev-tab-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.className = 'flex-1 px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 rounded-lg transition';
    });
    
    const activeView = document.getElementById(`dev-content-${tabId}`);
    const activeBtn = document.getElementById(`btn-dev-tab-${tabId}`);
    
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.className = 'flex-1 px-5 py-2.5 text-sm font-bold bg-white text-indigo-700 rounded-lg shadow-sm transition';
};

function renderLivePulse(activityData, stats) {
    const stream = getEl('pulse-live-stream');
    if (!stream) return;

    const totalUsers = (stats.familyUsers || 0) + (stats.businessUsers || 0);
    getEl('pulse-active-users').innerText = totalUsers;
    const ordersCount = activityData.filter(a => a.description.includes('רכש') || a.description.includes('קופה') || a.description.includes('תור')).length;
    getEl('pulse-orders-today').innerText = ordersCount;
    const aiReqs = activityData.filter(a => a.description.includes('AI') || a.description.includes('חפיפה')).length;
    getEl('pulse-ai-reqs').innerText = aiReqs * 2 || '--'; 

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

    const anomalyAlert = getEl('pulse-anomaly-alert');
    if (anomalyAlert) {
        if (errorCount >= 3) anomalyAlert.classList.remove('hidden');
        else anomalyAlert.classList.add('hidden');
    }

    if (activityData.length === 0) {
        stream.innerHTML = '<p class="text-slate-400 text-center py-4">אין פעילות בדקות האחרונות.</p>';
        return;
    }

    stream.innerHTML = activityData.slice(0, 15).map(a => {
        let icon = '<i class="fa-solid fa-bolt text-slate-400"></i>';
        let bgGlow = '';
        if (a.is_financial) { icon = '<i class="fa-solid fa-coins text-green-400"></i>'; bgGlow = 'border-l-2 border-l-green-500/50'; }
        if (a.description.includes('AI') || a.description.includes('חפיפה')) { icon = '<i class="fa-solid fa-microchip text-purple-400"></i>'; bgGlow = 'border-l-2 border-l-purple-500/50'; }
        if (a.description.includes('שגיאה') || a.description.includes('נמחק')) { icon = '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>'; bgGlow = 'border-l-2 border-l-red-500/50'; }

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

let saSlaRulesCache = [];

window.loadSlaMatrix = async function() {
    try {
        const res = await fetch(`${API}/sa/sla-matrix`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) {
            saSlaRulesCache = data.sla || [{ type: '*', priority: '*', hours: 24 }]; // ברירת מחדל אם ריק
        }
    } catch(e) { console.error('Error loading SLA', e); }
};

function getTicketSlaMaxHours(type, priority) {
    if (!saSlaRulesCache || saSlaRulesCache.length === 0) return 24;
    // עדיפות 1: התאמה מדויקת
    let match = saSlaRulesCache.find(r => r.type === type && r.priority === priority);
    // עדיפות 2: סוג מתאים, דחיפות כללית
    if (!match) match = saSlaRulesCache.find(r => r.type === type && r.priority === '*');
    // עדיפות 3: סוג כללי, דחיפות מתאימה
    if (!match) match = saSlaRulesCache.find(r => r.type === '*' && r.priority === priority);
    // עדיפות 4: הכל כללי
    if (!match) match = saSlaRulesCache.find(r => r.type === '*' && r.priority === '*');
    
    return match ? parseInt(match.hours) : 24;
}

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

    // מוודאים שטבלת ה-SLA נטענה
    if (saSlaRulesCache.length === 0) loadSlaMatrix();

    let html = '';
    const statusMap = {
        'open': { text: 'פתוח (ממתין)', color: 'bg-red-100 text-red-700 border-red-200' },
        'in_progress': { text: 'בטיפול', color: 'bg-orange-100 text-orange-700 border-orange-200' },
        'resolved': { text: 'סגור', color: 'bg-green-100 text-green-700 border-green-200 opacity-60' }
    };
    
    const prioMap = { 'critical': '🚨 קריטי', 'high': '🔴 גבוה', 'normal': '🟡 רגיל', 'low': '🔵 נמוך' };

    filtered.forEach(t => {
        const st = statusMap[t.status] || statusMap['open'];
        const dateStr = new Date(t.created_at).toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'});
        const pLabel = prioMap[t.priority] || prioMap['normal'];
        
        let slaHtml = '';
        if (t.status !== 'resolved') {
            const timeSinceUpdate = new Date() - new Date(t.status_updated_at || t.created_at);
            const hoursOpen = Math.floor(timeSinceUpdate / (1000 * 60 * 60));
            const maxHours = getTicketSlaMaxHours(t.ticket_type || 'general', t.priority || 'normal');
            
            if (hoursOpen >= maxHours) {
                slaHtml = `<span class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded ml-2 border border-red-200 font-bold animate-pulse" title="יעד: ${maxHours} שעות"><i class="fa-solid fa-fire"></i> חריגת SLA</span>`;
            } else {
                slaHtml = `<span class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-2 border border-green-200 font-bold" title="יעד: ${maxHours} שעות"><i class="fa-regular fa-clock"></i> SLA תקין</span>`;
            }
        }
        
        const teamHtml = t.assigned_team_name ? `<span class="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded truncate max-w-[100px]"><i class="fa-solid fa-shield-cat"></i> ${safeStr(t.assigned_team_name)}</span>` : '<span class="bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">לא שויך</span>';

        html += `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition cursor-pointer group" onclick="openSATicketModal(${t.id})">
            <div>
                <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div class="pr-2">
                        <span class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mb-2 inline-block">קריאה #${t.id} <span class="ml-1 px-1 bg-slate-200 rounded">${pLabel}</span></span>
                        <h4 class="font-bold text-slate-800 text-base leading-tight group-hover:text-blue-600 transition">${safeStr(t.subject)}</h4>
                        <p class="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2"><i class="fa-solid fa-building text-slate-300"></i> ${safeStr(t.group_name)} ${slaHtml}</p>
                    </div>
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-md border ${st.color} whitespace-nowrap">${st.text}</span>
                </div>
                <p class="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">${safeStr(t.description)}</p>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 font-bold bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div class="flex items-center gap-2">
                    <span><i class="fa-solid fa-user mr-1"></i> ${safeStr(t.user_name)}</span>
                    ${teamHtml}
                </div>
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
    
    // מילוי שדות טקסט
    getEl('sa-ticket-modal-id').innerText = '#' + t.id;
    getEl('sa-ticket-modal-subject').innerText = t.subject;
    getEl('sa-ticket-modal-group').innerText = t.group_name || 'לא ידוע';
    getEl('sa-ticket-modal-user').innerText = t.user_name || 'לא ידוע';
    getEl('sa-ticket-current-team').innerText = t.assigned_team_name || 'טרם שויך';
    
    // איפוס טופס כתיבה וגובה תיבת טקסט
    const replyTextarea = getEl('sa-ticket-reply-text');
    replyTextarea.value = '';
    replyTextarea.style.height = '40px'; // גובה התחלתי קטן
    
    getEl('sa-ticket-reply-status').value = t.status;
    const chkInternal = getEl('sa-ticket-reply-internal');
    if(chkInternal) chkInternal.checked = false;

    // מילוי סיווגים
    getEl('sa-ticket-priority').value = t.priority || 'normal';
    getEl('sa-ticket-type').value = t.ticket_type || 'general';

    const routeSelect = getEl('sa-ticket-route-team');
    if (routeSelect) {
        routeSelect.innerHTML = '<option value="">(ללא שיוך צוות)</option>' + 
            saTeamsCache.map(team => `<option value="${team.id}" ${t.assigned_team === team.id ? 'selected' : ''}>${safeStr(team.name)}</option>`).join('');
    }

    // SLA Badge
    const badge = getEl('sa-ticket-sla-badge');
    if (badge) {
        if (t.status === 'resolved') {
            badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500';
            badge.innerText = 'סגורה';
        } else {
            const timeSinceUpdate = new Date() - new Date(t.status_updated_at || t.created_at);
            const hoursOpen = Math.floor(timeSinceUpdate / (1000 * 60 * 60));
            const maxHours = getTicketSlaMaxHours(t.ticket_type || 'general', t.priority || 'normal');
            if (hoursOpen >= maxHours) {
                badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse';
                badge.innerHTML = `<i class="fa-solid fa-fire mr-1"></i> חריגה (${hoursOpen} ש')`;
            } else {
                badge.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white';
                badge.innerHTML = `<i class="fa-solid fa-check mr-1"></i> תקין (${hoursOpen} ש')`;
            }
        }
    }

    // הרשאות Read Only
    const isMaster = window.currentSAUser && window.currentSAUser.permissions && window.currentSAUser.permissions.includes('all');
    const userTeamId = window.currentSAUser ? window.currentSAUser.team_id : null;
    const canEdit = isMaster || !t.assigned_team || parseInt(t.assigned_team) === parseInt(userTeamId);
    document.querySelectorAll('.sa-ticket-input').forEach(el => el.disabled = !canEdit);
    getEl('btn-sa-ticket-reply').disabled = !canEdit;
    getEl('sa-ticket-read-only-msg').classList.toggle('hidden', canEdit);

    // לוגים (צ'אט, אבני דרך)
    let logArr = [];
    try { logArr = typeof t.log === 'string' ? JSON.parse(t.log) : (t.log || []); } catch(e) {}
    const chatContainer = getEl('sa-ticket-log');
    const milestoneContainer = getEl('sa-ticket-milestones');
    
    let chatHtml = `
        <div class="flex flex-col items-start mb-2 fade-in">
            <div class="p-3 rounded-2xl border text-sm whitespace-pre-wrap leading-relaxed bg-white border-slate-200 text-slate-700 rounded-tr-none max-w-[85%] shadow-sm">
                ${safeStr(t.description)}
            </div>
            <div class="text-[8px] text-slate-400 mt-1 font-bold uppercase tracking-widest px-1">פנייה מקורית</div>
        </div>`;
        
    let milestoneHtml = `
        <div class="relative pl-4 border-r-2 border-blue-100 pb-4 fade-in">
            <div class="absolute -right-[5px] top-0 w-2 h-2 bg-blue-500 rounded-full border border-white"></div>
            <div class="text-[8px] font-black text-slate-400 uppercase">${new Date(t.created_at).toLocaleString('he-IL', {dateStyle:'short', timeStyle:'short'})}</div>
            <div class="text-[10px] text-slate-700 font-bold">פתיחת קריאה</div>
        </div>`;

    logArr.forEach(entry => {
        const timeStr = new Date(entry.date).toLocaleString('he-IL', {timeStyle:'short'});
        const isInternal = entry.isInternal || (entry.message && entry.message.startsWith('[INTERNAL_NOTE]')); 
        let cleanMessage = entry.message ? entry.message.replace('[INTERNAL_NOTE] ', '') : '';
        
        if (entry.message && entry.message.startsWith('[SYSTEM_AUDIT]')) {
            milestoneHtml += `
            <div class="relative pl-4 border-r-2 border-slate-200 pb-4 fade-in">
                <div class="absolute -right-[5px] top-0 w-2 h-2 bg-slate-300 rounded-full border border-white"></div>
                <div class="text-[8px] font-black text-slate-400 uppercase">${timeStr} <span class="text-indigo-500">(${safeStr(entry.sender)})</span></div>
                <div class="text-[10px] text-slate-600 mt-0.5 leading-snug">${safeStr(cleanMessage.replace('[SYSTEM_AUDIT]', '').trim())}</div>
            </div>`;
            return; 
        }

        if (isInternal) {
            chatHtml += `
            <div class="flex flex-col items-end mb-4 fade-in">
                <div class="p-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed self-end bg-orange-50 border border-orange-100 text-orange-900 rounded-tl-none shadow-sm max-w-[85%]">
                    ${safeStr(cleanMessage)}
                </div>
                <div class="text-[8px] text-orange-600 mt-1 font-bold flex items-center px-1">
                    <i class="fa-solid fa-user-ninja mr-1 text-[7px]"></i> ${safeStr(entry.sender)} • פנימי
                </div>
            </div>`;
        } else {
            const isStaff = entry.isStaff;
            chatHtml += `
            <div class="flex flex-col ${isStaff ? 'items-end' : 'items-start'} mb-4 fade-in">
                <div class="p-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${isStaff ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'} shadow-sm max-w-[85%]">
                    ${safeStr(cleanMessage)}
                </div>
                <div class="text-[8px] text-slate-400 mt-1 font-bold px-1">${safeStr(entry.sender)} • ${timeStr}</div>
            </div>`;
        }
    });
    
    chatContainer.innerHTML = chatHtml;
    milestoneContainer.innerHTML = milestoneHtml;
    getEl('sa-ticket-modal').classList.remove('hidden');
    
    // גלילה לתחתית
    setTimeout(() => { 
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight; 
        if (milestoneContainer) milestoneContainer.scrollTop = milestoneContainer.scrollHeight;
    }, 50);
}

window.updateTicketClassification = async function() {
    const teamId = val('sa-ticket-route-team');
    const priority = val('sa-ticket-priority');
    const type = val('sa-ticket-type');
    
    try {
        const userName = window.currentSAUser ? window.currentSAUser.name : 'צוות המערכת';
        
        // מייצר פתק ביקורת יפה ודינמי לפי מה שהשתנה
        const t = saTicketsCache.find(x => x.id === saCurrentTicketId);
        let notes = [];
        if (t.priority !== priority) notes.push(`שינה עדיפות ל-${priority}`);
        if (t.ticket_type !== type) notes.push(`שינה סוג ל-${type}`);
        if (t.assigned_team != teamId) notes.push(`העביר צוות`);
        
        const auditNote = notes.length > 0 ? `סיווג קריאה: ${notes.join(', ')}` : null;

        const res = await fetch(`${API}/superadmin/tickets/${saCurrentTicketId}/assign_and_classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ assignedTeam: teamId ? parseInt(teamId) : null, priority, ticketType: type, actionBy: userName, auditNote })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'הסיווג והניתוב נשמרו בלוג.');
            await loadSATickets(); 
            openSATicketModal(saCurrentTicketId); 
        } else { showToast('error', data.error || 'שגיאה בהעברה'); }
    } catch(e) { showToast('error', 'שגיאת רשת בשמירת הסיווג'); }
};

window.routeSATicket = window.updateTicketClassification; // כפתור העבר פשוט שומר הכל

window.openSlaMatrixModal = function() {
    renderSlaRulesList();
    getEl('sa-sla-modal').classList.remove('hidden');
};

window.renderSlaRulesList = function() {
    const list = getEl('sa-sla-rules-list');
    if (!saSlaRulesCache || saSlaRulesCache.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4 bg-slate-50 border border-dashed rounded">אין חוקי התראות. ברירת המחדל היא 24 שעות.</p>';
        return;
    }
    const typeMap = { '*': 'הכל (*)', 'general': 'כללי', 'technical': 'תקלה/באג', 'billing': 'חיובים' };
    const prioMap = { '*': 'הכל (*)', 'low': 'נמוכה', 'normal': 'רגילה', 'high': 'גבוהה', 'critical': 'קריטית' };
    
    list.innerHTML = saSlaRulesCache.map((r, idx) => `
        <div class="grid grid-cols-4 gap-2 items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm text-xs font-bold text-slate-700">
            <div>${typeMap[r.type] || r.type}</div>
            <div>${prioMap[r.priority] || r.priority}</div>
            <div class="text-center text-purple-600 bg-purple-50 rounded">${r.hours} שעות</div>
            <div class="text-center"><button onclick="deleteSlaRule(${idx})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button></div>
        </div>
    `).join('');
};

window.addSlaRule = function() {
    const type = val('sla-new-type');
    const priority = val('sla-new-priority');
    const hours = parseInt(val('sla-new-hours'));
    
    if (!hours || isNaN(hours)) return showToast('error', 'חובה להזין כמות שעות תקינה');
    
    // מחיקת חוק זהה אם קיים כדי לא ליצור כפילויות
    saSlaRulesCache = saSlaRulesCache.filter(r => !(r.type === type && r.priority === priority));
    
    // הוספת החוק החדש לראש הרשימה
    saSlaRulesCache.unshift({ type, priority, hours });
    renderSlaRulesList();
    getEl('sla-new-hours').value = '';
};

window.deleteSlaRule = function(idx) {
    saSlaRulesCache.splice(idx, 1);
    renderSlaRulesList();
};

window.saveSlaMatrix = async function() {
    try {
        const res = await fetch(`${API}/sa/sla-matrix`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ sla: saSlaRulesCache })
        });
        if((await res.json()).success) {
            showToast('success', 'חוקי ה-SLA נשמרו במערכת!');
            getEl('sa-sla-modal').classList.add('hidden');
            loadSATickets(); // רענון הטיקטים כדי לחשב מחדש את הצבעים
        }
    } catch(e) { showToast('error', 'שגיאת רשת בשמירת SLA'); }
};

// ==========================================
// --- הוספת תגובה לקריאת שירות ---
// ==========================================
window.submitSATicketReply = async function() {
    if (!saCurrentTicketId) return showToast('error', 'לא נבחרה קריאה תקינה');
    
    const text = val('sa-ticket-reply-text').trim();
    const status = val('sa-ticket-reply-status');
    const isInternalEl = getEl('sa-ticket-reply-internal');
    const isInternal = isInternalEl ? isInternalEl.checked : false;
    const senderName = window.currentSAUser ? window.currentSAUser.name : 'צוות מערכת';
    
    if (!text && !status) return showToast('error', 'יש להזין תגובה ללקוח או לבחור שינוי סטטוס');
    
    const btn = getEl('btn-sa-ticket-reply');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    try {
        const res = await fetch(`${API}/superadmin/tickets/${saCurrentTicketId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ message: text, status: status, isInternal: isInternal, senderName: senderName })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast('success', 'התגובה נשלחה ונשמרה!');
            
            // איפוס שדות
            const textArea = getEl('sa-ticket-reply-text');
            if (textArea) {
                textArea.value = '';
                textArea.style.height = '40px';
            }
            if (isInternalEl) isInternalEl.checked = false;
            getEl('sa-ticket-reply-status').value = '';
            
            // רענון נתונים והשארת המודאל פתוח עם הגלילה החדשה
            await loadSATickets();
            openSATicketModal(saCurrentTicketId);
        } else {
            showToast('error', data.error || 'שגיאה בשמירת התגובה');
        }
    } catch (e) {
        showToast('error', 'שגיאת רשת בשליחת תגובה');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
};

async function updateSACredentials() {
    const newUsername = val('sa-new-username'); const newPassword = val('sa-new-password'); const newEmail = val('sa-new-email');
    if (!newUsername || !newPassword) return showToast('error', 'יש להזין שם משתמש וסיסמה חדשים');
    if (!confirm('האם אתה בטוח שברצונך לשנות את פרטי המנהל הראשי?')) return;
    try {
        const res = await fetch(`${API}/superadmin/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, body: JSON.stringify({ newUsername, newPassword, newEmail }) });
        const data = await res.json();
        if (data.success) showToast('success', 'פרטי המנהל הראשי עודכנו בהצלחה!');
        else showToast('error', data.error || 'שגיאה בעדכון פרטים');
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

        if (data.activity && data.stats) renderLivePulse(data.activity, data.stats);
        
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
        
        // תיקון סנכרון: טוען צוותים ונציגים כבר בהתחלה עבור כל המודולים
        if(typeof loadSAHRData === 'function') loadSAHRData();
        
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
        if (data.success) showToast('success', 'ההגדרות והמיתוג הגלובלי נשמרו בהצלחה!');
        else showToast('error', 'שגיאה בשמירת נתונים');
    } catch (e) { showToast('error', 'תקלת רשת מול השרת'); }
};

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
            const base64 = canvas.toDataURL('image/png'); 
            
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
        if ((await res.json()).success) showToast('success', 'הודעת הפתיחה נשמרה בהצלחה!');
        else showToast('error', 'שגיאה בשמירת ההודעה');
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
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ is_premium: enable, isPremium: enable, enable: enable })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', `מנוי PRO ${enable ? 'הופעל' : 'בוטל'} בהצלחה!`);
            loadSAData();
        } else {
            showToast('error', data.error || 'שגיאה בעדכון הסטטוס');
        }
    } catch (e) { showToast('error', 'שגיאת רשת בעדכון סטטוס מנוי'); }
}

function openSAEditGroupModal(id, name, email) {
    const group = saAllGroups.find(g => g.id === id);
    getEl('sa-edit-group-id').value = id;
    getEl('sa-edit-group-name').value = name;
    getEl('sa-edit-group-email').value = email || '';
    
    let f = { store: true, b2b: true, academy: true, calendar: true, finance: true, inventory: true, crm: true, deliveries: true, foodcost: true, ai: true, timeclock: true, cashflow: true, budget: true, forecast: true, tasks: true, community: true, members: true, shifts: true };
    if (group && group.features) {
        try { f = typeof group.features === 'string' ? JSON.parse(group.features) : group.features; } catch(e) {}
    }
    
    const setCb = (id, val) => { const el = getEl(id); if (el) el.checked = !!val; };
    setCb('flag-store', f.store); setCb('flag-b2b', f.b2b); setCb('flag-academy', f.academy); setCb('flag-calendar', f.calendar);
    setCb('flag-finance', f.finance); setCb('flag-inventory', f.inventory); setCb('flag-crm', f.crm); setCb('flag-deliveries', f.deliveries);
    setCb('flag-foodcost', f.foodcost); setCb('flag-ai', f.ai); setCb('flag-timeclock', f.timeclock !== undefined ? f.timeclock : true);
    setCb('flag-cashflow', f.cashflow !== undefined ? f.cashflow : true); setCb('flag-budget', f.budget !== undefined ? f.budget : true);
    setCb('flag-forecast', f.forecast !== undefined ? f.forecast : true); setCb('flag-tasks', f.tasks !== undefined ? f.tasks : true);
    setCb('flag-community', f.community !== undefined ? f.community : true); setCb('flag-members', f.members !== undefined ? f.members : true);
    setCb('flag-shifts', f.shifts !== undefined ? f.shifts : true);

    getEl('sa-edit-group-modal').classList.remove('hidden');
}

async function saveSAEditGroup() {
    const id = val('sa-edit-group-id');
    const name = val('sa-edit-group-name');
    const adminEmail = val('sa-edit-group-email');
    const getCb = (id) => { const el = getEl(id); return el ? el.checked : true; };

    const flags = {
        store: getCb('flag-store'), b2b: getCb('flag-b2b'), academy: getCb('flag-academy'), calendar: getCb('flag-calendar'),
        finance: getCb('flag-finance'), inventory: getCb('flag-inventory'), crm: getCb('flag-crm'), deliveries: getCb('flag-deliveries'),
        foodcost: getCb('flag-foodcost'), ai: getCb('flag-ai'), timeclock: getCb('flag-timeclock'), cashflow: getCb('flag-cashflow'),
        budget: getCb('flag-budget'), forecast: getCb('flag-forecast'), tasks: getCb('flag-tasks'), community: getCb('flag-community'),
        members: getCb('flag-members'), shifts: getCb('flag-shifts')
    };

    if (!name || !adminEmail) return showToast('error', 'שם ומייל לא יכולים להיות ריקים');
    
    try {
        const groupIndex = saAllGroups.findIndex(g => g.id === parseInt(id));
        if(groupIndex > -1) {
            saAllGroups[groupIndex].name = name;
            saAllGroups[groupIndex].admin_email = adminEmail;
            saAllGroups[groupIndex].features = flags; 
        }

        const res = await fetch(`${API}/sa/groups/${id}`, { 
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': saToken }, 
            body: JSON.stringify({ name, adminEmail, features: flags }) 
        });
        
        showToast('success', 'פרטי הסביבה וההרשאות עודכנו בהצלחה!');
        getEl('sa-edit-group-modal').classList.add('hidden');
        renderSAGroups();
    } catch (e) { showToast('error', 'שגיאת רשת בשמירת ההרשאות'); }
}

window.toggleAllSAFlags = function(checked) {
    document.querySelectorAll('.flag-cb').forEach(cb => cb.checked = checked);
};

getEl('sa-inbox-target-type')?.addEventListener('change', (e) => {
    if (e.target.value === 'specific') getEl('sa-inbox-specific-biz-wrapper').classList.remove('hidden');
    else getEl('sa-inbox-specific-biz-wrapper').classList.add('hidden');
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
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ targetType, targetValue, subject, content })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', `ההודעה שוגרה בהצלחה ל-${data.count || 0} נמענים!`);
            getEl('sa-inbox-subject').value = '';
            getEl('sa-inbox-content').value = '';
        } else { showToast('error', data.error || 'שגיאה בשליחת הודעה לשרת'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת מול השרת'); } 
    finally { if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> שגר לתיבת ההודעות'; } }
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
    if (!query) { resultsContainer.classList.add('hidden'); return; }

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
    getEl('sa-link-comm').value = id; getEl('sa-smart-comm-search').value = '';
    getEl('sa-smart-comm-search').classList.add('hidden'); getEl('sa-smart-comm-results').classList.add('hidden');
    const display = getEl('sa-selected-comm-display'); display.querySelector('span').innerText = `קהילה נבחרה: ${name}`; display.classList.remove('hidden');
    loadCommunityBusinesses();
}

function clearSmartCommSelection() {
    getEl('sa-link-comm').value = ''; getEl('sa-selected-comm-display').classList.add('hidden');
    const searchInput = getEl('sa-smart-comm-search'); searchInput.classList.remove('hidden'); searchInput.focus();
    getEl('sa-comm-biz-list').innerHTML = 'יש לבחור קהילה ממעל';
}

function handleSmartBizSearch() {
    const input = getEl('sa-smart-biz-search'); const resultsContainer = getEl('sa-smart-biz-results');
    const query = input.value.toLowerCase().trim();
    if (!query) { resultsContainer.classList.add('hidden'); return; }

    const filtered = saBusinessesCache.filter(b => (b.name && b.name.toLowerCase().includes(query))).slice(0, 10);
    if (filtered.length === 0) { resultsContainer.innerHTML = '<div class="p-3 text-sm text-slate-500 text-center">לא נמצאו עסקים תואמים.</div>'; } 
    else {
        resultsContainer.innerHTML = filtered.map(b => `
            <div onclick="selectSmartBiz(${b.id}, '${safeStr(b.name)}')" class="p-3 border-b border-slate-100 hover:bg-emerald-50 cursor-pointer transition">
                <div class="font-bold text-slate-800 text-sm flex items-center gap-2"><i class="fa-solid fa-store text-emerald-500"></i> ${safeStr(b.name)}</div>
            </div>
        `).join('');
    }
    resultsContainer.classList.remove('hidden');
}

function selectSmartBiz(id, name) {
    getEl('sa-link-biz').value = id; getEl('sa-smart-biz-search').value = '';
    getEl('sa-smart-biz-search').classList.add('hidden'); getEl('sa-smart-biz-results').classList.add('hidden');
    const display = getEl('sa-selected-biz-display'); display.querySelector('span').innerText = `עסק נבחר: ${name}`; display.classList.remove('hidden');
}

function clearSmartBizSelection() {
    getEl('sa-link-biz').value = ''; getEl('sa-selected-biz-display').classList.add('hidden');
    const searchInput = getEl('sa-smart-biz-search'); searchInput.classList.remove('hidden'); searchInput.focus();
}

async function loadSAPendingRequests() {
    const container = getEl('sa-pending-biz-container'); const list = getEl('sa-pending-biz-list');
    if(!container || !list) return;
    try {
        const res = await fetch(`${API}/sa/communities/pending-businesses`); const data = await res.json();
        if (data.success && data.pending && data.pending.length > 0) {
            container.classList.remove('hidden');
            list.innerHTML = data.pending.map(p => `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex justify-between items-center hover:shadow-md transition mb-2">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">העסק: ${safeStr(p.biz_name)}</h4>
                        <p class="text-xs text-slate-500 mt-0.5">מבקש להצטרף לקהילת: <strong>${safeStr(p.comm_name)}</strong></p>
                        <p class="text-[11px] text-green-700 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded-full inline-block border border-green-200">מוכן לתת ${p.discount_pct}% הנחה</p>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button onclick="approveSABizRequest(${p.community_id}, ${p.business_id})" class="bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm"><i class="fa-solid fa-check mr-1"></i> אשר וצרף</button>
                        <button onclick="rejectSABizRequest(${p.community_id}, ${p.business_id})" class="bg-red-50 text-red-600 px-5 py-2 rounded-xl text-xs font-bold shadow-sm"><i class="fa-solid fa-xmark mr-1"></i> דחה בקשה</button>
                    </div>
                </div>
            `).join('');
        } else { container.classList.add('hidden'); }
    } catch(e) { console.error('Error loading pending requests', e); }
}

async function approveSABizRequest(communityId, businessId) {
    if(!confirm('האם לאשר את הצטרפות העסק לקהילה?')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        if((await res.json()).success) { showToast('success', 'העסק אושר וצורף!'); loadSACommunityData(); }
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
    const tbody = getEl('sa-communities-table-body'); if (!tbody) return;
    const query = getEl('sa-search-comm') ? getEl('sa-search-comm').value.toLowerCase() : '';
    const countFilter = getEl('sa-filter-comm-count') ? getEl('sa-filter-comm-count').value : 'all';
    const multiFilter = getEl('sa-filter-comm-multi') ? getEl('sa-filter-comm-multi').checked : false; 
    let filtered = [...saCommunitiesCache];
    
    if (query) filtered = filtered.filter(c => (c.name && c.name.toLowerCase().includes(query)) || (c.code && c.code.toLowerCase().includes(query)) || (c.city && c.city.toLowerCase().includes(query)));
    if (countFilter === 'with_families') filtered = filtered.filter(c => parseInt(c.family_count || 0) > 0);
    else if (countFilter === 'empty') filtered = filtered.filter(c => parseInt(c.family_count || 0) === 0);
    else if (countFilter === 'sort_desc') filtered.sort((a, b) => parseInt(b.family_count || 0) - parseInt(a.family_count || 0));
    if (multiFilter) filtered = filtered.filter(c => c.city && c.city.split(',').filter(x => x.trim()).length >= 2);
    
    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">לא נמצאו קהילות.</td></tr>`; return; }
    
    tbody.innerHTML = filtered.map(c => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right flex items-center gap-3">
                ${c.image_url ? `<img src="${c.image_url}" class="w-8 h-8 rounded-lg object-cover shadow-sm shrink-0">` : `<div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><i class="fa-solid fa-users"></i></div>`}
                <div>${safeStr(c.name || 'ללא שם')}<div class="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1 max-w-[200px] overflow-hidden">${(c.city || 'לא הוגדר').split(',').map(city => `<span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><i class="fa-solid fa-location-dot text-orange-400"></i> ${city.trim()}</span>`).join('')}</div></div>
            </td>
            <td class="px-4 py-4 font-mono text-orange-600 font-bold tracking-widest text-right">${safeStr(c.code || '---')}</td>
            <td class="px-4 py-4 text-right"><div class="text-xs text-slate-600 mb-1"><span class="text-slate-400 font-bold ml-1">מייל:</span> ${safeStr(c.manager_email || '---')}</div><div class="text-xs text-slate-600"><span class="text-slate-400 font-bold ml-1">סיסמה:</span> ${safeStr(c.manager_password || '---')}</div></td>
            <td class="px-4 py-4 text-center">
                <span class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold text-xs"><i class="fa-solid fa-house text-[10px]"></i> ${c.family_count || 0} משפחות</span>
                <span class="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-bold text-xs ml-1"><i class="fa-solid fa-briefcase text-[10px]"></i> ${c.business_count || 0} עסקים</span>
            </td>
            <td class="px-4 py-4 text-center"><button onclick="openSACommunityModal(${c.id})" class="bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-gear"></i> מחיקה וניהול</button></td>
        </tr>
    `).join('');
}

function filterSACommunities() { renderSACommunitiesTable(); }

async function openSACommunityModal(id) {
    const comm = saCommunitiesCache.find(c => c.id == id); if(!comm) return;
    getEl('sa-edit-comm-id').value = comm.id; getEl('sa-edit-comm-title').innerText = comm.name; getEl('sa-edit-comm-name').value = comm.name; getEl('sa-edit-comm-code').value = comm.code; getEl('sa-edit-comm-email').value = comm.manager_email; getEl('sa-edit-comm-pass').value = comm.manager_password;
    editCityTags = comm.city ? comm.city.split(',').map(c => c.trim()).filter(c => c) : []; updateCityTagsDisplay('edit');
    getEl('sa-edit-comm-image-base64').value = ''; const imgPreview = getEl('sa-edit-comm-img-preview'); const placeholder = getEl('sa-edit-comm-img-placeholder');
    if (comm.image_url) { imgPreview.src = comm.image_url; imgPreview.classList.remove('hidden'); if(placeholder) placeholder.classList.add('hidden'); } 
    else { imgPreview.src = ''; imgPreview.classList.add('hidden'); if(placeholder) placeholder.classList.remove('hidden'); }
    getEl('sa-edit-comm-fam-count').innerText = comm.family_count || 0; getEl('sa-edit-comm-biz-count').innerText = comm.business_count || 0;
    const searchInput = getEl('sa-search-comm-fam'); if (searchInput) searchInput.value = '';
    const famList = getEl('sa-edit-comm-families'); const bizList = getEl('sa-edit-comm-businesses');
    famList.innerHTML = '<p class="text-xs text-slate-400 p-2">טוען נתונים...</p>'; bizList.innerHTML = '<p class="text-xs text-slate-400 p-2">טוען נתונים...</p>';
    getEl('sa-community-modal').classList.remove('hidden');
    try {
        const res = await fetch(`${API}/sa/communities/${id}/details`); const data = await res.json();
        if(data.success) {
            currentCommFamiliesCache = data.families || []; renderSACommFamilies();
            if(data.businesses.length === 0) { bizList.innerHTML = '<p class="text-xs text-slate-400 p-2 bg-slate-50 border border-dashed rounded-lg text-center mt-2">אין עסקים נותני הנחה.</p>'; } 
            else { bizList.innerHTML = data.businesses.map(b => `<div class="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm mb-1.5 text-xs flex justify-between items-center"><span class="font-bold text-slate-700 flex items-center gap-2"><i class="fa-solid fa-store text-slate-300"></i> ${safeStr(b.name)}</span><span class="text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-100">${b.discount_pct}% הנחה</span></div>`).join(''); }
        }
    } catch(e) { famList.innerHTML = '<p class="text-xs text-red-400 p-2">שגיאה</p>'; bizList.innerHTML = '<p class="text-xs text-red-400 p-2">שגיאה</p>'; }
}

function renderSACommFamilies(query = '') {
    const famList = getEl('sa-edit-comm-families'); if (!famList) return;
    let filtered = currentCommFamiliesCache;
    if (query) { const q = query.toLowerCase(); filtered = currentCommFamiliesCache.filter(f => (f.name && f.name.toLowerCase().includes(q)) || (f.group_code && f.group_code.toLowerCase().includes(q))); }
    if (filtered.length === 0) { famList.innerHTML = `<p class="text-xs text-slate-400 p-2 bg-slate-50 border border-dashed rounded-lg text-center mt-2">${query ? 'לא נמצאו משפחות' : 'אין משפחות'}</p>`; return; }
    famList.innerHTML = filtered.map(f => {
        const usersHtml = f.users && f.users.length > 0 ? f.users.map(u => `<div class="text-[10px] text-slate-500 pl-2 pr-1 py-1.5 border-t border-slate-100 flex justify-between bg-slate-50/50"><span><i class="fa-solid ${u.role === 'ADMIN' ? 'fa-user-tie text-blue-400' : 'fa-user text-slate-400'} ml-1"></i> ${safeStr(u.nickname)}</span><span class="bg-white px-1.5 rounded shadow-sm">${u.role === 'ADMIN' ? 'מנהל/הורה' : 'חבר/ילד'}</span></div>`).join('') : '<div class="text-[10px] text-slate-400 pl-2 py-1.5 border-t border-slate-100 bg-slate-50/50">אין משתמשים.</div>';
        return `<div class="bg-white rounded-lg border border-slate-200 mb-1.5 overflow-hidden shadow-sm"><div class="p-2.5 text-xs flex justify-between items-center cursor-pointer hover:bg-blue-50 transition group" onclick="document.getElementById('sa-comm-fam-${f.id}').classList.toggle('hidden')"><div class="font-bold text-slate-700 flex items-center gap-2"><i class="fa-solid fa-users text-slate-300 group-hover:text-blue-400 transition"></i> ${safeStr(f.name)}</div><div class="flex items-center gap-2"><span class="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tracking-widest border border-slate-200">קוד: ${safeStr(f.group_code || '---')}</span></div></div><div id="sa-comm-fam-${f.id}" class="hidden flex flex-col">${usersHtml}</div></div>`;
    }).join('');
}

function filterSACommFamilies() { const query = getEl('sa-search-comm-fam') ? getEl('sa-search-comm-fam').value : ''; renderSACommFamilies(query); }

async function saveSACommunityEdit() {
    const id = val('sa-edit-comm-id'); const name = val('sa-edit-comm-name'); const code = val('sa-edit-comm-code'); const email = val('sa-edit-comm-email'); const pass = val('sa-edit-comm-pass'); const cityData = val('sa-edit-comm-city-data'); const imageUrl = val('sa-edit-comm-image-base64');
    if(!name || !code) return showToast('error', 'שם וקוד חובה'); if(!cityData) return showToast('error', 'חובה להגדיר לפחות אזור גאוגרפי אחד');
    try {
        const res = await fetch(`${API}/sa/communities/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, city: cityData, code, managerEmail: email, managerPassword: pass, imageUrl}) });
        if((await res.json()).success) { showToast('success', 'הקהילה עודכנה בהצלחה!'); getEl('sa-community-modal').classList.add('hidden'); loadSACommunityData(); } else showToast('error', 'שגיאה בעדכון');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteSACommunity() {
    const id = val('sa-edit-comm-id'); if(!confirm('מחיקת הקהילה בלתי הפיכה! האם להמשיך?')) return;
    try {
        const res = await fetch(`${API}/sa/communities/${id}`, { method: 'DELETE' });
        if((await res.json()).success) { showToast('success', 'הקהילה נמחקה!'); getEl('sa-community-modal').classList.add('hidden'); loadSACommunityData(); } else showToast('error', 'שגיאה במחיקה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function createSACommunity() {
    const name = val('sa-comm-name'); const code = val('sa-comm-code'); const email = val('sa-comm-email'); const pass = val('sa-comm-pass'); const cityData = val('sa-comm-city-data'); const imageUrl = val('sa-comm-image-base64');
    if(!name || !code || !cityData) return showToast('error', 'שם הקהילה, ערים וקוד - שדות חובה.');
    const btn = document.querySelector('button[onclick="createSACommunity()"]'); if(btn) { btn.disabled = true; btn.innerText = 'מקים...'; }
    try {
        const res = await fetch(`${API}/sa/communities`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, city: cityData, code, managerEmail: email, managerPassword: pass, imageUrl})});
        const data = await res.json();
        if(data.success) { 
            showToast('success', 'קהילה הוקמה בהצלחה!'); 
            getEl('sa-comm-name').value=''; getEl('sa-comm-city-input').value=''; getEl('sa-comm-code').value=''; getEl('sa-comm-email').value=''; getEl('sa-comm-pass').value=''; getEl('sa-comm-image-base64').value=''; const prevCont = getEl('sa-comm-img-preview-container'); if(prevCont) prevCont.classList.add('hidden'); createCityTags = []; updateCityTagsDisplay('create'); loadSACommunityData(); 
        } else { showToast('error', data.error || 'שגיאה ביצירת הקהילה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); } finally { if(btn) { btn.disabled = false; btn.innerText = 'הקמת קהילה'; } }
}

function renderSABusinessesTable() {
    const tbody = getEl('sa-businesses-table-body'); if (!tbody) return;
    const query = getEl('sa-search-businesses') ? getEl('sa-search-businesses').value.toLowerCase() : '';
    let filtered = [...saBusinessesCache];
    if (query) filtered = filtered.filter(b => (b.name && b.name.toLowerCase().includes(query)) || (b.group_code && b.group_code.toLowerCase().includes(query)));
    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-slate-400">לא נמצאו עסקים.</td></tr>`; return; }
    tbody.innerHTML = filtered.map(b => `
        <tr class="hover:bg-emerald-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right">${safeStr(b.name)}<div class="text-[10px] text-slate-500 mt-1 font-mono">קוד: ${safeStr(b.group_code)}</div></td>
            <td class="px-4 py-4 text-right"><span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">עסק רשום</span></td>
            <td class="px-4 py-4 text-center"><span class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold text-xs" title="חיבורים מנוהלים פנימה"><i class="fa-solid fa-link"></i> בדיקה בניהול</span></td>
            <td class="px-4 py-4 text-center"><button onclick="openSABusinessModal(${b.id})" class="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-gear"></i> ניהול חיבורים</button></td>
        </tr>
    `).join('');
}

function filterSABusinessesTable() { renderSABusinessesTable(); }

async function openSABusinessModal(bizId) {
    const biz = saBusinessesCache.find(b => b.id == bizId); if (!biz) return;
    getEl('sa-edit-biz-title').innerText = biz.name; getEl('sa-edit-biz-code').innerText = biz.group_code;
    const list = getEl('sa-edit-biz-communities-list'); list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> מנתח נתונים בשרת...</p>';
    getEl('sa-business-modal').classList.remove('hidden');
    try {
        const res = await fetch(`${API}/biz/communities/my/${bizId}`); const data = await res.json();
        if (data.success && data.communities) {
            if (data.communities.length === 0) { list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4 bg-white rounded-lg border border-dashed">העסק לא מחובר לאף קהילה כרגע.</p>'; } 
            else {
                list.innerHTML = data.communities.map(c => `
                    <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center mb-2">
                        <div><span class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</span><p class="text-[10px] text-slate-500 mt-1"><i class="fa-solid fa-house"></i> ${c.families_count || 0} משפחות | <span class="font-bold text-green-600">${c.discount_pct}% הנחה</span></p></div>
                        <div class="flex flex-col items-end gap-2"><span class="text-[10px] ${c.status === 'approved' ? 'text-green-600 bg-green-50' : 'text-orange-500 bg-orange-50'} px-2 py-0.5 rounded font-bold">${c.status === 'approved' ? 'מחובר ופעיל' : 'ממתין לאישור'}</span><button onclick="removeBizFromCommunityInModal(${c.id}, ${bizId})" class="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition"><i class="fa-solid fa-trash"></i> נתק עסק</button></div>
                    </div>
                `).join('');
            }
        }
    } catch(e) { list.innerHTML = '<p class="text-xs text-red-500 text-center py-4">שגיאה בטעינת נתונים</p>'; }
}

async function removeBizFromCommunityInModal(commId, bizId) {
    if(!confirm('להסיר את העסק מהקהילה?')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/${commId}/${bizId}`, {method:'DELETE'});
        if((await res.json()).success) { showToast('success', 'העסק נותק מהקהילה בהצלחה.'); openSABusinessModal(bizId); loadSACommunityData(); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function linkBizToCommunity() {
    const communityId = val('sa-link-comm'); const businessId = val('sa-link-biz'); let discountPct = val('sa-link-discount'); discountPct = discountPct ? parseFloat(discountPct) : 0;
    if(!communityId || !businessId) return showToast('error', 'חובה לבחור קהילה ועסק');
    try {
        const res = await fetch(`${API}/sa/community-business`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : (localStorage.getItem('ofl_sa_token') || '') }, body: JSON.stringify({ communityId, businessId, discountPct }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'העסק שויך לקהילה!'); if(typeof loadCommunityBusinesses === 'function') loadCommunityBusinesses(); if(typeof loadSACommunityData === 'function') loadSACommunityData(); if(typeof clearSmartBizSelection === 'function') clearSmartBizSelection(); } 
        else { showToast('error', data.error || 'שגיאה בחיבור העסק'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function loadCommunityBusinesses() {
    const communityId = val('sa-link-comm'); const list = getEl('sa-comm-biz-list');
    if(!communityId) { list.innerHTML = 'יש לבחור קהילה ממעל'; return; }
    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-2"><i class="fa-solid fa-spinner fa-spin"></i> טוען עסקים...</p>';
    try {
        const res = await fetch(`${API}/sa/community-business/${communityId}`); const data = await res.json();
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
    if(!confirm('להסיר את העסק מהקהילה?')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/${commId}/${bizId}`, {method:'DELETE'});
        if((await res.json()).success) { showToast('success', 'העסק הוסר.'); loadCommunityBusinesses(); loadSACommunityData(); }
    } catch(e) {}
}

function updateCityTagsDisplay(type) {
    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    const container = getEl(type === 'create' ? 'sa-comm-city-tags' : 'sa-edit-comm-city-tags');
    const dataInput = getEl(type === 'create' ? 'sa-comm-city-data' : 'sa-edit-comm-city-data');
    if (!container || !dataInput) return;

    if (tagsArr.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-slate-400 w-full text-center my-auto">לא נבחרו ערים. חובה לבחור לפחות עיר אחת.</p>';
        dataInput.value = ''; return;
    }

    container.innerHTML = tagsArr.map((city, index) => `
        <div class="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-orange-200 shadow-sm animate-bounce-in">
            ${city} <button onclick="removeCityTag('${type}', ${index})" class="text-orange-500 hover:text-red-500 transition focus:outline-none"><i class="fa-solid fa-times"></i></button>
        </div>
    `).join('');
    dataInput.value = tagsArr.join(', ');
}

window.addCityTag = function(type) {
    const input = getEl(type === 'create' ? 'sa-comm-city-input' : 'sa-edit-comm-city-input');
    if (!input) return;
    const valStr = input.value.trim(); if (!valStr) return;
    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    if (!tagsArr.includes(valStr)) { tagsArr.push(valStr); updateCityTagsDisplay(type); }
    input.value = '';
}

window.removeCityTag = function(type, index) {
    const tagsArr = type === 'create' ? createCityTags : editCityTags;
    tagsArr.splice(index, 1); updateCityTagsDisplay(type);
}

window.handleCommImageUpload = function(event, type) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas'); let width = img.width; let height = img.height; const maxSize = 600;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            if (type === 'create') {
                getEl('sa-comm-image-base64').value = base64; getEl('sa-comm-img-preview').src = base64; getEl('sa-comm-img-preview-container').classList.remove('hidden');
            } else {
                getEl('sa-edit-comm-image-base64').value = base64; getEl('sa-edit-comm-img-preview').src = base64; getEl('sa-edit-comm-img-preview').classList.remove('hidden');
                const placeholder = getEl('sa-edit-comm-img-placeholder'); if (placeholder) placeholder.classList.add('hidden');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

window.handleBannerImageUpload = function(event, targetInputId, previewId) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas'); let width = img.width; let height = img.height; const maxWidth = 1200; 
            if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth; }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            const targetInput = document.getElementById(targetInputId); if (targetInput) targetInput.value = base64;
            const previewImg = document.getElementById(previewId); if (previewImg) { previewImg.src = base64; previewImg.classList.remove('hidden'); }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function loadSAPartners() { setTimeout(() => { renderSAPartnersTable(); }, 300); }

function renderSAPartnersTable() {
    const tbody = getEl('sa-partners-table-body'); if (!tbody) return;
    if (saPartnersCache.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">אין שותפים רשומים.</td></tr>`; return; }
    tbody.innerHTML = saPartnersCache.map(p => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right flex items-center gap-3"><div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><i class="fa-solid fa-user-tie"></i></div><div>${safeStr(p.name)}<div class="text-[10px] text-slate-500 mt-0.5">נוצר: ${new Date(p.created_at).toLocaleDateString('he-IL')}</div></div></td>
            <td class="px-4 py-4 text-slate-600 text-right dir-ltr font-mono text-sm">${safeStr(p.email)}</td>
            <td class="px-4 py-4 text-center"><span class="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold text-xs"><i class="fa-solid fa-link"></i> ${p.clients_count || 0} לקוחות</span></td>
            <td class="px-4 py-4 text-center"><button onclick="deleteSAPartner(${p.id})" class="text-red-400 hover:text-red-600 bg-red-50 w-8 h-8 rounded-lg shadow-sm transition inline-flex items-center justify-center"><i class="fa-solid fa-trash"></i></button></td>
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
                <input type="text" id="sa-partner-name" class="modern-input mb-3" placeholder="למשל: סוכנות הטמעות">
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
    } else { modal.classList.remove('hidden'); }
    getEl('sa-partner-name').value = ''; getEl('sa-partner-email').value = ''; getEl('sa-partner-pass').value = '';
}

async function saveNewPartner() {
    const name = val('sa-partner-name'); const email = val('sa-partner-email'); const password = val('sa-partner-pass');
    if (!name || !email || !password) return showToast('error', 'יש למלא את כל השדות');
    saPartnersCache.push({ id: mockPartnerCounter++, name: name, email: email, created_at: new Date().toISOString(), clients_count: 0 });
    showToast('success', 'שותף חדש הוקם בהצלחה!');
    getEl('sa-add-partner-modal').classList.add('hidden');
    renderSAPartnersTable();
}

async function deleteSAPartner(id) {
    if(!confirm('האם אתה בטוח שברצונך למחוק שותף זה? הפעולה לא תמחק את לקוחותיו.')) return;
    saPartnersCache = saPartnersCache.filter(p => p.id !== id);
    showToast('success', 'השותף נמחק בהצלחה');
    renderSAPartnersTable();
}

// ==========================================
// OVERRIDE FINAL: פתרון תעלומת האדמין הישן (העלמת טוקן חכמה)
// ==========================================
window.impersonateGroup = function(groupId, userId) {
    const targetGroup = saAllGroups.find(g => g.id === groupId);
    let targetUser = userId ? saAllUsers.find(u => u.id === userId) : saAllUsers.find(u => u.group_id === groupId && u.role === 'ADMIN');
    if (!targetUser) targetUser = saAllUsers.find(u => u.group_id === groupId);
    
    if (!targetUser && targetGroup && targetGroup.type === 'BUSINESS') {
        targetUser = { id: 99999, nickname: targetGroup.name, role: 'ADMIN', group_id: groupId };
    }
    
    if (targetGroup && targetUser) {
        const currentToken = typeof saToken !== 'undefined' ? saToken : localStorage.getItem('ofl_sa_token');
        if (currentToken) {
            localStorage.setItem('ofl_sa_return_token', currentToken);
        }
        localStorage.removeItem('ofl_sa_token'); 
        
        localStorage.removeItem('ofl_session');
        localStorage.removeItem('ofl_token'); 
        
        const sessionData = { 
            user: targetUser, 
            group: targetGroup, 
            isImpersonating: true 
        };
        
        if (targetGroup.type) sessionData.group.type = targetGroup.type.toString().toUpperCase();
        
        localStorage.setItem('ofl_session', JSON.stringify(sessionData));
        showToast('success', 'יוצר סביבת לקוח נקייה...');
        
        setTimeout(() => {
            const isBiz = targetGroup.type && targetGroup.type.toString().toUpperCase() === 'BUSINESS';
            const targetUrl = isBiz ? '/business.html' : '/';
            window.open(targetUrl, '_blank');
            
            setTimeout(() => {
                if (currentToken) localStorage.setItem('ofl_sa_token', currentToken);
            }, 2000);
        }, 300);
    } else {
        showToast('error', 'שגיאה: נתוני הלקוח לא נמצאו בזיכרון המנהל.');
    }
};
// ==========================================
// --- PRODUCT MATRIX & QA CENTER (CONNECTED TO DB) ---
// ==========================================

let productMatrixData = [];

window.loadProductMatrix = async function() {
    try {
        const res = await fetch(`${API}/sa/matrix`, { headers: { 'Authorization': typeof saToken !== 'undefined' ? saToken : '' }});
        const data = await res.json();
        if(data.success) {
            productMatrixData = data.matrix || [];
            renderProductMatrix();
        }
    } catch(e) { console.error('Error loading matrix', e); }
};

window.renderProductMatrix = function() {
    const listEl = document.getElementById('product-matrix-list');
    if (!listEl) return;
    
    // הגדרת נראות הסביבות שלך
    const envConfigs = {
        'family': { name: 'ONEFLOW LIFE (משפחות)', icon: 'fa-house-chimney text-emerald-500', color: 'emerald' },
        'business': { name: 'ONEFLOW LIFE BIZ (עסקים)', icon: 'fa-briefcase text-blue-500', color: 'blue' },
        'community': { name: 'COMMUNITIES (קהילות)', icon: 'fa-users-rays text-indigo-500', color: 'indigo' },
        'sa': { name: 'SUPER ADMIN (ניהול)', icon: 'fa-shield-halved text-slate-500', color: 'slate' }
    };

    // המרת רשימת השרת השטוחה למבנה היררכי להצגה
    const grouped = productMatrixData.reduce((acc, item) => {
        const env = item.environment || 'family';
        const mod = item.module_name || 'כללי';
        if (!acc[env]) acc[env] = {};
        if (!acc[env][mod]) acc[env][mod] = [];
        acc[env][mod].push(item);
        return acc;
    }, {});

    let html = '';
    let totalTests = 0; let passedCount = 0; let failedCount = 0; let untestedCount = 0;

    Object.keys(grouped).forEach(envKey => {
        const envConfig = envConfigs[envKey] || envConfigs['family'];
        const modules = grouped[envKey];
        
        html += `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5 fade-in">
                    <div class="bg-${envConfig.color}-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-lg"><i class="fa-solid ${envConfig.icon}"></i></div>
                            <h2 class="text-lg font-black text-slate-800">${envConfig.name}</h2>
                        </div>
                        <button onclick="addMatrixItemPrompt('${envKey}')" class="text-xs bg-white border border-${envConfig.color}-200 text-${envConfig.color}-600 px-3 py-1.5 rounded-lg shadow-sm font-bold hover:bg-${envConfig.color}-100 transition flex items-center gap-1"><i class="fa-solid fa-plus"></i> הוסף בדיקה</button>
                    </div>
                    <div class="p-4 space-y-4">`;
        
        Object.keys(modules).forEach(modName => {
            html += `<div class="border border-slate-100 rounded-xl overflow-hidden">
                        <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                            <h3 class="font-bold text-slate-700 text-sm"><i class="fa-solid fa-cube text-slate-400 ml-1"></i> ${modName}</h3>
                        </div>
                        <div class="divide-y divide-slate-50">`;
            
            modules[modName].forEach(test => {
                totalTests++;
                if (test.status === 'passed') passedCount++;
                else if (test.status === 'failed') failedCount++;
                else if (test.status === 'untested') untestedCount++;

                let statusBg = 'bg-slate-100 text-slate-500'; let statusIcon = 'fa-circle-minus'; let statusLabel = 'טרם נבדק';
                if (test.status === 'passed') { statusBg = 'bg-green-100 text-green-700'; statusIcon = 'fa-check'; statusLabel = 'תקין'; }
                if (test.status === 'failed') { statusBg = 'bg-red-100 text-red-700'; statusIcon = 'fa-bug'; statusLabel = 'באג / נכשל'; }
                if (test.status === 'in_dev') { statusBg = 'bg-blue-100 text-blue-700'; statusIcon = 'fa-person-digging'; statusLabel = 'בפיתוח'; }

                html += `
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center p-3 gap-3 hover:bg-slate-50 transition relative group">
                        <div class="flex-1 pr-8">
                            <button onclick="deleteMatrixItem(${test.id})" class="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 p-2" title="מחק תרחיש"><i class="fa-solid fa-trash-can"></i></button>
                            <span class="text-sm font-bold text-slate-700 block">${safeStr(test.scenario_name)}</span>
                            <span class="text-[10px] text-slate-400 mt-0.5 block">צפי: ${safeStr(test.expected_result)}</span>
                        </div>
                        <div class="flex items-center gap-2 w-full md:w-auto shrink-0">
                            <span class="px-2.5 py-1 rounded-md text-[10px] font-bold ${statusBg} flex items-center gap-1 border border-white/50 w-24 justify-center shadow-sm">
                                <i class="fa-solid ${statusIcon}"></i> ${statusLabel}
                            </span>
                            <select onchange="changeTestStatus(${test.id}, this.value, '${safeStr(test.scenario_name).replace(/'/g, "\\'")}', '${envKey}', '${safeStr(test.expected_result).replace(/'/g, "\\'")}')" class="modern-input py-1.5 px-2 text-xs bg-white font-bold w-auto cursor-pointer shadow-sm">
                                <option value="untested" ${test.status === 'untested' ? 'selected' : ''}>טרם נבדק ⚪</option>
                                <option value="passed" ${test.status === 'passed' ? 'selected' : ''}>תקין (Passed) 🟢</option>
                                <option value="failed" ${test.status === 'failed' ? 'selected' : ''}>באג (Failed) 🔴</option>
                                <option value="in_dev" ${test.status === 'in_dev' ? 'selected' : ''}>בפיתוח 🚧</option>
                            </select>
                        </div>
                    </div>`;
            });
            html += `</div></div>`;
        });
        html += `</div></div>`;
    });
    
    if (productMatrixData.length === 0) {
        html = `<div class="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                    <i class="fa-solid fa-clipboard-list text-4xl text-slate-300 mb-3"></i>
                    <h3 class="text-slate-600 font-bold">ספר המוצר ריק</h3>
                    <p class="text-slate-400 text-sm mt-1 mb-4">הוסף את תרחיש הבדיקה הראשון שלך באמצעות הכפתורים למעלה.</p>
                    <div class="flex justify-center gap-2">
                        <button onclick="addMatrixItemPrompt('family')" class="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-200 transition">תרחיש משפחה</button>
                        <button onclick="addMatrixItemPrompt('business')" class="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-200 transition">תרחיש עסק</button>
                    </div>
                </div>`;
    }
    
    listEl.innerHTML = html;

    const progressPct = totalTests === 0 ? 0 : Math.round((passedCount / totalTests) * 100);
    const progressBar = document.getElementById('matrix-progress-bar');
    if (progressBar) progressBar.style.width = `${progressPct}%`;
    const progressText = document.getElementById('matrix-progress-text');
    if (progressText) progressText.innerText = `${progressPct}% כיסוי תקין`;
    
    if(getEl('matrix-count-passed')) getEl('matrix-count-passed').innerText = passedCount;
    if(getEl('matrix-count-failed')) getEl('matrix-count-failed').innerText = failedCount;
    if(getEl('matrix-count-untested')) getEl('matrix-count-untested').innerText = untestedCount;
};

window.changeTestStatus = async function(id, newStatus, title, envId, expected) {
    // עדכון מקומי זמני למהירות תגובה בממשק
    const item = productMatrixData.find(i => i.id === id);
    if (item) item.status = newStatus;
    renderProductMatrix();

    try {
        await fetch(`${API}/sa/matrix/${id}/status`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : '' },
            body: JSON.stringify({ status: newStatus })
        });
    } catch(e) { showToast('error', 'שגיאה בעדכון מסד הנתונים'); }
    
    // אם הסטטוס נכשל - פותח מודאל באג כדי לדווח ללוח הפיתוח
    if (newStatus === 'failed') {
        openDevBugModal(envId, item ? item.module_name : '', id, title, expected);
    }
};

window.deleteMatrixItem = async function(id) {
    if(!confirm('האם למחוק תרחיש זה מספר המוצר לצמיתות?')) return;
    try {
        await fetch(`${API}/sa/matrix/${id}`, { method: 'DELETE', headers: { 'Authorization': typeof saToken !== 'undefined' ? saToken : '' } });
        showToast('success', 'התרחיש נמחק');
        loadProductMatrix();
    } catch(e) { showToast('error', 'שגיאת מחיקה בשרת'); }
};

window.openDevBugModal = function(envId, modName, testId, title, expected) {
    if(getEl('dev-bug-env-id')) getEl('dev-bug-env-id').value = envId;
    if(getEl('dev-bug-mod-id')) getEl('dev-bug-mod-id').value = modName;
    if(getEl('dev-bug-test-id')) getEl('dev-bug-test-id').value = testId;
    if(getEl('dev-bug-test-title')) getEl('dev-bug-test-title').innerText = title;
    
    if(getEl('dev-bug-actual')) getEl('dev-bug-actual').value = '';
    if(getEl('dev-bug-expected')) getEl('dev-bug-expected').value = expected || '';
    
    if(getEl('dev-bug-modal')) getEl('dev-bug-modal').classList.remove('hidden');
};

// פונקציית הוספה חכמה ללא צורך במודאל מסורבל
window.addMatrixItemPrompt = async function(envType) {
    const moduleName = prompt("הכנס שם מודול (למשל: 'רשימת קניות', 'דשבורד'):", "מודול כללי");
    if (!moduleName) return;
    const scenarioName = prompt("הכנס תיאור קצר של מה שנבדק (למשל: 'הוספת פריט'):");
    if (!scenarioName) return;
    const expectedResult = prompt("מה התוצאה המצופה? (למשל: 'הפריט נוסף לעגלה'):");
    if (!expectedResult) return;
    
    try {
        const res = await fetch(`${API}/sa/matrix`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : '' },
            body: JSON.stringify({ environment: envType, moduleName, scenarioName, expectedResult })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'התרחיש נוצר במסד הנתונים!');
            loadProductMatrix();
        } else {
            showToast('error', 'שגיאה ביצירת תרחיש');
        }
    } catch(e) { showToast('error', 'שגיאת רשת בשמירת תרחיש'); }
};

// ==========================================
// --- NOTIFICATIONS & INBOX SYSTEM ---
// ==========================================
window.addSANotification = function(text, type='info', ticketId=null) {
    if(!window.currentSAUser) return;
    const uid = window.currentSAUser.id;
    let notifs = JSON.parse(localStorage.getItem('sa_notifs_' + uid) || '[]');
    notifs.unshift({ id: Date.now(), text, type, ticketId, read: false, date: new Date().toISOString() });
    localStorage.setItem('sa_notifs_' + uid, JSON.stringify(notifs));
    window.renderSANotifications();
};

window.renderSANotifications = function() {
    if(!window.currentSAUser) return;
    const uid = window.currentSAUser.id;
    let notifs = JSON.parse(localStorage.getItem('sa_notifs_' + uid) || '[]');
    const unreadCount = notifs.filter(n => !n.read).length;
    
    const badge = document.getElementById('sa-notif-badge');
    if (badge) {
        if (unreadCount > 0) { badge.innerText = unreadCount; badge.classList.remove('hidden'); } 
        else { badge.classList.add('hidden'); }
    }
    
    const list = document.getElementById('sa-notif-list');
    if (!list) return;
    
    if (notifs.length === 0) {
        list.innerHTML = '<div class="text-center text-slate-400 py-6 text-xs">אין התראות חדשות</div>';
        return;
    }
    
    const iconMap = { 'info': 'fa-info-circle text-blue-500', 'success': 'fa-check-circle text-green-500', 'warning': 'fa-exclamation-triangle text-orange-500' };
    list.innerHTML = notifs.map(n => {
        const bgClass = n.read ? 'bg-white opacity-60' : 'bg-blue-50/50';
        return `
        <div class="${bgClass} p-3 rounded-xl border border-slate-100 flex gap-3 items-start cursor-pointer hover:bg-slate-50 transition" onclick="markNotifRead(${n.id})">
            <i class="fa-solid ${iconMap[n.type] || iconMap['info']} mt-0.5"></i>
            <div class="flex-1">
                <p class="text-xs font-bold text-slate-800 leading-tight">${safeStr(n.text)}</p>
                <div class="flex justify-between mt-1.5 items-center">
                    <span class="text-[9px] text-slate-400 font-bold">${new Date(n.date).toLocaleString('he-IL', {hour:'2-digit',minute:'2-digit', dateStyle:'short'})}</span>
                    ${n.ticketId ? `<span class="text-[9px] bg-slate-100 text-slate-500 px-1.5 rounded"><i class="fa-solid fa-ticket"></i> קריאה ${n.ticketId}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
};

window.toggleSANotifications = function() {
    const dd = document.getElementById('sa-notif-dropdown');
    if (dd) {
        dd.classList.toggle('hidden');
        if (!dd.classList.contains('hidden')) window.renderSANotifications();
    }
};

window.markNotifRead = function(notifId) {
    if(!window.currentSAUser) return;
    const uid = window.currentSAUser.id;
    let notifs = JSON.parse(localStorage.getItem('sa_notifs_' + uid) || '[]');
    const idx = notifs.findIndex(n => n.id === notifId);
    if (idx > -1) { notifs[idx].read = true; localStorage.setItem('sa_notifs_' + uid, JSON.stringify(notifs)); }
    window.renderSANotifications();
};

window.markAllNotifsRead = function() {
    if(!window.currentSAUser) return;
    const uid = window.currentSAUser.id;
    let notifs = JSON.parse(localStorage.getItem('sa_notifs_' + uid) || '[]');
    notifs.forEach(n => n.read = true);
    localStorage.setItem('sa_notifs_' + uid, JSON.stringify(notifs));
    window.renderSANotifications();
};

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('sa-notif-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden') && !e.target.closest('.relative.cursor-pointer')) {
        dropdown.classList.add('hidden');
    }
});

// ==========================================
// --- KANBAN BOARD LOGIC & NOTIFICATION SYNC ---
// ==========================================

let devKanbanTasks = [];

window.loadDevTasks = async function() {
    try {
        const previousTasks = JSON.parse(localStorage.getItem('sa_last_known_tasks') || '[]');
        const res = await fetch(`${API}/sa/dev/tasks`, { headers: { 'Authorization': typeof saToken !== 'undefined' ? saToken : '' }});
        const data = await res.json();
        
        if(data.success) {
            devKanbanTasks = data.tasks.map(t => ({
                id: t.id.toString(),
                title: t.title,
                type: t.type,
                priority: t.priority,
                status: t.status,
                desc: t.description || '',
                version: t.target_version || '',
                owner_id: t.owner_id || null,
                original_ticket_id: t.original_ticket_id || null
            }));

            // SYNC ENGINE: בודק אם סטטוס משימה ששייכת ליוזר הזה השתנה, ושולח התראה לתיבה
            if (window.currentSAUser) {
                devKanbanTasks.forEach(newTask => {
                    if (newTask.owner_id && parseInt(newTask.owner_id) === parseInt(window.currentSAUser.id)) {
                        const oldTask = previousTasks.find(old => old.id === newTask.id);
                        if (oldTask) {
                            if (oldTask.status === 'in_progress' && newTask.status === 'qa') {
                                window.addSANotification(`המשימה "${newTask.title}" סיימה פיתוח ועברה לבדיקות QA בספר.`, 'warning', newTask.original_ticket_id);
                            } else if (oldTask.status === 'qa' && newTask.status === 'done') {
                                window.addSANotification(`המשימה "${newTask.title}" עברה בדיקות QA בהצלחה ושוחררה ללקוחות!`, 'success', newTask.original_ticket_id);
                            } else if ((!oldTask.version || oldTask.version === 'SORTING') && newTask.version && newTask.version !== 'SORTING') {
                                window.addSANotification(`המשימה "${newTask.title}" אושרה ושוייכה לגרסת יעד: ${newTask.version}.`, 'info', newTask.original_ticket_id);
                            }
                        }
                    }
                });
            }
            localStorage.setItem('sa_last_known_tasks', JSON.stringify(devKanbanTasks));
            renderKanbanBoard();
        }
    } catch(e) { console.error('Error loading tasks', e); }
};

window.renderKanbanBoard = function() {
    const columns = { 'backlog': getEl('col-backlog'), 'in_progress': getEl('col-in_progress'), 'qa': getEl('col-qa'), 'done': getEl('col-done') };
    const counts = { 'backlog': 0, 'in_progress': 0, 'qa': 0, 'done': 0 };
    
    const versionFilter = val('kanban-version-filter').trim().toLowerCase();
    const searchFilter = val('kanban-search') ? val('kanban-search').trim().toLowerCase() : '';
    
    let filteredTasks = devKanbanTasks;
    
    if (versionFilter || searchFilter) {
        filteredTasks = devKanbanTasks.filter(t => {
            const matchVersion = !versionFilter || (t.version && t.version.toLowerCase().includes(versionFilter));
            const textToSearch = `${t.id} ${t.title || ''} ${t.description || ''} ${t.original_ticket_id || ''}`.toLowerCase();
            const matchSearch = !searchFilter || textToSearch.includes(searchFilter);
            return matchVersion && matchSearch;
        });
    }
    
    Object.values(columns).forEach(col => { if(col) col.innerHTML = ''; });
    
    if(filteredTasks.length === 0) {
        if(columns.backlog) columns.backlog.innerHTML = `<div class="text-[10px] text-slate-400 text-center py-4 border border-dashed border-slate-300 rounded-xl">לא נמצאו משימות.</div>`;
    }

    filteredTasks.forEach(task => {
        if(!columns[task.status]) return;
        counts[task.status]++;
        
        let typeBadge = '';
        if(task.type === 'bug') typeBadge = '<span class="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[9px] font-bold"><i class="fa-solid fa-bug"></i> באג</span>';
        else if(task.type === 'feature') typeBadge = '<span class="bg-green-100 text-green-600 px-1.5 py-0.5 rounded text-[9px] font-bold"><i class="fa-solid fa-wand-magic-sparkles"></i> פיצ\'ר</span>';
        else if(task.type === 'ui') typeBadge = '<span class="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded text-[9px] font-bold"><i class="fa-solid fa-palette"></i> עיצוב</span>';
        else if(task.type === 'tech') typeBadge = '<span class="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold"><i class="fa-solid fa-wrench"></i> תשתיות</span>';

        let prioIcon = '🟡';
        if(task.priority === 'critical') prioIcon = '🚨';
        else if(task.priority === 'high') prioIcon = '🔴';
        else if(task.priority === 'low') prioIcon = '🔵';

        // הדיגול הויזואלי החכם בהתאם לסטטוס בספר (סעיף 5 באפיון)
        let statusBadge = '';
        if (task.version === 'SORTING') {
            statusBadge = '<span class="bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[9px] font-bold"><i class="fa-solid fa-inbox"></i> ממתין למיון בספר</span>';
        } else if (task.status === 'in_progress' && task.version) {
            statusBadge = `<span class="bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold"><i class="fa-solid fa-code"></i> יעד: ${task.version}</span>`;
        } else if (task.status === 'qa') {
            statusBadge = '<span class="bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded text-[9px] font-bold"><i class="fa-solid fa-vial"></i> ממתין ל-QA בספר</span>';
        } else if (task.status === 'done') {
            statusBadge = '<span class="bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded text-[9px] font-bold"><i class="fa-solid fa-check-double"></i> שוחרר ללקוחות</span>';
        }

        // כפתור סגירת מעגל - מוצג רק למשימות שסיימו ובאו מלקוח
        let feedbackBtn = '';
        if (task.status === 'done' && task.original_ticket_id) {
            feedbackBtn = `<button onclick="event.stopPropagation(); window.openFeedbackLoopModal('${task.id}', '${task.original_ticket_id}')" class="w-full mt-3 bg-emerald-50 text-emerald-600 border border-emerald-200 py-1.5 rounded-lg text-[10px] font-black hover:bg-emerald-100 transition shadow-sm"><i class="fa-solid fa-handshake mr-1"></i> סגירת מעגל ללקוח</button>`;
        }

        // הפקת תצוגה מקדימה נקייה וקריאה של תוכן הלקוח מבחוץ (סעיף 1)
        const cleanDesc = task.desc ? task.desc.replace(/\\n/g, ' ').substring(0, 75) + (task.desc.length > 75 ? '...' : '') : 'ללא תיאור מורחב';

        const cardHtml = `
        <div id="${task.id}" draggable="true" ondragstart="dragKanbanTask(event)" onclick="openKanbanTaskModal('${task.id}')" class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 transition group relative flex flex-col min-h-[120px]">
            <div class="mb-2 w-full text-right">${statusBadge}</div>
            <div class="flex justify-between items-start mb-2">
                ${typeBadge}
                <span class="text-[10px]" title="דחיפות">${prioIcon}</span>
            </div>
            
            <h5 class="font-black text-slate-800 text-xs leading-snug mb-1.5">${safeStr(task.title)}</h5>
            <p class="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2 mb-3 leading-normal font-medium">${safeStr(cleanDesc)}</p>
            
            <div class="flex justify-between items-end mt-auto">
                <span class="text-[9px] text-slate-400 font-mono">#${task.id}</span>
                <div class="flex flex-col items-end gap-1">
                    ${task.original_ticket_id ? `<span class="text-[8px] font-bold text-slate-400 bg-slate-50 px-1 rounded border border-slate-100"><i class="fa-solid fa-ticket"></i> טיקט ${task.original_ticket_id}</span>` : ''}
                </div>
            </div>
            ${feedbackBtn}
        </div>
        `;
        columns[task.status].innerHTML += cardHtml;
    });

    Object.keys(counts).forEach(status => {
        const c = getEl('count-' + status);
        if(c) c.innerText = counts[status];
    });
    
    const totalEl = getEl('kanban-total-count');
    if (totalEl) totalEl.innerText = `${filteredTasks.length} משימות`;
};

window.prepareReleaseFromVersion = function() {
    const versionFilter = val('kanban-version-filter').trim();
    if (!versionFilter) return;
    
    const doneTasks = devKanbanTasks.filter(t => t.status === 'done' && t.version && t.version.toLowerCase().includes(versionFilter.toLowerCase()));
    if (doneTasks.length === 0) return showToast('error', 'אין משימות שנסגרו בגרסה זו');
    
    let pointsText = doneTasks.map(t => {
        let cleanTitle = t.title.replace(/^פנייה #[0-9]+:\s*/, '');
        cleanTitle = cleanTitle.replace(/^באג:\s*/, 'תיקון: ');
        return '- ' + cleanTitle;
    }).join('\n');
    
    const rawPointsInput = getEl('release-raw-points');
    const titleInput = getEl('release-title');
    
    if (rawPointsInput) rawPointsInput.value = pointsText;
    if (titleInput) titleInput.value = 'עדכון גרסה חגיגי - ' + versionFilter.toUpperCase();
    
    switchDevTab('release');
    showToast('success', 'הפיתוחים יובאו בהצלחה! לחץ כעת על "נסח ועצב עם FamilAI"');
};

window.allowKanbanDrop = function(ev) { ev.preventDefault(); };
window.dragKanbanTask = function(ev) { ev.dataTransfer.setData("taskId", ev.target.id); };

window.dropKanbanTask = async function(ev, newStatus) {
    ev.preventDefault();
    const taskId = ev.dataTransfer.getData("taskId");
    const task = devKanbanTasks.find(t => parseInt(t.id) === parseInt(taskId));
    
    if (!task) return;

    // חסימת מעבר ידני ל-DONE רק אם המשימה "בפיתוח"
    if (newStatus === 'done' && task.status === 'in_progress') {
        showToast('error', 'משימה זו נמצאת בפיתוח. היא תסגר ותעבור ל-DONE אוטומטית רק דרך אישור בספר ה-QA.');
        return; 
    }

    if (task.status !== newStatus) {
        task.status = newStatus;
        renderKanbanBoard(); 
        
        try {
            await fetch(`${API}/sa/dev/tasks/${taskId}/status`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : '' },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (newStatus === 'in_progress') {
                showToast('success', 'המשימה הועברה לפיתוח, וממתינה לאישור ומיון בספר ה-QA.');
            }
            
            // סגירת מעגל: אם הועברה ל-DONE ידנית וקיימת תגית לקוח, פתח חלונית ללקוח
            if (newStatus === 'done' && task.original_ticket_id) {
                if(typeof confetti === 'function') confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
                setTimeout(() => {
                    window.openFeedbackLoopModal(task.id, task.original_ticket_id);
                }, 600);
            }
        } catch(e) { showToast('error', 'שגיאה בעדכון הסטטוס'); }
    }
};

// --- קריאה יזומה עם חיפוש חכם ---
window.filterNewTicketGroups = function() {
    const term = getEl('new-ticket-group-search').value.toLowerCase().trim();
    const select = getEl('new-ticket-group');
    if (!select) return;
    const options = select.options;
    
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === "") continue; // דלג על "ללא שיוך"
        const text = options[i].text.toLowerCase();
        options[i].style.display = text.includes(term) ? '' : 'none';
    }
    
    // בוחר אוטומטית את התוצאה הראשונה הגלויה אם יש סינון
    if (term) {
        for (let i = 1; i < options.length; i++) {
            if (options[i].style.display !== 'none') {
                select.selectedIndex = i;
                break;
            }
        }
    } else { select.selectedIndex = 0; }
};

window.openNewTicketModal = function() {
    getEl('new-ticket-subject').value = '';
    getEl('new-ticket-desc').value = '';
    const searchEl = getEl('new-ticket-group-search');
    if(searchEl) searchEl.value = '';
    
    const groupSelect = getEl('new-ticket-group');
    if (groupSelect && typeof saAllGroups !== 'undefined') {
        groupSelect.innerHTML = '<option value="">-- ללא שיוך לקוח (פנימי) --</option>' + 
            saAllGroups.map(g => `<option value="${g.id}">${safeStr(g.name)} (קוד: ${safeStr(g.group_code)})</option>`).join('');
    }
    
    const modal = getEl('sa-new-ticket-modal');
    if (modal) modal.classList.remove('hidden');
};

window.submitNewTicket = async function() {
    const subject = val('new-ticket-subject');
    const desc = val('new-ticket-desc');
    const groupId = val('new-ticket-group') || null;
    
    if(!subject || !desc) return showToast('error', 'חובה למלא נושא ותיאור');
    
    const btn = document.querySelector('#sa-new-ticket-modal button.bg-indigo-600');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> פותח קריאה...'; }
    
    try {
        // מתוקן לשלוח group_id כפי שהשרת שלך מצפה בראוט שיצרנו
        const payload = { subject, description: desc };
        if (groupId) payload.group_id = groupId;
        
        const res = await fetch(`${API}/superadmin/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', 'הקריאה היזומה נפתחה בהצלחה!');
            getEl('sa-new-ticket-modal').classList.add('hidden');
            if(typeof loadSATickets === 'function') loadSATickets();
        } else {
            showToast('error', data.error || 'שגיאה ביצירת קריאה בשרת');
        }
    } catch(e) { 
        showToast('error', 'שגיאת רשת ביצירת קריאה'); 
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = 'פתח קריאה במערכת'; }
    }
};

window.openKanbanTaskModal = function(id = null) {
    const modal = getEl('dev-kanban-task-modal');
    if (!modal) return;
    const delBtn = getEl('btn-kanban-delete');
    
    if (id) {
        const task = devKanbanTasks.find(t => t.id === id);
        if(!task) return;
        getEl('kanban-modal-title').innerHTML = '<i class="fa-solid fa-pen text-indigo-500 mr-2"></i> עריכת משימה';
        getEl('kanban-task-id').value = task.id;
        getEl('kanban-task-title').value = task.title;
        getEl('kanban-task-type').value = task.type || 'feature';
        getEl('kanban-task-priority').value = task.priority || 'normal';
        getEl('kanban-task-desc').value = task.desc || '';
        getEl('kanban-task-owner-id').value = task.owner_id || '';
        getEl('kanban-task-ticket-id').value = task.original_ticket_id || '';
        delBtn.classList.remove('hidden');
    } else {
        getEl('kanban-modal-title').innerHTML = '<i class="fa-solid fa-plus text-indigo-500 mr-2"></i> משימה חדשה';
        getEl('kanban-task-id').value = '';
        getEl('kanban-task-title').value = '';
        getEl('kanban-task-type').value = 'feature';
        getEl('kanban-task-priority').value = 'normal';
        getEl('kanban-task-desc').value = '';
        getEl('kanban-task-owner-id').value = window.currentSAUser ? window.currentSAUser.id : '';
        getEl('kanban-task-ticket-id').value = '';
        delBtn.classList.add('hidden');
    }
    modal.classList.remove('hidden');
};

window.saveKanbanTaskData = async function() {
    const id = val('kanban-task-id');
    const title = val('kanban-task-title');
    const type = val('kanban-task-type');
    const priority = val('kanban-task-priority');
    const desc = val('kanban-task-desc');
    const ownerId = val('kanban-task-owner-id');
    const ticketId = val('kanban-task-ticket-id');
    
    if (!title) return showToast('error', 'חובה להזין כותרת למשימה');
    
    const payload = { 
        title, type, priority, description: desc, 
        owner_id: ownerId, original_ticket_id: ticketId 
    };
    
    try {
        if (id) {
            payload.status = devKanbanTasks.find(t => t.id === id)?.status || 'backlog';
            await fetch(`${API}/sa/dev/tasks/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : '' },
                body: JSON.stringify(payload)
            });
        } else {
            payload.status = 'backlog';
            await fetch(`${API}/sa/dev/tasks`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : '' },
                body: JSON.stringify(payload)
            });
        }
        showToast('success', 'המשימה נשמרה בלוח!');
        getEl('dev-kanban-task-modal').classList.add('hidden');
        loadDevTasks();
    } catch(e) { showToast('error', 'שגיאת רשת בשמירת משימה'); }
};

window.deleteKanbanTask = async function() {
    const id = val('kanban-task-id');
    if (!id || !confirm('למחוק משימה זו מהלוח וממסד הנתונים?')) return;
    
    try {
        await fetch(`${API}/sa/dev/tasks/${id}`, { method: 'DELETE', headers: { 'Authorization': typeof saToken !== 'undefined' ? saToken : '' } });
        showToast('success', 'המשימה נמחקה בהצלחה');
        getEl('dev-kanban-task-modal').classList.add('hidden');
        loadDevTasks();
    } catch(e) { showToast('error', 'שגיאת רשת במחיקה'); }
};

// ==========================================
// --- המרת קריאת שירות למשימת פיתוח (סעיפים 1+4 באפיון) ---
// ==========================================
window.convertTicketToDevTask = function() {
    if (!saCurrentTicketId) return;
    
    const t = saTicketsCache.find(x => x.id === saCurrentTicketId);
    if (!t) return;
    
    document.getElementById('sa-ticket-modal').classList.add('hidden');
    switchSATab('devops');
    switchDevTab('kanban');
    
    const defaultTitle = `פנייה #${t.id}: ${t.subject}`;
    const defaultDesc = `קריאת שירות #${t.id}\nמאת: ${t.group_name} (${t.user_name})\n\nתיאור התקלה מהלקוח:\n${t.description}`;
    
    openKanbanTaskModal();
    
    setTimeout(() => {
        // שמירת ה"אבא" של המשימה במשתנים הנסתרים
        getEl('kanban-task-owner-id').value = window.currentSAUser ? window.currentSAUser.id : '';
        getEl('kanban-task-ticket-id').value = t.id;
        
        getEl('kanban-task-title').value = defaultTitle;
        getEl('kanban-task-desc').value = defaultDesc;
        getEl('kanban-task-type').value = 'bug';
        getEl('kanban-task-priority').value = 'high';
        
        showToast('info', 'הקריאה קושרה! השלם את יצירת המשימה.');
    }, 100);
};

// ==========================================
// --- סגירת מעגל ללקוח (Feedback Loop) ---
// ==========================================
window.openFeedbackLoopModal = function(taskId, ticketId) {
    getEl('feedback-loop-task-id').value = taskId;
    getEl('feedback-loop-ticket-id').value = ticketId;
    
    const t = saTicketsCache.find(x => x.id === parseInt(ticketId));
    const clientName = t ? t.user_name : 'לקוח יקר';
    const taskObj = devKanbanTasks.find(task => task.id === taskId);
    let taskTitle = taskObj ? taskObj.title : 'בקשת השירות שלך';
    taskTitle = taskTitle.replace(/^פנייה #[0-9]+:\s*/, '').replace(/^באג:\s*/, ''); // מנקה את הטקסט שייראה יפה ללקוח

    getEl('feedback-loop-text').value = `שלום ${clientName},\n\nשמחים לעדכן שהבקשה שלך בנושא "${taskTitle}" טופלה בהצלחה ועלתה לאוויר בגרסה האחרונה.\n\nתודה על הסבלנות,\nצוות התמיכה.`;
    getEl('sa-feedback-loop-modal').classList.remove('hidden');
};

window.executeFeedbackLoop = async function() {
    const ticketId = val('feedback-loop-ticket-id');
    const text = val('feedback-loop-text');
    
    if(!text) return showToast('error', 'הזן נוסח להודעה');
    const senderName = window.currentSAUser ? window.currentSAUser.name : 'צוות מערכת';
    
    try {
        const res = await fetch(`${API}/superadmin/tickets/${ticketId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ message: text, status: 'resolved', isInternal: false, senderName: senderName })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'המעגל נסגר! הלקוח עודכן והקריאה נסגרה. 🎉');
            getEl('sa-feedback-loop-modal').classList.add('hidden');
            if(typeof loadSATickets === 'function') loadSATickets(); // מרענן את רשימת הטיקטים
        } else {
            showToast('error', data.error || 'שגיאה בסגירת מעגל');
        }
    } catch(e) { showToast('error', 'שגיאת רשת בחיבור ללקוח'); }
};
// ==========================================
// ==========================================
// --- FAMILAI OPERATIONS (SPRINT 2) ---
// ==========================================

// סיווג AI חכם לטיקט קיים (Triage)
window.runFamilAITriage = async function() {
    if (!saCurrentTicketId) return showToast('error', 'לא נבחרה קריאה תקינה');
    
    const btn = getEl('btn-ai-triage');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> מסווג...';
    
    try {
        const res = await fetch(`${API}/superadmin/tickets/${saCurrentTicketId}/ai-triage`, {
            method: 'POST',
            headers: { 'Authorization': saToken }
        });
        const data = await res.json();
        
        if (data.success && data.classification) {
            const { priority, ticketType } = data.classification;
            
            // עדכון הממשק (Visual Feedback)
            const prioSelect = getEl('sa-ticket-priority');
            const typeSelect = getEl('sa-ticket-type');
            
            if (prioSelect) {
                prioSelect.value = priority;
                prioSelect.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50');
                setTimeout(() => prioSelect.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50'), 1500);
            }
            if (typeSelect) {
                typeSelect.value = ticketType;
                typeSelect.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50');
                setTimeout(() => typeSelect.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50'), 1500);
            }
            
            showToast('success', 'הסיווג הושלם ונשמר ללוג!');
            await loadSATickets(); // רענון כדי לקבל את הלוג המעודכן עם תגית הסנטימנט
            openSATicketModal(saCurrentTicketId); // פתיחה מחדש כדי להציג שינויים
        } else {
            showToast('error', data.error || 'שגיאה בסיווג ה-AI');
        }
    } catch(e) {
        showToast('error', 'שגיאת רשת בבקשת סיווג AI');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// ==========================================
// --- המרת קריאת שירות למשימת פיתוח עם AI Deduplication ---
// ==========================================
window.convertTicketToDevTask = async function() {
    if (!saCurrentTicketId) {
        showToast('error', 'לא נבחרה קריאה תקינה');
        return;
    }
    
    const t = saTicketsCache.find(x => x.id === saCurrentTicketId);
    if (!t) return;

    const btn = getEl('btn-sa-ticket-dev');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ה-AI בודק כפילויות...';

    try {
        // שלב 1: ה-AI בודק האם המשימה כבר קיימת בלוח הפיתוח
        const res = await fetch(`${API}/sa/dev/check-duplicates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ description: t.subject + " " + t.description })
        });
        const aiData = await res.json();

        btn.innerHTML = originalText;
        btn.disabled = false;

        if (aiData.success && aiData.isDuplicate) {
            const msg = `FamilAI זיהה משימה קיימת דומה בלוח הפיתוח!\n\nסיבה: ${aiData.explanation}\nמזהה משימה כפולה: #${aiData.matchedTaskId}\nרמת ביטחון: ${aiData.confidence}%\n\nהאם למזג ולהמשיך בכל זאת?`;
            if (!confirm(msg)) {
                return; // הנציג בחר שלא לפתוח כפילות. הטיקט נשאר.
            }
        }
        
        // שלב 2: אם אין כפילות או שהנציג החליט להמשיך, ממירים רגיל
        document.getElementById('sa-ticket-modal').classList.add('hidden');
        switchSATab('devops');
        switchDevTab('kanban');
        
        const defaultTitle = `פנייה #${t.id}: ${t.subject}`;
        const defaultDesc = `קריאת שירות #${t.id}\nמאת: ${t.group_name} (${t.user_name})\n\nתיאור התקלה מהלקוח:\n${t.description}`;
        
        openKanbanTaskModal();
        
        setTimeout(() => {
            const titleEl = document.getElementById('kanban-task-title');
            const descEl = document.getElementById('kanban-task-desc');
            const typeEl = document.getElementById('kanban-task-type');
            const priorityEl = document.getElementById('kanban-task-priority');
            
            if (titleEl) titleEl.value = defaultTitle;
            if (descEl) descEl.value = defaultDesc;
            if (typeEl) typeEl.value = 'bug';
            if (priorityEl) priorityEl.value = 'high';
            
            showToast('info', 'פרטי הקריאה הועתקו ללוח המשימות!');
        }, 100);

    } catch (e) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        showToast('error', 'שגיאת רשת בבדיקת AI');
    }
};
// ==========================================
// --- מרכז שיווק והשקות (AI, Logo & PDF) ---
// ==========================================

window.handleReleaseLogoUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 400;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/png');
            
            getEl('release-logo-base64').value = base64;
            getEl('release-logo-preview').src = base64;
            getEl('release-logo-preview').classList.remove('hidden');
            if(getEl('release-logo-icon')) getEl('release-logo-icon').classList.add('hidden');
            
            localStorage.setItem('ofl_release_logo', base64);
            showToast('success', 'לוגו השקה נשמר בהצלחה!');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.generateReleaseNotesAI = async function() {
    const title = val('release-title');
    const subtitle = val('release-subtitle') || 'הכרזה על גרסה חדשה 🚀';
    const rawPoints = val('release-raw-points');
    const tone = val('release-tone');
    const lengthChoice = val('release-length') || 'standard';
    const colorChoice = val('release-color') || 'purple';
    const uploadedLogo = val('release-logo-base64');
    
    if (!rawPoints) return showToast('error', 'יש להזין לפחות נקודה אחת מהפיתוח');
    
    const btn = getEl('btn-generate-release');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> FamilAI בונה...';
    
    try {
        const lengthInstruction = lengthChoice === 'standard' ? 'חובה 50 מילים.' : 'כתוב כ-120 מילים.';
        const promptContext = `אתה קופירייטר. כתוב הודעה על עדכון גרסה. כותרת: "${title || 'עדכון מערכת'}". טון: ${tone}. ${lengthInstruction} אל תכתוב פתיחה! השתמש ב-<br>, <strong>. נקודות: ${rawPoints}`;

        const res = await fetch(`${API}/sa/ai-generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : '' },
            body: JSON.stringify({ query: 'נסח כעת ללא הקדמות', context: promptContext })
        });
        
        const textRes = await res.text();
        let data;
        try { data = JSON.parse(textRes); } catch(err) { throw new Error("שגיאה במנוע ה-AI"); }

        if (data.success) {
            let formattedContent = data.answer.replace(/^(בטח|הנה|לבקשתך|כמובן|בשמחה|FamilAI)[^\n]*\n+/gi, '').trim();
            formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            
            const themeColors = { purple: ['#4f46e5', '#9333ea'], blue: ['#2563eb', '#1d4ed8'], emerald: ['#10b981', '#047857'], orange: ['#f97316', '#ea580c'], slate: ['#475569', '#1e293b'] };
            const [gradStart, gradEnd] = themeColors[colorChoice] || themeColors.purple;
            const mascotImg = uploadedLogo || window.currentFamilaiLogo || 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png';
            
            const htmlTemplate = `<div id='newsletter-content-wrap' style='max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; direction: rtl; text-align: right; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff !important; overflow: hidden;'><table width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='${gradStart}' style='background-color: ${gradStart} !important; background-image: linear-gradient(135deg, ${gradStart}, ${gradEnd}) !important; text-align: center;'><tr><td style='padding: 30px 20px;' align='center'><img src='${mascotImg}' onerror=\"this.style.display='none'\" style='width: 80px; height: 80px; object-fit: contain; border-radius: 50%; border: 3px solid #ffffff; background: #ffffff; margin-bottom: 12px; display: inline-block;'><h1 style='color: #ffffff !important; font-size: 22px; font-weight: bold; margin: 0; line-height: 1.2;'>${(title || 'עדכון חדש!').replace(/ /g, '\u00A0')}</h1><h2 style='color: #f1f5f9 !important; font-size: 14px; font-weight: normal; margin: 5px 0 0 0; opacity: 0.9;'>${subtitle.replace(/ /g, '\u00A0')}</h2></td></tr></table><div style='padding: 25px; color: #334155 !important; font-size: 15px; line-height: 1.5; text-align: right; background-color: #ffffff !important;'>${formattedContent.trim()}</div><div style='background-color: #f8fafc !important; border-top: 1px solid #e2e8f0; padding: 15px; text-align: center;'><p style='color: ${gradStart} !important; font-size: 14px; margin: 0; font-weight: bold;'>צוות Oneflow Life</p></div></div>`;
            
            const editor = getEl('release-editor');
            if(getEl('release-editor-placeholder')) getEl('release-editor-placeholder').style.display = 'none';
            editor.innerHTML = htmlTemplate;
            showToast('success', 'הטמפלט מוכן!');
        } else { showToast('error', data.error || 'שגיאה.'); }
    } catch (e) { showToast('error', e.message); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> נסח ועצב עם FamilAI'; }
};

window.generateManualRelease = function() {
    const title = val('release-title');
    const subtitle = val('release-subtitle') || 'הכרזה על גרסה חדשה 🚀';
    const manualText = val('release-manual-text');
    const colorChoice = val('release-color') || 'purple';
    const uploadedLogo = val('release-logo-base64');
    
    if (!manualText || manualText.trim() === '') return showToast('error', 'יש להזין טקסט ידני');
    let formattedContent = manualText.replace(/\n/g, '<br>');
    
    const themeColors = { purple: ['#4f46e5', '#9333ea'], blue: ['#2563eb', '#1d4ed8'], emerald: ['#10b981', '#047857'], orange: ['#f97316', '#ea580c'], slate: ['#475569', '#1e293b'] };
    const [gradStart, gradEnd] = themeColors[colorChoice] || themeColors.purple;
    const mascotImg = uploadedLogo || window.currentFamilaiLogo || 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png';
    
    const htmlTemplate = `<div id='newsletter-content-wrap' style='max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; direction: rtl; text-align: right; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff !important; overflow: hidden;'><table width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='${gradStart}' style='background-color: ${gradStart} !important; background-image: linear-gradient(135deg, ${gradStart}, ${gradEnd}) !important; text-align: center;'><tr><td style='padding: 30px 20px;' align='center'><img src='${mascotImg}' onerror=\"this.style.display='none'\" style='width: 80px; height: 80px; object-fit: contain; border-radius: 50%; border: 3px solid #ffffff; background: #ffffff; margin-bottom: 12px; display: inline-block;'><h1 style='color: #ffffff !important; font-size: 22px; font-weight: bold; margin: 0; line-height: 1.2;'>${(title || 'עדכון חדש!').replace(/ /g, '\u00A0')}</h1><h2 style='color: #f1f5f9 !important; font-size: 14px; font-weight: normal; margin: 5px 0 0 0; opacity: 0.9;'>${subtitle.replace(/ /g, '\u00A0')}</h2></td></tr></table><div style='padding: 25px; color: #334155 !important; font-size: 15px; line-height: 1.5; text-align: right; background-color: #ffffff !important;'>${formattedContent}</div><div style='background-color: #f8fafc !important; border-top: 1px solid #e2e8f0; padding: 15px; text-align: center;'><p style='color: ${gradStart} !important; font-size: 14px; margin: 0; font-weight: bold;'>צוות Oneflow Life</p></div></div>`;
    
    const editor = getEl('release-editor');
    if(getEl('release-editor-placeholder')) getEl('release-editor-placeholder').style.display = 'none';
    editor.innerHTML = htmlTemplate;
    showToast('success', 'הטמפלט הידני מוכן!');
};

window.copyReleaseNotes = function() {
    const editor = getEl('release-editor');
    const htmlContent = editor.innerHTML;
    if (!htmlContent || htmlContent.includes('תוצאת ה-AI') || htmlContent.includes('תוצאת ה- AI')) return showToast('info', 'אין טקסט להעתקה');
    
    navigator.clipboard.writeText(htmlContent).then(() => {
        showToast('success', 'קוד ה-HTML הועתק בהצלחה!');
    }).catch(err => {
        showToast('error', 'שגיאה בהעתקה');
    });
};

window.exportToPDF = function() {
    const element = document.getElementById('newsletter-content-wrap');
    if (!element) return showToast('error', 'יש לחולל טמפלט קודם לפני ייצוא ל-PDF');

    const htmlDoc = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Oneflow Release Notes</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            background: #f1f5f9;
            display: flex;
            justify-content: center;
            padding: 30px 20px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        @media print {
            body { background: white; padding: 0; }
            .no-print { display: none !important; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .no-print {
            text-align: center;
            margin-bottom: 20px;
            font-family: Arial, sans-serif;
        }
        .no-print button {
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 32px;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
            font-family: Arial, sans-serif;
        }
        .no-print p {
            color: #64748b;
            font-size: 12px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div>
        <div class="no-print">
            <button onclick="window.print()">⬇️ שמור כ-PDF</button>
            <p>לחץ על "שמור כ-PDF" ← בחר "שמור כ-PDF" במדפסת</p>
        </div>
        ${element.outerHTML}
    </div>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) return showToast('error', 'אנא אפשר חלונות קופצים עבור אתר זה ונסה שוב');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    showToast('success', 'הניוזלטר נפתח בלשונית חדשה — לחץ "שמור כ-PDF"');
};

window.broadcastReleaseNotes = async function() {
    // 1. הגנה על שליפת אזור העורך (מונע קריסה אם ה-ID השתנה)
    const editor = document.getElementById('release-editor');
    if (!editor) return showToast('error', 'שגיאה: לא נמצא אזור העורך במסך.');
    const content = editor.innerHTML;
    
    // 2. הגנה על שליפת כותרת (אם הוא לא מוצא את השדה, ישתמש בברירת מחדל)
    const titleEl = document.getElementById('release-title');
    const title = (titleEl && titleEl.value) ? titleEl.value : 'עדכון גרסה חדש!';
    
    // 3. הגנה על בחירת הקהל (חיפוש מורחב למקרה שה-ID שונה ב-HTML)
    const audienceEl = document.getElementById('release-target-audience') || document.getElementById('release-audience') || document.getElementById('target-audience');
    const audience = (audienceEl && audienceEl.value) ? audienceEl.value : 'all'; 
    
    // 4. בדיקת תוכן ולוגיקת שיגור רגילה
    if (!content || content.includes('תוצאת ה-AI') || content.trim() === '') return showToast('error', 'העורך ריק. צור או כתוב הודעה תחילה.');
    if (!confirm('האם לשגר את ההודעה הזו לתיבת ה-Inbox של הלקוחות?')) return;
    
    const btn = document.getElementById('btn-broadcast-release');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> משגר...';
    }
    
    try {
        let targets = [];
        if (audience === 'business') targets = ['all']; 
        else if (audience === 'family') targets = ['all_families']; 
        else targets = ['all', 'all_families']; // ברירת מחדל לכולם אם לא זוהתה בחירה

        let totalSent = 0;
        let hasError = false;
        let errorMessage = '';

        for (let tType of targets) {
            const res = await fetch(`${API}/sa/inbox/broadcast`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : '' },
                body: JSON.stringify({ targetType: tType, targetValue: '', subject: title, content })
            });
            const data = await res.json();
            if (data.success) {
                totalSent += (data.count || 0);
            } else {
                hasError = true;
                errorMessage = data.error;
            }
        }
        
        if (totalSent > 0) {
            showToast('success', `ההשקה שוגרה בהצלחה ל-${totalSent} סביבות! 🚀`);
        } else if (hasError) {
            showToast('error', errorMessage || 'שגיאה בשיגור ההודעה.');
        } else {
            showToast('error', 'לא נמצאו נמענים מתאימים לשיגור.');
        }
    } catch(e) { 
        showToast('error', 'שגיאת תקשורת מול השרת: ' + e.message); 
    } finally { 
        if (btn) {
            btn.disabled = false; 
            btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> שגר ללקוחות'; 
        }
    }
};

window.addEventListener('load', () => {
    setTimeout(() => {
        const savedReleaseLogo = localStorage.getItem('ofl_release_logo');
        if (savedReleaseLogo) {
            const preview = getEl('release-logo-preview');
            const icon = getEl('release-logo-icon');
            const base64input = getEl('release-logo-base64');
            if (preview && base64input) {
                base64input.value = savedReleaseLogo;
                preview.src = savedReleaseLogo;
                preview.classList.remove('hidden');
                if (icon) icon.classList.add('hidden');
            }
        }
    }, 1000);
});
// ==========================================
// --- SUPER ADMIN: HR & RBAC (TEAMS & USERS) ---
// ==========================================
let saTeamsCache = [];
let saStaffCache = [];

window.loadSAHRData = async function() {
    try {
        const [teamsRes, staffRes] = await Promise.all([
            fetch(`${API}/sa/teams`, { headers: { 'Authorization': saToken } }),
            fetch(`${API}/sa/staff`, { headers: { 'Authorization': saToken } })
        ]);
        const teamsData = await teamsRes.json();
        const staffData = await staffRes.json();
        
        if (teamsData.success) saTeamsCache = teamsData.teams || [];
        if (staffData.success) saStaffCache = staffData.staff || [];
        
        renderSATeams();
        renderSAStaff();
    } catch(e) { console.error('Error loading HR data', e); }
};

window.renderSATeams = function() {
    const list = getEl('sa-teams-list');
    if (!list) return;
    if (saTeamsCache.length === 0) {
        list.innerHTML = '<div class="col-span-full text-center text-slate-400 bg-slate-50 py-6 rounded-xl border border-dashed border-slate-200">אין צוותים מוגדרים במערכת. לחץ על כפתור ההקמה.</div>';
        return;
    }
    list.innerHTML = saTeamsCache.map(t => {
        let perms = [];
        try { perms = typeof t.permissions === 'string' ? JSON.parse(t.permissions) : (t.permissions || []); } catch(e){}
        const membersCount = saStaffCache.filter(s => s.team_id === t.id).length;
        
        return `
        <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm relative group hover:shadow-md transition">
            <div class="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition flex gap-2">
                <button onclick="deleteSATeam(${t.id})" class="text-red-400 hover:text-red-600 bg-white shadow-sm rounded-lg p-1.5"><i class="fa-solid fa-trash"></i></button>
            </div>
            <h3 class="font-bold text-slate-800 text-lg mb-1 flex items-center"><div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center ml-2 text-sm"><i class="fa-solid fa-shield-cat"></i></div> ${safeStr(t.name)}</h3>
            <p class="text-xs text-slate-500 mb-4 font-bold bg-white inline-block px-2 py-0.5 rounded-lg border border-slate-100 mt-2"><i class="fa-solid fa-users text-slate-400 mr-1"></i> ${membersCount} נציגים משויכים לצוות</p>
            <div class="flex flex-wrap gap-1.5 border-t border-slate-200 pt-3">
                ${perms.length > 0 ? perms.map(p => `<span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200 text-[10px] font-bold">${translatePermission(p)}</span>`).join('') : '<span class="text-xs font-bold text-slate-400">צפייה בלבד (ללא הרשאות אקטיביות)</span>'}
            </div>
        </div>`;
    }).join('');
};

window.translatePermission = function(p) {
    const map = { 'support': 'תמיכה וקריאות', 'devops': 'פיתוח ומוצר (QA)', 'marketing': 'שיווק והשקות', 'stats': 'דוחות ופיננסים', 'biz': 'ניהול עסקים', 'comm': 'ניהול קהילות', 'users': 'ניהול משתמשים/RBAC', 'content': 'מיתוג ובאנרים' };
    return map[p] || p;
};

window.renderSAStaff = function() {
    const list = getEl('sa-staff-list');
    if (!list) return;
    if (saStaffCache.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">אין נציגי צוות רשומים.</td></tr>';
        return;
    }
    list.innerHTML = saStaffCache.map(s => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition bg-white">
            <td class="px-4 py-3 font-bold text-slate-800 text-right">${safeStr(s.name)}</td>
            <td class="px-4 py-3 text-right dir-ltr font-mono text-xs text-slate-500">${safeStr(s.email)}</td>
            <td class="px-4 py-3 text-center"><span class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-100">${safeStr(s.team_name || 'ללא שיוך')}</span></td>
            <td class="px-4 py-3 text-center"><span class="${s.status === 'active' ? 'text-green-600' : 'text-red-500'} font-bold text-[10px]">${s.status === 'active' ? 'פעיל ✔️' : 'חסום 🔒'}</span></td>
            <td class="px-4 py-3 text-center">
                <button onclick="openStaffModal(${s.id})" class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition" title="עריכת פרטים"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="toggleStaffStatus(${s.id}, '${s.status}')" class="text-orange-500 hover:bg-orange-50 p-2 rounded-lg transition" title="שינוי סטטוס"><i class="fa-solid fa-ban"></i></button>
                <button onclick="deleteSAStaff(${s.id})" class="text-red-400 hover:bg-red-50 p-2 rounded-lg transition"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
};

window.openStaffModal = function(id = null) {
    let modal = getEl('sa-staff-modal');
    if(!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="sa-staff-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[9999] flex items-center justify-center p-4 fade-in">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative border border-slate-200">
                    <button onclick="getEl('sa-staff-modal').classList.add('hidden')" class="absolute top-6 left-6 text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                    <h3 id="staff-modal-title" class="text-2xl font-black mb-6 text-slate-800">הוספת נציג</h3>
                    <input type="hidden" id="sa-staff-id">
                    <div class="space-y-4 mb-8">
                        <div><label class="text-xs font-bold text-slate-600 mb-1.5 block">שם מלא:</label><input type="text" id="sa-staff-name" class="modern-input py-2.5 bg-slate-50"></div>
                        <div><label class="text-xs font-bold text-slate-600 mb-1.5 block">אימייל (יוזר):</label><input type="email" id="sa-staff-email" class="modern-input py-2.5 text-left dir-ltr bg-slate-50"></div>
                        <div><label class="text-xs font-bold text-slate-600 mb-1.5 block">סיסמה (השאר ריק כדי לא לשנות):</label><input type="text" id="sa-staff-pass" class="modern-input py-2.5 text-left dir-ltr bg-slate-50"></div>
                        <div><label class="text-xs font-bold text-slate-600 mb-1.5 block">צוות (Role):</label><select id="sa-staff-team" class="modern-input py-2.5 font-bold"></select></div>
                    </div>
                    <button onclick="saveSAStaff()" class="w-full bg-blue-600 text-white py-3.5 rounded-xl text-lg font-bold shadow-lg hover:bg-blue-700 transition">שמור נציג במערכת</button>
                </div>
            </div>
        `);
    }
    
    const select = getEl('sa-staff-team');
    select.innerHTML = '<option value="">(ללא שיוך - צפייה בלבד)</option>' + saTeamsCache.map(t => `<option value="${t.id}">${safeStr(t.name)}</option>`).join('');
    
    if (id) {
        const s = saStaffCache.find(x => x.id === id);
        if(!s) return;
        getEl('staff-modal-title').innerText = 'עריכת נציג: ' + s.name;
        getEl('sa-staff-id').value = s.id;
        getEl('sa-staff-name').value = s.name;
        getEl('sa-staff-email').value = s.email;
        getEl('sa-staff-team').value = s.team_id || '';
        getEl('sa-staff-pass').value = ''; 
    } else {
        getEl('staff-modal-title').innerText = 'הוספת נציג פנימי';
        getEl('sa-staff-id').value = '';
        getEl('sa-staff-name').value = '';
        getEl('sa-staff-email').value = '';
        getEl('sa-staff-pass').value = '';
    }
    getEl('sa-staff-modal').classList.remove('hidden');
};

window.saveSAStaff = async function() {
    const id = val('sa-staff-id');
    const name = val('sa-staff-name');
    const email = val('sa-staff-email');
    const password = val('sa-staff-pass');
    const teamId = val('sa-staff-team');
    const status = id ? (saStaffCache.find(x => x.id == id)?.status || 'active') : 'active';
    
    if(!name || !email) return showToast('error', 'שם ומייל הם חובה');
    
    const payload = { name, email, teamId: teamId || null, status };
    if (password) payload.password = password;
    
    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API}/sa/staff/${id}` : `${API}/sa/staff`;
        const res = await fetch(url, { 
            method, headers:{'Content-Type':'application/json', 'Authorization': saToken}, 
            body:JSON.stringify(payload) 
        });
        const data = await res.json();
        if(data.success) { 
            showToast('success', id ? 'הנציג עודכן!' : 'הנציג נוסף!'); 
            getEl('sa-staff-modal').classList.add('hidden'); 
            loadSAHRData(); 
        } else { showToast('error', data.error); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
};

window.deleteSAStaff = async function(id) {
    if(!confirm('האם למחוק נציג זה מהמערכת לתמיד? פעולה זו אינה הפיכה.')) return;
    try {
        await fetch(`${API}/sa/staff/${id}`, { method:'DELETE', headers:{'Authorization': saToken} });
        showToast('success', 'נציג נמחק בהצלחה'); loadSAHRData();
    } catch(e) { showToast('error', 'שגיאה במחיקה'); }
};

window.toggleStaffStatus = async function(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
        await fetch(`${API}/sa/staff/${id}`, { method:'PUT', headers:{'Content-Type':'application/json','Authorization': saToken}, body:JSON.stringify({status: newStatus}) });
        showToast('success', 'סטטוס נציג עודכן!'); loadSAHRData();
    } catch(e) { showToast('error', 'שגיאה בעדכון הסטטוס'); }
};

// ==========================================
// --- INTERNAL CHAT (WHISPERS V3 - SIDEBAR) ---
// ==========================================

window.isChatOpen = false;
window.currentChatRoom = null;
window.chatPollInterval = null;

// פתיחה וסגירה של חלון הצ'אט
window.toggleInternalChat = function() {
    const widget = getEl('sa-internal-chat-widget');
    if (!widget) return;
    
    window.isChatOpen = !window.isChatOpen;
    
    if (window.isChatOpen) {
        widget.classList.remove('translate-y-8', 'opacity-0', 'pointer-events-none');
        window.renderChatSidebar();
        
        // התחלת סנכרון חי
        if (!window.chatPollInterval) {
            window.chatPollInterval = setInterval(() => {
                if (window.isChatOpen && window.currentChatRoom) {
                    window.loadInternalChat(window.currentChatRoom, false);
                }
            }, 10000);
        }
    } else {
        widget.classList.add('translate-y-8', 'opacity-0', 'pointer-events-none');
        if (window.chatPollInterval) {
            clearInterval(window.chatPollInterval);
            window.chatPollInterval = null;
        }
    }
};

// רינדור חלון הצד (Sidebar) עם חיפוש
window.renderChatSidebar = function() {
    const list = getEl('sa-chat-sidebar-list');
    if (!list) return;
    
    const query = (getEl('sa-chat-sidebar-search')?.value || '').toLowerCase();
    const isMaster = window.currentSAUser && window.currentSAUser.permissions && window.currentSAUser.permissions.includes('all');
    const myTeamId = window.currentSAUser ? window.currentSAUser.team_id : null;
    const myId = window.currentSAUser ? window.currentSAUser.id : null;

    let html = '';

    // 1. חדר כללי (תמיד מופיע)
    if (!query || 'כללי'.includes(query)) {
        html += `
        <div onclick="window.selectChatRoom('general', 'חדר כללי', 'fa-hashtag')" id="sidebar-room-general" class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white transition group ${window.currentChatRoom === 'general' ? 'bg-white shadow-sm border border-slate-100' : ''}">
            <div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm"><i class="fa-solid fa-hashtag"></i></div>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-black text-slate-800">חדר כללי</div>
                <div class="text-[10px] text-slate-400 truncate font-bold uppercase">כל החברה</div>
            </div>
        </div>`;
    }

    // 2. חדרים של צוותים
    if (saTeamsCache && saTeamsCache.length > 0) {
        saTeamsCache.forEach(t => {
            if (isMaster || parseInt(t.id) === parseInt(myTeamId)) {
                if (!query || t.name.toLowerCase().includes(query)) {
                    const roomId = `team_${t.id}`;
                    html += `
                    <div onclick="window.selectChatRoom('${roomId}', 'צוות: ${safeStr(t.name)}', 'fa-shield-cat')" id="sidebar-room-${roomId}" class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white transition group ${window.currentChatRoom === roomId ? 'bg-white shadow-sm border border-slate-100' : ''}">
                        <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm border border-indigo-100"><i class="fa-solid fa-shield-cat"></i></div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-black text-slate-800">${safeStr(t.name)}</div>
                            <div class="text-[10px] text-slate-400 truncate">ערוץ צוות פנימי</div>
                        </div>
                    </div>`;
                }
            }
        });
    }

    // 3. הודעות פרטיות (DMs)
    if (saStaffCache && saStaffCache.length > 0) {
        html += '<div class="text-[9px] font-black text-slate-400 mt-4 mb-2 px-2 uppercase tracking-widest border-t border-slate-200 pt-3">הודעות פרטיות</div>';
        saStaffCache.forEach(s => {
            if (s.id === myId || s.status !== 'active') return;
            if (!query || s.name.toLowerCase().includes(query)) {
                const roomId = `dm_${Math.min(myId, s.id)}_${Math.max(myId, s.id)}`;
                html += `
                <div onclick="window.selectChatRoom('${roomId}', '${safeStr(s.name)}', 'fa-user')" id="sidebar-room-${roomId}" class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white transition group ${window.currentChatRoom === roomId ? 'bg-white shadow-sm border border-slate-100' : ''}">
                    <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition"><i class="fa-solid fa-user"></i></div>
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-black text-slate-800">${safeStr(s.name)}</div>
                        <div class="text-[10px] text-slate-400 truncate">${safeStr(s.team_name || 'נציג מערכת')}</div>
                    </div>
                </div>`;
            }
        });
    }

    list.innerHTML = html;
};

// חיפוש ב-Sidebar
window.filterChatSidebar = function() {
    window.renderChatSidebar();
};

// בחירת חדר מה-Sidebar
window.selectChatRoom = function(roomId, roomTitle, iconClass) {
    window.currentChatRoom = roomId;
    
    // עדכון UI בעמודה השמאלית
    getEl('sa-chat-active-title').innerText = roomTitle;
    getEl('sa-chat-active-subtitle').innerText = roomId.startsWith('dm_') ? 'שיחה פרטית' : 'ערוץ קבוצתי';
    getEl('sa-chat-active-icon').innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    getEl('sa-chat-input-area').classList.remove('hidden');
    
    // רענון ה-Sidebar כדי לסמן את הבחירה
    window.renderChatSidebar();
    
    // טעינת הודעות
    window.loadInternalChat(roomId, true);
};

// טעינת הודעות
window.loadInternalChat = async function(room, showLoader = false) {
    const container = getEl('sa-chat-messages');
    if (!container) return;
    
    if (showLoader) {
        container.innerHTML = '<div class="text-center text-slate-300 py-20 text-xs"><i class="fa-solid fa-circle-notch fa-spin text-2xl mb-4"></i><br>מסתנכרן...</div>';
    }
    
    try {
        const res = await fetch(`${API}/sa/chat/${room}`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) window.renderInternalChatMessages(data.messages);
    } catch (e) { console.error('Chat load error', e); }
};

// רינדור הודעות
window.renderInternalChatMessages = function(messages) {
    const container = getEl('sa-chat-messages');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-slate-300 opacity-60">
            <i class="fa-solid fa-comments text-5xl mb-4"></i>
            <p class="text-sm font-bold">השיחה ריקה</p>
            <p class="text-xs">היה הראשון לכתוב בחדר זה!</p>
        </div>`;
        return;
    }
    
    const myId = window.currentSAUser ? window.currentSAUser.id : null;
    let isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;

    container.innerHTML = messages.map(m => {
        const isMe = m.sender_id === myId;
        const timeStr = new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        
        if (isMe) {
            return `
            <div class="flex flex-col items-end mb-3 fade-in">
                <div class="bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm text-sm whitespace-pre-wrap leading-relaxed">
                    ${safeStr(m.message)}
                </div>
                <span class="text-[9px] text-slate-400 mt-1 pr-1 font-bold">${timeStr} <i class="fa-solid fa-check-double text-indigo-400 ml-1"></i></span>
            </div>`;
        } else {
            return `
            <div class="flex flex-col items-start mb-3 fade-in">
                <span class="text-[9px] text-slate-400 mb-1 pl-1 font-black uppercase tracking-wider">${safeStr(m.sender_name)}</span>
                <div class="bg-white border border-slate-200 text-slate-700 p-3 rounded-2xl rounded-tl-sm max-w-[80%] shadow-sm text-sm whitespace-pre-wrap leading-relaxed">
                    ${safeStr(m.message)}
                </div>
                <span class="text-[9px] text-slate-400 mt-1 pl-1 font-bold">${timeStr}</span>
            </div>`;
        }
    }).join('');
    
    if (isAtBottom || container.children.length < 5) {
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
    }
};

// שליחת הודעה
window.sendInternalChatMessage = async function(e) {
    e.preventDefault();
    const input = getEl('sa-chat-input');
    const msg = input.value.trim();
    if (!msg || !window.currentChatRoom) return;
    
    const senderName = window.currentSAUser ? window.currentSAUser.name : 'נציג';
    const senderId = window.currentSAUser ? window.currentSAUser.id : null;
    const btn = getEl('btn-sa-chat-send');
    
    input.disabled = true;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    
    try {
        const res = await fetch(`${API}/sa/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ room: window.currentChatRoom, message: msg, senderName, senderId })
        });
        const data = await res.json();
        if (data.success) {
            input.value = '';
            window.loadInternalChat(window.currentChatRoom, false);
        }
    } catch(err) {
        showToast('error', 'שגיאת רשת בשליחה');
    } finally {
        input.disabled = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        input.focus();
    }
};

// Polling חכם - אם חלון הצ'אט פתוח, נמשוך הודעות חדשות כל 15 שניות ברקע
setInterval(() => {
    if (isChatOpen) {
        loadInternalChat(currentChatRoom);
    }
}, 15000);
// ============================================================
// --- SMS OTP LOGIN LOGIC ---
// ============================================================

window.toggleLoginMode = function() {
    const masterStep1 = document.getElementById('sa-login-master-step1');
    const staffLogin = document.getElementById('sa-login-staff');
    if (masterStep1.classList.contains('hidden')) {
        masterStep1.classList.remove('hidden');
        staffLogin.classList.add('hidden');
    } else {
        masterStep1.classList.add('hidden');
        staffLogin.classList.remove('hidden');
    }
};

let otpInterval;
window.sendMasterOTP = async function(e) {
    if(e) e.preventDefault();
    const phoneInput = document.getElementById('sa-phone').value.trim();
    if (!phoneInput) return showToast('error', 'נא להזין מספר טלפון');
    
    // מוסיף קידומת +972 אוטומטית אם המשתמש הזין רק 05X...
    let formattedPhone = phoneInput;
    if (formattedPhone.startsWith('05')) {
        formattedPhone = '+972' + formattedPhone.substring(1);
    }

    const btn = e.currentTarget;
    const origText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> משגר SMS...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/superadmin/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: formattedPhone })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('success', 'הקוד נשלח! בדוק את ה-SMS שלך');
            document.getElementById('sa-login-master-step1').classList.add('hidden');
            document.getElementById('sa-login-master-step2').classList.remove('hidden');
            
            // הפעלת טיימר 5 דקות
            let timeLeft = 300; 
            otpInterval = setInterval(() => {
                timeLeft--;
                const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                const s = (timeLeft % 60).toString().padStart(2, '0');
                document.getElementById('otp-timer').innerText = `תוקף הקוד: ${m}:${s}`;
                if (timeLeft <= 0) {
                    clearInterval(otpInterval);
                    document.getElementById('otp-timer').innerText = 'פג תוקף הקוד. חזור לאחור ונסה שוב.';
                    document.getElementById('otp-timer').classList.add('text-red-500');
                }
            }, 1000);
            
            // קפיצה אוטומטית למשבצת הראשונה
            setTimeout(() => document.querySelectorAll('.otp-box')[0].focus(), 100);
        } else {
            showToast('error', data.error);
        }
    } catch (err) {
        showToast('error', 'שגיאת רשת בשליחת הקוד');
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
};

window.handleOTPInput = function(e, index) {
    const boxes = document.querySelectorAll('.otp-box');
    
    // מחיקה ומעבר למשבצת קודמת
    if (e.key === 'Backspace' && index > 0 && boxes[index].value === '') {
        boxes[index - 1].focus();
    } 
    // הקלדה ומעבר למשבצת הבאה
    else if (e.target.value.length === 1 && index < 5) {
        boxes[index + 1].focus();
    }
    
    // אם הזינו את כל 6 הספרות - שלח אוטומטית
    let code = '';
    boxes.forEach(b => code += b.value);
    if (code.length === 6) {
        verifyMasterOTP();
    }
};

window.verifyMasterOTP = async function(e) {
    if(e) e.preventDefault();
    const boxes = document.querySelectorAll('.otp-box');
    let code = '';
    boxes.forEach(b => code += b.value);
    
    if (code.length !== 6) return showToast('error', 'נא להזין קוד אימות בן 6 ספרות');
    
    let phoneInput = document.getElementById('sa-phone').value.trim();
    let formattedPhone = phoneInput;
    if (formattedPhone.startsWith('05')) {
        formattedPhone = '+972' + formattedPhone.substring(1);
    }

    try {
        const res = await fetch(`${API}/superadmin/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: formattedPhone, code })
        });
        const data = await res.json();
        
        if (data.success) {
            clearInterval(otpInterval);
            // תיקון קריטי: שמירה בשמות המשתנים שהמערכת מצפה להם!
            localStorage.setItem('ofl_sa_token', data.token);
            localStorage.setItem('ofl_sa_user', JSON.stringify(data.user));
            showToast('success', 'האימות הצליח! מתחבר...');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showToast('error', data.error);
            boxes.forEach(b => b.value = ''); 
            boxes[0].focus();
        }
    } catch (err) {
        showToast('error', 'שגיאה באימות הקוד מול השרת');
    }
};
// פתיחת מודל פרופיל מנהל מערכת וסנכרון נתונים
window.openSAProfileModal = function() {
    if (!window.currentSAUser) return;
    getEl('prof-user-name').innerText = window.currentSAUser.name || 'מנהל מערכת';
    getEl('prof-user-email').innerText = window.currentSAUser.email || '---';
    
    const perms = window.currentSAUser.permissions || [];
    getEl('prof-user-perms').innerText = perms.includes('all') ? '✓ גישת על מלאה (Master API)' : 'גישה מוגבלת לפי תפקיד';
    
    const modal = getEl('sa-profile-modal');
    if (modal) modal.classList.remove('hidden');
};
