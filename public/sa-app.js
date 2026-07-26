// Oneflow Life - Super Admin Logic Application

const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
const getEl = id => document.getElementById(id);
const val = id => getEl(id) ? getEl(id).value : '';
const safeStr = str => (str || '').toString().replace(/'/g, "\\'").replace(/"/g, "&quot;");

function fmtUserName(u) {
  if (!u) return '';
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ');
  return full || u.nickname || '';
}
function fmtGroupName(g) {
  if (!g) return '';
  const nickname = g.family_nickname || g.familyNickname || '';
  return nickname ? `${g.name} (${nickname})` : (g.name || '');
}

let saToken = null;
let saAllGroups = [];
let saAllUsers = [];
let saCommunitiesCache = [];
let saBusinessesCache = [];
let saTicketsCache = [];
let saPartnersCache = [];
let mockPartnerCounter = 1000;
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
        if (!window._saPendingRefresh) {
            window._saPendingRefresh = setInterval(() => loadSAPendingRequests(), 60000);
        }

        // פתיחה אוטומטית של טיקט מ-URL param (למשל מ-qa-book.html)
        const urlTicket = new URLSearchParams(window.location.search).get('ticket');
        if (urlTicket) {
            window.switchSATab('support');
            setTimeout(async () => {
                if (!saTicketsCache.length && typeof loadSATickets === 'function') await loadSATickets();
                openSATicketModal(parseInt(urlTicket));
            }, 800);
        } else {
            window.switchSATab('pulse');
        }
        
        // טעינה ורינדור ראשוני של תיבת ההתראות והמונה
        window.renderSANotifications();
    }
};

window.applyUserPermissions = function() {
    if (!window.currentSAUser) return;
    const perms = window.currentSAUser.permissions || [];
    const isMaster = perms.includes('all');

    const tabRequirements = {
        'pulse': 'open', 'dashboard': 'open', 'clients': 'open', 'sysmap': 'open', 'legal': 'open', 'templates': 'open',
        'support': 'support', 'devops': 'devops', 'stats': 'stats',
        'comm': 'comm', 'biz': 'biz', 'content': 'content',
        'hr': 'users', 'inbox': 'marketing', 'partners': 'all', 'finance': 'stats'
    };

    function canAccessTab(tab) {
        const req = tabRequirements[tab];
        if (!req) return false;
        return isMaster || req === 'open' || perms.includes(req);
    }

    // Show/hide group buttons based on whether user can access any sub-tab in the group
    Object.entries(SA_GROUPS).forEach(([groupId, group]) => {
        const btn = getEl(`btn-sa-group-${groupId}`);
        if (!btn) return;
        const canAccess = group.tabs.some(t => canAccessTab(t));
        if (canAccess) {
            btn.classList.remove('hidden');
            btn.classList.add('flex');
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
    if (perms.includes('all') || tabId === 'pulse' || tabId === 'dashboard' || tabId === 'clients' || tabId === 'templates' || tabId === 'partners') return true;
    
    const req = {
        'support': 'support', 'devops': 'devops', 'stats': 'stats',
        'comm': 'comm', 'biz': 'biz', 'content': 'content',
        'hr': 'users', 'inbox': 'marketing', 'partners': 'all',
        'finance': 'stats', 'adslots': 'content', 'legal': 'content'
    };

    if (req[tabId] && !perms.includes(req[tabId])) return false;
    return true;
};

// פתיחה וסגירה של סרגל הצד במסכי מובייל
window.toggleSASidebar = window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('sa-sidebar');
    const backdrop = document.getElementById('sa-sidebar-backdrop');
    const isOpen = sidebar && sidebar.classList.contains('sidebar-open');
    if (sidebar) sidebar.classList.toggle('sidebar-open', !isOpen);
    if (backdrop) backdrop.style.display = (!isOpen) ? 'block' : 'none';
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

// ─── SA Comprehensive Dashboard ───────────────────────────────────────────────
window.loadSADashboard = async function() {
    try {
        const r = await fetch(`${API}/sa/dashboard`, { headers: { 'Authorization': saToken } });
        const d = await r.json();
        if (!d.success) return;

        const s = d.stats || {};
        const p = d.pending || {};
        const fin = d.finance || {};
        const zm = d.zm || {};
        const flow = d.flow || {};

        // ── KPI Row 1 ──
        const setT = (id, v) => { const el = getEl(id); if (el) el.textContent = v; };
        setT('d2-businesses', s.businesses ?? '--');
        setT('d2-biz-24h', s.biz_24h ?? 0);
        setT('d2-families', s.families ?? '--');
        setT('d2-fam-24h', s.fam_24h ?? 0);
        setT('d2-communities', s.communities ?? '--');
        setT('d2-connections', s.connections ?? 0);
        setT('d2-total-users', s.total_users ?? '--');
        setT('d2-online-now', s.online_now ?? 0);
        setT('kpi-online-users', s.online_now ?? 0);

        const aiTotal = (d.ai_top || []).reduce((acc, r2) => acc + (parseInt(r2.calls)||0), 0);
        setT('d2-ai-calls', aiTotal || '--');
        const mc = parseFloat(fin.month_commission)||0;
        const mch = parseFloat(fin.month_cashback)||0;
        setT('d2-month-commission', mc > 0 ? `₪${Math.round(mc).toLocaleString()}` : '--');
        setT('d2-month-cashback', mch > 0 ? Math.round(mch) : 0);

        // ── KPI Row 2 ──
        setT('dash-open-tickets', p.open_tickets ?? '--');
        setT('d2-urgent-tickets', p.urgent_tickets ?? 0);
        setT('d2-unpaid-count', p.unpaid_billing ?? '--');
        const debt = parseFloat(fin.unpaid_amount)||0;
        setT('d2-debt-amount', debt > 0 ? Math.round(debt).toLocaleString() : 0);
        setT('d2-banner-pending', p.banner_orders ?? '--');
        setT('d2-zm-active', parseInt(zm.active_count)||'--');
        setT('d2-zm-pending', p.zone_managers ?? 0);
        const issued = parseFloat(flow.total_issued)||0;
        const redeemed = parseFloat(flow.total_redeemed)||0;
        const circulating = Math.max(0, issued - redeemed);
        setT('d2-flow-issued', circulating > 0 ? Math.round(circulating).toLocaleString() : '--');

        // ── Finance bars ──
        const tc = parseFloat(fin.total_commission)||0;
        const tcb = parseFloat(fin.total_cashback)||0;
        const maxFin = Math.max(tc, tcb, debt, 1);
        setT('d2-total-commission', `₪${Math.round(tc).toLocaleString()}`);
        setT('d2-total-cashback', `₪${Math.round(tcb).toLocaleString()}`);
        setT('d2-total-debt-fin', `₪${Math.round(debt).toLocaleString()}`);
        const bComm = getEl('d2-bar-commission'); if (bComm) bComm.style.width = `${Math.round(tc/maxFin*100)}%`;
        const bCash = getEl('d2-bar-cashback'); if (bCash) bCash.style.width = `${Math.round(tcb/maxFin*100)}%`;
        const bDebt = getEl('d2-bar-debt'); if (bDebt) bDebt.style.width = `${Math.round(debt/maxFin*100)}%`;

        const zmEarned = parseFloat(zm.total_earned)||0;
        const zmPaid = parseFloat(zm.total_paid)||0;
        setT('d2-zm-earned', `₪${Math.round(zmEarned).toLocaleString()}`);
        setT('d2-zm-paid', `₪${Math.round(zmPaid).toLocaleString()}`);
        setT('d2-zm-balance', `₪${Math.round(Math.max(0, zmEarned-zmPaid)).toLocaleString()}`);

        // ── Debtors list ──
        const debtEl = getEl('d2-debtors-list');
        if (debtEl) {
            if (!d.debtors || !d.debtors.length) {
                debtEl.innerHTML = '<p class="text-emerald-500 text-[10px] text-center py-3 font-bold">✓ אין חובות פתוחים</p>';
            } else {
                const maxD = Math.max(...d.debtors.map(x => parseFloat(x.debt)||0), 1);
                debtEl.innerHTML = d.debtors.map(x => {
                    const pct = Math.round((parseFloat(x.debt)||0)/maxD*100);
                    return `<div>
                        <div class="flex justify-between mb-0.5">
                            <span class="text-slate-600 truncate max-w-[120px]" title="${safeStr(x.biz_name)}">${safeStr(x.biz_name)}</span>
                            <span class="font-black text-red-500 text-[10px]">₪${Math.round(parseFloat(x.debt)||0).toLocaleString()}</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1"><div class="bg-red-400 h-1 rounded-full" style="width:${pct}%"></div></div>
                    </div>`;
                }).join('');
            }
        }

        // ── AI Top Users ──
        const aiEl = getEl('d2-ai-list');
        if (aiEl) {
            if (!d.ai_top || !d.ai_top.length) {
                aiEl.innerHTML = '<p class="text-slate-300 text-[10px] text-center py-3">אין נתוני שימוש</p>';
            } else {
                const maxAI = Math.max(...d.ai_top.map(x => parseInt(x.calls)||0), 1);
                aiEl.innerHTML = d.ai_top.map((x, i) => {
                    const pct = Math.round((parseInt(x.calls)||0)/maxAI*100);
                    const colors = ['bg-purple-500','bg-purple-400','bg-purple-300','bg-purple-200','bg-purple-100'];
                    return `<div>
                        <div class="flex justify-between mb-0.5">
                            <span class="text-slate-600 text-[10px] truncate max-w-[130px]">${safeStr(x.name)}</span>
                            <span class="font-black text-purple-600 text-[10px]">${x.calls}</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1"><div class="${colors[i]||'bg-purple-100'} h-1 rounded-full" style="width:${pct}%"></div></div>
                    </div>`;
                }).join('');
            }
        }

        // ── 7-day growth bar chart ──
        const growthEl = getEl('d2-growth-chart');
        if (growthEl && d.growth && d.growth.length) {
            const maxG = Math.max(...d.growth.flatMap(g => [parseInt(g.biz)||0, parseInt(g.fam)||0]), 1);
            const H = 72;
            growthEl.innerHTML = d.growth.map(g => {
                const bh = Math.max(2, Math.round((parseInt(g.biz)||0)/maxG*H));
                const fh = Math.max(2, Math.round((parseInt(g.fam)||0)/maxG*H));
                const day = g.day ? new Date(g.day).toLocaleDateString('he-IL', {day:'numeric',month:'numeric'}) : '';
                return `<div class="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                    <div class="flex items-end gap-0.5 w-full justify-center">
                        <div class="w-2.5 rounded-t bg-amber-400 transition-all" style="height:${bh}px" title="${g.biz||0} עסקים"></div>
                        <div class="w-2.5 rounded-t bg-emerald-400 transition-all" style="height:${fh}px" title="${g.fam||0} משפחות"></div>
                    </div>
                    <span class="text-[7px] text-slate-400 leading-none">${day}</span>
                </div>`;
            }).join('');
        } else if (growthEl) {
            growthEl.innerHTML = '<p class="text-slate-300 text-[10px] text-center w-full self-center">אין נתוני גידול לשבוע האחרון</p>';
        }

        // ── Community Wallets ──
        const wallEl = getEl('d2-wallets-list');
        if (wallEl) {
            if (!d.wallets_top || !d.wallets_top.length) {
                wallEl.innerHTML = '<p class="text-slate-300 text-[10px] text-center py-3">אין ארנקי קהילות</p>';
            } else {
                const maxW = Math.max(...d.wallets_top.map(w => parseFloat(w.balance)||0), 1);
                wallEl.innerHTML = d.wallets_top.map(w => {
                    const pct = Math.round((parseFloat(w.balance)||0)/maxW*100);
                    return `<div>
                        <div class="flex justify-between mb-0.5">
                            <span class="text-slate-600 text-[10px] truncate max-w-[130px]">${safeStr(w.name)}</span>
                            <span class="font-black text-pink-600 text-[10px]">${Math.round(parseFloat(w.balance)||0).toLocaleString()} 🪙</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1"><div class="bg-pink-400 h-1 rounded-full" style="width:${pct}%"></div></div>
                    </div>`;
                }).join('');
            }
        }

        // ── Pending Actions Bar ──
        const pendBar = getEl('dash-pending-bar');
        if (pendBar) {
            const chips = [];
            if (p.open_tickets > 0) chips.push({ label: `🎫 ${p.open_tickets} קריאות פתוחות`, color: 'bg-red-50 border-red-200 text-red-700', fn: `switchSATab('support');setTimeout(()=>{const el=document.getElementById('sa-tickets-open');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},300)`, urgent: p.urgent_tickets > 0 });
            if (p.biz_joins > 0) chips.push({ label: `🏪 ${p.biz_joins} בקשות הצטרפות עסקים`, color: 'bg-orange-50 border-orange-200 text-orange-700', fn: `switchSATab('comm');setTimeout(()=>{switchViewTab('comm','manage');setTimeout(()=>{const el=document.getElementById('sa-pending-biz-container');if(el){el.classList.remove('hidden');el.scrollIntoView({behavior:'smooth',block:'start'})}},150)},200)` });
            if (p.fam_joins > 0) chips.push({ label: `🏠 ${p.fam_joins} הצטרפויות משפחות`, color: 'bg-amber-50 border-amber-200 text-amber-700', fn: `switchSATab('families');setTimeout(()=>{const el=document.getElementById('sa-pending-fam-container');if(el){el.classList.remove('hidden');el.scrollIntoView({behavior:'smooth',block:'start'})}},300)` });
            if (p.banner_orders > 0) chips.push({ label: `📢 ${p.banner_orders} הזמנות פרסום`, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', fn: `switchSATab('adslots');setTimeout(()=>switchViewTab('adslots','orders'),200)` });
            if (p.zone_managers > 0) chips.push({ label: `🗺️ ${p.zone_managers} מנהלי אזור ממתינים`, color: 'bg-teal-50 border-teal-200 text-teal-700', fn: `switchSATab('partners');setTimeout(()=>{const el=document.getElementById('sa-pending-zm-list');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},300)` });
            if (p.unpaid_billing > 0) chips.push({ label: `💰 ${p.unpaid_billing} חשבוניות לא שולמו`, color: 'bg-yellow-50 border-yellow-200 text-yellow-700', fn: `switchSATab('finance');setTimeout(()=>switchViewTab('finance','dues'),200)` });
            if (p.promos > 0) chips.push({ label: `🎟️ ${p.promos} פרסומות קהילה ממתינות`, color: 'bg-pink-50 border-pink-200 text-pink-700', fn: `switchSATab('comm');setTimeout(()=>{switchViewTab('comm','manage');setTimeout(()=>{const el=document.getElementById('sa-pending-promos-container');if(el){el.classList.remove('hidden');el.scrollIntoView({behavior:'smooth',block:'start'})}},150)},200)` });
            if (p.pending_communities > 0) chips.push({ label: `🌍 ${p.pending_communities} קהילות לאישור`, color: 'bg-teal-50 border-teal-200 text-teal-700', fn: `switchSATab('comm');setTimeout(()=>{switchViewTab('comm','table');setTimeout(()=>{const sel=document.getElementById('sa-filter-comm-count');if(sel){sel.value='pending';filterSACommunities();}},150)},200)` });
            if (p.pending_billing > 0) chips.push({ label: `⏳ ${p.pending_billing} תשלומים ממתינים לאישור`, color: 'bg-orange-50 border-orange-200 text-orange-700', fn: `switchSATab('finance');setTimeout(()=>switchViewTab('finance','adsbilling'),200)` });

            if (chips.length) {
                pendBar.classList.remove('hidden');
                pendBar.innerHTML = `<div class="flex gap-2 overflow-x-auto pb-1 items-center">
                    <span class="text-[9px] font-black text-slate-400 uppercase shrink-0">פעולות נדרשות</span>
                    ${chips.map(c => `<button onclick="${c.fn}" class="flex-shrink-0 border rounded-xl px-3 py-1.5 text-[10px] font-bold transition hover:opacity-80 ${c.color} ${c.urgent ? 'animate-pulse' : ''}">${c.label}</button>`).join('')}
                </div>`;
            } else {
                pendBar.classList.add('hidden');
            }
        }

        // update timestamp
        const tsEl = getEl('pulse-last-update');
        if (tsEl) tsEl.textContent = `עודכן ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;

    } catch(e) {
        console.error('[loadSADashboard]', e.message);
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
            window.currentSAUser = data.user;
            localStorage.setItem('ofl_sa_token', saToken);
            localStorage.setItem('ofl_sa_user', JSON.stringify(data.user));
            
            getEl('auth-container').classList.add('hidden');
            getEl('sa-dashboard-container').classList.remove('hidden');
            applyUserPermissions();
            loadSAData();
            window.switchSATab('pulse');
            if (!window._saPendingRefresh) {
                window._saPendingRefresh = setInterval(() => loadSAPendingRequests(), 60000);
            }
            if (!window._saOnlinePoll) {
                window._saOnlinePoll = setInterval(async () => {
                    try {
                        const r = await fetch(`${API}/superadmin/online-count`, { headers: { 'Authorization': saToken } });
                        const d = await r.json();
                        if (d.onlineNow !== undefined) _setKPI('kpi-online-users', d.onlineNow);
                    } catch(e) {}
                }, 60000);
            }
        } else { showToast('error', data.error); }
    } catch(err) { showToast('error', 'שגיאת התחברות'); }
}

function logoutSA() {
    saToken = null;
    if (window._saOnlinePoll) { clearInterval(window._saOnlinePoll); window._saOnlinePoll = null; }
    if (window._saPendingRefresh) { clearInterval(window._saPendingRefresh); window._saPendingRefresh = null; }
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

    window._currentSATab = tabId;
    if (tabId === 'pulse') { updateSADashboard(); loadSADashboard(); }
    if (tabId === 'stats') loadSAData();
    if (tabId === 'finance') loadSAFinanceData();
    if (tabId === 'legal') loadLegalDocs();

    if (tabId === 'adslots') window.renderAdSlotsPanel && window.renderAdSlotsPanel();
    const allTabs = ['dashboard', 'pulse', 'devops', 'support', 'stats', 'comm', 'biz', 'inbox', 'content', 'clients', 'hr', 'partners', 'finance', 'sysmap', 'legal', 'templates', 'adslots', 'auditlog', 'archive', 'games', 'feed', 'livegames'];
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
    if (activeView) activeView.classList.remove('hidden');

    const newsletterBuilder = document.getElementById('sa-newsletter-builder');
    if (newsletterBuilder) newsletterBuilder.classList.toggle('hidden', tabId !== 'inbox');

    // Derive topbar title from SA_GROUPS labels
    const _tabTitles = {
        pulse:'דופק מערכת', stats:'דוחות ופיננסים', dashboard:'ספר מוצר',
        support:'קריאות שירות', devops:'פיתוח ומוצר',
        comm:'קהילות', biz:'עסקים', clients:'קבוצות',
        inbox:'שיווק והשקות', content:'מיתוג ותוכן',
        hr:'נציגים וצוותים', partners:'שותפים', finance:'פיננסים',
        sysmap:'מפת המערכת', legal:'מסמכים משפטיים', templates:'ניהול תבניות עסקים', adslots:'שטחי פרסום',
        auditlog:'לוג אירועים קריטיים', archive:'ארכיון סביבות מחוקות',
        games:'משחקי ילדים', feed:'פיד קהילתי', livegames:'משחקים חיים'
    };
    activeTabTitle = _tabTitles[tabId] || tabId;

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
    if (tabId === 'devops') { switchDevTab('matrix'); loadProductMatrix(); loadDevTasks(); }
    if (tabId === 'support') loadSATickets();
    if (tabId === 'clients') loadSAData();
    if (tabId === 'partners') loadSAPartners();
    if (tabId === 'comm') loadSACommunityData();
    if (tabId === 'templates') window.loadBizTemplates && window.loadBizTemplates();
    if (tabId === 'games') loadSAGames();
    if (tabId === 'feed') loadSACommunityFeed();
    if (tabId === 'livegames') loadSALiveGames();

    // Update group button active state + sub-nav bar
    _updateSAGroupNav(tabId);
};

// ===== GROUP NAVIGATION =====

const SA_GROUPS = {
    home:       { tabs: ['pulse', 'stats'],             labels: ['דופק מערכת', 'דוחות'],           icons: ['fa-heart-pulse', 'fa-chart-line'],       default: 'pulse' },
    customers:  { tabs: ['comm', 'biz', 'clients', 'feed'],  labels: ['קהילות', 'עסקים', 'קבוצות', 'פיד קהילתי'],  icons: ['fa-users-rays', 'fa-store', 'fa-users', 'fa-rss'],  default: 'comm' },
    finance:    { tabs: ['finance'],                    labels: [],                                  icons: [],                                         default: 'finance' },
    supportdev: { tabs: ['support', 'devops'],          labels: ['קריאות שירות', 'פיתוח ומוצר'],    icons: ['fa-headset', 'fa-code'],                  default: 'support' },
    contentmkt: { tabs: ['content', 'inbox', 'legal', 'adslots', 'games'],  labels: ['מיתוג ותוכן', 'שיווק', 'משפטי', 'שטחי פרסום', 'משחקי ילדים'], icons: ['fa-image', 'fa-bullhorn', 'fa-file-contract', 'fa-rectangle-ad', 'fa-gamepad'], default: 'content' },
    livegamesgrp: { tabs: ['livegames'], labels: ['משחקים חיים'], icons: ['fa-bolt'], default: 'livegames' },
    partners:   { tabs: ['partners'],                   labels: [],                                  icons: [],                                         default: 'partners' },
    system:     { tabs: ['hr', 'sysmap', 'auditlog', 'archive'], labels: ['צוות ונציגים', 'מפת המערכת', 'לוג אירועים', 'ארכיון מחוקים'], icons: ['fa-user-tie', 'fa-map', 'fa-shield-halved', 'fa-box-archive'], default: 'hr' },
    templates:  { tabs: ['templates'],                  labels: ['תבניות עסקים'],                    icons: ['fa-layer-group'],                          default: 'templates' },
};

function _getGroupForTab(tabId) {
    for (const [gId, g] of Object.entries(SA_GROUPS)) {
        if (g.tabs.includes(tabId)) return gId;
    }
    return null;
}

function _updateSAGroupNav(tabId) {
    // Reset all group buttons
    document.querySelectorAll('[id^="btn-sa-group-"]').forEach(btn => {
        btn.className = 'flex w-full text-right px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition items-center gap-3';
    });

    const groupId = _getGroupForTab(tabId);
    if (!groupId) return;

    const groupBtn = document.getElementById(`btn-sa-group-${groupId}`);
    if (groupBtn) {
        groupBtn.className = 'flex w-full text-right px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition items-center gap-3';
    }

    _updateSubNavBar(groupId, tabId);
    _updateMobileNav();
}

function _updateSubNavBar(groupId, activeTabId) {
    const bar = document.getElementById('sa-subnav-bar');
    if (!bar) return;
    const group = SA_GROUPS[groupId];
    if (!group || group.tabs.length <= 1) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';
    bar.innerHTML = group.tabs.map((t, i) => {
        const isActive = t === activeTabId;
        const label = group.labels[i] || t;
        const icon = group.icons[i] ? `<i class="fa-solid ${group.icons[i]}" style="font-size:11px;margin-left:5px;"></i>` : '';
        const activeStyle = 'background:#4f46e5;color:white;border:1px solid #4338ca;';
        const inactiveStyle = 'background:#f8fafc;color:#475569;border:1px solid #e2e8f0;';
        return `<button onclick="switchSATab('${t}')" style="${isActive ? activeStyle : inactiveStyle}border-radius:0.6rem;padding:0.4rem 0.85rem;font-size:0.78rem;font-weight:${isActive ? '700' : '600'};cursor:pointer;font-family:Rubik,sans-serif;transition:all 0.15s;display:flex;align-items:center;gap:4px;white-space:nowrap;">${icon}${label}</button>`;
    }).join('');
}

window.switchSAGroup = function(groupId) {
    const group = SA_GROUPS[groupId];
    if (!group) return;
    // Find first accessible tab in the group
    for (const t of group.tabs) {
        if (typeof window.checkTabAccess !== 'function' || window.checkTabAccess(t)) {
            window.switchSATab(t);
            return;
        }
    }
    showToast('error', 'אין הרשאה לגשת למקטע זה.');
};

window.switchViewTab = function(viewId, tabId) {
    const nav = document.getElementById('vtnav-' + viewId);
    if (!nav) return;
    // Hide all sub-tab panels
    document.querySelectorAll('#sa-view-' + viewId + ' .vt-' + viewId).forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    // Show target panel
    const target = document.getElementById('vt-' + viewId + '-' + tabId);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = '';
    }
    // Update nav button styles
    nav.querySelectorAll('button').forEach(btn => {
        btn.style.background = '#f1f5f9';
        btn.style.color = '#475569';
        btn.style.border = '1px solid #e2e8f0';
    });
    const activeBtn = document.getElementById('vtnav-' + viewId + '-' + tabId);
    if (activeBtn) {
        activeBtn.style.background = '#4f46e5';
        activeBtn.style.color = 'white';
        activeBtn.style.border = '1px solid #4338ca';
    }
    // trigger data loads for specific sub-tabs
    if (viewId === 'adslots' && tabId === 'slots') { /* preloader/cloudinary sub-tab, no data load */ }
    if (viewId === 'adslots' && tabId === 'manage') { try { loadBannerSlotsPanel(); loadBannerTimeline(); } catch(e) {} }
    if (viewId === 'adslots' && tabId === 'orders') { try { loadBannerOrders(); } catch(e) {} }
    if (viewId === 'finance' && tabId === 'adsbilling') { try { loadBillingOverview(); } catch(e) {} }
    if (viewId === 'system' && tabId === 'auditlog') { try { loadAuditLog(); } catch(e) {} }
    if (viewId === 'system' && tabId === 'archive')   { try { loadArchive();  } catch(e) {} }
};

// Close mobile sidebar after navigating (on mobile widths)
function _updateMobileNav() {
    if (window.innerWidth <= 640) {
        const sidebar = document.getElementById('sa-sidebar');
        const backdrop = document.getElementById('sa-sidebar-backdrop');
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
            sidebar.classList.remove('sidebar-open');
            if (backdrop) backdrop.style.display = 'none';
        }
    }
}

window.switchDevTab = function(tabId) {
    ['matrix', 'kanban', 'alm', 'qa', 'release'].forEach(t => {
        const view = document.getElementById(`dev-content-${t}`);
        const btn = document.getElementById(`btn-dev-tab-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.className = 'flex-1 px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 rounded-lg transition whitespace-nowrap';
    });
    const activeView = document.getElementById(`dev-content-${tabId}`);
    const activeBtn = document.getElementById(`btn-dev-tab-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.className = 'flex-1 px-4 py-2 text-sm font-bold bg-white text-indigo-700 rounded-lg shadow-sm transition whitespace-nowrap';
    if (tabId === 'alm') window.renderALMHub && window.renderALMHub();
    if (tabId === 'qa') window.renderQAStaging && window.renderQAStaging();
};

// ── System Pulse globals ──────────────────────────────────────────────────────
let _pulseMode = 'live';
let _pulseFullscreenTimer = null;
let _pulseCountdown = 30;

function _setKPI(id, value) {
    const el = getEl(id);
    if (el) el.textContent = (value !== null && value !== undefined) ? value : '--';
}

function _syncFullscreenCards() {
    const map = {
        'fs-active-biz':       'kpi-active-biz',
        'fs-biz-24h':          'kpi-biz-24h',
        'fs-online-users':     'kpi-online-users',
        'fs-active-families':  'kpi-active-families',
        'fs-gmv-today':        'kpi-gmv-today',
        'fs-ai-today':         'kpi-ai-today',
        'fs-errors':           'kpi-errors',
        'fs-open-tickets':     'dash-open-tickets',
    };
    Object.entries(map).forEach(([fsId, srcId]) => {
        const src = getEl(srcId);
        const dst = getEl(fsId);
        if (src && dst) dst.textContent = src.textContent;
    });
    const fsHealth = getEl('fs-health-card');
    const errorEl = getEl('kpi-errors');
    if (fsHealth && errorEl) {
        const errs = parseInt(errorEl.textContent) || 0;
        fsHealth.textContent = errs === 0 ? '✅ תקין' : `⚠️ ${errs} שגיאות`;
        fsHealth.className = errs === 0
            ? 'text-4xl font-black text-green-400'
            : 'text-4xl font-black text-red-400 animate-pulse';
    }
}

function _updateFSTime() {
    const el = getEl('pulse-fs-time');
    if (el) el.textContent = new Date().toLocaleString('he-IL', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

function setPulseMode(mode) {
    _pulseMode = mode;
    document.querySelectorAll('.pulse-live-card').forEach(el => {
        el.classList.toggle('hidden', mode !== 'live');
    });
    document.querySelectorAll('.pulse-lifetime-card').forEach(el => {
        el.classList.toggle('hidden', mode !== 'lifetime');
    });
    const btnLive     = getEl('pulse-btn-live');
    const btnLifetime = getEl('pulse-btn-lifetime');
    if (btnLive && btnLifetime) {
        btnLive.className     = mode === 'live'
            ? 'px-4 py-1.5 text-sm font-bold rounded-full bg-slate-800 text-white shadow transition'
            : 'px-4 py-1.5 text-sm font-medium rounded-full text-slate-500 hover:text-slate-700 transition';
        btnLifetime.className = mode === 'lifetime'
            ? 'px-4 py-1.5 text-sm font-bold rounded-full bg-slate-800 text-white shadow transition'
            : 'px-4 py-1.5 text-sm font-medium rounded-full text-slate-500 hover:text-slate-700 transition';
    }
}

function togglePulseFullscreen() {
    const overlay = getEl('pulse-fullscreen-overlay');
    if (!overlay) return;
    const isOpen = !overlay.classList.contains('hidden');
    if (isOpen) {
        overlay.classList.add('hidden');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        clearInterval(_pulseFullscreenTimer);
        _pulseFullscreenTimer = null;
    } else {
        overlay.classList.remove('hidden');
        _syncFullscreenCards();
        _updateFSTime();
        _pulseCountdown = 30;
        const refreshLabel = getEl('pulse-fs-refresh-label');
        if (refreshLabel) refreshLabel.textContent = `רענון בעוד ${_pulseCountdown}s`;
        document.documentElement.requestFullscreen().catch(() => {});
        _pulseFullscreenTimer = setInterval(() => {
            _pulseCountdown--;
            if (refreshLabel) refreshLabel.textContent = `רענון בעוד ${_pulseCountdown}s`;
            if (_pulseCountdown <= 0) {
                _pulseCountdown = 30;
                loadSAData();
                _syncFullscreenCards();
                _updateFSTime();
            }
        }, 1000);
    }
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        const overlay = getEl('pulse-fullscreen-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
            clearInterval(_pulseFullscreenTimer);
            _pulseFullscreenTimer = null;
        }
    }
});

function renderLivePulse(activityData, stats) {
    const stream = getEl('pulse-live-stream');

    // ── Category 1: עסקים וסביבות ────────────────────────────────────────────
    _setKPI('kpi-active-biz', stats.businesses ?? '--');

    const pendingCount = activityData.filter(a =>
        a.description?.includes('ממתין') || a.description?.includes('הוזמן') || a.description?.includes('ממתינה')
    ).length;
    _setKPI('dash-pending-biz', pendingCount || 0);

    const bizGroups = new Set(activityData
        .filter(a => a.description?.includes('רכש') || a.description?.includes('קופה') || a.description?.includes('תור') || a.is_financial)
        .map(a => a.group_name).filter(Boolean));
    _setKPI('kpi-biz-24h', bizGroups.size || 0);

    const totalRevenue = activityData.filter(a => a.is_financial).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    _setKPI('kpi-total-biz', stats.businesses ?? '--');
    _setKPI('kpi-biz-revenue', totalRevenue > 0 ? `₪${totalRevenue.toFixed(0)}` : '--');
    _setKPI('kpi-work-hours', '--');

    // ── Category 2: משפחות ומשתמשים ─────────────────────────────────────────
    const totalUsers = (stats.familyUsers || 0) + (stats.businessUsers || 0);
    _setKPI('kpi-online-users', stats.onlineNow ?? 0);
    // backward-compat IDs from old pulse panel
    if (getEl('pulse-active-users')) getEl('pulse-active-users').textContent = totalUsers;

    const ordersCount = activityData.filter(a => a.description?.includes('רכש') || a.description?.includes('קופה') || a.description?.includes('תור')).length;
    if (getEl('pulse-orders-today')) getEl('pulse-orders-today').textContent = ordersCount;

    const aiCount = activityData.filter(a =>
        a.description?.includes('AI') || a.description?.includes('חפיפה') || a.description?.includes('המלצה')
    ).length;
    if (getEl('pulse-ai-reqs')) getEl('pulse-ai-reqs').textContent = aiCount * 2 || '--';

    const familyGroups = new Set(activityData.map(a => a.group_name).filter(Boolean));
    _setKPI('kpi-families-24h', familyGroups.size || 0);
    _setKPI('kpi-active-families', stats.families ?? '--');
    _setKPI('kpi-total-families', stats.families ?? '--');
    _setKPI('kpi-total-kids', stats.familyUsers ?? '--');
    _setKPI('kpi-tasks-done', '--');

    // ── Category 3: תעבורה ופיננסים ─────────────────────────────────────────
    const gmvToday = activityData.filter(a => a.is_financial).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    _setKPI('kpi-gmv-today', gmvToday > 0 ? `₪${gmvToday.toFixed(0)}` : '₪0');
    _setKPI('kpi-ai-today', aiCount || 0);
    _setKPI('kpi-community-connections', stats.activeConnections ?? '--');
    _setKPI('kpi-gmv-total', gmvToday > 0 ? `₪${gmvToday.toFixed(0)}` : '--');
    _setKPI('kpi-community-discounts', '--');
    _setKPI('kpi-tokens-issued', '--');

    // ── Category 4: מערכת ו-QA Health ────────────────────────────────────────
    const openTickets = saTicketsCache.filter(t => t.status === 'open' || t.status === 'pending').length;
    _setKPI('dash-open-tickets', openTickets);

    const errorCount = activityData.filter(a =>
        a.description?.includes('שגיאה') || a.description?.includes('תקלה') || a.description?.includes('נפל')
    ).length;
    _setKPI('kpi-errors', errorCount);
    // backward-compat: old pulse-errors element
    if (getEl('pulse-errors')) {
        getEl('pulse-errors').textContent = errorCount;
        if (errorCount > 0) {
            getEl('pulse-errors').classList.replace('text-orange-400', 'text-red-500');
        } else {
            getEl('pulse-errors').classList.replace('text-red-500', 'text-orange-400');
        }
    }

    // SLA breach detection
    const now = Date.now();
    const slaBreached = saTicketsCache.filter(t => {
        if (t.status !== 'open' && t.status !== 'pending') return false;
        return (now - new Date(t.created_at).getTime()) > 86400000;
    }).length;
    const slaLabel = getEl('kpi-sla-label');
    const ticketsCard = getEl('kpi-tickets-card');
    if (slaLabel) {
        slaLabel.textContent = slaBreached > 0 ? `⚠️ ${slaBreached} חרגו מ-SLA` : 'בתוך SLA ✓';
        slaLabel.className = slaBreached > 0 ? 'text-xs font-bold text-red-500 animate-pulse' : 'text-xs font-medium text-green-600';
    }
    if (ticketsCard) {
        ticketsCard.classList.toggle('border-red-400', slaBreached > 0);
        ticketsCard.classList.toggle('animate-pulse', slaBreached > 0);
    }

    const errorsCard = getEl('kpi-errors-card');
    const errorsLabel = getEl('kpi-errors-label');
    if (errorsCard) errorsCard.classList.toggle('border-red-400', errorCount > 0);
    if (errorsLabel) {
        errorsLabel.textContent = errorCount > 0 ? `${errorCount} שגיאות פעילות` : 'נקי ✓';
        errorsLabel.className = errorCount > 0 ? 'text-xs font-bold text-red-500 animate-pulse' : 'text-xs font-medium text-green-600';
    }

    const anomalyAlert = getEl('pulse-anomaly-alert');
    if (anomalyAlert) anomalyAlert.classList.toggle('hidden', errorCount < 3);

    try {
        const qaState = JSON.parse(localStorage.getItem('qa_state') || '{}');
        const passed = Object.values(qaState).filter(v => v === 'pass').length;
        const total  = Object.keys(qaState).length;
        _setKPI('kpi-qa-health', total > 0 ? `${Math.round(passed / total * 100)}%` : '--');
    } catch { _setKPI('kpi-qa-health', '--'); }

    _setKPI('kpi-resolved-tickets', saTicketsCache.filter(t => t.status === 'resolved' || t.status === 'closed').length || '--');
    _setKPI('kpi-releases', '--');
    _setKPI('dash-open-tasks', getEl('dash-open-tasks') ? getEl('dash-open-tasks').textContent : '--');

    // timestamps
    const tsEl = getEl('pulse-last-update');
    if (tsEl) tsEl.textContent = new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    const tsStream = getEl('pulse-last-update-stream');
    if (tsStream) tsStream.textContent = new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit', second:'2-digit'});

    // ── Live activity stream ───────────────────────────────────────────────────
    if (!stream) return;
    if (activityData.length === 0) {
        stream.innerHTML = '<p class="text-slate-400 text-center py-4">אין פעילות בדקות האחרונות.</p>';
        return;
    }

    stream.innerHTML = activityData.slice(0, 20).map(a => {
        let icon = '<i class="fa-solid fa-bolt text-slate-400"></i>';
        let bgGlow = '';
        if (a.is_financial) { icon = '<i class="fa-solid fa-coins text-green-400"></i>'; bgGlow = 'border-l-2 border-l-green-500/50'; }
        if (a.description?.includes('AI') || a.description?.includes('חפיפה') || a.description?.includes('המלצה')) { icon = '<i class="fa-solid fa-microchip text-purple-400"></i>'; bgGlow = 'border-l-2 border-l-purple-500/50'; }
        if (a.description?.includes('שגיאה') || a.description?.includes('תקלה') || a.description?.includes('נפל')) { icon = '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>'; bgGlow = 'border-l-2 border-l-red-500/50'; }
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
                <span class="text-[10px] bg-white/10 text-slate-300 px-2 py-1 rounded-md border border-white/10 truncate max-w-[120px]">
                    <i class="fa-solid fa-house-user mr-1 text-slate-500"></i> ${safeStr(a.group_name)}
                </span>
                ${amountHtml}
            </div>
        </div>`;
    }).join('');

    if (getEl('pulse-fullscreen-overlay') && !getEl('pulse-fullscreen-overlay').classList.contains('hidden')) {
        _syncFullscreenCards();
    }
}


let saCurrentTicketId = null;

async function loadSATickets() {
    const tbody = getEl('sa-tickets-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-2xl mb-3"></i><br>טוען קריאות שירות...</td></tr>';
    try {
        const res = await fetch(`${API}/superadmin/tickets`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) {
            saTicketsCache = data.tickets || [];
            applyTicketFilters(); 
            updateSADashboard(); 
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 py-6">שגיאה בטעינת קריאות</td></tr>';
        }
    } catch(e) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 py-6">שגיאת תקשורת</td></tr>'; }
}

window.toggleCustomDates = function() {
    const period = val('ticket-filter-period');
    const customDiv = getEl('ticket-custom-dates');
    if (customDiv) {
        if (period === 'custom') customDiv.classList.remove('hidden');
        else customDiv.classList.add('hidden');
    }
};

window.applyTicketFilters = function() {
    if (!saTicketsCache) return;
    const searchVal = val('ticket-filter-search') ? val('ticket-filter-search').toLowerCase() : '';
    const statusVal = val('ticket-filter-status') || 'all';
    const priorityVal = val('ticket-filter-priority') || 'all';
    const periodVal = val('ticket-filter-period') || 'all';
    
    let filtered = saTicketsCache.filter(t => {
        let match = true;
        if (searchVal) {
            const text = `${t.subject} ${t.user_name} ${t.group_name} ${t.id}`.toLowerCase();
            if (!text.includes(searchVal)) match = false;
        }
        if (statusVal !== 'all' && t.status !== statusVal) match = false;
        if (priorityVal !== 'all' && t.priority !== priorityVal) match = false;
        
        if (match && periodVal !== 'all') {
            const tDate = new Date(t.created_at);
            const now = new Date();
            if (periodVal === '1m') {
                const threshold = new Date(now.setMonth(now.getMonth() - 1));
                if (tDate < threshold) match = false;
            } else if (periodVal === '3m') {
                const threshold = new Date(now.setMonth(now.getMonth() - 3));
                if (tDate < threshold) match = false;
            } else if (periodVal === '6m') {
                const threshold = new Date(now.setMonth(now.getMonth() - 6));
                if (tDate < threshold) match = false;
            } else if (periodVal === 'custom') {
                const fromVal = val('ticket-filter-from');
                const toVal = val('ticket-filter-to');
                if (fromVal && tDate < new Date(fromVal)) match = false;
                if (toVal && tDate > new Date(toVal + 'T23:59:59')) match = false;
            }
        }
        return match;
    });

    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderSATicketsTable(filtered);
};

let saSlaRulesCache = [];

window.loadSlaMatrix = async function() {
    try {
        const res = await fetch(`${API}/sa/sla-matrix`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) {
            saSlaRulesCache = data.sla || [{ type: '*', priority: '*', hours: 24 }];
        }
    } catch(e) { console.error('Error loading SLA', e); }
};

function getTicketSlaMaxHours(type, priority) {
    if (!saSlaRulesCache || saSlaRulesCache.length === 0) return 24;
    let match = saSlaRulesCache.find(r => r.type === type && r.priority === priority);
    if (!match) match = saSlaRulesCache.find(r => r.type === type && r.priority === '*');
    if (!match) match = saSlaRulesCache.find(r => r.type === '*' && r.priority === priority);
    if (!match) match = saSlaRulesCache.find(r => r.type === '*' && r.priority === '*');
    return match ? parseInt(match.hours) : 24;
}

function renderSATicketsTable(tickets) {
    const tbody = getEl('sa-tickets-table-body');
    if(!tbody) return;
    if(!tickets || tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500 bg-white">לא נמצאו קריאות התואמות לסינון המבוקש.</td></tr>';
        return;
    }

    if (saSlaRulesCache.length === 0) loadSlaMatrix();

    const statusMap = {
        'open': { text: 'פתוח', color: 'bg-red-100 text-red-700 border-red-200' },
        'in_progress': { text: 'בטיפול', color: 'bg-orange-100 text-orange-700 border-orange-200' },
        'resolved': { text: 'סגור', color: 'bg-green-100 text-green-700 border-green-200 opacity-60' }
    };
    
    const prioMap = { 'critical': '🚨 קריטית', 'high': '🔴 גבוהה', 'normal': '🟡 רגילה', 'low': '🔵 נמוכה' };

    tbody.innerHTML = tickets.map(t => {
        const st = statusMap[t.status] || statusMap['open'];
        const dateStr = new Date(t.created_at).toLocaleString('he-IL', {dateStyle:'short', timeStyle:'short'});
        const pLabel = prioMap[t.priority] || prioMap['normal'];

        let slaHtml = '';
        if (t.status !== 'resolved') {
            const timeSinceUpdate = new Date() - new Date(t.status_updated_at || t.created_at);
            const hoursOpen = Math.floor(timeSinceUpdate / (1000 * 60 * 60));
            const maxHours = getTicketSlaMaxHours(t.ticket_type || 'general', t.priority || 'normal');
            
            if (hoursOpen >= maxHours) {
                slaHtml = `<span class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded ml-2 border border-red-200 font-bold animate-pulse text-[10px]" title="יעד: ${maxHours} שעות"><i class="fa-solid fa-fire"></i> חריגת SLA</span>`;
            } else {
                slaHtml = `<span class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-2 border border-green-200 font-bold text-[10px]" title="יעד: ${maxHours} שעות"><i class="fa-regular fa-clock"></i> SLA תקין</span>`;
            }
        }

        return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-100 group">
                <td class="px-4 py-3 text-slate-400 font-bold text-xs">#${t.id}</td>
                <td class="px-4 py-3 max-w-[250px]">
                    <div class="font-bold text-slate-800 text-sm truncate" title="${safeStr(t.subject)}">${safeStr(t.subject)}</div>
                    <div class="text-[11px] text-slate-500 truncate mt-0.5" title="${safeStr(t.description)}">${safeStr(t.description)}</div>
                </td>
                <td class="px-4 py-3 text-slate-600 text-xs">
                    <div class="font-bold">${safeStr(t.group_name)}</div>
                    <div class="text-[10px] text-slate-400"><i class="fa-regular fa-user mr-1"></i>${safeStr(t.user_name)}</div>
                </td>
                <td class="px-4 py-3 text-slate-500 dir-ltr text-right text-xs">${dateStr}</td>
                <td class="px-4 py-3 text-center text-xs font-medium">${pLabel}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex flex-col items-center gap-1">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border ${st.color} whitespace-nowrap">${st.text}</span>
                        ${slaHtml}
                    </div>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="openSATicketModal(${t.id})" class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition shadow-sm border border-indigo-100"><i class="fa-solid fa-expand ml-1"></i>פרטים</button>
                        <button onclick="deleteTicket(${t.id})" class="bg-white text-slate-300 px-2.5 py-1.5 rounded-lg text-xs hover:text-red-600 hover:bg-red-50 transition border border-slate-200 hover:border-red-100" title="מחק קריאה"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteTicket = async function(id) {
    if(!confirm('האם אתה בטוח שברצונך למחוק קריאת שירות זו לצמיתות? פעולה זו אינה הפיכה!')) return;
    try {
        const res = await fetch(`${API}/superadmin/tickets/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': saToken }
        });
        const data = await res.json();
        if(data.success) {
            if(typeof showToast === 'function') showToast('success', 'הקריאה נמחקה בהצלחה.');
            else alert('הקריאה נמחקה בהצלחה.');
            saTicketsCache = saTicketsCache.filter(t => t.id !== id);
            applyTicketFilters(); 
            updateSADashboard(); 
        } else {
            if(typeof showToast === 'function') showToast('error', 'שגיאה: ' + data.error);
            else alert('שגיאה: ' + data.error);
        }
    } catch(e) {
        if(typeof showToast === 'function') showToast('error', 'שגיאת תקשורת במחיקת קריאה.');
        else alert('שגיאת תקשורת.');
    }
};

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

    // פרטי התקשרות
    const contactRow = getEl('sa-ticket-contact-row');
    const emailRow = getEl('sa-ticket-contact-email-row');
    const phoneRow = getEl('sa-ticket-contact-phone-row');
    const contactEmail = t.group_email || '';
    const contactPhone = '';
    if (contactEmail || contactPhone) {
        contactRow.classList.remove('hidden');
        if (contactEmail) {
            emailRow.classList.remove('hidden');
            getEl('sa-ticket-contact-email').textContent = contactEmail;
            getEl('sa-ticket-email-btn').href = `mailto:${contactEmail}`;
            getEl('sa-ticket-email-btn').onclick = null;
        } else { emailRow.classList.add('hidden'); }
        if (contactPhone) {
            phoneRow.classList.remove('hidden');
            getEl('sa-ticket-contact-phone').textContent = contactPhone;
            getEl('sa-ticket-phone-btn').href = `tel:${contactPhone}`;
            getEl('sa-ticket-phone-btn').onclick = null;
            const cleanPhone = contactPhone.replace(/\D/g, '');
            getEl('sa-ticket-wa-btn').href = `https://wa.me/972${cleanPhone.replace(/^0/, '')}`;
            getEl('sa-ticket-wa-btn').onclick = null;
        } else { phoneRow.classList.add('hidden'); }
    } else { contactRow.classList.add('hidden'); }
    
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

    logArr.forEach((entry, idx) => {
        const timeStr = new Date(entry.date).toLocaleString('he-IL', {timeStyle:'short'});
        const isInternal = entry.isInternal || (entry.message && entry.message.startsWith('[INTERNAL_NOTE]'));
        let cleanMessage = entry.message ? entry.message.replace('[INTERNAL_NOTE] ', '') : '';
        // skip first log entry if it duplicates the description (added at ticket creation)
        if (idx === 0 && !entry.isStaff && cleanMessage === t.description) return;
        
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
        if (t.assigned_team != teamId) {
            const teamObj = saTeamsCache.find(x => x.id == teamId);
            notes.push(teamId ? `שויך לצוות: ${teamObj ? teamObj.name : '#'+teamId}` : `הוסר שיוך צוות`);
        }
        
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

    // סגירת קריאה — פתח חלונית סגירה מסודרת במקום לשלוח הודעה ריקה
    if (status === 'resolved' && !text) {
        const task = devKanbanTasks.find(t => t.original_ticket_id === saCurrentTicketId);
        window.openFeedbackLoopModal(task ? task.id : null, saCurrentTicketId);
        return;
    }
    
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
        // עדכון toggle מצב SMS
        window._smsLoginEnabled = data.smsLoginEnabled !== false;
        updateSmsLoginToggleUI();
        // קוד בדיקה SMS
        if (document.getElementById('sa-sms-debug-code')) {
            document.getElementById('sa-sms-debug-code').value = data.smsDebugCode || '';
        }
        
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

        // Member welcome banner
        window._memberWelcomeEnabled = data.memberWelcomeEnabled !== false;
        updateMemberWelcomeToggleUI();
        setVal('sa-member-welcome-text', data.memberWelcomeText);
        setImgPreview('sa-member-welcome', data.memberWelcomeImg);
        const mwClearBtn = getEl('sa-member-welcome-clear-btn');
        if (mwClearBtn) { if (data.memberWelcomeImg) mwClearBtn.classList.remove('hidden'); else mwClearBtn.classList.add('hidden'); }
        // PWA install prompt toggle
        window._pwaInstallPromptEnabled = data.pwaInstallPromptEnabled !== false;
        updatePwaPromptToggleUI();
        // Email settings
        setVal('smtp-from-name', data.smtpFromName);
        setVal('smtp-from-email', data.smtpFromEmail);
        setVal('admin-notification-email', data.adminNotificationEmail);
        // Module popup settings
        window._memberModuleSettings = data.memberModuleSettings || {};
        renderModuleSettingsAdmin();

        const setTxt = (id, v) => { const e = getEl(id); if (e) e.innerText = v || 0; };
        if (data.stats) {
            setTxt('sa-stat-families', data.stats.families);
            setTxt('sa-stat-businesses', data.stats.businesses);
            setTxt('sa-stat-family-users', data.stats.familyUsers);
            setTxt('sa-stat-biz-users', data.stats.businessUsers);
            setTxt('sa-stat-communities', data.stats.communities);
            setTxt('sa-stat-connections', data.stats.activeConnections);
        }

        if (data.activity && data.stats) {
            try { renderLivePulse(data.activity, data.stats); } catch(pulseErr) { console.error('renderLivePulse error:', pulseErr); }
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
        if(typeof renderSAGroups === 'function') { try { renderSAGroups(); } catch(e) { console.error('renderSAGroups error:', e); } }
        if(typeof loadSACommunityData === 'function') loadSACommunityData();
        if(typeof loadSATickets === 'function') loadSATickets();
        if(typeof loadSAPartners === 'function') loadSAPartners();
        
        // תיקון סנכרון: טוען צוותים ונציגים כבר בהתחלה עבור כל המודולים
        if(typeof loadSAHRData === 'function') loadSAHRData();

        // safety re-apply: מוודא שטאבי ההרשאות מוצגים גם אם הקריאה הראשונה רצה לפני שה-DOM היה מוכן
        if(typeof applyUserPermissions === 'function') applyUserPermissions();

    } catch (e) { console.error('loadSAData error:', e); showToast('error', 'שגיאה בטעינת נתוני ניהול'); }
}

window.saveEmailSettings = async function() {
    await window.saveAllBanners();
};

window.saveAllBanners = async function() {
    try {
        const payload = {
            topText: val('sa-banner-top-text'), topLink: val('sa-banner-top-link'), topImg: val('sa-banner-top-img'),
            bottomText: val('sa-banner-bottom-text'), bottomLink: val('sa-banner-bottom-link'), bottomImg: val('sa-banner-bottom-img'),
            bizTopText: val('sa-biz-banner-top-text'), bizTopLink: val('sa-biz-banner-top-link'), bizTopImg: val('sa-biz-banner-top-img'),
            bizBottomText: val('sa-biz-banner-bottom-text'), bizBottomLink: val('sa-biz-banner-bottom-link'), bizBottomImg: val('sa-biz-banner-bottom-img'),
            globalAiLogo: val('sa-global-ai-logo-base64'),
            loginSlides: window.loginSlidesCache,
            memberWelcomeEnabled: window._memberWelcomeEnabled !== false,
            memberWelcomeText: val('sa-member-welcome-text'),
            memberWelcomeImg: val('sa-member-welcome-img'),
            memberModuleSettings: window._memberModuleSettings || {},
            pwaInstallPromptEnabled: window._pwaInstallPromptEnabled !== false,
            smtpFromEmail: val('smtp-from-email'),
            smtpFromName: val('smtp-from-name'),
            adminNotificationEmail: val('admin-notification-email')
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

// ===== Member Welcome Banner Controls =====
window._memberWelcomeEnabled = true;
function updateMemberWelcomeToggleUI() {
    const btn = getEl('member-welcome-toggle');
    const dot = getEl('member-welcome-toggle-dot');
    if (!btn || !dot) return;
    if (window._memberWelcomeEnabled) {
        btn.classList.remove('bg-slate-300'); btn.classList.add('bg-violet-500');
        dot.style.transform = 'translateX(20px)';
    } else {
        btn.classList.remove('bg-violet-500'); btn.classList.add('bg-slate-300');
        dot.style.transform = 'translateX(2px)';
    }
}
window.toggleMemberWelcome = function() {
    window._memberWelcomeEnabled = !window._memberWelcomeEnabled;
    updateMemberWelcomeToggleUI();
};
function updatePwaPromptToggleUI() {
    const btn = getEl('pwa-prompt-toggle');
    const dot = getEl('pwa-prompt-toggle-dot');
    if (!btn || !dot) return;
    if (window._pwaInstallPromptEnabled) {
        btn.classList.remove('bg-slate-300'); btn.classList.add('bg-indigo-500');
        dot.style.transform = 'translateX(20px)';
    } else {
        btn.classList.remove('bg-indigo-500'); btn.classList.add('bg-slate-300');
        dot.style.transform = 'translateX(2px)';
    }
}
window.togglePwaPrompt = function() {
    window._pwaInstallPromptEnabled = !window._pwaInstallPromptEnabled;
    updatePwaPromptToggleUI();
};
window.clearMemberWelcomeImg = function() {
    getEl('sa-member-welcome-img').value = '';
    const preview = getEl('sa-member-welcome-preview');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    const clearBtn = getEl('sa-member-welcome-clear-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
};

// ===== Module Popup Settings =====
const SA_MODULE_LIST = [
    { key:'bank',              icon:'🏦', name:'הבנק המשפחתי',        defaultTitle:'הבנק המשפחתי',        defaultText:'נהל הכנסות, הוצאות ודמי כיס לכל בני הבית ממקום אחד. כל הזמנה שתבצע מהעסקים שמחוברים אליך נרשמת אוטומטית — ותמיד תדע בדיוק לאן הכסף הולך.' },
    { key:'cashflow',          icon:'💸', name:'תזרים הוצאות',          defaultTitle:'תזרים הוצאות',          defaultText:'מעקב חכם אחרי כל עסקה — כולל הזמנות, תשלומי מנויים ותיקונים מהעסקים שלך. גרף אחד, תמונה ברורה, שליטה מלאה.' },
    { key:'budget',            icon:'📊', name:'ניהול תקציב',            defaultTitle:'ניהול תקציב',            defaultText:'הגדר תקציב לכל קטגוריה — אוכל, בילויים, תחזוקה. הזמנות מהעסקים המחוברים אליך נספרות אוטומטית, ותקבל התראה לפני שחורגים.' },
    { key:'forecast',          icon:'📅', name:'תשקיף עתידי',            defaultTitle:'תשקיף עתידי',            defaultText:'תכנן הוצאות עתידיות, מנויים קבועים והזמנות חוזרות. AI שמנתח את ההרגלים שלך ומייצר תמונה כלכלית עתידית מדויקת.' },
    { key:'tasks',             icon:'✅', name:'משימות וצ\'ופרים',       defaultTitle:'משימות וצ\'ופרים',       defaultText:'הקצה משימות לילדים ובני הבית, קבע פרסי כסף אמיתיים, ועקוב אחרי ביצוע. כשהמשפחה עובדת יחד — כולם מרוויחים.' },
    { key:'shop',              icon:'🛒', name:'רשימת קניות חכמה',       defaultTitle:'רשימת קניות חכמה',       defaultText:'רשימת קניות משותפת לכל המשפחה בזמן אמת. הוסף פריטים מהמזווה, שתף עם בן/בת הזוג, וסנכרן עם ההזמנות שלך מהעסקים באזור.' },
    { key:'pantry',            icon:'📦', name:'מזווה חכם',               defaultTitle:'מזווה חכם',               defaultText:'מעקב אחרי מלאי הבית: מזון, ניקיון, תרופות. כשמשהו אוזל — הזמן ישירות מהעסק המועדף שלך בלחיצה אחת.' },
    { key:'recipes',           icon:'👨‍🍳', name:'שף פרטי AI',             defaultTitle:'שף פרטי AI',             defaultText:'מתכונים מותאמים אישית על בסיס מה שיש לך במזווה. AI שיודע מה הזמנת השבוע ומציע ארוחות שמשלימות את מה שכבר קנית.' },
    { key:'community',         icon:'🏘️', name:'קהילה מקומית',            defaultTitle:'קהילה מקומית',            defaultText:'גלה עסקים חדשים, קרא המלצות שכנים ותיאום קניות קבוצתיות. יותר עסקים לבחור — יותר כוח מיקוח ברשת שלך.' },
    { key:'members',           icon:'👨‍👩‍👧‍👦', name:'ניהול משפחה',           defaultTitle:'ניהול משפחה',           defaultText:'הוסף בני משפחה, הגדר הרשאות מותאמות לכל גיל ותפקיד. ניהול מלא של מי רואה מה ומי יכול לעשות מה.' },
    { key:'academy',           icon:'🎓', name:'אקדמיה פיננסית',          defaultTitle:'אקדמיה פיננסית',          defaultText:'אתגרי ידע פיננסי אינטראקטיביים לילדים עם פרסי כסף אמיתיים. כישורי חיים שהם ישאו איתם לאורך שנים.' },
    { key:'home-maintenance',  icon:'🔧', name:'ניהול הבית',               defaultTitle:'ניהול הבית',               defaultText:'עקוב אחרי תחזוקות, ביטוחים, ספקים וקריאות שירות. מחובר לעסקי התיקונים שמחוברים אליך — כל ההיסטוריה במקום אחד.' },
    { key:'kids-wallet',       icon:'👧', name:'ארנק דיגיטלי לילדים',    defaultTitle:'ארנק דיגיטלי לילדים',    defaultText:'כל ילד מקבל ארנק דיגיטלי משלו עם יתרה, היסטוריית הוצאות והכנסות ומטרות חיסכון. אתה רואה הכל בזמן אמת — הם לומדים אחריות כלכלית.' },
    { key:'kids-mode',         icon:'🧒', name:'מסך ילדים',                defaultTitle:'מסך ילדים',                defaultText:'הילד נכנס — המערכת מזהה אותו ומציגה לו בדיוק מה שלו: המשימות שממתינות, הפרסים שצבר, הוצאות והכנסות של הארנק שלו.' },
    { key:'supermarket-mode',  icon:'🛒', name:'מצב "אני בסופר"',          defaultTitle:'מצב "אני בסופר"',          defaultText:'פתח מצב סופר בקנייה: כל מוצר שתסמן "נלקח" נעלם מהרשימה של כולם. מחיר יקר? קבל השוואה. מוצר חסר? בני הבית מוסיפים בזמן אמת.' },
    { key:'ai-assistant',      icon:'🤖', name:'עוזרת אישית AI',            defaultTitle:'עוזרת אישית AI',            defaultText:'AI שמכירה את המשפחה שלך: יודעת מה הזמנת, מה הוצאת, מה קניתם. שאל "מה לבשל הערב?" או "כמה הוצאנו על אוכל?" — תשובה מיידית מבוססת נתוני האמת שלך.' },
    { key:'expense-tracking',  icon:'📈', name:'מעקב הוצאות שוטף',        defaultTitle:'מעקב הוצאות שוטף',        defaultText:'גרף חי של ההוצאות היומיות שלך — לפי קטגוריה, לפי עסק, לפי תקופה. ראה בדיוק איפה הכסף הולך, ואיפה אפשר לחסוך.' }
];

function renderModuleSettingsAdmin() {
    const container = getEl('sa-module-settings-list');
    if (!container) return;
    const settings = window._memberModuleSettings || {};
    container.innerHTML = SA_MODULE_LIST.map(m => {
        const s = settings[m.key] || {};
        const enabled = s.enabled !== false;
        const imgVal = s.img || '';
        return `<div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer" onclick="toggleModuleSettingsPanel('${m.key}')">
                <div class="flex items-center gap-2">
                    <span>${m.icon}</span>
                    <span class="text-sm font-bold text-slate-700">${m.name}</span>
                    <span id="mod-status-chip-${m.key}" class="text-[10px] px-2 py-0.5 rounded-full font-bold ${enabled ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'}">${enabled ? 'פעיל' : 'כבוי'}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button id="mod-toggle-${m.key}" onclick="event.stopPropagation();toggleModuleEnabled('${m.key}')" class="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 focus:outline-none ${enabled ? 'bg-violet-500' : 'bg-slate-300'}">
                        <span id="mod-toggle-dot-${m.key}" class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-1'}"></span>
                    </button>
                    <i class="fa-solid fa-chevron-down text-slate-400 text-xs"></i>
                </div>
            </div>
            <div id="mod-panel-${m.key}" class="hidden px-4 pb-4 pt-3 bg-white space-y-3">
                <div>
                    <label class="text-xs font-bold text-slate-500 block mb-1">כותרת חלון השדרוג (ברירת מחדל: שם המודול):</label>
                    <input type="text" id="mod-title-${m.key}" value="${s.title || m.defaultTitle || ''}" placeholder="${m.name}" oninput="updateModuleField('${m.key}','title',this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-300 focus:outline-none">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-500 block mb-1">טקסט שיווקי לחלון השדרוג:</label>
                    <textarea id="mod-text-${m.key}" rows="3" placeholder="תאר את יתרונות המודול..." oninput="updateModuleField('${m.key}','text',this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-violet-300 focus:outline-none">${s.text || m.defaultText || ''}</textarea>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-500 block mb-1">תמונה שיווקית (אופציונלי):</label>
                    <div class="flex flex-col gap-2">
                        <input type="hidden" id="mod-img-${m.key}" value="${imgVal}">
                        <input type="file" id="mod-upload-${m.key}" accept="image/*" class="hidden" onchange="handleModuleImgUpload(event,'${m.key}')">
                        <div class="flex gap-2">
                            <button type="button" onclick="document.getElementById('mod-upload-${m.key}').click()" class="flex-1 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition"><i class="fa-solid fa-upload"></i> העלה תמונה</button>
                            <button type="button" id="mod-clear-${m.key}" onclick="clearModuleImg('${m.key}')" class="${imgVal ? '' : 'hidden'} bg-red-50 text-red-500 px-3 py-2 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100 transition">הסר</button>
                        </div>
                        <img id="mod-img-preview-${m.key}" src="${imgVal}" class="${imgVal ? '' : 'hidden'} w-full h-24 object-contain rounded-lg border border-slate-200 bg-slate-50">
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.toggleModuleSettingsPanel = function(key) {
    const panel = getEl('mod-panel-' + key);
    if (!panel) return;
    panel.classList.toggle('hidden');
};

window.toggleModuleEnabled = function(key) {
    const s = window._memberModuleSettings || {};
    if (!s[key]) s[key] = {};
    s[key].enabled = s[key].enabled === false ? true : false;
    window._memberModuleSettings = s;
    const btn = getEl('mod-toggle-' + key);
    const dot = getEl('mod-toggle-dot-' + key);
    const chip = getEl('mod-status-chip-' + key);
    const on = s[key].enabled !== false;
    if (btn) { btn.className = btn.className.replace(on ? 'bg-slate-300' : 'bg-violet-500', on ? 'bg-violet-500' : 'bg-slate-300'); }
    if (dot) { dot.className = dot.className.replace(on ? 'translate-x-1' : 'translate-x-5', on ? 'translate-x-5' : 'translate-x-1'); }
    if (chip) { chip.textContent = on ? 'פעיל' : 'כבוי'; chip.className = chip.className.replace(on ? 'bg-slate-200 text-slate-500' : 'bg-violet-100 text-violet-700', on ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'); }
};

window.handleModuleImgUpload = function(event, key) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        const s = window._memberModuleSettings || {};
        if (!s[key]) s[key] = {};
        s[key].img = base64;
        window._memberModuleSettings = s;
        const hiddenInput = getEl('mod-img-' + key);
        const preview = getEl('mod-img-preview-' + key);
        const clearBtn = getEl('mod-clear-' + key);
        if (hiddenInput) hiddenInput.value = base64;
        if (preview) { preview.src = base64; preview.classList.remove('hidden'); }
        if (clearBtn) clearBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
};

window.clearModuleImg = function(key) {
    const s = window._memberModuleSettings || {};
    if (s[key]) s[key].img = '';
    window._memberModuleSettings = s;
    const hiddenInput = getEl('mod-img-' + key);
    const preview = getEl('mod-img-preview-' + key);
    const clearBtn = getEl('mod-clear-' + key);
    if (hiddenInput) hiddenInput.value = '';
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    if (clearBtn) clearBtn.classList.add('hidden');
};

window.updateModuleField = function(key, field, value) {
    const s = window._memberModuleSettings || {};
    if (!s[key]) s[key] = {};
    s[key][field] = value;
    window._memberModuleSettings = s;
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
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
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
    if (!groupsList) return;
    let gHtml = '';
    const term = val('sa-search-group').toLowerCase();
    const filteredGroups = saAllGroups.filter(g => (g.name && g.name.toLowerCase().includes(term)) || (g.group_code && g.group_code.toLowerCase().includes(term)));
    if (filteredGroups.length === 0) { groupsList.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו סביבות התואמות לחיפוש.</p>'; return; }

    filteredGroups.forEach(g => {
        let uHtml = saAllUsers.filter(u => u.group_id === g.id).map(u => {
            const phoneBadge = u.phone
                ? `<span class="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full mr-1">${safeStr(u.phone)}</span>`
                : `<span class="text-[10px] text-red-400 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full mr-1">ללא טלפון</span>`;
            const roleLabel = u.role === 'ADMIN' ? 'הורה/מנהל' : u.role === 'SENIOR' ? 'בכיר' : 'בן משפחה/עובד';
            return `
            <div class="flex justify-between items-center bg-slate-50 p-2 mt-1 rounded border border-slate-100 text-sm">
                <span>${safeStr(fmtUserName(u) || u.nickname)} <span class="text-[10px] text-slate-400">(${roleLabel})</span> ${phoneBadge}${u.registration_source && u.registration_source !== 'self' ? `<span class="text-[10px] text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full mr-1" title="מקור הרשמה">${safeStr(u.registration_source)}</span>` : ''}</span>
                <div class="flex gap-1">
                    <button onclick="openSAEditUserModal(${u.id})" class="text-blue-400 hover:text-blue-600 bg-white p-1 rounded shadow-sm transition"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="saDeleteUser(${u.id})" class="text-red-400 hover:text-red-600 bg-white p-1 rounded shadow-sm transition"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;}).join('');

        if (!uHtml) uHtml = '<p class="text-xs text-slate-400 py-1">אין משתמשים רשומים.</p>';

        // Module grid + requests for member-type groups
        let moduleReqHtml = '';
        if (g.member_type === 'member') {
            const unlocked = (() => { try { return Array.isArray(g.unlocked_modules) ? g.unlocked_modules : JSON.parse(g.unlocked_modules || '[]'); } catch(e) { return []; } })();
            const reqs = (() => { try { return Array.isArray(g.module_requests) ? g.module_requests : JSON.parse(g.module_requests || '[]'); } catch(e) { return []; } })();
            const reqKeys = reqs.map(r => typeof r === 'string' ? r : r.key);

            // Inline module checkboxes grid
            const gridItems = SA_MODULE_LIST.map(m => {
                const checked = unlocked.includes(m.key);
                const hasPending = reqKeys.includes(m.key);
                return `<label class="flex items-center gap-1.5 p-2 rounded-lg cursor-pointer border text-[10px] font-bold transition ${checked ? 'bg-violet-50 border-violet-300 text-violet-700' : hasPending ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}" title="${hasPending ? 'בקשה ממתינה' : ''}">
                    <input type="checkbox" class="sa-inline-mod-cb w-3.5 h-3.5 accent-violet-600" data-group="${g.id}" data-key="${m.key}" ${checked ? 'checked' : ''} onchange="saInlineToggleModule(${g.id})">
                    ${m.icon} ${m.name}${hasPending ? ' 🔔' : ''}
                </label>`;
            }).join('');

            const pendingCount = reqKeys.length;
            moduleReqHtml = `<div class="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-bold text-violet-700"><i class="fa-solid fa-puzzle-piece mr-1"></i> מודולים פתוחים${pendingCount ? ` · <span class="text-orange-600">🔔 ${pendingCount} ממתינות</span>` : ''}</span>
                    <button onclick="saInlineSaveModules(${g.id})" class="text-[9px] bg-violet-600 text-white px-2 py-0.5 rounded-lg font-bold hover:bg-violet-700 transition">שמור</button>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-1">${gridItems}</div>
            </div>`;
        }

        const gPlan = g.plan || (g.is_premium ? 'enterprise' : 'standard');
        const planBadges = {
            solo: '<span class="bg-slate-200 text-slate-700 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-slate-300">Solo</span>',
            member: '<span class="bg-violet-100 text-violet-700 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-violet-200">Member 👨‍👩‍👧</span>',
            standard: '<span class="bg-slate-100 text-slate-600 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-slate-200">Standard</span>',
            premium: '<span class="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-amber-200">⭐ Premium</span>',
            enterprise: '<span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold ml-2">Enterprise ♾️</span>'
        };
        const isPro = planBadges[gPlan] || planBadges.standard;
        const aiTokens = gPlan === 'enterprise' ? '∞' : gPlan === 'premium' ? `${g.ai_tokens ?? 50}/50` : `${g.ai_tokens ?? 10}/10`;
        const planSelector = `<select onchange="saPlanChange(${g.id}, this.value)" class="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white font-bold text-slate-700 cursor-pointer hover:border-indigo-400 transition">
            <option value="solo" ${gPlan==='solo'?'selected':''}>Solo</option>
            <option value="member" ${gPlan==='member'?'selected':''}>👨‍👩‍👧 Member</option>
            <option value="standard" ${gPlan==='standard'?'selected':''}>Standard — 10/יום</option>
            <option value="premium" ${gPlan==='premium'?'selected':''}>⭐ Premium — 50/יום</option>
            <option value="enterprise" ${gPlan==='enterprise'?'selected':''}>♾️ Enterprise — ללא הגבלה</option>
        </select>`;
        // תג סטטוס חשבון
        let accountStatusBadge = '';
        if (g.account_status === 'pending_activation') {
            accountStatusBadge = '<span class="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-amber-200 animate-pulse">⏳ ממתין לאישור</span>';
        } else if (g.account_status === 'frozen') {
            const frozenAt = g.frozen_at ? new Date(g.frozen_at) : null;
            const daysLeft = frozenAt ? Math.max(0, 30 - Math.floor((Date.now() - frozenAt.getTime()) / 86400000)) : '?';
            accountStatusBadge = `<span class="bg-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-blue-200">❄️ מוקפא — ${daysLeft} ימים לארכיב</span>`;
        } else if (g.account_status === 'archived') {
            accountStatusBadge = '<span class="bg-gray-100 text-gray-500 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 border border-gray-200">📦 ארכיב</span>';
        }
        const typeBadge = g.member_type === 'member' ? '<span class="bg-violet-100 text-violet-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-violet-200"><i class="fa-solid fa-link mr-1"></i> חבר ONEFLOW</span>' : g.type === 'BUSINESS' ? '<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-blue-200"><i class="fa-solid fa-briefcase mr-1"></i> עסק</span>' : '<span class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 border border-emerald-200"><i class="fa-solid fa-house mr-1"></i> משפחה</span>';
        const createdDate = g.created_at ? new Date(g.created_at).toLocaleDateString('he-IL') : 'לא ידוע';

        const adminUser = saAllUsers.find(u => u.group_id === g.id && u.role === 'ADMIN') || saAllUsers.find(u => u.group_id === g.id);
        const impersonateBtn = adminUser ? `<button onclick="impersonateGroup(${g.id}, ${adminUser.id})" class="bg-slate-800 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-slate-700 transition flex items-center gap-1 shadow-sm"><i class="fa-solid fa-user-secret"></i> כניסה לסביבה</button>` : '';
        const upgradeBtn = g.member_type === 'member' ? `<button onclick="saUpgradeToFamily(${g.id})" class="bg-violet-100 text-violet-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-violet-200 transition"><i class="fa-solid fa-arrow-up-right-dots mr-1"></i> שדרג למשפחה</button>` : '';
        const unfreezeBtn = g.account_status === 'frozen' ? `<button onclick="saUnfreezeGroup(${g.id})" class="bg-blue-100 text-blue-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-200 transition"><i class="fa-solid fa-snowflake mr-1"></i> בטל הקפאה</button>` : '';
        const resendSoloBtn = g.account_status === 'pending_activation' ? `<button onclick="saResendSoloCredentials(${g.id})" class="bg-amber-100 text-amber-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-amber-200 transition"><i class="fa-solid fa-paper-plane mr-1"></i> שלח פרטי כניסה שוב</button>` : '';

        gHtml += `
        <div class="${g.member_type === 'member' ? 'bg-violet-50 rounded-xl border-2 border-violet-300 mb-2 overflow-hidden shadow-sm' : 'bg-white rounded-xl border border-slate-200 mb-2 overflow-hidden shadow-sm'}">
            ${g.member_type === 'member' ? '<div class="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[11px] font-bold px-4 py-1 flex items-center gap-1"><i class=\"fa-solid fa-link\"></i> חבר ONEFLOW</div>' : ''}
            <div class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition" onclick="document.getElementById('sa-group-details-${g.id}').classList.toggle('hidden')">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center ml-3"><i class="fa-solid ${g.type === 'BUSINESS' ? 'fa-building' : 'fa-users'}"></i></div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm flex items-center flex-wrap gap-1">${safeStr(fmtGroupName(g))} ${isPro} ${typeBadge} ${accountStatusBadge}</h3>
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
                        ${upgradeBtn}
                        ${unfreezeBtn}
                        ${resendSoloBtn}
                        <button onclick="openSAEditGroupModal(${g.id}, '${safeStr(fmtGroupName(g))}', '${safeStr(g.admin_email)}')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-200 transition"><i class="fa-solid fa-pen"></i> ערוך פרטים</button>
                        ${planSelector}
                        <button onclick="openSnapshotsModal(${g.id},'${safeStr(fmtGroupName(g))}')" class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-200 transition"><i class="fa-solid fa-clock-rotate-left"></i> גיבויים</button>
                        <button onclick="saDeleteGroup(${g.id})" class="bg-red-100 text-red-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-red-200 transition"><i class="fa-solid fa-trash"></i> מחיקה</button>
                    </div>
                </div>
                ${uHtml}
                ${moduleReqHtml}
            </div>
        </div>`;
    });
    groupsList.innerHTML = gHtml;
}

function filterSAGroups() { renderSAGroups(); }

async function saQuickUnlockModule(groupId, moduleKey) {
    const group = saAllGroups.find(g => g.id === groupId);
    if (!group) return;
    const current = (() => { try { return Array.isArray(group.unlocked_modules) ? group.unlocked_modules : JSON.parse(group.unlocked_modules || '[]'); } catch(e) { return []; } })();
    if (current.includes(moduleKey)) return showToast('info', 'מודול זה כבר פתוח');
    const updated = [...current, moduleKey];
    try {
        const res = await fetch(`${API}/sa/groups/${groupId}/modules`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ modules: updated })
        });
        const d = await res.json();
        if (d.success || res.ok) {
            const idx = saAllGroups.findIndex(g => g.id === groupId);
            if (idx > -1) {
                saAllGroups[idx].unlocked_modules = updated;
                const reqs = saAllGroups[idx].module_requests || [];
                saAllGroups[idx].module_requests = reqs.filter(r => (typeof r === 'string' ? r : r.key) !== moduleKey);
            }
            const mod = SA_MODULE_LIST.find(m => m.key === moduleKey);
            showToast('success', `${mod?.icon || ''} ${mod?.name || moduleKey} - שוחרר בהצלחה!`);
            renderSAGroups();
        } else { showToast('error', d.error || 'שגיאה בשחרור מודול'); }
    } catch(e) { showToast('error', 'שגיאת שרת'); }
}

// Save inline module checkboxes for a member group
async function saInlineSaveModules(groupId) {
    const cbs = document.querySelectorAll(`.sa-inline-mod-cb[data-group="${groupId}"]`);
    const modules = Array.from(cbs).filter(cb => cb.checked).map(cb => cb.dataset.key);
    try {
        const res = await fetch(`${API}/sa/groups/${groupId}/modules`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ modules })
        });
        const d = await res.json();
        if (d.success || res.ok) {
            const idx = saAllGroups.findIndex(g => g.id === groupId);
            if (idx > -1) { saAllGroups[idx].unlocked_modules = modules; saAllGroups[idx].module_requests = []; }
            showToast('success', 'מודולים עודכנו בהצלחה!');
            renderSAGroups();
        } else { showToast('error', d.error || 'שגיאה בשמירה'); }
    } catch(e) { showToast('error', 'שגיאת שרת'); }
}

// Placeholder for onChange - save button handles actual save
function saInlineToggleModule(groupId) { /* visual only - click שמור to save */ }

async function saUnfreezeGroup(groupId) {
    if (!confirm('לבטל הקפאה של חשבון זה? החשבון יחזור לסטטוס active.')) return;
    try {
        const res = await fetch(`${API}/sa/groups/${groupId}/unfreeze`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) { showToast('success', 'הקפאה בוטלה בהצלחה'); await loadSAData(); }
        else showToast('error', data.error || 'שגיאה בביטול הקפאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
}

async function saResendSoloCredentials(groupId) {
    const g = saAllGroups.find(x => x.id === groupId);
    if (!g) return;
    const pwd = g.solo_temp_password || '****';
    showToast('info', `קוד: ${g.group_code} | סיסמה זמנית: ${pwd} — העתק ושלח ללקוח`);
}

async function saUpgradeToFamily(groupId) {
    if (!confirm('לשדרג סביבה זו מ"חבר ONEFLOW" למשפחה רגילה?\nהפעולה תשנה את סוג הגישה של החשבון.')) return;
    try {
        const res = await fetch(`${API}/sa/groups/${groupId}/upgrade-member`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ memberType: 'family' })
        });
        const d = await res.json();
        if (d.success) {
            showToast('success', 'הסביבה שודרגה למשפחה רגילה ✅');
            loadSAData();
        } else {
            showToast('error', d.error || 'שגיאה בשדרוג');
        }
    } catch(e) { showToast('error', 'שגיאת שרת'); }
}


async function saDeleteUser(id) {
    if (!confirm('למחוק משתמש זה מהמערכת כליל?')) return;
    await fetch(`${API}/superadmin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken } });
    showToast('success', 'משתמש נמחק');
    loadSAData();
}

async function saDeleteGroup(id) {
    const group = [...(saAllGroups||[])].find(g => g.id === id) || { name: `#${id}` };
    const isBiz = group.type === 'BUSINESS';
    const msg = isBiz
        ? `העסק "${fmtGroupName(group)}" יועבר לארכיון.\nניתן לשחזרו תוך 30 יום.\n\nלמחיקה לצמיתות — השתמש ב"מחק לצמיתות" בארכיון.`
        : `הסביבה "${fmtGroupName(group)}" תועבר לארכיון.\nניתן לשחזרה תוך 30 יום.`;
    if (!confirm(msg)) return;
    const res = await fetch(`${API}/superadmin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken } });
    const data = await res.json();
    if (data.success) { showToast('success', `"${fmtGroupName(group)}" הועברה לארכיון ✓`); loadSAData(); }
    else showToast('error', data.error || 'שגיאה');
}

async function openSnapshotsModal(groupId, groupName) {
    let modal = getEl('sa-snapshots-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sa-snapshots-modal';
        modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">
            <div class="flex justify-between items-center p-6 border-b border-slate-100">
                <div>
                    <h3 class="text-xl font-black text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-clock-rotate-left text-indigo-500"></i> היסטוריית Snapshots
                    </h3>
                    <p class="text-sm text-slate-500 mt-0.5">${safeStr(groupName)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="takeManualSnapshot(${groupId})" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5">
                        <i class="fa-solid fa-camera"></i> צלם עכשיו
                    </button>
                    <button onclick="getEl('sa-snapshots-modal').remove()" class="text-slate-400 hover:text-slate-600 bg-slate-100 w-9 h-9 rounded-full flex items-center justify-center transition text-lg">✕</button>
                </div>
            </div>
            <div id="snapshots-list" class="flex-1 overflow-y-auto p-6 space-y-2">
                <div class="text-center text-slate-400 py-8">טוען snapshots...</div>
            </div>
        </div>`;
    modal.style.display = 'flex';
    await loadSnapshotsList(groupId);
}

async function loadSnapshotsList(groupId) {
    const el = getEl('snapshots-list');
    if (!el) return;
    try {
        const res  = await fetch(`${API}/sa/groups/${groupId}/snapshots`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (!data.success || !data.snapshots.length) {
            el.innerHTML = `<div class="text-center text-slate-400 py-10 bg-slate-50 rounded-2xl border border-dashed">אין snapshots עדיין.<br><span class="text-xs mt-1 block">ה-snapshot הראשון יצולם בלילה הקרוב.</span></div>`;
            return;
        }
        const TYPE_LABELS = { auto: { label: 'אוטומטי', color: 'bg-slate-100 text-slate-600' }, manual: { label: 'ידני', color: 'bg-indigo-100 text-indigo-700' }, pre_delete: { label: 'לפני מחיקה', color: 'bg-red-100 text-red-700' }, pre_restore: { label: 'לפני שחזור', color: 'bg-amber-100 text-amber-700' } };
        el.innerHTML = data.snapshots.map(s => {
            const t = TYPE_LABELS[s.snapshot_type] || { label: s.snapshot_type, color: 'bg-slate-100 text-slate-600' };
            const dt = new Date(s.created_at);
            const dateStr = dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
            const timeStr = dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const kb = s.size_bytes ? Math.round(s.size_bytes / 1024) + ' KB' : '';
            return `
            <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition group">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shadow-sm">
                        <span class="text-[10px] font-black text-slate-700 leading-none">${dateStr.split('/').slice(0,2).join('/')}</span>
                        <span class="text-[9px] text-slate-400 leading-none mt-0.5">${timeStr}</span>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-bold text-slate-800">${dateStr} · ${timeStr}</span>
                            <span class="${t.color} text-[9px] font-bold px-2 py-0.5 rounded-full">${t.label}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${kb}</div>
                    </div>
                </div>
                <button onclick="confirmRestoreSnapshot(${s.id}, '${dateStr} ${timeStr}', '${safeStr(s.group_name)}')"
                    class="bg-white border border-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm">
                    <i class="fa-solid fa-rotate-left ml-1"></i> שחזר
                </button>
            </div>`;
        }).join('');
    } catch(e) { el.innerHTML = `<div class="text-center text-red-400 py-8">שגיאה: ${e.message}</div>`; }
}

async function takeManualSnapshot(groupId) {
    const btn = document.querySelector('#sa-snapshots-modal button[onclick*="takeManualSnapshot"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מצלם...'; }
    try {
        const res = await fetch(`${API}/sa/groups/${groupId}/snapshot`, { method: 'POST', headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) { showToast('success', 'Snapshot נלקח בהצלחה ✓'); await loadSnapshotsList(groupId); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', e.message); }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-camera"></i> צלם עכשיו'; }
}

async function confirmRestoreSnapshot(snapId, dateLabel, groupName) {
    if (!confirm(`שחזר את "${groupName}" למצב מ-${dateLabel}?\n\nפעולה זו תחזיר את הנתונים הבאים למצב ה-snapshot:\nמשתמשים, קטלוג, הגדרות, לקוחות, מלאי, פריטי לוח שנה.\n\nמצב נוכחי יישמר כ-snapshot "לפני שחזור".`)) return;
    try {
        const res = await fetch(`${API}/sa/snapshots/${snapId}/restore`, { method: 'POST', headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) {
            getEl('sa-snapshots-modal')?.remove();
            // הודעת הצלחה מרכזית
            const overlay = document.createElement('div');
            overlay.id = 'restore-success-overlay';
            overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4';
            overlay.innerHTML = `
                <div class="bg-white rounded-[2rem] shadow-2xl p-10 max-w-md w-full text-center animate-[slideUp_0.35s_ease-out]">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-5">
                        <i class="fa-solid fa-rotate-left text-4xl text-emerald-500"></i>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 mb-2">השחזור הושלם בהצלחה!</h2>
                    <p class="text-slate-600 mb-1 text-base font-bold">${safeStr(groupName)}</p>
                    <p class="text-slate-500 text-sm mb-6">
                        הסביבה שוחזרה למצב מ-<span class="font-bold text-indigo-600">${safeStr(dateLabel)}</span>.<br>
                        המצב הקודם נשמר כ-snapshot "לפני שחזור".
                    </p>
                    <button onclick="document.getElementById('restore-success-overlay').remove(); loadSAData();"
                        class="bg-slate-900 hover:bg-slate-700 text-white font-bold px-8 py-3 rounded-xl transition text-base">
                        הבנתי ✓
                    </button>
                </div>`;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); loadSAData(); } });
        }
        else showToast('error', data.error || 'שגיאת שחזור');
    } catch(e) { showToast('error', e.message); }
}

// ── ARCHIVE (soft-deleted groups) ──────────────────────────────────────────
let _archiveCache = [];

async function loadArchive() {
    const tbody = getEl('sa-archive-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">טוען...</td></tr>`;
    try {
        const res  = await fetch(`${API}/sa/groups/archived`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        _archiveCache = data.groups || [];
        renderArchive();
    } catch(e) { if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-400 py-6">שגיאה</td></tr>`; }
}

function renderArchive() {
    const tbody = getEl('sa-archive-tbody');
    if (!tbody) return;
    if (!_archiveCache.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center text-slate-400 bg-slate-50 border border-dashed rounded-xl">הארכיון ריק — אין סביבות שנמחקו.</td></tr>`;
        return;
    }
    tbody.innerHTML = _archiveCache.map(g => {
        const deletedDate = g.deleted_at ? new Date(g.deleted_at).toLocaleDateString('he-IL') : '—';
        const isBiz = g.type === 'BUSINESS';
        return `
        <tr class="hover:bg-red-50/30 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                <i class="fa-solid ${isBiz ? 'fa-store' : 'fa-house'} text-${isBiz ? 'blue' : 'emerald'}-400 text-sm"></i>
                ${safeStr(fmtGroupName(g))}
            </td>
            <td class="px-4 py-3 text-xs text-slate-500">${safeStr(g.business_type || g.type || '—')}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-400">${safeStr(g.group_code)}</td>
            <td class="px-4 py-3 text-xs text-slate-500">${safeStr(g.admin_email || '—')}</td>
            <td class="px-4 py-3 text-xs text-red-500 font-bold">${deletedDate}</td>
            <td class="px-4 py-3">
                <div class="flex gap-2 justify-end">
                    <button onclick="openSnapshotsModal(${g.id},'${safeStr(fmtGroupName(g))}')"
                        class="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1">
                        <i class="fa-solid fa-clock-rotate-left text-[10px]"></i> snapshots
                    </button>
                    <button onclick="restoreArchivedGroup(${g.id},'${safeStr(fmtGroupName(g))}')"
                        class="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1">
                        <i class="fa-solid fa-rotate-left text-[10px]"></i> שחזר
                    </button>
                    <button onclick="permanentDeleteGroup(${g.id},'${safeStr(fmtGroupName(g))}')"
                        class="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1">
                        <i class="fa-solid fa-skull text-[10px]"></i> מחק לצמיתות
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function restoreArchivedGroup(id, name) {
    if (!confirm(`שחזר את "${name}" למצב פעיל?`)) return;
    const res = await fetch(`${API}/sa/groups/${id}/restore`, { method: 'POST', headers: { 'Authorization': saToken } });
    const data = await res.json();
    if (data.success) { showToast('success', `"${name}" שוחזר בהצלחה ✓`); loadArchive(); loadSAData(); }
    else showToast('error', data.error || 'שגיאה');
}

async function permanentDeleteGroup(id, name) {
    const typed = prompt(`מחיקה לצמיתות — אין דרך חזרה!\n\nהקלד את שם הסביבה בדיוק כדי לאשר:\n"${name}"`);
    if (typed === null) return;
    if (typed !== name) { alert('השם אינו תואם — המחיקה בוטלה.'); return; }
    const res = await fetch(`${API}/sa/groups/${id}/permanent`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
        body: JSON.stringify({ confirm_name: name })
    });
    const data = await res.json();
    if (data.success) { showToast('success', `"${name}" נמחקה לצמיתות`); loadArchive(); }
    else showToast('error', data.error || 'שגיאה');
}
// ──────────────────────────────────────────────────────────────────────────

async function saTogglePremium(id, enable) {
    try {
        const plan = enable ? 'enterprise' : 'standard';
        const res = await fetch(`${API}/superadmin/groups/${id}/plan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ plan })
        });
        const data = await res.json();
        if (data.success) { showToast('success', `תוכנית עודכנה!`); loadSAData(); }
        else showToast('error', data.error || 'שגיאה');
    } catch (e) { showToast('error', 'שגיאת רשת'); }
}

async function saPlanChange(id, plan) {
    const labels = { solo: 'Solo', member: 'Member', standard: 'Standard', premium: 'Premium', enterprise: 'Enterprise' };
    if (!confirm(`לשנות רמת רישוי ל-${labels[plan] || plan}?`)) { renderSAGroups(); return; }
    try {
        const res = await fetch(`${API}/superadmin/groups/${id}/plan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ plan })
        });
        const data = await res.json();
        if (data.success) {
            const g = saAllGroups.find(x => x.id === id);
            if (g) { g.plan = plan; g.is_premium = plan === 'enterprise'; if (plan === 'member') g.member_type = 'member'; }
            showToast('success', `רמת רישוי שונתה ל-${labels[plan] || plan}!`);
            renderSAGroups();
        } else showToast('error', data.error || 'שגיאה בעדכון');
    } catch (e) { showToast('error', 'שגיאת רשת'); }
}

function openSAEditGroupModal(id, name, email) {
    const group = saAllGroups.find(g => g.id === id);
    const adminUser = saAllUsers.find(u => u.group_id === id && u.role === 'ADMIN');
    getEl('sa-edit-group-id').value = id;
    getEl('sa-edit-group-name').value = name;
    getEl('sa-edit-group-email').value = email || '';
    // שדות חדשים
    const setV = (elId, v) => { const el = getEl(elId); if(el) el.value = v || ''; };
    setV('sa-edit-group-code', group?.group_code || '');
    setV('sa-edit-group-admin-phone', adminUser?.phone || '');
    setV('sa-edit-group-city', group?.city || '');
    setV('sa-edit-group-address', group?.street_address || '');

    // הצגת שדות לפי סוג
    const isFamily = group?.type === 'FAMILY' && group?.member_type !== 'member';
    const isBusiness = group?.type === 'BUSINESS';
    const familyFields = getEl('sa-edit-family-fields');
    const bizFields = getEl('sa-edit-business-fields');
    if (familyFields) familyFields.classList.toggle('hidden', !isFamily);
    if (bizFields) bizFields.classList.toggle('hidden', !isBusiness);

    if (isFamily) {
        setV('sa-edit-group-last-name', group?.last_name || '');
        setV('sa-edit-group-family-nickname', group?.family_nickname || '');
    }
    if (isBusiness) {
        const sel = getEl('sa-edit-group-biz-type');
        if (sel) sel.value = group?.business_type || 'other';
        setV('sa-edit-group-contact-name', group?.contact_name || '');
    }

    const isMember = group?.member_type === 'member';
    const flagsSection = getEl('sa-flags-section');
    const memberSection = getEl('sa-member-modules-section');

    if (isMember) {
        // Show family module management, hide business flags
        if (flagsSection) flagsSection.classList.add('hidden');
        if (memberSection) memberSection.classList.remove('hidden');

        // Build member module checkboxes
        const unlocked = (() => { try { return Array.isArray(group.unlocked_modules) ? group.unlocked_modules : JSON.parse(group.unlocked_modules || '[]'); } catch(e) { return []; } })();
        const grid = getEl('sa-member-modules-grid');
        if (grid) {
            grid.innerHTML = SA_MODULE_LIST.map(m => `
                <label class="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border transition ${unlocked.includes(m.key) ? 'bg-violet-50 border-violet-300' : 'bg-white border-slate-200 hover:bg-violet-50'}">
                    <input type="checkbox" id="fammod-${m.key}" class="fam-mod-cb w-4 h-4 accent-violet-600 rounded" ${unlocked.includes(m.key) ? 'checked' : ''}>
                    <span class="text-xs font-bold text-slate-700">${m.icon} ${m.name}</span>
                </label>`).join('');
        }
    } else {
        // Show business flags, hide member section
        if (flagsSection) flagsSection.classList.remove('hidden');
        if (memberSection) memberSection.classList.add('hidden');

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
    }

    getEl('sa-edit-group-modal').classList.remove('hidden');
}

async function saveSAEditGroup() {
    const id = val('sa-edit-group-id');
    const name = val('sa-edit-group-name');
    const adminEmail = val('sa-edit-group-email');
    const adminPhone = val('sa-edit-group-admin-phone') || '';
    const city = val('sa-edit-group-city') || '';
    const streetAddress = val('sa-edit-group-address') || '';
    const lastName = val('sa-edit-group-last-name') || '';
    const familyNickname = val('sa-edit-group-family-nickname') || '';
    const bizType = (() => { const el = getEl('sa-edit-group-biz-type'); return el ? el.value : ''; })();
    const contactName = val('sa-edit-group-contact-name') || '';

    if (!name || !adminEmail) return showToast('error', 'שם ומייל לא יכולים להיות ריקים');

    const group = saAllGroups.find(g => g.id === parseInt(id));
    const isMember = group?.member_type === 'member';

    try {
        const extraGroupFields = { city, streetAddress, adminPhone };
        const groupIndex = saAllGroups.findIndex(g => g.id === parseInt(id));

        if (isMember) {
            const unlocked = Array.from(document.querySelectorAll('.fam-mod-cb:checked')).map(cb => cb.id.replace('fammod-', ''));
            if (groupIndex > -1) {
                saAllGroups[groupIndex].name = name;
                saAllGroups[groupIndex].admin_email = adminEmail;
                saAllGroups[groupIndex].city = city;
                saAllGroups[groupIndex].street_address = streetAddress;
                saAllGroups[groupIndex].unlocked_modules = unlocked;
            }
            await fetch(`${API}/sa/groups/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
                body: JSON.stringify({ name, adminEmail, ...extraGroupFields })
            });
            await fetch(`${API}/sa/groups/${id}/modules`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
                body: JSON.stringify({ modules: unlocked })
            });
        } else {
            const getCb = (cbId) => { const el = getEl(cbId); return el ? el.checked : true; };
            const flags = {
                store: getCb('flag-store'), b2b: getCb('flag-b2b'), academy: getCb('flag-academy'), calendar: getCb('flag-calendar'),
                finance: getCb('flag-finance'), inventory: getCb('flag-inventory'), crm: getCb('flag-crm'), deliveries: getCb('flag-deliveries'),
                foodcost: getCb('flag-foodcost'), ai: getCb('flag-ai'), timeclock: getCb('flag-timeclock'), cashflow: getCb('flag-cashflow'),
                budget: getCb('flag-budget'), forecast: getCb('flag-forecast'), tasks: getCb('flag-tasks'), community: getCb('flag-community'),
                members: getCb('flag-members'), shifts: getCb('flag-shifts')
            };
            if (groupIndex > -1) {
                saAllGroups[groupIndex].name = name;
                saAllGroups[groupIndex].admin_email = adminEmail;
                saAllGroups[groupIndex].features = flags;
                saAllGroups[groupIndex].city = city;
                saAllGroups[groupIndex].street_address = streetAddress;
                if (group?.type === 'FAMILY') {
                    saAllGroups[groupIndex].last_name = lastName;
                    saAllGroups[groupIndex].family_nickname = familyNickname;
                }
                if (group?.type === 'BUSINESS') {
                    saAllGroups[groupIndex].business_type = bizType;
                    saAllGroups[groupIndex].contact_name = contactName;
                }
            }
            await fetch(`${API}/sa/groups/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
                body: JSON.stringify({ name, adminEmail, features: flags, ...extraGroupFields, lastName, familyNickname, bizType, contactName })
            });
        }

        showToast('success', 'פרטי הסביבה עודכנו בהצלחה!');
        getEl('sa-edit-group-modal').classList.add('hidden');
        renderSAGroups();
    } catch (e) { showToast('error', 'שגיאת רשת בשמירת הנתונים'); }
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

function openSAEditUserModal(id) {
    const u = saAllUsers.find(u => u.id === id);
    if (!u) return;
    const group = saAllGroups.find(g => g.id === u.group_id);
    getEl('sa-edit-user-id').value = id;
    getEl('sa-edit-user-name').value = fmtUserName(u) || u.nickname || '';
    getEl('sa-edit-user-phone').value = u.phone || '';
    getEl('sa-edit-user-phone').className = `w-full border ${u.phone ? 'border-slate-200' : 'border-red-200 bg-red-50'} rounded-xl px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none`;
    getEl('sa-edit-user-id-number').value = u.id_number || '';
    getEl('sa-edit-user-email').value = u.email || '';
    getEl('sa-edit-user-birth').value = u.birth_year || '';
    getEl('sa-edit-user-pass').value = '';
    const roleEl = getEl('sa-edit-user-role');
    if (roleEl) { Array.from(roleEl.options).forEach(o => o.selected = o.value === u.role); }
    const statusEl = getEl('sa-edit-user-status');
    if (statusEl) { Array.from(statusEl.options).forEach(o => o.selected = o.value === u.status); }
    const infoEl = getEl('sa-edit-user-info');
    if (infoEl) infoEl.innerHTML = `<div><strong>סביבה:</strong> ${safeStr(group ? fmtGroupName(group) : '—')} (${group?.type === 'BUSINESS' ? 'עסק' : 'משפחה'})</div><div><strong>ID:</strong> ${u.id} | <strong>סטטוס:</strong> ${u.status || 'active'}</div>`;
    getEl('sa-edit-user-modal').classList.remove('hidden');
}

async function saveSAEditUser() {
    const id = parseInt(val('sa-edit-user-id'));
    const nickname = val('sa-edit-user-name')?.trim();
    if (!nickname) return showToast('error', 'נא למלא שם תצוגה');
    const body = {
        nickname,
        phone: val('sa-edit-user-phone')?.trim() || null,
        id_number: val('sa-edit-user-id-number')?.trim() || null,
        email: val('sa-edit-user-email')?.trim() || null,
        birth_year: parseInt(val('sa-edit-user-birth')) || null,
        role: val('sa-edit-user-role'),
        status: val('sa-edit-user-status'),
        new_password: val('sa-edit-user-pass')?.trim() || null
    };
    try {
        const res = await fetch(`${API}/superadmin/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            const idx = saAllUsers.findIndex(u => u.id === id);
            if (idx >= 0) saAllUsers[idx] = { ...saAllUsers[idx], ...body, ...data.user };
            showToast('success', 'פרטי המשתמש עודכנו ✅');
            getEl('sa-edit-user-modal').classList.add('hidden');
            renderSAGroups();
        } else showToast('error', data.error || 'שגיאה בשמירה');
    } catch (e) { showToast('error', 'שגיאת תקשורת'); }
}

async function loadSACommunityData() {
    // Inject community advanced tools toolbar if not yet present
    const toolbarId = 'sa-comm-advanced-toolbar';
    if (!document.getElementById(toolbarId)) {
        const tbody = getEl('sa-communities-table-body');
        const section = tbody ? tbody.closest('section') || tbody.parentElement?.parentElement : null;
        if (section) {
            const bar = document.createElement('div');
            bar.id = toolbarId;
            bar.className = 'flex flex-wrap gap-2 mb-4 p-3 bg-gradient-to-r from-slate-50 to-indigo-50 rounded-2xl border border-indigo-100';
            bar.innerHTML = `
                <span class="text-xs font-bold text-slate-500 w-full mb-1">🚀 כלים מתקדמים לקהילות:</span>
                <span class="inline-flex items-center gap-1">
                  <button onclick="openCommunitiesMap()" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-xl text-xs font-bold transition">🗺️ מפת קהילות</button>
                  <button onclick="showCommunityHelp('sa-map')" class="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 text-blue-400 text-[9px] font-black flex items-center justify-center hover:bg-blue-100 transition" title="עזרה">?</button>
                </span>
                <span class="inline-flex items-center gap-1">
                  <button onclick="openSAPromotionsPanel()" class="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-xl text-xs font-bold transition">📢 אישור מבצעים</button>
                  <button onclick="showCommunityHelp('sa-promotions')" class="w-5 h-5 rounded-full bg-orange-50 border border-orange-200 text-orange-400 text-[9px] font-black flex items-center justify-center hover:bg-orange-100 transition" title="עזרה">?</button>
                </span>
                <span class="inline-flex items-center gap-1">
                  <button onclick="openSAReferralsPanel()" class="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-3 py-1.5 rounded-xl text-xs font-bold transition">🌟 שגרירי קהילה</button>
                  <button onclick="showCommunityHelp('sa-ambassadors')" class="w-5 h-5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-500 text-[9px] font-black flex items-center justify-center hover:bg-yellow-100 transition" title="עזרה">?</button>
                </span>
                <span class="inline-flex items-center gap-1">
                  <button onclick="openSABundlesPanel()" class="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold transition">📦 חבילות קהילה</button>
                  <button onclick="showCommunityHelp('sa-bundles')" class="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-400 text-[9px] font-black flex items-center justify-center hover:bg-emerald-100 transition" title="עזרה">?</button>
                </span>
                <span class="inline-flex items-center gap-1">
                  <button onclick="openBusinessMatchStandalonePanel()" class="bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold transition">🎯 התאמת עסקים</button>
                  <button onclick="showCommunityHelp('sa-match')" class="w-5 h-5 rounded-full bg-purple-50 border border-purple-200 text-purple-400 text-[9px] font-black flex items-center justify-center hover:bg-purple-100 transition" title="עזרה">?</button>
                </span>
                <span class="inline-flex items-center gap-1">
                  <button onclick="openSABannerRequestsPanel()" class="bg-pink-100 text-pink-700 hover:bg-pink-200 px-3 py-1.5 rounded-xl text-xs font-bold transition">🖼️ בקשות באנר</button>
                  <button onclick="showCommunityHelp('sa-banners')" class="w-5 h-5 rounded-full bg-pink-50 border border-pink-200 text-pink-400 text-[9px] font-black flex items-center justify-center hover:bg-pink-100 transition" title="עזרה">?</button>
                </span>
                <button onclick="openFlowConfigPanel()" class="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5">⚡ ניהול FLOW</button>
                <a href="community-guide.html" target="_blank" class="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5">📖 מדריך ניהול קהילות</a>
                <a href="flow-guide.html" target="_blank" class="bg-amber-500 text-white hover:bg-amber-600 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5">⚡ מדריך Flw</a>
                <a href="flowpool-guide.html" target="_blank" class="bg-cyan-600 text-white hover:bg-cyan-700 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5">🏊 מדריך FlowPool</a>
            `;
            section.insertBefore(bar, section.firstChild);
        }
    }

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

window.loadSAArticles = async function() {
    const listEl = getEl('sa-articles-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">טוען...</p>';
    try {
        const res = await fetch(`${API}/sa/articles`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        const articles = data.articles || [];
        if (!articles.length) { listEl.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">אין מאמרים</p>'; return; }
        listEl.innerHTML = articles.map(a => {
            const date = new Date(a.published_at).toLocaleDateString('he-IL');
            return `<div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-slate-800 text-sm truncate">${safeStr(a.title)}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">${date} · ${a.community_name ? safeStr(a.community_name) : 'כל הקהילות'}</p>
                        <p class="text-xs text-slate-600 mt-1 line-clamp-2">${safeStr(a.body)}</p>
                    </div>
                    <button onclick="deleteSAArticle(${a.id})" class="bg-red-50 text-red-500 border border-red-100 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-red-100 transition shrink-0">מחק</button>
                </div>
            </div>`;
        }).join('');
        const sel = getEl('sa-article-community');
        if (sel && sel.options.length <= 1) {
            saCommunitiesCache.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });
        }
    } catch(e) { if (listEl) listEl.innerHTML = '<p class="text-xs text-red-400 text-center py-4">שגיאה</p>'; }
};

window.publishSAArticle = async function() {
    const title = (getEl('sa-article-title')?.value || '').trim();
    const body = (getEl('sa-article-body')?.value || '').trim();
    const image_url = (getEl('sa-article-image')?.value || '').trim() || null;
    const community_id = getEl('sa-article-community')?.value || null;
    if (!title || !body) { showToast('error', 'כותרת ותוכן הם שדות חובה'); return; }
    try {
        const res = await fetch(`${API}/sa/articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ title, body, image_url, community_id: community_id || null })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'המאמר פורסם בהצלחה!');
            getEl('sa-article-title').value = '';
            getEl('sa-article-body').value = '';
            getEl('sa-article-image').value = '';
            window.loadSAArticles();
        } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
};

window.deleteSAArticle = async function(id) {
    if (!confirm('למחוק מאמר זה?')) return;
    try {
        const res = await fetch(`${API}/sa/articles/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) { showToast('success', 'המאמר נמחק'); window.loadSAArticles(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
};

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
        // בקשות עסקים
        const res = await fetch(`${API}/sa/communities/pending-businesses`); const data = await res.json();
        let html = '';
        if (data.success && data.pending && data.pending.length > 0) {
            html += `<h4 class="text-xs font-bold text-slate-500 mb-2 mt-1">🏢 בקשות עסקים לקהילה</h4>`;
            html += data.pending.map(p => {
                const isZmPending = p.status === 'zm_pending';
                const actionsHtml = isZmPending
                    ? `<div class="flex flex-col gap-1 items-end">
                         <span class="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-lg font-bold"><i class="fa-solid fa-clock mr-1"></i>ממתין למנהל אזור</span>
                         <button onclick="approveSABizDirect(${p.community_id}, ${p.business_id})" class="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 transition"><i class="fa-solid fa-bolt mr-1"></i>אשר ישירות ללא ZM</button>
                         <button onclick="rejectSABizRequest(${p.community_id}, ${p.business_id})" class="text-[10px] bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded-lg font-bold hover:bg-red-100 transition">דחה</button>
                       </div>`
                    : `<div class="flex flex-col gap-1 items-end">
                         <button onclick="approveSABizRequest(${p.community_id}, ${p.business_id})" class="bg-slate-800 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm"><i class="fa-solid fa-check mr-1"></i> אשר</button>
                         <button onclick="rejectSABizRequest(${p.community_id}, ${p.business_id})" class="bg-red-50 text-red-600 px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm"><i class="fa-solid fa-xmark mr-1"></i> דחה</button>
                       </div>`;
                return `<div class="bg-white p-3 rounded-2xl shadow-sm border ${isZmPending ? 'border-blue-100' : 'border-orange-100'} flex justify-between items-center hover:shadow-md transition mb-2">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">העסק: ${safeStr(p.biz_name)}</h4>
                        <p class="text-xs text-slate-500 mt-0.5">קהילה: <strong>${safeStr(p.comm_name)}</strong></p>
                        <p class="text-[11px] text-green-700 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded-full inline-block border border-green-200">${p.discount_pct}% הנחה לחברים</p>
                    </div>
                    ${actionsHtml}
                </div>`;
            }).join('');
        }

        // בקשות משפחות
        try {
            const famRes = await fetch(`${API}/sa/communities/pending-families`); const famData = await famRes.json();
            if (famData.success && famData.pending && famData.pending.length > 0) {
                html += `<h4 class="text-xs font-bold text-slate-500 mb-2 mt-3">👨‍👩‍👧 בקשות משפחות להצטרפות לקהילה</h4>`;
                html += famData.pending.map(p => `
                    <div class="bg-white p-3 rounded-2xl shadow-sm border border-indigo-100 flex justify-between items-center hover:shadow-md transition mb-2">
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm">משפחה: ${safeStr(p.family_name)}</h4>
                            <p class="text-xs text-slate-500 mt-0.5">מבקשת להצטרף לקהילת: <strong>${safeStr(p.comm_name)}</strong></p>
                        </div>
                        <div class="flex flex-col gap-1 items-end">
                            <button onclick="approveSAFamilyRequest(${p.group_id}, ${p.community_id})" class="bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 transition"><i class="fa-solid fa-check mr-1"></i> אשר</button>
                            <button onclick="rejectSAFamilyRequest(${p.group_id}, ${p.community_id})" class="bg-red-50 text-red-600 px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-red-100 transition"><i class="fa-solid fa-xmark mr-1"></i> דחה</button>
                        </div>
                    </div>`).join('');
            }
        } catch(_) {}

        // מבצעי קהילה ממתינים לאישור
        try {
            const promoRes = await fetch(`${API}/sa/community-promos/pending`); const promoData = await promoRes.json();
            if (promoData.success && promoData.promos && promoData.promos.length > 0) {
                html += `<h4 class="text-xs font-bold text-slate-500 mb-2 mt-3">📢 מבצעי קהילה ממתינים לאישור</h4>`;
                html += promoData.promos.map(p => `
                    <div class="bg-white p-3 rounded-2xl shadow-sm border border-pink-100 flex justify-between items-center hover:shadow-md transition mb-2">
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm">${safeStr(p.title)}</h4>
                            <p class="text-xs text-slate-500 mt-0.5">${safeStr(p.biz_name)} ← קהילת ${safeStr(p.comm_name)}</p>
                            ${p.discount_pct > 0 ? `<p class="text-[11px] text-pink-700 font-bold mt-1 bg-pink-50 px-2 py-0.5 rounded-full inline-block border border-pink-200">${p.discount_pct}% הנחה</p>` : ''}
                        </div>
                        <div class="flex flex-col gap-1 items-end">
                            <button onclick="approveSAPromo(${p.id})" class="bg-pink-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-pink-700 transition"><i class="fa-solid fa-check mr-1"></i> אשר</button>
                            <button onclick="rejectSAPromo(${p.id})" class="bg-red-50 text-red-600 px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-red-100 transition"><i class="fa-solid fa-xmark mr-1"></i> דחה</button>
                        </div>
                    </div>`).join('');
            }
        } catch(_) {}

        if (html) { container.classList.remove('hidden'); list.innerHTML = html; }
        else { container.classList.add('hidden'); }
    } catch(e) { console.error('Error loading pending requests', e); }
}

async function approveSABizRequest(communityId, businessId) {
    if(!confirm('האם לאשר את הצטרפות העסק לקהילה?')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/approve`, { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': saToken || ''}, body: JSON.stringify({ communityId, businessId }) });
        const data = await res.json();
        if(data.success) {
            if (data.forwarded_to_zm) {
                showToast('success', 'הבקשה אושרה על ידיך והועברה לאישור מנהל האזור');
            } else {
                showToast('success', 'העסק אושר וצורף לקהילה!');
            }
            loadSACommunityData();
        }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function rejectSABizRequest(communityId, businessId) {
    if(!confirm('האם לדחות ולהסיר את הבקשה של העסק?')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        if((await res.json()).success) { showToast('info', 'הבקשה נדחתה והוסרה מהרשימה.'); loadSACommunityData(); }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function approveSABizDirect(communityId, businessId) {
    if(!confirm('לאשר את העסק ישירות לקהילה (ללא המתנה למנהל אזור)?')) return;
    try {
        const res = await fetch(`${API}/sa/community-business/approve-direct`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId, businessId }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'העסק אושר ישירות לקהילה!'); loadSACommunityData(); loadSAPendingRequests(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function approveSAFamilyRequest(groupId, communityId) {
    try {
        const res = await fetch(`${API}/sa/community-family/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId, communityId }) });
        const data = await res.json();
        if(data.success) { showToast('success', 'המשפחה אושרה לקהילה!'); loadSAPendingRequests(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function rejectSAFamilyRequest(groupId, communityId) {
    if(!confirm('האם לדחות את בקשת ההצטרפות של המשפחה?')) return;
    try {
        const res = await fetch(`${API}/sa/community-family/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId, communityId }) });
        const data = await res.json();
        if(data.success) { showToast('info', 'בקשת המשפחה נדחתה.'); loadSAPendingRequests(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function approveSAPromo(promoId) {
    try {
        const res = await fetch(`${API}/sa/community-promo/approve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ promoId }) });
        const data = await res.json();
        if(data.success) { showToast('success', `המבצע אושר! קוד: ${data.promo_code}`); loadSAPendingRequests(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function rejectSAPromo(promoId) {
    if(!confirm('האם לדחות את המבצע?')) return;
    try {
        const res = await fetch(`${API}/sa/community-promo/reject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ promoId }) });
        const data = await res.json();
        if(data.success) { showToast('info', 'המבצע נדחה.'); loadSAPendingRequests(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function renderSACommunitiesTable() {
    const tbody = getEl('sa-communities-table-body'); if (!tbody) return;
    const query = getEl('sa-search-comm') ? getEl('sa-search-comm').value.toLowerCase() : '';
    const countFilter = getEl('sa-filter-comm-count') ? getEl('sa-filter-comm-count').value : 'all';
    const multiFilter = getEl('sa-filter-comm-multi') ? getEl('sa-filter-comm-multi').checked : false; 
    let filtered = [...saCommunitiesCache];
    
    if (query) filtered = filtered.filter(c => (c.name && c.name.toLowerCase().includes(query)) || (c.code && c.code.toLowerCase().includes(query)) || (c.city && c.city.toLowerCase().includes(query)));
    if (countFilter === 'pending') filtered = filtered.filter(c => c.status === 'pending');
    else if (countFilter === 'with_families') filtered = filtered.filter(c => parseInt(c.family_count || 0) > 0);
    else if (countFilter === 'empty') filtered = filtered.filter(c => parseInt(c.family_count || 0) === 0);
    else if (countFilter === 'sort_desc') filtered.sort((a, b) => parseInt(b.family_count || 0) - parseInt(a.family_count || 0));
    if (multiFilter) filtered = filtered.filter(c => c.city && c.city.split(',').filter(x => x.trim()).length >= 2);
    
    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">לא נמצאו קהילות.</td></tr>`; return; }
    
    tbody.innerHTML = filtered.map(c => {
        const isPending = c.status === 'pending';
        const rowClass = isPending ? 'bg-amber-50 hover:bg-amber-100 border-b border-amber-100' : 'hover:bg-slate-50 border-b border-slate-50';
        return `
        <tr class="${rowClass} transition last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right flex items-center gap-3">
                ${c.image_url ? `<img src="${c.image_url}" class="w-8 h-8 rounded-lg object-cover shadow-sm shrink-0">` : `<div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><i class="fa-solid fa-users"></i></div>`}
                <div>
                    <div class="flex items-center gap-2">${safeStr(c.name || 'ללא שם')}${isPending ? `<span class="bg-amber-200 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">⏳ ממתין לאישור</span>` : ''}</div>
                    <div class="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1 max-w-[200px] overflow-hidden">${(c.city || 'לא הוגדר').split(',').map(city => `<span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><i class="fa-solid fa-location-dot text-orange-400"></i> ${city.trim()}</span>`).join('')}</div>
                </div>
            </td>
            <td class="px-4 py-4 font-mono text-orange-600 font-bold tracking-widest text-right">${safeStr(c.code || '---')}</td>
            <td class="px-4 py-4 text-right"><div class="text-xs text-slate-600 mb-1"><span class="text-slate-400 font-bold ml-1">מייל:</span> ${safeStr(c.manager_email || '---')}</div><div class="text-xs text-slate-600"><span class="text-slate-400 font-bold ml-1">סיסמה:</span> ${safeStr(c.manager_password || '---')}</div></td>
            <td class="px-4 py-4 text-center">
                <span class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold text-xs"><i class="fa-solid fa-house text-[10px]"></i> ${c.family_count || 0} משפחות</span>
                <span class="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-bold text-xs ml-1"><i class="fa-solid fa-briefcase text-[10px]"></i> ${c.business_count || 0} עסקים</span>
            </td>
            <td class="px-4 py-4 text-center">
                <div class="flex flex-wrap gap-1.5 justify-center">
                    ${isPending ? `<button onclick="approveSACommunity(${c.id})" class="bg-green-500 text-white hover:bg-green-600 px-2.5 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-check"></i> אשר</button>` : ''}
                    <button onclick="openSACommunityModal(${c.id})" class="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition"><i class="fa-solid fa-gear"></i> ניהול</button>
                    <button onclick="openInterestTagsModal(${c.id},'${safeStr(c.name).replace(/'/g,"\\'")}')" class="bg-teal-100 text-teal-700 hover:bg-teal-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition" title="תגיות עניין">🏷️</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterSACommunities() { renderSACommunitiesTable(); }

async function approveSACommunity(id) {
    if (!confirm('לאשר את הקהילה ולהפוך אותה לפעילה?')) return;
    try {
        const r = await fetch(`${API}/sa/communities/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${saToken}` } });
        const d = await r.json();
        if (d.success) {
            showToast('הקהילה אושרה בהצלחה ✅');
            const c = saCommunitiesCache.find(x => x.id == id);
            if (c) c.status = 'active';
            renderSACommunitiesTable();
        } else showToast('שגיאה באישור', 'error');
    } catch(e) { showToast('שגיאת רשת', 'error'); }
}

async function openSACommunityModal(id) {
    const comm = saCommunitiesCache.find(c => c.id == id); if(!comm) return;
    getEl('sa-edit-comm-id').value = comm.id; getEl('sa-edit-comm-title').innerText = comm.name; getEl('sa-edit-comm-name').value = comm.name; getEl('sa-edit-comm-code').value = comm.code; getEl('sa-edit-comm-email').value = comm.manager_email; getEl('sa-edit-comm-pass').value = comm.manager_password;
    editCityTags = comm.city ? comm.city.split(',').map(c => c.trim()).filter(c => c) : []; updateCityTagsDisplay('edit');
    const imgEl = getEl('sa-edit-comm-image-base64'); if(imgEl) imgEl.value = '';
    const imgPreview = getEl('sa-edit-comm-img-preview'); const placeholder = getEl('sa-edit-comm-img-placeholder');
    if(imgPreview) {
        if (comm.image_url) { imgPreview.src = comm.image_url; imgPreview.classList.remove('hidden'); if(placeholder) placeholder.classList.add('hidden'); }
        else { imgPreview.src = ''; imgPreview.classList.add('hidden'); if(placeholder) placeholder.classList.remove('hidden'); }
    }
    getEl('sa-edit-comm-fam-count').innerText = comm.family_count || 0; getEl('sa-edit-comm-biz-count').innerText = comm.business_count || 0;
    const searchInput = getEl('sa-search-comm-fam'); if (searchInput) searchInput.value = '';
    const famList = getEl('sa-edit-comm-families'); const bizList = getEl('sa-edit-comm-businesses');
    famList.innerHTML = '<p class="text-xs text-slate-400 p-2">טוען נתונים...</p>'; bizList.innerHTML = '<p class="text-xs text-slate-400 p-2">טוען נתונים...</p>';
    getEl('sa-community-modal').classList.remove('hidden');
    try {
        const res = await fetch(`${API}/sa/communities/${id}/details`, { headers: { 'Authorization': saToken || '' } }); const data = await res.json();
        if(data.success) {
            currentCommFamiliesCache = data.families || []; renderSACommFamilies(); renderSAUsersAppoint();
            if(data.businesses.length === 0) { bizList.innerHTML = '<p class="text-xs text-slate-400 p-2 bg-slate-50 border border-dashed rounded-lg text-center mt-2">אין עסקים נותני הנחה.</p>'; } 
            else { bizList.innerHTML = data.businesses.map(b => `<div class="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm mb-1.5 text-xs flex justify-between items-center"><span class="font-bold text-slate-700 flex items-center gap-2"><i class="fa-solid fa-store text-slate-300"></i> ${safeStr(b.name)}<span class="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">${safeStr(b.group_code||'')}</span></span><span class="text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-100">${b.discount_pct}% הנחה</span></div>`).join(''); }
        }
    } catch(e) { famList.innerHTML = '<p class="text-xs text-red-400 p-2">שגיאה</p>'; bizList.innerHTML = '<p class="text-xs text-red-400 p-2">שגיאה</p>'; }
}

function renderSACommFamilies(query = '') {
    const famList = getEl('sa-edit-comm-families'); if (!famList) return;
    let filtered = currentCommFamiliesCache;
    if (query) { const q = query.toLowerCase(); filtered = currentCommFamiliesCache.filter(f => (f.name && f.name.toLowerCase().includes(q)) || (f.group_code && f.group_code.toLowerCase().includes(q))); }
    if (filtered.length === 0) { famList.innerHTML = `<p class="text-xs text-slate-400 p-2 bg-slate-50 border border-dashed rounded-lg text-center mt-2">${query ? 'לא נמצאו משפחות' : 'אין משפחות'}</p>`; return; }
    famList.innerHTML = filtered.map(f => {
        const usersHtml = f.users && f.users.length > 0 ? f.users.map(u => `<div class="text-[10px] text-slate-500 pl-2 pr-1 py-1.5 border-t border-slate-100 flex justify-between bg-slate-50/50"><span><i class="fa-solid ${u.role === 'ADMIN' ? 'fa-user-tie text-blue-400' : 'fa-user text-slate-400'} ml-1"></i> ${safeStr(fmtUserName(u) || u.nickname)}</span><span class="bg-white px-1.5 rounded shadow-sm">${u.role === 'ADMIN' ? 'מנהל/הורה' : 'חבר/ילד'}</span></div>`).join('') : '<div class="text-[10px] text-slate-400 pl-2 py-1.5 border-t border-slate-100 bg-slate-50/50">אין משתמשים.</div>';
        const commId = getEl('sa-edit-comm-id') ? getEl('sa-edit-comm-id').value : '';
        const isManager = f.is_community_manager === true;
        const managerBtn = isManager
            ? `<button onclick="event.stopPropagation();setSACommunityManager(${commId},${f.id},false)" class="text-[9px] font-bold bg-red-50 text-red-500 px-1.5 py-0.5 rounded hover:bg-red-100 transition whitespace-nowrap">הסר מנהל</button>`
            : `<button onclick="event.stopPropagation();setSACommunityManager(${commId},${f.id},true)" class="text-[9px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded hover:bg-purple-200 transition whitespace-nowrap">הגדר מנהל</button>`;
        const starIcon = isManager ? '<i class="fa-solid fa-star text-purple-400 text-[10px] mr-1"></i>' : '';
        return `<div class="bg-white rounded-lg border border-slate-200 mb-1.5 overflow-hidden shadow-sm"><div class="p-2.5 text-xs flex justify-between items-center cursor-pointer hover:bg-blue-50 transition group" onclick="document.getElementById('sa-comm-fam-${f.id}').classList.toggle('hidden')"><div class="flex items-center gap-2">${managerBtn}</div><div class="font-bold text-slate-700 flex items-center gap-2">${starIcon}<i class="fa-solid fa-users text-slate-300 group-hover:text-blue-400 transition"></i> ${safeStr(f.name)}<span class="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">${safeStr(f.group_code||'')}</span></div></div><div id="sa-comm-fam-${f.id}" class="hidden flex flex-col">${usersHtml}</div></div>`;
    }).join('');
}

function filterSACommFamilies() { const query = getEl('sa-search-comm-fam') ? getEl('sa-search-comm-fam').value : ''; renderSACommFamilies(query); }

let _saUsersAppointCache = [];
function renderSAUsersAppoint(query = '') {
    const el = getEl('sa-users-appoint-list'); if (!el) return;
    const commId = getEl('sa-edit-comm-id') ? getEl('sa-edit-comm-id').value : '';
    _saUsersAppointCache = currentCommFamiliesCache.flatMap(f =>
        (f.users || []).map(u => ({ ...u, family_name: fmtGroupName(f), group_id: f.id, is_manager: f.is_community_manager }))
    );
    let filtered = _saUsersAppointCache;
    if (query) { const q = query.toLowerCase(); filtered = filtered.filter(u => (u.nickname||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || (u.family_name||'').toLowerCase().includes(q)); }
    if (!filtered.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">אין משתמשים בקהילה</p>'; return; }
    el.innerHTML = filtered.map(u => `
        <div class="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-purple-100 text-xs">
            <button onclick="setSACommunityManager(${commId},${u.group_id},${!u.is_manager})" class="text-[10px] font-bold px-2 py-0.5 rounded-lg transition ${u.is_manager ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}">${u.is_manager ? 'הסר מנהל' : 'מנה כמנהל'}</button>
            <div class="text-right">
                <span class="font-bold text-slate-700">${fmtUserName(u) || u.nickname || u.email || '—'}</span>
                <span class="text-[10px] text-slate-400 mr-1">(${u.family_name || ''})</span>
                ${u.is_manager ? '<span class="text-[10px] text-purple-600 font-bold mr-1">⭐ מנהל</span>' : ''}
            </div>
        </div>`).join('');
}
function filterSAUsersAppoint() { const q = getEl('sa-users-appoint-search')?.value || ''; renderSAUsersAppoint(q); }

async function setSACommunityManager(commId, groupId, isManager) {
    try {
        const res = await fetch(`${API}/sa/communities/${commId}/set-manager`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken || '' },
            body: JSON.stringify({ groupId, isManager })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', isManager ? 'המשפחה הוגדרה כמנהלת קהילה!' : 'הוסרה הרשאת מנהל קהילה');
            openSACommunityModal(commId);
        } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

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
    // Auto-add any typed city that wasn't explicitly clicked "הוסף"
    const cityInput = getEl('sa-comm-city-input');
    if (cityInput && cityInput.value.trim()) { addCityTag('create'); }

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
                        <div class="flex flex-col items-end gap-2">
                            <span class="text-[10px] ${c.status === 'approved' ? 'text-green-600 bg-green-50' : 'text-orange-500 bg-orange-50'} px-2 py-0.5 rounded font-bold">${c.status === 'approved' ? 'מחובר ופעיל' : 'ממתין לאישור'}</span>
                            <button onclick="openSADiscountEdit(${c.id},${bizId},${c.discount_pct})" class="text-[10px] font-bold text-teal-600 hover:bg-teal-50 px-2 py-1 rounded transition"><i class="fa-solid fa-percent mr-1"></i>עדכן הנחה</button>
                            <button onclick="removeBizFromCommunityInModal(${c.id}, ${bizId})" class="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition"><i class="fa-solid fa-trash"></i> נתק עסק</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch(e) { list.innerHTML = '<p class="text-xs text-red-500 text-center py-4">שגיאה בטעינת נתונים</p>'; }
}

async function openSADiscountEdit(commId, bizId, current) {
    const v = prompt(`אחוז הנחה חדש (נוכחי: ${current}%):`, current);
    if (v === null || v === '') return;
    try {
        const res = await fetch(`${API}/sa/community-business/discount`, {
            method: 'PUT', headers: {'Content-Type':'application/json', 'Authorization': typeof saToken !== 'undefined' ? saToken : (localStorage.getItem('ofl_sa_token')||'')},
            body: JSON.stringify({ communityId: commId, businessId: bizId, discountPct: parseFloat(v)||0 })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'ההנחה עודכנה'); openSABusinessModal(bizId); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
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
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/jpeg', 0.88);
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
        const originalDataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
            const maxWidth = 1200;
            let base64;
            if (img.width <= maxWidth) {
                // no resize needed — use original data as-is, zero quality loss
                base64 = originalDataUrl;
            } else {
                const canvas = document.createElement('canvas');
                let width = maxWidth; let height = Math.round(img.height * (maxWidth / img.width));
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                base64 = canvas.toDataURL('image/jpeg', 0.92);
            }
            const targetInput = document.getElementById(targetInputId); if (targetInput) targetInput.value = base64;
            const previewImg = document.getElementById(previewId); if (previewImg) { previewImg.src = base64; previewImg.classList.remove('hidden'); }
        };
        img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
}

async function loadSAPartners() {
    setTimeout(() => { renderSAPartnersTable(); }, 300);
    loadZoneManagers();
    loadPartnersKPI();
    loadPilotLeads();
}

async function loadPartnersKPI() {
    try {
        const [mgrsRes, campsRes, leadsRes] = await Promise.all([
            fetch(`${API}/sa/zone-managers`, { headers: { 'Authorization': saToken } }),
            fetch(`${API}/sa/campaigns/stats`, { headers: { 'Authorization': saToken } }).catch(() => null),
            fetch(`${API}/sa/leads/stats`, { headers: { 'Authorization': saToken } }).catch(() => null)
        ]);
        const mgrsData = await mgrsRes.json().catch(() => ({}));
        const managers = Array.isArray(mgrsData.managers) ? mgrsData.managers : [];
        const totalZM = managers.length;
        const activeZM = managers.filter(m => m.status === 'active').length;
        const communities = managers.reduce((sum, m) => sum + (parseInt(m.community_count) || 0), 0);
        const setKPI = (id, val) => { const el = getEl(id); if (el) el.textContent = val; };
        setKPI('sa-partners-kpi-total-zm', totalZM);
        setKPI('sa-partners-kpi-active-zm', activeZM);
        setKPI('sa-partners-kpi-communities', communities);
        if (campsRes) {
            const cd = await campsRes.json().catch(() => ({}));
            setKPI('sa-partners-kpi-campaigns', cd.active_campaigns ?? '--');
        }
        if (leadsRes) {
            const ld = await leadsRes.json().catch(() => ({}));
            setKPI('sa-partners-kpi-leads', ld.total_leads ?? '--');
        }
        // נתונים פיננסיים של מנהלי האזורים (עמלות + תשלומים)
        const finRes = await fetch(`${API}/sa/zone-managers/finance-summary`, { headers: { 'Authorization': saToken } }).catch(() => null);
        if (finRes) {
            const fd = await finRes.json().catch(() => ({}));
            if (fd.success) {
                const s = fd.summary;
                const fmt = v => '₪' + parseFloat(v || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                setKPI('sa-prt-fin-total-earned',  fmt(s.total_earned));
                setKPI('sa-prt-fin-total-paid',    fmt(s.total_paid));
                setKPI('sa-prt-fin-total-debt',    fmt(s.total_debt));
                setKPI('sa-prt-fin-month-earned',  fmt(s.month_earned));
                setKPI('sa-prt-fin-month-paid',    fmt(s.month_paid));
                setKPI('sa-prt-fin-month-debt',    fmt(s.month_debt));
                const paidPct = s.total_earned > 0 ? Math.min(100, Math.round(s.total_paid / s.total_earned * 100)) : 0;
                setKPI('sa-prt-fin-paid-pct', paidPct + '%');
                const bar = getEl('sa-prt-fin-paid-bar'); if (bar) bar.style.width = paidPct + '%';
            }
        }
    } catch(e) {}
}

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

// ── PILOT WAITLIST ──────────────────────────────────────────────────────
let _pilotLeadsCache = [];

async function loadPilotLeads() {
    try {
        const yishuv = getEl('pilot-filter-yishuv')?.value || '';
        const qs = yishuv ? `?yishuv=${encodeURIComponent(yishuv)}` : '';
        const res = await fetch(`${API}/sa/pilot-waitlist${qs}`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (!data.success) return;
        _pilotLeadsCache = data.leads || [];
        // KPI
        const s = data.stats || {};
        const setK = (id, v) => { const el = getEl(id); if (el) el.textContent = v ?? 0; };
        setK('pilot-kpi-new',       s.new       || 0);
        setK('pilot-kpi-contacted', s.contacted || 0);
        setK('pilot-kpi-joined',    s.joined    || 0);
        setK('pilot-kpi-declined',  s.declined  || 0);
        setK('sa-partners-kpi-leads', data.total || 0);
        renderPilotLeads();
    } catch(e) {}
}

function renderPilotLeads() {
    const tbody = getEl('pilot-leads-table-body');
    if (!tbody) return;
    const filterEl = getEl('pilot-filter-status');
    const filter = filterEl ? filterEl.value : '';
    const leads = filter ? _pilotLeadsCache.filter(l => l.status === filter) : _pilotLeadsCache;
    if (!leads.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">אין לידים${filter ? ' בסטטוס זה' : ''}.</td></tr>`;
        return;
    }
    const STATUS_MAP = {
        new:       { label: 'חדש',          bg: 'bg-amber-100',   text: 'text-amber-700' },
        contacted: { label: 'נוצר קשר',     bg: 'bg-blue-100',    text: 'text-blue-700'  },
        joined:    { label: 'הצטרף',        bg: 'bg-emerald-100', text: 'text-emerald-700'},
        declined:  { label: 'לא מעוניין',   bg: 'bg-slate-100',   text: 'text-slate-500' }
    };
    tbody.innerHTML = leads.map(l => {
        const st = STATUS_MAP[l.status] || STATUS_MAP.new;
        const date = new Date(l.created_at).toLocaleDateString('he-IL');
        return `
        <tr class="hover:bg-slate-50 transition" data-lead-id="${l.id}">
            <td class="px-4 py-3 font-bold text-slate-800">${safeStr(l.name)}</td>
            <td class="px-4 py-3 text-slate-600 dir-ltr font-mono text-sm">${safeStr(l.phone)}</td>
            <td class="px-4 py-3 text-slate-500 text-xs">${safeStr(l.email || '—')}</td>
            <td class="px-4 py-3 text-center text-xs font-bold text-indigo-700">${safeStr(l.yishuv || '—')}</td>
            <td class="px-4 py-3 text-center text-slate-500 text-xs">${date}</td>
            <td class="px-4 py-3 text-center">
                <select onchange="updatePilotLeadStatus(${l.id}, this.value)" class="text-xs font-bold border-0 rounded-lg px-2 py-1 cursor-pointer ${st.bg} ${st.text}">
                    <option value="new"       ${l.status==='new'?'selected':''}>חדש</option>
                    <option value="contacted" ${l.status==='contacted'?'selected':''}>נוצר קשר</option>
                    <option value="joined"    ${l.status==='joined'?'selected':''}>הצטרף</option>
                    <option value="declined"  ${l.status==='declined'?'selected':''}>לא מעוניין</option>
                </select>
            </td>
            <td class="px-4 py-3">
                <input type="text" value="${safeStr(l.notes || '')}" placeholder="הוסף הערה..." onblur="updatePilotLeadNotes(${l.id}, this.value)"
                    class="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:border-indigo-400 focus:outline-none">
            </td>
            <td class="px-4 py-3 text-center">
                <button onclick="deletePilotLead(${l.id})" class="text-red-400 hover:text-red-600 bg-red-50 w-7 h-7 rounded-lg shadow-sm transition inline-flex items-center justify-center" title="מחק ליד">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

async function updatePilotLeadStatus(id, status) {
    try {
        await fetch(`${API}/sa/pilot-waitlist/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ status })
        });
        const lead = _pilotLeadsCache.find(l => l.id === id);
        if (lead) lead.status = status;
        loadPilotLeads();
    } catch(e) {}
}

async function updatePilotLeadNotes(id, notes) {
    try {
        await fetch(`${API}/sa/pilot-waitlist/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ notes })
        });
        const lead = _pilotLeadsCache.find(l => l.id === id);
        if (lead) lead.notes = notes;
    } catch(e) {}
}

async function deletePilotLead(id) {
    if (!confirm('למחוק ליד זה לצמיתות?')) return;
    try {
        await fetch(`${API}/sa/pilot-waitlist/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': saToken }
        });
        _pilotLeadsCache = _pilotLeadsCache.filter(l => l.id !== id);
        loadPilotLeads();
    } catch(e) {}
}
// ────────────────────────────────────────────────────────────────────────

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

// ── Zone Manager Management ──────────────────────────────────────────

let zmCache = [];
let zmSettingsCache = {};

async function loadZoneManagers() {
    const tbody = getEl('sa-zone-managers-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400"><i class="fa-solid fa-spinner animate-spin mr-2"></i>טוען...</td></tr>';
    try {
        const [mgrsRes, settRes, pendRes] = await Promise.all([
            fetch(`${API}/sa/zone-managers`, { headers: { 'Authorization': saToken } }),
            fetch(`${API}/sa/zone-settings`, { headers: { 'Authorization': saToken } }),
            fetch(`${API}/sa/zone-managers/pending`, { headers: { 'Authorization': saToken } })
        ]);
        const mgrsData = await mgrsRes.json();
        const settData = await settRes.json();
        const pendData = await pendRes.json();
        if (mgrsData.success) { zmCache = mgrsData.managers || []; renderZMTable(); }
        if (settData.success) {
            zmSettingsCache = settData.settings || {};
            if (getEl('zm-setting-min-families')) getEl('zm-setting-min-families').value = zmSettingsCache.community_min_families || 30;
            if (getEl('zm-setting-min-businesses')) getEl('zm-setting-min-businesses').value = zmSettingsCache.community_min_businesses || 15;
            if (getEl('zm-setting-commission-pct')) getEl('zm-setting-commission-pct').value = zmSettingsCache.zone_manager_commission_pct || 5;
        }
        if (pendData.success) renderZMPending(pendData.pending || []);
    } catch(e) { console.error('loadZoneManagers', e); }
}

function renderZMPending(pending) {
    let container = getEl('zm-pending-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'zm-pending-container';
        const tbody = getEl('sa-zone-managers-table-body');
        if (tbody) tbody.closest('.bg-white').insertAdjacentElement('beforebegin', container);
    }
    if (!pending.length) { container.innerHTML = ''; return; }
    container.className = 'bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4';
    container.innerHTML = `
        <h4 class="font-bold text-amber-800 mb-3 text-right"><i class="fa-solid fa-user-clock text-amber-500 mr-1"></i> בקשות הצטרפות ממתינות (${pending.length})</h4>
        <div class="space-y-2">${pending.map(p => `
            <div class="flex justify-between items-center bg-white rounded-xl px-4 py-3 border border-amber-100">
                <div class="flex gap-2">
                    <button onclick="approveZMRegistration(${p.id})" class="bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-600 transition">אשר</button>
                    <button onclick="rejectZMRegistration(${p.id})" class="bg-red-100 text-red-600 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-red-200 transition">דחה</button>
                </div>
                <div class="text-right">
                    <span class="font-bold text-slate-800 text-sm">${safeStr(p.name)}</span>
                    <span class="text-slate-400 text-xs mr-2 dir-ltr">${safeStr(p.email)}</span>
                    ${p.phone ? `<span class="text-slate-400 text-xs mr-2">${safeStr(p.phone)}</span>` : ''}
                    <div class="text-[10px] text-slate-400 mt-0.5">${new Date(p.created_at).toLocaleDateString('he-IL')}</div>
                </div>
            </div>`).join('')}
        </div>`;
}

async function approveZMRegistration(id) {
    try {
        const res = await fetch(`${API}/sa/zone-managers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ status: 'active' })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'מנהל האזור אושר בהצלחה!'); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function rejectZMRegistration(id) {
    if (!confirm('לדחות בקשה זו? המנהל יימחק מהמערכת.')) return;
    try {
        const res = await fetch(`${API}/sa/zone-managers/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) { showToast('success', 'הבקשה נדחתה'); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function renderZMTable() {
    const tbody = getEl('sa-zone-managers-table-body');
    if (!tbody) return;
    if (!zmCache.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">אין מנהלי אזורים רשומים עדיין.</td></tr>';
        return;
    }
    tbody.innerHTML = zmCache.map(m => {
        const isActive = m.status === 'active';
        const statusBadge = isActive
            ? '<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold">פעיל</span>'
            : '<span class="bg-red-100 text-red-600 px-2.5 py-1 rounded-full text-xs font-bold">מושהה</span>';
        return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-4 font-bold text-slate-800 text-right">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0"><i class="fa-solid fa-user-tie text-xs"></i></div>
                    <div>${safeStr(m.name)}<div class="text-[10px] text-slate-400 mt-0.5">${safeStr(m.phone || '')}</div></div>
                </div>
            </td>
            <td class="px-4 py-4 text-slate-600 dir-ltr font-mono text-sm">${safeStr(m.email)}</td>
            <td class="px-4 py-4 text-center"><span class="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full text-xs font-bold">${m.zone_count || 0}</span></td>
            <td class="px-4 py-4 text-center"><span class="bg-cyan-50 text-cyan-600 px-2 py-1 rounded-full text-xs font-bold">${m.community_count || 0}</span></td>
            <td class="px-4 py-4 text-center font-bold text-slate-700">${parseFloat(m.commission_pct || 5).toFixed(1)}%</td>
            <td class="px-4 py-4 text-center">${statusBadge}</td>
            <td class="px-4 py-4 text-center">
                <div class="flex gap-1 justify-center">
                    <button onclick="openZMDetailsModal(${m.id})" title="פרטים ואזורים" class="text-indigo-500 hover:text-indigo-700 bg-indigo-50 w-8 h-8 rounded-lg shadow-sm transition inline-flex items-center justify-center"><i class="fa-solid fa-eye text-xs"></i></button>
                    <button onclick="openZMPaymentModal(${m.id})" title="רישום תשלום" class="text-emerald-500 hover:text-emerald-700 bg-emerald-50 w-8 h-8 rounded-lg shadow-sm transition inline-flex items-center justify-center"><i class="fa-solid fa-hand-holding-dollar text-xs"></i></button>
                    <button onclick="openZMEditModal(${m.id})" title="עריכה" class="text-amber-500 hover:text-amber-700 bg-amber-50 w-8 h-8 rounded-lg shadow-sm transition inline-flex items-center justify-center"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="toggleZMStatus(${m.id}, '${m.status}')" title="${isActive ? 'השהה' : 'הפעל'}" class="${isActive ? 'text-orange-500 hover:text-orange-700 bg-orange-50' : 'text-emerald-500 hover:text-emerald-700 bg-emerald-50'} w-8 h-8 rounded-lg shadow-sm transition inline-flex items-center justify-center"><i class="fa-solid fa-${isActive ? 'pause' : 'play'} text-xs"></i></button>
                    <button onclick="deleteZoneManager(${m.id})" title="מחק" class="text-red-400 hover:text-red-600 bg-red-50 w-8 h-8 rounded-lg shadow-sm transition inline-flex items-center justify-center"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function openZMSettingsPanel() {
    const panel = getEl('zm-settings-panel');
    if (panel) panel.classList.toggle('hidden');
}

async function saveZoneSettings() {
    const minFamilies = parseInt(getEl('zm-setting-min-families')?.value || 30);
    const minBusinesses = parseInt(getEl('zm-setting-min-businesses')?.value || 15);
    const commPct = parseFloat(getEl('zm-setting-commission-pct')?.value || 5);
    try {
        const res = await fetch(`${API}/sa/zone-settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ community_min_families: minFamilies, community_min_businesses: minBusinesses, zone_manager_commission_pct: commPct })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'הגדרות האזורים נשמרו!'); getEl('zm-settings-panel').classList.add('hidden'); zmSettingsCache = { community_min_families: minFamilies, community_min_businesses: minBusinesses, zone_manager_commission_pct: commPct }; }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function openZMCreateModal() {
    let modal = getEl('zm-create-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'zm-create-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        const defComm = zmSettingsCache.zone_manager_commission_pct || 5;
        modal.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl relative">
                <button onclick="document.getElementById('zm-create-modal').classList.add('hidden')" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                <h3 class="text-xl font-bold mb-5 text-slate-800 text-right"><i class="fa-solid fa-user-plus text-indigo-500 mr-2"></i> הקמת מנהל אזור חדש</h3>
                <div class="space-y-3">
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">שם מלא:</label><input type="text" id="zm-create-name" class="modern-input" placeholder="ישראל ישראלי"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">אימייל:</label><input type="email" id="zm-create-email" class="modern-input dir-ltr text-left" placeholder="manager@example.com"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">סיסמה:</label><input type="text" id="zm-create-password" class="modern-input dir-ltr text-left" placeholder="סיסמה חזקה"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">טלפון (אופציונלי):</label><input type="tel" id="zm-create-phone" class="modern-input dir-ltr text-left" placeholder="0501234567"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">% עמלה (ברירת מחדל: ${defComm}%):</label><input type="number" id="zm-create-commission" class="modern-input" placeholder="${defComm}" step="0.1" min="0" max="100"></div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="document.getElementById('zm-create-modal').classList.add('hidden')" class="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition">ביטול</button>
                    <button onclick="saveNewZoneManager()" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition">צור מנהל אזור</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    } else {
        modal.classList.remove('hidden');
        ['zm-create-name','zm-create-email','zm-create-password','zm-create-phone','zm-create-commission'].forEach(id => { const el = getEl(id); if(el) el.value = ''; });
    }
}

async function saveNewZoneManager() {
    const name = val('zm-create-name'), email = val('zm-create-email'), password = val('zm-create-password');
    const phone = val('zm-create-phone');
    const commissionPct = parseFloat(val('zm-create-commission') || zmSettingsCache.zone_manager_commission_pct || 5);
    if (!name || !email || !password) return showToast('error', 'שם, אימייל וסיסמה הם שדות חובה');
    try {
        const res = await fetch(`${API}/sa/zone-managers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ name, email, password, phone, commission_pct: commissionPct })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'מנהל אזור חדש הוקם!'); document.getElementById('zm-create-modal').classList.add('hidden'); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה ביצירה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function openZMEditModal(id) {
    const m = zmCache.find(x => x.id === id);
    if (!m) return;
    let modal = getEl('zm-edit-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'zm-edit-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl relative">
                <button onclick="document.getElementById('zm-edit-modal').classList.add('hidden')" class="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                <h3 class="text-xl font-bold mb-5 text-slate-800 text-right"><i class="fa-solid fa-pen text-amber-500 mr-2"></i> עריכת מנהל אזור</h3>
                <input type="hidden" id="zm-edit-id">
                <div class="space-y-3">
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">שם מלא:</label><input type="text" id="zm-edit-name" class="modern-input"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">טלפון:</label><input type="tel" id="zm-edit-phone" class="modern-input dir-ltr text-left"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">% עמלה:</label><input type="number" id="zm-edit-commission" class="modern-input" step="0.1" min="0" max="100"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">סיסמה חדשה (ריק = ללא שינוי):</label><input type="text" id="zm-edit-password" class="modern-input dir-ltr text-left" placeholder="השאר ריק לאי-שינוי"></div>
                </div>
                <div class="flex gap-3 mt-5">
                    <button onclick="document.getElementById('zm-edit-modal').classList.add('hidden')" class="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition">ביטול</button>
                    <button onclick="saveEditZoneManager()" class="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold shadow-md hover:bg-amber-600 transition">שמור שינויים</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    } else modal.classList.remove('hidden');
    getEl('zm-edit-id').value = m.id;
    getEl('zm-edit-name').value = m.name || '';
    getEl('zm-edit-phone').value = m.phone || '';
    getEl('zm-edit-commission').value = m.commission_pct || 5;
    getEl('zm-edit-password').value = '';
}

async function saveEditZoneManager() {
    const id = parseInt(val('zm-edit-id'));
    const name = val('zm-edit-name'), phone = val('zm-edit-phone');
    const commissionPct = parseFloat(val('zm-edit-commission') || 5);
    const password = val('zm-edit-password');
    if (!name) return showToast('error', 'שם הוא שדה חובה');
    try {
        const body = { name, phone, commission_pct: commissionPct };
        if (password) body.password = password;
        const res = await fetch(`${API}/sa/zone-managers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'פרטי מנהל האזור עודכנו!'); document.getElementById('zm-edit-modal').classList.add('hidden'); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function toggleZMStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
        const res = await fetch(`${API}/sa/zone-managers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) { showToast('success', newStatus === 'active' ? 'מנהל האזור הופעל!' : 'מנהל האזור הושהה!'); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function deleteZoneManager(id) {
    if (!confirm('למחוק את מנהל האזור? פעולה זו תסיר את כל האזורים שלו.')) return;
    try {
        const res = await fetch(`${API}/sa/zone-managers/${id}`, { method: 'DELETE', headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) { showToast('success', 'מנהל האזור נמחק'); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function openZMDetailsModal(id) {
    let modal = getEl('zm-details-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'zm-details-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl relative flex flex-col" style="max-height:90vh">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                    <button onclick="document.getElementById('zm-details-modal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                    <h3 class="text-xl font-bold text-slate-800 text-right" id="zm-details-title"><i class="fa-solid fa-map-location-dot text-indigo-500 mr-2"></i> פרטי מנהל אזור</h3>
                </div>
                <div class="overflow-y-auto modal-scroll p-6 space-y-5 flex-1" id="zm-details-body">
                    <div class="text-center py-8 text-slate-400">טוען...</div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    } else modal.classList.remove('hidden');
    getEl('zm-details-body').innerHTML = '<div class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner animate-spin mr-2"></i>טוען...</div>';
    try {
        const [detRes, paymRes] = await Promise.all([
            fetch(`${API}/sa/zone-managers/${id}/details`, { headers: { 'Authorization': saToken } }),
            fetch(`${API}/sa/zone-manager-payments/${id}`, { headers: { 'Authorization': saToken } })
        ]);
        const data = await detRes.json();
        const paymData = await paymRes.json();
        if (!data.success) { getEl('zm-details-body').innerHTML = '<div class="text-center py-8 text-red-400">שגיאה בטעינה</div>'; return; }
        data.payments = paymData.success ? (paymData.payments || []) : [];
        const m = data.manager, zones = data.zones || [], commissions = data.commissions || [];
        const totalEarned = commissions.reduce((s, c) => s + parseFloat(c.amount || 0), 0);
        const allCommunities = data.communities || [];
        const totalPaid = (data.payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const paidPct = totalEarned > 0 ? Math.min(100, Math.round(totalPaid / totalEarned * 100)) : 0;
        getEl('zm-details-title').innerHTML = `<i class="fa-solid fa-user-tie text-indigo-500 mr-2"></i> ${safeStr(m.name)}`;
        modal._managerId = id;
        modal._detailsData = data;

        const zonesHtml = zones.length ? zones.map(z => {
            const commsInZone = allCommunities.filter(c => String(c.zone_id) === String(z.id));
            return `
            <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-3">
                <div class="flex justify-between items-center mb-2">
                    <button onclick="openCommunityPickerModal(${z.id})" class="text-xs bg-indigo-500 text-white px-3 py-1 rounded-full font-bold hover:bg-indigo-600 transition"><i class="fa-solid fa-plus mr-1"></i>שייך קהילה</button>
                    <h4 class="font-bold text-indigo-800 text-sm"><i class="fa-solid fa-map-pin mr-1"></i>${safeStr(z.name)}</h4>
                </div>
                <div class="space-y-1">${commsInZone.length
                    ? commsInZone.map(c => `
                        <div class="flex justify-between items-center bg-white rounded-xl px-3 py-2 text-xs">
                            <div class="flex gap-1">
                                <button onclick="removeCommunityFromZone(${c.id})" title="הסר" class="text-red-400 hover:text-red-600 w-6 h-6 flex items-center justify-center"><i class="fa-solid fa-times"></i></button>
                                <button onclick="openTransferCommunityModal(${c.id}, '${safeStr(c.name)}')" title="העבר למנהל אחר" class="text-blue-400 hover:text-blue-600 w-6 h-6 flex items-center justify-center"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
                            </div>
                            <span class="text-slate-700 font-bold">${safeStr(c.name)} <span class="text-slate-400">${safeStr(c.city||'')}</span></span>
                        </div>`).join('')
                    : '<p class="text-xs text-indigo-400 text-center py-2">אין קהילות באזור זה</p>'
                }</div>
            </div>`;
        }).join('') : '<p class="text-slate-400 text-sm text-center py-4">אין אזורים — הוסף אזור ראשון</p>';

        getEl('zm-details-body').innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                    <div class="text-2xl font-black text-indigo-700">${zones.length}</div>
                    <div class="text-xs text-indigo-500 font-bold mt-1">אזורים</div>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                    <div class="text-2xl font-black text-cyan-700">${allCommunities.length}</div>
                    <div class="text-xs text-cyan-500 font-bold mt-1">קהילות</div>
                </div>
                <div class="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                    <div class="text-xl font-black text-amber-700">₪${totalEarned.toFixed(2)}</div>
                    <div class="text-xs text-amber-500 font-bold mt-1">עמלות שנצברו</div>
                </div>
                <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                    <div class="text-xl font-black text-emerald-700">₪${totalPaid.toFixed(2)}</div>
                    <div class="text-xs text-emerald-500 font-bold mt-1">שולם</div>
                    <div class="w-full bg-emerald-100 rounded-full h-1.5 mt-1"><div class="bg-emerald-500 h-1.5 rounded-full" style="width:${paidPct}%"></div></div>
                    <div class="text-[9px] text-emerald-400 mt-0.5">${paidPct}%</div>
                </div>
            </div>
            <div class="flex justify-between items-center mb-3">
                <div class="flex gap-2">
                    <button onclick="addZoneToManagerUI(${m.id})" class="text-sm bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-600 transition"><i class="fa-solid fa-plus mr-1"></i>הוסף אזור</button>
                    <button onclick="openZMPaymentModal(${m.id})" class="text-sm bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-600 transition"><i class="fa-solid fa-hand-holding-dollar mr-1"></i>רשום תשלום</button>
                </div>
                <h4 class="font-bold text-slate-700"><i class="fa-solid fa-map text-indigo-400 mr-1"></i>אזורים וקהילות</h4>
            </div>
            ${zonesHtml}
            <div class="mt-5">
                <h4 class="font-bold text-slate-700 mb-2 text-sm text-right"><i class="fa-solid fa-coins text-amber-400 mr-1"></i>עמלות אחרונות (${commissions.length})</h4>
                ${commissions.slice(0,10).length
                    ? `<div class="space-y-1">${commissions.slice(0,10).map(c => `
                        <div class="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2">
                            <span class="text-xs text-slate-400">${new Date(c.created_at).toLocaleDateString('he-IL')}</span>
                            <span class="text-xs text-slate-500 truncate mx-2 flex-1 text-center">${safeStr(c.description||'')}</span>
                            <span class="font-bold text-amber-700 text-sm">₪${parseFloat(c.amount).toFixed(2)}</span>
                        </div>`).join('')}</div>`
                    : '<p class="text-xs text-slate-400 text-center py-4">אין עמלות עדיין</p>'
                }
            </div>
            <div class="mt-4">
                <h4 class="font-bold text-slate-700 mb-2 text-sm text-right"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i>היסטוריית תשלומים (${(data.payments||[]).length})</h4>
                ${(data.payments||[]).slice(0,10).length
                    ? `<div class="space-y-1">${(data.payments||[]).slice(0,10).map(p => `
                        <div class="flex justify-between items-center bg-emerald-50 rounded-xl px-3 py-2">
                            <span class="text-xs text-slate-400">${new Date(p.paid_at).toLocaleDateString('he-IL')}</span>
                            <span class="text-xs text-slate-500 truncate mx-2 flex-1 text-center">${safeStr(p.payment_method||'')}${p.notes ? ' · ' + safeStr(p.notes) : ''}</span>
                            <span class="font-bold text-emerald-700 text-sm">₪${parseFloat(p.amount).toFixed(2)}</span>
                        </div>`).join('')}</div>`
                    : '<p class="text-xs text-slate-400 text-center py-4">אין תשלומים מתועדים</p>'
                }
            </div>`;
    } catch(e) { console.error(e); getEl('zm-details-body').innerHTML = '<div class="text-center py-8 text-red-400">שגיאה בטעינה</div>'; }
}

async function addZoneToManagerUI(managerId) {
    const zoneName = prompt('שם האזור החדש:');
    if (!zoneName || !zoneName.trim()) return;
    try {
        const res = await fetch(`${API}/sa/zone-managers/${managerId}/zones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ name: zoneName.trim() })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'האזור נוסף!'); openZMDetailsModal(managerId); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function openCommunityPickerModal(zoneId) {
    const modal = getEl('zm-details-modal');
    const managerId = modal?._managerId;
    const detailsData = modal?._detailsData;
    const assignedIds = (detailsData?.communities || []).map(c => c.id);
    const available = saCommunitiesCache.filter(c => !assignedIds.includes(c.id));

    let picker = getEl('zm-comm-picker-modal');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'zm-comm-picker-modal';
        picker.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4';
        picker.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative flex flex-col" style="max-height:80vh">
                <div class="p-5 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                    <button onclick="document.getElementById('zm-comm-picker-modal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
                    <h4 class="font-bold text-slate-800">בחר קהילה לשיוך</h4>
                </div>
                <div class="p-3 flex-shrink-0">
                    <input type="text" id="zm-comm-picker-search" class="modern-input text-sm" placeholder="חיפוש לפי שם, עיר..." oninput="filterCommunityPicker()">
                </div>
                <div id="zm-comm-picker-list" class="overflow-y-auto flex-1 p-3 space-y-1"></div>
            </div>`;
        document.body.appendChild(picker);
    }
    picker.classList.remove('hidden');
    picker._zoneId = zoneId;
    picker._managerId = managerId;
    picker._available = available;
    getEl('zm-comm-picker-search').value = '';
    renderCommunityPickerList(available, zoneId, managerId);
}

function filterCommunityPicker() {
    const picker = getEl('zm-comm-picker-modal');
    const q = getEl('zm-comm-picker-search').value.toLowerCase();
    const filtered = (picker._available || []).filter(c =>
        c.name.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q)
    );
    renderCommunityPickerList(filtered, picker._zoneId, picker._managerId);
}

function renderCommunityPickerList(list, zoneId, managerId) {
    const el = getEl('zm-comm-picker-list');
    if (!list.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">לא נמצאו קהילות</p>'; return; }
    el.innerHTML = list.map(c => `
        <button onclick="assignCommunityToZone(${c.id}, ${zoneId}, ${managerId})"
            class="w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition">
            <span class="text-xs text-slate-400">${safeStr(c.city||'')}</span>
            <span class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</span>
        </button>`).join('');
}

async function assignCommunityToZone(communityId, zoneId, managerId) {
    document.getElementById('zm-comm-picker-modal').classList.add('hidden');
    try {
        const res = await fetch(`${API}/sa/communities/${communityId}/assign-zone`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ zone_id: zoneId })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'הקהילה שויכה לאזור!'); if (managerId) openZMDetailsModal(managerId); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function openTransferCommunityModal(communityId, communityName) {
    const modal = getEl('zm-details-modal');
    const managerId = modal?._managerId;
    try {
        const res = await fetch(`${API}/sa/all-zones`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (!data.success) { showToast('error', 'שגיאה בטעינת אזורים'); return; }
        const zones = (data.zones || []).filter(z => z.manager_id != managerId);

        let transferModal = getEl('zm-transfer-modal');
        if (!transferModal) {
            transferModal = document.createElement('div');
            transferModal.id = 'zm-transfer-modal';
            transferModal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4';
            document.body.appendChild(transferModal);
        }
        transferModal._allZones = zones;
        transferModal._communityId = communityId;
        transferModal._managerId = managerId;
        transferModal.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative flex flex-col" style="max-height:80vh">
                <div class="p-5 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                    <button onclick="document.getElementById('zm-transfer-modal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
                    <div class="text-right">
                        <h4 class="font-bold text-slate-800">העברת קהילה</h4>
                        <p class="text-xs text-slate-500">קהילה: <strong>${safeStr(communityName)}</strong></p>
                    </div>
                </div>
                <div class="p-3 flex-shrink-0">
                    <input type="text" id="zm-transfer-search" class="modern-input text-sm" placeholder="חיפוש לפי שם מנהל או שם אזור..." oninput="filterTransferZones()">
                </div>
                <div id="zm-transfer-list" class="overflow-y-auto flex-1 p-3 space-y-1"></div>
            </div>`;
        renderTransferZones(zones, communityId, managerId);
        transferModal.classList.remove('hidden');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function filterTransferZones() {
    const modal = getEl('zm-transfer-modal');
    const q = getEl('zm-transfer-search').value.toLowerCase();
    const filtered = (modal._allZones || []).filter(z =>
        z.name.toLowerCase().includes(q) || z.manager_name.toLowerCase().includes(q)
    );
    renderTransferZones(filtered, modal._communityId, modal._managerId);
}

function renderTransferZones(zones, communityId, managerId) {
    const el = getEl('zm-transfer-list');
    if (!zones.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">לא נמצאו אזורים</p>'; return; }
    el.innerHTML = zones.map(z => `
        <button onclick="transferCommunityToZone(${communityId}, ${z.id}, ${managerId})"
            class="w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-blue-50 border border-slate-100 hover:border-blue-200 transition">
            <span class="text-xs text-slate-400 font-bold">${safeStr(z.manager_name)}</span>
            <span class="font-bold text-slate-800 text-sm"><i class="fa-solid fa-map-pin text-blue-400 ml-1"></i>${safeStr(z.name)}</span>
        </button>`).join('');
}

async function transferCommunityToZone(communityId, zoneId, managerId) {
    document.getElementById('zm-transfer-modal').classList.add('hidden');
    try {
        const res = await fetch(`${API}/sa/communities/${communityId}/assign-zone`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ zone_id: zoneId })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'הקהילה הועברה בהצלחה!'); if (managerId) openZMDetailsModal(managerId); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function openZMPaymentModal(managerId) {
    const mgr = zmCache.find(m => m.id === managerId) || { id: managerId, name: 'מנהל אזור' };
    let modal = getEl('zm-payment-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'zm-payment-modal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative flex flex-col" style="max-height:90vh">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                    <button onclick="document.getElementById('zm-payment-modal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
                    <h4 class="font-bold text-slate-800 text-right" id="zm-payment-modal-title">רישום תשלום עמלה</h4>
                </div>
                <div class="overflow-y-auto flex-1 p-6 space-y-4">
                    <input type="hidden" id="zm-payment-manager-id">
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">סכום (₪):</label><input type="number" id="zm-payment-amount" class="modern-input" placeholder="0.00" step="0.01" min="0.01"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">אמצעי תשלום:</label>
                        <select id="zm-payment-method" class="modern-input">
                            <option value="">בחר אמצעי תשלום</option>
                            <option value="העברה בנקאית">העברה בנקאית</option>
                            <option value="מזומן">מזומן</option>
                            <option value="ביט">ביט</option>
                            <option value="פייבוקס">פייבוקס</option>
                            <option value="צ'ק">צ'ק</option>
                        </select>
                    </div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">תאריך תשלום:</label><input type="date" id="zm-payment-date" class="modern-input"></div>
                    <div><label class="text-xs font-bold text-slate-500 block mb-1">הערות:</label><input type="text" id="zm-payment-notes" class="modern-input" placeholder="הערות נוספות"></div>
                    <div class="flex gap-3 pt-2">
                        <button onclick="document.getElementById('zm-payment-modal').classList.add('hidden')" class="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition">ביטול</button>
                        <button onclick="saveZMPayment()" class="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition">שמור תשלום</button>
                    </div>
                    <div id="zm-payment-history" class="pt-3 border-t border-slate-100"></div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal._managerId = managerId;
    getEl('zm-payment-manager-id').value = managerId;
    getEl('zm-payment-modal-title').textContent = `תשלום עמלה — ${safeStr(mgr.name)}`;
    getEl('zm-payment-amount').value = '';
    getEl('zm-payment-method').value = '';
    getEl('zm-payment-date').value = new Date().toISOString().split('T')[0];
    getEl('zm-payment-notes').value = '';
    loadZMPaymentHistory(managerId);
}

async function loadZMPaymentHistory(managerId) {
    const el = getEl('zm-payment-history');
    if (!el) return;
    el.innerHTML = '<div class="text-xs text-slate-400 text-center py-2">טוען היסטוריה...</div>';
    try {
        const res = await fetch(`${API}/sa/zone-manager-payments/${managerId}`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (!data.success || !data.payments.length) { el.innerHTML = '<div class="text-xs text-slate-400 text-center py-2">אין תשלומים מתועדים</div>'; return; }
        el.innerHTML = `<h5 class="font-bold text-slate-700 text-xs mb-2 text-right">היסטוריית תשלומים</h5>
            <div class="space-y-1">${data.payments.map(p => `
                <div class="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2 text-xs">
                    <span class="text-slate-400">${new Date(p.paid_at).toLocaleDateString('he-IL')}</span>
                    <span class="text-slate-500 truncate mx-2">${safeStr(p.payment_method||'')}${p.notes ? ' · ' + safeStr(p.notes) : ''}</span>
                    <span class="font-bold text-emerald-700">₪${parseFloat(p.amount).toFixed(2)}</span>
                </div>`).join('')}</div>`;
    } catch(e) {}
}

async function saveZMPayment() {
    const managerId = parseInt(val('zm-payment-manager-id'));
    const amount = parseFloat(val('zm-payment-amount'));
    const method = val('zm-payment-method');
    const date = val('zm-payment-date');
    const notes = val('zm-payment-notes');
    if (!amount || amount <= 0) return showToast('error', 'יש להזין סכום תקין');
    try {
        const res = await fetch(`${API}/sa/zone-manager-payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ manager_id: managerId, amount, payment_method: method, notes, paid_at: date ? new Date(date).toISOString() : null })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'התשלום נרשם בהצלחה!');
            loadZMPaymentHistory(managerId);
            loadZoneManagers();
            getEl('zm-payment-amount').value = '';
            getEl('zm-payment-notes').value = '';
        } else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

async function removeCommunityFromZone(communityId) {
    if (!confirm('להסיר קהילה זו מהאזור?')) return;
    const modal = getEl('zm-details-modal');
    const managerId = modal?._managerId;
    try {
        const res = await fetch(`${API}/sa/communities/${communityId}/assign-zone`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ zone_id: null })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'הקהילה הוסרה מהאזור'); if (managerId) openZMDetailsModal(managerId); loadZoneManagers(); }
        else showToast('error', data.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
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
let productMatrixPage = 1;
const MATRIX_PAGE_SIZE = 15;

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

    const envNames = { 'family': 'משפחות', 'business': 'עסקים', 'community': 'קהילות', 'sa': 'ניהול', 'book': 'ספר QA' };

    let totalTests = 0, passedCount = 0, failedCount = 0, untestedCount = 0;
    productMatrixData.forEach(item => {
        totalTests++;
        if (item.status === 'passed') passedCount++;
        else if (item.status === 'failed') failedCount++;
        else untestedCount++;
    });

    if (productMatrixData.length === 0) {
        listEl.innerHTML = `<div class="text-center py-12">
            <i class="fa-solid fa-clipboard-list text-4xl text-slate-300 mb-3"></i>
            <p class="text-slate-500 font-bold">ספר המוצר ריק</p>
            <p class="text-slate-400 text-xs mt-1">הוסף פריטים דרך ספר ה-QA</p>
        </div>`;
    } else {
        const sorted = [...productMatrixData].sort((a, b) => (b.id || 0) - (a.id || 0));
        const totalPages = Math.ceil(sorted.length / MATRIX_PAGE_SIZE);
        productMatrixPage = Math.min(productMatrixPage, totalPages);
        const pageItems = sorted.slice((productMatrixPage - 1) * MATRIX_PAGE_SIZE, productMatrixPage * MATRIX_PAGE_SIZE);
        listEl.innerHTML = `
            <table class="w-full text-sm text-right whitespace-nowrap">
                <thead class="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase">
                    <tr>
                        <th class="px-4 py-3 rounded-tr-lg">יכולת / תרחיש</th>
                        <th class="px-4 py-3">מודול</th>
                        <th class="px-4 py-3">סביבה</th>
                        <th class="px-4 py-3 max-w-xs">שימוש / תוצאה צפויה</th>
                        <th class="px-4 py-3 text-center rounded-tl-lg">סטטוס</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${pageItems.map(item => {
                        let statusBg = 'bg-slate-100 text-slate-500', statusIcon = 'fa-circle-minus', statusLabel = 'טרם';
                        if (item.status === 'passed')  { statusBg = 'bg-green-100 text-green-700';  statusIcon = 'fa-check';          statusLabel = 'אושר'; }
                        if (item.status === 'failed')  { statusBg = 'bg-red-100 text-red-700';      statusIcon = 'fa-bug';            statusLabel = 'באג'; }
                        if (item.status === 'in_dev')  { statusBg = 'bg-blue-100 text-blue-700';    statusIcon = 'fa-person-digging'; statusLabel = 'בפיתוח'; }
                        const expected = (item.expected_result || '').slice(0, 60) + ((item.expected_result || '').length > 60 ? '…' : '');
                        return `<tr class="hover:bg-slate-50 transition">
                            <td class="px-4 py-3 font-bold text-slate-700">${safeStr(item.scenario_name)}</td>
                            <td class="px-4 py-3 text-slate-500 text-xs">${safeStr(item.module_name)}</td>
                            <td class="px-4 py-3 text-slate-500 text-xs">${envNames[item.environment] || item.environment || ''}</td>
                            <td class="px-4 py-3 text-slate-400 text-xs max-w-xs" title="${safeStr(item.expected_result)}">${safeStr(expected)}</td>
                            <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-md text-[10px] font-bold ${statusBg} inline-flex items-center gap-1"><i class="fa-solid ${statusIcon}"></i>${statusLabel}</span></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            ${totalPages > 1 ? `<div id="matrix-pagination" class="flex items-center justify-center gap-2 px-5 py-3 border-t border-slate-100">
                <button onclick="matrixGoToPage(${productMatrixPage - 1})" ${productMatrixPage <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">&#8594; הקודם</button>
                <span class="text-xs text-slate-500 font-bold">עמוד ${productMatrixPage} מתוך ${totalPages}</span>
                <button onclick="matrixGoToPage(${productMatrixPage + 1})" ${productMatrixPage >= totalPages ? 'disabled' : ''} class="px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">הבא &#8592;</button>
            </div>` : ''}`;
    }

    const progressPct = totalTests === 0 ? 0 : Math.round((passedCount / totalTests) * 100);
    if (getEl('matrix-progress-bar')) getEl('matrix-progress-bar').style.width = `${progressPct}%`;
    if (getEl('matrix-progress-text')) getEl('matrix-progress-text').innerText = `${progressPct}% אושרו`;
    if (getEl('matrix-count-passed')) getEl('matrix-count-passed').innerText = passedCount;
    if (getEl('matrix-count-failed')) getEl('matrix-count-failed').innerText = failedCount;
    if (getEl('matrix-count-untested')) getEl('matrix-count-untested').innerText = untestedCount;
};

window.matrixGoToPage = function(page) {
    productMatrixPage = page;
    renderProductMatrix();
};

window.searchProductFeature = function(query) {
    const resultsEl = getEl('matrix-search-results');
    if (!resultsEl) return;
    if (!query.trim()) { resultsEl.classList.add('hidden'); resultsEl.innerHTML = ''; return; }

    const q = query.toLowerCase();
    const envNames = { 'family': 'משפחות', 'business': 'עסקים', 'community': 'קהילות', 'sa': 'ניהול', 'book': 'ספר QA' };
    const results = productMatrixData.filter(item =>
        (item.scenario_name || '').toLowerCase().includes(q) ||
        (item.module_name || '').toLowerCase().includes(q) ||
        (item.expected_result || '').toLowerCase().includes(q)
    );

    if (results.length === 0) {
        resultsEl.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">לא נמצאו יכולות תואמות</p>';
    } else {
        resultsEl.innerHTML = results.slice(0, 20).map(item => {
            let badge = 'bg-slate-100 text-slate-500', icon = 'fa-circle-minus', label = 'טרם';
            if (item.status === 'passed') { badge = 'bg-green-100 text-green-700'; icon = 'fa-check'; label = 'אושר'; }
            if (item.status === 'failed') { badge = 'bg-red-100 text-red-700'; icon = 'fa-bug'; label = 'באג'; }
            if (item.status === 'in_dev') { badge = 'bg-blue-100 text-blue-700'; icon = 'fa-person-digging'; label = 'בפיתוח'; }
            return `<div class="bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 transition">
                <div class="flex justify-between items-start gap-2 mb-1.5">
                    <span class="font-bold text-slate-700 text-sm leading-snug">${safeStr(item.scenario_name)}</span>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">${envNames[item.environment] || ''} › ${safeStr(item.module_name)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${badge} inline-flex items-center gap-1"><i class="fa-solid ${icon}"></i>${label}</span>
                    </div>
                </div>
                ${item.expected_result ? `<p class="text-xs text-slate-500 leading-relaxed"><i class="fa-solid fa-circle-info text-indigo-400 ml-1"></i>${safeStr(item.expected_result)}</p>` : ''}
            </div>`;
        }).join('');
    }
    resultsEl.classList.remove('hidden');
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
            
            ${task.original_ticket_id ? `
            <div class="mt-2 mb-1 flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1.5">
                <i class="fa-solid fa-ticket text-indigo-400 text-[9px]"></i>
                <span class="text-[10px] font-bold text-indigo-600 flex-1">קריאת שירות #${task.original_ticket_id}</span>
                <button onclick="event.stopPropagation(); window.openTicketFromTask(${task.original_ticket_id})" class="text-[9px] text-indigo-500 hover:text-indigo-700 font-bold bg-white border border-indigo-200 px-1.5 py-0.5 rounded transition"><i class="fa-solid fa-arrow-up-right-from-square"></i> פתח</button>
            </div>` : ''}
            <div class="flex justify-between items-end mt-auto">
                <span class="text-[9px] text-slate-400 font-mono">#${task.id}</span>
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
window.searchNewTicketGroup = function(query) {
    const resultsEl = getEl('new-ticket-group-results');
    if (!query.trim()) { resultsEl.classList.add('hidden'); return; }
    const q = query.toLowerCase();
    const matches = (saAllGroups || []).filter(g =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.admin_email || '').toLowerCase().includes(q) ||
        (g.group_code || '').toLowerCase().includes(q) ||
        String(g.id).includes(q)
    ).slice(0, 8);
    if (!matches.length) { resultsEl.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">לא נמצאו תוצאות</p>'; resultsEl.classList.remove('hidden'); return; }
    resultsEl.innerHTML = matches.map(g =>
        `<div onclick="selectNewTicketGroup(${g.id}, '${safeStr(fmtGroupName(g)).replace(/'/g,"\\'")}', '${(g.admin_email||'').replace(/'/g,"\\'")}', '${(g.group_code||'').replace(/'/g,"\\'")}'); return false;"
              class="px-3 py-2 text-xs cursor-pointer hover:bg-indigo-50 border-b border-slate-100 last:border-0">
            <span class="font-bold text-indigo-600">${safeStr(fmtGroupName(g))}</span>
            <span class="text-slate-400 mr-1 text-[10px]">קוד: ${g.group_code || '—'} | ${g.admin_email || ''}</span>
        </div>`
    ).join('');
    resultsEl.classList.remove('hidden');
};

window.selectNewTicketGroup = function(id, name, email, code) {
    getEl('new-ticket-group').value = id;
    getEl('new-ticket-group-search').value = '';
    getEl('new-ticket-group-results').classList.add('hidden');
    getEl('new-ticket-group-label').textContent = `${name} (${email || code})`;
    getEl('new-ticket-group-selected').classList.remove('hidden');
};

window.clearNewTicketGroup = function() {
    getEl('new-ticket-group').value = '';
    getEl('new-ticket-group-search').value = '';
    getEl('new-ticket-group-results').classList.add('hidden');
    getEl('new-ticket-group-selected').classList.add('hidden');
};

window.filterNewTicketGroups = window.searchNewTicketGroup;

window.openNewTicketModal = function() {
    getEl('new-ticket-subject').value = '';
    getEl('new-ticket-desc').value = '';
    getEl('new-ticket-group-search').value = '';
    getEl('new-ticket-group').value = '';
    getEl('new-ticket-group-results').classList.add('hidden');
    getEl('new-ticket-group-selected').classList.add('hidden');
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

    getEl('kanban-ticket-search').value = '';
    getEl('kanban-ticket-search-results').classList.add('hidden');
    getEl('kanban-ticket-linked').classList.add('hidden');

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
        if (task.original_ticket_id) {
            const t = saTicketsCache.find(x => x.id === parseInt(task.original_ticket_id));
            const label = t ? `קריאה #${t.id} — ${t.subject || ''}` : `קריאה #${task.original_ticket_id}`;
            getEl('kanban-ticket-linked-label').textContent = label;
            getEl('kanban-ticket-linked').classList.remove('hidden');
        }
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

window.searchKanbanTicket = function(query) {
    const resultsEl = getEl('kanban-ticket-search-results');
    if (!query.trim()) { resultsEl.classList.add('hidden'); return; }
    const q = query.toLowerCase();
    const matches = saTicketsCache.filter(t =>
        String(t.id).includes(q) ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.user_name || '').toLowerCase().includes(q)
    ).slice(0, 6);
    if (!matches.length) { resultsEl.classList.add('hidden'); return; }
    resultsEl.innerHTML = matches.map(t =>
        `<div onclick="window.selectKanbanTicket(${t.id}, '${(t.subject||'').replace(/'/g,"\\'")}', '${(t.user_name||'').replace(/'/g,"\\'")}'); return false;"
              class="px-3 py-2 text-xs cursor-pointer hover:bg-indigo-50 border-b border-slate-100 last:border-0">
            <span class="font-bold text-indigo-600">#${t.id}</span>
            <span class="text-slate-600 mr-1">${t.subject || ''}</span>
            <span class="text-slate-400 text-[10px]">(${t.user_name || ''})</span>
        </div>`
    ).join('');
    resultsEl.classList.remove('hidden');
};

window.selectKanbanTicket = function(id, subject, userName) {
    getEl('kanban-task-ticket-id').value = id;
    getEl('kanban-ticket-search').value = '';
    getEl('kanban-ticket-search-results').classList.add('hidden');
    getEl('kanban-ticket-linked-label').textContent = `קריאה #${id} — ${subject}`;
    getEl('kanban-ticket-linked').classList.remove('hidden');
};

window.clearKanbanTicketLink = function() {
    getEl('kanban-task-ticket-id').value = '';
    getEl('kanban-ticket-search').value = '';
    getEl('kanban-ticket-search-results').classList.add('hidden');
    getEl('kanban-ticket-linked').classList.add('hidden');
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
// --- פתיחת קריאת שירות מתוך משימת קנבן ---
// ==========================================
window.openTicketFromTask = function(ticketId) {
    const id = parseInt(ticketId);
    if (!id) return;
    // switch to support tab if needed, then open modal
    if (typeof switchSATab === 'function') switchSATab('support');
    setTimeout(function() {
        if (typeof openSATicketModal === 'function') {
            openSATicketModal(id);
        }
    }, 150);
};

// ==========================================
// --- שליחה ל-ALM Hub / QA Staging ---
// ==========================================
window.sendTicketToALM = async function() {
    if (!saCurrentTicketId) return;
    const senderName = window.currentSAUser ? window.currentSAUser.name : 'צוות מערכת';
    try {
        await fetch(`${API}/superadmin/tickets/${saCurrentTicketId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ message: '', status: '', isInternal: true, senderName: senderName, auditNote: 'הקריאה הועברה ל-ALM Hub לניהול מחזור חיים מלא' })
        });
    } catch(_) {}
    showToast('success', 'הקריאה הועברה ל-ALM Hub!');
    document.getElementById('sa-ticket-modal').classList.add('hidden');
    switchSATab('devops');
    switchDevTab('alm');
};

window.sendTicketToQA = async function() {
    if (!saCurrentTicketId) return;
    const senderName = window.currentSAUser ? window.currentSAUser.name : 'צוות מערכת';
    try {
        await fetch(`${API}/superadmin/tickets/${saCurrentTicketId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ message: '', status: '', isInternal: true, senderName: senderName, auditNote: 'הקריאה הועברה ל-QA Staging לבדיקות מלאות' })
        });
    } catch(_) {}
    showToast('success', 'הקריאה הועברה ל-QA Staging!');
    document.getElementById('sa-ticket-modal').classList.add('hidden');
    switchSATab('devops');
    switchDevTab('qa');
};

// ==========================================
// --- ALM Hub ---
// ==========================================
window.renderALMHub = function() {
    const tasks = typeof devKanbanTasks !== 'undefined' ? devKanbanTasks : [];
    const byStatus = { backlog: [], in_progress: [], qa: [], done: [] };
    tasks.forEach(t => {
        if (byStatus[t.status]) byStatus[t.status].push(t);
        else byStatus['backlog'].push(t);
    });

    const counts = { backlog: byStatus.backlog.length, dev: byStatus.in_progress.length, qa: byStatus.qa.length, done: byStatus.done.length };
    const tickets = (typeof saTicketsCache !== 'undefined' ? saTicketsCache : []).filter(t => t.status !== 'resolved' && t.status !== 'closed');
    ['backlog','dev','qa','done','tickets'].forEach(k => {
        const el = document.getElementById(`alm-count-${k}`);
        if (el) el.textContent = k === 'tickets' ? tickets.length : (counts[k] || 0);
    });

    const typeIcon = { feature: '✨', bug: '🐞', ui: '🎨', tech: '🔧' };
    const prioColor = { critical: 'text-red-600', high: 'text-orange-500', normal: 'text-yellow-500', low: 'text-blue-400' };

    const renderCard = (t) => {
        const ticket = t.original_ticket_id ? (typeof saTicketsCache !== 'undefined' ? saTicketsCache.find(x => x.id === parseInt(t.original_ticket_id)) : null) : null;
        const ticketBadge = t.original_ticket_id
            ? `<button onclick="event.stopPropagation(); window.openTicketFromTask(${t.original_ticket_id})" class="mt-1.5 w-full text-left text-[9px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition"><i class="fa-solid fa-ticket text-[8px]"></i> קריאה #${t.original_ticket_id}${ticket ? ' — ' + safeStr(ticket.user_name || '') : ''}<i class="fa-solid fa-arrow-up-right-from-square mr-auto text-[7px]"></i></button>`
            : '';
        return `<div class="bg-white border border-slate-100 rounded-xl p-2.5 shadow-sm hover:shadow-md transition cursor-default">
            <div class="flex items-start justify-between gap-1">
                <span class="text-[10px] font-bold text-slate-700 leading-tight flex-1">${typeIcon[t.type] || '📌'} ${safeStr(t.title)}</span>
                <span class="text-[9px] font-black ${prioColor[t.priority] || ''} shrink-0">${t.priority === 'critical' ? '🚨' : t.priority === 'high' ? '🔴' : t.priority === 'normal' ? '🟡' : '🔵'}</span>
            </div>
            ${ticketBadge}
        </div>`;
    };

    const laneMap = { backlog: 'backlog', in_progress: 'dev', qa: 'qa', done: 'done' };
    Object.entries(laneMap).forEach(([status, lane]) => {
        const el = document.getElementById(`alm-lane-${lane}`);
        if (!el) return;
        const list = byStatus[status];
        el.innerHTML = list.length ? list.map(renderCard).join('') : '<p class="text-[10px] text-slate-300 text-center py-4">ריק</p>';
    });
};

// ==========================================
// --- QA Staging ---
// ==========================================
let qaTestsCache = [];
let qaFilterStatus = 'all';

window.renderQAStaging = async function() {
    if (!qaTestsCache.length) await window.loadQATests();
    window._renderQATable();
};

window.loadQATests = async function() {
    try {
        const res = await fetch(`${API}/sa/qa/tests`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        const items = data.tests || [];
        // merge with kanban tasks in qa/done status that may not yet be in the book
        const taskItems = (typeof devKanbanTasks !== 'undefined' ? devKanbanTasks : [])
            .filter(t => t.status === 'qa' || t.status === 'done')
            .map(t => ({ id: `DEV-${t.id}`, name: t.title || '', category: t.module_name || t.environment || '—', priority: t.priority || 'normal', status: t.status === 'done' ? 'pass' : 'pending', ticket_id: t.original_ticket_id || null, description: t.description || '' }));
        const bookIds = new Set(items.map(i => i.id));
        const merged = [
            ...items.map(item => ({
                id: item.id || '',
                name: item.name || item.title || '',
                category: item.category || '—',
                priority: item.priority || 'medium',
                status: item.qa_status || 'pending',
                ticket_id: item.original_ticket_id || null,
                description: item.description || ''
            })),
            ...taskItems.filter(t => !bookIds.has(t.id))
        ];
        qaTestsCache = merged;
    } catch(_) {
        qaTestsCache = (typeof devKanbanTasks !== 'undefined' ? devKanbanTasks : [])
            .filter(t => t.status === 'qa' || t.status === 'done')
            .map(t => ({ id: `DEV-${t.id}`, name: t.title || '', category: t.module_name || t.environment || '—', priority: t.priority || 'normal', status: t.status === 'done' ? 'pass' : 'pending', ticket_id: t.original_ticket_id || null, description: t.description || '' }));
    }
};

window._renderQATable = function() {
    const filtered = qaFilterStatus === 'all' ? qaTestsCache : qaTestsCache.filter(t => t.status === qaFilterStatus);
    const pass = qaTestsCache.filter(t => t.status === 'pass').length;
    const fail = qaTestsCache.filter(t => t.status === 'fail').length;
    const pending = qaTestsCache.filter(t => t.status === 'pending').length;
    const statEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    statEl('qa-stat-pass', pass); statEl('qa-stat-fail', fail); statEl('qa-stat-pending', pending);

    const prioMap = { critical: '🚨', high: '🔴', medium: '🟡', normal: '🟡', low: '🔵' };
    const statusMap = { pending: '<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[9px] font-bold">⏳ ממתין</span>', pass: '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[9px] font-bold">✅ עבר</span>', fail: '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[9px] font-bold">❌ נכשל</span>' };
    const tbody = document.getElementById('qa-tests-tbody');
    if (!tbody) return;
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400 text-xs">אין בדיקות</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(t => {
        const ticketBtn = t.ticket_id
            ? `<button onclick="window.openTicketFromTask(${t.ticket_id})" class="text-[9px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition">#${t.ticket_id} <i class="fa-solid fa-arrow-up-right-from-square text-[7px]"></i></button>`
            : '<span class="text-slate-300">—</span>';
        return `<tr class="border-b border-slate-50 hover:bg-slate-50/60 transition">
            <td class="px-4 py-3 font-mono text-[9px] text-slate-500">${safeStr(t.id)}</td>
            <td class="px-4 py-3 font-bold text-slate-700">${safeStr(t.name)}</td>
            <td class="px-4 py-3 text-slate-500">${safeStr(t.category)}</td>
            <td class="px-4 py-3">${prioMap[t.priority] || '🟡'}</td>
            <td class="px-4 py-3">${statusMap[t.status] || statusMap.pending}</td>
            <td class="px-4 py-3">${ticketBtn}</td>
            <td class="px-4 py-3 text-center">
                <select onchange="window.updateQATestStatus('${t.id}', this.value)" class="text-[9px] border border-slate-200 rounded-lg px-1.5 py-0.5 outline-none bg-white">
                    <option value="pending" ${t.status==='pending'?'selected':''}>⏳</option>
                    <option value="pass" ${t.status==='pass'?'selected':''}>✅</option>
                    <option value="fail" ${t.status==='fail'?'selected':''}>❌</option>
                </select>
            </td>
        </tr>`;
    }).join('');
};

window.filterQATests = function(status) {
    qaFilterStatus = status;
    document.querySelectorAll('.qa-filter-btn').forEach(b => {
        b.className = 'qa-filter-btn text-[10px] font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition';
    });
    const activeBtn = document.getElementById(`qa-filter-${status}`);
    if (activeBtn) activeBtn.className = 'qa-filter-btn active text-[10px] font-bold px-3 py-1.5 rounded-full bg-slate-800 text-white transition';
    window._renderQATable();
};

window.updateQATestStatus = function(id, status) {
    const item = qaTestsCache.find(t => t.id == id);
    if (item) { item.status = status; window._renderQATable(); }
};

window.openQAAddModal = function() {
    document.getElementById('sa-qa-generator-modal') && document.getElementById('sa-qa-generator-modal').classList.remove('hidden');
};

// ==========================================
// --- סגירת מעגל ללקוח (Feedback Loop) ---
// ==========================================
window.openFeedbackLoopModal = function(taskId, ticketId) {
    getEl('feedback-loop-task-id').value = taskId;
    getEl('feedback-loop-ticket-id').value = ticketId;

    const t = saTicketsCache.find(x => x.id === parseInt(ticketId));
    const clientName = t ? (t.user_name || 'לקוח יקר') : 'לקוח יקר';
    const taskObj = devKanbanTasks.find(task => task.id === taskId);
    let taskTitle = taskObj ? taskObj.title : 'בקשת השירות שלך';
    taskTitle = taskTitle.replace(/^פנייה #[0-9]+:\s*/, '').replace(/^המרה לקריאת שירות:\s*/, '').replace(/^באג:\s*/, '');

    // בניית ציר זמן מה-log של הקריאה
    const timelineEl = getEl('feedback-loop-timeline');
    if (timelineEl) {
        const statusIcons = { 'SYSTEM_AUDIT': '🔵', 'open': '📥', 'in_progress': '⚙️', 'resolved': '✅' };
        let timelineHTML = '';
        if (t && t.log) {
            const logEntries = typeof t.log === 'string' ? JSON.parse(t.log) : t.log;
            const auditEntries = logEntries.filter(e => e.message && e.message.includes('[SYSTEM_AUDIT]'));
            if (auditEntries.length === 0) {
                timelineHTML = '<p class="text-xs text-slate-400 text-center py-2">אין רשומות ביומן הטיפול</p>';
            } else {
                timelineHTML = auditEntries.map(e => {
                    const d = new Date(e.date);
                    const dateStr = `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
                    const msg = e.message.replace('[SYSTEM_AUDIT] ', '');
                    return `<div class="flex items-start gap-2 text-[11px]">
                        <span class="shrink-0 mt-0.5 text-indigo-400"><i class="fa-solid fa-circle-dot text-[8px]"></i></span>
                        <div class="flex-1"><span class="font-bold text-slate-700">${msg}</span><br><span class="text-slate-400">${dateStr}</span></div>
                    </div>`;
                }).join('');
            }
        } else {
            const created = t ? new Date(t.created_at) : new Date();
            const dateStr = `${created.toLocaleDateString('he-IL')} ${created.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}`;
            timelineHTML = `<div class="flex items-start gap-2 text-[11px]">
                <span class="shrink-0 mt-0.5 text-indigo-400"><i class="fa-solid fa-circle-dot text-[8px]"></i></span>
                <div><span class="font-bold text-slate-700">קריאה נפתחה</span><br><span class="text-slate-400">${dateStr}</span></div>
            </div>`;
        }
        timelineEl.innerHTML = timelineHTML;
    }

    const now = new Date().toLocaleDateString('he-IL');
    getEl('feedback-loop-text').value = `שלום ${clientName},\n\nהפנייה שלך בנושא "${taskTitle}" טופלה.\nהטיפול הושלם בתאריך ${now}. אנו עומדים לרשותך לכל שאלה נוספת.\n\nבברכה,\nצוות התמיכה של Oneflow Life`;
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
            showToast('success', 'המעגל נסגר! הלקוח עודכן והקריאה נסגרה.');
            getEl('sa-feedback-loop-modal').classList.add('hidden');
            if (typeof loadSATickets === 'function') {
                await loadSATickets();
                if (ticketId) openSATicketModal(parseInt(ticketId));
            }
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

window.openAddTeamModal = function() {
    let modal = getEl('sa-team-modal');
    if (!modal) {
        const PERM_OPTIONS = [
            { v:'support',   l:'תמיכה וקריאות' },
            { v:'devops',    l:'פיתוח ומוצר (QA)' },
            { v:'marketing', l:'שיווק והשקות' },
            { v:'stats',     l:'דוחות ופיננסים' },
            { v:'biz',       l:'ניהול עסקים' },
            { v:'comm',      l:'ניהול קהילות' },
            { v:'users',     l:'ניהול משתמשים/RBAC' },
            { v:'content',   l:'מיתוג ובאנרים' },
        ];
        document.body.insertAdjacentHTML('beforeend', `
            <div id="sa-team-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden z-[9999] flex items-center justify-center p-4 fade-in">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative border border-slate-200" style="direction:rtl;">
                    <button onclick="getEl('sa-team-modal').classList.add('hidden')" class="absolute top-6 left-6 text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                    <h3 class="text-2xl font-black mb-6 text-slate-800">הקמת צוות חדש</h3>
                    <div class="space-y-5 mb-8">
                        <div>
                            <label class="text-xs font-bold text-slate-600 mb-1.5 block">שם הצוות:</label>
                            <input type="text" id="sa-team-name" class="modern-input py-2.5 bg-slate-50" placeholder="לדוגמה: צוות תמיכה">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-600 mb-2 block">הרשאות גישה:</label>
                            <div class="grid grid-cols-2 gap-2">
                                ${PERM_OPTIONS.map(p => `
                                <label class="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 transition">
                                    <input type="checkbox" value="${p.v}" class="sa-team-perm-cb w-4 h-4 accent-indigo-600">
                                    <span class="text-xs font-bold text-slate-700">${p.l}</span>
                                </label>`).join('')}
                            </div>
                        </div>
                    </div>
                    <button onclick="saveSATeam()" class="w-full bg-indigo-600 text-white py-3.5 rounded-xl text-lg font-bold shadow-lg hover:bg-indigo-700 transition">הקם צוות</button>
                </div>
            </div>
        `);
        modal = getEl('sa-team-modal');
    }
    // clear fields
    const nameEl = getEl('sa-team-name');
    if (nameEl) nameEl.value = '';
    modal.querySelectorAll('.sa-team-perm-cb').forEach(cb => cb.checked = false);
    modal.classList.remove('hidden');
};

window.saveSATeam = async function() {
    const name = (getEl('sa-team-name')?.value || '').trim();
    if (!name) return showToast('error', 'יש להזין שם לצוות');
    const perms = [...document.querySelectorAll('.sa-team-perm-cb:checked')].map(cb => cb.value);
    try {
        const r = await fetch(`${API}/sa/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ name, permissions: perms })
        }).then(r => r.json());
        if (r.success) {
            showToast('success', 'הצוות נוצר בהצלחה ✅');
            getEl('sa-team-modal').classList.add('hidden');
            loadSAHRData();
        } else { showToast('error', r.error || 'שגיאה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
};

window.deleteSATeam = async function(id) {
    if (!confirm('למחוק צוות זה? הנציגים המשויכים יישארו ללא שיוך.')) return;
    try {
        const r = await fetch(`${API}/sa/teams/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': saToken }
        }).then(r => r.json());
        if (r.success) { showToast('success', 'הצוות נמחק'); loadSAHRData(); }
        else showToast('error', r.error || 'שגיאה');
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
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

window.updateSmsLoginToggleUI = function() {
    const btn = document.getElementById('sms-login-toggle');
    const dot = document.getElementById('sms-login-toggle-dot');
    if (!btn || !dot) return;
    const on = window._smsLoginEnabled !== false;
    btn.className = `relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-indigo-600' : 'bg-slate-300'}`;
    dot.className = `inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-6' : 'translate-x-1'}`;
};

window.toggleSmsLogin = async function() {
    window._smsLoginEnabled = !window._smsLoginEnabled;
    updateSmsLoginToggleUI();
    try {
        await fetch(`${API}/superadmin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ smsLoginEnabled: window._smsLoginEnabled })
        });
        showToast('success', window._smsLoginEnabled ? 'התחברות SMS הופעלה' : 'התחברות SMS בוטלה — יוצג מסך אימייל+סיסמה');
    } catch(e) {
        window._smsLoginEnabled = !window._smsLoginEnabled; // rollback
        updateSmsLoginToggleUI();
        showToast('error', 'שגיאה בשמירה');
    }
};

window.saveSmsDebugCode = async function() {
    const input = document.getElementById('sa-sms-debug-code');
    const statusEl = document.getElementById('sa-sms-debug-status');
    const code = (input.value || '').replace(/\D/g, '').slice(0, 4);

    try {
        const res = await fetch(`${API}/superadmin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ smsDebugCode: code })
        });
        const data = await res.json();
        if (data.success) {
            input.value = code;
            if (statusEl) {
                statusEl.className = 'text-xs mt-2';
                statusEl.textContent = code
                    ? `✅ קוד בדיקה פעיל: ${code} — כל הזמנה תדרוש קוד זה`
                    : '✅ קוד הוסר — ישלח קוד אקראי';
            }
            showToast('success', code ? `קוד בדיקה נשמר: ${code}` : 'קוד הבדיקה הוסר');
        }
    } catch(e) {
        showToast('error', 'שגיאה בשמירת הקוד');
    }
};

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

// ==========================================
// --- מערכת עוזרת אישית (AI) לסופר אדמין ---
// ==========================================

window.loadSAAssistantLogo = async function() {
    try {
        const res = await fetch(`${API}/system/settings`, { headers: { 'Authorization': saToken }});
        const data = await res.json();
        if (data.success && data.settings && data.settings.ai_logo_url) {
            const logoUrl = data.settings.ai_logo_url;
            const bubbleIcon = getEl('sa-ai-bubble-icon');
            const headerIcon = getEl('sa-ai-header-icon');
            if (bubbleIcon) bubbleIcon.src = logoUrl;
            if (headerIcon) headerIcon.src = logoUrl;
        }
    } catch(e) { console.log('SA AI Logo load skipped.'); }
};

window.toggleSAAIChat = function() {
    const chatWindow = getEl('sa-ai-chat-window');
    if (chatWindow.classList.contains('hidden')) {
        chatWindow.classList.remove('hidden');
        chatWindow.classList.add('flex');
        window.loadSAAssistantLogo();
        setTimeout(() => getEl('sa-ai-input').focus(), 100);
    } else {
        chatWindow.classList.add('hidden');
        chatWindow.classList.remove('flex');
    }
};

(function initSAAIWidgetDrag() {
    const DRAG_THRESHOLD = 6;
    let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0, moved = false;

    function getWidget() { return document.getElementById('sa-ai-widget'); }

    function snapToEdges(widget) {
        const margin = 12;
        const vw = window.innerWidth, vh = window.innerHeight;
        let left = parseFloat(widget.style.left) || 0;
        let top  = parseFloat(widget.style.top)  || 0;
        if (left < margin) left = margin;
        if (top  < margin) top  = margin;
        if (left + 64 > vw - margin) left = vw - 64 - margin;
        if (top  + 64 > vh - margin) top  = vh - 64 - margin;
        widget.style.left = left + 'px';
        widget.style.top  = top  + 'px';
    }

    function initDrag() {
        const btn = document.getElementById('sa-ai-bubble-btn');
        if (!btn) { setTimeout(initDrag, 200); return; }

        btn.addEventListener('mousedown', function(e) {
            const widget = getWidget();
            if (!widget) return;
            if (!widget.style.left) {
                const rect = widget.getBoundingClientRect();
                widget.style.top    = rect.top  + 'px';
                widget.style.left   = rect.left + 'px';
                widget.style.bottom = 'auto';
                widget.style.right  = 'auto';
            }
            dragging = true;
            moved = false;
            startX = e.clientX;
            startY = e.clientY;
            origLeft = parseFloat(widget.style.left) || 0;
            origTop  = parseFloat(widget.style.top)  || 0;
            widget.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (!moved && Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) moved = true;
            if (!moved) return;
            const widget = getWidget();
            widget.style.left = (origLeft + dx) + 'px';
            widget.style.top  = (origTop  + dy) + 'px';
        });

        document.addEventListener('mouseup', function() {
            if (!dragging) return;
            dragging = false;
            const widget = getWidget();
            if (widget) {
                widget.style.transition = '';
                if (widget.style.left) snapToEdges(widget);
            }
            if (!moved) window.toggleSAAIChat();
        });
    }

    initDrag();
})();

window.sendSAAIMessage = async function(e) {
    e.preventDefault();
    const input = getEl('sa-ai-input');
    const text = input.value.trim();
    if (!text) return;

    const chatMessages = getEl('sa-ai-chat-messages');
    const btn = getEl('btn-sa-ai-send');
    const bubbleIcon = getEl('sa-ai-bubble-icon');
    const currentLogo = bubbleIcon ? bubbleIcon.src : 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png';

    chatMessages.innerHTML += `
        <div class="flex gap-2 justify-end fade-in">
            <div class="bg-indigo-600 text-white p-3 rounded-2xl rounded-tl-none shadow-sm text-xs font-medium max-w-[85%] leading-relaxed">
                ${safeStr(text)}
            </div>
        </div>
    `;
    input.value = '';
    btn.disabled = true;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const typingId = 'ai-typing-' + Date.now();
    chatMessages.innerHTML += `
        <div id="${typingId}" class="flex gap-2 fade-in">
            <div class="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0"><img src="${currentLogo}" class="w-full h-full rounded-full object-cover"></div>
            <div class="bg-white border border-slate-200 p-3 rounded-2xl rounded-tr-none text-slate-400 shadow-sm text-xs flex items-center gap-1.5">
                <span class="w-2 h-2 bg-indigo-300 rounded-full animate-bounce"></span>
                <span class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.15s"></span>
                <span class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
            </div>
        </div>
    `;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const currentTab = document.querySelector('.sa-nav-btn.active')?.dataset?.tab || '';
        const currentViewTab = document.querySelector('.sa-view-tab-btn.active')?.dataset?.vtab || '';

        const res = await fetch(`${API}/sa/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({
                message: text,
                context: { currentTab, currentViewTab }
            })
        });

        const data = await res.json();
        const typingEl = getEl(typingId);
        if(typingEl) typingEl.remove();

        if (data.success) {
            let reply = data.reply
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<b class="text-indigo-700">$1</b>');

            // בניית כפתורי פעולה
            const actionBtns = (data.actions || []).map(a => {
                if (a.type === 'tab') return `<button onclick="switchSATab('${safeStr(a.tab)}')" class="ai-action-btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-1.5 rounded-xl transition"><i class="fa-solid fa-arrow-right-to-bracket ml-1"></i>${safeStr(a.tab)}</button>`;
                if (a.type === 'subtab') return `<button onclick="switchSATab('${safeStr(a.tab)}');setTimeout(()=>switchViewTab('${safeStr(a.tab)}','${safeStr(a.sub)}'),200)" class="ai-action-btn bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-3 py-1.5 rounded-xl transition"><i class="fa-solid fa-arrow-right ml-1"></i>${safeStr(a.sub)}</button>`;
                if (a.type === 'ledger') return `<button onclick="switchSATab('clients');setTimeout(()=>openCustomerLedger('${safeStr(a.id)}'),300)" class="ai-action-btn bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-bold px-3 py-1.5 rounded-xl transition"><i class="fa-solid fa-book ml-1"></i>כרטסת</button>`;
                return '';
            }).filter(Boolean).join(' ');

            const actionsHtml = actionBtns ? `<div class="flex flex-wrap gap-1.5 mt-2">${actionBtns}</div>` : '';

            chatMessages.innerHTML += `
                <div class="flex gap-2 fade-in">
                    <div class="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 shadow-sm"><img src="${currentLogo}" class="w-full h-full rounded-full object-cover"></div>
                    <div class="bg-white border border-slate-200 p-3 rounded-2xl rounded-tr-none text-slate-700 shadow-sm text-xs leading-relaxed font-medium max-w-[85%]">
                        ${reply}
                        ${actionsHtml}
                    </div>
                </div>
            `;

            // הצגת הצעות כ-chips
            const suggestions = data.suggestions || [];
            if (suggestions.length) {
                const chipsDiv = document.createElement('div');
                chipsDiv.className = 'flex flex-wrap gap-1.5 px-1 pb-1 fade-in';
                suggestions.forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-xl transition whitespace-nowrap';
                    btn.textContent = s;
                    btn.addEventListener('click', () => {
                        const inp = document.getElementById('sa-ai-input');
                        if (inp) { inp.value = s; sendSAAIMessage({ preventDefault: () => {} }); }
                    });
                    chipsDiv.appendChild(btn);
                });
                chatMessages.appendChild(chipsDiv);
            }
        } else {
            chatMessages.innerHTML += `<div class="text-xs text-red-500 text-center my-3 bg-red-50 p-2 rounded-lg border border-red-100">שגיאה: ${safeStr(data.error||'')}</div>`;
        }
    } catch(err) {
        const typingEl = getEl(typingId);
        if(typingEl) typingEl.remove();
        chatMessages.innerHTML += `<div class="text-xs text-red-500 text-center my-3 bg-red-50 p-2 rounded-lg border border-red-100">שגיאת תקשורת</div>`;
    } finally {
        btn.disabled = false;
        setTimeout(() => input.focus(), 100);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
};

// ==========================================
// --- מערכת הודעות פנימיות ואישורים ---
// ==========================================

window.toggleIntMsgTarget = function() {
    const type = val('int-msg-target-type');
    const wrapper = getEl('int-msg-target-val-wrapper');
    if (type === 'team') {
        if (wrapper) wrapper.classList.remove('hidden');
        const select = getEl('int-msg-target-val');
        if (select) {
            if (typeof saTeamsCache !== 'undefined' && saTeamsCache.length > 0) {
                select.innerHTML = saTeamsCache.map(t => `<option value="${t.id}">${safeStr(t.name)}</option>`).join('');
            } else {
                select.innerHTML = '<option value="">אין צוותים מוגדרים</option>';
            }
        }
    } else {
        if (wrapper) wrapper.classList.add('hidden');
    }
};

window.openInternalMsgModal = function() {
    const titleEl = getEl('int-msg-title');
    const contentEl = getEl('int-msg-content');
    const typeEl = getEl('int-msg-target-type');
    const modalEl = getEl('sa-internal-msg-modal');
    
    if (titleEl) titleEl.value = '';
    if (contentEl) contentEl.value = '';
    if (typeEl) typeEl.value = 'all';
    
    window.toggleIntMsgTarget();
    if (modalEl) modalEl.classList.remove('hidden');
};

window.sendInternalMsg = async function() {
    const titleEl = document.getElementById('int-msg-title');
    const contentEl = document.getElementById('int-msg-content');
    const targetTypeEl = document.getElementById('int-msg-target-type');
    const targetValEl = document.getElementById('int-msg-target-val');

    const title = titleEl ? titleEl.value.trim() : '';
    const content = contentEl ? contentEl.value.trim() : '';
    const targetType = targetTypeEl ? targetTypeEl.value : 'all';
    const targetId = targetType === 'team' && targetValEl ? targetValEl.value : null;

    if (!title || !content) {
        if (typeof showToast === 'function') showToast('error', 'יש למלא נושא ותוכן.');
        else alert('יש למלא נושא ותוכן.');
        return;
    }

    try {
        const res = await fetch(`${API}/messages/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ title, content, targetType, targetId })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast('success', 'הודעה פנימית נשלחה בהצלחה!');
            else alert('הודעה פנימית נשלחה בהצלחה!');
            const modalEl = document.getElementById('sa-internal-msg-modal');
            if (modalEl) modalEl.classList.add('hidden');
            
            // טעינה מחדש של הטבלה מיד לאחר שליחה מוצלחת!
            if (typeof window.loadInternalMessages === 'function') {
                window.loadInternalMessages();
            }
        } else {
            if (typeof showToast === 'function') showToast('error', data.error || 'שגיאה בשליחת הודעה.');
            else alert(data.error || 'שגיאה בשליחת הודעה.');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('error', 'שגיאת רשת בשליחת הודעה.');
        else alert('שגיאת רשת בשליחת הודעה.');
    }
};

window.loadInternalMessages = async function() {
    const tbody = document.getElementById('sa-internal-msg-list');
    if (!tbody) return;
    try {
        const res = await fetch(`${API}/messages/broadcast`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success) {
            if (!data.messages || data.messages.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-slate-500">אין הודעות פנימיות עדיין</td></tr>';
            } else {
                tbody.innerHTML = data.messages.map(m => {
                    const dateStr = new Date(m.created_at).toLocaleString('he-IL', {dateStyle:'short', timeStyle:'short'});
                    const targetStr = m.target_type === 'all' ? 'כל העובדים' : `צוות מס' ${m.target_id}`;
                    return `
                        <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                            <td class="px-4 py-3 font-bold text-slate-700">${safeStr(m.title)}</td>
                            <td class="px-4 py-3 text-slate-600">${targetStr}</td>
                            <td class="px-4 py-3 text-slate-500 dir-ltr text-right">${dateStr}</td>
                            <td class="px-4 py-3 text-center">
                                <button onclick="openInternalMsgStatsModal(${m.id}, '${safeStr(m.title)}')" class="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition shadow-sm">צפה בסטטיסטיקה</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-red-500">שגיאה בטעינת נתונים</td></tr>';
    }
};

// הפעלה אוטומטית לטעינת ההיסטוריה לתוך הטבלה בכל פעם שהקובץ עולה
setTimeout(() => {
    if (typeof window.loadInternalMessages === 'function') window.loadInternalMessages();
}, 1500);

window.openInternalMsgStatsModal = async function(msgId, title) {
    const titleEl = getEl('stats-msg-title');
    const tbody = getEl('stats-msg-body');
    const modalEl = getEl('sa-internal-msg-stats-modal');
    
    if (titleEl) titleEl.innerText = `מנתח נתונים עבור: ${title}`;
    if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-slate-400">טוען נתונים...</td></tr>';
    if (modalEl) modalEl.classList.remove('hidden');

    try {
        const res = await fetch(`${API}/messages/${msgId}/stats`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (data.success && tbody) {
            if (!data.stats || data.stats.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-slate-400">טרם התקבלו מענים מאף עובד.</td></tr>';
            } else {
                tbody.innerHTML = data.stats.map(s => {
                    let statusHtml = '';
                    if(s.status === 'read') statusHtml = '<span class="text-blue-500 bg-blue-50 px-2 py-1 rounded font-bold">קראתי</span>';
                    else if(s.status === 'approved') statusHtml = '<span class="text-green-500 bg-green-50 px-2 py-1 rounded font-bold">אישרתי</span>';
                    else if(s.status === 'rejected') statusHtml = '<span class="text-red-500 bg-red-50 px-2 py-1 rounded font-bold">ביטלתי</span>';
                    else statusHtml = '<span class="text-slate-400">לא ידוע</span>';

                    const dateStr = s.responded_at ? new Date(s.responded_at).toLocaleString('he-IL', {dateStyle:'short', timeStyle:'short'}) : '---';

                    return `
                        <tr>
                            <td class="px-4 py-2 font-bold text-slate-700">${safeStr(s.name)}</td>
                            <td class="px-4 py-2 text-center">${statusHtml}</td>
                            <td class="px-4 py-2 text-slate-500 dir-ltr">${dateStr}</td>
                        </tr>
                    `;
                }).join('');
            }
        } else if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-red-500">${safeStr(data.error)}</td></tr>`;
        }
    } catch(e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-red-500">שגיאת רשת.</td></tr>';
    }
};

// ============================================================
// --- FINANCE & CASHBACK TAB ---
// ============================================================

async function loadSAFinanceData() {
    try {
        // טעינת סיכום פיננסי
        const summaryRes = await fetch(`${API}/sa/finance-summary`, { headers: { 'Authorization': saToken || '' } });
        const summaryData = await summaryRes.json();
        if (summaryData.success) {
            const s = summaryData.summary;
            const fmt = v => '₪' + parseFloat(v || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const el = id => document.getElementById(id);
            if (el('sa-fin-total-commission')) el('sa-fin-total-commission').textContent = fmt(s.total_commission);
            if (el('sa-fin-total-cashback')) el('sa-fin-total-cashback').textContent = fmt(s.total_cashback);
            if (el('sa-fin-month-commission')) el('sa-fin-month-commission').textContent = fmt(s.month_commission);
            if (el('sa-fin-month-cashback')) el('sa-fin-month-cashback').textContent = fmt(s.month_cashback);
            if (el('sa-fin-total-collected')) el('sa-fin-total-collected').textContent = fmt(s.total_collected);
            if (el('sa-fin-month-collected')) el('sa-fin-month-collected').textContent = fmt(s.month_collected);
            // progress bars
            const totalPct = s.total_commission > 0 ? Math.min(100, Math.round(s.total_collected / s.total_commission * 100)) : 0;
            const monthPct = s.month_commission > 0 ? Math.min(100, Math.round(s.month_collected / s.month_commission * 100)) : 0;
            if (el('sa-fin-collected-pct')) el('sa-fin-collected-pct').textContent = totalPct + '%';
            if (el('sa-fin-collected-bar')) el('sa-fin-collected-bar').style.width = totalPct + '%';
            if (el('sa-fin-month-collected-pct')) el('sa-fin-month-collected-pct').textContent = monthPct + '%';
            if (el('sa-fin-month-collected-bar')) el('sa-fin-month-collected-bar').style.width = monthPct + '%';
        }

        // טעינת אחוזים
        const ratesRes = await fetch(`${API}/sa/settings/rates`, { headers: { 'Authorization': saToken || '' } });
        const ratesData = await ratesRes.json();
        if (ratesData.success) {
            const commInput = document.getElementById('sa-commission-pct');
            const cashbackInput = document.getElementById('sa-cashback-pct');
            if (commInput) commInput.value = ratesData.platform_commission_pct;
            if (cashbackInput) cashbackInput.value = ratesData.community_cashback_pct;
            updateRatesExample(ratesData.platform_commission_pct, ratesData.community_cashback_pct);
        }

        // טעינת חובות עסקים
        const duesRes = await fetch(`${API}/sa/business-dues`, { headers: { 'Authorization': saToken || '' } });
        const duesData = await duesRes.json();
        const duesTbody = document.getElementById('sa-dues-table-body');
        if (duesTbody && duesData.success) {
            if (!duesData.dues.length) {
                duesTbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">אין נתונים עדיין. נתונים יצברו כשהזמנות יסומנו כ"נמסר".</td></tr>';
            } else {
                duesTbody.innerHTML = duesData.dues.map(d => {
                    const totalComm = parseFloat(d.total_commission||0);
                    const collected = parseFloat(d.total_collected||0);
                    const collPct = totalComm > 0 ? Math.min(100, Math.round(collected / totalComm * 100)) : 0;
                    return `<tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 font-bold text-slate-800">${safeStr(d.business_name)}<br><span class="text-[10px] text-slate-400">${safeStr(d.group_code)}</span></td>
                    <td class="px-4 py-3 text-center font-mono">₪${parseFloat(d.total_sales||0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-mono text-blue-700">₪${totalComm.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-mono text-amber-600">₪${parseFloat(d.total_cashback||0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-mono font-bold text-red-600">₪${parseFloat(d.pending_commission||0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center">
                        <span class="font-mono text-violet-700 font-bold">₪${collected.toFixed(2)}</span>
                        <div class="w-20 mx-auto mt-1">
                            <div class="flex justify-between text-[9px] text-violet-400 mb-0.5"><span>${collPct}%</span></div>
                            <div class="w-full bg-violet-100 rounded-full h-1"><div class="bg-violet-500 h-1 rounded-full" style="width:${collPct}%"></div></div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="openCollectionModal(${d.business_id},'${safeStr(d.business_name)}')" class="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-violet-700 transition shadow-sm"><i class="fa-solid fa-hand-holding-dollar mr-1"></i>גביה</button>
                    </td>
                </tr>`;
                }).join('');
            }
        }

        // טעינת ארנקים
        const walletsRes = await fetch(`${API}/sa/community-wallets`, { headers: { 'Authorization': saToken || '' } });
        const walletsData = await walletsRes.json();
        const walletsTbody = document.getElementById('sa-wallets-table-body');
        if (walletsTbody && walletsData.success) {
            if (!walletsData.wallets.length) {
                walletsTbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">אין קהילות רשומות</td></tr>';
            } else {
                walletsTbody.innerHTML = walletsData.wallets.map(w => `<tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 font-bold text-slate-800">${safeStr(w.name)}</td>
                    <td class="px-4 py-3 text-slate-500 text-sm">${safeStr(w.city||'כללי')}</td>
                    <td class="px-4 py-3 text-center">${w.family_count||0}</td>
                    <td class="px-4 py-3 text-center font-mono text-amber-700">₪${parseFloat(w.total_earned||0).toFixed(2)}</td>
                    <td class="px-4 py-3 text-center font-mono font-bold text-emerald-700">₪${parseFloat(w.balance||0).toFixed(2)}</td>
                </tr>`).join('');
            }
        }
    } catch(e) { console.error('Finance load error:', e); }
}

window.openCollectionModal = function(bizId, bizName) {
    document.getElementById('sa-coll-biz-id').value = bizId;
    document.getElementById('sa-coll-biz-name').textContent = bizName;
    document.getElementById('sa-coll-amount').value = '';
    document.getElementById('sa-coll-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('sa-coll-notes').value = '';
    document.getElementById('sa-collection-modal').classList.remove('hidden');
    loadCollectionHistory(bizId);
};

async function loadCollectionHistory(bizId) {
    const container = document.getElementById('sa-coll-history');
    if (!container) return;
    container.innerHTML = '<p class="text-slate-400 text-center py-2">טוען...</p>';
    try {
        const res = await fetch(`${API}/sa/business-collections/${bizId}`, { headers: { 'Authorization': saToken || '' } });
        const data = await res.json();
        if (!data.success || !data.collections.length) {
            container.innerHTML = '<p class="text-slate-400 text-center py-2">אין גביות רשומות עדיין</p>';
            return;
        }
        container.innerHTML = data.collections.map(c => `
            <div class="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2 text-xs">
                <span class="text-slate-400">${new Date(c.collected_at).toLocaleDateString('he-IL')}</span>
                <span class="font-bold text-violet-700">₪${parseFloat(c.amount).toFixed(2)}</span>
                <span class="text-slate-500 truncate max-w-[120px]">${c.notes || ''}</span>
            </div>`).join('');
    } catch(e) { container.innerHTML = '<p class="text-red-400 text-center py-2">שגיאה בטעינה</p>'; }
}

window.saveBusinessCollection = async function() {
    const bizId = document.getElementById('sa-coll-biz-id').value;
    const amount = document.getElementById('sa-coll-amount').value;
    const date = document.getElementById('sa-coll-date').value;
    const notes = document.getElementById('sa-coll-notes').value;
    if (!amount || parseFloat(amount) <= 0) return showToast('error', 'נא להזין סכום חיובי');
    try {
        const res = await fetch(`${API}/sa/business-collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken || '' },
            body: JSON.stringify({ business_id: bizId, amount: parseFloat(amount), collected_at: date, notes })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', 'הגביה נרשמה בהצלחה!');
            document.getElementById('sa-coll-amount').value = '';
            document.getElementById('sa-coll-notes').value = '';
            loadCollectionHistory(bizId);
            loadSAFinanceData();
        } else { showToast('error', data.error || 'שגיאה בשמירה'); }
    } catch(e) { showToast('error', 'שגיאת תקשורת'); }
};

function updateRatesExample(commPct, cashbackPct) {
    const commEl = document.getElementById('sa-example-comm');
    const cashEl = document.getElementById('sa-example-cashback');
    if (commEl) commEl.textContent = '₪' + (1000 * commPct / 100).toFixed(2);
    if (cashEl) cashEl.textContent = '₪' + (1000 * commPct / 100 * cashbackPct / 100).toFixed(2);
}

async function savePlatformRates() {
    const commPct = parseFloat(document.getElementById('sa-commission-pct')?.value || 3);
    const cashbackPct = parseFloat(document.getElementById('sa-cashback-pct')?.value || 30);
    try {
        const res = await fetch(`${API}/sa/settings/rates`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken || '' },
            body: JSON.stringify({ platform_commission_pct: commPct, community_cashback_pct: cashbackPct })
        });
        const data = await res.json();
        if (data.success) { showToast('success', 'ההגדרות נשמרו בהצלחה!'); updateRatesExample(commPct, cashbackPct); }
        else showToast('error', data.error || 'שגיאה בשמירה');
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

// ===== Legal Documents =====
const LEGAL_DOC_LABELS = {
    'legal_tos_family': 'תקנון — משפחה',
    'legal_tos_business': 'תקנון — עסקים',
    'legal_privacy': 'מדיניות פרטיות',
    'legal_accessibility': 'הצהרת נגישות'
};
let currentLegalKey = 'legal_tos_family';
let legalDocsCache = {};

function getLegalEditor() { return document.getElementById('legal-doc-editor'); }

async function loadLegalDocs() {
    try {
        const res = await fetch(`${API}/sa/legal`, { headers: { 'Authorization': saToken || '' } });
        const data = await res.json();
        if (data.success) {
            legalDocsCache = data.docs || {};
            renderLegalDoc(currentLegalKey);
        }
    } catch(e) { showToast('error', 'שגיאה בטעינת המסמכים'); }
}

function switchLegalDoc(key) {
    // שמור את התוכן הנוכחי לפני מעבר
    const editor = getLegalEditor();
    if (editor) legalDocsCache[currentLegalKey] = editor.innerHTML;
    currentLegalKey = key;
    Object.keys(LEGAL_DOC_LABELS).forEach(k => {
        const btn = document.getElementById(`legal-tab-${k}`);
        if (!btn) return;
        btn.className = k === key
            ? 'px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white transition'
            : 'px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
    });
    renderLegalDoc(key);
}

function renderLegalDoc(key) {
    const label = document.getElementById('legal-doc-label');
    const editor = getLegalEditor();
    const status = document.getElementById('legal-save-status');
    if (label) label.textContent = LEGAL_DOC_LABELS[key] || key;
    if (editor) editor.innerHTML = legalDocsCache[key] || '';
    if (status) status.classList.add('hidden');
}

async function saveLegalDoc() {
    const editor = getLegalEditor();
    const status = document.getElementById('legal-save-status');
    if (!editor) return;
    const content = editor.innerHTML;
    try {
        const res = await fetch(`${API}/sa/legal/${currentLegalKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken || '' },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (data.success) {
            legalDocsCache[currentLegalKey] = content;
            if (status) { status.textContent = 'נשמר בהצלחה ✓'; status.className = 'text-sm font-bold text-emerald-600'; status.classList.remove('hidden'); }
            showToast('success', 'המסמך נשמר בהצלחה');
        } else {
            if (status) { status.textContent = 'שגיאה בשמירה'; status.className = 'text-sm font-bold text-red-500'; status.classList.remove('hidden'); }
            showToast('error', data.error || 'שגיאה');
        }
    } catch(e) { showToast('error', 'שגיאת רשת'); }
}

function legalFmt(cmd) {
    document.getElementById('legal-doc-editor')?.focus();
    document.execCommand(cmd, false, null);
    updateLegalToolbar();
}

function legalFmtBlock(tag) {
    document.getElementById('legal-doc-editor')?.focus();
    document.execCommand('formatBlock', false, tag);
    updateLegalToolbar();
}

function updateLegalToolbar() {
    const cmds = { bold: 'bold', italic: 'italic', underline: 'underline' };
    document.querySelectorAll('.legal-tb-btn[title]').forEach(btn => btn.classList.remove('active'));
    if (document.queryCommandState('bold'))      document.querySelector('.legal-tb-btn[title="מודגש"]')?.classList.add('active');
    if (document.queryCommandState('italic'))    document.querySelector('.legal-tb-btn[title="נטוי"]')?.classList.add('active');
    if (document.queryCommandState('underline')) document.querySelector('.legal-tb-btn[title="קו תחתי"]')?.classList.add('active');
}

// ═══════════════════════════════════════════════════════════════════════════
// ניהול תבניות עסקים — BIZ TEMPLATE VISIBILITY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const BIZ_TEMPLATE_TREE = {
  restaurant: {
    name: 'מסעדה / בית קפה', icon: '🍕',
    elements: [
      { key: 'tab:feed',      label: 'ראשי 🏠',                   type: 'tab' },
      { key: 'tab:pos',       label: 'קופה (POS) 💰',              type: 'tab', children: [
        { key: 'feature:pos:tables',         label: 'ניהול שולחנות',          type: 'feature' },
        { key: 'feature:pos:kds',            label: 'מסך מטבח (KDS)',          type: 'feature' },
        { key: 'feature:pos:receipts',       label: 'היסטוריית קבלות',         type: 'feature' },
        { key: 'feature:pos:live-queue',     label: 'תור לייב',               type: 'feature' },
      ]},
      { key: 'tab:sales',     label: 'מכירות 🛍️',                  type: 'tab', children: [
        { key: 'feature:sales:quotes',           label: 'הצעות מחיר',              type: 'feature' },
        { key: 'feature:sales:invoices',         label: 'חשבוניות',                type: 'feature' },
        { key: 'feature:sales:orders',           label: 'הזמנות',                  type: 'feature' },
        { key: 'feature:sales:new-quote-btn',    label: 'כפתור: הצעה חדשה',        type: 'feature' },
        { key: 'feature:sales:new-product-btn',  label: 'כפתור: מוצר חדש',         type: 'feature' },
        { key: 'feature:sales:promotions',       label: 'מבצעים',                  type: 'feature' },
      ]},
      { key: 'tab:pantry',    label: 'ניהול מלאי 📦',              type: 'tab', children: [
        { key: 'feature:pantry:add-item',    label: 'הוספת פריט',              type: 'feature' },
        { key: 'feature:pantry:stock-take',  label: 'ספירת מלאי',              type: 'feature' },
        { key: 'feature:pantry:alerts',      label: 'התראות מלאי נמוך',        type: 'feature' },
      ]},
      { key: 'tab:shop',      label: 'רכש ארגוני 🛒',              type: 'tab' },
      { key: 'tab:customers', label: 'לקוחות 🤝',                  type: 'tab', children: [
        { key: 'feature:customers:add',      label: 'הוספת לקוח',              type: 'feature' },
        { key: 'feature:customers:loyalty',  label: 'נקודות נאמנות',           type: 'feature' },
        { key: 'feature:customers:whatsapp', label: 'שליחת WhatsApp',           type: 'feature' },
        { key: 'feature:customers:import',   label: 'ייבוא לקוחות',            type: 'feature' },
      ]},
      { key: 'tab:shifts',    label: 'משמרות 🗓️',                  type: 'tab', children: [
        { key: 'feature:shifts:new-shift',   label: 'יצירת משמרת',             type: 'feature' },
        { key: 'feature:shifts:publish',     label: 'פרסום לוח משמרות',        type: 'feature' },
        { key: 'feature:shifts:swap',        label: 'החלפת משמרות',             type: 'feature' },
      ]},
      { key: 'tab:timeclock', label: 'נוכחות ⏱️',                 type: 'tab', children: [
        { key: 'feature:timeclock:manual-entry', label: 'כניסה ידנית',         type: 'feature' },
        { key: 'feature:timeclock:export',       label: 'ייצוא דוח נוכחות',    type: 'feature' },
        { key: 'feature:timeclock:edit',         label: 'עריכת רישומים',        type: 'feature' },
      ]},
      { key: 'tab:tasks',     label: 'משימות ✅',                   type: 'tab', children: [
        { key: 'feature:tasks:new-task',     label: 'משימה חדשה',              type: 'feature' },
        { key: 'feature:tasks:new-project',  label: 'פרויקט חדש',              type: 'feature' },
      ]},
      { key: 'tab:cashflow',  label: 'תזרים 💸',                   type: 'tab', children: [
        { key: 'feature:cashflow:add-income',  label: 'הוספת הכנסה',           type: 'feature' },
        { key: 'feature:cashflow:add-expense', label: 'הוספת הוצאה',           type: 'feature' },
        { key: 'feature:cashflow:export',      label: 'ייצוא',                  type: 'feature' },
      ]},
      { key: 'tab:budget',    label: 'תקציב 📊',                   type: 'tab', children: [
        { key: 'feature:budget:set-limit',   label: 'הגדרת יעד תקציב',         type: 'feature' },
        { key: 'feature:budget:add-category',label: 'הוספת קטגוריה',           type: 'feature' },
      ]},
      { key: 'tab:members',   label: 'ניהול צוות 👥',              type: 'tab', children: [
        { key: 'feature:members:add',        label: 'הוספת עובד',              type: 'feature' },
        { key: 'feature:members:roles',      label: 'ניהול תפקידים',           type: 'feature' },
      ]},
      { key: 'tab:calendar',  label: 'יומן 📅',                    type: 'tab', children: [
        { key: 'feature:calendar:new-event', label: 'אירוע חדש',               type: 'feature' },
      ]},
      { key: 'tab:deliveries',label: 'שליחויות 🛵',                type: 'tab', children: [
        { key: 'feature:deliveries:new-order', label: 'הזמנת שליחות',          type: 'feature' },
        { key: 'feature:deliveries:tracking',  label: 'מעקב שליחויות',         type: 'feature' },
      ]},
      { key: 'tab:foodcost',  label: 'תמחור ורווחיות 🍽️',          type: 'tab' },
      { key: 'tab:reviews',   label: 'ביקורות ⭐',                  type: 'tab' },
    ]
  },

  sport: {
    name: 'ספורט / כושר', icon: '🏋️',
    elements: [
      { key: 'tab:feed',      label: 'ראשי 🏠',                   type: 'tab' },
      { key: 'tab:calendar',  label: 'יומן שיעורים 📅',            type: 'tab', children: [
        { key: 'feature:calendar:new-event',     label: 'שיעור / אירוע חדש',     type: 'feature' },
        { key: 'feature:calendar:trainer-assign',label: 'שיוך מאמן',            type: 'feature' },
        { key: 'feature:calendar:booking',       label: 'הרשמה לשיעורים',       type: 'feature' },
      ]},
      { key: 'tab:pos',       label: 'קופה 💰',                    type: 'tab', children: [
        { key: 'feature:pos:membership-sale', label: 'מכירת מנוי',             type: 'feature' },
        { key: 'feature:pos:day-pass',        label: 'כרטיס כניסה יחיד',       type: 'feature' },
        { key: 'feature:pos:receipts',        label: 'קבלות',                   type: 'feature' },
      ]},
      { key: 'tab:sales',     label: 'מכירות 🛍️',                  type: 'tab', children: [
        { key: 'feature:sales:quotes',        label: 'הצעות מחיר',              type: 'feature' },
        { key: 'feature:sales:invoices',      label: 'חשבוניות',                type: 'feature' },
        { key: 'feature:sales:new-quote-btn', label: 'כפתור: הצעה חדשה',        type: 'feature' },
      ]},
      { key: 'tab:customers', label: 'חברי מועדון 🤝',             type: 'tab', children: [
        { key: 'feature:customers:add',             label: 'חבר חדש',           type: 'feature' },
        { key: 'feature:customers:membership-status',label: 'סטטוס מנוי',       type: 'feature' },
        { key: 'feature:customers:freeze',          label: 'הקפאת מנוי',        type: 'feature' },
        { key: 'feature:customers:whatsapp',        label: 'שליחת WhatsApp',     type: 'feature' },
      ]},
      { key: 'tab:members',   label: 'צוות / מאמנים 👥',           type: 'tab', children: [
        { key: 'feature:members:add',         label: 'הוספת מאמן',             type: 'feature' },
        { key: 'feature:members:roles',       label: 'ניהול תפקידים',          type: 'feature' },
      ]},
      { key: 'tab:timeclock', label: 'נוכחות ⏱️',                 type: 'tab', children: [
        { key: 'feature:timeclock:manual-entry', label: 'כניסה ידנית',         type: 'feature' },
        { key: 'feature:timeclock:export',       label: 'ייצוא',                type: 'feature' },
      ]},
      { key: 'tab:cashflow',  label: 'תזרים 💸',                   type: 'tab', children: [
        { key: 'feature:cashflow:add-income',  label: 'הוספת הכנסה',           type: 'feature' },
        { key: 'feature:cashflow:add-expense', label: 'הוספת הוצאה',           type: 'feature' },
      ]},
      { key: 'tab:tasks',     label: 'משימות ✅',                   type: 'tab', children: [
        { key: 'feature:tasks:new-task',     label: 'משימה חדשה',              type: 'feature' },
        { key: 'feature:tasks:new-project',  label: 'פרויקט חדש',              type: 'feature' },
      ]},
      { key: 'tab:equipment', label: 'ציוד 🔧',                    type: 'tab', children: [
        { key: 'feature:equipment:add',          label: 'הוספת ציוד',          type: 'feature' },
        { key: 'feature:equipment:maintenance',  label: 'תזמון תחזוקה',        type: 'feature' },
      ]},
      { key: 'tab:shifts',    label: 'משמרות 🗓️',                  type: 'tab', children: [
        { key: 'feature:shifts:new-shift',   label: 'יצירת משמרת',             type: 'feature' },
        { key: 'feature:shifts:publish',     label: 'פרסום לוח',               type: 'feature' },
      ]},
    ]
  },

  beauty: {
    name: 'יופי / קוסמטיקה', icon: '💅',
    elements: [
      { key: 'tab:feed',                   label: 'ראשי 🏠',                        type: 'tab' },
      { key: 'tab:beauty_calendar',        label: 'יומן מטפלות 💆',                 type: 'tab', children: [
        { key: 'feature:beauty_calendar:new-appt',  label: 'תור חדש',             type: 'feature' },
        { key: 'feature:beauty_calendar:cancel',    label: 'ביטול תור',           type: 'feature' },
        { key: 'feature:beauty_calendar:reminder',  label: 'שליחת תזכורת',       type: 'feature' },
        { key: 'feature:beauty_calendar:online-booking', label: 'הזמנה אונליין',  type: 'feature' },
      ]},
      { key: 'tab:beauty_practitioners',   label: 'מטפלות 💆',                      type: 'tab', children: [
        { key: 'feature:beauty_practitioners:add',       label: 'הוספת מטפלת',    type: 'feature' },
        { key: 'feature:beauty_practitioners:schedule',  label: 'ניהול זמינות',   type: 'feature' },
        { key: 'feature:beauty_practitioners:commission',label: 'הגדרת עמלה',     type: 'feature' },
      ]},
      { key: 'tab:beauty_services',        label: 'שירותים וטיפולים 💎',            type: 'tab', children: [
        { key: 'feature:beauty_services:add',     label: 'טיפול חדש',             type: 'feature' },
        { key: 'feature:beauty_services:pricing', label: 'עריכת מחירון',          type: 'feature' },
        { key: 'feature:beauty_services:ai',      label: 'הצע עם AI',             type: 'feature' },
      ]},
      { key: 'tab:beauty_subscriptions',   label: 'מנויים וחבילות 🎁',              type: 'tab', children: [
        { key: 'feature:beauty_subscriptions:new',    label: 'חבילה חדשה',        type: 'feature' },
        { key: 'feature:beauty_subscriptions:assign', label: 'שיוך ללקוח',        type: 'feature' },
      ]},
      { key: 'tab:pos',                    label: 'קופה 💰',                        type: 'tab', children: [
        { key: 'feature:pos:sale',         label: 'מכירה',                         type: 'feature' },
        { key: 'feature:pos:receipts',     label: 'קבלות',                         type: 'feature' },
      ]},
      { key: 'tab:beauty_clients',         label: 'תיקי לקוחות 📋',                 type: 'tab', children: [
        { key: 'feature:beauty_clients:treatment-history', label: 'היסטוריית טיפולים',     type: 'feature' },
        { key: 'feature:beauty_clients:notes',             label: 'הערות / אלרגיות',       type: 'feature' },
        { key: 'feature:beauty_clients:photos',            label: 'תמונות לפני/אחרי',      type: 'feature' },
        { key: 'feature:beauty_clients:whatsapp',          label: 'שליחת WhatsApp',         type: 'feature' },
      ]},
      { key: 'tab:beauty_inventory',       label: 'מלאי מקצועי 🧴',                 type: 'tab', children: [
        { key: 'feature:beauty_inventory:add',   label: 'הוספת מוצר',             type: 'feature' },
        { key: 'feature:beauty_inventory:alert', label: 'התראות מלאי נמוך',       type: 'feature' },
      ]},
      { key: 'tab:beauty_commissions',     label: 'עמלות ושכר 💰',                  type: 'tab', children: [
        { key: 'feature:beauty_commissions:set-rate', label: 'הגדרת שיעור עמלה',  type: 'feature' },
        { key: 'feature:beauty_commissions:export',   label: 'ייצוא לחישוב שכר',  type: 'feature' },
      ]},
      { key: 'tab:beauty_rfq',             label: 'ייעוץ ובקשות 💬',                type: 'tab' },
      { key: 'tab:timeclock',              label: 'נוכחות ⏱️',                     type: 'tab', children: [
        { key: 'feature:timeclock:manual-entry', label: 'כניסה ידנית',            type: 'feature' },
        { key: 'feature:timeclock:export',       label: 'ייצוא',                   type: 'feature' },
      ]},
      { key: 'tab:cashflow',               label: 'תזרים 💸',                       type: 'tab', children: [
        { key: 'feature:cashflow:add-income',  label: 'הוספת הכנסה',              type: 'feature' },
        { key: 'feature:cashflow:add-expense', label: 'הוספת הוצאה',              type: 'feature' },
      ]},
      { key: 'tab:tasks',                  label: 'משימות ✅',                       type: 'tab', children: [
        { key: 'feature:tasks:new-task',  label: 'משימה חדשה',                    type: 'feature' },
      ]},
      { key: 'tab:shop',                   label: 'רכש ארגוני 🛒',                  type: 'tab' },
    ]
  },

  maintenance_repair: {
    name: 'תיקונים ותחזוקה', icon: '🔧',
    elements: [
      { key: 'tab:feed',      label: 'ראשי 🏠',                   type: 'tab' },
      { key: 'tab:calendar',  label: 'יומן ביקורים 📅',            type: 'tab', children: [
        { key: 'feature:calendar:new-event',     label: 'ביקור / אירוע חדש',     type: 'feature' },
        { key: 'feature:calendar:assign-tech',   label: 'שיוך טכנאי',            type: 'feature' },
        { key: 'feature:calendar:customer-link', label: 'שיוך לקוח',             type: 'feature' },
      ]},
      { key: 'tab:tasks',     label: 'קריאות שירות ✅',             type: 'tab', children: [
        { key: 'feature:tasks:new-task',     label: 'קריאה חדשה',                type: 'feature' },
        { key: 'feature:tasks:new-project',  label: 'פרויקט חדש',               type: 'feature' },
        { key: 'feature:tasks:kanban',       label: 'תצוגת קנבן',               type: 'feature' },
      ]},
      { key: 'tab:customers', label: 'לקוחות 🤝',                  type: 'tab', children: [
        { key: 'feature:customers:add',          label: 'הוספת לקוח',            type: 'feature' },
        { key: 'feature:customers:history',      label: 'היסטוריית שירות',       type: 'feature' },
        { key: 'feature:customers:whatsapp',     label: 'שליחת WhatsApp',         type: 'feature' },
        { key: 'feature:customers:equipment',    label: 'ציוד / נכסים של הלקוח', type: 'feature' },
      ]},
      { key: 'tab:members',   label: 'טכנאים / צוות 👥',           type: 'tab', children: [
        { key: 'feature:members:add',        label: 'הוספת טכנאי',              type: 'feature' },
        { key: 'feature:members:roles',      label: 'ניהול תפקידים',            type: 'feature' },
      ]},
      { key: 'tab:timeclock', label: 'נוכחות ⏱️',                 type: 'tab', children: [
        { key: 'feature:timeclock:manual-entry', label: 'כניסה ידנית',          type: 'feature' },
        { key: 'feature:timeclock:export',       label: 'ייצוא',                 type: 'feature' },
      ]},
      { key: 'tab:cashflow',  label: 'תזרים 💸',                   type: 'tab', children: [
        { key: 'feature:cashflow:add-income',  label: 'הוספת הכנסה',            type: 'feature' },
        { key: 'feature:cashflow:add-expense', label: 'הוספת הוצאה',            type: 'feature' },
      ]},
      { key: 'tab:pantry',    label: 'חלקי חילוף / מלאי 📦',      type: 'tab', children: [
        { key: 'feature:pantry:add-item',    label: 'הוספת פריט',               type: 'feature' },
        { key: 'feature:pantry:stock-take',  label: 'ספירת מלאי',               type: 'feature' },
        { key: 'feature:pantry:alerts',      label: 'התראות מלאי נמוך',         type: 'feature' },
      ]},
      { key: 'tab:shop',      label: 'רכש ארגוני 🛒',              type: 'tab' },
    ]
  },

  professional: {
    name: 'מקצועי / ייעוץ', icon: '👔',
    elements: [
      { key: 'tab:feed',      label: 'ראשי 🏠',                   type: 'tab' },
      { key: 'tab:sales',     label: 'מכירות / הצעות 🛍️',         type: 'tab', children: [
        { key: 'feature:sales:quotes',             label: 'הצעות מחיר',          type: 'feature' },
        { key: 'feature:sales:invoices',           label: 'חשבוניות',            type: 'feature' },
        { key: 'feature:sales:orders',             label: 'הזמנות',              type: 'feature' },
        { key: 'feature:sales:new-quote-btn',      label: 'כפתור: הצעה חדשה',    type: 'feature' },
        { key: 'feature:sales:convert-to-case',    label: 'המרה לתיק',           type: 'feature' },
      ]},
      { key: 'tab:customers', label: 'לקוחות 🤝',                  type: 'tab', children: [
        { key: 'feature:customers:add',      label: 'הוספת לקוח',               type: 'feature' },
        { key: 'feature:customers:whatsapp', label: 'שליחת WhatsApp',            type: 'feature' },
        { key: 'feature:customers:documents',label: 'מסמכי לקוח',               type: 'feature' },
        { key: 'feature:customers:history',  label: 'היסטוריית עסקאות',          type: 'feature' },
      ]},
      { key: 'tab:cases',     label: 'תיקים 📁',                   type: 'tab', children: [
        { key: 'feature:cases:new',           label: 'תיק חדש',                 type: 'feature' },
        { key: 'feature:cases:kickoff',       label: 'פגישת קיקאוף',            type: 'feature' },
        { key: 'feature:cases:summary-doc',   label: 'מסמך סיכום',              type: 'feature' },
        { key: 'feature:cases:team',          label: 'צוות התיק',               type: 'feature' },
        { key: 'feature:cases:costs',         label: 'עלויות ורווחיות',         type: 'feature' },
        { key: 'feature:cases:status-change', label: 'שינוי סטטוס',             type: 'feature' },
        { key: 'feature:cases:timelog-link',  label: 'שיוך שעות לתיק',          type: 'feature' },
      ]},
      { key: 'tab:leads',     label: 'פניות נכנסות 📥',             type: 'tab', children: [
        { key: 'feature:leads:convert',      label: 'המרה ללקוח',               type: 'feature' },
        { key: 'feature:leads:whatsapp',     label: 'שליחת WhatsApp',            type: 'feature' },
        { key: 'feature:leads:schedule',     label: 'קביעת פגישה',              type: 'feature' },
      ]},
      { key: 'tab:timelog',   label: 'שעות עבודה ⏱️',             type: 'tab', children: [
        { key: 'feature:timelog:timer',          label: 'טיימר חי',             type: 'feature' },
        { key: 'feature:timelog:manual-entry',   label: 'הזנה ידנית',           type: 'feature' },
        { key: 'feature:timelog:export-csv',     label: 'ייצוא CSV לשכר',        type: 'feature' },
        { key: 'feature:timelog:create-invoice', label: 'יצירת חשבונית מהשעות', type: 'feature' },
        { key: 'feature:timelog:wo-link',        label: 'שיוך לתיק',            type: 'feature' },
      ]},
      { key: 'tab:documents', label: 'מסמכים 📄',                  type: 'tab', children: [
        { key: 'feature:documents:new',        label: 'מסמך חדש',              type: 'feature' },
        { key: 'feature:documents:templates',  label: 'תבניות מסמכים',         type: 'feature' },
        { key: 'feature:documents:whatsapp',   label: 'שלח מסמך ללקוח',        type: 'feature' },
        { key: 'feature:documents:ai',         label: 'כתיבה עם AI',            type: 'feature' },
      ]},
      { key: 'tab:calendar',  label: 'יומן 📅',                    type: 'tab', children: [
        { key: 'feature:calendar:new-event', label: 'אירוע חדש',               type: 'feature' },
      ]},
      { key: 'tab:tasks',     label: 'משימות ✅',                   type: 'tab', children: [
        { key: 'feature:tasks:new-task',    label: 'משימה חדשה',               type: 'feature' },
        { key: 'feature:tasks:new-project', label: 'פרויקט חדש',               type: 'feature' },
      ]},
      { key: 'tab:cashflow',  label: 'תזרים 💸',                   type: 'tab', children: [
        { key: 'feature:cashflow:add-income',  label: 'הוספת הכנסה',           type: 'feature' },
        { key: 'feature:cashflow:add-expense', label: 'הוספת הוצאה',           type: 'feature' },
      ]},
      { key: 'tab:budget',    label: 'תקציב 📊',                   type: 'tab', children: [
        { key: 'feature:budget:set-limit',    label: 'הגדרת יעד',              type: 'feature' },
        { key: 'feature:budget:add-category', label: 'קטגוריה חדשה',           type: 'feature' },
      ]},
      { key: 'tab:members',   label: 'צוות 👥',                    type: 'tab', children: [
        { key: 'feature:members:add',   label: 'הוספת עובד',                   type: 'feature' },
        { key: 'feature:members:roles', label: 'ניהול תפקידים',                type: 'feature' },
      ]},
      { key: 'tab:timeclock', label: 'נוכחות ⏱️',                 type: 'tab', children: [
        { key: 'feature:timeclock:manual-entry', label: 'כניסה ידנית',         type: 'feature' },
        { key: 'feature:timeclock:export',       label: 'ייצוא',                type: 'feature' },
      ]},
      { key: 'tab:bank',      label: 'כספים 💳',                   type: 'tab', children: [
        { key: 'feature:bank:add-account',     label: 'הוספת חשבון',           type: 'feature' },
        { key: 'feature:bank:add-transaction', label: 'הוספת תנועה',           type: 'feature' },
      ]},
      { key: 'tab:content',   label: 'תוכן האתר 🌐',               type: 'tab', children: [
        { key: 'feature:content:hero',      label: 'כותרת ראשית (Hero)',        type: 'feature' },
        { key: 'feature:content:expertise', label: 'תחומי עיסוק',              type: 'feature' },
        { key: 'feature:content:articles',  label: 'מאמרים',                   type: 'feature' },
        { key: 'feature:content:about',     label: 'אודות',                    type: 'feature' },
        { key: 'feature:content:share',     label: 'שיתוף מאמרים',             type: 'feature' },
        { key: 'feature:content:ai-write',  label: 'כתיבת תוכן עם AI',         type: 'feature' },
      ]},
    ]
  },

  logistics: {
    name: 'לוגיסטיקה / הפצה', icon: '🚚',
    elements: [
      { key: 'tab:feed',                    label: 'ראשי 🏠',                       type: 'tab' },
      { key: 'tab:logistics_orders',        label: 'קנבן משלוחים 📦',               type: 'tab', children: [
        { key: 'feature:logistics_orders:new',          label: 'הזמנה חדשה',        type: 'feature' },
        { key: 'feature:logistics_orders:assign-driver',label: 'שיוך נהג',          type: 'feature' },
        { key: 'feature:logistics_orders:bulk-assign',  label: 'שיוך מרובה',        type: 'feature' },
        { key: 'feature:logistics_orders:export',       label: 'ייצוא',              type: 'feature' },
        { key: 'feature:logistics_orders:kanban-view',  label: 'תצוגת קנבן',        type: 'feature' },
      ]},
      { key: 'tab:logistics_drivers',       label: 'נהגים 🚗',                      type: 'tab', children: [
        { key: 'feature:logistics_drivers:add',      label: 'הוספת נהג',           type: 'feature' },
        { key: 'feature:logistics_drivers:map',      label: 'מיקום בזמן אמת',      type: 'feature' },
        { key: 'feature:logistics_drivers:assign',   label: 'שיוך משלוחים לנהג',   type: 'feature' },
      ]},
      { key: 'tab:logistics_vehicles',      label: 'צי רכבים 🚚',                   type: 'tab', children: [
        { key: 'feature:logistics_vehicles:add',         label: 'הוספת רכב',        type: 'feature' },
        { key: 'feature:logistics_vehicles:maintenance', label: 'תזמון תחזוקה',    type: 'feature' },
      ]},
      { key: 'tab:logistics_pricing',       label: 'מחירון 💰',                     type: 'tab', children: [
        { key: 'feature:logistics_pricing:add-zone',  label: 'הוספת אזור',         type: 'feature' },
        { key: 'feature:logistics_pricing:rates',     label: 'עדכון תעריפים',      type: 'feature' },
      ]},
      { key: 'tab:logistics_cod',           label: 'גבייה COD 💵',                  type: 'tab', children: [
        { key: 'feature:logistics_cod:collect',    label: 'רישום גבייה',           type: 'feature' },
        { key: 'feature:logistics_cod:reconcile',  label: 'התאמת גבייה',           type: 'feature' },
        { key: 'feature:logistics_cod:export',     label: 'ייצוא',                  type: 'feature' },
      ]},
      { key: 'tab:logistics_rfq',           label: 'הצעות מחיר 📋',                 type: 'tab', children: [
        { key: 'feature:logistics_rfq:new',  label: 'הצעה חדשה',                   type: 'feature' },
        { key: 'feature:logistics_rfq:send', label: 'שליחה ללקוח',                 type: 'feature' },
      ]},
      { key: 'tab:logistics_routes',        label: 'מסלולי חלוקה 🗺️',               type: 'tab', children: [
        { key: 'feature:logistics_routes:optimize',  label: 'אופטימיזציית מסלול',  type: 'feature' },
        { key: 'feature:logistics_routes:export',    label: 'ייצוא מסלול',          type: 'feature' },
      ]},
      { key: 'tab:logistics_tracking',      label: 'לינקי מעקב 🔗',                 type: 'tab', children: [
        { key: 'feature:logistics_tracking:send',    label: 'שליחת לינק מעקב',     type: 'feature' },
        { key: 'feature:logistics_tracking:sms',     label: 'שליחת SMS',            type: 'feature' },
      ]},
      { key: 'tab:logistics_reports',       label: 'דוחות 📊',                      type: 'tab', children: [
        { key: 'feature:logistics_reports:daily',             label: 'דוח יומי',           type: 'feature' },
        { key: 'feature:logistics_reports:driver-performance',label: 'ביצועי נהגים',       type: 'feature' },
        { key: 'feature:logistics_reports:export',            label: 'ייצוא לאקסל',        type: 'feature' },
      ]},
      { key: 'tab:logistics_customers',     label: 'מזמינים ונמענים 🤝',             type: 'tab', children: [
        { key: 'feature:logistics_customers:add',    label: 'הוספת לקוח',          type: 'feature' },
        { key: 'feature:logistics_customers:import', label: 'ייבוא רשימה',         type: 'feature' },
        { key: 'feature:logistics_customers:whatsapp',label: 'שליחת WhatsApp',      type: 'feature' },
      ]},
      { key: 'tab:logistics_invoices',      label: 'חשבוניות 🧾',                    type: 'tab', children: [
        { key: 'feature:logistics_invoices:new',    label: 'חשבונית חדשה',         type: 'feature' },
        { key: 'feature:logistics_invoices:export', label: 'ייצוא',                 type: 'feature' },
      ]},
      { key: 'tab:members',                 label: 'צוות 👥',                        type: 'tab', children: [
        { key: 'feature:members:add',       label: 'הוספת עובד',                   type: 'feature' },
      ]},
      { key: 'tab:timeclock',               label: 'נוכחות ⏱️',                    type: 'tab', children: [
        { key: 'feature:timeclock:manual-entry', label: 'כניסה ידנית',             type: 'feature' },
        { key: 'feature:timeclock:export',       label: 'ייצוא',                    type: 'feature' },
      ]},
      { key: 'tab:cashflow',                label: 'תזרים 💸',                       type: 'tab', children: [
        { key: 'feature:cashflow:add-income',  label: 'הוספת הכנסה',              type: 'feature' },
        { key: 'feature:cashflow:add-expense', label: 'הוספת הוצאה',              type: 'feature' },
      ]},
      { key: 'tab:tasks',                   label: 'משימות ✅',                       type: 'tab', children: [
        { key: 'feature:tasks:new-task',  label: 'משימה חדשה',                     type: 'feature' },
      ]},
    ]
  }
};

let _vizHiddenKeys = {};
let _vizCurrentType = 'restaurant';
let _vizLoaded = false;

window.loadBizTemplates = async function() {
    if (_vizLoaded) { renderBizTemplatesView(_vizCurrentType); return; }
    const container = document.getElementById('viz-loading');
    if (container) container.classList.remove('hidden');
    try {
        const types = Object.keys(BIZ_TEMPLATE_TREE);
        await Promise.all(types.map(async type => {
            try {
                const res = await fetch(`${API}/sa/biz-visibility/${type}`, { headers: { Authorization: saToken } });
                const data = await res.json();
                _vizHiddenKeys[type] = new Set(data.hiddenKeys || []);
            } catch(e) { _vizHiddenKeys[type] = new Set(); }
        }));
        _vizLoaded = true;
    } catch(e) {}
    if (container) container.classList.add('hidden');
    renderBizTemplatesView(_vizCurrentType);
};

function renderBizTemplatesView(type) {
    _vizCurrentType = type;
    // Update type selector buttons
    Object.keys(BIZ_TEMPLATE_TREE).forEach(t => {
        const btn = document.getElementById(`viz-type-${t}`);
        if (!btn) return;
        if (t === type) {
            btn.className = btn.className.replace(/bg-white\s+text-slate-600\s+border-slate-200|bg-emerald-600\s+text-white\s+border-emerald-600/g, '').trim();
            btn.className += ' bg-emerald-600 text-white border-emerald-600';
        } else {
            btn.className = btn.className.replace(/bg-emerald-600\s+text-white\s+border-emerald-600/g, '').trim();
            btn.className += ' bg-white text-slate-600 border-slate-200';
        }
    });

    const tree = BIZ_TEMPLATE_TREE[type];
    if (!tree) return;
    const hidden = _vizHiddenKeys[type] || new Set();
    const total = countElements(tree.elements);
    const hiddenCount = hidden.size;

    const statsEl = document.getElementById('viz-stats');
    if (statsEl) statsEl.innerHTML = `
        <div class="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
            <div class="text-xl font-black text-slate-800">${total}</div>
            <div class="text-[10px] text-slate-400">סה"כ אלמנטים</div>
        </div>
        <div class="text-center px-4 py-2 bg-red-50 rounded-xl border border-red-100">
            <div class="text-xl font-black text-red-600">${hiddenCount}</div>
            <div class="text-[10px] text-slate-400">מוסתרים</div>
        </div>
        <div class="text-center px-4 py-2 bg-green-50 rounded-xl border border-green-100">
            <div class="text-xl font-black text-green-600">${total - hiddenCount}</div>
            <div class="text-[10px] text-slate-400">פעילים</div>
        </div>`;

    const container = document.getElementById('viz-elements-container');
    if (!container) return;
    container.innerHTML = tree.elements.map(el => renderVizElement(type, el, hidden, 0)).join('');
}

function countElements(elements) {
    let n = 0;
    (elements||[]).forEach(el => { n++; if (el.children) n += countElements(el.children); });
    return n;
}

function renderVizElement(type, el, hidden, depth) {
    const isHidden = hidden.has(el.key);
    const ml = depth > 0 ? `style="margin-right:${depth * 20}px"` : '';
    const bgCls = el.type === 'tab' ? 'bg-slate-50 border-slate-200' :
                  el.type === 'subtab' ? 'bg-blue-50 border-blue-100' :
                  'bg-white border-slate-100';
    const typeBadge = el.type === 'tab'
        ? '<span class="text-[9px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">טאב</span>'
        : el.type === 'subtab'
        ? '<span class="text-[9px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">תת-טאב</span>'
        : '<span class="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">פיצ׳ר</span>';
    const opacityCls = isHidden ? 'opacity-50' : '';
    const labelCls = isHidden ? 'text-slate-400 line-through' : (depth === 0 ? 'text-slate-800 font-bold' : 'text-slate-700 font-medium');

    let html = `<div ${ml} class="mb-1.5">
        <div class="flex items-center justify-between px-3 py-2 rounded-xl border ${bgCls} ${opacityCls} transition-all">
            <div class="flex items-center gap-2 min-w-0">
                ${typeBadge}
                <span class="text-sm ${labelCls} truncate">${el.label}</span>
                ${isHidden ? '<span class="text-[9px] text-red-500 font-bold shrink-0">● מוסתר</span>' : ''}
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0 mr-2">
                <input type="checkbox" ${isHidden ? '' : 'checked'} onchange="window.toggleVizElement('${type}','${el.key}',!this.checked)" class="sr-only peer">
                <div class="w-10 h-5 bg-red-300 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
            </label>
        </div>
        ${el.children ? el.children.map(child => renderVizElement(type, child, hidden, depth + 1)).join('') : ''}
    </div>`;
    return html;
}

window.toggleVizElement = async function(type, key, makeHidden) {
    try {
        const res = await fetch(`${API}/sa/biz-visibility/${type}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ key, hidden: makeHidden })
        });
        const data = await res.json();
        if (!data.success) throw new Error();
        if (makeHidden) {
            _vizHiddenKeys[type] = _vizHiddenKeys[type] || new Set();
            _vizHiddenKeys[type].add(key);
        } else {
            _vizHiddenKeys[type]?.delete(key);
        }
        renderBizTemplatesView(type);
        const tree = BIZ_TEMPLATE_TREE[type];
        const name = tree?.elements.find(e=>e.key===key)?.label ||
                     tree?.elements.flatMap(e=>e.children||[]).find(e=>e.key===key)?.label || key;
        showSAToast(makeHidden ? `🔴 "${name}" הוסתר` : `✅ "${name}" הוצג`);
    } catch(e) { showSAToast('❌ שגיאה בשמירה'); }
};

function showSAToast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xl z-[99999] transition-all';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

// ============================================================
// --- COMMUNITY ADVANCED FEATURES (SA UI) ---
// ============================================================

// --- Feature 1: Promotions approval panel ---
window.openSAPromotionsPanel = async function() {
    const existing = document.getElementById('sa-promotions-panel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'sa-promotions-panel';
    panel.className = 'fixed inset-0 z-[9999] bg-white flex flex-col';
    panel.innerHTML = `
        <div class="px-4 py-3 border-b flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 shrink-0">
            <button onclick="document.getElementById('sa-promotions-panel').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
            <h3 class="font-bold text-base text-slate-800">📢 אישור מבצעים שיווקיים</h3>
        </div>
        <div id="sa-promos-list" class="overflow-y-auto flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto"><p class="text-slate-400 text-sm text-center py-8">טוען...</p></div>`;
    document.body.appendChild(panel);
    try {
        const res = await fetch(`${API}/sa/community/promotions`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const list = data.promotions || [];
        const el = document.getElementById('sa-promos-list');
        if (!list.length) { el.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">אין מבצעים ממתינים לאישור</p>'; return; }
        el.innerHTML = list.map(p => `
        <div class="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <div class="font-bold text-slate-800">${safeStr(p.title)}</div>
                    <div class="text-xs text-slate-500">${safeStr(p.business_name)} → ${safeStr(p.community_name)}</div>
                    ${p.discount_pct > 0 ? `<div class="text-xs text-green-600 font-bold mt-1">הנחה: ${p.discount_pct}%</div>` : ''}
                    ${p.valid_until ? `<div class="text-xs text-orange-500">בתוקף עד: ${p.valid_until?.slice(0,10)}</div>` : ''}
                </div>
            </div>
            ${p.content ? `<p class="text-sm text-slate-600 mb-3 bg-slate-50 rounded-lg p-2">${safeStr(p.content)}</p>` : ''}
            <div class="flex gap-2">
                <button onclick="saApprovePromo(${p.id},'approved',this)" class="flex-1 bg-green-100 text-green-700 py-1.5 rounded-lg text-sm font-bold hover:bg-green-200 transition">✅ אשר</button>
                <button onclick="saApprovePromo(${p.id},'rejected',this)" class="flex-1 bg-red-100 text-red-600 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200 transition">❌ דחה</button>
            </div>
        </div>`).join('');
    } catch(e) { document.getElementById('sa-promos-list').innerHTML = '<p class="text-red-400 text-sm text-center py-8">שגיאה בטעינה</p>'; }
};

window.saApprovePromo = async function(id, status, btn) {
    btn.disabled = true;
    try {
        await fetch(`${API}/sa/community/promotions/${id}/status`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ status })
        });
        btn.closest('.bg-white').remove();
        showSAToast(status === 'approved' ? '✅ מבצע אושר!' : '❌ מבצע נדחה');
    } catch(e) { showSAToast('שגיאה'); btn.disabled = false; }
};

// --- Feature 2: Match score display (called from existing community table) ---
window.openMatchScorePanel = async function(bizId, bizName) {
    const existing = document.getElementById('sa-match-panel');
    if (existing) existing.remove();
    const panel = document.createElement('div');
    panel.id = 'sa-match-panel';
    panel.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';
    panel.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div class="p-4 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-indigo-50">
            <h3 class="font-bold text-lg text-slate-800">🎯 התאמת קהילות — ${safeStr(bizName)}</h3>
            <button onclick="document.getElementById('sa-match-panel').remove()" class="text-slate-400 hover:text-red-500 text-2xl leading-none">&times;</button>
        </div>
        <div id="sa-match-list" class="overflow-y-auto p-4 flex-1"><p class="text-slate-400 text-sm text-center py-8">מחשב התאמות...</p></div>
    </div>`;
    document.body.appendChild(panel);
    try {
        const res = await fetch(`${API}/biz/communities/match/${bizId}`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const list = (data.communities || []).slice(0, 15);
        const el = document.getElementById('sa-match-list');
        if (!list.length) { el.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">לא נמצאו קהילות</p>'; return; }
        el.innerHTML = list.map(c => {
            const score = c.match_score || 0;
            const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-slate-300';
            return `<div class="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                <div class="w-12 text-center">
                    <div class="text-lg font-black ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-slate-400'}">${score}%</div>
                </div>
                <div class="flex-1">
                    <div class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</div>
                    <div class="text-xs text-slate-500">${safeStr(c.city || '')} · ${c.family_count || 0} משפחות · ${c.biz_count || 0} עסקים</div>
                </div>
                <div class="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div class="${color} h-2 rounded-full transition-all" style="width:${score}%"></div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { document.getElementById('sa-match-list').innerHTML = '<p class="text-red-400 text-sm text-center py-8">שגיאה בטעינה</p>'; }
};

// --- Feature 3: Referrals panel ---
window.openSAReferralsPanel = async function() {
    const existing = document.getElementById('sa-referrals-panel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'sa-referrals-panel';
    panel.className = 'fixed inset-0 z-[9999] bg-white flex flex-col';
    panel.innerHTML = `
        <div class="px-4 py-3 border-b flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-amber-50 shrink-0">
            <button onclick="document.getElementById('sa-referrals-panel').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
            <div>
                <h3 class="font-bold text-base text-slate-800">🌟 שגרירי קהילה — הפניות עסקים</h3>
                <p class="text-xs text-slate-500 mt-0.5">נקודות FLOW (35 לממליץ + 15 לקהילה) זוכות אוטומטית. הסכום כאן הוא בונוס נוסף לארנק קהילה.</p>
            </div>
        </div>
        <div id="sa-referrals-list" class="overflow-y-auto flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto"><p class="text-slate-400 text-sm text-center py-8">טוען...</p></div>`;
    document.body.appendChild(panel);
    try {
        const res = await fetch(`${API}/sa/community/referrals`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const list = data.referrals || [];
        const el = document.getElementById('sa-referrals-list');
        if (!list.length) { el.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">אין הפניות עדיין</p>'; return; }
        el.innerHTML = list.map(r => `
        <div class="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm">
            <div class="flex justify-between items-start">
                <div>
                    <div class="font-bold text-slate-800 text-sm">${safeStr(r.business_name)}</div>
                    <div class="text-xs text-slate-500">הופנה ע"י: <strong>${safeStr(r.referrer_name)}</strong> → ${safeStr(r.community_name)}</div>
                    <div class="text-xs text-slate-400">${new Date(r.created_at).toLocaleDateString('he-IL')}</div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}">${r.status === 'approved' ? '✅ אושר' : r.status === 'rejected' ? '❌ נדחה' : '⏳ ממתין'}</span>
            </div>
            ${r.status === 'pending' ? `
            <div class="flex gap-2 mt-3 items-center">
                <input type="number" id="reward-${r.id}" value="50" min="0" class="border rounded-lg px-2 py-1 text-xs w-24 text-left" placeholder="נקודות">
                <button onclick="saApproveReferral(${r.id},document.getElementById('reward-${r.id}').value)" class="flex-1 bg-green-100 text-green-700 py-1.5 rounded-lg text-sm font-bold hover:bg-green-200 transition">✅ אשר + בונוס</button>
            </div>` : r.reward_points > 0 ? `<div class="text-xs text-green-600 mt-1">🎁 בונוס שניתן: ${r.reward_points} נקודות</div>` : ''}
        </div>`).join('');
    } catch(e) { document.getElementById('sa-referrals-list').innerHTML = '<p class="text-red-400 text-sm text-center py-8">שגיאה</p>'; }
};

window.saApproveReferral = async function(id, pts) {
    try {
        await fetch(`${API}/sa/community/referrals/${id}/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ rewardPoints: parseFloat(pts) || 50 })
        });
        showSAToast('✅ הפניה אושרה + בונוס זוכה!');
        openSAReferralsPanel(); openSAReferralsPanel(); // close & reopen
    } catch(e) { showSAToast('שגיאה'); }
};

// --- Feature 4: Interest tags management (per community) ---
window.openInterestTagsModal = async function(communityId, communityName) {
    const existing = document.getElementById('sa-interest-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'sa-interest-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-4 border-b flex justify-between items-center bg-gradient-to-r from-teal-50 to-cyan-50">
            <h3 class="font-bold text-lg text-slate-800">🏷️ תגיות עניין — ${safeStr(communityName)}</h3>
            <button onclick="document.getElementById('sa-interest-modal').remove()" class="text-slate-400 hover:text-red-500 text-2xl leading-none">&times;</button>
        </div>
        <div class="p-4">
            <p class="text-xs text-slate-500 mb-3">הגדר תגיות שמתארות את הקהילה (למשל: כושר, יופי, ילדים, אוכל בריא). מאפשר לעסקים למצוא קהילות לפי תחום עניין — אפילו בערים אחרות.</p>
            <div id="interest-chips" class="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 border rounded-xl bg-slate-50"></div>
            <div class="flex gap-2">
                <input type="text" id="interest-tag-input" placeholder="תגית חדשה..." class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" onkeydown="if(event.key==='Enter')addInterestChip()">
                <button onclick="addInterestChip()" class="bg-teal-100 text-teal-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-teal-200 transition">+ הוסף</button>
            </div>
            <div class="flex flex-wrap gap-2 mt-3 mb-4">
                ${['כושר','יופי','קוסמטיקה','ילדים','בריאות','אוכל אורגני','לוגיסטיקה','טכנולוגיה','חינוך','חיות מחמד'].map(t =>
                    `<button onclick="addInterestChipValue('${t}')" class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full hover:bg-teal-100 hover:text-teal-700 transition">${t}</button>`
                ).join('')}
            </div>
            <button onclick="saveInterestTags(${communityId})" class="w-full bg-teal-600 text-white py-2.5 rounded-xl font-bold hover:bg-teal-700 transition">💾 שמור תגיות</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    modal._tags = [];
    try {
        const res = await fetch(`${API}/sa/communities/${communityId}/interests`, { headers: { Authorization: saToken } });
        const data = await res.json();
        modal._tags = data.tags || [];
        renderInterestChips(modal._tags);
    } catch(e) {}
};

function renderInterestChips(tags) {
    const el = document.getElementById('interest-chips');
    if (!el) return;
    const modal = document.getElementById('sa-interest-modal');
    el.innerHTML = tags.length ? tags.map(t => `
        <span class="bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
            ${safeStr(t)}
            <button onclick="removeInterestChip('${t.replace(/'/g,"\\'")}') " class="text-teal-400 hover:text-red-500 leading-none font-black">×</button>
        </span>`).join('') : '<span class="text-xs text-slate-400">טרם נוספו תגיות</span>';
}

window.addInterestChip = function() {
    const inp = document.getElementById('interest-tag-input');
    if (!inp || !inp.value.trim()) return;
    addInterestChipValue(inp.value.trim());
    inp.value = '';
};

window.addInterestChipValue = function(val) {
    const modal = document.getElementById('sa-interest-modal');
    if (!modal || !val) return;
    if (!modal._tags) modal._tags = [];
    if (!modal._tags.includes(val)) { modal._tags.push(val); renderInterestChips(modal._tags); }
};

window.removeInterestChip = function(val) {
    const modal = document.getElementById('sa-interest-modal');
    if (!modal) return;
    modal._tags = (modal._tags || []).filter(t => t !== val);
    renderInterestChips(modal._tags);
};

window.saveInterestTags = async function(communityId) {
    const modal = document.getElementById('sa-interest-modal');
    if (!modal) return;
    try {
        await fetch(`${API}/sa/communities/${communityId}/interests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ tags: modal._tags || [] })
        });
        showSAToast('✅ תגיות עניין נשמרו!');
        modal.remove();
    } catch(e) { showSAToast('שגיאה'); }
};

// --- Feature 5: Communities Map (SA) ---
window.openCommunitiesMap = async function() {
    const existing = document.getElementById('sa-comm-map-panel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'sa-comm-map-panel';
    panel.className = 'fixed inset-0 z-[9999] bg-white flex flex-col';
    panel.innerHTML = `
        <div class="px-4 py-3 border-b flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
            <button onclick="document.getElementById('sa-comm-map-panel').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
            <h3 class="font-bold text-base text-slate-800">🗺️ מפת קהילות אינטראקטיבית</h3>
        </div>
        <div id="sa-map-content" class="overflow-y-auto flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto"><p class="text-slate-400 text-sm text-center py-8">טוען נתוני מפה...</p></div>`;
    document.body.appendChild(panel);
    try {
        const res = await fetch(`${API}/sa/communities/map-data`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const el = document.getElementById('sa-map-content');
        if (data.error) { el.innerHTML = `<p class="text-red-400 text-sm text-center py-8">שגיאה: ${safeStr(data.error)}</p>`; return; }
        const comms = data.communities || [];
        if (!comms.length) { el.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">אין קהילות לתצוגה</p>'; return; }

        // Group by city for visual map
        const cities = {};
        comms.forEach(c => {
            const city = c.city || 'לא ידוע';
            if (!cities[city]) cities[city] = [];
            cities[city].push(c);
        });

        let html = `<div class="mb-4 grid grid-cols-3 gap-3">
            <div class="bg-blue-50 rounded-xl p-3 text-center"><div class="text-2xl font-black text-blue-700">${comms.length}</div><div class="text-xs text-blue-500">קהילות</div></div>
            <div class="bg-green-50 rounded-xl p-3 text-center"><div class="text-2xl font-black text-green-700">${comms.reduce((s,c)=>s+parseInt(c.family_count||0),0)}</div><div class="text-xs text-green-500">משפחות</div></div>
            <div class="bg-purple-50 rounded-xl p-3 text-center"><div class="text-2xl font-black text-purple-700">${comms.reduce((s,c)=>s+parseInt(c.biz_count||0),0)}</div><div class="text-xs text-purple-500">עסקים</div></div>
        </div>`;

        html += `<div class="space-y-4">` + Object.entries(cities).map(([city, cs]) => `
        <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2 flex justify-between items-center">
                <div class="font-bold text-slate-700 flex items-center gap-2"><span class="text-blue-500">📍</span> ${safeStr(city)}</div>
                <span class="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border">${cs.length} קהילות</span>
            </div>
            <div class="divide-y divide-slate-100">${cs.map(c => {
                const typeLabel = c.community_type === 'interest' ? '<span class="bg-purple-100 text-purple-600 text-[10px] font-bold px-1.5 py-0.5 rounded">עניין</span>' : '<span class="bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded">גאוגרפי</span>';
                const statusDot = c.status === 'active' ? '🟢' : '🔴';
                const tags = c.interest_tags ? c.interest_tags.split(',').filter(Boolean).map(t => `<span class="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded">${t.trim()}</span>`).join('') : '';
                return `<div class="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                    <div>
                        <div class="font-bold text-slate-800 text-sm flex items-center gap-2">${statusDot} ${safeStr(c.name)} ${typeLabel}</div>
                        ${tags ? `<div class="flex flex-wrap gap-1 mt-1">${tags}</div>` : ''}
                    </div>
                    <div class="flex gap-3 text-xs text-slate-500 items-center">
                        <span class="flex items-center gap-1"><i class="fa-solid fa-users text-blue-300"></i> ${c.family_count}</span>
                        <span class="flex items-center gap-1"><i class="fa-solid fa-store text-green-300"></i> ${c.biz_count}</span>
                        ${parseInt(c.pending_biz||0) > 0 ? `<span class="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">${c.pending_biz} ממתין</span>` : ''}
                    </div>
                </div>`;
            }).join('')}</div>
        </div>`).join('') + `</div>`;
        el.innerHTML = html;
    } catch(e) { document.getElementById('sa-map-content').innerHTML = '<p class="text-red-400 text-sm text-center py-8">שגיאה בטעינה</p>'; }
};

// --- Feature: Business Match Standalone Panel ---
window.openBusinessMatchStandalonePanel = function() {
    const existing = document.getElementById('sa-biz-match-standalone');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'sa-biz-match-standalone';
    panel.className = 'fixed inset-0 z-[9999] bg-white flex flex-col';
    panel.innerHTML = `
        <div class="px-4 py-3 border-b flex items-center gap-3 bg-gradient-to-r from-purple-50 to-indigo-50 shrink-0">
            <button onclick="document.getElementById('sa-biz-match-standalone').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
            <div>
                <h3 class="font-bold text-base text-slate-800">🎯 התאמת קהילות לעסק</h3>
                <p class="text-[11px] text-slate-500">בדוק אילו קהילות מתאימות לעסק לפי מיקום, גודל וסוג</p>
            </div>
        </div>
        <div class="p-4 border-b bg-slate-50 shrink-0">
            <div class="relative max-w-md">
                <i class="fa-solid fa-search absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
                <input type="text" id="biz-match-search" placeholder="חפש שם עסק, קוד, עיר..." autocomplete="off"
                    class="w-full border border-slate-200 rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-white"
                    oninput="filterBizMatchSearch(this.value)">
                <div id="biz-match-dropdown" class="hidden absolute top-full right-0 left-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto z-10"></div>
            </div>
            <div id="biz-match-selected" class="mt-2 hidden">
                <span class="text-xs text-purple-700 font-bold bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100" id="biz-match-selected-label"></span>
                <button onclick="clearBizMatchSelection()" class="text-xs text-slate-400 hover:text-red-500 mr-2">✕ נקה</button>
            </div>
        </div>
        <div id="sa-biz-match-results" class="overflow-y-auto flex-1 p-4 max-w-2xl w-full mx-auto">
            <p class="text-slate-400 text-sm text-center py-12">חפש וסנן עסק כדי לראות התאמת קהילות</p>
        </div>`;
    document.body.appendChild(panel);

    // Close dropdown when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeDrop(e) {
            if (!document.getElementById('biz-match-search')?.contains(e.target) &&
                !document.getElementById('biz-match-dropdown')?.contains(e.target)) {
                document.getElementById('biz-match-dropdown')?.classList.add('hidden');
                document.removeEventListener('click', closeDrop);
            }
        });
    }, 0);
};

window.filterBizMatchSearch = function(q) {
    const dd = document.getElementById('biz-match-dropdown');
    if (!dd) return;
    const bizList = saBusinessesCache || [];
    const term = q.trim().toLowerCase();
    if (!term) { dd.classList.add('hidden'); return; }
    const hits = bizList.filter(b =>
        (b.name||'').toLowerCase().includes(term) ||
        (b.group_code||'').toLowerCase().includes(term) ||
        (b.city||'').toLowerCase().includes(term) ||
        (b.address_city||'').toLowerCase().includes(term)
    ).slice(0, 20);
    if (!hits.length) {
        dd.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">לא נמצאו עסקים</p>';
    } else {
        dd.innerHTML = hits.map(b => `
            <div class="px-3 py-2.5 hover:bg-purple-50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0"
                 onclick="selectBizForMatch(${b.id}, '${safeStr(b.name).replace(/'/g,"\\'")}', '${safeStr(b.city||b.address_city||'').replace(/'/g,"\\'")}')">
                <div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 text-xs font-bold">${safeStr(b.name||'?')[0]}</div>
                <div>
                    <div class="text-sm font-bold text-slate-800">${safeStr(b.name)}</div>
                    <div class="text-[10px] text-slate-500">${safeStr(b.group_code||'')} · ${safeStr(b.city||b.address_city||'')}</div>
                </div>
            </div>`).join('');
    }
    dd.classList.remove('hidden');
};

window.selectBizForMatch = function(bizId, bizName, bizCity) {
    const inp = document.getElementById('biz-match-search');
    const dd = document.getElementById('biz-match-dropdown');
    const sel = document.getElementById('biz-match-selected');
    const lbl = document.getElementById('biz-match-selected-label');
    if (inp) inp.value = '';
    if (dd) dd.classList.add('hidden');
    if (lbl) lbl.textContent = `${bizName}${bizCity ? ' · ' + bizCity : ''}`;
    if (sel) sel.classList.remove('hidden');
    loadMatchForSelectedBiz(bizId, bizName);
};

window.clearBizMatchSelection = function() {
    const sel = document.getElementById('biz-match-selected');
    const el = document.getElementById('sa-biz-match-results');
    if (sel) sel.classList.add('hidden');
    if (el) el.innerHTML = '<p class="text-slate-400 text-sm text-center py-12">חפש וסנן עסק כדי לראות התאמת קהילות</p>';
};

window.loadMatchForSelectedBiz = async function(bizId, bizName) {
    const el = document.getElementById('sa-biz-match-results');
    if (!bizId || !el) return;
    el.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">מחשב התאמות...</p>';
    try {
        const res = await fetch(`${API}/biz/communities/match/${bizId}`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const list = (data.communities || []).slice(0, 20);
        if (!list.length) { el.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">לא נמצאו קהילות</p>'; return; }
        el.innerHTML = `<h4 class="font-bold text-slate-700 text-sm mb-3">קהילות מותאמות עבור: ${safeStr(bizName)}</h4>` + list.map(c => {
            const score = c.match_score || 0;
            const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-slate-300';
            const scoreColor = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-slate-400';
            return `<div class="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                <div class="w-14 text-center">
                    <div class="text-xl font-black ${scoreColor}">${score}%</div>
                </div>
                <div class="flex-1">
                    <div class="font-bold text-slate-800 text-sm">${safeStr(c.name)}</div>
                    <div class="text-xs text-slate-500">${safeStr(c.city || '')} · ${c.family_count || 0} משפחות · ${c.biz_count || 0} עסקים</div>
                </div>
                <div class="w-28 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div class="${color} h-2.5 rounded-full" style="width:${score}%"></div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-sm text-center py-8">שגיאה בטעינה</p>'; }
};

// --- Feature: SA Banner Requests Panel ---
window.openSABannerRequestsPanel = async function() {
    const existing = document.getElementById('sa-banner-req-panel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'sa-banner-req-panel';
    panel.className = 'fixed inset-0 z-[9999] bg-white flex flex-col';
    panel.innerHTML = `
        <div class="px-4 py-3 border-b flex items-center gap-3 bg-gradient-to-r from-pink-50 to-rose-50 shrink-0">
            <button onclick="document.getElementById('sa-banner-req-panel').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
            <h3 class="font-bold text-base text-slate-800">🖼️ בקשות קידום באנר</h3>
        </div>
        <div id="sa-banner-list" class="overflow-y-auto flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto"><p class="text-slate-400 text-sm text-center py-8">טוען...</p></div>`;
    document.body.appendChild(panel);
    await loadSABannerRequests();
};

async function loadSABannerRequests() {
    const el = document.getElementById('sa-banner-list');
    if (!el) return;
    try {
        const res = await fetch(`${API}/sa/community/banner-requests`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const list = data.requests || [];
        if (!list.length) { el.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">אין בקשות באנר עדיין</p>'; return; }
        el.innerHTML = list.map(b => {
            const statusTag = b.status === 'approved'
                ? `<span class="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">✅ פעיל ${b.start_date ? b.start_date.slice(0,10) : ''} — ${b.end_date ? b.end_date.slice(0,10) : ''}</span>`
                : b.status === 'rejected'
                ? `<span class="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">❌ נדחה</span>`
                : `<span class="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">⏳ ממתין לאישור</span>`;
            return `<div class="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm" id="banner-req-${b.id}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="font-bold text-slate-800">${safeStr(b.promo_title)}</div>
                        <div class="text-xs text-slate-500">${safeStr(b.business_name)} → ${safeStr(b.community_name)}</div>
                        ${b.discount_pct > 0 ? `<div class="text-xs text-green-600 font-bold">הנחה: ${b.discount_pct}%</div>` : ''}
                    </div>
                    ${statusTag}
                </div>
                ${b.banner_headline ? `<div class="bg-gradient-to-l from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg px-3 py-2 mb-2 text-sm font-bold text-indigo-800">💬 "${safeStr(b.banner_headline)}"</div>` : ''}
                ${b.promo_content ? `<p class="text-xs text-slate-600 mb-2 bg-slate-50 rounded p-2">${safeStr(b.promo_content)}</p>` : ''}
                ${b.status === 'approved' ? `<div class="text-[10px] text-slate-400 mt-1">מיקום: <span class="font-bold text-indigo-600">${b.position || 5}</span>/10</div>` : ''}
                ${b.status === 'pending' ? `
                <div class="space-y-2 mt-3">
                    <div class="flex gap-2">
                        <div class="flex-1">
                            <label class="text-[10px] font-bold text-slate-500 block mb-0.5">תחילת הצגה</label>
                            <input type="date" id="banner-start-${b.id}" class="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs">
                        </div>
                        <div class="flex-1">
                            <label class="text-[10px] font-bold text-slate-500 block mb-0.5">סיום הצגה</label>
                            <input type="date" id="banner-end-${b.id}" class="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs">
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 block mb-0.5">כותרת באנר</label>
                        <div class="flex gap-1">
                            <input type="text" id="banner-headline-${b.id}" value="${safeStr(b.banner_headline || '')}" placeholder="כותרת שיווקית..." class="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                            <button onclick="generateBannerAI(${b.id})" class="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-bold hover:bg-purple-200 transition">🤖 AI</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 block mb-0.5">מיקום בעמוד הבית (1 = ראשון, 10 = אחרון)</label>
                        <div class="flex items-center gap-2">
                            <input type="range" id="banner-position-${b.id}" min="1" max="10" value="5" class="flex-1 accent-indigo-500" oninput="document.getElementById('banner-pos-val-${b.id}').textContent=this.value">
                            <span id="banner-pos-val-${b.id}" class="text-sm font-black text-indigo-600 w-6 text-center">5</span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="approveBannerRequest(${b.id},'approved')" class="flex-1 bg-green-100 text-green-700 py-1.5 rounded-lg text-sm font-bold hover:bg-green-200 transition">✅ אשר ופרסם</button>
                        <button onclick="approveBannerRequest(${b.id},'rejected')" class="flex-1 bg-red-100 text-red-600 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200 transition">❌ דחה</button>
                    </div>
                </div>` : ''}
            </div>`;
        }).join('');
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-sm text-center py-8">שגיאה בטעינה</p>'; }
}

window.generateBannerAI = async function(id) {
    const btn = document.querySelector(`#banner-req-${id} button[onclick="generateBannerAI(${id})"]`);
    if (btn) btn.textContent = '⏳';
    try {
        const res = await fetch(`${API}/sa/community/banner-ai/${id}`, { method: 'POST', headers: { Authorization: saToken } });
        const data = await res.json();
        if (data.headline) {
            const inp = document.getElementById(`banner-headline-${id}`);
            if (inp) inp.value = data.headline;
            showSAToast('🤖 כותרת AI נוצרה!');
        } else showSAToast('שגיאה: ' + (data.error || 'AI לא זמין'));
    } catch(e) { showSAToast('שגיאה'); }
    if (btn) btn.textContent = '🤖 AI';
};

window.approveBannerRequest = async function(id, status) {
    const startDate = document.getElementById(`banner-start-${id}`)?.value;
    const endDate = document.getElementById(`banner-end-${id}`)?.value;
    const bannerHeadline = document.getElementById(`banner-headline-${id}`)?.value?.trim();
    const position = parseInt(document.getElementById(`banner-position-${id}`)?.value) || 5;
    if (status === 'approved' && (!startDate || !endDate)) { showSAToast('⚠️ יש להזין תאריך התחלה וסיום'); return; }
    try {
        await fetch(`${API}/sa/community/banner-requests/${id}/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ status, startDate: startDate || null, endDate: endDate || null, bannerHeadline: bannerHeadline || null, position })
        });
        showSAToast(status === 'approved' ? '✅ באנר אושר ופורסם!' : '❌ בקשה נדחתה');
        loadSABannerRequests();
    } catch(e) { showSAToast('שגיאה'); }
};

// --- Feature 6: Community Bundles ---
window.openSABundlesPanel = async function() {
    const existing = document.getElementById('sa-bundles-panel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'sa-bundles-panel';
    panel.className = 'fixed inset-0 z-[9999] bg-white flex flex-col';
    panel.innerHTML = `
        <div class="px-4 py-3 border-b flex justify-between items-center bg-gradient-to-r from-emerald-50 to-green-50 shrink-0">
            <div class="flex items-center gap-3">
                <button onclick="document.getElementById('sa-bundles-panel').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
                <h3 class="font-bold text-base text-slate-800">📦 חבילות קהילה</h3>
            </div>
            <button onclick="openCreateBundleForm()" class="bg-emerald-600 text-white px-4 py-1.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition">+ חבילה חדשה</button>
        </div>
        <div id="sa-bundles-list" class="overflow-y-auto flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto"><p class="text-slate-400 text-sm text-center py-8">טוען...</p></div>`;
    document.body.appendChild(panel);
    await loadSABundles();
};

async function loadSABundles() {
    const el = document.getElementById('sa-bundles-list');
    if (!el) return;
    try {
        const res = await fetch(`${API}/sa/community/bundles`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const list = data.bundles || [];
        if (!list.length) { el.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">אין חבילות קהילה. לחץ + חדש ליצירה</p>'; return; }
        el.innerHTML = list.map(b => `
        <div class="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <div class="font-bold text-slate-800">${safeStr(b.name)}</div>
                    <div class="text-xs text-slate-500">${safeStr(b.community_name)}</div>
                    ${b.discount_pct > 0 ? `<div class="text-xs text-green-600 font-bold">הנחת חבילה: ${b.discount_pct}%</div>` : ''}
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full font-bold ${b.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">${b.status === 'active' ? '✅ פעיל' : '🔴 לא פעיל'}</span>
            </div>
            ${b.description ? `<p class="text-xs text-slate-600 mb-2">${safeStr(b.description)}</p>` : ''}
            <div class="flex flex-wrap gap-1.5 mb-3">
                ${(b.business_names || []).map(n => `<span class="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">${safeStr(n)}</span>`).join('')}
            </div>
            <button onclick="toggleBundleStatus(${b.id},'${b.status === 'active' ? 'inactive' : 'active'}')" class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition font-bold">${b.status === 'active' ? '🔴 השבת' : '✅ הפעל'}</button>
        </div>`).join('');
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-sm text-center py-8">שגיאה</p>'; }
}

window.toggleBundleStatus = async function(id, status) {
    try {
        await fetch(`${API}/sa/community/bundles/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ status })
        });
        showSAToast(status === 'active' ? '✅ החבילה הופעלה' : '🔴 החבילה הושבתה');
        loadSABundles();
    } catch(e) { showSAToast('שגיאה'); }
};

window.openCreateBundleForm = function() {
    const existing = document.getElementById('sa-bundle-create-modal');
    if (existing) { existing.remove(); return; }
    const comms = saCommunitiesCache || [];
    const modal = document.createElement('div');
    modal.id = 'sa-bundle-create-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-white flex flex-col';
    modal.innerHTML = `
        <div class="px-4 py-3 border-b flex items-center gap-3 shrink-0">
            <button onclick="document.getElementById('sa-bundle-create-modal').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
            <h3 class="font-bold text-base">📦 יצירת חבילת קהילה</h3>
        </div>
        <div class="overflow-y-auto flex-1 p-4 md:p-6 max-w-2xl w-full mx-auto space-y-3">
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">קהילה</label>
                <select id="bundle-community-id" onchange="loadBundleBusinesses()" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">בחר קהילה...</option>
                    ${comms.map(c => `<option value="${c.id}">${safeStr(c.name)}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">שם החבילה</label>
                <input type="text" id="bundle-name" placeholder="למשל: חבילת יופי + כושר" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
            </div>
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">תיאור (אופציונלי)</label>
                <textarea id="bundle-desc" rows="2" placeholder="תיאור הטבות החבילה..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"></textarea>
            </div>
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">אחוז הנחת חבילה</label>
                <input type="number" id="bundle-discount" value="0" min="0" max="50" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
            </div>
            <div>
                <label class="text-xs font-bold text-slate-600 mb-1 block">עסקים בחבילה (בחר לפחות 2)</label>
                <div id="bundle-businesses-list" class="border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto">
                    <p class="text-xs text-slate-400 text-center py-2">בחר קהילה תחילה</p>
                </div>
            </div>
            <button onclick="createCommunityBundle()" class="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition">✅ צור חבילה</button>
        </div>`;
    document.body.appendChild(modal);
};

window.loadBundleBusinesses = async function() {
    const commId = document.getElementById('bundle-community-id')?.value;
    const el = document.getElementById('bundle-businesses-list');
    if (!el || !commId) return;
    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">טוען עסקים...</p>';
    try {
        const res = await fetch(`${API}/sa/community-business/${commId}`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const bizList = data.connections || [];
        if (!bizList.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">אין עסקים בקהילה זו</p>'; return; }
        el.innerHTML = bizList.map(b => `
            <label class="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-sm">
                <input type="checkbox" value="${b.business_id}" class="bundle-biz-check rounded">
                <span class="font-medium text-slate-700">${safeStr(b.business_name)}</span>
                ${b.discount_pct > 0 ? `<span class="text-xs text-green-600">${b.discount_pct}%</span>` : ''}
            </label>`).join('');
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-xs text-center py-2">שגיאה</p>'; }
};

window.createCommunityBundle = async function() {
    const communityId = document.getElementById('bundle-community-id')?.value;
    const name = document.getElementById('bundle-name')?.value?.trim();
    const description = document.getElementById('bundle-desc')?.value?.trim();
    const discountPct = parseFloat(document.getElementById('bundle-discount')?.value) || 0;
    const checked = Array.from(document.querySelectorAll('.bundle-biz-check:checked')).map(c => parseInt(c.value));
    if (!communityId || !name || checked.length < 2) { showSAToast('⚠️ נדרשים קהילה, שם ולפחות 2 עסקים'); return; }
    try {
        const res = await fetch(`${API}/sa/community/bundles`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ communityId: parseInt(communityId), name, description, discountPct, businessIds: checked })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        showSAToast('✅ חבילת קהילה נוצרה!');
        document.getElementById('sa-bundle-create-modal')?.remove();
        loadSABundles();
    } catch(e) { showSAToast('שגיאה: ' + e.message); }
};

// ─── FLOW REWARDS CONFIG (SA) ────────────────────────────────

const FLOW_CONFIG_LABELS = {
    // משפחה
    join_community:        '👨‍👩‍👧 הצטרפות לקהילה חדשה',
    referral:              '👨‍👩‍👧 הפניית שכן שהצטרף לקהילה',
    promo_redemption:      '👨‍👩‍👧 מימוש מבצע עסק בקהילה',
    profile_complete:      '👨‍👩‍👧 מילוי פרופיל משפחתי מלא',
    review_business:       '👨‍👩‍👧 כתיבת ביקורת על עסק',
    bundle_purchase:       '👨‍👩‍👧 רכישת חבילת קהילה',
    daily_login:           '👨‍👩‍👧 כניסה יומית לאפליקציה',
    ambassador_approved:   '👨‍👩‍👧 שגריר — עסק שאושר לקהילה',
    // עסק
    biz_join_approved:     '🏪 עסק — בקשת הצטרפות אושרה',
    biz_promo_approved:    '🏪 עסק — מבצע אושר ע"י SA',
    biz_promo_redeemed:    '🏪 עסק — מבצע מומש ע"י משפחה',
    biz_bundle_sold:       '🏪 עסק — חבילה נמכרה',
    biz_review_received:   '🏪 עסק — קיבל ביקורת חיובית (4–5 ⭐)',
    biz_lead_received:     '🏪 עסק — קיבל פנייה דרך הקהילה',
    // כללי
    promo_community:       '📊 קהילה — מבצע מומש (רק לקהילה)',
    bundle_community:      '📊 קהילה — חבילה נמכרה (רק לקהילה)',
    flow_to_ils_rate:      '⚙️ שיעור המרה: כמה Flw = ₪10 הנחה',
    flow_min_redeem:       '🔒 מינימום Flw למימוש הנחה',
    flow_redeem_quarter:   '📅 תוקף מימוש — רבעון קלנדרי (0=ללא)',
};

window.openFlowConfigPanel = async function() {
    const existing = document.getElementById('sa-flow-config-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'sa-flow-config-panel';
    panel.className = 'fixed inset-0 z-[9999] bg-white flex flex-col';
    panel.innerHTML = `
        <div class="px-4 py-3 border-b flex justify-between items-center bg-gradient-to-r from-amber-50 to-yellow-50 shrink-0">
            <div class="flex items-center gap-3">
                <button onclick="document.getElementById('sa-flow-config-panel').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
                <div>
                    <h3 class="font-black text-slate-800 text-base">⚡ ניהול מטבע FLOW</h3>
                    <p class="text-xs text-slate-500 mt-0.5">שנה כל ערך ולחץ שמור — השינוי נכנס לתוקף מיידית</p>
                </div>
            </div>
            <div class="flex gap-2 items-center">
                <button onclick="openFlowStatsPanel()" class="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl font-bold hover:bg-blue-200 transition">📊 סטטיסטיקות</button>
                <button onclick="saveFlowConfig()" class="text-xs bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-xl font-bold transition shadow-sm">💾 שמור</button>
            </div>
        </div>
        <div class="overflow-y-auto flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto">
            <div id="flow-config-loading" class="text-center py-10 text-slate-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
            </div>
            <div id="flow-config-table" class="hidden"></div>
        </div>
        <div class="px-4 py-3 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
            <button onclick="document.getElementById('sa-flow-config-panel').remove()" class="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">ביטול</button>
            <button onclick="saveFlowConfig()" class="px-6 py-2 text-sm font-black text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition shadow-md">💾 שמור הכל</button>
        </div>`;
    document.body.appendChild(panel);

    try {
        const res = await fetch(`${API}/sa/flow/config`, { headers: { Authorization: saToken } });
        const data = await res.json();
        document.getElementById('flow-config-loading').classList.add('hidden');
        const table = document.getElementById('flow-config-table');
        table.classList.remove('hidden');
        const specialKeys = ['flow_min_redeem', 'flow_redeem_quarter', 'flow_to_ils_rate'];
        const specialRows = Object.fromEntries(data.config.filter(r => specialKeys.includes(r.key)).map(r => [r.key, r]));
        const mainRows = data.config.filter(r => !specialKeys.includes(r.key));
        const minRedeemVal = parseFloat(specialRows.flow_min_redeem?.personal_amount) || 100;
        const quarterVal = parseInt(specialRows.flow_redeem_quarter?.personal_amount) || 0;
        const rateVal = parseFloat(specialRows.flow_to_ils_rate?.personal_amount) || 100;

        table.innerHTML = `
        <!-- Section מיוחד: הגדרות מימוש -->
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <h4 class="font-black text-amber-800 text-sm mb-3">⚙️ הגדרות מימוש מטבעות</h4>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div class="bg-white rounded-xl border border-amber-100 p-3" data-key="flow_to_ils_rate">
                    <div class="text-xs font-bold text-slate-600 mb-1">שיעור המרה</div>
                    <div class="text-[10px] text-slate-400 mb-2">כמה Flw = ₪10 הנחה</div>
                    <div class="flex items-center gap-1">
                        <input type="number" min="1" step="1" value="${rateVal}" class="flow-cfg-personal w-20 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-amber-300 outline-none">
                        <span class="text-xs text-slate-500">Flw = ₪10</span>
                    </div>
                    <input type="hidden" class="flow-cfg-community" value="0">
                </div>
                <div class="bg-white rounded-xl border border-amber-100 p-3" data-key="flow_min_redeem">
                    <div class="text-xs font-bold text-slate-600 mb-1">מינימום למימוש</div>
                    <div class="text-[10px] text-slate-400 mb-2">מינימום Flw נדרש לקבלת קוד הנחה</div>
                    <div class="flex items-center gap-1">
                        <input type="number" min="0" step="10" value="${minRedeemVal}" class="flow-cfg-personal w-20 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-amber-300 outline-none">
                        <span class="text-xs text-slate-500">Flw</span>
                    </div>
                    <input type="hidden" class="flow-cfg-community" value="0">
                </div>
                <div class="bg-white rounded-xl border border-amber-100 p-3" data-key="flow_redeem_quarter">
                    <div class="text-xs font-bold text-slate-600 mb-1">תוקף קוד מימוש</div>
                    <div class="text-[10px] text-slate-400 mb-2">קודים יפוגו בסוף הרבעון שנבחר</div>
                    <select class="flow-cfg-personal w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-amber-300 outline-none">
                        <option value="0" ${quarterVal===0?'selected':''}>ללא תוקף</option>
                        <option value="1" ${quarterVal===1?'selected':''}>Q1 — עד 31 מרץ</option>
                        <option value="2" ${quarterVal===2?'selected':''}>Q2 — עד 30 יוני</option>
                        <option value="3" ${quarterVal===3?'selected':''}>Q3 — עד 30 ספטמבר</option>
                        <option value="4" ${quarterVal===4?'selected':''}>Q4 — עד 31 דצמבר</option>
                    </select>
                    <input type="hidden" class="flow-cfg-community" value="0">
                </div>
            </div>
        </div>

        <!-- טבלת פעולות -->
        <table class="w-full text-sm border-collapse">
            <thead>
                <tr class="bg-slate-100 text-slate-600 text-xs">
                    <th class="text-right p-3 rounded-tl-xl font-bold">פעולה</th>
                    <th class="text-center p-3 font-bold">Flw אישי<br><span class="font-normal text-[10px]">(למשפחה)</span></th>
                    <th class="text-center p-3 rounded-tr-xl font-bold">Flw קהילה<br><span class="font-normal text-[10px]">(לארנק הקהילה)</span></th>
                </tr>
            </thead>
            <tbody>
                ${mainRows.map(row => `
                <tr class="border-b border-slate-100 hover:bg-amber-50 transition" data-key="${row.key}">
                    <td class="p-3 font-medium text-slate-700">${FLOW_CONFIG_LABELS[row.key] || row.key}<br><span class="text-[10px] text-slate-400 font-mono">${row.key}</span></td>
                    <td class="p-3 text-center">
                        <input type="number" min="0" step="1" value="${row.personal_amount}"
                            class="flow-cfg-personal w-20 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-amber-300 outline-none">
                    </td>
                    <td class="p-3 text-center">
                        <input type="number" min="0" step="1" value="${row.community_amount}"
                            class="flow-cfg-community w-20 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-amber-300 outline-none">
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
        <p class="text-xs text-slate-400 mt-3 text-center">* שיעור ההמרה: Flw בשורת "שיעור המרה" = ₪10 הנחה. לדוגמה: 100 Flw = ₪10</p>`;
    } catch(e) { showSAToast('שגיאה בטעינת הגדרות FLOW'); }
};

window.saveFlowConfig = async function() {
    // שורות הטבלה הראשית (tr) + תאי ה-section המיוחד (div)
    const allElements = document.querySelectorAll('#flow-config-table [data-key]');
    const items = Array.from(allElements).map(el => ({
        key: el.dataset.key,
        personal_amount: parseFloat(el.querySelector('.flow-cfg-personal')?.value) || 0,
        community_amount: parseFloat(el.querySelector('.flow-cfg-community')?.value) || 0,
    }));
    try {
        const res = await fetch(`${API}/sa/flow/config`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ items })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        showSAToast('✅ הגדרות FLOW נשמרו בהצלחה!');
        document.getElementById('sa-flow-config-panel').remove();
    } catch(e) { showSAToast('שגיאה: ' + e.message); }
};

window.openFlowStatsPanel = async function() {
    const existing = document.getElementById('sa-flow-stats-panel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'sa-flow-stats-panel';
    panel.className = 'fixed inset-0 z-[10000] bg-white flex flex-col';
    panel.innerHTML = `
        <div class="px-4 py-3 border-b flex justify-between items-center bg-gradient-to-r from-amber-50 to-yellow-50 shrink-0">
            <div class="flex items-center gap-3">
                <button onclick="document.getElementById('sa-flow-stats-panel').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition text-lg leading-none">←</button>
                <div>
                    <h3 class="font-black text-slate-800 text-base">📊 לוח בקרה FLOW</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">מפת צבירה בזמן אמת לכל ישות במערכת</p>
                </div>
            </div>
            <button onclick="refreshFlowDashboard()" class="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl font-bold hover:bg-amber-200 transition">🔄 רענן</button>
        </div>
        <!-- Tabs -->
        <div class="flex border-b shrink-0 bg-slate-50 overflow-x-auto">
            ${[['overview','🏆 מובילים'],['map','🗺️ מפת Flw'],['log','📋 פעילות'],['grant','🎁 הענקה']].map(([k,l],i) =>
                `<button onclick="switchFlowTab('${k}')" id="flow-tab-${k}" class="flex-1 min-w-[80px] py-3 text-xs font-bold transition border-b-2 whitespace-nowrap px-2 ${i===0?'border-amber-500 text-amber-700 bg-white':'border-transparent text-slate-500 hover:text-slate-700'}">${l}</button>`
            ).join('')}
        </div>
        <div class="overflow-y-auto flex-1 p-4 md:p-6">
            <div class="max-w-5xl mx-auto">
                <div id="flow-tab-content" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>
            </div>
        </div>`;
    document.body.appendChild(panel);
    await refreshFlowDashboard('overview');
};

window._flowDashData = null;
window._flowActiveTab = 'overview';

window.switchFlowTab = function(tab) {
    window._flowActiveTab = tab;
    document.querySelectorAll('[id^="flow-tab-"]').forEach(b => {
        const active = b.id === `flow-tab-${tab}`;
        b.className = `flex-1 py-2.5 text-xs font-bold transition border-b-2 ${active ? 'border-amber-500 text-amber-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`;
    });
    renderFlowTab(tab, window._flowDashData);
};

window.refreshFlowDashboard = async function(tab) {
    tab = tab || window._flowActiveTab || 'overview';
    const content = document.getElementById('flow-tab-content');
    if (content) content.innerHTML = '<div class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';
    try {
        const [stats, leaderboard, txs] = await Promise.all([
            fetch(`${API}/sa/flow/stats`, { headers: { Authorization: saToken } }).then(r => r.json()),
            fetch(`${API}/sa/flow/leaderboard?entityType=all&limit=100`, { headers: { Authorization: saToken } }).then(r => r.json()),
            fetch(`${API}/sa/flow/transactions?limit=30`, { headers: { Authorization: saToken } }).then(r => r.json())
        ]);
        window._flowDashData = { stats, leaderboard, txs };
        renderFlowTab(tab, window._flowDashData);
    } catch(e) { if(content) content.innerHTML = '<p class="text-red-500 text-sm text-center py-8">שגיאה בטעינת נתונים</p>'; }
};

function renderFlowTab(tab, d) {
    const content = document.getElementById('flow-tab-content');
    if (!content || !d) return;
    if (tab === 'overview') {
        const s = d.stats;
        const issued = parseFloat(s.totalIssued||0), redeemed = parseFloat(s.totalRedeemed||0);
        const pct = issued > 0 ? Math.round(redeemed/issued*100) : 0;
        // Mini bar chart (30 days)
        const days = s.byDay || [];
        const maxVal = Math.max(...days.map(d=>parseFloat(d.issued||0)), 1);
        const chartHtml = days.length ? `
        <div class="mb-4">
            <h4 class="font-bold text-slate-700 text-sm mb-2">📈 הנפקת Flw — 30 ימים אחרונים</h4>
            <div class="flex items-end gap-0.5 h-16 bg-slate-50 rounded-xl px-2 py-2">
                ${days.map(d => {
                    const h = Math.max(4, Math.round(parseFloat(d.issued||0)/maxVal*48));
                    return `<div class="flex-1 bg-amber-400 rounded-t" style="height:${h}px" title="${d.day}: Flw${parseFloat(d.issued).toFixed(0)}"></div>`;
                }).join('')}
            </div>
            <div class="flex justify-between text-[9px] text-slate-400 mt-1 px-2">
                <span>${days[0]?.day||''}</span><span>${days[days.length-1]?.day||''}</span>
            </div>
        </div>` : '';
        const wc = {};
        (s.walletCount||[]).forEach(r => wc[r.entity_type] = r);
        content.innerHTML = `
        <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                <div class="text-2xl font-black text-amber-600">Flw${Math.round(issued).toLocaleString('he-IL')}</div>
                <div class="text-[10px] text-slate-500 mt-0.5">סך הונפק</div>
            </div>
            <div class="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
                <div class="text-2xl font-black text-green-600">Flw${Math.round(redeemed).toLocaleString('he-IL')}</div>
                <div class="text-[10px] text-slate-500 mt-0.5">מומש (${pct}%)</div>
            </div>
            <div class="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                <div class="text-2xl font-black text-blue-600">Flw${Math.round(issued-redeemed).toLocaleString('he-IL')}</div>
                <div class="text-[10px] text-slate-500 mt-0.5">במחזור</div>
            </div>
        </div>
        ${chartHtml}
        <div class="grid grid-cols-3 gap-3">
            <div>
                <h4 class="font-bold text-slate-700 text-sm mb-2">👨‍👩‍👧 משפחות</h4>
                <div class="text-[10px] text-slate-400 mb-1">${wc.family?.cnt||0} ארנקות · Flw${Math.round(wc.family?.total_balance||0).toLocaleString()}</div>
                ${(s.topFamilies||[]).map((f,i) => `<div class="flex justify-between text-xs py-1 border-b border-slate-100"><span class="truncate max-w-[80px]">${i+1}. ${safeStr(f.name)}</span><span class="font-bold text-amber-600 shrink-0">Flw${Math.round(f.balance)}</span></div>`).join('') || '<p class="text-xs text-slate-400">אין נתונים</p>'}
            </div>
            <div>
                <h4 class="font-bold text-slate-700 text-sm mb-2">🏪 עסקים</h4>
                <div class="text-[10px] text-slate-400 mb-1">${wc.business?.cnt||0} ארנקות · Flw${Math.round(wc.business?.total_balance||0).toLocaleString()}</div>
                ${(s.topBusinesses||[]).map((b,i) => `<div class="flex justify-between text-xs py-1 border-b border-slate-100"><span class="truncate max-w-[80px]">${i+1}. ${safeStr(b.name)}</span><span class="font-bold text-purple-600 shrink-0">Flw${Math.round(b.balance)}</span></div>`).join('') || '<p class="text-xs text-slate-400">אין נתונים</p>'}
            </div>
            <div>
                <h4 class="font-bold text-slate-700 text-sm mb-2">🏘️ קהילות</h4>
                <div class="text-[10px] text-slate-400 mb-1">${wc.community?.cnt||0} ארנקות · Flw${Math.round(wc.community?.total_balance||0).toLocaleString()}</div>
                ${(s.topCommunities||[]).map((c,i) => `<div class="flex justify-between text-xs py-1 border-b border-slate-100"><span class="truncate max-w-[80px]">${i+1}. ${safeStr(c.name)}</span><span class="font-bold text-emerald-600 shrink-0">Flw${Math.round(c.balance)}</span></div>`).join('') || '<p class="text-xs text-slate-400">אין נתונים</p>'}
            </div>
        </div>`;
    } else if (tab === 'map') {
        const entities = d.leaderboard?.entities || [];
        const typeIcon = {family:'👨‍👩‍👧', business:'🏪', community:'🏘️'};
        const typeColor = {family:'text-amber-600', business:'text-purple-600', community:'text-emerald-600'};
        const maxBal = Math.max(...entities.map(e=>parseFloat(e.balance||0)), 1);
        content.innerHTML = `
        <div class="mb-3 flex gap-2">
            ${['all','family','business','community'].map(t =>
                `<button onclick="filterFlowMap('${t}')" id="flow-map-filter-${t}" class="text-xs px-3 py-1 rounded-full font-bold border transition ${t==='all'?'bg-amber-500 text-white border-amber-500':'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}">${{all:'הכל',family:'משפחות',business:'עסקים',community:'קהילות'}[t]}</button>`
            ).join('')}
        </div>
        <div id="flow-map-rows">
            ${entities.map((e,i) => {
                const bal = parseFloat(e.balance||0);
                const barW = Math.max(2, Math.round(bal/maxBal*100));
                return `<div class="flex items-center gap-2 py-1.5 border-b border-slate-50 flow-map-row" data-type="${e.type}">
                    <span class="text-sm shrink-0">${typeIcon[e.type]||'?'}</span>
                    <span class="text-xs text-slate-700 w-32 truncate shrink-0">${safeStr(e.name)}</span>
                    <div class="flex-1 bg-slate-100 rounded-full h-2">
                        <div class="h-2 rounded-full bg-amber-400" style="width:${barW}%"></div>
                    </div>
                    <span class="text-xs font-black ${typeColor[e.type]||''} shrink-0 w-16 text-left">Flw${Math.round(bal).toLocaleString()}</span>
                    <button onclick="openFlowGrantFor('${e.type}',${e.id},'${safeStr(e.name).replace(/'/g,'')}')" class="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold shrink-0">הענק</button>
                </div>`;
            }).join('') || '<p class="text-sm text-slate-400 text-center py-8">אין ישויות עם Flw עדיין</p>'}
        </div>`;
    } else if (tab === 'log') {
        const txs = d.txs?.transactions || [];
        const typeIcon = {family:'👨‍👩‍👧', business:'🏪', community:'🏘️'};
        content.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h4 class="font-bold text-slate-700 text-sm">פעילות אחרונה — 30 עסקאות</h4>
            <select onchange="filterFlowLog(this.value)" class="text-xs border border-slate-200 rounded-lg px-2 py-1">
                <option value="all">הכל</option>
                <option value="family">משפחות</option>
                <option value="business">עסקים</option>
                <option value="community">קהילות</option>
            </select>
        </div>
        <div id="flow-log-rows" class="space-y-1">
            ${txs.map(t => {
                const amt = parseFloat(t.amount);
                const d = new Date(t.created_at);
                return `<div class="flex items-center gap-2 py-2 border-b border-slate-50 text-xs flow-log-row" data-type="${t.entity_type}">
                    <span class="shrink-0">${typeIcon[t.entity_type]||'?'}</span>
                    <span class="text-slate-600 flex-1 truncate">${safeStr(t.entity_name||'')} — ${safeStr(t.description||'')}</span>
                    <span class="font-black shrink-0 ${amt>0?'text-green-600':'text-red-500'}">${amt>0?'+':''}${amt.toFixed(0)} Flw</span>
                    <span class="text-slate-400 shrink-0 text-[10px]">${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>`;
            }).join('') || '<p class="text-sm text-slate-400 text-center py-8">אין פעילות עדיין</p>'}
        </div>`;
    } else if (tab === 'grant') {
        content.innerHTML = `
        <div class="max-w-sm mx-auto">
            <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
                <p class="text-xs text-amber-700 font-medium">הענקה ידנית מאפשרת לך לתת או להוריד Flw מכל ישות. שימוש לתיקון, פרסים, או פיצויים.</p>
            </div>
            <div class="space-y-3">
                <div>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">סוג ישות</label>
                    <select id="grant-entity-type" onchange="loadGrantEntities()" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                        <option value="">— בחר סוג —</option>
                        <option value="family">👨‍👩‍👧 משפחה</option>
                        <option value="business">🏪 עסק</option>
                        <option value="community">🏘️ קהילה</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">שם הישות</label>
                    <input type="text" id="grant-entity-search" oninput="loadGrantEntities()" placeholder="חפש לפי שם..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    <select id="grant-entity-id" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-2 hidden">
                        <option value="">— בחר ישות —</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">כמות Flw (שלילי = הפחתה)</label>
                    <input type="number" id="grant-amount" placeholder="לדוגמה: 50 או -20" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-amber-600">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">סיבה (תוצג בלוג)</label>
                    <input type="text" id="grant-reason" placeholder="לדוגמה: פרס חודש, תיקון שגיאה..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                </div>
                <button onclick="submitFlowGrant()" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-2xl text-sm transition shadow-md">⚡ בצע הענקה</button>
                <div id="grant-result" class="hidden"></div>
            </div>
        </div>`;
    }
}

window.filterFlowMap = function(type) {
    document.querySelectorAll('[id^="flow-map-filter-"]').forEach(b => {
        const active = b.id === `flow-map-filter-${type}`;
        b.className = `text-xs px-3 py-1 rounded-full font-bold border transition ${active ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`;
    });
    document.querySelectorAll('.flow-map-row').forEach(r => {
        r.style.display = (type === 'all' || r.dataset.type === type) ? '' : 'none';
    });
};

window.filterFlowLog = function(type) {
    document.querySelectorAll('.flow-log-row').forEach(r => {
        r.style.display = (type === 'all' || r.dataset.type === type) ? '' : 'none';
    });
};

window.openFlowGrantFor = function(entityType, entityId, name) {
    switchFlowTab('grant');
    setTimeout(() => {
        const typeEl = document.getElementById('grant-entity-type');
        if (typeEl) { typeEl.value = entityType; loadGrantEntities(entityId, name); }
    }, 100);
};

window.loadGrantEntities = async function(presetId, presetName) {
    const type = document.getElementById('grant-entity-type')?.value;
    const search = document.getElementById('grant-entity-search')?.value?.trim();
    const sel = document.getElementById('grant-entity-id');
    if (!sel || !type) return;
    sel.classList.remove('hidden');
    if (presetId) {
        sel.innerHTML = `<option value="${presetId}">${safeStr(presetName||'')}</option>`;
        sel.value = presetId;
        return;
    }
    try {
        let url = type === 'community'
            ? `${API}/sa/communities`
            : `${API}/sa/groups?type=${type}&search=${encodeURIComponent(search||'')}`;
        const res = await fetch(url, { headers: { Authorization: saToken } });
        const data = await res.json();
        const items = data.communities || data.groups || [];
        sel.innerHTML = '<option value="">— בחר —</option>' + items.slice(0,30).map(i => `<option value="${i.id}">${safeStr(i.name)}</option>`).join('');
    } catch(e) {}
};

window.submitFlowGrant = async function() {
    const entityType = document.getElementById('grant-entity-type')?.value;
    const entityId = document.getElementById('grant-entity-id')?.value;
    const amount = document.getElementById('grant-amount')?.value;
    const reason = document.getElementById('grant-reason')?.value?.trim();
    const result = document.getElementById('grant-result');
    if (!entityType || !entityId || !amount || !reason) { showSAToast('⚠️ יש למלא את כל השדות'); return; }
    try {
        const res = await fetch(`${API}/sa/flow/grant`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ entityType, entityId: parseInt(entityId), amount: parseFloat(amount), reason })
        });
        const data = await res.json();
        if (data.success) {
            result.classList.remove('hidden');
            const amt = parseFloat(amount);
            result.innerHTML = `<div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-green-700 text-sm font-bold">✅ ${amt>0?'+':''}${amt} Flw הועברו בהצלחה</div>`;
            showSAToast('✅ הענקה בוצעה!');
            setTimeout(() => refreshFlowDashboard('overview'), 1500);
        } else throw new Error(data.error);
    } catch(e) { showSAToast('שגיאה: ' + e.message); }
};

// ═══════════════════════════════════════════════════════════
// שטחי פרסום — SA panel
// ═══════════════════════════════════════════════════════════
const AD_SLOT_DEFS = [
    { key: 'splash',               label: '🏠 מסך טעינה — משפחה (Splash)' },
    { key: 'splash_biz',           label: '💼 מסך טעינה — עסק (Splash)' },
    { key: 'balance_side',         label: 'כרטיס יתרה — צד (2/3)' },
    { key: 'flow',                 label: 'מתחת לבאנר FLOW' },
    { key: 'shop_top',             label: 'מעל "סופר חכם"' },
    { key: 'shop_list',            label: 'בין פריטי קניות' },
    { key: 'supermarket_splash',   label: 'אחרי "אני בסופר" (Splash)' },
    { key: 'pantry_top',           label: 'עמוד מזווה — מעל' },
    { key: 'home_maint_top',       label: 'עמוד ניהול הבית — מעל' },
    { key: 'bank_top',             label: 'עמוד בנק — מעל' },
    { key: 'cashflow_top',         label: 'עמוד תזרים — מעל' },
    { key: 'budget_top',           label: 'עמוד תקציב — מעל' },
    { key: 'forecast_top',         label: 'עמוד תחזית — מעל' },
    { key: 'tasks_top',            label: 'עמוד משימות — מעל' },
    { key: 'academy_top',          label: 'עמוד אקדמיה — מעל' },
    { key: 'community_top',        label: 'עמוד קהילה — מעל' },
];

// ─── Cloudinary Config ────────────────────────────────────────────────────────
window.saveCldConfig = async function() {
    const cloudName = document.getElementById('cld-cloud-name')?.value?.trim();
    const preset = document.getElementById('cld-upload-preset')?.value?.trim();
    const statusEl = document.getElementById('cld-config-status');
    if (!cloudName || !preset) { if(statusEl){statusEl.textContent='❌ יש למלא שני השדות'; statusEl.className='text-xs font-bold text-red-600'; statusEl.classList.remove('hidden');} return; }
    try {
        await Promise.all([
            fetch(`${API}/sa/settings`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:saToken}, body: JSON.stringify({key:'cloudinary_cloud_name', value:cloudName}) }),
            fetch(`${API}/sa/settings`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:saToken}, body: JSON.stringify({key:'cloudinary_upload_preset', value:preset}) }),
        ]);
        if(statusEl){statusEl.textContent='✅ נשמר!'; statusEl.className='text-xs font-bold text-green-600'; statusEl.classList.remove('hidden'); setTimeout(()=>statusEl.classList.add('hidden'),2500);}
    } catch(e) { if(statusEl){statusEl.textContent='❌ שגיאה'; statusEl.className='text-xs font-bold text-red-600'; statusEl.classList.remove('hidden');} }
};

async function loadCldConfig() {
    try {
        const res = await fetch(`${API}/sa/settings/cloudinary_cloud_name,cloudinary_upload_preset,preloader_text`, { headers:{Authorization:saToken} });
        const data = await res.json();
        if(data.cloudinary_cloud_name) document.getElementById('cld-cloud-name').value = data.cloudinary_cloud_name;
        if(data.cloudinary_upload_preset) document.getElementById('cld-upload-preset').value = data.cloudinary_upload_preset;
        if(data.preloader_text) { const el = document.getElementById('preloader-text-input'); if(el) el.value = data.preloader_text; }
    } catch(e){}
}

window.savePreloaderText = async function() {
    const text = document.getElementById('preloader-text-input')?.value?.trim();
    const statusEl = document.getElementById('preloader-text-status');
    if (!text) return;
    try {
        const res = await fetch(`${API}/sa/settings`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:saToken}, body: JSON.stringify({key:'preloader_text', value:text}) });
        const data = await res.json();
        if(data.success) { if(statusEl){statusEl.textContent='✅ נשמר!'; statusEl.className='text-xs font-bold text-green-600'; statusEl.classList.remove('hidden'); setTimeout(()=>statusEl.classList.add('hidden'),2500);} }
        else throw new Error();
    } catch(e) { if(statusEl){statusEl.textContent='❌ שגיאה'; statusEl.className='text-xs font-bold text-red-600'; statusEl.classList.remove('hidden');} }
};

// ─── Cloudinary URL optimizer — מחדיר טרנספורמציות איכות לכל URL של Cloudinary ────
function cldOptimize(url, { w = 900, q = 'auto:best', mode = 'limit' } = {}) {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    return url.replace(/\/upload\/(?!.*\/upload\/)/, `/upload/c_${mode},w_${w},q_${q}/`);
}

// ─── דחיסת תמונה בצד הלקוח לפני העלאה ─────────────────────────────────────
async function compressImage(file, { maxWidth = 1200, quality = 0.82 } = {}) {
    return new Promise((resolve) => {
        const isVideo = file.type.startsWith('video/');
        if (isVideo) { resolve(file); return; } // וידאו — ללא דחיסה
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

window.openCldUpload = function(slotKey) {
    const cloudName = document.getElementById('cld-cloud-name')?.value?.trim();
    const preset = document.getElementById('cld-upload-preset')?.value?.trim();
    if (!cloudName || !preset) {
        alert('יש להגדיר Cloud Name ו-Upload Preset בהגדרות Cloudinary למעלה תחילה');
        return;
    }
    // פתח בורר קבצים סמוי
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const statusEl = document.getElementById(`ad-status-${slotKey}`);
        const origSize = (file.size / 1024).toFixed(0);
        if (statusEl) { statusEl.textContent = `מעלה (${origSize}KB)...`; statusEl.className = 'block text-center text-xs font-bold mt-2 text-blue-500'; statusEl.classList.remove('hidden'); }
        try {
            // banner ads: upload original without compression to preserve quality
            const fd = new FormData();
            fd.append('file', file, file.name);
            fd.append('upload_preset', preset);
            fd.append('folder', 'family-flow-ads');
            const isVideo = file.type.startsWith('video/');
            const resourceType = isVideo ? 'video' : 'image';
            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: 'POST', body: fd });
            const data = await res.json();
            if (!data.secure_url) throw new Error(data.error?.message || 'שגיאת Cloudinary');
            const imgInput = document.getElementById(`ad-img-${slotKey}`);
            if (imgInput) imgInput.value = data.secure_url;
            const previewEl = document.getElementById(`ad-preview-${slotKey}`);
            if (previewEl) {
                if (isVideo) {
                    previewEl.outerHTML = `<video id="ad-preview-${slotKey}" src="${data.secure_url}" class="w-full max-h-28 rounded-xl mb-2 border border-slate-200 bg-slate-100" autoplay muted loop playsinline></video>`;
                } else {
                    previewEl.src = cldOptimize(data.secure_url, {w:800, mode:'limit'}); previewEl.classList.remove('hidden');
                }
            }
            if (statusEl) { statusEl.textContent = `✅ עלה! (${origSize}KB)`; statusEl.className = 'block text-center text-xs font-bold mt-2 text-green-600'; setTimeout(() => statusEl.classList.add('hidden'), 3000); }
        } catch(e) {
            if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.className = 'block text-center text-xs font-bold mt-2 text-red-600'; }
        }
    };
    input.click();
};

window.renderAdSlotsPanel = async function() {
    const grid = document.getElementById('ad-slots-grid');
    if (!grid) return;
    loadCldConfig();
    grid.innerHTML = '<p class="text-slate-400 text-sm text-center col-span-2 py-8">טוען...</p>';
    try {
        const res = await fetch(`${API}/ads`, { headers: { Authorization: saToken } });
        const data = await res.json();
        const slots = (data.success && data.slots) ? data.slots : {};
        grid.innerHTML = AD_SLOT_DEFS.map(def => {
            const s = slots[def.key] || {};
            const isActive = s.active ? 'checked' : '';
            const imgVal = (s.img || '').replace(/"/g, '&quot;');
            const linkVal = (s.link || '').replace(/"/g, '&quot;');
            return `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="font-bold text-slate-800 text-sm">${def.label}</h3>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" id="ad-active-${def.key}" ${isActive} class="w-4 h-4 accent-pink-500">
                        <span class="text-xs text-slate-500 font-bold">פעיל</span>
                    </label>
                </div>
                ${imgVal ? `<img id="ad-preview-${def.key}" src="${cldOptimize(imgVal, {w:800, mode:'limit'})}" class="w-full max-h-28 object-contain rounded-xl mb-2 border border-slate-200 bg-slate-100">` : `<img id="ad-preview-${def.key}" src="" class="w-full max-h-28 object-contain rounded-xl mb-2 border border-slate-200 bg-slate-100 hidden">`}
                <button onclick="openCldUpload('${def.key}')" class="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold px-4 py-2 rounded-xl transition mb-2 flex items-center justify-center gap-2"><i class="fa-solid fa-cloud-arrow-up"></i> העלה תמונה</button>
                <input type="text" id="ad-img-${def.key}" value="${imgVal}" placeholder="או הדבק URL תמונה ישירות" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-pink-400">
                <input type="text" id="ad-link-${def.key}" value="${linkVal}" placeholder="URL קישור (אופציונלי)" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-pink-400">
                <button onclick="saveAdSlot('${def.key}')" class="w-full bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center justify-center gap-2"><i class="fa-solid fa-floppy-disk"></i> שמור</button>
                <span id="ad-status-${def.key}" class="block text-center text-xs font-bold mt-2 hidden"></span>
            </div>`;
        }).join('');
    } catch(e) {
        grid.innerHTML = '<p class="text-red-500 text-sm col-span-2 text-center py-8">שגיאה בטעינת שטחי הפרסום</p>';
    }
};

window.saveAdSlot = async function(key) {
    const img = document.getElementById(`ad-img-${key}`)?.value?.trim() || '';
    const link = document.getElementById(`ad-link-${key}`)?.value?.trim() || '';
    const active = document.getElementById(`ad-active-${key}`)?.checked ? true : false;
    const statusEl = document.getElementById(`ad-status-${key}`);
    try {
        const res = await fetch(`${API}/sa/ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: saToken },
            body: JSON.stringify({ slot: key, img, link, active })
        });
        const data = await res.json();
        if (data.success) {
            if (statusEl) { statusEl.textContent = '✅ נשמר!'; statusEl.className = 'block text-center text-xs font-bold mt-2 text-green-600'; statusEl.classList.remove('hidden'); setTimeout(() => statusEl.classList.add('hidden'), 2000); }
        } else throw new Error(data.error);
    } catch(e) {
        if (statusEl) { statusEl.textContent = '❌ שגיאה: ' + e.message; statusEl.className = 'block text-center text-xs font-bold mt-2 text-red-600'; statusEl.classList.remove('hidden'); }
    }
};

// ============================================================
// BANNER ADS SYSTEM — SA UI
// ============================================================

let _bannerSlots = [];
let _allCommunitiesForBanner = [];

// called from switchSATab('adslots') — extend existing renderAdSlotsPanel
const _origRenderAdSlots = window.renderAdSlotsPanel;
window.renderAdSlotsPanel = async function() {
    if (_origRenderAdSlots) await _origRenderAdSlots();
    switchViewTab('adslots', 'manage');
    loadBannerSlotsPanel();
};

async function loadBannerSlotsPanel() {
    const el = document.getElementById('banner-slots-list');
    if (!el) return;
    el.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">טוען...</p>';
    try {
        const [slotsRes, commRes] = await Promise.all([
            fetch(`${API}/sa/banner/slots`, { headers: { Authorization: saToken } }),
            fetch(`${API}/sa/communities`, { headers: { Authorization: saToken } })
        ]);
        const slotsData = await slotsRes.json();
        const commData = await commRes.json();
        _bannerSlots = slotsData.success ? slotsData.slots : [];
        _allCommunitiesForBanner = commData.communities || commData || [];

        if (!_bannerSlots.length) { el.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">אין שטחי פרסום מוגדרים</p>'; return; }
        el.innerHTML = _bannerSlots.map(s => {
            const comLabel = s.communities && s.communities.length ? s.communities.map(c=>c.name).join(', ') : 'כל הקהילות';
            const statusBadge = s.is_active
                ? '<span class="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">פעיל</span>'
                : '<span class="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">לא פעיל</span>';
            const pricingStr = (s.pricing||[]).map(p=>`${p.duration_days}י׳: ${p.price_coins}🪙/${p.price_ils}₪`).join(' | ');
            return `<div class="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-slate-800 text-sm">${s.name}</span>
                            ${statusBadge}
                        </div>
                        <p class="text-xs text-slate-500 mb-1"><i class="fa-solid fa-location-dot text-purple-400 ml-1"></i>${s.location_key}</p>
                        <p class="text-xs text-indigo-600 mb-1"><i class="fa-solid fa-users ml-1"></i>${comLabel}</p>
                        <p class="text-[10px] text-slate-400">${pricingStr}</p>
                    </div>
                    <button onclick="openEditBannerSlotModal(${s.id})" class="text-purple-600 bg-purple-50 hover:bg-purple-100 w-8 h-8 rounded-full flex items-center justify-center transition text-xs"><i class="fa-solid fa-pen"></i></button>
                </div>
            </div>`;
        }).join('');
    } catch(e) { el.innerHTML = `<p class="text-red-500 text-xs text-center py-4">שגיאה: ${e.message}</p>`; }
}

function _showBannerSlotModal() {
    const modal = document.getElementById('banner-slot-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const mc = document.getElementById('sa-main-content');
    if (mc) mc.scrollTop = 0; else window.scrollTo(0,0);
}

window.openNewBannerSlotModal = function() {
    try {
        document.getElementById('bsm-id').value = '';
        document.getElementById('bsm-name').value = '';
        document.getElementById('bsm-location').value = '';
        document.getElementById('bsm-desc').value = '';
        document.getElementById('bsm-coins').value = '';
        document.getElementById('bsm-ils').value = '';
        document.getElementById('banner-slot-modal-title').textContent = 'שטח פרסום חדש';
        _renderBsmCommunities([]);
        _renderBsmPricing([{duration_days:7,price_coins:100,price_ils:50},{duration_days:30,price_coins:350,price_ils:175}]);
        _renderBsmCommPricing([]);
        _showBannerSlotModal();
    } catch(e) { showToast('error', 'שגיאה: ' + e.message); console.error(e); }
};

window.openEditBannerSlotModal = function(id) {
    const s = _bannerSlots.find(x=>x.id===id);
    if (!s) return;
    document.getElementById('bsm-id').value = s.id;
    document.getElementById('bsm-name').value = s.name;
    document.getElementById('bsm-location').value = s.location_key;
    document.getElementById('bsm-desc').value = s.description || '';
    document.getElementById('bsm-coins').value = s.base_price_coins;
    document.getElementById('bsm-ils').value = s.base_price_ils;
    document.getElementById('banner-slot-modal-title').textContent = 'עריכת שטח פרסום';
    _renderBsmCommunities(s.communities ? s.communities.map(c=>c.id) : []);
    const durPricing = (s.pricing||[]).filter(p => !p.community_count || p.community_count === 0);
    const commPricing = (s.pricing||[]).filter(p => p.community_count > 0);
    _renderBsmPricing(durPricing);
    _renderBsmCommPricing(commPricing);
    _showBannerSlotModal();
};

function _renderBsmCommunities(selectedIds) {
    const container = document.getElementById('bsm-communities-list');
    if (!container) return;
    container.innerHTML = _allCommunitiesForBanner.map(c => `
        <label class="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-1 py-0.5">
            <input type="checkbox" value="${c.id}" ${selectedIds.includes(c.id)?'checked':''} class="bsm-com-cb accent-purple-500">
            <span>${c.name}</span>
        </label>`).join('');
}

window.filterBsmCommunities = function() {
    const q = (document.getElementById('bsm-community-search')?.value||'').toLowerCase();
    document.querySelectorAll('#bsm-communities-list label').forEach(l => {
        l.style.display = l.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
};

function _renderBsmPricing(rows) {
    const container = document.getElementById('bsm-pricing-rows');
    if (!container) return;
    container.innerHTML = rows.map((p,i) => `
        <div class="flex gap-2 items-center pricing-row" data-idx="${i}">
            <input type="number" min="1" value="${p.duration_days}" placeholder="ימים" class="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-16 pr-dur focus:outline-none">
            <input type="number" min="0" step="0.01" value="${p.price_ils}" placeholder="₪" class="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-28 pr-ils focus:outline-none">
            <input type="hidden" value="0" class="pr-coins">
            <button onclick="this.closest('.pricing-row').remove()" class="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>`).join('');
}

window.addPricingRow = function() {
    const container = document.getElementById('bsm-pricing-rows');
    const div = document.createElement('div');
    div.className = 'flex gap-2 items-center pricing-row';
    div.innerHTML = `<input type="number" min="1" placeholder="ימים" class="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-16 pr-dur focus:outline-none">
        <input type="number" min="0" step="0.01" placeholder="₪" class="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-28 pr-ils focus:outline-none">
        <input type="hidden" value="0" class="pr-coins">
        <button onclick="this.closest('.pricing-row').remove()" class="text-red-400 hover:text-red-600 text-xs">✕</button>`;
    container.appendChild(div);
};

function _renderBsmCommPricing(rows) {
    const container = document.getElementById('bsm-comm-pricing-rows');
    if (!container) return;
    container.innerHTML = (rows||[]).map((p,i) => `
        <div class="flex gap-2 items-center comm-pricing-row" data-idx="${i}">
            <input type="number" min="1" value="${p.community_count||''}" placeholder="מספר" class="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-16 cp-count focus:outline-none">
            <input type="number" min="0" step="0.01" value="${p.price_ils||''}" placeholder="₪" class="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-28 cp-ils focus:outline-none">
            <input type="hidden" value="0" class="cp-coins">
            <button onclick="this.closest('.comm-pricing-row').remove()" class="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>`).join('');
}

window.addCommPricingRow = function() {
    const container = document.getElementById('bsm-comm-pricing-rows');
    const div = document.createElement('div');
    div.className = 'flex gap-2 items-center comm-pricing-row';
    div.innerHTML = `<input type="number" min="1" placeholder="מספר" class="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-16 cp-count focus:outline-none">
        <input type="number" min="0" step="0.01" placeholder="₪" class="border border-slate-200 rounded-xl px-2 py-1.5 text-xs w-28 cp-ils focus:outline-none">
        <input type="hidden" value="0" class="cp-coins">
        <button onclick="this.closest('.comm-pricing-row').remove()" class="text-red-400 hover:text-red-600 text-xs">✕</button>`;
    container.appendChild(div);
};

window.saveBannerSlot = async function() {
    const id = document.getElementById('bsm-id').value;
    const name = document.getElementById('bsm-name').value.trim();
    const location_key = document.getElementById('bsm-location').value.trim();
    if (!name || !location_key) return showToast('error', 'שם ומיקום חובה');

    const community_ids = Array.from(document.querySelectorAll('.bsm-com-cb:checked')).map(cb=>parseInt(cb.value));
    const durPricing = Array.from(document.querySelectorAll('.pricing-row')).map(row => ({
        duration_days: parseInt(row.querySelector('.pr-dur').value) || 0,
        price_coins: parseFloat(row.querySelector('.pr-coins').value) || 0,
        price_ils: parseFloat(row.querySelector('.pr-ils').value) || 0,
        community_count: 0
    })).filter(p => p.duration_days > 0);
    const commPricing = Array.from(document.querySelectorAll('.comm-pricing-row')).map(row => ({
        duration_days: 0,
        community_count: parseInt(row.querySelector('.cp-count').value) || 0,
        price_coins: parseFloat(row.querySelector('.cp-coins').value) || 0,
        price_ils: parseFloat(row.querySelector('.cp-ils').value) || 0
    })).filter(p => p.community_count > 0);
    const pricing = [...durPricing, ...commPricing];

    try {
        let slotId = id;
        if (id) {
            await fetch(`${API}/sa/banner/slots/${id}`, {
                method: 'PUT', headers: {'Content-Type':'application/json', Authorization:saToken},
                body: JSON.stringify({ name, description:document.getElementById('bsm-desc').value, base_price_coins:parseFloat(document.getElementById('bsm-coins').value)||0, base_price_ils:parseFloat(document.getElementById('bsm-ils').value)||0 })
            });
        } else {
            const r = await fetch(`${API}/sa/banner/slots`, {
                method: 'POST', headers: {'Content-Type':'application/json', Authorization:saToken},
                body: JSON.stringify({ name, location_key, description:document.getElementById('bsm-desc').value, base_price_coins:parseFloat(document.getElementById('bsm-coins').value)||0, base_price_ils:parseFloat(document.getElementById('bsm-ils').value)||0 })
            });
            const d = await r.json();
            slotId = d.slot?.id;
        }
        await fetch(`${API}/sa/banner/slots/${slotId}/communities`, {
            method:'PUT', headers:{'Content-Type':'application/json', Authorization:saToken},
            body: JSON.stringify({ community_ids })
        });
        if (pricing.length) {
            await fetch(`${API}/sa/banner/slots/${slotId}/pricing`, {
                method:'PUT', headers:{'Content-Type':'application/json', Authorization:saToken},
                body: JSON.stringify({ pricing })
            });
        }
        showToast('success', 'שטח פרסום נשמר!');
        document.getElementById('banner-slot-modal').classList.add('hidden');
        loadBannerSlotsPanel();
    } catch(e) { showToast('error', e.message); }
};

window.loadBannerOrders = async function() {
    const el = document.getElementById('banner-orders-list');
    if (!el) return;
    const status = document.getElementById('banner-orders-filter')?.value || '';
    el.innerHTML = '<p class="text-slate-400 text-xs text-center py-3">טוען...</p>';
    try {
        const url = `${API}/sa/banner/orders${status ? '?status='+status : ''}`;
        const r = await fetch(url, { headers: { Authorization: saToken } });
        const d = await r.json();
        if (!d.success || !d.orders.length) { el.innerHTML = '<p class="text-slate-400 text-xs text-center py-3">אין הזמנות</p>'; return; }
        // cache community_ids per order
        d.orders.forEach(o => { _boeOrdersCache[o.id] = { community_ids: Array.isArray(o.community_ids) ? o.community_ids : JSON.parse(o.community_ids||'[]') }; });
        const statusLabel = { pending_approval:'ממתין לאישור', active:'פעיל', expired:'הסתיים', cancelled:'בוטל', pending_payment:'ממתין לתשלום' };
        const statusColor = { pending_approval:'amber', active:'green', expired:'slate', cancelled:'red', pending_payment:'blue' };
        el.innerHTML = d.orders.map(o => {
            const sc = statusColor[o.status] || 'slate';
            const sl = statusLabel[o.status] || o.status;
            // expiry warning
            let expiryBadge = '';
            if (o.status === 'active' && o.end_date) {
                const daysLeft = Math.ceil((new Date(o.end_date) - new Date()) / 86400000);
                if (daysLeft <= 1) expiryBadge = `<span class="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">⚠️ יפוג ${daysLeft<=0?'היום':'מחר'}</span>`;
                else if (daysLeft <= 3) expiryBadge = `<span class="text-[10px] bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">יפוג בעוד ${daysLeft} ימים</span>`;
            }
            const commIds = o.community_ids ? (Array.isArray(o.community_ids) ? o.community_ids : JSON.parse(o.community_ids||'[]')) : [];
            const commBadge = commIds.length ? `<span class="text-[10px] text-slate-400">📍${commIds.length} קהילות</span>` : '';
            const actions = o.status === 'pending_approval'
                ? `<button onclick="openBannerScheduleModal(${o.id},${o.slot_id},${o.duration_days},'${(o.business_name||'').replace(/'/g,"\\'")}','${(o.slot_name||'').replace(/'/g,"\\'")}','${o.coins_used||0}','${o.cash_amount||0}')" class="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-full transition flex items-center gap-1"><i class="fa-solid fa-calendar-check" style="font-size:9px"></i>שבץ ואשר</button>
                   <button onclick="cancelBannerOrder(${o.id})" class="text-[10px] bg-red-100 hover:bg-red-200 text-red-600 font-bold px-3 py-1 rounded-full transition mr-1">בטל</button>`
                : `<button onclick="openClientLedger(${o.business_id},'${o.business_name}')" class="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1 rounded-full transition">כרטסת</button>
                   <button data-oedit="${o.id}" data-oname="${(o.business_name||'').replace(/"/g,'')}" data-oslot="${(o.slot_name||'').replace(/"/g,'')}" data-onotes="${(o.notes||'').replace(/"/g,'')}" onclick="_openBoeFromBtn(this)" class="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 font-bold px-3 py-1 rounded-full transition"><i class="fa-solid fa-pen" style="font-size:9px"></i></button>`;
            return `<div class="border border-slate-100 rounded-xl p-3 bg-white flex items-center justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span class="font-bold text-slate-800 text-xs truncate">${o.business_name||'?'}</span>
                        <span class="text-[10px] bg-${sc}-100 text-${sc}-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">${sl}</span>
                        ${expiryBadge}
                    </div>
                    <p class="text-[10px] text-slate-500">${o.slot_name||''} · ${o.duration_days} ימים · 🪙${o.coins_used} + ₪${o.cash_amount} ${commBadge}</p>
                    ${o.start_date && o.end_date ? `<p class="text-[10px] text-indigo-500 font-bold">${new Date(o.start_date).toLocaleDateString('he-IL')} → ${new Date(o.end_date).toLocaleDateString('he-IL')}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 shrink-0">${actions}</div>
            </div>`;
        }).join('');
    } catch(e) { el.innerHTML = `<p class="text-red-500 text-xs text-center py-3">שגיאה: ${e.message}</p>`; }
};

window.approveBannerOrder = async function(id, startDate) {
    try {
        const body = startDate ? JSON.stringify({start_date: startDate}) : '{}';
        const r = await fetch(`${API}/sa/banner/orders/${id}/approve`, {
            method:'PUT',
            headers:{Authorization:saToken, 'Content-Type':'application/json'},
            body
        });
        const d = await r.json();
        if (d.success) { showToast('success', 'הזמנה אושרה!'); loadBannerOrders(); loadBillingOverview(); return true; }
        else { showToast('error', d.error); return false; }
    } catch(e) { showToast('error', e.message); return false; }
};

// ── Banner Schedule Modal ──────────────────────────────────────
window.openBannerScheduleModal = function(orderId, slotId, durationDays, bizName, slotName, coinsUsed, cashAmount) {
    document.getElementById('bsched-order-id').value = orderId;
    document.getElementById('bsched-slot-id').value = slotId;
    document.getElementById('bsched-biz-name').textContent = bizName;
    document.getElementById('bsched-slot-name').textContent = slotName;
    document.getElementById('bsched-duration').textContent = durationDays;
    document.getElementById('bsched-payment').textContent = `🪙${coinsUsed} + ₪${cashAmount}`;
    // default start date = today
    const today = new Date().toISOString().split('T')[0];
    const startInp = document.getElementById('bsched-start-date');
    startInp.value = today;
    startInp.min = today;
    // store duration for calc
    startInp.dataset.duration = durationDays;
    startInp.dataset.slotId = slotId;
    document.getElementById('bsched-conflict').classList.add('hidden');
    document.getElementById('bsched-ok').classList.add('hidden');
    document.getElementById('bsched-confirm-btn').disabled = false;
    document.getElementById('bsched-end-date').textContent = _calcEndDate(today, durationDays);
    document.getElementById('banner-schedule-modal').classList.remove('hidden');
    // auto-check on open
    onBschedDateChange();
};

window.closeBannerScheduleModal = function() {
    document.getElementById('banner-schedule-modal').classList.add('hidden');
};

function _calcEndDate(startStr, days) {
    const d = new Date(startStr);
    d.setDate(d.getDate() + parseInt(days));
    return d.toLocaleDateString('he-IL');
}

window.onBschedDateChange = async function() {
    const startInp = document.getElementById('bsched-start-date');
    const startStr = startInp.value;
    const duration = parseInt(startInp.dataset.duration || 0);
    const slotId = startInp.dataset.slotId;
    if (!startStr) return;
    // calc end
    const startD = new Date(startStr);
    const endD = new Date(startD);
    endD.setDate(endD.getDate() + duration);
    const endStr = endD.toISOString().split('T')[0];
    document.getElementById('bsched-end-date').textContent = endD.toLocaleDateString('he-IL');
    // check availability
    document.getElementById('bsched-conflict').classList.add('hidden');
    document.getElementById('bsched-ok').classList.add('hidden');
    document.getElementById('bsched-confirm-btn').disabled = true;
    try {
        const r = await fetch(`${API}/sa/banner/slots/${slotId}/availability?start=${startStr}&end=${endStr}`, { headers:{Authorization:saToken} });
        const d = await r.json();
        if (d.conflicts && d.conflicts.length) {
            document.getElementById('bsched-conflict').classList.remove('hidden');
            document.getElementById('bsched-conflict-details').innerHTML = d.conflicts.map(c =>
                `<p>• <strong>${c.business_name}</strong> — ${c.start_date ? new Date(c.start_date).toLocaleDateString('he-IL') : '?'} עד ${c.end_date ? new Date(c.end_date).toLocaleDateString('he-IL') : '?'}</p>`
            ).join('');
            document.getElementById('bsched-confirm-btn').disabled = true;
        } else {
            document.getElementById('bsched-ok').classList.remove('hidden');
            document.getElementById('bsched-confirm-btn').disabled = false;
        }
    } catch(e) { document.getElementById('bsched-confirm-btn').disabled = false; }
};

window.confirmBannerSchedule = async function() {
    const orderId = document.getElementById('bsched-order-id').value;
    const startDate = document.getElementById('bsched-start-date').value;
    if (!startDate) { showToast('error', 'נא לבחור תאריך התחלה'); return; }
    document.getElementById('bsched-confirm-btn').disabled = true;
    const ok = await approveBannerOrder(orderId, startDate);
    if (ok) closeBannerScheduleModal();
    else document.getElementById('bsched-confirm-btn').disabled = false;
};

window.cancelBannerOrderModal = async function() {
    const orderId = document.getElementById('bsched-order-id').value;
    if (!confirm('לבטל הזמנה זו?')) return;
    await cancelBannerOrder(orderId);
    closeBannerScheduleModal();
};

// ── Banner Order Edit Modal ────────────────────────────────────
let _boeAllCommunities = [];
let _boeOrdersCache = {};

window._openBoeFromBtn = function(btn) {
    const id = btn.dataset.oedit;
    const cached = _boeOrdersCache[id] || {};
    openBannerOrderEditModal(id, btn.dataset.oname, btn.dataset.oslot, cached.community_ids||[], btn.dataset.onotes||'');
};

window.openBannerOrderEditModal = async function(orderId, bizName, slotName, communityIds, notes) {
    document.getElementById('boe-order-id').value = orderId;
    document.getElementById('boe-title').textContent = `${bizName} · ${slotName}`;
    document.getElementById('boe-notes').value = notes || '';
    const commList = document.getElementById('boe-communities-list');
    commList.innerHTML = '<p class="text-slate-400 text-xs">טוען קהילות...</p>';
    document.getElementById('banner-order-edit-modal').classList.remove('hidden');
    // load communities
    try {
        if (!_boeAllCommunities.length) {
            const r = await fetch(`${API}/sa/communities`, { headers:{Authorization:saToken} });
            const d = await r.json();
            _boeAllCommunities = d.communities || [];
        }
        const selected = Array.isArray(communityIds) ? communityIds.map(Number) : (typeof communityIds==='string' ? JSON.parse(communityIds||'[]').map(Number) : []);
        commList.innerHTML = _boeAllCommunities.map(c => `
            <label class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 cursor-pointer hover:border-purple-400 transition text-xs font-bold text-slate-700">
                <input type="checkbox" class="boe-comm-cb accent-purple-600 w-3.5 h-3.5" value="${c.id}" ${selected.includes(c.id)?'checked':''}>
                ${c.name}
            </label>
        `).join('');
    } catch(e) { commList.innerHTML = `<p class="text-red-500 text-xs">שגיאה: ${e.message}</p>`; }
};

window.closeBannerOrderEditModal = function() {
    document.getElementById('banner-order-edit-modal').classList.add('hidden');
};

window.saveBannerOrderEdit = async function() {
    const orderId = document.getElementById('boe-order-id').value;
    const notes = document.getElementById('boe-notes').value;
    const selectedComms = Array.from(document.querySelectorAll('.boe-comm-cb:checked')).map(cb => parseInt(cb.value));
    try {
        const r = await fetch(`${API}/sa/banner/orders/${orderId}`, {
            method: 'PUT',
            headers: { Authorization: saToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ community_ids: selectedComms, notes })
        });
        const d = await r.json();
        if (d.success) {
            showToast('success', 'הזמנה עודכנה!');
            closeBannerOrderEditModal();
            loadBannerOrders();
            loadBannerTimeline();
        } else showToast('error', d.error);
    } catch(e) { showToast('error', e.message); }
};

// ── Banner Timeline (לוח תפוסות) ──────────────────────────────
window.loadBannerTimeline = async function() {
    const el = document.getElementById('banner-timeline-list');
    if (!el) return;
    el.innerHTML = '<p class="text-slate-400 text-xs text-center py-3">טוען...</p>';
    try {
        const r = await fetch(`${API}/sa/banner/timeline`, { headers:{Authorization:saToken} });
        const d = await r.json();
        if (!d.orders || !d.orders.length) { el.innerHTML = '<p class="text-slate-400 text-xs text-center py-3">אין הזמנות פעילות</p>'; return; }
        // group by slot
        const bySlot = {};
        d.orders.forEach(o => {
            if (!bySlot[o.slot_id]) bySlot[o.slot_id] = { name: o.slot_name, orders: [] };
            bySlot[o.slot_id].orders.push(o);
        });
        const statusLabel = { pending_approval:'ממתין לאישור', active:'פעיל' };
        const statusColor = { pending_approval:'amber', active:'green' };
        el.innerHTML = Object.values(bySlot).map(slot => `
            <div class="border border-slate-100 rounded-2xl p-3 bg-slate-50">
                <p class="text-xs font-black text-slate-700 mb-2 flex items-center gap-1"><i class="fa-solid fa-rectangle-ad text-purple-400"></i> ${slot.name}</p>
                <div class="space-y-1">
                ${slot.orders.map(o => {
                    const sc = statusColor[o.status] || 'slate';
                    const sl = statusLabel[o.status] || o.status;
                    const startStr = o.start_date ? new Date(o.start_date).toLocaleDateString('he-IL') : '—';
                    const endStr = o.end_date ? new Date(o.end_date).toLocaleDateString('he-IL') : '—';
                    return `<div class="flex items-center gap-2 text-[11px] bg-white border border-slate-100 rounded-xl px-3 py-1.5">
                        <span class="font-bold text-slate-800 flex-1">${o.business_name||'?'}</span>
                        <span class="text-slate-500">${startStr} → ${endStr}</span>
                        <span class="bg-${sc}-100 text-${sc}-700 font-bold px-2 py-0.5 rounded-full text-[10px]">${sl}</span>
                    </div>`;
                }).join('')}
                </div>
            </div>
        `).join('');
    } catch(e) { el.innerHTML = `<p class="text-red-500 text-xs text-center py-3">שגיאה: ${e.message}</p>`; }
};

window.cancelBannerOrder = async function(id) {
    if (!confirm('לבטל הזמנה זו?')) return;
    try {
        await fetch(`${API}/sa/banner/orders/${id}/cancel`, { method:'PUT', headers:{Authorization:saToken} });
        showToast('info', 'הזמנה בוטלה'); loadBannerOrders();
    } catch(e) { showToast('error', e.message); }
};

window.loadBillingOverview = async function() {
    const el = document.getElementById('billing-records-list');
    const totalsEl = document.getElementById('billing-totals-bar');
    if (!el) return;
    const status = document.getElementById('billing-status-filter')?.value || '';
    el.innerHTML = '<p class="text-slate-400 text-xs text-center py-3">טוען...</p>';
    try {
        const url = `${API}/sa/billing${status ? '?status='+status : ''}`;
        const r = await fetch(url, { headers: { Authorization: saToken } });
        const d = await r.json();
        if (totalsEl && d.totals) {
            totalsEl.innerHTML = `
                <div class="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                    <p class="text-xs text-red-500 font-bold">חוב פתוח</p>
                    <p class="text-lg font-black text-red-700">₪${parseFloat(d.totals.total_unpaid||0).toFixed(0)}</p>
                </div>
                <div class="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
                    <p class="text-xs text-green-500 font-bold">שולם החודש</p>
                    <p class="text-lg font-black text-green-700">₪${parseFloat(d.totals.paid_this_month||0).toFixed(0)}</p>
                </div>
                <div class="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                    <p class="text-xs text-slate-500 font-bold">סה"כ רשומות</p>
                    <p class="text-lg font-black text-slate-700">${d.records?.length||0}</p>
                </div>`;
        }
        if (!d.records?.length) { el.innerHTML = '<p class="text-slate-400 text-xs text-center py-3">אין רשומות</p>'; return; }
        const stLabel = { unpaid:'לא שולם', paid:'שולם', pending_confirm:'ממתין לאישור', partial:'חלקי' };
        const stColor = { unpaid:'red', paid:'green', pending_confirm:'amber', partial:'orange' };
        el.innerHTML = d.records.map(b => {
            const sc = stColor[b.payment_status] || 'slate';
            const sl = stLabel[b.payment_status] || b.payment_status;
            const paidAction = b.payment_status !== 'paid'
                ? `<button onclick="markBillingPaid(${b.id})" class="text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1 rounded-full transition">סמן שולם</button>`
                : '<span class="text-[10px] text-green-600 font-bold">✓ שולם</span>';
            return `<div class="border border-slate-100 rounded-xl p-3 bg-white flex items-center justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                        <span class="font-bold text-slate-800 text-xs truncate cursor-pointer underline" onclick="openClientLedger(${b.business_id},'${(b.business_name||'').replace(/'/g,"\\'")}' )">${b.business_name||'?'}</span>
                        <span class="text-[10px] bg-${sc}-100 text-${sc}-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">${sl}</span>
                    </div>
                    <p class="text-[10px] text-slate-500">${b.description||''} · 🪙${b.coins_used} + ₪${b.cash_amount} · ${b.due_date ? new Date(b.due_date).toLocaleDateString('he-IL') : ''}</p>
                    ${b.signature_data ? `<p class="text-[10px] text-blue-500 mt-0.5">✍ חתם: ${b.signature_data} (${b.payment_confirmed_at ? new Date(b.payment_confirmed_at).toLocaleDateString('he-IL') : ''})</p>` : ''}
                </div>
                <div class="shrink-0">${paidAction}</div>
            </div>`;
        }).join('');
    } catch(e) { el.innerHTML = `<p class="text-red-500 text-xs text-center py-3">שגיאה: ${e.message}</p>`; }
};

window.markBillingPaid = async function(id) {
    const note = prompt('הערה (אופציונלי):') || '';
    try {
        const r = await fetch(`${API}/sa/billing/${id}/paid`, {
            method:'PUT', headers:{'Content-Type':'application/json', Authorization:saToken},
            body: JSON.stringify({ sa_note: note })
        });
        const d = await r.json();
        if (d.success) { showToast('success', 'סומן כשולם!'); loadBillingOverview(); }
        else showToast('error', d.error);
    } catch(e) { showToast('error', e.message); }
};

window.openClientLedger = async function(bizId, bizName) {
    const modal = document.getElementById('client-ledger-modal');
    const content = document.getElementById('client-ledger-content');
    const title = document.getElementById('client-ledger-title');
    if (!modal) return;
    title.textContent = `כרטסת לקוח — ${bizName}`;
    content.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">טוען...</p>';
    modal.classList.remove('hidden');
    try {
        const r = await fetch(`${API}/sa/clients/${bizId}/ledger`, { headers: { Authorization: saToken } });
        const d = await r.json();
        if (!d.success) throw new Error(d.error);
        const balStr = `<div class="bg-purple-50 border border-purple-100 rounded-2xl p-3 mb-4 flex items-center justify-between">
            <span class="text-xs font-bold text-purple-700">יתרת מטבעות נוכחית</span>
            <span class="text-lg font-black text-purple-700">🪙 ${parseFloat(d.flow_balance||0).toFixed(0)}</span>
        </div>`;
        if (!d.records?.length) { content.innerHTML = balStr + '<p class="text-slate-400 text-xs text-center py-4">אין רשומות</p>'; return; }
        const stLabel = { unpaid:'לא שולם', paid:'שולם', pending_confirm:'ממתין לאישור' };
        const stColor = { unpaid:'red', paid:'green', pending_confirm:'amber' };
        content.innerHTML = balStr + d.records.map(b => {
            const sc = stColor[b.payment_status] || 'slate';
            const sl = stLabel[b.payment_status] || b.payment_status;
            const method = { coins:'מטבעות בלבד', cash:'כספי בלבד', mixed:'מעורב', credit_card:'אשראי' }[b.payment_method] || b.payment_method || '';
            const sigLine = b.signature_data
                ? `<p class="text-[10px] text-blue-500 mt-1">✍ אושר ע"י: ${b.signature_data} · ${b.payment_confirmed_at ? new Date(b.payment_confirmed_at).toLocaleDateString('he-IL') : ''}</p>`
                : '';
            return `<div class="border border-slate-100 rounded-xl p-3 mb-2 bg-slate-50">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1">
                        <p class="font-bold text-slate-800 text-xs mb-0.5">${b.description||b.slot_name||'פרסום'}</p>
                        <p class="text-[10px] text-slate-500">${new Date(b.created_at).toLocaleDateString('he-IL')} · ${method} · 🪙${b.coins_used} + ₪${b.cash_amount}</p>
                        ${sigLine}
                        ${b.sa_note ? `<p class="text-[10px] text-slate-400 mt-0.5">הערת SA: ${b.sa_note}</p>` : ''}
                    </div>
                    <span class="text-[10px] bg-${sc}-100 text-${sc}-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">${sl}</span>
                </div>
            </div>`;
        }).join('');
    } catch(e) { content.innerHTML = `<p class="text-red-500 text-xs text-center py-4">שגיאה: ${e.message}</p>`; }
};

// ── AUDIT LOG ──────────────────────────────────────────────────────────────
let _auditCache = [];

const AUDIT_LABELS = {
    DELETE_GROUP:  { label: 'מחיקת קבוצה/עסק', color: 'bg-red-100 text-red-700',     icon: 'fa-trash' },
    DELETE_USER:   { label: 'מחיקת משתמש',      color: 'bg-red-50 text-red-600',      icon: 'fa-user-minus' },
    CHANGE_PLAN:   { label: 'שינוי פלאן',        color: 'bg-amber-100 text-amber-700', icon: 'fa-award' },
    CREATE_GROUP:  { label: 'יצירת קבוצה',       color: 'bg-emerald-100 text-emerald-700', icon: 'fa-plus' },
    CREATE_USER:   { label: 'יצירת משתמש',       color: 'bg-blue-100 text-blue-700',   icon: 'fa-user-plus' },
};

async function loadAuditLog() {
    const tbody = getEl('audit-log-tbody');
    const statsEl = getEl('audit-stats-bar');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">טוען...</td></tr>`;

    const typeFilter = getEl('audit-filter-type')?.value || '';
    const fromFilter = getEl('audit-filter-from')?.value || '';
    const toFilter   = getEl('audit-filter-to')?.value   || '';
    const params = new URLSearchParams();
    if (typeFilter) params.set('action_type', typeFilter);
    if (fromFilter) params.set('from', fromFilter);
    if (toFilter)   params.set('to', toFilter);

    try {
        const res  = await fetch(`${API}/sa/audit-log?${params}`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        _auditCache = data.logs || [];

        // סרגל סטטיסטיקות
        if (statsEl) {
            statsEl.innerHTML = (data.stats || []).map(s => {
                const def = AUDIT_LABELS[s.action_type] || { label: s.action_type, color: 'bg-slate-100 text-slate-600', icon: 'fa-circle' };
                return `<span class="inline-flex items-center gap-1.5 ${def.color} px-3 py-1 rounded-full text-xs font-bold border border-white/50">
                    <i class="fa-solid ${def.icon} text-[10px]"></i>${def.label}: ${s.cnt}
                </span>`;
            }).join('') || '<span class="text-slate-400 text-xs">אין אירועים עדיין</span>';
        }

        renderAuditLog();
    } catch(e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">שגיאה: ${e.message}</td></tr>`;
    }
}

function renderAuditLog() {
    const tbody = getEl('audit-log-tbody');
    if (!tbody) return;
    if (!_auditCache.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">אין אירועים מתאימים.</td></tr>`;
        return;
    }
    tbody.innerHTML = _auditCache.map(log => {
        const def = AUDIT_LABELS[log.action_type] || { label: log.action_type, color: 'bg-slate-100 text-slate-600', icon: 'fa-circle' };
        const date = new Date(log.created_at);
        const dateStr = date.toLocaleDateString('he-IL');
        const timeStr = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const details = log.details || {};
        let detailsHtml = '';
        if (log.action_type === 'CHANGE_PLAN' && details.from && details.to) {
            detailsHtml = `<span class="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-mono">${details.from}</span>
                <i class="fa-solid fa-arrow-left text-slate-300 text-[9px] mx-1"></i>
                <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold">${details.to}</span>`;
        } else if (details.email) {
            detailsHtml = `<span class="text-slate-400 text-[10px] font-mono">${details.email}</span>`;
        } else if (details.group_type) {
            detailsHtml = `<span class="text-slate-400 text-[10px]">סוג: ${details.group_type}</span>`;
        }
        return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
            <td class="px-4 py-3 text-right">
                <div class="text-xs font-bold text-slate-700">${dateStr}</div>
                <div class="text-[10px] text-slate-400">${timeStr}</div>
            </td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 ${def.color} px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                    <i class="fa-solid ${def.icon} text-[10px]"></i>${def.label}
                </span>
            </td>
            <td class="px-4 py-3 font-bold text-slate-800 text-sm">${safeStr(log.target_name || '—')}</td>
            <td class="px-4 py-3 text-slate-500 text-xs">${safeStr(log.target_type || '—')}</td>
            <td class="px-4 py-3 text-xs">${detailsHtml}</td>
            <td class="px-4 py-3 text-xs text-slate-400">${safeStr(log.actor || 'super-admin')}</td>
        </tr>`;
    }).join('');
}
// ──────────────────────────────────────────────────────────────────────────

// ─── GAMES MANAGEMENT ─────────────────────────────────────────────────────────

let _saGamesData = [];
let _saGlobalConfig = {};

async function dedupSAGames() {
    if (!confirm('זה ימחק משחקים כפולים וישאיר רק עותק אחד מכל משחק. להמשיך?')) return;
    try {
        const res = await fetch(`${API}/sa/games/dedup`, { method: 'POST', headers: { 'Authorization': saToken } });
        const data = await res.json();
        alert(`נמחקו ${data.deleted} כפילויות`);
        await loadSAGames();
    } catch(e) { alert('שגיאה בניקוי כפילויות'); }
}

async function loadSAGames() {
    try {
        const res = await fetch(`${API}/sa/games`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        _saGamesData = data.games || [];
        _saGlobalConfig = data.globalConfig || {};
        renderSAGamesTableFiltered();
        updateGlobalCharacterPreview();
    } catch(e) { console.error('loadSAGames', e); }
}

function renderSAGamesTableFiltered() {
    const subject = document.getElementById('games-filter-subject')?.value;
    const status  = document.getElementById('games-filter-status')?.value;
    let filtered  = _saGamesData;
    if (subject) filtered = filtered.filter(g => g.subject === subject);
    if (status === 'active')   filtered = filtered.filter(g => g.is_active);
    if (status === 'inactive') filtered = filtered.filter(g => !g.is_active);
    renderSAGamesTable(filtered);
}

function renderSAGamesTable(games) {
    const subjectLabels = { english:'🇬🇧 אנגלית', math:'🔢 מתמטיקה', hebrew:'📖 עברית', science:'🔬 מדעים', general:'🌟 כללי' };
    const diffLabels    = { 1:'⭐ קל', 2:'⭐⭐ בינוני', 3:'⭐⭐⭐ קשה' };

    const html = games.length === 0
        ? '<div class="text-center text-slate-400 py-12 text-sm">אין משחקים עדיין. לחץ "הוסף משחק חדש" כדי להתחיל.</div>'
        : `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-slate-100 text-slate-500 text-right">
              <th class="pb-3 font-semibold pr-2">משחק</th>
              <th class="pb-3 font-semibold">נושא</th>
              <th class="pb-3 font-semibold">גילאים</th>
              <th class="pb-3 font-semibold">קושי</th>
              <th class="pb-3 font-semibold">FLW</th>
              <th class="pb-3 font-semibold">🔄 שימושים</th>
              <th class="pb-3 font-semibold">סטטוס</th>
              <th class="pb-3 font-semibold">פעולות</th>
            </tr></thead>
            <tbody>
              ${games.map(g => `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition ${!g.is_active ? 'opacity-50' : ''}">
                  <td class="py-3 pr-2">
                    <div class="flex items-center gap-2">
                      <span class="text-2xl leading-none">${g.thumbnail_emoji || '🎮'}</span>
                      <div>
                        <div class="font-semibold text-slate-800">${g.title}</div>
                        <div class="text-xs text-slate-400">${g.file_path}</div>
                      </div>
                      ${g.character_url ? '<span class="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">דמות פרטנית</span>' : ''}
                    </div>
                  </td>
                  <td class="py-3 text-slate-600">${subjectLabels[g.subject] || g.subject}</td>
                  <td class="py-3 text-slate-600">${g.age_min}–${g.age_max}</td>
                  <td class="py-3">${diffLabels[g.difficulty] || g.difficulty}</td>
                  <td class="py-3 font-bold text-yellow-600">${g.flw_reward}</td>
                  <td class="py-3"><span class="font-bold text-slate-700">${g.total_sessions || 0}</span><span class="text-xs text-slate-400"> פעמים</span></td>
                  <td class="py-3">
                    <button onclick="toggleGame(${g.id})" class="text-xs px-2.5 py-1 rounded-full border font-bold transition
                      ${g.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}">
                      ${g.is_active ? '✅ פעיל' : '🔴 חסום'}
                    </button>
                  </td>
                  <td class="py-3">
                    <button onclick="editGame(${g.id})" class="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition font-bold">✏️ ערוך</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table></div>`;

    document.getElementById('sa-games-table').innerHTML = html;
}

async function toggleGame(gameId) {
    try {
        await fetch(`${API}/sa/games/${gameId}/toggle`, { method: 'PUT', headers: { 'Authorization': saToken } });
        await loadSAGames();
    } catch(e) { console.error('toggleGame', e); }
}

document.addEventListener('click', function(e) {
    const btn = e.target.closest('#badge-presets .badge-preset-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('game-badge').value = btn.dataset.badge || '';
});

function editGame(gameId) {
    const game = _saGamesData.find(g => g.id === gameId);
    if (!game) return;
    document.getElementById('game-form-title').textContent = 'עריכת משחק';
    document.getElementById('game-edit-id').value        = game.id;
    document.getElementById('game-title').value          = game.title;
    document.getElementById('game-emoji').value          = game.thumbnail_emoji || '🎮';
    document.getElementById('game-badge').value          = game.badge || '';
    document.getElementById('game-subject').value        = game.subject;
    document.getElementById('game-age-min').value        = game.age_min;
    document.getElementById('game-age-max').value        = game.age_max;
    document.getElementById('game-difficulty').value     = game.difficulty;
    document.getElementById('game-flw').value            = game.flw_reward;
    document.getElementById('game-filepath').value       = game.file_path;
    document.getElementById('game-character-url').value  = game.character_url || '';
    document.getElementById('game-preview-btn').classList.remove('hidden');
    const prev = document.getElementById('game-character-preview');
    const img  = document.getElementById('game-character-img');
    if (game.character_url) { prev.classList.remove('hidden'); img.src = game.character_url; }
    else { prev.classList.add('hidden'); }
    switchViewTab('games', 'edit');
}

window.resetGameForm = function() {
    document.getElementById('game-form-title').textContent = 'הוספת משחק חדש';
    document.getElementById('game-edit-id').value       = '';
    document.getElementById('game-title').value         = '';
    document.getElementById('game-emoji').value         = '🎮';
    document.getElementById('game-subject').value       = 'english';
    document.getElementById('game-age-min').value       = 5;
    document.getElementById('game-age-max').value       = 12;
    document.getElementById('game-difficulty').value    = 1;
    document.getElementById('game-flw').value           = 10;
    document.getElementById('game-filepath').value      = '';
    document.getElementById('game-badge').value         = '';
    document.getElementById('game-character-url').value = '';
    document.getElementById('game-character-preview').classList.add('hidden');
    document.getElementById('game-preview-btn').classList.add('hidden');
};

window.saveGame = async function(e) {
    e.preventDefault();
    const id   = document.getElementById('game-edit-id').value;
    const body = {
        title:        document.getElementById('game-title').value,
        subject:      document.getElementById('game-subject').value,
        ageMin:       parseInt(document.getElementById('game-age-min').value),
        ageMax:       parseInt(document.getElementById('game-age-max').value),
        difficulty:   parseInt(document.getElementById('game-difficulty').value),
        flwReward:    parseInt(document.getElementById('game-flw').value),
        filePath:     document.getElementById('game-filepath').value,
        thumbnailEmoji: document.getElementById('game-emoji').value || '🎮',
        badge: document.getElementById('game-badge').value.trim() || null,
        characterUrl: document.getElementById('game-character-url').value
    };
    try {
        const res  = await fetch(`${API}/sa/games${id ? '/'+id : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', id ? '✅ המשחק עודכן!' : '✅ המשחק נוסף!');
            await loadSAGames();
            switchViewTab('games', 'list');
        }
    } catch(e) { showToast('error', 'שגיאה בשמירה'); }
};

window.clearGameCharacter = function() {
    document.getElementById('game-character-url').value = '';
    document.getElementById('game-character-preview').classList.add('hidden');
};

window.previewGame = function() {
    const fp = document.getElementById('game-filepath').value;
    if (fp) window.open('/' + fp, '_blank');
};

window.previewGameCharacterUpload = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('game-character-url').value = e.target.result;
        document.getElementById('game-character-preview').classList.remove('hidden');
        document.getElementById('game-character-img').src = e.target.result;
    };
    reader.readAsDataURL(file);
};

function updateGlobalCharacterPreview() {
    const el  = document.getElementById('global-character-current');
    if (!el) return;
    const url = _saGlobalConfig?.default_character_url;
    el.innerHTML = url
        ? `<img src="${url}" class="w-32 h-32 object-contain mx-auto rounded-2xl mb-2">
           <p class="text-sm text-slate-500">דמות נוכחית</p>`
        : `<i class="fa-solid fa-robot text-4xl text-slate-300 mb-2"></i>
           <p class="text-slate-400 text-sm">לא הוגדרה דמות גלובלית</p>`;
    const urlInput = document.getElementById('global-character-url');
    if (urlInput && url) urlInput.value = url;
}

window.uploadGlobalCharacter = function(input) {
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('global-character-url').value = e.target.result;
        document.getElementById('global-character-current').innerHTML =
            `<img src="${e.target.result}" class="w-32 h-32 object-contain mx-auto rounded-2xl mb-2">
             <p class="text-sm text-slate-500">תצוגה מקדימה (טרם נשמר)</p>`;
    };
    reader.readAsDataURL(input.files[0]);
};

window.saveGlobalCharacter = async function() {
    const url = document.getElementById('global-character-url').value?.trim();
    if (!url) return showToast('error', 'נא להזין URL או להעלות קובץ');
    try {
        const res  = await fetch(`${API}/sa/games/global-config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': saToken },
            body: JSON.stringify({ defaultCharacterUrl: url, updatedBy: window.currentSAUser?.name || 'SA' })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', '✅ הדמות הגלובלית עודכנה!');
            await loadSAGames();
        }
    } catch(e) { showToast('error', 'שגיאה בשמירה'); }
};

window.loadSAGamesStats = async function() {
    const el = document.getElementById('sa-games-stats-content');
    if (!el) return;
    el.innerHTML = '<div class="text-center text-slate-400 py-8 text-sm">טוען...</div>';
    try {
        const res  = await fetch(`${API}/sa/games/stats`, { headers: { 'Authorization': saToken } });
        const data = await res.json();
        const subjectLabels = { english:'🇬🇧 אנגלית', math:'🔢 מתמטיקה', hebrew:'📖 עברית', science:'🔬 מדעים', general:'🌟 כללי' };

        el.innerHTML = !data.stats?.length
            ? '<p class="text-slate-400 text-sm text-center py-8">אין נתונים עדיין — ממתין לשחקנים ראשונים.</p>'
            : `<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                ${data.stats.map(s => `
                  <div class="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-center">
                    <div class="text-2xl mb-2">${subjectLabels[s.subject] || s.subject}</div>
                    <div class="text-3xl font-black text-indigo-600 mb-1">${s.total_sessions}</div>
                    <div class="text-xs text-slate-400 mb-3">סשנים</div>
                    <div class="text-sm font-bold text-yellow-600 mb-1">${s.total_flw_given} FLW חולקו</div>
                    <div class="text-xs text-slate-400">ציון ממוצע: ${s.avg_score || '—'}</div>
                    <div class="text-xs text-slate-400">${s.unique_players} שחקנים</div>
                  </div>`).join('')}
               </div>`;
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-sm text-center py-4">שגיאה בטעינת נתונים</p>'; }
};

// ─── END GAMES MANAGEMENT ─────────────────────────────────────────────────────

// ============================================================
// QUEST LIBRARY — Super Admin
// ============================================================

async function runQuestLibSeed(){
  const btn = document.getElementById('sa-quest-seed-btn');
  if(btn) { btn.disabled=true; btn.textContent='מריץ...'; }
  try {
    const res = await fetch(`${API}/sa/quest-library/run-seed`, { method:'POST', headers:{'Authorization':saToken} });
    const data = await res.json();
    if(data.success) { showToast('success', `✅ נזרעו ${data.total} קווסטים!`); loadSAQuestLib(); }
    else showToast('error', data.error || 'שגיאה');
  } catch(e){ showToast('error','שגיאת רשת'); }
  if(btn) { btn.disabled=false; btn.textContent='🌱 הרץ seed'; }
}

async function loadSAQuestLib(){
  const el = document.getElementById('sa-quest-lib-content');
  if(!el) return;
  el.innerHTML = '<div class="text-center text-slate-400 py-8">טוען...</div>';
  try {
    const res = await fetch(`${API}/sa/quest-library`, { headers: { 'Authorization': saToken } });
    const data = await res.json();
    if(!data.success) throw new Error(data.error || 'שגיאת שרת');
    const quests = data.quests || [];

    const subjectLabel = {math:'מתמטיקה',hebrew:'עברית',english:'אנגלית',science:'מדעים',
      history:'היסטוריה',finance:'כסף',geography:'גיאוגרפיה',values:'ערכים',
      health:'בריאות',technology:'טכנולוגיה',environment:'סביבה'};

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.9rem">
        <div style="font-weight:700;font-size:1rem">📚 ספריית קווסטים (${quests.length})</div>
        <button id="sa-quest-seed-btn" onclick="runQuestLibSeed()"
          style="background:#EDE9FE;color:#5B21B6;border:1px solid #7C3AED;border-radius:8px;
                 padding:0.3rem 0.8rem;font-size:0.78rem;font-weight:700;cursor:pointer">
          🌱 הרץ seed
        </button>
      </div>
      ${quests.length === 0 ? '<div class="text-center text-slate-400 py-8">אין קווסטים במאגר עדיין</div>' : quests.map(q=>`
        <div style="background:#fff;border-radius:14px;padding:0.85rem 1rem;
          border:1px solid #E5E7EB;margin-bottom:0.6rem;
          ${q.is_hidden?'opacity:0.55;':''}">
          <div style="display:flex;align-items:flex-start;gap:0.6rem">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.25rem">
                ${q.title}
                ${q.is_hidden?'<span style="background:#FEE2E2;color:#991B1B;font-size:0.65rem;padding:1px 6px;border-radius:6px;margin-right:4px">מוסתר</span>':''}
                ${q.is_featured?'<span style="background:#FEF3C7;color:#92400E;font-size:0.65rem;padding:1px 6px;border-radius:6px;margin-right:4px">⭐ מומלץ</span>':''}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:0.35rem">
                <span style="background:#EFF6FF;color:#1D4ED8;font-size:0.7rem;padding:1px 7px;border-radius:20px;font-weight:600">${subjectLabel[q.subject]||q.subject}</span>
                <span style="background:#F0FDF4;color:#166534;font-size:0.7rem;padding:1px 7px;border-radius:20px">📖 ${q.question_count||0} שאלות</span>
                <span style="background:#FFF7ED;color:#C2410C;font-size:0.7rem;padding:1px 7px;border-radius:20px">🔄 ${q.use_count||0} שימושים</span>
                <span style="background:#FDF4FF;color:#7E22CE;font-size:0.7rem;padding:1px 7px;border-radius:20px">⭐ ${parseFloat(q.rating_avg||0).toFixed(1)} (${q.rating_count||0})</span>
                ${(q.report_count||0)>0?`<span style="background:#FEF2F2;color:#DC2626;font-size:0.7rem;padding:1px 7px;border-radius:20px">🚩 ${q.report_count} דיווחים</span>`:''}
                <span style="background:#F1F5F9;color:#475569;font-size:0.7rem;padding:1px 7px;border-radius:20px">${q.visibility}</span>
              </div>
              ${q.description?`<div style="font-size:0.72rem;color:#94A3B8">${q.description}</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;gap:0.35rem;flex-shrink:0">
              <button onclick="saEditQuest(${q.id})"
                style="background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;
                border-radius:8px;padding:0.3rem 0.65rem;font-size:0.75rem;cursor:pointer;font-weight:600">
                ✏️ עריכה
              </button>
              <button onclick="saToggleQHide(${q.id},${!q.is_hidden})"
                style="background:${q.is_hidden?'#DCFCE7':'#FEE2E2'};border:none;
                border-radius:8px;padding:0.3rem 0.65rem;font-size:0.75rem;cursor:pointer;font-weight:600">
                ${q.is_hidden?'👁 הצג':'🙈 הסתר'}
              </button>
              <button onclick="saToggleQFeatured(${q.id},${!q.is_featured})"
                style="background:${q.is_featured?'#FEF3C7':'#F3F4F6'};border:none;
                border-radius:8px;padding:0.3rem 0.65rem;font-size:0.75rem;cursor:pointer;font-weight:600">
                ${q.is_featured?'★ הסר':'⭐ מומלץ'}
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    `;
  } catch(e) {
    el.innerHTML = `<div class="text-center text-red-400 py-8">שגיאה: ${e.message}</div>`;
    console.error('loadSAQuestLib error:', e);
  }
}

async function saEditQuest(questId){
  try {
  // טען נתוני קווסט + שאלות
  const [qRes, qqRes] = await Promise.all([
    fetch(`${API}/sa/quest-library`, { headers:{'Authorization':saToken} }),
    fetch(`${API}/quest-library/${questId}/questions`)
  ]);
  const qData = await qRes.json();
  const qqData = await qqRes.json();
  const quest = (qData.quests||[]).find(x=>x.id==questId);
  if(!quest) return showToast('error','קווסט לא נמצא');
  const rawQs = qqData.questions || [];

  const subjectOpts = ['math','hebrew','english','science','history','finance','geography','values','health','technology','environment']
    .map(s=>`<option value="${s}" ${quest.subject===s?'selected':''}>${{math:'מתמטיקה',hebrew:'עברית',english:'אנגלית',science:'מדעים',history:'היסטוריה',finance:'כסף',geography:'גיאוגרפיה',values:'ערכים',health:'בריאות',technology:'טכנולוגיה',environment:'סביבה'}[s]}</option>`).join('');

  let questions = rawQs.map(q=>({
    id: q.id, text: q.question_text, correct: q.correct_answer,
    opts: q.options_json ? JSON.parse(q.options_json) : [], ex: q.explanation||''
  }));

  function renderQEdit(){
    return questions.map((q,i)=>`
      <div data-qi="${i}" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:0.7rem;margin-bottom:0.5rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
          <span style="font-weight:700;font-size:0.8rem;color:#475569">שאלה ${i+1}</span>
          <button onclick="saQEditRemove(${i})" style="background:#FEE2E2;border:none;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem;color:#DC2626">✕ הסר</button>
        </div>
        <input data-field="text" data-qi="${i}" value="${(q.text||'').replace(/"/g,'&quot;')}" placeholder="טקסט השאלה"
          style="width:100%;border:1px solid #CBD5E1;border-radius:8px;padding:0.35rem 0.5rem;font-size:0.8rem;margin-bottom:0.35rem;font-family:inherit;direction:rtl">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;margin-bottom:0.3rem">
          ${(q.opts||[]).map((o,oi)=>`
            <div style="display:flex;align-items:center;gap:0.3rem">
              <input type="radio" name="correct_${i}" value="${oi}" ${q.correct==o?'checked':''} onchange="saQEditCorrect(${i},${oi})">
              <input data-field="opt" data-qi="${i}" data-oi="${oi}" value="${(o||'').replace(/"/g,'&quot;')}" placeholder="אפשרות ${oi+1}"
                style="flex:1;border:1px solid #CBD5E1;border-radius:6px;padding:0.25rem 0.4rem;font-size:0.75rem;font-family:inherit;direction:rtl">
            </div>
          `).join('')}
        </div>
        <input data-field="ex" data-qi="${i}" value="${(q.ex||'').replace(/"/g,'&quot;')}" placeholder="הסבר (אופציונלי)"
          style="width:100%;border:1px solid #CBD5E1;border-radius:8px;padding:0.3rem 0.5rem;font-size:0.75rem;font-family:inherit;direction:rtl;color:#64748B">
      </div>
    `).join('')+`
      <button onclick="saQEditAdd()" style="width:100%;background:#F0FDF4;color:#15803D;border:1px dashed #86EFAC;border-radius:10px;padding:0.5rem;font-size:0.8rem;cursor:pointer;font-weight:600">+ הוסף שאלה</button>
    `;
  }

  // פתח מודאל
  const existing = document.getElementById('sa-quest-edit-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'sa-quest-edit-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:1rem;overflow-y:auto;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:600px;padding:1.5rem;margin:auto;position:relative">
      <button onclick="document.getElementById('sa-quest-edit-modal').remove()"
        style="position:absolute;top:1rem;left:1rem;background:#F1F5F9;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:1rem">✕</button>
      <h2 style="font-weight:800;font-size:1.1rem;text-align:center;margin-bottom:1.2rem">✏️ עריכת קווסט</h2>
      <div style="display:grid;gap:0.7rem;margin-bottom:1rem">
        <div>
          <label style="font-size:0.78rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">כותרת</label>
          <input id="sqe-title" value="${(quest.title||'').replace(/"/g,'&quot;')}"
            style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.5rem 0.75rem;font-size:0.9rem;font-family:inherit;direction:rtl">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
          <div>
            <label style="font-size:0.78rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">נושא</label>
            <select id="sqe-subject" style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.5rem;font-size:0.85rem;font-family:inherit">${subjectOpts}</select>
          </div>
          <div>
            <label style="font-size:0.78rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">קושי (1-3)</label>
            <select id="sqe-diff" style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.5rem;font-size:0.85rem;font-family:inherit">
              <option value="1" ${quest.difficulty==1?'selected':''}>1 — קל</option>
              <option value="2" ${quest.difficulty==2?'selected':''}>2 — בינוני</option>
              <option value="3" ${quest.difficulty==3?'selected':''}>3 — קשה</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.6rem">
          <div>
            <label style="font-size:0.75rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">גיל מינ׳</label>
            <input id="sqe-agemin" type="number" value="${quest.age_min||6}" min="4" max="18"
              style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.4rem;font-size:0.85rem;text-align:center">
          </div>
          <div>
            <label style="font-size:0.75rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">גיל מקס׳</label>
            <input id="sqe-agemax" type="number" value="${quest.age_max||18}" min="4" max="18"
              style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.4rem;font-size:0.85rem;text-align:center">
          </div>
          <div>
            <label style="font-size:0.75rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">FLW</label>
            <input id="sqe-flw" type="number" value="${quest.flw_reward||20}" min="5" max="100"
              style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.4rem;font-size:0.85rem;text-align:center">
          </div>
          <div>
            <label style="font-size:0.75rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">ציון מעבר %</label>
            <input id="sqe-pass" type="number" value="${quest.pass_score||70}" min="50" max="100"
              style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.4rem;font-size:0.85rem;text-align:center">
          </div>
        </div>
        <div>
          <label style="font-size:0.78rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">תיאור</label>
          <input id="sqe-desc" value="${(quest.description||'').replace(/"/g,'&quot;')}"
            style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.5rem 0.75rem;font-size:0.85rem;font-family:inherit;direction:rtl">
        </div>
        <div>
          <label style="font-size:0.78rem;font-weight:700;color:#374151;display:block;margin-bottom:0.2rem">תגיות (מופרדות בפסיק)</label>
          <input id="sqe-tags" value="${(quest.tags||'').replace(/"/g,'&quot;')}"
            style="width:100%;border:1px solid #D1D5DB;border-radius:10px;padding:0.5rem 0.75rem;font-size:0.85rem;font-family:inherit;direction:rtl">
        </div>
      </div>
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:0.5rem;color:#1E293B">❓ שאלות</div>
      <div id="sqe-questions-wrap">${renderQEdit()}</div>
      <button onclick="saQuestEditSave(${questId})"
        style="width:100%;background:#1E293B;color:#fff;border:none;border-radius:12px;
               padding:0.85rem;font-size:0.95rem;font-weight:700;cursor:pointer;margin-top:0.5rem">
        💾 שמור שינויים
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // live sync
  modal.addEventListener('input', e=>{
    const t=e.target, qi=parseInt(t.dataset.qi);
    if(isNaN(qi)) return;
    if(t.dataset.field==='text') questions[qi].text=t.value;
    else if(t.dataset.field==='ex') questions[qi].ex=t.value;
    else if(t.dataset.field==='opt'){ questions[qi].opts[parseInt(t.dataset.oi)]=t.value; }
  });

  window.saQEditRemove = i => { questions.splice(i,1); document.getElementById('sqe-questions-wrap').innerHTML=renderQEdit(); };
  window.saQEditCorrect = (qi,oi) => { questions[qi].correct = questions[qi].opts[oi]; };
  window.saQEditAdd = () => {
    questions.push({text:'',correct:'',opts:['','','',''],ex:''});
    document.getElementById('sqe-questions-wrap').innerHTML=renderQEdit();
  };
  } catch(e){ showToast('error', 'שגיאה בטעינת הקווסט: ' + e.message); }
}

async function saQuestEditSave(questId){
  const title = document.getElementById('sqe-title').value.trim();
  const subject = document.getElementById('sqe-subject').value;
  const difficulty = parseInt(document.getElementById('sqe-diff').value);
  const age_min = parseInt(document.getElementById('sqe-agemin').value);
  const age_max = parseInt(document.getElementById('sqe-agemax').value);
  const flw_reward = parseInt(document.getElementById('sqe-flw').value);
  const pass_score = parseInt(document.getElementById('sqe-pass').value);
  const description = document.getElementById('sqe-desc').value.trim();
  const tags = document.getElementById('sqe-tags').value.trim();

  // collect questions from DOM
  const qWrap = document.getElementById('sqe-questions-wrap');
  const qBlocks = qWrap.querySelectorAll('[data-qi]');
  const seenQi = new Set();
  const questions = [];
  qWrap.querySelectorAll('input[data-field="text"]').forEach(inp=>{
    const i = parseInt(inp.dataset.qi);
    if(seenQi.has(i)) return; seenQi.add(i);
    const opts = [];
    qWrap.querySelectorAll(`input[data-field="opt"][data-qi="${i}"]`).forEach(o=>opts.push(o.value));
    const correctRadio = qWrap.querySelector(`input[type="radio"][name="correct_${i}"]:checked`);
    const correct = correctRadio ? opts[parseInt(correctRadio.value)] : opts[0];
    const ex = (qWrap.querySelector(`input[data-field="ex"][data-qi="${i}"]`)||{}).value||'';
    questions.push({ question_text: inp.value.trim(), correct_answer: correct, options_json: JSON.stringify(opts), explanation: ex });
  });

  if(!title) return showToast('error','חסרה כותרת');
  if(questions.length===0) return showToast('error','חסרות שאלות');

  const btn = document.querySelector('#sa-quest-edit-modal button[onclick*="saQuestEditSave"]');
  if(btn){ btn.disabled=true; btn.textContent='שומר...'; }

  try {
    const res = await fetch(`${API}/sa/quest-library/${questId}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json','Authorization':saToken},
      body: JSON.stringify({title,subject,difficulty,age_min,age_max,flw_reward,pass_score,description,tags,questions})
    });
    const data = await res.json();
    if(!data.success) throw new Error(data.error||'שגיאה');
    showToast('success','✅ הקווסט עודכן!');
    document.getElementById('sa-quest-edit-modal').remove();
    loadSAQuestLib();
  } catch(e){
    showToast('error', e.message);
    if(btn){ btn.disabled=false; btn.textContent='💾 שמור שינויים'; }
  }
}

async function saToggleQHide(id, hide){
  try {
    await fetch(`${API}/sa/quest-library/${id}/visibility`, {
      method:'PATCH', headers:{'Content-Type':'application/json','Authorization':saToken},
      body: JSON.stringify({ isHidden: hide })
    });
    loadSAQuestLib();
  } catch(e){ showToast('error', e.message); }
}
window.saToggleQHide = saToggleQHide;

async function saToggleQFeatured(id, featured){
  try {
    await fetch(`${API}/sa/quest-library/${id}/visibility`, {
      method:'PATCH', headers:{'Content-Type':'application/json','Authorization':saToken},
      body: JSON.stringify({ isFeatured: featured })
    });
    loadSAQuestLib();
  } catch(e){ showToast('error', e.message); }
}
window.saToggleQFeatured = saToggleQFeatured;
window.saEditQuest = saEditQuest;
window.saQuestEditSave = saQuestEditSave;

// ===== SA COMMUNITY FEED =====

function escSA(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _saFeedCurrentTab = 'posts';

async function loadSACommunityFeed() {
    refreshSAFeedStats();
    switchSAFeedTab(_saFeedCurrentTab);
}

async function refreshSAFeedStats() {
    const days = document.getElementById('sa-feed-days')?.value || '7';
    try {
        const r = await fetch(`/api/sa/feed/stats?days=${days}`, { headers: { Authorization: 'Bearer ' + saToken } });
        const d = await r.json();
        const el = id => document.getElementById(id);
        if (el('sa-feed-stat-posts')) el('sa-feed-stat-posts').textContent = d.total_posts || 0;
        if (el('sa-feed-stat-active')) el('sa-feed-stat-active').textContent = d.active_posts || 0;
        if (el('sa-feed-stat-reported')) el('sa-feed-stat-reported').textContent = d.reported_posts || 0;
        if (el('sa-feed-stat-groups')) el('sa-feed-stat-groups').textContent = d.total_groups || 0;
    } catch(e) { /* silent */ }
}

window.switchSAFeedTab = function(tab) {
    _saFeedCurrentTab = tab;
    ['posts','reported','groups'].forEach(t => {
        const btn = document.getElementById(`sa-feed-tab-${t}`);
        if (btn) btn.className = t === tab
            ? 'px-4 py-2 text-sm font-bold text-blue-700 border-b-2 border-blue-600 bg-blue-50 rounded-t-lg transition'
            : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300 transition';
    });
    if (tab === 'posts') loadSAFeedPosts(false);
    else if (tab === 'reported') loadSAReportedPosts();
    else if (tab === 'groups') loadSAGroups();
};

async function loadSAFeedPosts(hiddenOnly = false) {
    const cont = document.getElementById('sa-feed-tab-content');
    if (!cont) return;
    cont.innerHTML = '<div class="text-center py-8 text-slate-400">טוען...</div>';
    try {
        const r = await fetch(`/api/sa/feed/posts?hidden=${hiddenOnly ? 1 : 0}`, { headers: { Authorization: 'Bearer ' + saToken } });
        const posts = await r.json();
        if (!posts.length) { cont.innerHTML = '<div class="text-center py-8 text-slate-400">אין פוסטים להצגה</div>'; return; }
        cont.innerHTML = posts.map(p => `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-3">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <span class="font-bold text-slate-800 text-sm">${escSA(p.author_name)}</span>
                        <span class="text-xs text-slate-400 mr-2">${escSA(p.community_name || '')}</span>
                        ${p.is_pinned ? '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full mr-1">📌 מוצמד</span>' : ''}
                        ${p.is_hidden ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full mr-1">🚫 מוסתר</span>' : ''}
                    </div>
                    <button onclick="saToggleFeedPost(${p.id}, ${p.is_hidden})" class="text-xs px-3 py-1 rounded-xl border font-medium transition ${p.is_hidden ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'}">${p.is_hidden ? 'הצג' : 'הסתר'}</button>
                </div>
                <p class="text-sm text-slate-700 mb-2 whitespace-pre-line">${escSA(p.content)}</p>
                <div class="flex gap-4 text-xs text-slate-400">
                    <span>👍 ${p.likes_count}</span>
                    <span>💬 ${p.comments_count}</span>
                    <span>🚩 ${p.reports_count}</span>
                    <span>📤 ${p.shares_count}</span>
                </div>
            </div>`).join('');
    } catch(e) { cont.innerHTML = `<div class="text-center py-8 text-red-400">${escSA(e.message)}</div>`; }
}

async function loadSAReportedPosts() {
    await loadSAFeedPosts(false);
    const cont = document.getElementById('sa-feed-tab-content');
    if (!cont) return;
    cont.innerHTML = '<div class="text-center py-8 text-slate-400">טוען דיווחים...</div>';
    try {
        const r = await fetch('/api/sa/feed/reported', { headers: { Authorization: 'Bearer ' + saToken } });
        const posts = await r.json();
        if (!posts.length) { cont.innerHTML = '<div class="text-center py-8 text-slate-400">אין פוסטים מדווחים</div>'; return; }
        cont.innerHTML = posts.map(p => `
            <div class="bg-white rounded-2xl shadow-sm border border-red-100 p-4 mb-3">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <span class="font-bold text-slate-800 text-sm">${escSA(p.author_name)}</span>
                        <span class="text-xs text-red-500 mr-2">🚩 ${p.reports_count} דיווחים</span>
                    </div>
                    <button onclick="saToggleFeedPost(${p.id}, ${p.is_hidden})" class="text-xs px-3 py-1 rounded-xl border font-medium transition ${p.is_hidden ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}">${p.is_hidden ? 'הצג' : 'הסתר'}</button>
                </div>
                <p class="text-sm text-slate-700 mb-2">${escSA(p.content)}</p>
                <div class="flex gap-4 text-xs text-slate-400">
                    <span>👍 ${p.likes_count}</span><span>💬 ${p.comments_count}</span>
                </div>
            </div>`).join('');
    } catch(e) { cont.innerHTML = `<div class="text-center py-8 text-red-400">${escSA(e.message)}</div>`; }
}

window.saToggleFeedPost = async function(postId, isHidden) {
    try {
        const r = await fetch(`/api/sa/feed/posts/${postId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + saToken },
            body: JSON.stringify({ hidden: !isHidden })
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.error || 'שגיאה');
        showToast('success', isHidden ? 'הפוסט הוצג מחדש' : 'הפוסט הוסתר');
        switchSAFeedTab(_saFeedCurrentTab);
    } catch(e) { showToast('error', e.message); }
};

async function loadSAGroups() {
    const cont = document.getElementById('sa-feed-tab-content');
    if (!cont) return;
    cont.innerHTML = '<div class="text-center py-8 text-slate-400">טוען קבוצות...</div>';
    try {
        const r = await fetch('/api/sa/feed/groups', { headers: { Authorization: 'Bearer ' + saToken } });
        const groups = await r.json();
        cont.innerHTML = `
            <div class="mb-4 flex justify-end">
                <button onclick="createSAGroup()" class="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition">+ קבוצה חדשה</button>
            </div>
            ${!groups.length ? '<div class="text-center py-8 text-slate-400">אין קבוצות עניין</div>' : groups.map(g => `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-3 flex items-center justify-between">
                <div>
                    <span class="text-xl ml-2">${escSA(g.icon_emoji || '📌')}</span>
                    <span class="font-bold text-slate-800">${escSA(g.name)}</span>
                    <span class="text-xs text-slate-400 mr-2">${escSA(g.community_name || '')}</span>
                </div>
                <div class="text-xs text-slate-500 flex gap-3">
                    <span>👥 ${g.members_count}</span>
                    <span>📝 ${g.posts_count}</span>
                </div>
            </div>`).join('')}`;
    } catch(e) { cont.innerHTML = `<div class="text-center py-8 text-red-400">${escSA(e.message)}</div>`; }
}

window.createSAGroup = async function() {
    const name = prompt('שם הקבוצה:');
    if (!name) return;
    const communityId = prompt('מזהה קהילה (community_id):');
    if (!communityId) return;
    const icon = prompt('אמוג׳י לקבוצה (ברירת מחדל 📌):') || '📌';
    try {
        const r = await fetch('/api/sa/feed/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + saToken },
            body: JSON.stringify({ name, community_id: communityId, icon_emoji: icon })
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.error || 'שגיאה');
        showToast('success', 'קבוצה נוצרה בהצלחה');
        loadSAGroups();
    } catch(e) { showToast('error', e.message); }
};

window.runSAFeedAI = async function() {
    const resultPanel = document.getElementById('sa-feed-ai-result');
    const textEl = document.getElementById('sa-feed-ai-text');
    if (!resultPanel || !textEl) return;
    resultPanel.classList.remove('hidden');
    textEl.textContent = 'מנתח נתוני פיד...';
    const days = document.getElementById('sa-feed-days')?.value || '7';
    try {
        const r = await fetch(`/api/sa/feed/stats?days=${days}`, { headers: { Authorization: 'Bearer ' + saToken } });
        const d = await r.json();
        textEl.textContent = `ניתוח ${days} הימים האחרונים:\n• סה"כ פוסטים: ${d.total_posts || 0}\n• פוסטים פעילים: ${d.active_posts || 0}\n• מדווחים: ${d.reported_posts || 0}\n• קבוצות עניין: ${d.total_groups || 0}\n\n${(d.reported_posts || 0) > 5 ? '⚠️ ישנם פוסטים מדווחים רבים — מומלץ לבדוק.' : '✅ רמת הדיווחים תקינה.'}`;
    } catch(e) { textEl.textContent = 'שגיאה בטעינת ניתוח'; }
};

window.refreshSAFeedStats = refreshSAFeedStats;
window.loadSACommunityFeed = loadSACommunityFeed;
window.switchSAFeedTab = window.switchSAFeedTab;

// ===== SA BIZ COMMUNITY FEED =====
let _saRejectPostId = null;

window.switchSAContentTab = function(tab) {
    switchViewTab('content', tab);
    if (tab === 'biz-feed') loadSABizFeedSection();
};

async function initSABizFeedBadge() {
    try {
        const res = await fetch('/api/sa/community/biz-posts/pending-count');
        const data = await res.json();
        const badge = document.getElementById('sa-biz-posts-badge');
        if (!badge) return;
        if (data.count > 0) {
            badge.textContent = data.count > 9 ? '9+' : data.count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch(e) {}
}

async function loadSABizFeedSection() {
    await initSABizFeedBadge();
    await loadSABizFeedMetrics();
    await loadSABizFeedPosts('pending');
}

async function loadSABizFeedMetrics() {
    try {
        const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
            fetch('/api/sa/community/biz-posts?status=pending').then(r => r.json()),
            fetch('/api/sa/community/biz-posts?status=approved').then(r => r.json()),
            fetch('/api/sa/community/biz-posts?status=rejected').then(r => r.json()),
        ]);
        const el = document.getElementById('sa-biz-feed-metrics');
        if (!el) return;
        const pendingCount = pendingRes.pendingCount || pendingRes.posts?.length || 0;
        el.innerHTML = `
          <div style="background:white;border-radius:12px;padding:0.8rem;border:2px solid ${pendingCount>0?'#FED7AA':'#E0E0E0'};text-align:center">
            <div style="font-size:1.6rem;font-weight:900;color:${pendingCount>0?'#D97706':'#94A3B8'}">${pendingCount}</div>
            <div style="font-size:0.68rem;color:#94A3B8">ממתינים</div>
          </div>
          <div style="background:white;border-radius:12px;padding:0.8rem;border:1px solid #E0E0E0;text-align:center">
            <div style="font-size:1.6rem;font-weight:900;color:#16A34A">${approvedRes.posts?.length || 0}</div>
            <div style="font-size:0.68rem;color:#94A3B8">פעילים</div>
          </div>
          <div style="background:white;border-radius:12px;padding:0.8rem;border:1px solid #E0E0E0;text-align:center">
            <div style="font-size:1.6rem;font-weight:900;color:#EF4444">${rejectedRes.posts?.length || 0}</div>
            <div style="font-size:0.68rem;color:#94A3B8">נדחו</div>
          </div>`;
    } catch(e) {}
}

window.loadSABizFeedPosts = async function(status = 'pending') {
    document.querySelectorAll('.sa-biz-filter').forEach(b => {
        b.style.background = '#F3F4F6';
        b.style.color = '#555';
        b.style.borderColor = '#E0E0E0';
    });
    const activeBtn = document.getElementById(`sa-biz-filter-${status}`);
    if (activeBtn) {
        const colors = {
            pending: { bg: '#FEF3C7', color: '#B45309', border: '#B45309' },
            approved: { bg: '#F0FDF4', color: '#16A34A', border: '#16A34A' },
            rejected: { bg: '#FEF2F2', color: '#EF4444', border: '#EF4444' },
        };
        const c = colors[status];
        if (c) { activeBtn.style.background = c.bg; activeBtn.style.color = c.color; activeBtn.style.borderColor = c.border; }
    }
    const list = document.getElementById('sa-biz-feed-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:1rem">טוען...</div>';
    try {
        const res = await fetch(`/api/sa/community/biz-posts?status=${status}`);
        const data = await res.json();
        if (!data.posts?.length) {
            list.innerHTML = `<div style="text-align:center;padding:2rem;color:#94A3B8">${
                status==='pending' ? '✅ אין פוסטים ממתינים' :
                status==='approved' ? 'אין פוסטים פעילים' : 'אין פוסטים שנדחו'}</div>`;
            return;
        }
        const borderColor = { pending:'#FED7AA', approved:'#BBF7D0', rejected:'#FECACA' };
        const bgColor = { pending:'#FFFBEB', approved:'#F0FDF4', rejected:'#FEF2F2' };
        list.innerHTML = data.posts.map(p => `
          <div style="background:white;border-radius:14px;border:1.5px solid ${borderColor[status]||'#E0E0E0'};margin-bottom:0.8rem;overflow:hidden">
            <div style="padding:0.7rem 0.9rem;background:${bgColor[status]||'#F9FAFB'};display:flex;align-items:center;gap:0.6rem;border-bottom:1px solid #F0F0F0">
              ${p.business_logo
                ? `<img src="${p.business_logo}" style="width:32px;height:32px;border-radius:8px;object-fit:cover">`
                : `<div style="width:32px;height:32px;border-radius:8px;background:#E0E0E0;display:flex;align-items:center;justify-content:center;font-size:1rem">🏪</div>`}
              <div style="flex:1">
                <div style="font-weight:700;font-size:0.85rem">${safeStr(p.business_name||'עסק')}</div>
                <div style="font-size:0.7rem;color:#94A3B8">${safeStr(p.community_name||'')} · ${new Date(p.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <div style="font-size:0.72rem;font-weight:700;padding:0.15rem 0.5rem;border-radius:50px;background:${p.post_type==='promo'?'#FEF3C7':'#EFF6FF'};color:${p.post_type==='promo'?'#B45309':'#1D4ED8'}">${p.post_type==='promo'?'🏷️ מבצע':'📢 עדכון'}</div>
            </div>
            <div style="padding:0.7rem 0.9rem">
              <div style="font-size:0.88rem;color:#1E293B;line-height:1.5;margin-bottom:0.5rem">${safeStr(p.content||'')}</div>
              ${p.biz_valid_until ? `<div style="font-size:0.72rem;color:#94A3B8;margin-bottom:0.5rem">⌛ תוקף עד: ${new Date(p.biz_valid_until).toLocaleDateString('he-IL')}</div>` : ''}
              ${p.biz_promo_url ? `<div style="font-size:0.72rem;color:#1D4ED8;margin-bottom:0.5rem">🔗 ${safeStr(p.biz_promo_url)}</div>` : ''}
              ${p.image_url ? `<img src="${safeStr(p.image_url)}" style="width:100%;border-radius:8px;max-height:150px;object-fit:cover;margin-bottom:0.5rem">` : ''}
              ${status === 'pending' ? `
              <div style="display:flex;gap:0.5rem;margin-top:0.3rem">
                <button onclick="approveSABizPost(${p.id})" style="flex:1;background:#16A34A;color:white;border:none;border-radius:10px;padding:0.65rem;font-weight:700;cursor:pointer;font-size:0.85rem">✅ אשר</button>
                <button onclick="openSARejectModal(${p.id})" style="flex:1;background:#EF4444;color:white;border:none;border-radius:10px;padding:0.65rem;font-weight:700;cursor:pointer;font-size:0.85rem">❌ דחה</button>
              </div>` : ''}
              ${status === 'approved' ? `
              <div style="display:flex;gap:0.5rem;margin-top:0.3rem">
                <button onclick="hideSABizPost(${p.id})" style="background:#FEE2E2;color:#EF4444;border:none;border-radius:8px;padding:0.4rem 0.8rem;font-size:0.78rem;font-weight:700;cursor:pointer">🚫 הסתר</button>
                <span style="font-size:0.75rem;color:#94A3B8;align-self:center">❤️ ${p.likes_count||0} · 💬 ${p.comments_count||0}</span>
              </div>` : ''}
            </div>
          </div>`).join('');
    } catch(e) {
        list.innerHTML = '<div style="text-align:center;color:#EF4444">שגיאה בטעינה</div>';
    }
};

window.approveSABizPost = async function(postId) {
    try {
        await fetch(`/api/sa/community/biz-posts/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' })
        });
        showToast('success', 'הפוסט אושר ויוצג בפיד ✅');
        loadSABizFeedPosts('pending');
        loadSABizFeedMetrics();
        initSABizFeedBadge();
    } catch(e) {}
};

window.openSARejectModal = function(postId) {
    _saRejectPostId = postId;
    document.querySelectorAll('input[name="reject-reason"]').forEach(r => r.checked = false);
    const custom = document.getElementById('sa-reject-custom');
    if (custom) { custom.style.display = 'none'; custom.value = ''; }
    const modal = document.getElementById('sa-reject-modal');
    if (modal) modal.style.display = 'flex';
    document.querySelectorAll('input[name="reject-reason"]').forEach(r => {
        r.onchange = () => {
            if (custom) custom.style.display = r.value === 'other' ? 'block' : 'none';
        };
    });
};

window.closeSARejectModal = function() {
    _saRejectPostId = null;
    const modal = document.getElementById('sa-reject-modal');
    if (modal) modal.style.display = 'none';
};

window.confirmSAReject = async function() {
    const selected = document.querySelector('input[name="reject-reason"]:checked');
    if (!selected) { alert('בחר סיבת דחייה'); return; }
    let reason = selected.value;
    if (reason === 'other') {
        reason = document.getElementById('sa-reject-custom')?.value?.trim();
        if (!reason) { alert('כתוב סיבה'); return; }
    }
    try {
        await fetch(`/api/sa/community/biz-posts/${_saRejectPostId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected', rejectionReason: reason })
        });
        closeSARejectModal();
        showToast('info', 'הפוסט נדחה, העסק יקבל הודעה');
        loadSABizFeedPosts('pending');
        loadSABizFeedMetrics();
        initSABizFeedBadge();
    } catch(e) {}
};

window.hideSABizPost = async function(postId) {
    if (!confirm('להסתיר את הפוסט מהפיד?')) return;
    try {
        await fetch(`/api/sa/community/posts/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isHidden: true })
        });
        showToast('info', 'הפוסט הוסתר');
        loadSABizFeedPosts('approved');
    } catch(e) {}
};

// אתחול הבאדג' בטעינת הדף
setTimeout(initSABizFeedBadge, 2000);

// ── ניהול לקסיקון טריוויה ────────────────────────────────────────────────────
async function uploadTriviaQuestions(event) {
  const file = event.target.files[0];
  if (!file) return;
  let json;
  try {
    const text = await file.text();
    json = JSON.parse(text);
  } catch(e) {
    alert('קובץ JSON לא תקין: ' + e.message);
    event.target.value = '';
    return;
  }
  if (!json[6] && !json['6']) {
    alert('מבנה לא תקין — חסרה קבוצת גיל 6');
    event.target.value = '';
    return;
  }
  const btn = event.target.closest('label');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> מעלה...';
  try {
    const res = await fetch('/api/sa/trivia-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('ofl_sa_token') },
      body: JSON.stringify(json)
    });
    if (!res.ok) throw new Error(await res.text());
    btn.innerHTML = '<i class="fa-solid fa-check text-xs"></i> הועלה!';
    btn.style.background = '#d1fae5';
    btn.style.color = '#065f46';
    btn.style.borderColor = '#6ee7b7';
    setTimeout(() => { btn.innerHTML = orig; btn.style = ''; }, 3000);
  } catch(e) {
    alert('שגיאה בהעלאה: ' + e.message);
    btn.innerHTML = orig;
  }
  event.target.value = '';
}

// ===== LIVE GAMES — SUPER ADMIN =====

let _lgEditId = null;

async function loadSALiveGames() {
  const el = document.getElementById('sa-view-livegames');
  if (!el) return;
  el.innerHTML = `<div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-slate-100">משחקים חיים</h2>
      <button onclick="openLGEditor(null)" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition"><i class="fa-solid fa-plus ml-2"></i>משחק חדש</button>
    </div>
    <div id="lg-list" class="space-y-3"><div class="text-slate-400 text-sm">טוען...</div></div>
  </div>`;
  await _fetchLGList();
}

async function _fetchLGList() {
  const saToken = localStorage.getItem('ofl_sa_token');
  const r = await fetch('/api/live-games', { headers: { Authorization: saToken } });
  const data = await r.json();
  const el = document.getElementById('lg-list');
  if (!el) return;
  if (!data.games || !data.games.length) { el.innerHTML = '<div class="text-slate-400 text-sm">אין משחקים עדיין</div>'; return; }
  const statusLabel = { waiting:'ממתין', active:'פעיל', ended:'הסתיים', disabled:'מושבת' };
  const statusColor = { waiting:'bg-slate-600', active:'bg-green-600', ended:'bg-slate-500', disabled:'bg-red-600' };
  el.innerHTML = data.games.map(g => `
    <div class="bg-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-bold text-slate-100 truncate">${g.title}</span>
          <span class="text-xs px-2 py-0.5 rounded-full text-white ${statusColor[g.status] || 'bg-slate-600'}">${statusLabel[g.status] || g.status}</span>
        </div>
        <div class="text-xs text-slate-400">קוד: <span class="font-mono text-indigo-400 font-bold">${g.game_code}</span> · ${g.participants_count} משתתפים · ${g.prize || 'אין פרס'}${g.is_hidden ? ' · <span class="text-red-400">🙈 מוסתר</span>' : ''}${g.is_public ? ' · <span class="text-green-400">🌐 ציבורי</span>' : ''}</div>
      </div>
      <div class="flex gap-2 shrink-0">
        <button onclick="openLGControl('${g.id}','${g.game_code}')" class="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs transition"><i class="fa-solid fa-gamepad"></i></button>
        <button onclick="openLGEditor(${g.id})" class="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs transition"><i class="fa-solid fa-pen"></i></button>
      </div>
    </div>
  `).join('');
}

async function openLGEditor(id) {
  _lgEditId = id;
  const saToken = localStorage.getItem('ofl_sa_token');
  let game = null, questions = [];
  if (id) {
    const r = await fetch(`/api/live-games/${id}`, { headers: { Authorization: saToken } });
    const data = await r.json();
    game = data.game; questions = data.questions || [];
  }
  const modal = document.createElement('div');
  modal.id = 'lg-editor-modal';
  modal.className = 'fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
      <div class="flex items-center justify-between p-5 border-b border-slate-700">
        <h3 class="font-bold text-lg">${id ? 'עריכת משחק' : 'משחק חדש'}</h3>
        <button onclick="document.getElementById('lg-editor-modal').remove()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-5 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-3"><label class="block text-xs text-slate-400 mb-1">שם האירוע / המשחק *</label>
            <input id="lg-title" value="${game?.title || ''}" class="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"></div>
          <div><label class="block text-xs text-slate-400 mb-1">שם עסק / חסות</label>
            <input id="lg-biz" value="${game?.business_name || ''}" placeholder="שם לחסות" class="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"></div>
          <div class="md:col-span-2"><label class="block text-xs text-slate-400 mb-1">פרס</label>
            <input id="lg-prize" value="${game?.prize || ''}" placeholder="לדוגמה: שובר מתנה ₪200" class="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"></div>
          <div class="md:col-span-3"><label class="block text-xs text-slate-400 mb-1">שם החסות (מוצג בחלונית פתיחה)</label>
            <input id="lg-sponsor-name" value="${game?.sponsor_name || ''}" placeholder="לדוגמה: בחסות סופר X" class="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"></div>
          <div class="md:col-span-3"><label class="block text-xs text-slate-400 mb-1">טקסט חלונית פתיחה</label>
            <textarea id="lg-sponsor-text" rows="2" placeholder="טקסט שיופיע לשחקן בכניסה למשחק (אופציונלי)" class="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${game?.sponsor_text || ''}</textarea></div>
          <div class="md:col-span-3"><label class="block text-xs text-slate-400 mb-1">טקסט הודעת וואטסאפ (ישלח עם קישור)</label>
            <textarea id="lg-wa-text" rows="3" placeholder="אם ריק, יישלח טקסט ברירת מחדל" class="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${game?.whatsapp_text || ''}</textarea></div>
          <div class="md:col-span-3 flex gap-4 flex-wrap">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="lg-is-public" ${game?.is_public ? 'checked' : ''} onchange="_lgTogglePublicRow(this.checked)" class="accent-indigo-500 w-4 h-4">
              <span class="text-xs text-slate-300">פתוח לכל חברי הקהילה (מופיע בלוח הקהילה)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="lg-is-hidden" ${game?.is_hidden ? 'checked' : ''} class="accent-red-500 w-4 h-4">
              <span class="text-xs text-red-400">הסתר משחק (חסום גם ויזואלית)</span>
            </label>
          </div>
          <div id="lg-community-row" class="${game?.is_public ? '' : 'hidden'} md:col-span-3">
            <label class="block text-xs text-slate-400 mb-1">קהילה (ריק = כל הקהילות)</label>
            <select id="lg-community-id" class="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">כל הקהילות</option>
            </select>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-bold text-sm">שאלות</h4>
            <button onclick="_lgAddQuestion()" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition">+ הוסף שאלה</button>
          </div>
          <div id="lg-questions-list" class="space-y-4"></div>
        </div>
        <button onclick="_saveLGGame()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition">שמור משחק</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  window._lgGameMeta = { is_public: game?.is_public || false, is_hidden: game?.is_hidden || false };
  window._lgQuestions = questions.map(q => ({ question: q.question, opts: Array.isArray(q.opts) ? q.opts : JSON.parse(q.opts), correct_index: q.correct_index, time_seconds: q.time_seconds || 20 }));
  _renderLGQuestions();
  // load communities for dropdown
  fetch('/api/sa/communities-list', { headers:{ Authorization: saToken } }).then(r=>r.json()).then(d => {
    const sel = document.getElementById('lg-community-id');
    if (!sel || !d.communities) return;
    d.communities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name}${c.city ? ' · ' + c.city : ''}`;
      if (game?.community_id && String(game.community_id) === String(c.id)) opt.selected = true;
      sel.appendChild(opt);
    });
  }).catch(()=>{});
}

function _lgTogglePublicRow(checked) {
  const row = document.getElementById('lg-community-row');
  if (row) row.classList.toggle('hidden', !checked);
}

function _renderLGQuestions() {
  const el = document.getElementById('lg-questions-list');
  if (!el) return;
  el.innerHTML = window._lgQuestions.map((q, i) => `
    <div class="bg-slate-700 rounded-xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-slate-300">שאלה ${i+1}</span>
        <div class="flex gap-2">
          <input type="number" value="${q.time_seconds || 20}" min="5" max="60" onchange="window._lgQuestions[${i}].time_seconds=parseInt(this.value)"
            class="w-16 bg-slate-600 rounded px-2 py-1 text-xs outline-none text-center" title="שניות">
          <span class="text-xs text-slate-400 self-center">שנ'</span>
          <button onclick="window._lgQuestions.splice(${i},1);_renderLGQuestions()" class="text-red-400 hover:text-red-300 text-xs px-2"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <input value="${q.question.replace(/"/g,'&quot;')}" onchange="window._lgQuestions[${i}].question=this.value"
        placeholder="טקסט השאלה" class="w-full bg-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none">
      <div class="grid grid-cols-2 gap-2">
        ${q.opts.map((opt, j) => `
          <div class="flex items-center gap-2">
            <input type="radio" name="correct-${i}" ${q.correct_index===j?'checked':''} onchange="window._lgQuestions[${i}].correct_index=${j}" class="accent-green-500 shrink-0">
            <input value="${opt.replace(/"/g,'&quot;')}" onchange="window._lgQuestions[${i}].opts[${j}]=this.value"
              placeholder="תשובה ${j+1}" class="flex-1 bg-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none ${q.correct_index===j?'ring-1 ring-green-500':''}">
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function _lgAddQuestion() {
  window._lgQuestions.push({ question: '', opts: ['','','',''], correct_index: 0, time_seconds: 20 });
  _renderLGQuestions();
}

async function _saveLGGame() {
  const saToken = localStorage.getItem('ofl_sa_token');
  const body = {
    title: document.getElementById('lg-title').value.trim(),
    business_name: document.getElementById('lg-biz').value.trim(),
    prize: document.getElementById('lg-prize').value.trim(),
    sponsor_name: document.getElementById('lg-sponsor-name').value.trim(),
    sponsor_text: document.getElementById('lg-sponsor-text').value.trim(),
    whatsapp_text: document.getElementById('lg-wa-text').value.trim(),
    is_public: document.getElementById('lg-is-public').checked,
    is_hidden: document.getElementById('lg-is-hidden').checked,
    community_id: document.getElementById('lg-community-id')?.value || null,
    questions: window._lgQuestions
  };
  if (!body.title) return alert('יש להזין שם לאירוע');
  const url = _lgEditId ? `/api/live-games/${_lgEditId}` : '/api/live-games';
  const method = _lgEditId ? 'PUT' : 'POST';
  const r = await fetch(url, { method, headers: { 'Content-Type':'application/json', Authorization: saToken }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!data.success) return alert('שגיאה: ' + (data.error || 'לא ידועה'));
  document.getElementById('lg-editor-modal')?.remove();
  await _fetchLGList();
  if (!_lgEditId && data.game) openLGControl(data.game.id, data.game.game_code);
}

async function openLGControl(gameId, gameCode) {
  const saToken = localStorage.getItem('ofl_sa_token');
  // fetch game data to get custom WA text
  const gRes = await fetch(`/api/live-games/${gameId}`, { headers:{ Authorization: saToken } });
  const gData = await gRes.json();
  const gMeta = gData.game || {};
  const modal = document.createElement('div');
  modal.id = 'lg-control-modal';
  modal.className = 'fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4';
  const localLink = `${window.location.origin}/game/${gameCode}`;
  const prodLink = `https://oneflowlife.co.il/game/${gameCode}`;
  const defaultWaMsg = `🏆 הוזמנת למשחק${gMeta.title ? ': ' + gMeta.title : ' טריוויה חי'}!${gMeta.sponsor_name ? '\nבחסות: ' + gMeta.sponsor_name : ''}${gMeta.prize ? '\nפרס: ' + gMeta.prize : ''}\nלחץ כדי להצטרף:\n${prodLink}`;
  const waMsg = (gMeta.whatsapp_text || defaultWaMsg).replace(/\{link\}/g, prodLink);
  const waText = encodeURIComponent(waMsg);
  modal.innerHTML = `
    <div class="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl">
      <div class="flex items-center justify-between p-5 border-b border-slate-700">
        <h3 class="font-bold text-lg">ניהול משחק · <span class="font-mono text-indigo-400">${gameCode}</span></h3>
        <button onclick="document.getElementById('lg-control-modal').remove()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-5 space-y-4">

        <!-- Tabs -->
        <div class="flex bg-slate-700 rounded-xl p-1 gap-1 flex-wrap">
          <button onclick="_lgTab('control')" id="lg-tab-control" class="flex-1 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white transition">🎮 שליטה</button>
          <button onclick="_lgTab('waiting')" id="lg-tab-waiting" class="flex-1 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition">🚪 חדר המתנה</button>
          <button onclick="_lgTab('results')" id="lg-tab-results" class="flex-1 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition">🏆 תוצאות</button>
          <button onclick="_lgTab('preview')" id="lg-tab-preview" class="flex-1 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition">👁️ תצוגה</button>
          <button onclick="_lgTab('send')" id="lg-tab-send" class="flex-1 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition">📤 שליחה</button>
        </div>

        <!-- TAB: Control -->
        <div id="lg-panel-control">
          <div class="bg-slate-700 rounded-xl p-4 mb-3">
            <div class="text-xs text-slate-400 mb-1">קישור למשחק</div>
            <div class="font-mono text-indigo-400 text-xs break-all mb-3">${prodLink}</div>
            <div class="flex gap-2">
              <button onclick="navigator.clipboard.writeText('${prodLink}');this.textContent='✅ הועתק!';setTimeout(()=>this.textContent='העתק קישור',2000)"
                class="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded-lg text-xs transition">העתק קישור</button>
              <a href="https://wa.me/?text=${waText}" target="_blank"
                class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs text-center transition">📲 WhatsApp</a>
            </div>
          </div>
          <div class="bg-slate-700 rounded-xl p-4 text-center mb-3">
            <div class="text-3xl font-bold text-indigo-400" id="lg-ctrl-count">-</div>
            <div class="text-xs text-slate-400">משתתפים מחוברים</div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button onclick="_lgSetStatus(${gameId},'active')" class="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-bold transition">▶ התחל משחק</button>
            <button onclick="_lgNextQuestion(${gameId})" class="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition">שאלה הבאה ▶</button>
            <button onclick="_lgNotifyStart(${gameId})" class="bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl text-sm font-bold transition">⏰ שלח התראת התחלה</button>
            <button onclick="_lgSetStatus(${gameId},'ended')" class="bg-slate-600 hover:bg-slate-500 text-white py-3 rounded-xl text-sm font-bold transition">סיים משחק</button>
            <button id="lg-hidden-btn" onclick="_lgToggleHidden(${gameId})" class="${gMeta.is_hidden ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-orange-700 hover:bg-orange-800'} text-white py-3 rounded-xl text-sm font-bold transition">${gMeta.is_hidden ? '👁️ הצג משחק' : '🙈 הסתר משחק'}</button>
            <button onclick="_lgSetStatus(${gameId},'disabled')" class="bg-red-700 hover:bg-red-800 text-white py-3 rounded-xl text-sm font-bold transition">🚫 כבה משחק</button>
          </div>
          <div id="lg-ctrl-msg" class="text-center text-xs text-slate-100 mt-3"></div>
        </div>

        <!-- TAB: Waiting Room -->
        <div id="lg-panel-waiting" class="hidden space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-xs text-slate-300">משתמשים שנכנסו לקישור וממתינים לאישורך</div>
            <button onclick="_lgApproveAll(${gameId})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">✅ אשר הכל</button>
          </div>
          <div id="lg-waiting-list" class="space-y-2 max-h-96 overflow-y-auto">
            <div class="text-slate-400 text-xs text-center py-4">טוען...</div>
          </div>
        </div>

        <!-- TAB: Results / Leaderboard -->
        <div id="lg-panel-results" class="hidden space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-xs text-slate-300">טבלת תוצאות סופית</div>
            <button onclick="_lgLoadResults(${gameId})" class="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs transition">רענן</button>
          </div>
          <div id="lg-results-list" class="space-y-2 max-h-96 overflow-y-auto">
            <div class="text-slate-400 text-xs text-center py-4">לחץ על רענן לטעינת התוצאות</div>
          </div>
          <button onclick="_lgCopyResults(${gameId})" class="w-full bg-indigo-700 hover:bg-indigo-600 text-white py-2.5 rounded-lg text-xs font-bold transition">📋 העתק טבלת תוצאות</button>
        </div>

        <!-- TAB: Preview -->
        <div id="lg-panel-preview" class="hidden">
          <div class="text-xs text-slate-300 mb-2">תצוגת שחקן בתוך הממשק — המשחק פועל בזמן אמת לפי הסטטוס הנוכחי</div>
          <div class="flex gap-2 mb-3">
            <button onclick="_lgSetStatus(${gameId},'waiting').then(()=>document.getElementById('lg-preview-frame').src=document.getElementById('lg-preview-frame').src)"
              class="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs transition">אפס למצב המתנה</button>
            <button onclick="_lgSetStatus(${gameId},'active').then(()=>setTimeout(()=>document.getElementById('lg-preview-frame').src=document.getElementById('lg-preview-frame').src,500))"
              class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs transition">הפעל ← ראה תגובה</button>
            <button onclick="document.getElementById('lg-preview-frame').src=document.getElementById('lg-preview-frame').src"
              class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs transition">רענן תצוגה</button>
          </div>
          <div class="relative rounded-2xl overflow-hidden border-4 border-slate-600 shadow-2xl" style="height:560px">
            <!-- Mobile frame simulation -->
            <div class="absolute top-0 left-0 right-0 h-6 bg-slate-900 flex items-center justify-center z-10">
              <div class="w-16 h-1.5 bg-slate-600 rounded-full"></div>
            </div>
            <iframe id="lg-preview-frame" src="${localLink}" class="w-full h-full border-0 pt-6" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
          </div>
          <div class="text-center mt-2">
            <a href="${localLink}" target="_blank" class="text-indigo-400 text-xs hover:underline">פתח בחלון נפרד ↗</a>
          </div>
        </div>

        <!-- TAB: Send to testers -->
        <div id="lg-panel-send" class="hidden space-y-3">
          <!-- Filter by source -->
          <div class="flex gap-2 flex-wrap">
            <button onclick="_lgFilterSource('')" class="lg-src-btn bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">הכל</button>
            <button onclick="_lgFilterSource('self')" class="lg-src-btn bg-slate-700 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs transition">עצמאי</button>
            <button onclick="_lgFilterSource('game:${gameCode}')" class="lg-src-btn bg-slate-700 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs transition">דרך משחק זה</button>
            <button onclick="_lgFilterSource('referral:')" class="lg-src-btn bg-slate-700 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs transition">דרך חבר</button>
          </div>
          <!-- Search -->
          <input id="lg-tester-search" placeholder="חפש שם, טלפון, או מקור הרשמה..." oninput="_lgSearchTesters(this.value)"
            class="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500">
          <!-- Assign all visible -->
          <button onclick="_lgAssignVisible(${gameId})" class="w-full bg-indigo-700 hover:bg-indigo-600 text-white py-2.5 rounded-lg text-xs font-bold transition">
            📨 שלח הודעה פנימית לכל המוצגים
          </button>
          <div id="lg-tester-results" class="space-y-2 max-h-56 overflow-y-auto"></div>
          <!-- Copy link -->
          <div class="border-t border-slate-700 pt-3 flex gap-2">
            <input value="${prodLink}" readonly class="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-indigo-400 outline-none">
            <button onclick="navigator.clipboard.writeText('${prodLink}');this.textContent='✅';setTimeout(()=>this.textContent='העתק',2000)"
              class="bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded-lg text-xs transition">העתק</button>
          </div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(modal);
  window._lgCurrentGameCode = gameCode;
  window._lgCurrentGameLink = prodLink;
  window._lgCurrentGameId = gameId;
  _lgVisibleGroupIds = [];
  _lgSourceFilter = '';
  _lgControlPoll(gameId, gameCode);
}

function _lgTab(name) {
  ['control','waiting','results','preview','send'].forEach(t => {
    const panel = document.getElementById(`lg-panel-${t}`);
    if (panel) panel.classList.toggle('hidden', t !== name);
    const btn = document.getElementById(`lg-tab-${t}`);
    if (btn) btn.className = t === name
      ? 'flex-1 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white transition'
      : 'flex-1 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition';
  });
  if (name === 'waiting' && window._lgCurrentGameId) _lgLoadWaitingRoom(window._lgCurrentGameId);
  if (name === 'results' && window._lgCurrentGameId) _lgLoadResults(window._lgCurrentGameId);
}

let _lgVisibleGroupIds = [];
let _lgSourceFilter = '';

function _lgFilterSource(src) {
  _lgSourceFilter = src;
  document.querySelectorAll('.lg-src-btn').forEach(b => {
    b.className = 'lg-src-btn bg-slate-700 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs transition';
  });
  event.target.className = 'lg-src-btn bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition';
  _lgSearchTesters(document.getElementById('lg-tester-search')?.value || '');
}

function _lgBuildUserRows(users) {
  const link = window._lgCurrentGameLink || '';
  _lgVisibleGroupIds = [];
  const rows = [];
  users.forEach(u => {
    const group = (saAllGroups || []).find(g => g.id === u.group_id);
    if (!group) return;
    _lgVisibleGroupIds.push(group.id);
    const phone = (u.phone || '').replace(/\D/g,'');
    const intlPhone = phone.startsWith('0') ? '972' + phone.slice(1) : phone;
    const waText = encodeURIComponent(`היי ${u.nickname || ''}! 🏆\nהוזמנת למשחק טריוויה חי ב-OneFlow Life!\nלחץ כאן להצטרפות:\n${link}`);
    const srcBadge = u.registration_source && u.registration_source !== 'self'
      ? `<span class="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded-full">${u.registration_source}</span>` : '';
    rows.push(`
      <div class="flex items-center justify-between bg-slate-700/80 rounded-xl px-3 py-2.5 gap-2">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">${u.nickname || ''} ${u.first_name || ''} ${u.last_name || ''}</div>
          <div class="flex items-center gap-1 flex-wrap mt-0.5">${srcBadge}${u.phone ? `<span class="text-xs text-slate-400">${u.phone}</span>` : '<span class="text-xs text-red-400">ללא טלפון</span>'}</div>
        </div>
        <div class="flex gap-1.5 shrink-0">
          <button onclick="_lgSendInbox(${group.id})" title="שלח הודעה פנימית"
            class="bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-1.5 rounded-lg text-xs transition">📨</button>
          ${phone ? `<a href="https://wa.me/${intlPhone}?text=${waText}" target="_blank"
            class="bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded-lg text-xs transition flex items-center">
            <i class="fa-brands fa-whatsapp"></i></a>` : ''}
        </div>
      </div>`);
  });
  return rows;
}

async function _lgSearchTesters(q) {
  const el = document.getElementById('lg-tester-results');
  let users = (saAllUsers || []).filter(u => {
    const g = (saAllGroups || []).find(gr => gr.id === u.group_id);
    if (!g || g.type !== 'FAMILY') return false;
    if (_lgSourceFilter) {
      if (_lgSourceFilter === 'referral:') return (u.registration_source || '').startsWith('referral:');
      return (u.registration_source || '') === _lgSourceFilter;
    }
    if (!q || q.length < 2) return !_lgSourceFilter ? false : true;
    return u.phone?.includes(q) || u.nickname?.includes(q) || u.first_name?.includes(q) ||
      u.last_name?.includes(q) || (u.registration_source || '').includes(q) || g.name?.includes(q);
  });
  if (!_lgSourceFilter && (!q || q.length < 2)) { el.innerHTML = '<div class="text-slate-400 text-xs text-center py-2">הקלד לחיפוש או בחר מקור למעלה</div>'; _lgVisibleGroupIds = []; return; }
  users = users.slice(0, 20);
  const rows = _lgBuildUserRows(users);
  el.innerHTML = rows.length ? rows.join('') : '<div class="text-slate-400 text-xs text-center py-2">לא נמצאו תוצאות</div>';
}

async function _lgSendInbox(groupId) {
  const saToken = localStorage.getItem('ofl_sa_token');
  const gameId = window._lgCurrentGameId;
  if (!gameId) return;
  const r = await fetch(`/api/live-games/${gameId}/assign`, {
    method: 'POST', headers: { 'Content-Type':'application/json', Authorization: saToken },
    body: JSON.stringify({ groupIds: [groupId] })
  });
  const d = await r.json();
  if (d.success) showToast('success', 'הודעה פנימית נשלחה ✓');
  else showToast('error', d.error || 'שגיאה בשליחה');
}

async function _lgAssignVisible(gameId) {
  if (!_lgVisibleGroupIds.length) return alert('אין קבוצות מוצגות לשליחה');
  const saToken = localStorage.getItem('ofl_sa_token');
  const r = await fetch(`/api/live-games/${gameId}/assign`, {
    method: 'POST', headers: { 'Content-Type':'application/json', Authorization: saToken },
    body: JSON.stringify({ groupIds: _lgVisibleGroupIds })
  });
  const d = await r.json();
  showToast(d.success ? 'success' : 'error', d.success ? `נשלחה הודעה ל-${d.assigned} קבוצות ✓` : d.error || 'שגיאה');
}

// ── חדר המתנה ──
async function _lgLoadWaitingRoom(gameId) {
  const el = document.getElementById('lg-waiting-list');
  if (!el) return;
  const saToken = localStorage.getItem('ofl_sa_token');
  const r = await fetch(`/api/live-games/${gameId}/waiting-room`, { headers: { Authorization: saToken } });
  const d = await r.json();
  if (!d.participants || !d.participants.length) { el.innerHTML = '<div class="text-slate-400 text-xs text-center py-4">אין משתתפים עדיין</div>'; return; }
  el.innerHTML = d.participants.map(p => `
    <div class="flex items-center justify-between bg-slate-700/80 rounded-xl px-3 py-2.5 gap-2">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-100 truncate">${p.display_name || 'אנונימי'}</div>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-[10px] px-1.5 py-0.5 rounded-full ${p.approved ? 'bg-green-700/60 text-green-300' : 'bg-amber-700/60 text-amber-300'}">${p.approved ? '✅ מאושר' : '⏳ ממתין'}</span>
          ${p.group_name ? `<span class="text-xs text-slate-300">${p.group_name}</span>` : ''}
          ${p.registration_source && p.registration_source !== 'self' ? `<span class="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded-full">${p.registration_source}</span>` : ''}
        </div>
      </div>
      <div class="flex gap-1.5 shrink-0">
        ${!p.approved ? `<button onclick="_lgApproveOne(${gameId},${p.id})" class="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg text-xs transition font-bold">אשר</button>` : ''}
        <button onclick="_lgRejectOne(${gameId},${p.id})" class="bg-red-700/60 hover:bg-red-700 text-white px-2 py-1.5 rounded-lg text-xs transition">✕</button>
      </div>
    </div>`).join('');
}

async function _lgApproveOne(gameId, participantId) {
  const saToken = localStorage.getItem('ofl_sa_token');
  await fetch(`/api/live-games/${gameId}/approve`, { method:'POST', headers:{'Content-Type':'application/json', Authorization: saToken}, body: JSON.stringify({ participantIds:[participantId], approved:true }) });
  _lgLoadWaitingRoom(gameId);
}
async function _lgRejectOne(gameId, participantId) {
  const saToken = localStorage.getItem('ofl_sa_token');
  await fetch(`/api/live-games/${gameId}/approve`, { method:'POST', headers:{'Content-Type':'application/json', Authorization: saToken}, body: JSON.stringify({ participantIds:[participantId], approved:false }) });
  _lgLoadWaitingRoom(gameId);
}
async function _lgApproveAll(gameId) {
  const saToken = localStorage.getItem('ofl_sa_token');
  await fetch(`/api/live-games/${gameId}/approve-all`, { method:'POST', headers:{'Content-Type':'application/json', Authorization: saToken} });
  showToast('success','כל המשתתפים אושרו ✓');
  _lgLoadWaitingRoom(gameId);
}

// ── תוצאות ──
async function _lgLoadResults(gameId) {
  const el = document.getElementById('lg-results-list');
  if (!el) return;
  const r = await fetch(`/api/live-games/${gameId}/leaderboard`);
  const d = await r.json();
  if (!d.leaderboard || !d.leaderboard.length) { el.innerHTML = '<div class="text-slate-400 text-xs text-center py-4">אין תוצאות עדיין</div>'; return; }
  const medals = ['🥇','🥈','🥉'];
  el.innerHTML = d.leaderboard.map((p,i) => `
    <div class="flex items-center gap-3 bg-slate-700/80 rounded-xl px-3 py-2.5 ${i===0 ? 'ring-2 ring-yellow-500/60' : ''}">
      <div class="text-lg w-6 text-center">${medals[i] || `${i+1}`}</div>
      <div class="flex-1 font-medium text-sm text-slate-100">${p.display_name || p.nickname || 'שחקן'}</div>
      <div class="font-bold text-indigo-300 tabular-nums">${p.score.toLocaleString()}</div>
    </div>`).join('');
  window._lgLastLeaderboard = d.leaderboard;
}

function _lgCopyResults(gameId) {
  const lb = window._lgLastLeaderboard;
  if (!lb || !lb.length) { alert('טען את התוצאות קודם'); return; }
  const text = lb.map((p,i) => `${i+1}. ${p.display_name || p.nickname} — ${p.score} נקודות`).join('\n');
  navigator.clipboard.writeText(`🏆 תוצאות המשחק:\n${text}`);
  showToast('success','הועתק ✓');
}

// ── הודעת התראת התחלה ──
async function _lgNotifyStart(gameId) {
  const saToken = localStorage.getItem('ofl_sa_token');
  const r = await fetch(`/api/live-games/${gameId}/notify-start`, { method:'POST', headers:{ Authorization: saToken } });
  const d = await r.json();
  showToast(d.success ? 'success' : 'error', d.success ? `נשלחו ${d.sent} התראות ✓` : d.error || 'שגיאה');
}

// ── הסתרת/גילוי משחק ──
async function _lgToggleHidden(gameId) {
  const saToken = localStorage.getItem('ofl_sa_token');
  const r = await fetch(`/api/live-games/${gameId}`, { headers:{ Authorization: saToken } });
  const d = await r.json();
  const newHidden = !d.game?.is_hidden;
  await fetch(`/api/live-games/${gameId}/visibility`, { method:'PATCH', headers:{'Content-Type':'application/json', Authorization: saToken}, body: JSON.stringify({ is_hidden: newHidden }) });
  showToast('success', newHidden ? 'המשחק הוסתר 🙈' : 'המשחק גלוי שוב 👁️');
  const btn = document.getElementById('lg-hidden-btn');
  if (btn) {
    btn.textContent = newHidden ? '👁️ הצג משחק' : '🙈 הסתר משחק';
    btn.className = `${newHidden ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-orange-700 hover:bg-orange-800'} text-white py-3 rounded-xl text-sm font-bold transition`;
  }
  _fetchLGList();
}

let _lgCtrlPollInt = null;
function _lgControlPoll(gameId, gameCode) {
  clearInterval(_lgCtrlPollInt);
  _lgCtrlPollInt = setInterval(async () => {
    const r = await fetch(`/api/live-games/${gameCode}/state`).catch(()=>null);
    if (!r) return;
    const d = await r.json();
    const el = document.getElementById('lg-ctrl-count');
    if (el) el.textContent = d.participants_count || 0;
    const msg = document.getElementById('lg-ctrl-msg');
    const statusHe = { waiting:'ממתין', active:'פעיל', ended:'הסתיים', disabled:'מושבת' };
    if (msg) msg.textContent = `שאלה ${(d.current_question_index||0)+1} מתוך ${d.total_questions||0} · סטטוס: ${statusHe[d.status]||d.status}`;
  }, 2000);
  // Stop when modal closes
  const obs = new MutationObserver(() => {
    if (!document.getElementById('lg-control-modal')) { clearInterval(_lgCtrlPollInt); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true });
}

async function _lgSetStatus(gameId, status) {
  const saToken = localStorage.getItem('ofl_sa_token');
  const labels = { active:'מתחיל...', ended:'מסיים...', disabled:'מכבה...' };
  const r = await fetch(`/api/live-games/${gameId}/status`, {
    method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: saToken },
    body: JSON.stringify({ status })
  });
  const d = await r.json();
  const msg = document.getElementById('lg-ctrl-msg');
  if (msg) msg.textContent = d.success ? `✅ ${labels[status]||status}` : '❌ ' + d.error;
}

async function _lgNextQuestion(gameId) {
  const saToken = localStorage.getItem('ofl_sa_token');
  const r = await fetch(`/api/live-games/${gameId}/next-question`, {
    method: 'POST', headers: { Authorization: saToken }
  });
  const d = await r.json();
  const msg = document.getElementById('lg-ctrl-msg');
  if (msg) msg.textContent = d.ended ? '🏁 המשחק הסתיים!' : d.success ? `✅ שאלה ${(d.current_question_index||0)+1}` : '❌ ' + d.error;
}
