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
    document.getElementById('zm-login').classList.remove('hidden');
    document.getElementById('zm-dashboard').classList.add('hidden');
    zmSwitchAuthTab('login');
}

function showDashboard() {
    document.getElementById('zm-login').classList.add('hidden');
    document.getElementById('zm-dashboard').classList.remove('hidden');
    if (zmManager) document.getElementById('zm-header-name').textContent = zmManager.name || '';
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

        // טען badge של בקשות עסקים ממתינות
        try {
            const pbRes = await fetch(`${API}/zone-manager/pending-businesses`, { headers: { 'Authorization': zmToken } });
            const pbData = await pbRes.json();
            const badge = document.getElementById('zm-pending-biz-badge');
            if (badge && pbData.success && pbData.pending?.length > 0) {
                badge.textContent = pbData.pending.length;
                badge.classList.remove('hidden');
            }
        } catch(e) {}
    } catch(e) { console.error('Dashboard load error', e); }
}

function zmSwitchTab(tab) {
    ['zones','biz-requests','marketing','leads','inbox','commissions'].forEach(t => {
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
}

async function zmLoadPendingBiz() {
    const list = document.getElementById('zm-pending-biz-list');
    const badge = document.getElementById('zm-pending-biz-badge');
    if (!list) return;
    list.innerHTML = '<div class="text-center text-slate-400 py-6"><i class="fa-solid fa-spinner fa-spin mr-2"></i>טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/pending-businesses`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success) { list.innerHTML = '<div class="text-center text-red-400 py-6">שגיאה בטעינת נתונים</div>'; return; }
        const pending = data.pending || [];
        if (badge) {
            if (pending.length > 0) { badge.textContent = pending.length; badge.classList.remove('hidden'); }
            else { badge.classList.add('hidden'); }
        }
        if (pending.length === 0) {
            list.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-circle-check text-4xl text-slate-200 mb-3 block"></i>אין בקשות ממתינות לאישור</div>';
            return;
        }
        list.innerHTML = pending.map(p => `
            <div class="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm flex justify-between items-center gap-4">
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
    } catch(e) { list.innerHTML = '<div class="text-center text-red-400 py-6">שגיאת תקשורת</div>'; }
}

async function zmApproveBiz(communityId, businessId) {
    if (!confirm('לאשר את הצטרפות העסק לקהילה?')) return;
    try {
        const res = await fetch(`${API}/zone-manager/community-business/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ communityId, businessId })
        });
        const data = await res.json();
        if (data.success) { zmShowToast('success', 'העסק אושר והצטרף לקהילה!'); zmLoadPendingBiz(); }
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
        if (data.success) { zmShowToast('info', 'הבקשה נדחתה'); zmLoadPendingBiz(); }
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
                            <h4 class="font-bold text-slate-800 text-sm text-right">${c.name}</h4>
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
    document.getElementById('zm-appoint-list').innerHTML = '<p class="text-slate-400 text-sm text-center py-4">הקלד לחיפוש</p>';
    document.getElementById('zm-appoint-modal').classList.remove('hidden');
}

async function zmSearchMembers() {
    const q = document.getElementById('zm-appoint-search').value.trim();
    if (q.length < 2) return;
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
}

// ============================================================
// LEADS
// ============================================================

async function loadLeadsTab() {
    const wrap = document.getElementById('zm-leads-campaign-select-wrap');
    const list = document.getElementById('zm-leads-list');
    try {
        const res = await fetch(`${API}/zone-manager/campaigns`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        zmCampaigns = data.campaigns || [];
        if (!zmCampaigns.length) {
            wrap.innerHTML = '';
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
    list.innerHTML = '<div class="text-center text-slate-400 py-4">טוען לידים...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/campaigns/${campId}/leads`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        if (!data.success || !data.leads.length) {
            list.innerHTML = `<div class="text-center text-slate-400 py-8"><i class="fa-solid fa-user-slash text-3xl text-slate-200 mb-3 block"></i>אין לידים עדיין לקמפיין זה</div>`;
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
        <div class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <div class="flex justify-between items-start">
                <div class="flex flex-col gap-1.5 items-start">
                    <button onclick="openLeadCRMWithData(${l.id}, window._zmLeadsCache?.find(x=>x.id===${l.id})||{})" class="text-xs font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition">ניהול</button>
                    ${score !== null && score !== undefined ? `<span class="text-xs font-black px-2 py-0.5 rounded-full ${scoreColor}">AI: ${score}/10</span>` : ''}
                    <span class="text-[10px] text-slate-400">${new Date(l.created_at).toLocaleDateString('he-IL')}</span>
                </div>
                <div class="text-right">
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

    const LEAD_FIELD_LABELS = { name:'שם פרטי', last_name:'שם משפחה', business_name:'שם עסק', address:'כתובת', city:'עיר', phone:'טלפון', email:'מייל', free_text:'הודעה חופשית' };
    const fields = Object.entries(lead.data || {}).map(([k,v]) => {
        if (!v) return '';
        const label = LEAD_FIELD_LABELS[k] || k;
        if (k === 'free_text') return `<div class="mt-2"><div class="text-slate-400 text-xs mb-1">${label}</div><div class="bg-slate-50 rounded-lg p-2 text-sm text-slate-700 whitespace-pre-wrap border border-slate-100">${v}</div></div>`;
        return `<div class="flex justify-between gap-2"><span class="text-slate-400 text-xs">${label}</span><span class="font-bold text-slate-700 text-sm">${v}</span></div>`;
    }).filter(Boolean).join('');
    document.getElementById('zm-lead-crm-data').innerHTML = fields || '<p class="text-slate-400 text-xs">אין נתונים</p>';

    document.getElementById('zm-lead-actions-list').innerHTML = '<div class="text-slate-400 text-xs text-center py-2">טוען...</div>';
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}/actions`, { headers: { 'Authorization': zmToken } });
        const data = await res.json();
        renderLeadCRMActions(data.actions || []);
    } catch(e) {}
}

function renderLeadCRMActions(actions) {
    const list = document.getElementById('zm-lead-actions-list');
    if (!actions.length) { list.innerHTML = '<p class="text-slate-400 text-xs text-center py-2">אין פעולות עדיין</p>'; return; }
    const icons = { call:'📞', whatsapp:'💬', meeting:'🤝', email:'✉️', other:'📝' };
    list.innerHTML = actions.map(a => `
        <div class="flex justify-between items-center bg-white rounded-xl px-3 py-2 border border-slate-100">
            <span class="text-[10px] text-slate-400">${new Date(a.created_at).toLocaleDateString('he-IL')}</span>
            <div class="text-right">
                <span class="text-xs font-bold text-slate-700">${icons[a.action_type] || '📝'} ${a.action_type}</span>
                ${a.notes ? `<p class="text-[11px] text-slate-400">${a.notes}</p>` : ''}
            </div>
        </div>`).join('');
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
    const notes = prompt(`הוסף הערה ל${actionType === 'call' ? 'שיחה' : actionType === 'whatsapp' ? 'ווצאפ' : actionType === 'meeting' ? 'פגישה' : 'מייל'} (אופציונלי):`);
    if (notes === null) return;
    try {
        const res = await fetch(`${API}/zone-manager/leads/${leadId}/actions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': zmToken },
            body: JSON.stringify({ action_type: actionType, notes: notes || null })
        });
        const data = await res.json();
        if (data.success) {
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
