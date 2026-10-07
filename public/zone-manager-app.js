const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let zmToken = null;
let zmManager = null;
let zmData = null;
let zmCampaigns = [];
let zmCurrentThreadId = null;
let zmAppointCommunityId = null;
let zmIsBroadcast = false;

window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset');
    if (resetToken) {
        document.getElementById('zm-reset-token').value = resetToken;
        zmSwitchAuthTab('reset');
        return;
    }
    const saved = localStorage.getItem('zm_token');
    const savedMgr = localStorage.getItem('zm_manager');
    if (saved && savedMgr) {
        zmToken = saved;
        zmManager = JSON.parse(savedMgr);
        showDashboard();
        loadDashboard();
        // showDashboard already sets _zmPendingRefresh
    }
};

function zmSwitchAuthTab(tab) {
    ['login','register','pending','forgot','reset'].forEach(t => {
        const form = document.getElementById(`zm-form-${t}`);
        const btn = document.getElementById(`zm-auth-tab-${t}`);
        if (form) form.classList.toggle('hidden', t !== tab);
        if (btn) btn.classList.toggle('active', t === tab);
    });
}

async function zmLogin() {
    const email = document.getElementById('zm-login-email').value;
    const pass = document.getElementById('zm-login-pass').value;
    const err = document.getElementById('zm-login-err');
    err.classList.add('hidden');
    try {
        const res = await fetch(`${API}/zone-manager/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });
        const data = await res.json();
        if (!data.success) { err.textContent = data.error || 'שגיאת כניסה'; err.classList.remove('hidden'); return; }
        zmToken = data.token; zmManager = data.manager;
        localStorage.setItem('zm_token', zmToken);
        localStorage.setItem('zm_manager', JSON.stringify(zmManager));
        showDashboard(); loadDashboard();
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); }
}

async function zmRegister() {
    const name = document.getElementById('zm-reg-name').value.trim();
    const email = document.getElementById('zm-reg-email').value.trim();
    const pass = document.getElementById('zm-reg-pass').value;
    const phone = document.getElementById('zm-reg-phone').value.trim();
    const err = document.getElementById('zm-reg-err');
    err.classList.add('hidden');
    if (!name || !email || !pass) { err.textContent = 'שם, מייל וסיסמה הם שדות חובה'; err.classList.remove('hidden'); return; }
    if (pass.length < 6) { err.textContent = 'הסיסמה חייבת להיות לפחות 6 תווים'; err.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password: pass, phone })
        });
        const data = await res.json();
        if (!data.success) { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); return; }
        zmSwitchAuthTab('pending');
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); }
}

async function zmForgotSubmit() {
    const email = document.getElementById('zm-forgot-email')?.value?.trim();
    const msg = document.getElementById('zm-forgot-msg');
    const err = document.getElementById('zm-forgot-err');
    msg.classList.add('hidden'); err.classList.add('hidden');
    if (!email) { err.textContent = 'הכנס כתובת מייל'; err.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/forgot-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
            msg.textContent = 'אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה.';
            msg.classList.remove('hidden');
        } else { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); }
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); }
}

async function zmResetSubmit() {
    const token = document.getElementById('zm-reset-token')?.value;
    const pass = document.getElementById('zm-reset-pass')?.value;
    const pass2 = document.getElementById('zm-reset-pass2')?.value;
    const err = document.getElementById('zm-reset-err');
    const ok = document.getElementById('zm-reset-ok');
    err.classList.add('hidden'); ok.classList.add('hidden');
    if (!pass || pass.length < 6) { err.textContent = 'הסיסמה חייבת להיות לפחות 6 תווים'; err.classList.remove('hidden'); return; }
    if (pass !== pass2) { err.textContent = 'הסיסמאות אינן תואמות'; err.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/reset-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password: pass })
        });
        const data = await res.json();
        if (data.success) {
            ok.textContent = 'הסיסמה עודכנה בהצלחה! כעת ניתן להתחבר.';
            ok.classList.remove('hidden');
            setTimeout(() => { history.replaceState({}, '', '/zone-manager.html'); zmSwitchAuthTab('login'); }, 2500);
        } else { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); }
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); }
}

function zmLogout() {
    localStorage.removeItem('zm_token'); localStorage.removeItem('zm_manager');
    zmToken = null; zmManager = null; zmData = null;
    if (window._zmPendingRefresh) { clearInterval(window._zmPendingRefresh); window._zmPendingRefresh = null; }
    document.getElementById('zm-login').classList.remove('hidden');
    document.getElementById('zm-dashboard').classList.add('hidden');
    zmSwitchAuthTab('login');
}

function showDashboard() {
    document.getElementById('zm-login').classList.add('hidden');
    document.getElementById('zm-dashboard').classList.remove('hidden');
    if (zmManager) document.getElementById('zm-header-name').textContent = zmManager.name || '';
    if (!window._zmPendingRefresh) {
        window._zmPendingRefresh = setInterval(() => loadZMPendingPanel(), 60000);
    }
}

async function loadZMPendingPanel() {
    const panel = document.getElementById('zm-pending-panel');
    if (!panel) return;
    try {
        const [bizRes, famRes, removalRes, invitedRes] = await Promise.all([
            fetch(`${API}/zone-manager/pending-businesses`, { headers: { 'Authorization': zmToken } }),
            fetch(`${API}/zone-manager/pending-families`, { headers: { 'Authorization': zmToken } }),
            fetch(`${API}/zone-manager/pending-removals`, { headers: { 'Authorization': zmToken } }),
            fetch(`${API}/zone-manager/invited-businesses`, { headers: { 'Authorization': zmToken } })
        ]);
        const bizData = await bizRes.json();
        const famData = await famRes.json();
        const removalData = await removalRes.json();
        const invitedData = await invitedRes.json();
        const bizPending = (bizData.success && bizData.pending) ? bizData.pending : [];
        const famPending = (famData.success && famData.pending) ? famData.pending : [];
        const removalPending = (removalData.success && removalData.pending) ? removalData.pending : [];
        const invitedPending = (invitedData.success && invitedData.pending) ? invitedData.pending : [];
        const total = bizPending.length + famPending.length + removalPending.length + invitedPending.length;

        // עדכון badge
        const badge = document.getElementById('zm-pending-biz-badge');
        if (badge) {
            if (total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }
            else badge.classList.add('hidden');
        }

        if (total === 0) {
            panel.innerHTML = '<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 text-center text-slate-400 text-sm"><i class="fa-solid fa-circle-check text-emerald-400 mr-2"></i>אין בקשות ממתינות לאישור</div>';
            return;
        }

        let html = '<div class="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">';
        html += '<div class="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2"><span class="text-amber-700 font-bold text-sm">⏳ בקשות ממתינות לאישורך</span><span class="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">' + total + '</span></div>';
        html += '<div class="divide-y divide-slate-100">';

        if (famPending.length > 0) {
            html += '<div class="px-4 py-2 bg-indigo-50/50"><p class="text-[11px] font-bold text-indigo-600 uppercase tracking-wide">👨‍👩‍👧 משפחות מבקשות להצטרף לקהילה</p></div>';
            html += famPending.map(p => `
                <div class="px-4 py-3 flex justify-between items-center gap-3">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${p.family_name || 'משפחה'}</p>
                        <p class="text-xs text-slate-500">קהילה: <strong>${p.comm_name}</strong></p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="zmApproveFamilyFromPanel(${p.group_id},${p.community_id})" class="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition">אשר</button>
                        <button onclick="zmRejectFamilyFromPanel(${p.group_id},${p.community_id})" class="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-100 transition">דחה</button>
                    </div>
                </div>`).join('');
        }

        if (invitedPending.length > 0) {
            html += '<div class="px-4 py-2 bg-teal-50/50"><p class="text-[11px] font-bold text-teal-600 uppercase tracking-wide">🏪 עסקים שהזמנת — ממתינים לאישורך</p></div>';
            html += invitedPending.map(p => `
                <div class="px-4 py-3 flex justify-between items-center gap-3">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${p.biz_name}</p>
                        <p class="text-xs text-slate-500">קהילה: <strong>${p.comm_name}</strong> · <span class="text-green-700 font-bold">${p.discount_pct}% הנחה</span></p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="zmApproveInvitedBiz(${p.community_id},${p.business_id})" class="bg-teal-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-teal-700 transition">אשר</button>
                        <button onclick="zmRejectInvitedBiz(${p.community_id},${p.business_id})" class="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-100 transition">דחה</button>
                    </div>
                </div>`).join('');
        }

        if (bizPending.length > 0) {
            html += '<div class="px-4 py-2 bg-orange-50/50"><p class="text-[11px] font-bold text-orange-600 uppercase tracking-wide">🏢 עסקים מבקשים להצטרף לקהילה</p></div>';
            html += bizPending.map(p => `
                <div class="px-4 py-3 flex justify-between items-center gap-3">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${p.biz_name}</p>
                        <p class="text-xs text-slate-500">קהילה: <strong>${p.comm_name}</strong> · <span class="text-green-700 font-bold">${p.discount_pct}% הנחה</span></p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="zmApproveBiz(${p.community_id},${p.business_id})" class="bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-700 transition">אשר</button>
                        <button onclick="zmRejectBiz(${p.community_id},${p.business_id})" class="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-100 transition">דחה</button>
                    </div>
                </div>`).join('');
        }

        if (removalPending.length > 0) {
            html += '<div class="px-4 py-2 bg-red-50/50"><p class="text-[11px] font-bold text-red-500 uppercase tracking-wide">🚪 בקשות הסרת עסק מקהילה</p></div>';
            html += removalPending.map(p => `
                <div class="px-4 py-3 flex justify-between items-center gap-3">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${p.biz_name}</p>
                        <p class="text-xs text-slate-500">קהילה: <strong>${p.comm_name}</strong></p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="zmApproveRemoval(${p.community_id},${p.business_id})" class="bg-red-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-700 transition">אשר הסרה</button>
                        <button onclick="zmDeclineRemoval(${p.community_id},${p.business_id})" class="bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-100 transition">דחה</button>
                    </div>
                </div>`).join('');
        }

        html += '</div></div>';
        panel.innerHTML = html;
    } catch(e) { panel.innerHTML = '<div class="bg-white rounded-2xl border border-slate-100 p-4 text-center text-red-400 text-sm">שגיאת טעינה</div>'; }
}

async function zmApproveFamilyFromPanel(groupId, communityId) {
    if (!confirm('לאשר את הצטרפות המשפחה לקהילה?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-family/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ groupId, communityId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('success', 'המשפחה אושרה!'); loadZMPendingPanel(); loadDashboard(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

async function zmRejectFamilyFromPanel(groupId, communityId) {
    if (!confirm('לדחות את בקשת ההצטרפות?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-family/reject`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ groupId, communityId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('info', 'הבקשה נדחתה'); loadZMPendingPanel(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

async function loadDashboard() {
    try {
        const res = await fetch(`${API}/zone-manager/dashboard`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { zmLogout(); return; }
        zmData = data;
        const fmt = v => '₪' + parseFloat(v || 0).toFixed(2);
        const earned = parseFloat(data.commissions?.total || 0);
        const earnedMonth = parseFloat(data.commissions?.month || 0);
        const paid = parseFloat(data.commissions?.total_paid || 0);
        const paidMonth = parseFloat(data.commissions?.month_paid || 0);

        document.getElementById('zm-stat-zones').textContent = data.zones?.length || 0;
        document.getElementById('zm-stat-communities').textContent = data.communities?.length || 0;
        document.getElementById('zm-stat-comm-total').textContent = fmt(earned);
        document.getElementById('zm-stat-comm-month').textContent = fmt(earnedMonth);
        document.getElementById('zm-stat-paid-total').textContent = fmt(paid);
        document.getElementById('zm-stat-paid-month').textContent = fmt(paidMonth);

        const totalPct = earned > 0 ? Math.min(100, Math.round(paid / earned * 100)) : 0;
        const monthPct = earnedMonth > 0 ? Math.min(100, Math.round(paidMonth / earnedMonth * 100)) : 0;
        document.getElementById('zm-paid-total-bar').style.width = totalPct + '%';
        document.getElementById('zm-paid-total-pct').textContent = totalPct + '%';
        document.getElementById('zm-paid-month-bar').style.width = monthPct + '%';
        document.getElementById('zm-paid-month-pct').textContent = monthPct + '%';

        renderZones(data);
        loadZMPendingPanel();
    } catch(e) { console.error('Dashboard load error', e); }
}

function zmSwitchTab(tab) {
    ['zones','biz-requests','marketing','leads','inbox','commissions','content','kol-haam'].forEach(t => {
        const view = document.getElementById(`zmview-${t}`);
        const btn = document.getElementById(`zmtab-${t}`);
        if (view) view.classList.add('hidden');
        if (btn) btn.classList.remove('active');
    });
    const activeView = document.getElementById(`zmview-${tab}`);
    const activeBtn = document.getElementById(`zmtab-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('active');
    if (tab === 'commissions') loadCommissions();
    if (tab === 'marketing') { loadCampaigns(); loadTemplates(); }
    if (tab === 'leads') loadLeadsTab();
    if (tab === 'inbox') loadInbox();
    if (tab === 'biz-requests') zmLoadPendingBiz();
    if (tab === 'content') zmLoadContent();
    if (tab === 'kol-haam') zmLoadKolHaamQueue();
}

async function zmLoadPendingBiz() {
    const list = document.getElementById('zm-pending-biz-list');
    const badge = document.getElementById('zm-pending-biz-badge');
    if (!list) return;
    list.innerHTML = '<div class="text-center text-slate-400 py-6"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</div>';
    try {
        const [res, removalRes, invitedRes] = await Promise.all([
            fetch(`${API}/zone-manager/pending-businesses`, { headers: { 'Authorization': zmToken } }),
            fetch(`${API}/zone-manager/pending-removals`, { headers: { 'Authorization': zmToken } }),
            fetch(`${API}/zone-manager/invited-businesses`, { headers: { 'Authorization': zmToken } })
        ]);
        const data = await res.json();
        const removalData = await removalRes.json();
        const invitedData = await invitedRes.json();
        if (!data.success) { list.innerHTML = '<div class="text-center text-red-400 py-6">שגיאה בטעינת נתונים</div>'; return; }
        const pending = data.pending || [];
        const removals = (removalData.success && removalData.pending) ? removalData.pending : [];
        const invited = (invitedData.success && invitedData.pending) ? invitedData.pending : [];
        const total = pending.length + removals.length + invited.length;
        if (badge) {
            if (total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }
            else { badge.classList.add('hidden'); }
        }
        if (total === 0) {
            list.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-circle-check text-4xl text-slate-200 mb-3 block"></i>אין בקשות ממתינות לאישור</div>';
            return;
        }
        let html = '';
        if (invited.length) {
            html += '<div class="px-1 py-2"><p class="text-[11px] font-bold text-teal-600 uppercase tracking-wide">🏪 עסקים שהזמנת — ממתינים לאישורך</p></div>';
            html += invited.map(p => `
            <div class="bg-white border border-teal-100 rounded-2xl p-4 shadow-sm flex justify-between items-center gap-4 mb-3">
                <div class="flex-1">
                    <p class="font-bold text-slate-800 text-sm">עסק: ${p.biz_name}</p>
                    <p class="text-xs text-slate-500 mt-0.5">קהילה: <strong>${p.comm_name}</strong></p>
                    <p class="text-[11px] mt-1.5 bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full inline-block border border-green-200">מוכן לתת ${p.discount_pct}% הנחה לחברי הקהילה</p>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="zmApproveInvitedBiz(${p.community_id},${p.business_id})" class="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-teal-700 transition"><i class="fa-solid fa-check mr-1"></i>אשר</button>
                    <button onclick="zmRejectInvitedBiz(${p.community_id},${p.business_id})" class="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition"><i class="fa-solid fa-xmark mr-1"></i>דחה</button>
                </div>
            </div>
        `).join('');
        }
        if (pending.length) {
            html += pending.map(p => `
            <div class="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm flex justify-between items-center gap-4 mb-3">
                <div class="flex-1">
                    <p class="font-bold text-slate-800 text-sm">עסק: ${p.biz_name}</p>
                    <p class="text-xs text-slate-500 mt-0.5">מבקש להצטרף לקהילה: <strong>${p.comm_name}</strong></p>
                    <p class="text-[11px] mt-1.5 bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full inline-block border border-green-200">מוכן לתת ${p.discount_pct}% הנחה לחברי הקהילה</p>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="zmApproveBiz(${p.community_id},${p.business_id})" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-700 transition"><i class="fa-solid fa-check mr-1"></i>אשר</button>
                    <button onclick="zmRejectBiz(${p.community_id},${p.business_id})" class="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition"><i class="fa-solid fa-xmark mr-1"></i>דחה</button>
                </div>
            </div>
        `).join('');
        }
        if (removals.length) {
            html += '<div class="px-1 py-2"><p class="text-[11px] font-bold text-red-500 uppercase tracking-wide">🚪 מנהלי קהילה ביקשו להסיר עסקים</p></div>';
            html += removals.map(p => `
            <div class="bg-white border border-red-100 rounded-2xl p-4 shadow-sm flex justify-between items-center gap-4 mb-3">
                <div class="flex-1">
                    <p class="font-bold text-slate-800 text-sm">עסק: ${p.biz_name}</p>
                    <p class="text-xs text-slate-500 mt-0.5">קהילה: <strong>${p.comm_name}</strong> · פעיל כרגע עם ${p.discount_pct}% הנחה</p>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="zmApproveRemoval(${p.community_id},${p.business_id})" class="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-red-700 transition"><i class="fa-solid fa-trash mr-1"></i>אשר הסרה</button>
                    <button onclick="zmDeclineRemoval(${p.community_id},${p.business_id})" class="bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-100 transition"><i class="fa-solid fa-xmark mr-1"></i>דחה בקשת ההסרה</button>
                </div>
            </div>
        `).join('');
        }
        list.innerHTML = html;
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-6">שגיאת תקשורת</div>'; }
}

async function zmApproveRemoval(communityId, businessId) {
    if (!confirm('לאשר את הסרת העסק מהקהילה? הפעולה בלתי הפיכה.')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/approve-removal`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId, businessId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('success', 'העסק הוסר מהקהילה'); zmLoadPendingBiz(); loadZMPendingPanel(); loadDashboard(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

async function zmDeclineRemoval(communityId, businessId) {
    if (!confirm('לדחות את בקשת ההסרה? העסק יישאר פעיל בקהילה.')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/decline-removal`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId, businessId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('info', 'בקשת ההסרה נדחתה'); zmLoadPendingBiz(); loadZMPendingPanel(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

// ── מנהל אזור מזמין עסק לקהילה — מקביל להזמנת מנהל קהילה, אישור ישיר בלי תיווך נוסף ──
window.openZMInviteBizModal = function(commId, commName) {
    const existing = document.getElementById('zm-invite-biz-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'zm-invite-biz-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center';
    modal.innerHTML = `
    <div class="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8" dir="rtl">
        <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-slate-800">🏪 הזמן עסק לקהילת ${commName}</h3>
            <button onclick="document.getElementById('zm-invite-biz-modal').remove()" class="text-slate-400 text-xl">&times;</button>
        </div>
        <div class="flex gap-2 mb-3">
            <input id="zm-invite-biz-search" type="text" placeholder="חפש לפי שם עסק או קוד..." class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" oninput="_zmInviteBizSearchDebounce(this.value, ${commId})">
            <button onclick="_zmSearchBizForInvite(document.getElementById('zm-invite-biz-search').value, ${commId})" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold">חפש</button>
        </div>
        <div id="zm-invite-biz-results" class="space-y-2 max-h-64 overflow-y-auto"></div>
    </div>`;
    document.body.appendChild(modal);
};

let _zmInviteBizSearchTimer = null;
window._zmInviteBizSearchDebounce = function(val, commId) {
    clearTimeout(_zmInviteBizSearchTimer);
    _zmInviteBizSearchTimer = setTimeout(() => _zmSearchBizForInvite(val, commId), 350);
};

window._zmSearchBizForInvite = async function(q, commId) {
    const el = document.getElementById('zm-invite-biz-results');
    if (!el || !q.trim()) return;
    el.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">טוען...</p>';
    try {
        const res = await fetch(`${API}/community/search-business?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!data.businesses.length) { el.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">לא נמצאו עסקים</p>'; return; }
        el.innerHTML = data.businesses.map(b => `
            <div class="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <button onclick="zmSendBizInvite(${commId}, ${b.id})" class="bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-600">הזמן</button>
                <div class="text-right">
                    <p class="font-bold text-slate-800 text-sm">${b.name}</p>
                    <p class="text-[10px] text-slate-400 font-mono">${b.group_code}</p>
                </div>
            </div>`).join('');
    } catch(e) { el.innerHTML = '<p class="text-red-400 text-xs text-center py-3">שגיאה בחיפוש</p>'; }
};

window.zmSendBizInvite = async function(commId, bizId) {
    try {
        const res = await fetch(`${API}/zone-manager/invite-business`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId: commId, businessId: bizId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('success', 'ההזמנה נשלחה לעסק!'); document.getElementById('zm-invite-biz-modal')?.remove(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
};

// עסק שהמנהל הזמין בעצמו וכבר אישר — אישור כאן ישיר וסופי, בלי תיווך נוסף
async function zmApproveInvitedBiz(communityId, businessId) {
    if (!confirm('לאשר את הצטרפות העסק לקהילה?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/approve-invited`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId, businessId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('success', 'העסק אושר והצטרף לקהילה!'); zmLoadPendingBiz(); loadDashboard(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

async function zmRejectInvitedBiz(communityId, businessId) {
    if (!confirm('לדחות את הבקשה?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/reject-invited`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId, businessId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('info', 'הבקשה נדחתה'); zmLoadPendingBiz(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

async function zmApproveBiz(communityId, businessId) {
    if (!confirm('לאשר את הצטרפות העסק לקהילה?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId, businessId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('success', 'העסק אושר והצטרף לקהילה!'); zmLoadPendingBiz(); loadZMPendingPanel(); loadDashboard(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

async function zmRejectBiz(communityId, businessId) {
    if (!confirm('לדחות את הבקשה ולהסיר אותה?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/reject`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId, businessId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('info', 'הבקשה נדחתה'); zmLoadPendingBiz(); loadZMPendingPanel(); loadDashboard(); }
        else zmShowToast('error', data.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

function zmShowToast(type, msg) {
    const toast = document.getElementById('zm-toast');
    if (!toast) { alert(msg); return; }
    toast.textContent = msg;
    toast.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl z-[9999] transition ${type === 'success' ? 'bg-emerald-500' : type === 'info' ? 'bg-blue-500' : 'bg-red-500'}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ============================================================
// ZONES RENDERING
// ============================================================

function renderZones(data) {
    const container = document.getElementById('zm-zones-container');
    const settings = data.settings || {};
    const minFamilies = settings.community_min_families || 30;
    const minBusinesses = settings.community_min_businesses || 15;

    if (!data.zones?.length) {
        container.innerHTML = '<div class="card p-8 text-center text-slate-400"><i class="fa-solid fa-map text-4xl mb-3 text-slate-200"></i><p>אין אזורים משויכים עדיין. פנה למנהל הראשי.</p></div>';
        return;
    }

    container.innerHTML = data.zones.map(zone => {
        const zoneCommunities = (data.communities || []).filter(c => String(c.zone_id) === String(zone.id));
        const commHtml = zoneCommunities.length
            ? zoneCommunities.map(c => {
                const fam = parseInt(c.family_count || 0);
                const biz = parseInt(c.business_count || 0);
                const famPct = Math.min(100, Math.round(fam / minFamilies * 100));
                const bizPct = Math.min(100, Math.round(biz / minBusinesses * 100));
                const famOk = fam >= minFamilies;
                const bizOk = biz >= minBusinesses;
                const allOk = famOk && bizOk;
                const hasManager = c.has_local_manager;
                return `
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex flex-col gap-1 items-start">
                            <span class="text-xs px-2 py-0.5 rounded-full font-bold ${allOk ? 'badge-ok' : 'badge-warn'}">${allOk ? '✓ פעילה' : '⏳ בהתפתחות'}</span>
                            <button onclick="openZMAppointModal(${c.id}, '${(c.name||'').replace(/'/g,"\\'")}' )" class="text-[10px] font-bold px-2 py-0.5 rounded-full ${hasManager ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'} hover:bg-purple-100 hover:text-purple-700 transition">
                                <i class="fa-solid fa-star mr-0.5"></i>${hasManager ? 'יש מנהל קהילה' : 'מנה מנהל קהילה'}
                            </button>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm text-right flex items-center justify-end gap-2">
                                <button onclick="openCommunityDetail(${c.id}, '${(c.name||'').replace(/'/g,'&#39;')}')" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition flex items-center gap-1"><i class="fa-solid fa-eye text-[9px]"></i>פרטים</button>
                                ${c.name}
                            </h4>
                            <p class="text-xs text-slate-400 text-right">${c.city || ''}</p>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="${famOk ? 'text-emerald-600 font-bold' : 'text-slate-500'}">${fam}/${minFamilies} משפחות</span>
                                <span class="text-slate-400">משפחות</span>
                            </div>
                            <div class="progress-bar"><div class="progress-fill ${famOk ? 'bg-emerald-500' : 'bg-amber-400'}" style="width:${famPct}%"></div></div>
                        </div>
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="${bizOk ? 'text-emerald-600 font-bold' : 'text-slate-500'}">${biz}/${minBusinesses} עסקים</span>
                                <span class="text-slate-400">עסקים</span>
                            </div>
                            <div class="progress-bar"><div class="progress-fill ${bizOk ? 'bg-emerald-500' : 'bg-blue-400'}" style="width:${bizPct}%"></div></div>
                        </div>
                    </div>
                </div>`;
            }).join('')
            : '<p class="text-slate-400 text-sm text-center py-4">אין קהילות באזור זה עדיין</p>';

        return `
        <div class="card p-5">
            <div class="flex justify-between items-center mb-4">
                <span class="text-sm font-bold text-slate-500">${zoneCommunities.length} קהילות</span>
                <h3 class="text-lg font-black text-slate-800"><i class="fa-solid fa-map-pin text-indigo-500 mr-2"></i>${zone.name}</h3>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${commHtml}</div>
        </div>`;
    }).join('');
}

// ============================================================
// COMMUNITY MANAGER APPOINTMENT
// ============================================================

async function openZMAppointModal(communityId, communityName) {
    zmAppointCommunityId = communityId;
    document.getElementById('zm-appoint-comm-name').textContent = `קהילה: ${communityName}`;
    document.getElementById('zm-appoint-search').value = '';
    document.getElementById('zm-appoint-list').innerHTML = '<p class="text-slate-400 text-xs text-center py-2">טוען...</p>';
    document.getElementById('zm-appoint-modal').classList.remove('hidden');
    zmSearchMembers();
}

async function zmSearchMembers() {
    const q = document.getElementById('zm-appoint-search').value.trim();
    const list = document.getElementById('zm-appoint-list');
    list.innerHTML = '<p class="text-slate-400 text-xs text-center py-2">מחפש...</p>';
    try {
        const res = await fetch(`${API}/zone-manager/communities-members?communityId=${zmAppointCommunityId}&q=${encodeURIComponent(q)}`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { list.innerHTML = '<p class="text-red-400 text-xs text-center py-2">שגיאה בחיפוש</p>'; return; }
        if (!data.members.length) { list.innerHTML = '<p class="text-slate-400 text-xs text-center py-3">לא נמצאו תוצאות</p>'; return; }
        list.innerHTML = data.members.map(m => `
            <div class="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <button onclick="zmSetCommunityManager(${m.group_id}, ${!m.is_community_manager})" class="text-xs font-bold px-2.5 py-1 rounded-lg transition ${m.is_community_manager ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}">
                    ${m.is_community_manager ? 'הסר תפקיד' : 'מנה כמנהל'}
                </button>
                <div class="text-right">
                    <p class="font-bold text-slate-700 text-sm">${m.name || '—'}</p>
                    <p class="text-[10px] text-slate-400">${m.admin_email || ''}</p>
                </div>
            </div>`).join('');
    } catch(e) { list.innerHTML = '<p class="text-red-400 text-xs text-center py-2">שגיאת תקשורת</p>'; }
}

async function zmSetCommunityManager(groupId, isManager) {
    try {
        const res = await fetch(`${API}/zone-manager/set-community-manager`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ groupId, communityId: zmAppointCommunityId, isManager })
        });
        const data = await res.json();
        if (data.success) {
            zmSearchMembers();
            loadDashboard();
        }
    } catch(e) { alert('שגיאת תקשורת'); }
}

async function zmSetManagerFromFamily(groupId, communityId, isManager, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try {
        const res = await fetch(`${API}/zone-manager/set-community-manager`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ groupId, communityId, isManager })
        });
        const data = await res.json();
        if (data.success) {
            showZMToast(isManager ? '🎖️ מונה כמנהל קהילה!' : 'הוסר תפקיד מנהל');
            loadDashboard();
            // Refresh family detail
            const modal = document.getElementById('zm-family-detail-modal');
            if (modal) modal.remove();
            openZMFamilyDetail(groupId);
        } else { showZMToast(data.error || 'שגיאה', 'error'); if (btn) { btn.disabled = false; btn.textContent = isManager ? '🎖️ מנה מנהל' : '👑 הסר מנהל'; } }
    } catch(e) { showZMToast('שגיאת תקשורת', 'error'); if (btn) btn.disabled = false; }
}

// ============================================================
// CAMPAIGNS
// ============================================================

async function loadCampaigns() {
    const list = document.getElementById('zm-campaigns-list');
    list.innerHTML = '<div class="text-center text-slate-400 py-4">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/campaigns`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        zmCampaigns = data.campaigns || [];
        if (!zmCampaigns.length) {
            list.innerHTML = '<div class="text-center text-slate-400 py-6"><i class="fa-solid fa-bullhorn text-3xl text-slate-200 mb-3 block"></i>אין קמפיינים עדיין</div>';
            return;
        }
        const host = window.location.origin;
        const typeLabels = { business:'🏪 עסקים', family:'👨‍👩‍👧 משפחות', community_join:'🤝 קהילה', general:'כללי' };
        list.innerHTML = zmCampaigns.map(c => {
            const campUrl = `${host}/campaign.html?t=${c.token}`;
            const ogUrl = `${host}/c/camp/${c.token}`;
            const waLines = [];
            if (c.text_content) {
                const firstPara = c.text_content.trim().split(/\n\n+/)[0].split('\n')[0];
                waLines.push(firstPara + '...');
            }
            waLines.push('');
            waLines.push(`👉 ${ogUrl}`);
            const waText = waLines.join('\n');
            const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
            const bannerHtml = c.image_url ? `<img src="${c.image_url}" class="w-full h-20 object-cover rounded-xl mb-3">` : '';
            return `
            <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                ${bannerHtml}
                <div class="flex justify-between items-start mb-2">
                    <div class="flex gap-2">
                        <button onclick="deleteCampaign(${c.id})" class="text-xs text-red-400 hover:text-red-600 transition px-2 py-1">🗑</button>
                        <button onclick="openZMEditCampaign(${c.id})" class="text-xs text-slate-400 hover:text-slate-600 transition px-2 py-1">✏️</button>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center gap-1.5 justify-end mb-0.5">
                            <span class="text-[10px] font-bold text-indigo-500">${typeLabels[c.campaign_type] || 'כללי'}</span>
                            <h4 class="font-bold text-slate-800 text-sm">${c.title}</h4>
                        </div>
                        <p class="text-xs text-slate-400">${c.subtitle || ''}</p>
                    </div>
                </div>
                <div class="grid grid-cols-4 gap-1.5 mt-3 pt-2 border-t border-slate-100">
                    <button onclick="viewCampaignLeads(${c.id})" class="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg hover:bg-emerald-100 transition text-center">
                        👥 ${c.lead_count || 0}
                    </button>
                    <button onclick="copyLink('${campUrl}')" class="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-100 transition text-center">
                        🔗 לינק
                    </button>
                    <a href="${waUrl}" target="_blank" class="text-xs font-bold bg-green-50 text-green-600 px-2 py-1.5 rounded-lg hover:bg-green-100 transition text-center block">
                        💬 ווצאפ
                    </a>
                    <span class="text-[10px] text-slate-400 text-center self-center">${new Date(c.created_at).toLocaleDateString('he-IL')}</span>
                </div>
            </div>`;
        }).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה</div>'; }
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        const btn = event.currentTarget;
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>הועתק!';
        btn.classList.add('bg-emerald-100','text-emerald-700');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('bg-emerald-100','text-emerald-700'); }, 2000);
    });
}

function zmGetSelectedCampaignType() {
    return document.getElementById('zm-camp-type-value')?.value || 'family';
}

function zmSetCampaignType(type) {
    document.getElementById('zm-camp-type-value').value = type;
    document.querySelectorAll('.camp-type-btn').forEach(el => {
        const isSelected = el.dataset.type === type;
        el.classList.toggle('border-indigo-400', isSelected);
        el.classList.toggle('bg-indigo-50', isSelected);
        el.classList.toggle('text-indigo-700', isSelected);
        el.classList.toggle('border-slate-200', !isSelected);
        el.classList.toggle('text-slate-500', !isSelected);
    });
    // show/hide module selector
    const modsSection = document.getElementById('zm-modules-section');
    const bizMods = document.getElementById('zm-modules-business');
    const famMods = document.getElementById('zm-modules-family');
    document.querySelectorAll('.zm-module-check').forEach(el => { el.checked = false; });
    if (type === 'business') {
        modsSection.classList.remove('hidden');
        bizMods.classList.remove('hidden');
        famMods.classList.add('hidden');
    } else if (type === 'family') {
        modsSection.classList.remove('hidden');
        famMods.classList.remove('hidden');
        bizMods.classList.add('hidden');
    } else {
        modsSection.classList.add('hidden');
        bizMods.classList.add('hidden');
        famMods.classList.add('hidden');
    }
}

function zmSetBannerPreview(url) {
    const preview = document.getElementById('zm-camp-banner-preview');
    const img = document.getElementById('zm-camp-banner-img');
    const removeBtn = document.getElementById('zm-remove-banner-btn');
    document.getElementById('zm-camp-image-url').value = url || '';
    if (url) {
        img.src = url; preview.classList.remove('hidden'); removeBtn.classList.remove('hidden');
    } else {
        img.src = ''; preview.classList.add('hidden'); removeBtn.classList.add('hidden');
    }
}

function zmRemoveBanner() { zmSetBannerPreview(''); }

function zmHandleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('התמונה גדולה מדי — מקסימום 2MB'); return; }
    const reader = new FileReader();
    reader.onload = e => zmSetBannerPreview(e.target.result);
    reader.readAsDataURL(file);
}

async function zmAIGenerateBanner() {
    const title = document.getElementById('zm-camp-title').value.trim();
    const campaignType = zmGetSelectedCampaignType();
    const btn = document.getElementById('zm-ai-banner-btn');
    btn.disabled = true; btn.textContent = '⏳ יוצר תמונה...';
    try {
        const res = await fetch(`${API}/zone-manager/ai/generate-banner`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ title, campaignType })
        });
        const data = await res.json();
        if (data.success && data.imageUrl) {
            zmSetBannerPreview(data.imageUrl);
        } else { alert(data.error || 'לא ניתן ליצור תמונה'); }
    } catch(e) { alert('שגיאת תקשורת'); }
    btn.disabled = false; btn.textContent = '🖼 צור תמונה';
}

function openZMCreateCampaign() {
    document.getElementById('zm-camp-editing-id').value = '';
    document.getElementById('zm-camp-modal-title').textContent = 'קמפיין חדש';
    document.getElementById('zm-camp-title').value = '';
    document.getElementById('zm-camp-subtitle').value = '';
    document.getElementById('zm-camp-text').value = '';
    document.getElementById('zm-ai-goal').value = '';
    document.getElementById('zm-ai-audience').value = '';
    zmSetCampaignType('family');
    zmSetBannerPreview('');
    ['name','last_name','business_name','address','city','phone','email'].forEach(f => {
        const el = document.getElementById(`fld-${f}`);
        if (el) el.checked = false;
    });
    document.querySelectorAll('.zm-module-check').forEach(el => { el.checked = false; });
    document.getElementById('zm-camp-err').classList.add('hidden');
    document.getElementById('zm-campaign-modal').classList.remove('hidden');
}

function openZMEditCampaign(id) {
    const c = zmCampaigns.find(x => x.id === id);
    if (!c) return;
    document.getElementById('zm-camp-editing-id').value = id;
    document.getElementById('zm-camp-modal-title').textContent = 'עריכת קמפיין';
    document.getElementById('zm-camp-title').value = c.title || '';
    document.getElementById('zm-camp-subtitle').value = c.subtitle || '';
    document.getElementById('zm-camp-text').value = c.text_content || '';
    document.getElementById('zm-ai-goal').value = '';
    document.getElementById('zm-ai-audience').value = '';
    zmSetCampaignType(c.campaign_type || 'family');
    zmSetBannerPreview(c.image_url || '');
    const fields = Array.isArray(c.fields_config) ? c.fields_config : [];
    ['name','last_name','business_name','address','city','phone','email','free_text'].forEach(f => {
        const el = document.getElementById(`fld-${f}`);
        if (el) el.checked = fields.includes(f);
    });
    document.getElementById('zm-camp-err').classList.add('hidden');
    document.getElementById('zm-campaign-modal').classList.remove('hidden');
}

async function zmAIDraftCampaign() {
    const goal = document.getElementById('zm-ai-goal').value.trim();
    const audience = document.getElementById('zm-ai-audience').value.trim();
    const campaignType = zmGetSelectedCampaignType();
    const modules = Array.from(document.querySelectorAll('.zm-module-check:checked')).map(el => el.value);
    const btn = document.getElementById('zm-ai-draft-btn');
    btn.disabled = true; btn.textContent = '⏳ יוצר...';
    try {
        const res = await fetch(`${API}/zone-manager/ai/draft-campaign`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ goal, audience, campaignType, modules })
        });
        const data = await res.json();
        if (data.success) {
            if (data.title) document.getElementById('zm-camp-title').value = data.title;
            if (data.subtitle) document.getElementById('zm-camp-subtitle').value = data.subtitle;
            if (data.text_content) document.getElementById('zm-camp-text').value = data.text_content;
        } else { alert(data.error || 'שגיאה ב-AI'); }
    } catch(e) { alert('שגיאת תקשורת'); }
    btn.disabled = false; btn.textContent = '✨ צור טקסט';
}

async function saveZMCampaign() {
    const editingId = document.getElementById('zm-camp-editing-id').value;
    const title = document.getElementById('zm-camp-title').value.trim();
    const err = document.getElementById('zm-camp-err');
    err.classList.add('hidden');
    if (!title) { err.textContent = 'כותרת הקמפיין חובה'; err.classList.remove('hidden'); return; }
    const fields_config = ['name','last_name','business_name','address','city','phone','email','free_text'].filter(f => document.getElementById(`fld-${f}`)?.checked);
    const body = {
        title,
        subtitle: document.getElementById('zm-camp-subtitle').value.trim() || null,
        text_content: document.getElementById('zm-camp-text').value.trim() || null,
        fields_config,
        campaign_type: zmGetSelectedCampaignType(),
        image_url: document.getElementById('zm-camp-image-url').value || null
    };
    try {
        const url = editingId ? `${API}/zone-manager/campaigns/${editingId}` : `${API}/zone-manager/campaigns`;
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': zmToken }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('zm-campaign-modal').classList.add('hidden');
            loadCampaigns();
        } else { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); }
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); }
}

async function deleteCampaign(id) {
    if (!confirm('למחוק את הקמפיין? כל הלידים שלו יימחקו גם כן.')) return;
    await fetch(`${API}/zone-manager/campaigns/${id}`, { method: 'DELETE', headers: { 'Authorization': zmToken } });
    loadCampaigns();
    zmCurrentCampIdForLeads = null;
    const refreshBtn = document.getElementById('zm-leads-refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('hidden');
    const list = document.getElementById('zm-leads-list');
    if (list) list.innerHTML = '<div class="text-center text-slate-400 py-6">בחר קמפיין לצפייה בלידים</div>';
}

// ============================================================
// LEADS
// ============================================================

async function loadLeadsTab() {
    const wrap = document.getElementById('zm-leads-campaign-select-wrap');
    const list = document.getElementById('zm-leads-list');
    const refreshBtn = document.getElementById('zm-leads-refresh-btn');
    try {
        const res = await fetch(`${API}/zone-manager/campaigns`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        zmCampaigns = data.campaigns || [];
        if (!zmCampaigns.length) {
            wrap.innerHTML = '';
            if (refreshBtn) refreshBtn.classList.add('hidden');
            list.innerHTML = '<div class="text-center text-slate-400 py-8">אין קמפיינים. צור קמפיין תחילה.</div>';
            return;
        }
        wrap.innerHTML = `<select id="zm-leads-camp-sel" class="zm-input text-sm w-auto" onchange="viewCampaignLeads(this.value)">
            <option value="">בחר קמפיין</option>
            ${zmCampaigns.map(c => `<option value="${c.id}">${c.title} (${c.lead_count||0})</option>`).join('')}
        </select>`;
        list.innerHTML = '<div class="text-center text-slate-400 py-6">בחר קמפיין לצפייה בלידים</div>';
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה</div>'; }
}

async function viewCampaignLeads(campId, campTitle) {
    if (!campId) return;
    zmCurrentCampIdForLeads = campId;
    const list = document.getElementById('zm-leads-list');
    const refreshBtn = document.getElementById('zm-leads-refresh-btn');
    if (refreshBtn) refreshBtn.classList.remove('hidden');
    list.innerHTML = '<div class="text-center text-slate-400 py-4">טוען לידים...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/campaigns/${campId}/leads`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success || !data.leads.length) {
            list.innerHTML = `<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-user-slash text-3xl text-slate-200 mb-3 block"></i>אין לידים עדיין לקמפיין זה</div>`;
            if (refreshBtn) refreshBtn.classList.add('hidden');
            return;
        }
        const hasUnanalyzed = data.leads.some(l => l.ai_score === null || l.ai_score === undefined);
        list.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                ${hasUnanalyzed ? `<button onclick="analyzeLeads(${campId})" class="text-xs font-bold bg-purple-50 text-purple-600 px-3 py-1.5 rounded-xl hover:bg-purple-100 transition" id="zm-analyze-btn"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>נתח עם AI</button>` : '<span class="text-xs text-emerald-600 font-bold"><i class="fa-solid fa-check-circle mr-1"></i>כל הלידים נותחו</span>'}
                <span class="text-sm font-bold text-slate-600">${data.leads.length} לידים</span>
            </div>
            <div class="space-y-2" id="zm-leads-inner">
                ${renderLeads(data.leads)}
            </div>`;
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה</div>'; }
}

async function zmRefreshLeads() {
    if (!zmCurrentCampIdForLeads) return;
    const refreshBtn = document.getElementById('zm-leads-refresh-btn');
    const list = document.getElementById('zm-leads-list');
    if (refreshBtn) {
        refreshBtn.classList.add('opacity-50', 'pointer-events-none');
        refreshBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i>';
    }
    try {
        const res = await fetch(`${API}/zone-manager/campaigns/${zmCurrentCampIdForLeads}/leads`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success || !data.leads.length) {
            list.innerHTML = `<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-user-slash text-3xl text-slate-200 mb-3 block"></i>אין לידים עדיין לקמפיין זה</div>`;
        } else {
            const hasUnanalyzed = data.leads.some(l => l.ai_score === null || l.ai_score === undefined);
            list.innerHTML = `
                <div class="flex justify-between items-center mb-3">
                    ${hasUnanalyzed ? `<button onclick="analyzeLeads(${zmCurrentCampIdForLeads})" class="text-xs font-bold bg-purple-50 text-purple-600 px-3 py-1.5 rounded-xl hover:bg-purple-100 transition" id="zm-analyze-btn"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>נתח עם AI</button>` : '<span class="text-xs text-emerald-600 font-bold"><i class="fa-solid fa-check-circle mr-1"></i>כל הלידים נותחו</span>'}
                    <span class="text-sm font-bold text-slate-600">${data.leads.length} לידים</span>
                </div>
                <div class="space-y-2" id="zm-leads-inner">
                    ${renderLeads(data.leads)}
                </div>`;
        }
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה ברענון</div>'; }
    finally {
        if (refreshBtn) {
            refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
            refreshBtn.innerHTML = '<i class="fa-solid fa-arrow-rotate-right"></i>';
        }
    }
}

const LEAD_TYPE_LABELS = { business:'🏪 עסק', family:'👨‍👩‍👧 משפחה', unknown:'❓ לא ידוע' };
const LEAD_STATUS_LABELS = { new:'🆕 חדש', contacted:'📞 פנינו', interested:'✅ מתעניין', not_interested:'❌ לא מתעניין', converted:'🎉 הצטרף!' };
const LEAD_STATUS_COLORS = { new:'bg-blue-50 text-blue-600', contacted:'bg-amber-50 text-amber-600', interested:'bg-emerald-50 text-emerald-600', not_interested:'bg-red-50 text-red-500', converted:'bg-purple-50 text-purple-600' };

function renderLeads(leads) {
    window._zmLeadsCache = leads;
    return leads.map(l => {
        const fields = Object.entries(l.data || {}).map(([k,v]) => {
            if (!v) return '';
            if (k === 'free_text') return v.length > 30 ? v.substring(0,30)+'…' : v;
            return `${v}`;
        }).filter(Boolean).join(' · ');
        const score = l.ai_score;
        const scoreColor = score >= 8 ? 'text-emerald-600 bg-emerald-50' : score >= 5 ? 'text-amber-600 bg-amber-50' : score ? 'text-red-500 bg-red-50' : 'text-slate-400 bg-slate-50';
        const statusLabel = LEAD_STATUS_LABELS[l.status] || l.status || 'חדש';
        const statusColor = LEAD_STATUS_COLORS[l.status] || 'bg-slate-100 text-slate-500';
        const typeLabel = LEAD_TYPE_LABELS[l.lead_type] || '';
        return `
        <div class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 cursor-pointer hover:bg-white hover:shadow-sm transition-all" onclick="openLeadCRMWithData(${l.id}, window._zmLeadsCache?.find(x=>x.id===${l.id})||{})">
            <div class="flex justify-between items-start">
                <div class="flex flex-col gap-1.5 items-center pt-1">
                    <i class="fa-solid fa-chevron-left text-slate-300 text-xs"></i>
                    ${score !== null && score !== undefined ? `<span class="text-xs font-black px-2 py-0.5 rounded-full ${scoreColor}">AI: ${score}/10</span>` : ''}
                    <span class="text-[10px] text-slate-400">${new Date(l.created_at).toLocaleDateString('he-IL')}</span>
                </div>
                <div class="text-right flex-1 mr-3">
                    <div class="flex items-center gap-1.5 justify-end mb-1">
                        ${typeLabel ? `<span class="text-[10px] font-bold text-slate-500">${typeLabel}</span>` : ''}
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}">${statusLabel}</span>
                    </div>
                    <p class="text-sm font-bold text-slate-700">${fields || '—'}</p>
                    ${l.ai_notes ? `<p class="text-[11px] text-slate-400 mt-0.5 italic">${l.ai_notes}</p>` : ''}
                    ${l.crm_notes ? `<p class="text-[11px] text-slate-500 mt-0.5">📝 ${l.crm_notes}</p>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ============================================================
// LEAD CRM
// ============================================================

let zmCurrentLeadId = null;
let zmCurrentCampIdForLeads = null;

async function openLeadCRM(leadId) {
    zmCurrentLeadId = leadId;
    const modal = document.getElementById('zm-lead-crm-modal');
    modal.classList.remove('hidden');
    document.getElementById('zm-lead-actions-list').innerHTML = '<div class="text-slate-400 text-xs text-center py-2">טוען...</div>';

    // מצא את הליד מהנתונים שכבר טעונים
    const allLeads = document.querySelectorAll('[data-lead-id]');
    // נטען מחדש מה-API
    try {
        const [actRes] = await Promise.all([
            fetch(`${API}/zone-manager/leads/${leadId}/actions`, { headers: { 'Authorization': zmToken } })
        ]);
        const actData = await actRes.json();

        // קח את הנתונים של הליד מהDOM הקיים
        const leadEl = document.querySelector(`[data-lead-id="${leadId}"]`);
        const dataDiv = document.getElementById('zm-lead-crm-data');

        // אתחול ערכים
        document.getElementById('zm-crm-lead-id').value = leadId;

        // חפש את הליד ב-leads האחרונים שנטענו (נשמרים ב-zmCampaigns לא, אבל אפשר לחפש בDOM)
        // נוסיף data attributes לכרטיסיות הלידים כדי לדעת את הנתונים
        renderLeadCRMActions(actData.actions || []);
    } catch(e) { console.error(e); }
}

async function openLeadCRMWithData(leadId, lead) {
    zmCurrentLeadId = leadId;
    const modal = document.getElementById('zm-lead-crm-modal');
    modal.classList.remove('hidden');

    document.getElementById('zm-crm-lead-id').value = leadId;
    document.getElementById('zm-crm-lead-type').value = lead.lead_type || 'unknown';
    document.getElementById('zm-crm-status').value = lead.status || 'new';
    document.getElementById('zm-crm-notes').value = lead.crm_notes || '';

    // כותרת דינמית עם שם הליד
    const d = lead.data || {};
    const leadName = [d.name, d.last_name].filter(Boolean).join(' ') || d.business_name || d.phone || `ליד #${leadId}`;
    const titleEl = document.getElementById('zm-lead-crm-title');
    const subtitleEl = document.getElementById('zm-lead-crm-subtitle');
    if (titleEl) titleEl.textContent = leadName;
    if (subtitleEl) subtitleEl.textContent = new Date(lead.created_at || Date.now()).toLocaleDateString('he-IL', { day:'numeric', month:'long', year:'numeric' });

    // ניקוי שדה הערת פעולה
    const noteInput = document.getElementById('zm-action-note-input');
    if (noteInput) noteInput.value = '';

    const LEAD_FIELD_LABELS = { name:'שם פרטי', last_name:'שם משפחה', business_name:'שם עסק', address:'כתובת', city:'עיר', phone:'טלפון', email:'מייל', free_text:'הודעה חופשית' };
    const fields = Object.entries(d).map(([k,v]) => {
        if (!v) return '';
        const label = LEAD_FIELD_LABELS[k] || k;
        if (k === 'free_text') return `<div class="col-span-2 mt-1"><div class="text-slate-400 text-xs mb-1">${label}</div><div class="bg-white rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap border border-slate-100 leading-relaxed">${v}</div></div>`;
        return `<div class="flex justify-between gap-2 py-0.5 border-b border-slate-100 last:border-0"><span class="text-slate-400 text-xs">${label}</span><span class="font-bold text-slate-700 text-sm">${v}</span></div>`;
    }).filter(Boolean).join('');
    document.getElementById('zm-lead-crm-data').innerHTML = fields || '<p class="text-slate-400 text-xs text-center py-2">אין נתונים</p>';

    document.getElementById('zm-lead-actions-list').innerHTML = '<div class="text-slate-400 text-xs text-center py-3">טוען היסטוריה...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}/actions`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        renderLeadCRMActions(data.actions || []);
    } catch(e) {}
}

const ACTION_LABELS = { call:'שיחה', whatsapp:'ווצאפ', meeting:'פגישה', email:'מייל', other:'הערה' };
const ACTION_ICONS  = { call:'📞', whatsapp:'💬', meeting:'🤝', email:'✉️', other:'📝' };
const ACTION_COLORS = { call:'bg-blue-50 text-blue-600', whatsapp:'bg-green-50 text-green-600', meeting:'bg-amber-50 text-amber-600', email:'bg-slate-100 text-slate-600', other:'bg-purple-50 text-purple-600' };

function renderLeadCRMActions(actions) {
    const list = document.getElementById('zm-lead-actions-list');
    if (!actions.length) {
        list.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">אין פעולות עדיין<br><span class="text-slate-300">רשום פעולה ראשונה למעלה</span></p>';
        return;
    }
    list.innerHTML = actions.map(a => {
        const label = ACTION_LABELS[a.action_type] || a.action_type;
        const icon  = ACTION_ICONS[a.action_type]  || '📝';
        const color = ACTION_COLORS[a.action_type] || 'bg-slate-100 text-slate-600';
        const dt = new Date(a.created_at);
        const dateStr = dt.toLocaleDateString('he-IL', { day:'numeric', month:'short' });
        const timeStr = dt.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });
        return `
        <div class="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
            <div class="flex justify-between items-start gap-2">
                <div class="text-right flex-1">
                    <div class="flex items-center gap-1.5 justify-end mb-1">
                        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${color}">${icon} ${label}</span>
                    </div>
                    ${a.notes ? `<p class="text-xs text-slate-600 leading-relaxed">${a.notes}</p>` : '<p class="text-[11px] text-slate-300 italic">ללא הערה</p>'}
                </div>
                <div class="text-left shrink-0">
                    <p class="text-[10px] text-slate-400 font-bold">${dateStr}</p>
                    <p class="text-[10px] text-slate-300">${timeStr}</p>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function saveLeadCRM() {
    const leadId = document.getElementById('zm-crm-lead-id').value;
    if (!leadId) return;
    const body = {
        lead_type: document.getElementById('zm-crm-lead-type').value,
        status: document.getElementById('zm-crm-status').value,
        crm_notes: document.getElementById('zm-crm-notes').value.trim() || null
    };
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('zm-lead-crm-modal').classList.add('hidden');
            if (zmCurrentCampIdForLeads) viewCampaignLeads(zmCurrentCampIdForLeads);
        } else { alert(data.error || 'שגיאה'); }
    } catch(e) { alert('שגיאת תקשורת'); }
}

async function addLeadAction(actionType) {
    const leadId = document.getElementById('zm-crm-lead-id').value;
    if (!leadId) return;
    const noteInput = document.getElementById('zm-action-note-input');
    const notes = noteInput ? noteInput.value.trim() : '';
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}/actions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ action_type: actionType, notes: notes || null })
        });
        const data = await res.json();
        if (data.success) {
            if (noteInput) noteInput.value = '';
            const actRes = await fetch(`${API}/zone-manager/leads/${leadId}/actions`, { headers: { 'Authorization': zmToken } });
            const actData = await actRes.json();
            renderLeadCRMActions(actData.actions || []);
        }
    } catch(e) { alert('שגיאת תקשורת'); }
}

async function analyzeLeads(campId) {
    const btn = document.getElementById('zm-analyze-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>מנתח...'; }
    try {
        const res = await fetch(`${API}/zone-manager/ai/analyze-leads`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ campaignId: campId })
        });
        const data = await res.json();
        if (data.success && data.leads) {
            document.getElementById('zm-leads-inner').innerHTML = renderLeads(data.leads);
            if (btn) { btn.textContent = 'ניתוח הושלם!'; setTimeout(() => viewCampaignLeads(campId), 1500); }
        }
    } catch(e) { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>נתח עם AI'; } }
}

// ============================================================
// INBOX
// ============================================================

async function loadInbox() {
    const list = document.getElementById('zm-inbox-list');
    list.innerHTML = '<div class="text-center text-slate-400 py-4">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/inbox`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        const threads = data.threads || [];
        const totalUnread = threads.reduce((s, t) => s + parseInt(t.unread_count || 0), 0);
        const badge = document.getElementById('zm-inbox-badge');
        if (totalUnread > 0) { badge.textContent = totalUnread; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }

        if (!threads.length) {
            list.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-inbox text-3xl text-slate-200 mb-3 block"></i>אין הודעות עדיין</div>';
            return;
        }
        list.innerHTML = threads.map(t => {
            const unread = parseInt(t.unread_count || 0);
            return `
            <div class="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3.5 border ${unread > 0 ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100'} cursor-pointer hover:shadow-sm transition" onclick="openZMThread(${t.id})">
                <div class="w-10 h-10 rounded-xl ${unread > 0 ? 'bg-indigo-200' : 'bg-slate-200'} flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid fa-comment-dots ${unread > 0 ? 'text-indigo-600' : 'text-slate-500'} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0 text-right">
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] text-slate-400">${new Date(t.last_message_at).toLocaleDateString('he-IL')}</span>
                        <p class="font-bold text-slate-700 text-sm truncate">${t.group_name || t.community_name || '—'}</p>
                    </div>
                    <p class="text-xs text-slate-500 truncate mt-0.5">${t.last_message || ''}</p>
                </div>
                ${unread > 0 ? `<span class="bg-indigo-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">${unread}</span>` : ''}
            </div>`;
        }).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה</div>'; }
}

async function openZMThread(threadId) {
    zmCurrentThreadId = threadId;
    const modal = document.getElementById('zm-thread-modal');
    const msgContainer = document.getElementById('zm-thread-messages');
    document.getElementById('zm-reply-input').value = '';
    document.getElementById('zm-thread-title').textContent = 'טוען...';
    document.getElementById('zm-thread-subtitle').textContent = '';
    modal.classList.remove('hidden');
    msgContainer.innerHTML = '<div class="text-center text-slate-400 py-6">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/inbox/${threadId}`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { msgContainer.innerHTML = '<div class="text-red-400 text-center py-4">שגיאה</div>'; return; }
        document.getElementById('zm-thread-title').textContent = data.thread.subject || 'שיחה';
        document.getElementById('zm-thread-subtitle').textContent = `${data.thread.group_name || ''} · ${data.thread.community_name || ''}`;
        msgContainer.innerHTML = renderMessages(data.messages);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        loadInbox();
    } catch(e) { msgContainer.innerHTML = '<div class="text-red-400 text-center py-4">שגיאת תקשורת</div>'; }
}

function renderMessages(messages) {
    if (!messages.length) return '<div class="text-center text-slate-400 py-4">אין הודעות</div>';
    return messages.map(m => {
        const isManager = m.sender_type === 'manager';
        return `
        <div class="flex ${isManager ? 'justify-start' : 'justify-end'}">
            <div class="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${isManager ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}">
                <p class="leading-relaxed">${m.content}</p>
                <p class="text-[10px] mt-1 ${isManager ? 'text-indigo-200' : 'text-slate-400'} text-left">${new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'})}</p>
            </div>
        </div>`;
    }).join('');
}

async function sendZMReply() {
    const content = document.getElementById('zm-reply-input').value.trim();
    if (!content || !zmCurrentThreadId) return;
    document.getElementById('zm-reply-input').value = '';
    try {
        const res = await fetch(`${API}/zone-manager/inbox/${zmCurrentThreadId}/reply`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (data.success) openZMThread(zmCurrentThreadId);
    } catch(e) { alert('שגיאת תקשורת'); }
}

async function zmAISuggestReply() {
    if (!zmCurrentThreadId) return;
    const btn = document.getElementById('zm-ai-reply-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>AI חושב...';
    try {
        const res = await fetch(`${API}/zone-manager/ai/suggest-reply`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ threadId: zmCurrentThreadId })
        });
        const data = await res.json();
        if (data.success && data.suggestion) {
            document.getElementById('zm-reply-input').value = data.suggestion;
        } else { alert(data.error || 'שגיאה ב-AI'); }
    } catch(e) { alert('שגיאת תקשורת'); }
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>הצעת תשובה עם AI';
}

async function openZMNewMessage() {
    zmIsBroadcast = false;
    document.getElementById('zm-newmsg-title').textContent = 'הודעה חדשה';
    document.getElementById('zm-newmsg-target-wrap').classList.remove('hidden');
    document.getElementById('zm-newmsg-subject').value = '';
    document.getElementById('zm-newmsg-content').value = '';
    document.getElementById('zm-newmsg-err').classList.add('hidden');
    await loadCommunityManagerOptions();
    document.getElementById('zm-newmsg-modal').classList.remove('hidden');
}

async function openZMBroadcast() {
    zmIsBroadcast = true;
    document.getElementById('zm-newmsg-title').textContent = 'שידור לכל מנהלי הקהילות';
    document.getElementById('zm-newmsg-target-wrap').classList.add('hidden');
    document.getElementById('zm-newmsg-subject').value = '';
    document.getElementById('zm-newmsg-content').value = '';
    document.getElementById('zm-newmsg-err').classList.add('hidden');
    document.getElementById('zm-newmsg-modal').classList.remove('hidden');
}

async function loadCommunityManagerOptions() {
    const sel = document.getElementById('zm-newmsg-target');
    sel.innerHTML = '<option value="">טוען...</option>';
    if (!zmData?.communities) return;
    const options = zmData.communities.filter(c => c.has_local_manager).map(c =>
        `<option value="${c.id}__${c.zone_id}">${c.name}${c.city ? ` (${c.city})` : ''}</option>`
    );
    if (!options.length) {
        sel.innerHTML = '<option value="">אין מנהלי קהילות פעילים עדיין</option>';
    } else {
        sel.innerHTML = '<option value="">בחר קהילה</option>' + options.join('');
    }
}

async function sendZMNewMessage() {
    const err = document.getElementById('zm-newmsg-err');
    const btn = document.getElementById('zm-newmsg-send-btn');
    err.classList.add('hidden');
    const content = document.getElementById('zm-newmsg-content').value.trim();
    const subject = document.getElementById('zm-newmsg-subject').value.trim();
    if (!content) { err.textContent = 'תוכן ההודעה חובה'; err.classList.remove('hidden'); return; }

    btn.disabled = true; btn.textContent = 'שולח...';
    try {
        if (zmIsBroadcast) {
            const res = await fetch(`${API}/zone-manager/inbox/broadcast`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
                body: JSON.stringify({ subject, content })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('zm-newmsg-modal').classList.add('hidden');
                loadInbox();
                alert(`שידור נשלח ל-${data.sent} מנהלי קהילות`);
            } else { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); }
        } else {
            const targetVal = document.getElementById('zm-newmsg-target').value;
            if (!targetVal) { err.textContent = 'בחר קהילה'; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'שלח'; return; }
            const [communityId, zoneId] = targetVal.split('__');
            const comm = zmData.communities.find(c => String(c.id) === communityId);
            const groupRes = await fetch(`${API}/zone-manager/communities-members?communityId=${communityId}&q=`, { headers: { 'Authorization': zmToken } });
            const groupData = await groupRes.json();
            const manager = (groupData.members || []).find(m => m.is_community_manager);
            if (!manager) { err.textContent = 'לא נמצא מנהל קהילה פעיל'; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'שלח'; return; }
            const res = await fetch(`${API}/zone-manager/inbox/new`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
                body: JSON.stringify({ communityId, groupId: manager.group_id, subject, content })
            });
            const data = await res.json();
            if (data.success) { document.getElementById('zm-newmsg-modal').classList.add('hidden'); loadInbox(); }
            else { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); }
        }
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); }
    btn.disabled = false; btn.textContent = 'שלח';
}

// ============================================================
// TEMPLATES
// ============================================================

async function loadTemplates() {
    const list = document.getElementById('zm-templates-list');
    list.innerHTML = '<div class="text-center text-slate-400 py-3">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/templates`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        const templates = data.templates || [];
        if (!templates.length) {
            list.innerHTML = '<div class="text-center text-slate-400 py-4 text-sm">אין תבניות עדיין</div>';
            return;
        }
        list.innerHTML = templates.map(t => `
            <div class="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <div class="flex gap-2">
                    <button onclick="deleteTemplate(${t.id})" class="text-xs text-red-400 hover:text-red-600 transition p-1"><i class="fa-solid fa-trash"></i></button>
                    <button onclick="useTemplate(${t.id})" class="text-xs font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition"><i class="fa-solid fa-share mr-1"></i>השתמש</button>
                </div>
                <div class="text-right">
                    <p class="font-bold text-slate-700 text-sm">${t.name}</p>
                    <p class="text-xs text-slate-400 truncate max-w-48">${t.content?.substring(0,60) || ''}...</p>
                </div>
            </div>`).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-3">שגיאה</div>'; }
}

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
    const err = document.getElementById('zm-tpl-err');
    err.classList.add('hidden');
    if (!name || !content) { err.textContent = 'שם ותוכן הם שדות חובה'; err.classList.remove('hidden'); return; }
    try {
        const res = await fetch(`${API}/zone-manager/templates`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ name, subject, content })
        });
        const data = await res.json();
        if (data.success) { document.getElementById('zm-template-modal').classList.add('hidden'); loadTemplates(); }
        else { err.textContent = data.error || 'שגיאה'; err.classList.remove('hidden'); }
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); }
}

async function deleteTemplate(id) {
    if (!confirm('למחוק תבנית זו?')) return;
    await fetch(`${API}/zone-manager/templates/${id}`, { method: 'DELETE', headers: { 'Authorization': zmToken } });
    loadTemplates();
}

function useTemplate(id) {
    const templates = document.querySelectorAll('[data-tpl-id]');
    fetch(`${API}/zone-manager/templates`, { headers: { 'Authorization': zmToken } })
        .then(r => r.json())
        .then(data => {
            const t = (data.templates || []).find(x => x.id === id);
            if (!t) return;
            document.getElementById('zm-newmsg-subject').value = t.subject || '';
            document.getElementById('zm-newmsg-content').value = t.content || '';
            openZMNewMessage();
        });
}

// ============================================================
// COMMISSIONS
// ============================================================

async function loadCommissions() {
    const list = document.getElementById('zm-comm-list');
    list.innerHTML = '<div class="text-center text-slate-400 py-4">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/commissions`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success || !data.commissions.length) {
            list.innerHTML = '<div class="text-center text-slate-400 py-6">אין עמלות עדיין</div>';
            return;
        }
        list.innerHTML = data.commissions.map(c => `
            <div class="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-3">
                <span class="text-xs text-slate-400">${new Date(c.created_at).toLocaleDateString('he-IL')}</span>
                <span class="text-xs text-slate-500 flex-1 mx-3 text-center truncate">${c.community_name || ''} · ${c.description || ''}</span>
                <span class="font-bold text-amber-700 text-sm">₪${parseFloat(c.amount).toFixed(2)}</span>
            </div>`).join('');
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-4">שגיאה בטעינה</div>'; }
}

// ==========================================
// --- COMMUNITY DETAIL MODAL ---
// ==========================================
let _cdData = null;

async function openCommunityDetail(commId, encodedName) {
    const commName = encodedName.replace(/&#39;/g, "'");
    const modal = document.getElementById('zm-comm-detail-modal');
    const body = document.getElementById('zm-cd-body');
    document.getElementById('zm-cd-name').textContent = commName;
    document.getElementById('zm-cd-meta').textContent = '';
    ['families','businesses','promos','flow','campaign'].forEach(t => setCDTab(t, false));
    setCDTab('families', true);
    body.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</div>';
    modal.classList.remove('hidden');
    try {
        const res = await fetch(`${API}/zone-manager/community-detail/${commId}`, { headers: {'Authorization': zmToken} });
        _cdData = await res.json();
        if (!_cdData.success) { body.innerHTML = `<div class="text-red-400 text-center py-6">${_cdData.error || 'שגיאה'}</div>`; return; }
        const c = _cdData.community;
        document.getElementById('zm-cd-meta').textContent = [c.city, c.zone_name, c.status === 'active' ? 'פעיל' : c.status].filter(Boolean).join(' • ');
        const approvedFams = (_cdData.families || []).filter(f => f.status !== 'pending');
        const pendingFams = (_cdData.families || []).filter(f => f.status === 'pending');
        document.getElementById('zm-cd-stat-families').textContent = approvedFams.length + (pendingFams.length ? ` (+${pendingFams.length})` : '');
        document.getElementById('zm-cd-stat-businesses').textContent = _cdData.businesses.length;
        document.getElementById('zm-cd-stat-promos').textContent = _cdData.promos.length;
        document.getElementById('zm-cd-stat-flow').textContent = Math.floor(_cdData.flowBalance || 0);
        renderCDTab('families');
    } catch(e) { body.innerHTML = '<div class="text-red-400 text-center py-6">שגיאת תקשורת</div>'; }
}

function setCDTab(tab, active) {
    const colors = { families:'indigo', businesses:'emerald', promos:'orange', flow:'amber', campaign:'pink' };
    const btn = document.getElementById(`zm-cdtab-${tab}`);
    if (!btn) return;
    btn.className = active
        ? `text-xs font-bold px-3 py-1.5 rounded-t-lg border-b-2 border-${colors[tab]}-500 text-${colors[tab]}-600 bg-${colors[tab]}-50`
        : 'text-xs font-bold px-3 py-1.5 rounded-t-lg border-b-2 border-transparent text-slate-500 hover:text-slate-700';
}

function switchCDTab(tab) {
    ['families','businesses','promos','flow','campaign'].forEach(t => setCDTab(t, t === tab));
    renderCDTab(tab);
}

function renderCDTab(tab) {
    const body = document.getElementById('zm-cd-body');
    if (!_cdData) return;
    if (tab === 'families') {
        const fams = _cdData.families;
        if (!fams.length) { body.innerHTML = '<div class="text-center text-slate-400 py-8">אין משפחות רשומות בקהילה</div>'; return; }
        const pending = fams.filter(f => f.status === 'pending');
        const approved = fams.filter(f => f.status !== 'pending');
        const commId = _cdData.community.id;
        let html = '';
        if (pending.length) {
            html += `<div class="mb-3">
                <h4 class="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1"><i class="fa-solid fa-clock text-amber-500"></i> ממתינות לאישור (${pending.length})</h4>
                ${pending.map(f => `
                <div class="flex justify-between items-center p-3 bg-amber-50 border border-amber-200 rounded-xl mb-2">
                    <div class="flex gap-2">
                        <button onclick="zmApproveFamily(${f.group_id},${commId})" class="text-[10px] font-bold bg-green-500 text-white px-2.5 py-1 rounded-lg hover:bg-green-600 transition">אשר</button>
                        <button onclick="zmRejectFamily(${f.group_id},${commId})" class="text-[10px] font-bold bg-red-100 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-200 transition">דחה</button>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-slate-800 text-sm">${f.name}</p>
                        <p class="text-[10px] text-slate-500">${f.admin_email || ''}</p>
                    </div>
                </div>`).join('')}
            </div>`;
        }
        if (approved.length) {
            html += `<div>
                <h4 class="text-xs font-bold text-slate-500 mb-2">משפחות פעילות (${approved.length})</h4>
                ${approved.map(f => `
                <div class="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm mb-2 cursor-pointer hover:bg-blue-50 transition" onclick="openZMFamilyDetail(${f.group_id})">
                    <div class="flex items-center gap-2">
                        ${f.is_community_manager ? '<span class="bg-purple-100 text-purple-700 text-[9px] font-black px-2 py-0.5 rounded-full">⭐ מנהל</span>' : ''}
                        <i class="fa-solid fa-chevron-left text-slate-300 text-xs"></i>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-slate-800 text-sm">${f.name}</p>
                        <p class="text-[10px] text-slate-500">${f.admin_email || ''}</p>
                    </div>
                </div>`).join('')}
            </div>`;
        }
        body.innerHTML = html;
    } else if (tab === 'businesses') {
        const bizs = _cdData.businesses;
        const commId = _cdData.community.id;
        const inviteBtnHtml = `<button onclick="openZMInviteBizModal(${commId}, '${(_cdData.community.name||'').replace(/'/g,"\\'")}')" class="w-full mb-3 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-sm transition"><i class="fa-solid fa-store mr-1.5"></i>הזמן עסק לקהילה</button>`;
        if (!bizs.length) { body.innerHTML = inviteBtnHtml + '<div class="text-center text-slate-400 py-8">אין עסקים פעילים בקהילה</div>'; return; }
        body.innerHTML = inviteBtnHtml + bizs.map(b => `
        <div class="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm mb-2">
            <div class="flex flex-col items-start gap-1">
                <span class="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full">עסק</span>
                ${b.discount_pct > 0 ? `<span class="text-[10px] text-green-600 font-bold">${b.discount_pct}% הנחה</span>` : '<span class="text-[10px] text-slate-400">ללא הנחה</span>'}
                <button onclick="openZMDiscountEdit(${_cdData.community.id},${b.id},${b.discount_pct||0})" class="text-[10px] font-bold text-teal-600 hover:bg-teal-50 px-2 py-1 rounded border border-teal-200 transition"><i class="fa-solid fa-percent mr-1"></i>עדכן הנחה</button>
            </div>
            <div class="text-right">
                <p class="font-bold text-slate-800 text-sm">${b.name}</p>
                <p class="text-xs text-slate-500">${b.admin_email || ''}</p>
            </div>
        </div>`).join('');
    } else if (tab === 'promos') {
        const promos = _cdData.promos;
        if (!promos.length) { body.innerHTML = '<div class="text-center text-slate-400 py-8">אין מבצעים פעילים בקהילה</div>'; return; }
        body.innerHTML = promos.map(p => `
        <div class="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
            <div class="flex justify-between items-start">
                <span class="bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5 rounded-full">${p.discount_pct ? p.discount_pct + '% הנחה' : 'מבצע'}</span>
                <div class="text-right">
                    <p class="font-bold text-slate-800 text-sm">${p.title}</p>
                    <p class="text-xs text-slate-500">${p.business_name}</p>
                </div>
            </div>
            ${p.valid_until ? `<p class="text-[10px] text-slate-400 text-left mt-1">תוקף: ${new Date(p.valid_until).toLocaleDateString('he-IL')}</p>` : ''}
        </div>`).join('');
    } else if (tab === 'flow') {
        const txs = _cdData.flowTransactions || [];
        const actionLabels = { join_community:'הצטרפות לקהילה', referral:'הפניית שגריר', promo_redemption:'מימוש מבצע', ambassador_approved:'שגריר אושר', biz_join_approved:'עסק הצטרף', bundle_purchase:'רכישת חבילה', review_business:'ביקורת עסק', daily_login:'כניסה יומית' };
        body.innerHTML = `
        <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center mb-3">
            <div class="text-3xl font-black text-amber-600">${Math.floor(_cdData.flowBalance || 0)}</div>
            <div class="text-xs font-bold text-amber-500 mt-0.5">Flw יתרת קהילה</div>
        </div>
        ${txs.length ? '<p class="text-xs font-bold text-slate-500 mb-2">פעולות אחרונות</p>' + txs.map(t => `
        <div class="flex justify-between items-center p-2.5 bg-white border border-slate-100 rounded-xl text-xs">
            <span class="text-slate-400">${new Date(t.created_at).toLocaleDateString('he-IL')}</span>
            <div class="flex items-center gap-2">
                <span class="font-black text-amber-600">+${t.amount} Flw</span>
                <span class="text-slate-700">${actionLabels[t.action_key] || t.action_key}</span>
            </div>
        </div>`).join('') : '<div class="text-center text-slate-400 py-4">אין פעולות FLOW עדיין</div>'}`;
    } else if (tab === 'campaign') {
        zmLoadCommunityCampaigns(_cdData.community.id);
    }
}

// ═══════════════ קמפיין קהילה ═══════════════
let _zmCampaignsCache = [];

async function zmLoadCommunityCampaigns(commId) {
    const body = document.getElementById('zm-cd-body');
    body.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${commId}`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { body.innerHTML = `<div class="text-red-400 text-center py-6">${data.error || 'שגיאה'}</div>`; return; }
        _zmCampaignsCache = data.campaigns || [];
        const host = window.location.origin;
        body.innerHTML = `
        <button onclick="zmCreateCommunityCampaign(${commId})" class="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 rounded-xl text-sm mb-3 transition"><i class="fa-solid fa-plus ml-1.5"></i>קמפיין קהילתי חדש</button>
        ${!_zmCampaignsCache.length ? '<div class="text-center text-slate-400 py-8">עדיין אין קמפיינים לקהילה זו</div>' : _zmCampaignsCache.map(c => `
        <div class="bg-white border border-pink-100 rounded-2xl p-4 mb-2.5 shadow-sm">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0">
                    <p class="font-bold text-slate-800 text-sm">${safeStrZM(c.title)}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5 truncate">${host}/campaign/${safeStrZM(c.code)}</p>
                    <p class="text-[10px] text-slate-500 mt-1">${c.business_count} עסקים · ${c.product_count} מוצרים · ${c.status === 'active' ? '<span class="text-emerald-600 font-bold">פעיל</span>' : '<span class="text-slate-400">מושבת</span>'}</p>
                </div>
                <button onclick="zmOpenCampaignManage(${c.id}, ${commId})" class="shrink-0 text-xs font-bold bg-pink-50 text-pink-600 px-3 py-1.5 rounded-lg hover:bg-pink-100 transition">נהל</button>
            </div>
        </div>`).join('')}`;
    } catch(e) { body.innerHTML = '<div class="text-red-400 text-center py-6">שגיאת תקשורת</div>'; }
}

function safeStrZM(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

async function zmCreateCommunityCampaign(commId) {
    // הכותרת אופציונלית — לפעמים היא כבר מופיעה בצורה גרפית בתמונת הנושא
    const title = prompt('שם הקמפיין (יוצג ללקוחות, ניתן להשאיר ריק אם הכותרת כבר בתמונת הנושא):') || '';
    let code = prompt('קוד ייחודי לקישור הציבורי (אותיות/מספרים באנגלית, ללא רווחים):', (title || 'campaign-' + Date.now()).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-'));
    if (!code) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId: commId, title, code })
        });
        const data = await res.json();
        if (!data.success) return showZMToast(data.error || 'שגיאה', 'error');
        showZMToast('✅ הקמפיין נוצר!');
        zmOpenCampaignManage(data.campaign.id, commId);
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

function zmHandleCampaignImageUpload(event, targetInputId, previewId) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const maxWidth = 1200;
            let base64;
            if (img.width <= maxWidth) {
                base64 = e.target.result;
            } else {
                const canvas = document.createElement('canvas');
                const width = maxWidth, height = Math.round(img.height * (maxWidth / img.width));
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                base64 = canvas.toDataURL('image/jpeg', 0.9);
            }
            const targetInput = document.getElementById(targetInputId); if (targetInput) targetInput.value = base64;
            const preview = document.getElementById(previewId); if (preview) { preview.src = base64; preview.classList.remove('hidden'); }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function zmSaveCampaignSettings(campaignId, commId) {
    const title = document.getElementById(`zmc-title-${campaignId}`)?.value.trim();
    const slogan = document.getElementById(`zmc-slogan-${campaignId}`)?.value.trim();
    const logoUrl = document.getElementById(`zmc-logo-input-${campaignId}`)?.value;
    const bannerImageUrl = document.getElementById(`zmc-banner-input-${campaignId}`)?.value;
    const hideTitle = !!document.getElementById(`zmc-hide-title-${campaignId}`)?.checked;
    const shareDescription = document.getElementById(`zmc-sharedesc-${campaignId}`)?.value.trim();
    const orderingEnabled = !!document.getElementById(`zmc-ordering-${campaignId}`)?.checked;
    const activeDaysChecks = document.querySelectorAll(`[name="zmc-active-day-${campaignId}"]:checked`);
    const activeDays = activeDaysChecks.length === 7 || activeDaysChecks.length === 0
        ? null
        : Array.from(activeDaysChecks).map(cb => parseInt(cb.value));
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ title, slogan: slogan || null, logoUrl: logoUrl || null, bannerImageUrl: bannerImageUrl || null, hideTitle, shareDescription: shareDescription || null, orderingEnabled, activeDays })
        });
        const data = await res.json();
        if (!data.success) return showZMToast(data.error || 'שגיאה', 'error');
        showZMToast('ההגדרות נשמרו ✅');
        zmOpenCampaignManage(campaignId, commId);
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

// פותח את דיאלוג השיתוף של ווצאפ עם לינק הקמפיין — ווצאפ ישלוף בעצמו את תצוגת
// המקדימה (og:title/og:description/og:image) מנתיב /campaign/:code בזמן השליחה
function zmShareCampaignWhatsapp(campaignId) {
    const link = document.getElementById(`zmc-link-${campaignId}`)?.value;
    if (!link) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, '_blank');
}

let _zmCampaignDetail = null;
async function zmOpenCampaignManage(campaignId, commId) {
    const body = document.getElementById('zm-cd-body');
    body.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}/detail`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { body.innerHTML = `<div class="text-red-400 text-center py-6">${data.error || 'שגיאה'}</div>`; return; }
        _zmCampaignDetail = data;
        const host = window.location.origin;
        const c = data.campaign;
        body.innerHTML = `
        <button onclick="zmLoadCommunityCampaigns(${commId})" class="text-xs text-slate-500 hover:text-slate-700 mb-3"><i class="fa-solid fa-arrow-right ml-1"></i>חזרה לרשימת קמפיינים</button>
        <div class="bg-pink-50 border border-pink-100 rounded-2xl p-4 mb-3">
            <p class="font-black text-slate-800">קמפיין קהילה</p>
            <div class="flex items-center gap-2 mt-1.5">
                <input readonly id="zmc-link-${campaignId}" value="${host}/campaign/${safeStrZM(c.code)}" class="flex-1 text-[11px] bg-white border border-pink-200 rounded-lg px-2 py-1.5 text-slate-500" onclick="this.select()">
                <button onclick="navigator.clipboard.writeText('${host}/campaign/${c.code}');showZMToast('קישור הועתק ✅')" class="text-[10px] font-bold bg-pink-600 text-white px-2.5 py-1.5 rounded-lg">העתק</button>
            </div>
            <div class="mt-2.5">
                <label class="text-[10px] font-bold text-slate-400 block mb-1">מה יופיע בתצוגה המקדימה של הלינק בווצאפ</label>
                <input id="zmc-sharedesc-${campaignId}" type="text" value="${safeStrZM(c.share_description || '')}" placeholder="למשל: מבצעים בלעדיים לחברי הקהילה — הזמינו עכשיו" maxlength="200" class="w-full border border-pink-200 rounded-lg px-3 py-2 text-sm">
                <p class="text-[9px] text-slate-400 mt-1">בנפרד מהודעה ידנית — זה הטקסט שווצאפ יציג אוטומטית מתחת ללינק. שמרו בכפתור "שמור הגדרות" למטה.</p>
            </div>
            <button onclick="zmShareCampaignWhatsapp(${campaignId})" class="w-full mt-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-sm transition"><i class="fa-brands fa-whatsapp ml-1.5"></i>שתף בווצאפ</button>
        </div>

        <!-- הגדרות עמוד הקמפיין: כותרת, סלוגן, לוגו, תמונת נושא — כמו בניהול חנות ציבורית -->
        <div class="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
            <p class="text-xs font-bold text-slate-600 mb-3"><i class="fa-solid fa-sliders text-pink-500 mr-1"></i>הגדרות עמוד הקמפיין</p>
            <div class="space-y-2.5">
                <div>
                    <label class="text-[10px] font-bold text-slate-400 block mb-1">כותרת (אופציונלי)</label>
                    <input id="zmc-title-${campaignId}" type="text" value="${safeStrZM(c.title)}" placeholder="ניתן להשאיר ריק אם הכותרת כבר בתמונת הנושא" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <label class="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                        <input type="checkbox" id="zmc-hide-title-${campaignId}" ${c.hide_title ? 'checked' : ''} class="w-3.5 h-3.5 accent-pink-600">
                        <span class="text-[10px] text-slate-500">הסתר כותרת בעמוד (הכותרת כבר מופיעה בתמונת הנושא)</span>
                    </label>
                </div>
                <div>
                    <label class="text-[10px] font-bold text-slate-400 block mb-1">סלוגן (משפט קצר שיוצג ללקוחות)</label>
                    <input id="zmc-slogan-${campaignId}" type="text" value="${safeStrZM(c.slogan || '')}" placeholder="למשל: קונים מקומי, תומכים בשכונה" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 block mb-1">לוגו הקמפיין</label>
                        <div class="flex items-center gap-2">
                            <img id="zmc-logo-preview-${campaignId}" src="${c.logo_url || ''}" class="w-10 h-10 rounded-lg object-cover border border-slate-200 ${c.logo_url ? '' : 'hidden'}">
                            <input type="file" id="zmc-logo-upload-${campaignId}" accept="image/*" class="hidden" onchange="zmHandleCampaignImageUpload(event, 'zmc-logo-input-${campaignId}', 'zmc-logo-preview-${campaignId}')">
                            <input type="hidden" id="zmc-logo-input-${campaignId}" value="${c.logo_url || ''}">
                            <button type="button" onclick="document.getElementById('zmc-logo-upload-${campaignId}').click()" class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-2 rounded-lg">העלה</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 block mb-1">תמונת נושא (באנר)</label>
                        <div class="flex items-center gap-2">
                            <img id="zmc-banner-preview-${campaignId}" src="${c.banner_image_url || ''}" class="w-10 h-10 rounded-lg object-cover border border-slate-200 ${c.banner_image_url ? '' : 'hidden'}">
                            <input type="file" id="zmc-banner-upload-${campaignId}" accept="image/*" class="hidden" onchange="zmHandleCampaignImageUpload(event, 'zmc-banner-input-${campaignId}', 'zmc-banner-preview-${campaignId}')">
                            <input type="hidden" id="zmc-banner-input-${campaignId}" value="${c.banner_image_url || ''}">
                            <button type="button" onclick="document.getElementById('zmc-banner-upload-${campaignId}').click()" class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-2 rounded-lg">העלה</button>
                        </div>
                    </div>
                </div>
                <div class="border ${c.ordering_enabled === false ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'} rounded-xl p-3">
                    <label class="flex items-center justify-between gap-2 cursor-pointer">
                        <span class="text-sm font-bold text-slate-700">הזמנות פעילות</span>
                        <input type="checkbox" id="zmc-ordering-${campaignId}" ${c.ordering_enabled === false ? '' : 'checked'} class="w-4 h-4 accent-emerald-600">
                    </label>
                    <p class="text-[10px] text-slate-400 mt-1">כשכבוי — העמוד נשאר גלוי, אבל הוספת מוצרים לסל חסומה ומוצגת ללקוח הודעה שהמוצרים יהיו זמינים בקרוב</p>
                </div>
                <div class="border border-slate-200 bg-white rounded-xl p-3">
                    <p class="text-sm font-bold text-slate-700 mb-2"><i class="fa-solid fa-calendar-days text-pink-500 mr-1"></i>ימי פעילות</p>
                    <p class="text-[10px] text-slate-400 mb-2">סמנו את הימים שבהם ניתן לבצע הזמנות. ריק = כל הימים.</p>
                    <div class="grid grid-cols-7 gap-1">
                        ${[['א',0],['ב',1],['ג',2],['ד',3],['ה',4],['ו',5],['ש',6]].map(([label, val]) => {
                            const checked = !c.active_days || c.active_days.includes(val);
                            return `<label class="flex flex-col items-center gap-1 cursor-pointer">
                                <input type="checkbox" name="zmc-active-day-${campaignId}" value="${val}" ${checked ? 'checked' : ''} class="w-4 h-4 accent-pink-600">
                                <span class="text-[10px] font-bold text-slate-600">${label}'</span>
                            </label>`;
                        }).join('')}
                    </div>
                </div>
                <button onclick="zmSaveCampaignSettings(${campaignId}, ${commId})" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm mt-1 transition"><i class="fa-solid fa-floppy-disk ml-1.5"></i>שמור הגדרות</button>
            </div>
        </div>

        <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-bold text-slate-600">בקשות הצטרפות ממתינות</p>
        </div>
        <div id="zmc-requests-${campaignId}" class="space-y-2 mb-4">
            <div class="text-center text-slate-400 py-2 text-xs"><i class="fa-solid fa-spinner fa-spin"></i></div>
        </div>

        <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-bold text-slate-600">עסקים בקהילה — סמנו אילו נכללים בקמפיין</p>
            <button onclick="zmOpenProductsReview(${campaignId}, ${commId})" class="text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1.5 rounded-lg shrink-0"><i class="fa-solid fa-magnifying-glass ml-1"></i>סקירת מוצרים</button>
        </div>
        <div class="space-y-2">
        ${data.businesses.map(b => `
            <div class="border ${b.included ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white'} rounded-xl p-3">
                <div class="flex justify-between items-center gap-2">
                    <label class="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" ${b.included ? 'checked' : ''} onchange="zmToggleCampaignBusiness(${campaignId}, ${b.group_id}, this.checked, ${commId})" class="w-4 h-4 accent-emerald-600">
                        <span class="text-sm font-bold text-slate-700 truncate">${safeStrZM(b.name)}</span>
                    </label>
                    ${b.included ? `<span class="shrink-0 text-[10px] font-bold text-slate-400">${b.product_count} מוצרים</span>` : `<button onclick="zmInviteCampaignBusiness(${campaignId}, ${b.group_id}, ${commId})" class="shrink-0 text-[10px] font-bold bg-white border border-pink-300 text-pink-600 px-2.5 py-1.5 rounded-lg">הזמן</button>`}
                </div>
            </div>`).join('') || '<div class="text-center text-slate-400 py-6 text-xs">אין עסקים מאושרים בקהילה זו עדיין</div>'}
        </div>`;
        zmLoadCampaignRequests(campaignId, commId);
    } catch(e) { body.innerHTML = '<div class="text-red-400 text-center py-6">שגיאת תקשורת</div>'; }
}

async function zmLoadCampaignRequests(campaignId, commId) {
    const box = document.getElementById(`zmc-requests-${campaignId}`);
    if (!box) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}/requests`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { box.innerHTML = '<div class="text-red-400 text-xs text-center py-2">שגיאה בטעינה</div>'; return; }
        const pending = (data.requests || []).filter(r => r.status === 'pending');
        if (!pending.length) { box.innerHTML = '<div class="text-slate-400 text-xs text-center py-2">אין בקשות ממתינות</div>'; return; }
        box.innerHTML = pending.map(r => `
            <div class="border border-indigo-100 bg-indigo-50 rounded-xl p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-xs font-bold text-indigo-800 truncate">${safeStrZM(r.business_name)}</p>
                    <p class="text-[10px] text-indigo-400">${r.direction === 'business_request' ? 'העסק ביקש להצטרף' : 'ממתין לאישור העסק להזמנה'}</p>
                </div>
                ${r.direction === 'business_request' ? `
                <div class="flex gap-1 shrink-0">
                    <button onclick="zmRespondCampaignRequest(${campaignId}, ${r.id}, 'approve', ${commId})" class="bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg">אשר</button>
                    <button onclick="zmRespondCampaignRequest(${campaignId}, ${r.id}, 'reject', ${commId})" class="bg-white text-slate-500 border border-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">דחה</button>
                </div>` : ''}
            </div>`).join('');
    } catch(e) { box.innerHTML = '<div class="text-red-400 text-xs text-center py-2">שגיאת רשת</div>'; }
}

async function zmRespondCampaignRequest(campaignId, requestId, action, commId) {
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}/requests/${requestId}/respond`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ action })
        });
        const data = await res.json();
        if (!data.success) return showZMToast(data.error || 'שגיאה', 'error');
        showZMToast(action === 'approve' ? 'העסק הצטרף לקמפיין' : 'הבקשה נדחתה');
        zmOpenCampaignManage(campaignId, commId);
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

async function zmInviteCampaignBusiness(campaignId, groupId, commId) {
    const message = prompt('הודעה אישית להזמנה (אופציונלי):', '') || '';
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}/invite`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ businessGroupId: groupId, message })
        });
        const data = await res.json();
        if (!data.success) return showZMToast(data.error || 'שגיאה', 'error');
        showZMToast('ההזמנה נשלחה לעסק');
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

async function zmToggleCampaignBusiness(campaignId, groupId, checked, commId) {
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}/businesses`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ businessGroupId: groupId, action: checked ? 'add' : 'remove' })
        });
        const data = await res.json();
        if (!data.success) return showZMToast(data.error || 'שגיאה', 'error');
        zmOpenCampaignManage(campaignId, commId);
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

// המוצרים נבחרים ע"י העסק עצמו (ר' POST /api/biz/market-campaigns/:id/products) -
// כאן מנהל האזור רק מאשר/דוחה את מה שהוקצה, ויכול להסיר מוצר שכבר אושר (takedown)
// ═══════════ סקירת מוצרים — מסך גדול ייעודי (overlay במקום תיבת הצד הצרה) ═══════════
const _zmReview = { campaignId: null, commId: null, products: [], statusFilter: 'pending', bizFilter: 'all' };

function _zmEnsureReviewModal() {
    if (document.getElementById('zm-review-overlay')) return;
    const el = document.createElement('div');
    el.id = 'zm-review-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;background:rgba(15,23,42,.6);backdrop-filter:blur(2px);direction:rtl;padding:16px;';
    el.innerHTML = `
    <div style="background:#fff;border-radius:22px;width:100%;max-width:1100px;height:calc(100vh - 32px);margin:0 auto;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
            <h3 style="font-weight:900;font-size:16px;color:#1e293b;margin:0;">🔍 סקירת מוצרי שוק</h3>
            <button onclick="zmCloseProductsReview()" style="color:#94a3b8;font-size:20px;background:none;border:none;cursor:pointer;">✕</button>
        </div>
        <div style="padding:12px 20px;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
            <div id="zm-review-status-tabs" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
            <select id="zm-review-biz-filter" onchange="zmSetReviewBizFilter(this.value)" style="border:1px solid #e2e8f0;border-radius:10px;padding:7px 10px;font-size:12px;max-width:260px;"></select>
        </div>
        <div id="zm-review-body" style="flex:1;overflow-y:auto;padding:16px 20px;"></div>
    </div>`;
    el.addEventListener('click', e => { if (e.target === el) zmCloseProductsReview(); });
    document.body.appendChild(el);
}

window.zmCloseProductsReview = function() {
    const el = document.getElementById('zm-review-overlay');
    if (el) el.style.display = 'none';
};

async function zmOpenProductsReview(campaignId, commId) {
    _zmEnsureReviewModal();
    _zmReview.campaignId = campaignId;
    _zmReview.commId = commId;
    _zmReview.statusFilter = 'pending';
    _zmReview.bizFilter = 'all';
    document.getElementById('zm-review-overlay').style.display = 'block';
    document.getElementById('zm-review-body').innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}/products-review`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { document.getElementById('zm-review-body').innerHTML = `<div class="text-red-400 text-center py-6">${data.error || 'שגיאה'}</div>`; return; }
        _zmReview.products = data.products || [];
        zmRenderProductsReview();
    } catch(e) { document.getElementById('zm-review-body').innerHTML = '<div class="text-red-400 text-center py-6">שגיאת תקשורת</div>'; }
}

window.zmSetReviewStatusFilter = function(status) { _zmReview.statusFilter = status; zmRenderProductsReview(); };
window.zmSetReviewBizFilter = function(bizId) { _zmReview.bizFilter = bizId; zmRenderProductsReview(); };

function zmRenderProductsReview() {
    const { products, statusFilter, bizFilter } = _zmReview;
    const statusLabel = { pending: 'ממתין לאישור', approved: 'אושר', rejected: 'נדחה' };

    const counts = { all: products.length, pending: 0, approved: 0, rejected: 0 };
    products.forEach(p => { counts[p.approval_status] = (counts[p.approval_status] || 0) + 1; });
    const tabsEl = document.getElementById('zm-review-status-tabs');
    const tabDefs = [['pending', 'ממתינים'], ['approved', 'מאושרים'], ['rejected', 'נדחו'], ['all', 'הכל']];
    tabsEl.innerHTML = tabDefs.map(([key, label]) => {
        const active = statusFilter === key;
        return `<button onclick="zmSetReviewStatusFilter('${key}')" style="padding:7px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ${active ? '#4f46e5' : '#e2e8f0'};background:${active ? '#4f46e5' : '#fff'};color:${active ? '#fff' : '#475569'};">${label} (${counts[key] || 0})</button>`;
    }).join('');

    const bizMap = new Map();
    products.forEach(p => { if (!bizMap.has(p.business_group_id)) bizMap.set(p.business_group_id, p.business_name); });
    const bizSelect = document.getElementById('zm-review-biz-filter');
    bizSelect.innerHTML = `<option value="all">כל העסקים (${products.length})</option>` +
        [...bizMap.entries()].map(([id, name]) => `<option value="${id}" ${String(bizFilter) === String(id) ? 'selected' : ''}>${safeStrZM(name)}</option>`).join('');
    bizSelect.value = bizFilter;

    let filtered = products;
    if (statusFilter !== 'all') filtered = filtered.filter(p => p.approval_status === statusFilter);
    if (bizFilter !== 'all') filtered = filtered.filter(p => String(p.business_group_id) === String(bizFilter));

    const grouped = new Map();
    filtered.forEach(p => { if (!grouped.has(p.business_group_id)) grouped.set(p.business_group_id, []); grouped.get(p.business_group_id).push(p); });

    const body = document.getElementById('zm-review-body');
    if (!grouped.size) { body.innerHTML = '<p class="text-center text-slate-400 py-10 text-sm">אין מוצרים התואמים לסינון הנוכחי</p>'; return; }

    body.innerHTML = [...grouped.entries()].map(([bizId, items]) => `
        <div style="margin-bottom:18px;">
            <div style="font-weight:800;font-size:13px;color:#1e293b;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-store text-pink-400" style="font-size:11px;"></i>${safeStrZM(items[0].business_name)} <span style="font-weight:400;color:#94a3b8;">(${items.length})</span></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">
            ${items.map(p => `
                <div style="border:1px solid ${p.approval_status === 'pending' ? '#fde68a' : p.approval_status === 'approved' ? '#a7f3d0' : '#fecaca'};background:${p.approval_status === 'pending' ? '#fffbeb' : p.approval_status === 'approved' ? '#ecfdf5' : '#fef2f2'};border-radius:12px;padding:10px 12px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
                        <span style="font-size:13px;font-weight:700;color:#334155;">${safeStrZM(p.product_name)}</span>
                        <span style="font-size:10px;font-weight:700;color:#64748b;flex-shrink:0;">${statusLabel[p.approval_status] || p.approval_status}</span>
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:2px;">מחיר לשוק: ₪${p.price_override != null ? p.price_override : p.base_price}${p.price_override != null ? ` (קטלוג: ₪${p.base_price})` : ''}</div>
                    <div style="display:flex;gap:6px;margin-top:8px;">
                    ${p.approval_status === 'pending' ? `
                        <button onclick="zmReviewCampaignProduct(${p.business_group_id}, ${p.catalog_id}, 'approve')" style="flex:1;background:#059669;color:#fff;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;">אשר</button>
                        <button onclick="zmReviewCampaignProduct(${p.business_group_id}, ${p.catalog_id}, 'reject')" style="flex:1;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;">דחה</button>
                    ` : `
                        <button onclick="zmRemoveCampaignProduct(${p.catalog_id})" style="flex:1;background:#fff;color:#dc2626;border:1px solid #fecaca;border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;">הסר מהשוק</button>
                    `}
                    </div>
                </div>`).join('')}
            </div>
        </div>`).join('');
}

async function zmReviewCampaignProduct(groupId, catalogId, action) {
    const { campaignId } = _zmReview;
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}/products/review`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ businessGroupId: groupId, catalogId, action })
        });
        const data = await res.json();
        if (!data.success) return showZMToast(data.error || 'שגיאה', 'error');
        showZMToast(action === 'approve' ? 'המוצר אושר' : 'המוצר נדחה');
        const item = _zmReview.products.find(p => p.catalog_id === catalogId && p.business_group_id === groupId);
        if (item) item.approval_status = action === 'approve' ? 'approved' : 'rejected';
        zmRenderProductsReview();
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

async function zmRemoveCampaignProduct(catalogId) {
    const { campaignId } = _zmReview;
    try {
        const res = await fetch(`${API}/zone-manager/community-campaigns/${campaignId}/products`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ catalogId, action: 'remove' })
        });
        const data = await res.json();
        if (!data.success) return showZMToast(data.error || 'שגיאה', 'error');
        showZMToast('המוצר הוסר מהשוק');
        _zmReview.products = _zmReview.products.filter(p => p.catalog_id !== catalogId);
        zmRenderProductsReview();
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

async function zmApproveFamily(groupId, commId) {
    try {
        const res = await fetch(`${API}/zone-manager/community-family/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ groupId, communityId: commId })
        });
        const data = await res.json();
        if (data.success) { showZMToast('✅ המשפחה אושרה!'); openCommunityDetail(commId, document.getElementById('zm-cd-name').textContent); loadDashboard(); }
        else showZMToast(data.error || 'שגיאה', 'error');
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

async function zmRejectFamily(groupId, commId) {
    if (!confirm('לדחות את בקשת ההצטרפות של המשפחה?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-family/reject`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ groupId, communityId: commId })
        });
        const data = await res.json();
        if (data.success) { showZMToast('🗑 הבקשה נדחתה'); openCommunityDetail(commId, document.getElementById('zm-cd-name').textContent); }
        else showZMToast(data.error || 'שגיאה', 'error');
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

async function openZMDiscountEdit(commId, bizId, current) {
    const v = prompt(`אחוז הנחה חדש (נוכחי: ${current}%):`, current);
    if (v === null || v === '') return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/discount`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId: commId, businessId: bizId, discountPct: parseFloat(v)||0 })
        });
        const data = await res.json();
        if (data.success) { showZMToast('ההנחה עודכנה בהצלחה'); renderCDTab('businesses'); }
        else showZMToast(data.error || 'שגיאה', 'error');
    } catch(e) { showZMToast('שגיאת רשת', 'error'); }
}

async function openZMFamilyDetail(groupId) {
    const existing = document.getElementById('zm-family-detail-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'zm-family-detail-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4';
    modal.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div class="p-4 border-b flex justify-between items-center">
            <button onclick="document.getElementById('zm-family-detail-modal').remove()" class="text-slate-400 hover:text-red-500 text-2xl">&times;</button>
            <h3 class="font-bold text-slate-800 text-lg" id="zm-fam-detail-name">טוען...</h3>
        </div>
        <div id="zm-fam-detail-body" class="p-4 space-y-3"><div class="text-center text-slate-400 py-8"><i class="fa-solid fa-spinner fa-spin"></i></div></div>
    </div>`;
    document.body.appendChild(modal);
    try {
        const res = await fetch(`${API}/zone-manager/family-detail/${groupId}`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { document.getElementById('zm-fam-detail-body').innerHTML = `<p class="text-red-400 text-center">${data.error}</p>`; return; }
        const g = data.group;
        document.getElementById('zm-fam-detail-name').textContent = fmtGroupName(g);
        const usersHtml = (data.users || []).map(u => `
            <div class="flex justify-between items-center text-xs py-1.5 border-b border-slate-50">
                <span class="text-[10px] ${u.role==='ADMIN'?'text-blue-500 font-bold':'text-slate-400'}">${u.role==='ADMIN'?'מנהל/הורה':'חבר'}</span>
                <span class="text-slate-700">${fmtUserName(u) || u.nickname || u.email || ''}</span>
            </div>`).join('') || '<p class="text-xs text-slate-400">אין משתמשים</p>';
        const familyGroupId = g.id;
        const commsHtml = (data.communities || []).map(c => {
            const isApproved = c.status === 'approved';
            const isManager = c.is_community_manager;
            const managerBtn = isApproved ? `<button onclick="zmSetManagerFromFamily(${familyGroupId},${c.id},${!isManager},this)" class="text-[10px] font-bold px-2 py-0.5 rounded-lg transition ${isManager ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}">${isManager ? '👑 הסר מנהל' : '🎖️ מנה מנהל'}</button>` : '';
            return `<div class="flex justify-between items-center text-xs py-1.5 border-b border-slate-50 last:border-0">
                <div class="flex items-center gap-2">${managerBtn}<span class="${c.status==='pending'?'text-amber-500':'text-green-600'} font-bold text-[10px]">${c.status==='pending'?'⏳ ממתין':'✅'}</span></div>
                <span class="text-slate-700 font-medium">${c.name}</span>
            </div>`;
        }).join('') || '<p class="text-xs text-slate-400">אין קהילות</p>';
        document.getElementById('zm-fam-detail-body').innerHTML = `
            <div class="bg-slate-50 rounded-xl p-3 text-xs space-y-1 text-right">
                <p><span class="text-slate-400">מייל: </span><span class="font-medium">${g.admin_email || '—'}</span></p>
                <p><span class="text-slate-400">קוד: </span><span class="font-mono font-bold text-slate-700">${g.group_code || '—'}</span></p>
                <p><span class="text-slate-400">Flw: </span><span class="font-bold text-amber-600">${Math.floor(data.flowBalance || 0)}</span></p>
            </div>
            <div>
                <h4 class="text-xs font-bold text-slate-600 mb-2">👥 משתמשים</h4>
                <div class="bg-white rounded-xl border border-slate-100 p-2">${usersHtml}</div>
            </div>
            <div>
                <h4 class="text-xs font-bold text-slate-600 mb-2">🏘️ קהילות</h4>
                <div class="bg-white rounded-xl border border-slate-100 p-2 space-y-1">${commsHtml}</div>
            </div>`;
    } catch(e) { document.getElementById('zm-fam-detail-body').innerHTML = '<p class="text-red-400 text-center">שגיאת רשת</p>'; }
}

function showZMToast(msg, type='success') {
    const el = document.createElement('div');
    el.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[99999] px-4 py-2 rounded-xl text-sm font-bold shadow-lg ${type==='error'?'bg-red-500 text-white':'bg-green-500 text-white'}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ===== ZM CONTENT / ARTICLES =====
async function zmLoadContent() {
    const token = localStorage.getItem('zm_token');
    // populate community dropdown
    const commSel = document.getElementById('zm-article-community');
    if (commSel && commSel.options.length === 1) {
        try {
            const r = await fetch(`${API}/zm/zones`, { headers: { Authorization: `Bearer ${token}` } });
            const d = await r.json();
            (d.communities || []).forEach(c => {
                const o = document.createElement('option');
                o.value = c.id; o.textContent = c.name;
                commSel.appendChild(o);
            });
        } catch(e) {}
    }
    // load articles
    const list = document.getElementById('zm-articles-list');
    try {
        const r = await fetch(`${API}/zm/articles`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        const articles = d.articles || [];
        if (!articles.length) { list.innerHTML = '<p class="text-center text-slate-400 py-4 text-sm">לא פרסמת מאמרים עדיין</p>'; return; }
        list.innerHTML = articles.map(a => `
            <div class="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-start gap-2">
                <button onclick="zmDeleteArticle(${a.id})" class="text-red-400 hover:text-red-600 mt-1 flex-shrink-0"><i class="fa-solid fa-trash text-xs"></i></button>
                <div class="text-right flex-1">
                    <p class="font-bold text-slate-800 text-sm">${a.title}</p>
                    <p class="text-xs text-slate-400 mt-0.5">${a.community_name || 'כל הקהילות באזור'} · ${new Date(a.published_at).toLocaleDateString('he-IL')}</p>
                </div>
            </div>`).join('');
    } catch(e) { list.innerHTML = '<p class="text-center text-red-400 py-4 text-sm">שגיאה בטעינה</p>'; }
}

async function zmPublishArticle() {
    const token = localStorage.getItem('zm_token');
    const title = document.getElementById('zm-article-title').value.trim();
    const body = document.getElementById('zm-article-body').value.trim();
    const image_url = document.getElementById('zm-article-image').value.trim();
    const community_id = document.getElementById('zm-article-community').value || null;
    if (!title || !body) { zmShowToast('error', 'כותרת ותוכן הם שדות חובה'); return; }
    try {
        const r = await fetch(`${API}/zm/articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ title, body, image_url: image_url || null, community_id })
        });
        const d = await r.json();
        if (d.article) {
            zmShowToast('success', 'המאמר פורסם!');
            document.getElementById('zm-article-title').value = '';
            document.getElementById('zm-article-body').value = '';
            document.getElementById('zm-article-image').value = '';
            document.getElementById('zm-article-community').value = '';
            zmLoadContent();
        } else { zmShowToast('error', d.error || 'שגיאה'); }
    } catch(e) { zmShowToast('error', 'שגיאת רשת'); }
}

async function zmDeleteArticle(id) {
    if (!confirm('למחוק את המאמר?')) return;
    const token = localStorage.getItem('zm_token');
    try {
        await fetch(`${API}/zm/articles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        zmLoadContent();
    } catch(e) { zmShowToast('error', 'שגיאה'); }
}

// ══════════════════════════════════════════════════
// קול העם — תור אישור ZM
// ══════════════════════════════════════════════════
async function zmLoadKolHaamQueue() {
    const container = document.getElementById('zm-kol-haam-content');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-8 text-slate-400">טוען...</div>';
    try {
        const r = await fetch(`${API}/kol-haam/zm/queue`, {
            headers: { 'Authorization': zmToken }
        });
        const data = await r.json();
        const items = data.items || [];
        // update badge
        const badge = document.getElementById('zm-kh-badge');
        if (badge) {
            badge.textContent = items.length;
            badge.classList.toggle('hidden', items.length === 0);
        }
        if (items.length === 0) {
            container.innerHTML = '<div class="text-center py-12 text-slate-400">אין תוכן ממתין לאישור 🎉</div>';
            return;
        }
        container.innerHTML = `
          <div class="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-4 text-white shadow-lg mb-4">
            <h2 class="text-lg font-bold">📣 קול העם — תוכן ממתין לאישור</h2>
            <p class="text-indigo-100 text-xs mt-0.5">${items.length} פריטים ממתינים לבדיקה</p>
          </div>
          <div class="space-y-3">
            ${items.map(item => `
              <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div class="flex justify-between items-start gap-3 mb-3">
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-slate-800 text-sm mb-1">${escapeHtml(item.title)}</div>
                    <div class="text-xs text-slate-500">${escapeHtml(item.author_name||'')} · ${escapeHtml(item.community_name||'')} · ${new Date(item.created_at).toLocaleDateString('he-IL')}</div>
                    <div class="mt-1.5">
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${item.scope_type==='GLOBAL'?'bg-purple-100 text-purple-700':'bg-blue-100 text-blue-700'}">
                        ${item.scope_type==='GLOBAL'?'🌍 גלובלי':'🏘️ מקומי'}
                      </span>
                    </div>
                    ${item.summary ? `<p class="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mt-2">${escapeHtml(item.summary)}</p>` : ''}
                  </div>
                  ${item.cover_image_url ? `<img src="${item.cover_image_url}" class="w-16 h-16 rounded-xl object-cover shrink-0">` : ''}
                </div>
                <div class="flex gap-2">
                  <button onclick="zmKHApprove(${item.id})" class="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-green-700 transition">✔ אשר</button>
                  <button onclick="zmKHReject(${item.id})" class="flex-1 bg-red-500 text-white text-xs font-bold py-2 rounded-xl hover:bg-red-600 transition">✖ דחה</button>
                </div>
              </div>`).join('')}
          </div>`;
    } catch(e) {
        container.innerHTML = `<div class="text-center py-8 text-red-400">שגיאה: ${e.message}</div>`;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function zmKHApprove(id) {
    if (!confirm('לאשר פרסום?')) return;
    try {
        const r = await fetch(`${API}/kol-haam/zm/${id}/approve`, {
            method: 'POST',
            headers: { 'Authorization': zmToken, 'Content-Type': 'application/json' }
        });
        const d = await r.json();
        if (d.success) { zmShowToast('success', 'תוכן אושר לפרסום!'); zmLoadKolHaamQueue(); }
        else zmShowToast('error', d.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}

async function zmKHReject(id) {
    const reason = prompt('סיבת דחייה (אופציונלי):') || '';
    try {
        const r = await fetch(`${API}/kol-haam/zm/${id}/reject`, {
            method: 'POST',
            headers: { 'Authorization': zmToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const d = await r.json();
        if (d.success) { zmShowToast('info', 'תוכן נדחה'); zmLoadKolHaamQueue(); }
        else zmShowToast('error', d.error || 'שגיאה');
    } catch(e) { zmShowToast('error', 'שגיאת תקשורת'); }
}
