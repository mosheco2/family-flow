const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let zmToken = null;
let zmManager = null;
let zmData = null;
let zmCampaigns = [];
let zmCurrentThreadId = null;
let zmCurrentLeadId = null;
let zmCurrentCommunityId = null;
let _zmAppointCommunityId = null;
let zmCurrentCampaignId = null;

const zmToast = (msg, type = 'success') => {
    const el = document.getElementById('zm-toast');
    el.textContent = msg;
    el.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl z-[9999] ${
        type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-indigo-500'
    }`;
    setTimeout(() => el.classList.add('hidden'), 3500);
};

// ==========================================
// --- AUTH ---
// ==========================================
function zmSwitchAuthTab(tab) {
    ['login','register','forgot','reset','pending'].forEach(t => {
        document.getElementById(`zm-form-${t}`).classList.add('hidden');
        const btn = document.getElementById(`zm-auth-tab-${t}`);
        if (btn) btn.classList.remove('active');
    });
    document.getElementById(`zm-form-${tab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`zm-auth-tab-${tab}`);
    if (activeBtn) activeBtn.classList.add('active');
}

async function zmLogin() {
    const email = document.getElementById('zm-login-email').value.trim();
    const pass = document.getElementById('zm-login-pass').value.trim();
    const errEl = document.getElementById('zm-login-err');
    errEl.classList.add('hidden');
    if (!email || !pass) { errEl.textContent = 'יש למלא מייל וסיסמה'; errEl.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password: pass}) });
        const data = await res.json();
        if (data.success) {
            zmToken = data.token;
            zmManager = data.manager;
            localStorage.setItem('zm_token', zmToken);
            document.getElementById('zm-login').classList.add('hidden');
            document.getElementById('zm-dashboard').classList.remove('hidden');
            document.getElementById('zm-header-name').textContent = zmManager.name;
            await loadDashboard();
        } else {
            errEl.textContent = data.error || 'שגיאת כניסה';
            errEl.classList.remove('hidden');
        }
    } catch(e) { errEl.textContent = 'שגיאת תקשורת'; errEl.classList.remove('hidden'); }
}

async function zmRegister() {
    const name = document.getElementById('zm-reg-name').value.trim();
    const email = document.getElementById('zm-reg-email').value.trim();
    const pass = document.getElementById('zm-reg-pass').value.trim();
    const phone = document.getElementById('zm-reg-phone').value.trim();
    const errEl = document.getElementById('zm-reg-err');
    errEl.classList.add('hidden');
    if (!name || !email || !pass) { errEl.textContent = 'יש למלא שם, מייל וסיסמה'; errEl.classList.remove('hidden'); return; }
    if (pass.length < 6) { errEl.textContent = 'הסיסמה חייבת להכיל לפחות 6 תווים'; errEl.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name, email, password: pass, phone}) });
        const data = await res.json();
        if (data.success) {
            zmSwitchAuthTab('pending');
        } else {
            errEl.textContent = data.error || 'שגיאה בהרשמה';
            errEl.classList.remove('hidden');
        }
    } catch(e) { errEl.textContent = 'שגיאת תקשורת'; errEl.classList.remove('hidden'); }
}

async function zmForgotSubmit() {
    const email = document.getElementById('zm-forgot-email').value.trim();
    const msgEl = document.getElementById('zm-forgot-msg');
    const errEl = document.getElementById('zm-forgot-err');
    msgEl.classList.add('hidden'); errEl.classList.add('hidden');
    if (!email) { errEl.textContent = 'יש להזין כתובת מייל'; errEl.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/forgot-password`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email}) });
        const data = await res.json();
        if (data.success) {
            msgEl.textContent = 'קישור לאיפוס נשלח למייל שלך. בדוק את תיבת הדואר.';
            msgEl.classList.remove('hidden');
        } else {
            errEl.textContent = data.error || 'שגיאה בשליחה';
            errEl.classList.remove('hidden');
        }
    } catch(e) { errEl.textContent = 'שגיאת תקשורת'; errEl.classList.remove('hidden'); }
}

async function zmResetSubmit() {
    const token = document.getElementById('zm-reset-token').value;
    const pass = document.getElementById('zm-reset-pass').value.trim();
    const pass2 = document.getElementById('zm-reset-pass2').value.trim();
    const errEl = document.getElementById('zm-reset-err');
    const okEl = document.getElementById('zm-reset-ok');
    errEl.classList.add('hidden'); okEl.classList.add('hidden');
    if (pass.length < 6) { errEl.textContent = 'הסיסמה חייבת להכיל לפחות 6 תווים'; errEl.classList.remove('hidden'); return; }
    if (pass !== pass2) { errEl.textContent = 'הסיסמאות אינן תואמות'; errEl.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/reset-password`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token, newPassword: pass}) });
        const data = await res.json();
        if (data.success) {
            okEl.textContent = 'הסיסמה עודכנה! כעת תוכל להתחבר.';
            okEl.classList.remove('hidden');
            setTimeout(() => zmSwitchAuthTab('login'), 2500);
        } else {
            errEl.textContent = data.error || 'שגיאה באיפוס';
            errEl.classList.remove('hidden');
        }
    } catch(e) { errEl.textContent = 'שגיאת תקשורת'; errEl.classList.remove('hidden'); }
}

function zmLogout() {
    zmToken = null; zmManager = null;
    localStorage.removeItem('zm_token');
    document.getElementById('zm-dashboard').classList.add('hidden');
    document.getElementById('zm-login').classList.remove('hidden');
}

// ==========================================
// --- DASHBOARD LOAD ---
// ==========================================
async function loadDashboard() {
    try {
        const res = await fetch(`${API}/zone-manager/dashboard`, { headers: { 'Authorization': zmToken } });
        zmData = await res.json();
        if (!zmData.success) return;

        document.getElementById('zm-stat-zones').textContent = zmData.zones?.length || 0;
        const totalComm = (zmData.communities || []).length;
        document.getElementById('zm-stat-communities').textContent = totalComm;

        const stats = zmData.commissions || {};
        const fmt = v => `₪${parseFloat(v||0).toLocaleString('he-IL',{maximumFractionDigits:0})}`;
        document.getElementById('zm-stat-comm-total').textContent = fmt(stats.total_earned);
        document.getElementById('zm-stat-comm-month').textContent = fmt(stats.month_earned);
        document.getElementById('zm-stat-paid-total').textContent = fmt(stats.total_paid);
        document.getElementById('zm-stat-paid-month').textContent = fmt(stats.month_paid);

        const totalE = parseFloat(stats.total_earned || 0);
        const totalP = parseFloat(stats.total_paid || 0);
        const monthE = parseFloat(stats.month_earned || 0);
        const monthP = parseFloat(stats.month_paid || 0);
        const totalPct = totalE > 0 ? Math.round((totalP / totalE) * 100) : 0;
        const monthPct = monthE > 0 ? Math.round((monthP / monthE) * 100) : 0;
        const totalBar = document.getElementById('zm-paid-total-bar');
        const totalPctEl = document.getElementById('zm-paid-total-pct');
        const monthBar = document.getElementById('zm-paid-month-bar');
        const monthPctEl = document.getElementById('zm-paid-month-pct');
        if (totalBar) totalBar.style.width = `${totalPct}%`;
        if (totalPctEl) totalPctEl.textContent = `${totalPct}%`;
        if (monthBar) monthBar.style.width = `${monthPct}%`;
        if (monthPctEl) monthPctEl.textContent = `${monthPct}%`;

        renderZones();
        zmLoadPendingBiz();

        // טען badge של בקשות עסקים ממתינות
        try {
            const pbRes = await fetch(`${API}/zone-manager/pending-businesses`, { headers: { 'Authorization': zmToken } });
            const pbData = await pbRes.json();
            const bizBadge = document.getElementById('zm-pending-biz-badge');
            if (bizBadge && pbData.success && pbData.pending?.length > 0) {
                bizBadge.textContent = pbData.pending.length;
                bizBadge.classList.remove('hidden');
            }
        } catch(e) {}

        // טען badge של בקשות משפחות ממתינות
        try {
            const pfRes = await fetch(`${API}/zone-manager/pending-families`, { headers: { 'Authorization': zmToken } });
            const pfData = await pfRes.json();
            const famBadge = document.getElementById('zm-pending-fam-badge');
            if (famBadge && pfData.success && pfData.pending?.length > 0) {
                famBadge.textContent = pfData.pending.length;
                famBadge.classList.remove('hidden');
            }
        } catch(e) {}

        // טען inbox badge
        try {
            const ibRes = await fetch(`${API}/zone-manager/inbox`, { headers: { 'Authorization': zmToken } });
            const ibData = await ibRes.json();
            const inboxBadge = document.getElementById('zm-inbox-badge');
            const unreadTotal = (ibData.threads||[]).reduce((s,t)=>s+parseInt(t.unread_count||0),0);
            if (inboxBadge && unreadTotal > 0) {
                inboxBadge.textContent = unreadTotal;
                inboxBadge.classList.remove('hidden');
            }
        } catch(e) {}

    } catch(e) { console.error('loadDashboard error:', e); }
}

// ==========================================
// --- TABS ---
// ==========================================
function zmSwitchTab(tab) {
    ['zones','biz-requests','family-requests','marketing','leads','inbox','commissions'].forEach(t => {
        const view = document.getElementById(`zmview-${t}`);
        const btn = document.getElementById(`zmtab-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.classList.remove('active');
    });
    const activeView = document.getElementById(`zmview-${tab}`);
    const activeBtn = document.getElementById(`zmtab-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('active');

    if (tab === 'marketing') zmLoadCampaigns();
    else if (tab === 'leads') zmLoadLeadsTab();
    else if (tab === 'inbox') zmLoadInbox();
    else if (tab === 'commissions') loadCommissions();
    else if (tab === 'biz-requests') zmLoadPendingBiz();
    else if (tab === 'family-requests') zmLoadPendingFamilies();
}

// ==========================================
// --- ZONES ---
// ==========================================
function renderZones() {
    const container = document.getElementById('zm-zones-container');
    if (!zmData?.zones?.length) {
        container.innerHTML = '<div class="text-center text-slate-400 py-8">אין אזורים מוקצים עדיין</div>';
        return;
    }
    const allComms = zmData.communities || [];
    container.innerHTML = zmData.zones.map(zone => {
        const zoneCommunities = allComms.filter(c => c.zone_id === zone.id || c.zone_id === String(zone.id));
        return `
    <div class="card p-5">
        <div class="flex justify-between items-start mb-4">
            <span class="text-[10px] font-bold px-2 py-1 rounded-full ${zone.status === 'active' ? 'badge-ok' : 'badge-warn'}">
                ${zone.status === 'active' ? 'פעיל' : 'מושהה'}
            </span>
            <div class="text-right">
                <h3 class="font-black text-slate-800 text-base">${zone.name}</h3>
                <p class="text-xs text-slate-500">${zoneCommunities.length} קהילות באזור</p>
            </div>
        </div>
        <div class="space-y-3">
            ${zoneCommunities.map(comm => `
            <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <button onclick="openAppointModal(${comm.id},'${(comm.name||'').replace(/'/g,"\\'")}')"
                            class="text-[9px] font-bold px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition flex items-center gap-1">
                            <i class="fa-solid fa-star text-[8px]"></i> מנהל
                        </button>
                    </div>
                    <div class="text-right">
                        <h4 class="font-bold text-slate-700 text-sm">${comm.name}</h4>
                        ${comm.manager_name ? `<p class="text-[10px] text-purple-600 font-bold">מנהל: ${comm.manager_name}</p>` : '<p class="text-[10px] text-slate-400">אין מנהל ממונה</p>'}
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 mt-3">
                    <div class="text-center bg-white rounded-xl p-2 border border-slate-100">
                        <div class="text-sm font-black text-indigo-600">${comm.family_count || 0}</div>
                        <div class="text-[9px] text-slate-400 font-bold">משפחות</div>
                    </div>
                    <div class="text-center bg-white rounded-xl p-2 border border-slate-100">
                        <div class="text-sm font-black text-emerald-600">${comm.business_count || 0}</div>
                        <div class="text-[9px] text-slate-400 font-bold">עסקים</div>
                    </div>
                    <div class="text-center bg-white rounded-xl p-2 border border-slate-100">
                        <div class="text-sm font-black text-amber-600">₪${parseFloat(comm.commission_earned||0).toFixed(0)}</div>
                        <div class="text-[9px] text-slate-400 font-bold">עמלות</div>
                    </div>
                </div>
            </div>`).join('')}
        </div>
    </div>`;
    }).join('');
}

// ==========================================
// --- PENDING BIZ REQUESTS ---
// ==========================================
async function zmLoadPendingBiz() {
    const list = document.getElementById('zm-pending-biz-list');
    if (!list) return;
    list.innerHTML = '<div class="text-center text-slate-400 py-6">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/pending-businesses`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        const pending = data.pending || [];
        if (!pending.length) {
            list.innerHTML = '<div class="text-center text-slate-400 py-6"><i class="fa-solid fa-check-circle text-2xl text-emerald-400 mb-2 block"></i>אין בקשות ממתינות</div>';
            return;
        }
        list.innerHTML = pending.map(p => `
        <div class="bg-orange-50 border border-orange-200 rounded-2xl p-4" id="biz-req-${p.group_id}-${p.community_id}">
            <div class="flex justify-between items-start mb-3">
                <div class="flex gap-2">
                    <button onclick="zmApproveBiz(${p.group_id},${p.community_id})"
                        class="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-3 py-1.5 rounded-xl transition">
                        <i class="fa-solid fa-check ml-1"></i>אשר
                    </button>
                    <button onclick="zmRejectBiz(${p.group_id},${p.community_id})"
                        class="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-black px-3 py-1.5 rounded-xl transition">
                        <i class="fa-solid fa-xmark ml-1"></i>דחה
                    </button>
                </div>
                <div class="text-right">
                    <h4 class="font-black text-slate-800 text-sm">${p.biz_name}</h4>
                    <p class="text-xs text-slate-500">קהילה: ${p.comm_name}</p>
                    <p class="text-[10px] text-slate-400">${new Date(p.joined_at).toLocaleDateString('he-IL')}</p>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה בטעינה</div>'; }
}

async function zmApproveBiz(groupId, communityId) {
    try {
        const res = await fetch(`${API}/zone-manager/community-business/approve`, {
            method: 'POST', headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({groupId, communityId})
        });
        const data = await res.json();
        if (data.success) {
            zmToast('העסק אושר לקהילה!');
            document.getElementById(`biz-req-${groupId}-${communityId}`)?.remove();
            const badge = document.getElementById('zm-pending-biz-badge');
            if (badge) {
                const cur = parseInt(badge.textContent) - 1;
                if (cur <= 0) badge.classList.add('hidden');
                else badge.textContent = cur;
            }
        } else { zmToast(data.error || 'שגיאה', 'error'); }
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

async function zmRejectBiz(groupId, communityId) {
    if (!confirm('לדחות את בקשת העסק?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/reject`, {
            method: 'POST', headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({groupId, communityId})
        });
        const data = await res.json();
        if (data.success) {
            zmToast('הבקשה נדחתה', 'error');
            document.getElementById(`biz-req-${groupId}-${communityId}`)?.remove();
            const badge = document.getElementById('zm-pending-biz-badge');
            if (badge) {
                const cur = parseInt(badge.textContent) - 1;
                if (cur <= 0) badge.classList.add('hidden');
                else badge.textContent = cur;
            }
        } else { zmToast(data.error || 'שגיאה', 'error'); }
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

// ==========================================
// --- PENDING FAMILY REQUESTS ---
// ==========================================
async function zmLoadPendingFamilies() {
    const list = document.getElementById('zm-pending-fam-list');
    if (!list) return;
    list.innerHTML = '<div class="text-center text-slate-400 py-6">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/pending-families`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        const pending = data.pending || [];
        if (!pending.length) {
            list.innerHTML = '<div class="text-center text-slate-400 py-6"><i class="fa-solid fa-check-circle text-2xl text-emerald-400 mb-2 block"></i>אין בקשות משפחות ממתינות</div>';
            return;
        }
        list.innerHTML = pending.map(p => `
        <div class="bg-purple-50 border border-purple-200 rounded-2xl p-4" id="fam-req-${p.group_id}-${p.community_id}">
            <div class="flex justify-between items-start mb-3">
                <div class="flex gap-2">
                    <button onclick="zmApproveFamily(${p.group_id},${p.community_id})"
                        class="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-3 py-1.5 rounded-xl transition">
                        <i class="fa-solid fa-check ml-1"></i>אשר
                    </button>
                    <button onclick="zmRejectFamily(${p.group_id},${p.community_id})"
                        class="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-black px-3 py-1.5 rounded-xl transition">
                        <i class="fa-solid fa-xmark ml-1"></i>דחה
                    </button>
                </div>
                <div class="text-right">
                    <h4 class="font-black text-slate-800 text-sm">${p.family_name}</h4>
                    <p class="text-xs text-slate-500">קהילה: ${p.comm_name}</p>
                    <p class="text-[10px] text-slate-400">${new Date(p.joined_at).toLocaleDateString('he-IL')}</p>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה בטעינה</div>'; }
}

async function zmApproveFamily(groupId, communityId) {
    try {
        const res = await fetch(`${API}/zone-manager/community-family/approve`, {
            method: 'POST', headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({groupId, communityId})
        });
        const data = await res.json();
        if (data.success) {
            zmToast('המשפחה אושרה לקהילה! Flw FLOW הוענקו.');
            document.getElementById(`fam-req-${groupId}-${communityId}`)?.remove();
            const badge = document.getElementById('zm-pending-fam-badge');
            if (badge) {
                const cur = parseInt(badge.textContent) - 1;
                if (cur <= 0) badge.classList.add('hidden');
                else badge.textContent = cur;
            }
        } else { zmToast(data.error || 'שגיאה', 'error'); }
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

async function zmRejectFamily(groupId, communityId) {
    if (!confirm('לדחות את בקשת המשפחה?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-family/reject`, {
            method: 'POST', headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({groupId, communityId})
        });
        const data = await res.json();
        if (data.success) {
            zmToast('הבקשה נדחתה', 'error');
            document.getElementById(`fam-req-${groupId}-${communityId}`)?.remove();
            const badge = document.getElementById('zm-pending-fam-badge');
            if (badge) {
                const cur = parseInt(badge.textContent) - 1;
                if (cur <= 0) badge.classList.add('hidden');
                else badge.textContent = cur;
            }
        } else { zmToast(data.error || 'שגיאה', 'error'); }
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

// ==========================================
// --- CAMPAIGNS ---
// ==========================================
async function zmLoadCampaigns() {
    const list = document.getElementById('zm-campaigns-list');
    list.innerHTML = '<div class="text-center text-slate-400 py-6">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/campaigns`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        zmCampaigns = data.campaigns || [];
        if (!zmCampaigns.length) { list.innerHTML = '<div class="text-center text-slate-400 py-6">אין קמפיינים עדיין</div>'; return; }
        list.innerHTML = zmCampaigns.map(c => `
        <div class="border border-slate-200 rounded-2xl overflow-hidden">
            ${c.image_url ? `<img src="${c.image_url}" class="w-full h-28 object-cover">` : ''}
            <div class="p-3">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex gap-1.5">
                        <button onclick="editZMCampaign(${c.id})" class="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg font-bold hover:bg-indigo-100 transition">✏️ עריכה</button>
                        <button onclick="deleteZMCampaign(${c.id})" class="text-xs text-red-500 bg-red-50 px-2.5 py-1 rounded-lg font-bold hover:bg-red-100 transition">🗑️</button>
                    </div>
                    <div class="text-right">
                        <h4 class="font-black text-slate-800 text-sm">${c.title}</h4>
                        ${c.subtitle ? `<p class="text-xs text-slate-500">${c.subtitle}</p>` : ''}
                    </div>
                </div>
                <div class="flex items-center justify-between">
                    <div class="flex gap-2">
                        <button onclick="copyCampaignLink('${c.token}')" class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-bold hover:bg-slate-200 transition">🔗 העתק קישור</button>
                        <button onclick="zmViewLeads(${c.id},'${(c.title||'').replace(/'/g,"\\'")}')"
                            class="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg font-bold hover:bg-emerald-100 transition">👥 לידים</button>
                    </div>
                    <span class="text-[10px] text-slate-400">${new Date(c.created_at).toLocaleDateString('he-IL')}</span>
                </div>
            </div>
        </div>`).join('');

        // טען תבניות גם
        await zmLoadTemplates();
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה בטעינה</div>'; }
}

async function zmLoadTemplates() {
    const list = document.getElementById('zm-templates-list');
    if (!list) return;
    list.innerHTML = '<div class="text-center text-slate-400 py-4">טוען תבניות...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/templates`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        const templates = data.templates || [];
        if (!templates.length) { list.innerHTML = '<div class="text-center text-slate-400 py-4">אין תבניות עדיין</div>'; return; }
        list.innerHTML = templates.map(t => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div class="flex gap-2">
                <button onclick="deleteZMTemplate(${t.id})" class="text-xs text-red-400 hover:text-red-600 transition"><i class="fa-solid fa-trash"></i></button>
                <button onclick="useTemplate(${t.id})" class="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg font-bold hover:bg-indigo-100 transition">שמש</button>
            </div>
            <div class="text-right">
                <p class="font-bold text-slate-700 text-sm">${t.name}</p>
                ${t.subject ? `<p class="text-xs text-slate-400">${t.subject}</p>` : ''}
            </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה</div>'; }
}

function zmSetCampaignType(type) {
    document.getElementById('zm-camp-type-value').value = type;
    document.querySelectorAll('.camp-type-btn').forEach(btn => {
        const isActive = btn.dataset.type === type;
        btn.classList.toggle('border-indigo-500', isActive);
        btn.classList.toggle('bg-indigo-50', isActive);
        btn.classList.toggle('text-indigo-700', isActive);
        btn.classList.toggle('border-slate-200', !isActive);
        btn.classList.toggle('text-slate-500', !isActive);
    });
    // הצג/הסתר מודולים
    const modSection = document.getElementById('zm-modules-section');
    const modBusiness = document.getElementById('zm-modules-business');
    const modFamily = document.getElementById('zm-modules-family');
    if (type === 'business') {
        modSection.classList.remove('hidden');
        modBusiness.classList.remove('hidden');
        modFamily.classList.add('hidden');
    } else if (type === 'family') {
        modSection.classList.remove('hidden');
        modBusiness.classList.add('hidden');
        modFamily.classList.remove('hidden');
    } else {
        modSection.classList.add('hidden');
    }
}

async function zmAIDraftCampaign() {
    const type = document.getElementById('zm-camp-type-value').value;
    const goal = document.getElementById('zm-ai-goal').value.trim();
    const audience = document.getElementById('zm-ai-audience').value.trim();
    const btn = document.getElementById('zm-ai-draft-btn');
    
    // אסוף מודולים שנבחרו
    const selectedModules = Array.from(document.querySelectorAll('.zm-module-check:checked')).map(el => el.value);
    
    btn.disabled = true; btn.textContent = '⏳ יוצר...';
    try {
        const res = await fetch(`${API}/zone-manager/ai/draft-campaign`, {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({type, goal, audience, selectedModules})
        });
        const data = await res.json();
        if (data.success && data.draft) {
            if (data.draft.title) document.getElementById('zm-camp-title').value = data.draft.title;
            if (data.draft.subtitle) document.getElementById('zm-camp-subtitle').value = data.draft.subtitle;
            if (data.draft.text) document.getElementById('zm-camp-text').value = data.draft.text;
        } else {
            zmToast(data.error || 'שגיאה ביצירת טקסט', 'error');
        }
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
    finally { btn.disabled = false; btn.textContent = '✨ צור טקסט'; }
}

async function zmAIGenerateBanner() {
    const title = document.getElementById('zm-camp-title').value.trim();
    const subtitle = document.getElementById('zm-camp-subtitle').value.trim();
    const type = document.getElementById('zm-camp-type-value').value;
    const btn = document.getElementById('zm-ai-banner-btn');
    btn.disabled = true; btn.textContent = '⏳ מייצר תמונה...';
    try {
        const res = await fetch(`${API}/zone-manager/ai/generate-banner`, {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({title, subtitle, type})
        });
        const data = await res.json();
        if (data.success && data.imageUrl) {
            document.getElementById('zm-camp-image-url').value = data.imageUrl;
            const preview = document.getElementById('zm-camp-banner-preview');
            const img = document.getElementById('zm-camp-banner-img');
            img.src = data.imageUrl;
            preview.classList.remove('hidden');
            document.getElementById('zm-remove-banner-btn').classList.remove('hidden');
        } else {
            zmToast(data.error || 'שגיאה ביצירת תמונה', 'error');
        }
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
    finally { btn.disabled = false; btn.textContent = '🖼 צור תמונה'; }
}

async function zmHandleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch(`${API}/upload/image`, { method: 'POST', headers: {'Authorization': zmToken}, body: formData });
        const data = await res.json();
        if (data.success && data.url) {
            document.getElementById('zm-camp-image-url').value = data.url;
            const preview = document.getElementById('zm-camp-banner-preview');
            const img = document.getElementById('zm-camp-banner-img');
            img.src = data.url;
            preview.classList.remove('hidden');
            document.getElementById('zm-remove-banner-btn').classList.remove('hidden');
        }
    } catch(e) { zmToast('שגיאה בהעלאת תמונה', 'error'); }
}

function zmRemoveBanner() {
    document.getElementById('zm-camp-image-url').value = '';
    document.getElementById('zm-camp-banner-preview').classList.add('hidden');
    document.getElementById('zm-remove-banner-btn').classList.add('hidden');
    document.getElementById('zm-camp-image-upload').value = '';
}

function openZMCreateCampaign() {
    document.getElementById('zm-camp-title').value = '';
    document.getElementById('zm-camp-subtitle').value = '';
    document.getElementById('zm-camp-text').value = '';
    document.getElementById('zm-camp-editing-id').value = '';
    document.getElementById('zm-camp-modal-title').textContent = 'קמפיין חדש';
    document.getElementById('zm-camp-err').classList.add('hidden');
    document.querySelectorAll('.zm-module-check').forEach(el => el.checked = false);
    zmSetCampaignType('family');
    zmRemoveBanner();
    document.getElementById('zm-ai-goal').value = '';
    document.getElementById('zm-ai-audience').value = '';
    document.getElementById('zm-campaign-modal').classList.remove('hidden');
}

function editZMCampaign(id) {
    const camp = zmCampaigns.find(c => c.id === id);
    if (!camp) return;
    document.getElementById('zm-camp-title').value = camp.title || '';
    document.getElementById('zm-camp-subtitle').value = camp.subtitle || '';
    document.getElementById('zm-camp-text').value = camp.text_content || '';
    document.getElementById('zm-camp-editing-id').value = id;
    document.getElementById('zm-camp-modal-title').textContent = 'עריכת קמפיין';
    document.getElementById('zm-camp-err').classList.add('hidden');
    if (camp.image_url) {
        document.getElementById('zm-camp-image-url').value = camp.image_url;
        document.getElementById('zm-camp-banner-img').src = camp.image_url;
        document.getElementById('zm-camp-banner-preview').classList.remove('hidden');
        document.getElementById('zm-remove-banner-btn').classList.remove('hidden');
    } else {
        zmRemoveBanner();
    }
    zmSetCampaignType(camp.campaign_type || 'family');
    const fields = camp.fields_config || [];
    document.querySelectorAll('.zm-module-check').forEach(el => el.checked = false);
    document.getElementById('zm-campaign-modal').classList.remove('hidden');
}

async function saveZMCampaign() {
    const title = document.getElementById('zm-camp-title').value.trim();
    const subtitle = document.getElementById('zm-camp-subtitle').value.trim();
    const text = document.getElementById('zm-camp-text').value.trim();
    const editingId = document.getElementById('zm-camp-editing-id').value;
    const imageUrl = document.getElementById('zm-camp-image-url').value.trim();
    const campaignType = document.getElementById('zm-camp-type-value').value;
    const errEl = document.getElementById('zm-camp-err');
    errEl.classList.add('hidden');

    if (!title) { errEl.textContent = 'חובה להזין כותרת ראשית'; errEl.classList.remove('hidden'); return; }

    const fields = [];
    ['name','last_name','business_name','city','address','phone','email','free_text'].forEach(f => {
        if (document.getElementById(`fld-${f}`)?.checked) fields.push(f);
    });

    const body = { title, subtitle, textContent: text, fieldsConfig: fields, imageUrl, campaignType };
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API}/zone-manager/campaigns/${editingId}` : `${API}/zone-manager/campaigns`;

    try {
        const res = await fetch(url, { method, headers: {'Content-Type':'application/json','Authorization': zmToken}, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) {
            zmToast(editingId ? 'קמפיין עודכן!' : 'קמפיין נוצר!');
            document.getElementById('zm-campaign-modal').classList.add('hidden');
            await zmLoadCampaigns();
        } else {
            errEl.textContent = data.error || 'שגיאה בשמירה';
            errEl.classList.remove('hidden');
        }
    } catch(e) { errEl.textContent = 'שגיאת תקשורת'; errEl.classList.remove('hidden'); }
}

async function deleteZMCampaign(id) {
    if (!confirm('למחוק את הקמפיין?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/campaigns/${id}`, { method: 'DELETE', headers: {'Authorization': zmToken} });
        const data = await res.json();
        if (data.success) { zmToast('קמפיין נמחק'); await zmLoadCampaigns(); }
        else zmToast(data.error || 'שגיאה', 'error');
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

function copyCampaignLink(token) {
    const url = `${window.location.origin}/storefront.html?campaign=${token}`;
    navigator.clipboard.writeText(url).then(() => zmToast('הקישור הועתק!')).catch(() => zmToast('שגיאה בהעתקה', 'error'));
}

// ==========================================
// --- LEADS ---
// ==========================================
async function zmLoadLeadsTab() {
    const wrap = document.getElementById('zm-leads-campaign-select-wrap');
    if (!wrap) return;
    const res = await fetch(`${API}/zone-manager/campaigns`, { headers: {'Authorization': zmToken} });
    const data = await res.json();
    const camps = data.campaigns || [];
    if (!camps.length) {
        wrap.innerHTML = '<span class="text-xs text-slate-400">אין קמפיינים</span>';
        return;
    }
    wrap.innerHTML = `<select id="zm-leads-campaign-select" onchange="zmViewLeads(this.value, this.options[this.selectedIndex].text)" class="text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none font-bold text-slate-700">
        <option value="">בחר קמפיין</option>
        ${camps.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}
    </select>`;
    document.getElementById('zm-leads-refresh-btn')?.classList.remove('hidden');
}

async function zmViewLeads(campId, campTitle) {
    zmCurrentCampaignId = campId;
    const list = document.getElementById('zm-leads-list');
    if (!list) return;
    list.innerHTML = '<div class="text-center text-slate-400 py-6">טוען לידים...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/campaigns/${campId}/leads`, { headers: {'Authorization': zmToken} });
        const data = await res.json();
        const leads = data.leads || [];
        if (!leads.length) { list.innerHTML = '<div class="text-center text-slate-400 py-6">אין לידים לקמפיין זה עדיין</div>'; return; }
        const statusLabel = { new:'חדש', contacted:'פנינו', interested:'מתעניין', not_interested:'לא מתעניין', converted:'הצטרף' };
        const statusColor = { new:'bg-blue-100 text-blue-700', contacted:'bg-amber-100 text-amber-700', interested:'bg-emerald-100 text-emerald-700', not_interested:'bg-red-100 text-red-700', converted:'bg-purple-100 text-purple-700' };
        list.innerHTML = leads.map(l => {
            const d = l.data || {};
            const mainLabel = d.name || d.business_name || 'ליד';
            const subLabel = d.phone || d.email || '';
            const aiScore = l.ai_score;
            const scoreBadge = aiScore ? `<span class="text-[9px] font-black px-2 py-0.5 rounded-full ${aiScore >= 70 ? 'bg-emerald-100 text-emerald-700' : aiScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}">AI ${aiScore}%</span>` : '';
            const st = l.status || 'new';
            return `
            <div class="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition" onclick="openLeadCRM(${l.id})">
                <div class="flex items-center gap-2">
                    ${scoreBadge}
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[st] || statusColor.new}">${statusLabel[st] || st}</span>
                </div>
                <div class="text-right">
                    <p class="font-bold text-slate-800 text-sm">${mainLabel}</p>
                    ${subLabel ? `<p class="text-xs text-slate-500">${subLabel}</p>` : ''}
                    <p class="text-[10px] text-slate-400">${new Date(l.created_at).toLocaleDateString('he-IL')}</p>
                </div>
            </div>`;
        }).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה בטעינה</div>'; }
}

async function zmRefreshLeads() {
    const select = document.getElementById('zm-leads-campaign-select');
    if (select && select.value) {
        await zmViewLeads(select.value, select.options[select.selectedIndex].text);
    }
}

async function openLeadCRM(leadId) {
    zmCurrentLeadId = leadId;
    const modal = document.getElementById('zm-lead-crm-modal');
    const dataEl = document.getElementById('zm-lead-crm-data');
    const titleEl = document.getElementById('zm-lead-crm-title');
    const subtitleEl = document.getElementById('zm-lead-crm-subtitle');
    modal.classList.remove('hidden');
    dataEl.innerHTML = '<div class="text-center text-slate-400 py-4">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}`, { headers: {'Authorization': zmToken} });
        const data = await res.json();
        const lead = data.lead;
        if (!lead) { dataEl.innerHTML = '<div class="text-red-400">שגיאה בטעינה</div>'; return; }
        titleEl.textContent = lead.data?.name || lead.data?.business_name || 'ליד';
        subtitleEl.textContent = lead.data?.phone || lead.data?.email || '';
        document.getElementById('zm-crm-lead-type').value = lead.lead_type || 'unknown';
        document.getElementById('zm-crm-status').value = lead.status || 'new';
        document.getElementById('zm-crm-notes').value = lead.crm_notes || '';
        document.getElementById('zm-crm-lead-id').value = leadId;
        // הצג נתוני ליד
        const fieldLabels = { name:'שם', last_name:'שם משפחה', business_name:'שם עסק', city:'עיר', address:'כתובת', phone:'טלפון', email:'מייל', free_text:'הודעה' };
        dataEl.innerHTML = Object.entries(lead.data || {}).map(([k,v]) => v ? `
            <div class="flex justify-between text-xs py-1 border-b border-slate-100">
                <span class="text-slate-800 font-medium">${v}</span>
                <span class="text-slate-400">${fieldLabels[k] || k}</span>
            </div>` : '').join('');
        if (lead.ai_score) {
            dataEl.innerHTML += `<div class="mt-2 bg-indigo-50 rounded-xl p-2 text-xs text-indigo-700"><b>AI ניתוח (${lead.ai_score}%):</b> ${lead.ai_notes || ''}</div>`;
        }
        // טען היסטוריית פעולות
        await loadLeadActions(leadId);
    } catch(e) { dataEl.innerHTML = '<div class="text-red-400 text-sm">שגיאת תקשורת</div>'; }
}

async function saveLeadCRM() {
    const leadId = document.getElementById('zm-crm-lead-id').value;
    const leadType = document.getElementById('zm-crm-lead-type').value;
    const status = document.getElementById('zm-crm-status').value;
    const notes = document.getElementById('zm-crm-notes').value;
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({lead_type: leadType, status, crm_notes: notes})
        });
        const data = await res.json();
        if (data.success) {
            zmToast('פרטי הליד עודכנו!');
            document.getElementById('zm-lead-crm-modal').classList.add('hidden');
            if (zmCurrentCampaignId) await zmViewLeads(zmCurrentCampaignId, '');
        } else zmToast(data.error || 'שגיאה', 'error');
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

async function addLeadAction(actionType) {
    const leadId = zmCurrentLeadId;
    if (!leadId) return;
    const note = document.getElementById('zm-action-note-input').value.trim();
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}/actions`, {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({actionType, notes: note})
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('zm-action-note-input').value = '';
            await loadLeadActions(leadId);
            zmToast('פעולה נרשמה!');
        } else zmToast(data.error || 'שגיאה', 'error');
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

async function loadLeadActions(leadId) {
    const list = document.getElementById('zm-lead-actions-list');
    if (!list) return;
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}/actions`, { headers: {'Authorization': zmToken} });
        const data = await res.json();
        const actions = data.actions || [];
        const typeLabels = { call:'📞 שיחה', whatsapp:'💬 ווצאפ', meeting:'🤝 פגישה', email:'✉️ מייל', note:'📝 הערה' };
        list.innerHTML = actions.length ? actions.map(a => `
        <div class="bg-white border border-slate-100 rounded-xl p-2.5 text-right">
            <div class="flex justify-between items-start">
                <span class="text-[10px] text-slate-400">${new Date(a.created_at).toLocaleDateString('he-IL')}</span>
                <span class="text-xs font-bold text-slate-700">${typeLabels[a.action_type] || a.action_type}</span>
            </div>
            ${a.notes ? `<p class="text-xs text-slate-500 mt-1">${a.notes}</p>` : ''}
        </div>`).join('') : '<p class="text-xs text-slate-400 text-center py-2">אין פעולות עדיין</p>';
    } catch(e) {}
}

// ==========================================
// --- INBOX ---
// ==========================================
async function zmLoadInbox() {
    const list = document.getElementById('zm-inbox-list');
    list.innerHTML = '<div class="text-center text-slate-400 py-6">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/inbox`, { headers: {'Authorization': zmToken} });
        const data = await res.json();
        const threads = data.threads || [];
        if (!threads.length) { list.innerHTML = '<div class="text-center text-slate-400 py-6">אין הודעות עדיין</div>'; return; }
        list.innerHTML = threads.map(t => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition" onclick="openZMThread(${t.id})">
            <div class="flex items-center gap-2">
                ${t.unread_count > 0 ? `<span class="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">${t.unread_count}</span>` : ''}
                <span class="text-[10px] text-slate-400">${new Date(t.last_message_at).toLocaleDateString('he-IL')}</span>
            </div>
            <div class="text-right">
                <p class="font-bold text-slate-800 text-sm">${t.subject || 'ללא נושא'}</p>
                <p class="text-xs text-slate-500">${t.comm_name || t.group_name || ''}</p>
            </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה בטעינה</div>'; }
}

async function openZMThread(threadId) {
    zmCurrentThreadId = threadId;
    const modal = document.getElementById('zm-thread-modal');
    const msgs = document.getElementById('zm-thread-messages');
    const titleEl = document.getElementById('zm-thread-title');
    const subtitleEl = document.getElementById('zm-thread-subtitle');
    modal.classList.remove('hidden');
    msgs.innerHTML = '<div class="text-center text-slate-400 py-6">טוען...</div>';
    document.getElementById('zm-reply-input').value = '';
    try {
        const res = await fetch(`${API}/zone-manager/inbox/${threadId}`, { headers: {'Authorization': zmToken} });
        const data = await res.json();
        const thread = data.thread;
        titleEl.textContent = thread.subject || 'ללא נושא';
        subtitleEl.textContent = thread.comm_name || thread.group_name || '';
        const messages = data.messages || [];
        msgs.innerHTML = messages.map(m => {
            const isZM = m.sender_type === 'zone_manager';
            return `
            <div class="flex ${isZM ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    isZM ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
                }">
                    <p>${m.content}</p>
                    <p class="text-[10px] opacity-60 mt-1 ${
                        isZM ? 'text-right' : 'text-left'
                    }">${new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'})}</p>
                </div>
            </div>`;
        }).join('');
        msgs.scrollTop = msgs.scrollHeight;
    } catch(e) { msgs.innerHTML = '<div class="text-red-400 text-sm text-center">שגיאת תקשורת</div>'; }
}

async function sendZMReply() {
    const content = document.getElementById('zm-reply-input').value.trim();
    if (!content || !zmCurrentThreadId) return;
    try {
        const res = await fetch(`${API}/zone-manager/inbox/${zmCurrentThreadId}/reply`, {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({content})
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('zm-reply-input').value = '';
            await openZMThread(zmCurrentThreadId);
        } else zmToast(data.error || 'שגיאה בשליחה', 'error');
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

async function zmAISuggestReply() {
    const btn = document.getElementById('zm-ai-reply-btn');
    btn.disabled = true; btn.textContent = '⏳ חושב...';
    try {
        const res = await fetch(`${API}/zone-manager/ai/suggest-reply`, {
            method: 'POST', headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({threadId: zmCurrentThreadId})
        });
        const data = await res.json();
        if (data.success && data.suggestion) {
            document.getElementById('zm-reply-input').value = data.suggestion;
        } else zmToast(data.error || 'שגיאה', 'error');
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>הצעת תשובה עם AI'; }
}

function openZMNewMessage() {
    const modal = document.getElementById('zm-newmsg-modal');
    document.getElementById('zm-newmsg-title').textContent = 'הודעה חדשה';
    document.getElementById('zm-newmsg-target-wrap').classList.remove('hidden');
    document.getElementById('zm-newmsg-subject').value = '';
    document.getElementById('zm-newmsg-content').value = '';
    document.getElementById('zm-newmsg-err').classList.add('hidden');
    // טען מנהלי קהילות
    loadCommunityManagers();
    modal.classList.remove('hidden');
}

function openZMBroadcast() {
    const modal = document.getElementById('zm-newmsg-modal');
    document.getElementById('zm-newmsg-title').textContent = 'שידור לכולם';
    document.getElementById('zm-newmsg-target-wrap').classList.add('hidden');
    document.getElementById('zm-newmsg-subject').value = '';
    document.getElementById('zm-newmsg-content').value = '';
    document.getElementById('zm-newmsg-err').classList.add('hidden');
    modal.classList.remove('hidden');
}

async function loadCommunityManagers() {
    const select = document.getElementById('zm-newmsg-target');
    select.innerHTML = '<option value="">טוען...</option>';
    try {
        const res = await fetch(`${API}/zone-manager/all-community-managers`, { headers: {'Authorization': zmToken} });
        const data = await res.json();
        const managers = data.managers || [];
        select.innerHTML = '<option value="">בחר מנהל קהילה</option>' +
            managers.map(m => `<option value="${m.group_id}" data-comm="${m.community_id}">${m.manager_name} (${m.community_name})</option>`).join('');
    } catch(e) { select.innerHTML = '<option value="">שגיאה בטעינה</option>'; }
}

async function sendZMNewMessage() {
    const isWrap = !document.getElementById('zm-newmsg-target-wrap').classList.contains('hidden');
    const targetEl = document.getElementById('zm-newmsg-target');
    const subject = document.getElementById('zm-newmsg-subject').value.trim();
    const content = document.getElementById('zm-newmsg-content').value.trim();
    const errEl = document.getElementById('zm-newmsg-err');
    errEl.classList.add('hidden');
    if (!content) { errEl.textContent = 'יש להזין תוכן הודעה'; errEl.classList.remove('hidden'); return; }
    const btn = document.getElementById('zm-newmsg-send-btn');
    btn.disabled = true;
    try {
        let url, body;
        if (!isWrap) {
            // broadcast
            url = `${API}/zone-manager/inbox/broadcast`;
            body = { subject, content };
        } else {
            const groupId = targetEl.value;
            const commId = targetEl.options[targetEl.selectedIndex]?.dataset?.comm;
            if (!groupId) { errEl.textContent = 'יש לבחור נמען'; errEl.classList.remove('hidden'); btn.disabled = false; return; }
            url = `${API}/zone-manager/inbox/new`;
            body = { groupId: parseInt(groupId), communityId: commId ? parseInt(commId) : null, subject, content };
        }
        const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json','Authorization': zmToken}, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) {
            zmToast('ההודעה נשלחה!');
            document.getElementById('zm-newmsg-modal').classList.add('hidden');
            await zmLoadInbox();
        } else { errEl.textContent = data.error || 'שגיאה בשליחה'; errEl.classList.remove('hidden'); }
    } catch(e) { errEl.textContent = 'שגיאת תקשורת'; errEl.classList.remove('hidden'); }
    finally { btn.disabled = false; }
}

// ==========================================
// --- TEMPLATES ---
// ==========================================
function openZMCreateTemplate() {
    document.getElementById('zm-tpl-name').value = '';
    document.getElementById('zm-tpl-subject').value = '';
    document.getElementById('zm-tpl-content').value = '';
    document.getElementById('zm-tpl-err').classList.add('hidden');
    document.getElementById('zm-template-modal').classList.remove('hidden');
}

async function saveZMTemplate() {
    const name = document.getElementById('zm-tpl-name').value.trim();
    const subject = document.getElementById('zm-tpl-subject').value.trim();
    const content = document.getElementById('zm-tpl-content').value.trim();
    const errEl = document.getElementById('zm-tpl-err');
    if (!name || !content) { errEl.textContent = 'שם ותוכן הם שדות חובה'; errEl.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/templates`, {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({name, subject, content})
        });
        const data = await res.json();
        if (data.success) {
            zmToast('תבנית נשמרה!');
            document.getElementById('zm-template-modal').classList.add('hidden');
            await zmLoadTemplates();
        } else { errEl.textContent = data.error || 'שגיאה'; errEl.classList.remove('hidden'); }
    } catch(e) { errEl.textContent = 'שגיאת תקשורת'; errEl.classList.remove('hidden'); }
}

async function deleteZMTemplate(id) {
    if (!confirm('למחוק תבנית זו?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/templates/${id}`, { method: 'DELETE', headers: {'Authorization': zmToken} });
        const data = await res.json();
        if (data.success) { zmToast('תבנית נמחקה'); await zmLoadTemplates(); }
        else zmToast(data.error || 'שגיאה', 'error');
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

function useTemplate(id) {
    const modal = document.getElementById('zm-newmsg-modal');
    if (!modal) return;
    const res = fetch(`${API}/zone-manager/templates`, { headers: {'Authorization': zmToken} })
        .then(r => r.json())
        .then(data => {
            const tpl = (data.templates || []).find(t => t.id === id);
            if (!tpl) return;
            if (tpl.subject) document.getElementById('zm-newmsg-subject').value = tpl.subject;
            if (tpl.content) document.getElementById('zm-newmsg-content').value = tpl.content;
        });
}

// ==========================================
// --- COMMUNITY MANAGER APPOINTMENT ---
// ==========================================
function openAppointModal(communityId, communityName) {
    _zmAppointCommunityId = communityId;
    document.getElementById('zm-appoint-comm-name').textContent = `קהילה: ${communityName}`;
    document.getElementById('zm-appoint-search').value = '';
    document.getElementById('zm-appoint-list').innerHTML = '';
    document.getElementById('zm-appoint-modal').classList.remove('hidden');
}

async function zmSearchMembers() {
    const q = document.getElementById('zm-appoint-search').value.trim();
    const list = document.getElementById('zm-appoint-list');
    if (q.length < 2) { list.innerHTML = ''; return; }
    try {
        const res = await fetch(`${API}/zone-manager/communities-members?communityId=${_zmAppointCommunityId}&q=${encodeURIComponent(q)}`, { headers: {'Authorization': zmToken} });
        const data = await res.json();
        const members = data.members || [];
        list.innerHTML = members.map(m => `
        <div class="flex justify-between items-center p-2.5 bg-white border border-slate-100 rounded-xl">
            <button onclick="zmAppointManager(${m.group_id},${_zmAppointCommunityId},'${(m.name||'').replace(/'/g,"\\'")}')"
                class="bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                מנה כמנהל
            </button>
            <div class="text-right">
                <p class="font-bold text-slate-800 text-sm">${m.name}</p>
                <p class="text-xs text-slate-500">${m.email || ''}</p>
            </div>
        </div>`).join('') || '<p class="text-xs text-slate-400 text-center py-3">לא נמצאו משתמשים</p>';
    } catch(e) { list.innerHTML = '<p class="text-xs text-red-400 text-center py-3">שגיאת תקשורת</p>'; }
}

async function zmAppointManager(groupId, communityId, name) {
    if (!confirm(`למנות את ${name} כמנהל הקהילה?`)) return;
    try {
        const res = await fetch(`${API}/zone-manager/set-community-manager`, {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization': zmToken},
            body: JSON.stringify({groupId, communityId})
        });
        const data = await res.json();
        if (data.success) {
            zmToast(`${name} מונה כמנהל הקהילה!`);
            document.getElementById('zm-appoint-modal').classList.add('hidden');
            await loadDashboard();
        } else zmToast(data.error || 'שגיאה', 'error');
    } catch(e) { zmToast('שגיאת תקשורת', 'error'); }
}

// ==========================================
// --- COMMISSIONS ---
// ==========================================
async function loadCommissions() {
    const list = document.getElementById('zm-comm-list');
    list.innerHTML = '<div class="text-center text-slate-400 py-6">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/commissions`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        const comms = data.commissions || [];
        if (!comms.length) { list.innerHTML = '<div class="text-center text-slate-400 py-6">אין עמלות עדיין</div>'; return; }
        list.innerHTML = comms.map(c => `
            <div class="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] text-slate-400">${new Date(c.created_at).toLocaleDateString('he-IL')}</span>
                </div>
                <div class="text-right">
                    <p class="font-bold text-slate-800 text-sm">${c.description || 'עמלה'}</p>
                    <p class="text-xs text-slate-500">${c.community_name || ''}</p>
                </div>
                <span class="font-black text-amber-700 text-sm">₪${parseFloat(c.amount).toFixed(2)}</span>
            </div>`).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה בטעינה</div>'; }
}
