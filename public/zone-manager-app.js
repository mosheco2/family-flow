const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
let zmToken = null;
let zmManager = null;
let zmData = null;

window.onload = () => {
    const saved = localStorage.getItem('zm_token');
    const savedMgr = localStorage.getItem('zm_manager');
    if (saved && savedMgr) {
        zmToken = saved;
        zmManager = JSON.parse(savedMgr);
        showDashboard();
        loadDashboard();
    }
};

async function zmLogin() {
    const email = document.getElementById('zm-login-email').value;
    const pass = document.getElementById('zm-login-pass').value;
    const err = document.getElementById('zm-login-err');
    err.classList.add('hidden');
    try {
        const res = await fetch(`${API}/zone-manager/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });
        const data = await res.json();
        if (!data.success) { err.textContent = data.error || 'שגיאת כניסה'; err.classList.remove('hidden'); return; }
        zmToken = data.token;
        zmManager = data.manager;
        localStorage.setItem('zm_token', zmToken);
        localStorage.setItem('zm_manager', JSON.stringify(zmManager));
        showDashboard();
        loadDashboard();
    } catch(e) { err.textContent = 'שגיאת תקשורת'; err.classList.remove('hidden'); }
}

function zmLogout() {
    localStorage.removeItem('zm_token');
    localStorage.removeItem('zm_manager');
    zmToken = null; zmManager = null; zmData = null;
    document.getElementById('zm-login').classList.remove('hidden');
    document.getElementById('zm-dashboard').classList.add('hidden');
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
        // stats
        const totalComm = parseFloat(data.commissions?.total || 0);
        const monthComm = parseFloat(data.commissions?.month || 0);
        document.getElementById('zm-stat-zones').textContent = data.zones?.length || 0;
        document.getElementById('zm-stat-communities').textContent = data.communities?.length || 0;
        document.getElementById('zm-stat-comm-total').textContent = '₪' + totalComm.toFixed(2);
        document.getElementById('zm-stat-comm-month').textContent = '₪' + monthComm.toFixed(2);
        renderZones(data);
    } catch(e) { console.error('Dashboard load error', e); }
}

function zmSwitchTab(tab) {
    ['zones','commissions'].forEach(t => {
        document.getElementById(`zmview-${t}`).classList.add('hidden');
        document.getElementById(`zmtab-${t}`).classList.remove('active');
    });
    document.getElementById(`zmview-${tab}`).classList.remove('hidden');
    document.getElementById(`zmtab-${tab}`).classList.add('active');
    if (tab === 'commissions') loadCommissions();
}

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
                return `
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-xs px-2 py-0.5 rounded-full font-bold ${allOk ? 'badge-ok' : 'badge-warn'}">${allOk ? '✓ פעילה' : '⏳ בהתפתחות'}</span>
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
