/* ═══════════════════════════════════════════════════════════════════
   sa-v2-app.js  —  SuperAdmin v2 Dashboard Layer
   Runs AFTER sa-app.js. Overrides dashboard loaders + adds v2 UX.
═══════════════════════════════════════════════════════════════════ */

/* ─── HELPERS ──────────────────────────────────────────────────── */

function v2FormatNum(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return n.toLocaleString('he-IL');
}

function v2DateStr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function v2SA_token() {
  return localStorage.getItem('ofl_sa_token') || '';
}

function v2Set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ─── DASHBOARD LOADER ─────────────────────────────────────────── */

window.loadDashboardV2 = async function() {
  try {
    const [dashRes, dataRes] = await Promise.all([
      fetch('/api/sa/dashboard', { headers: { 'x-sa-token': v2SA_token() } }),
      fetch('/api/superadmin/data', { headers: { 'x-sa-token': v2SA_token() } })
    ]);

    const dash = dashRes.ok ? await dashRes.json() : null;
    const data = dataRes.ok ? await dataRes.json() : null;

    /* ── KPIs ── */
    const s = dash?.stats || data?.stats || {};
    v2Set('v2-kpi-families',     v2FormatNum(s.families     || 0));
    v2Set('v2-kpi-biz',          v2FormatNum(s.businesses   || 0));
    v2Set('v2-kpi-communities',  v2FormatNum(s.communities  || 0));
    v2Set('v2-kpi-online',       v2FormatNum(s.onlineNow    || s.online_now || 0));
    v2Set('v2-kpi-users-total',  v2FormatNum(s.total_users  || 0) + ' משתמשים');
    v2Set('v2-kpi-fam-24h',      '+' + v2FormatNum(s.fam_24h || 0) + ' היום');
    v2Set('v2-kpi-biz-24h',      '+' + v2FormatNum(s.biz_24h || 0) + ' היום');

    /* ── Tickets ── */
    const t = dash?.tickets || {};
    v2Set('v2-kpi-tickets',        v2FormatNum(t.open_cnt   || 0));
    v2Set('v2-kpi-tickets-urgent', v2FormatNum(t.urgent_cnt || 0) + ' דחופות');

    /* ── Pending grid ── */
    const pend = dash?.pending || {};
    const pendItems = [
      { label: 'עסקים ממתינים',    val: pend.biz_connections || 0, icon: 'fa-store',         tab: 'biz',     color: '#f59e0b' },
      { label: 'קהילות ממתינות',   val: pend.communities     || 0, icon: 'fa-city',          tab: 'comm',    color: '#8b5cf6' },
      { label: 'קידומים ממתינים',  val: pend.promotions      || 0, icon: 'fa-bullhorn',      tab: 'comm',    color: '#ec4899' },
      { label: 'הצטרפויות ממתינות',val: pend.family_communities || 0, icon: 'fa-users',    tab: 'clients', color: '#06b6d4' },
      { label: 'מנהלי אזורים',     val: pend.zone_managers   || 0, icon: 'fa-map-location-dot', tab: 'partners', color: '#34d399' },
      { label: 'הזמנות באנר',      val: pend.banner_orders   || 0, icon: 'fa-rectangle-ad', tab: 'adslots', color: '#f87171' },
      { label: 'חיוב פתוח',        val: pend.billing         || 0, icon: 'fa-file-invoice-dollar', tab: 'finance', color: '#fbbf24' },
      { label: 'פניות תמיכה',      val: t.open_cnt           || 0, icon: 'fa-headset',       tab: 'support', color: '#a78bfa' },
    ];
    const pg = document.getElementById('v2-pending-grid');
    if (pg) {
      pg.innerHTML = pendItems.map(p => `
        <button onclick="switchSATab('${p.tab}')" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:0.75rem;padding:0.9rem;text-align:center;cursor:pointer;transition:all 0.15s;font-family:Rubik,sans-serif" onmouseover="this.style.borderColor='${p.color}40';this.style.background='${p.color}10'" onmouseout="this.style.borderColor='rgba(255,255,255,0.07)';this.style.background='rgba(255,255,255,0.03)'">
          <i class="fa-solid ${p.icon}" style="color:${p.color};font-size:1.1rem;display:block;margin-bottom:0.4rem"></i>
          <div style="font-size:1.4rem;font-weight:900;color:#f1f5f9;line-height:1;font-variant-numeric:tabular-nums">${v2FormatNum(p.val)}</div>
          <div style="font-size:0.65rem;font-weight:600;color:#64748b;margin-top:0.25rem">${p.label}</div>
        </button>
      `).join('');
    }

    /* ── Communities table ── */
    const comms = dash?.communities || [];
    const tbody = document.getElementById('v2-communities-tbody');
    if (tbody) {
      if (comms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 py-8 text-xs">אין נתוני קהילות</td></tr>';
      } else {
        tbody.innerHTML = comms.slice(0, 10).map(c => {
          const statusPill = c.status === 'active'
            ? '<span class="pill pill-active"><i class="fa-solid fa-circle" style="font-size:6px"></i> פעיל</span>'
            : '<span class="pill pill-pending">ממתין</span>';
          return `<tr>
            <td><span style="font-weight:600;color:#e2e8f0">${c.name || '—'}</span></td>
            <td style="text-align:center">${statusPill}</td>
            <td style="text-align:center;font-variant-numeric:tabular-nums">${v2FormatNum(c.family_count || 0)}</td>
            <td style="text-align:center;font-variant-numeric:tabular-nums">${v2FormatNum(c.business_count || 0)}</td>
          </tr>`;
        }).join('');
      }
    }

    /* ── Recent activity ── */
    const activity = data?.activity || [];
    const atbody = document.getElementById('v2-activity-tbody');
    if (atbody) {
      if (activity.length === 0) {
        atbody.innerHTML = '<tr><td colspan="3" class="text-center text-slate-500 py-8 text-xs">אין פעילות אחרונה</td></tr>';
      } else {
        atbody.innerHTML = activity.slice(0, 12).map(a => `
          <tr>
            <td style="color:#64748b;white-space:nowrap;font-size:0.72rem">${v2DateStr(a.date)}</td>
            <td style="color:#94a3b8;font-size:0.78rem">${a.group_name || '—'}</td>
            <td style="color:#cbd5e1;font-size:0.78rem">${a.description || '—'}</td>
          </tr>
        `).join('');
      }
    }

  } catch(e) {
    console.error('[sa-v2] dashboard load error:', e);
    const tbody = document.getElementById('v2-communities-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6" style="color:#f87171;font-size:0.75rem">שגיאה בטעינת נתונים</td></tr>';
  }
};

/* ─── OVERRIDE sa-app.js dashboard hooks ─────────────────────── */

window.loadSADashboard  = () => window.loadDashboardV2();
window.updateSADashboard = () => window.loadDashboardV2();

/* ─── GREETING + DATE ─────────────────────────────────────────── */

function v2SetGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';
  const name = window.currentSAUser?.name || 'מנהל מערכת';
  v2Set('v2-dash-greeting', `${greeting}, ${name} 👋`);
  v2Set('v2-dash-date', now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
}

/* ─── GLOBAL SEARCH ─────────────────────────────────────────── */

(function initV2Search() {
  const searchMenuItems = [
    { label: 'דופק מערכת',         tab: 'pulse' },
    { label: 'דוחות',              tab: 'stats' },
    { label: 'קהילות',             tab: 'comm' },
    { label: 'עסקים',              tab: 'biz' },
    { label: 'קבוצות',             tab: 'clients' },
    { label: 'פיד קהילתי',         tab: 'feed' },
    { label: 'פיננסים',            tab: 'finance' },
    { label: 'קריאות שירות',       tab: 'support' },
    { label: 'פיתוח ומוצר',        tab: 'devops' },
    { label: 'מיתוג ותוכן',        tab: 'content' },
    { label: 'שיווק',              tab: 'inbox' },
    { label: 'משפטי',              tab: 'legal' },
    { label: 'שטחי פרסום',         tab: 'adslots' },
    { label: 'משחקי ילדים',        tab: 'games' },
    { label: 'נציגים וצוותים',     tab: 'hr' },
    { label: 'שותפים',             tab: 'partners' },
    { label: 'מפת המערכת',         tab: 'sysmap' },
    { label: 'לוג אירועים',        tab: 'auditlog' },
    { label: 'ארכיון',             tab: 'archive' },
    { label: 'תבניות עסקים',       tab: 'templates' },
  ];

  let dropdown = null;

  function buildDropdown(matches) {
    if (dropdown) dropdown.remove();
    if (!matches.length) return;
    const input = document.getElementById('v2-global-search');
    if (!input) return;
    dropdown = document.createElement('div');
    dropdown.style.cssText = 'position:absolute;top:100%;right:0;left:0;background:#1e293b;border:1px solid rgba(6,182,212,0.2);border-radius:0.6rem;margin-top:4px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:9999;overflow:hidden;font-family:Rubik,sans-serif';
    dropdown.innerHTML = matches.slice(0, 6).map(m =>
      `<div data-tab="${m.tab}" style="padding:0.55rem 0.85rem;cursor:pointer;font-size:0.78rem;color:#cbd5e1;display:flex;align-items:center;gap:0.5rem;transition:background 0.1s"
           onmouseover="this.style.background='rgba(6,182,212,0.1)'" onmouseout="this.style.background='transparent'">
        <i class="fa-solid fa-arrow-left" style="color:#06b6d4;font-size:0.65rem"></i>${m.label}
      </div>`
    ).join('');
    dropdown.addEventListener('click', e => {
      const row = e.target.closest('[data-tab]');
      if (row) { window.switchSATab(row.dataset.tab); closeDropdown(); }
    });

    const wrap = input.closest('.v2-search-wrap');
    if (wrap) {
      wrap.style.position = 'relative';
      wrap.appendChild(dropdown);
    }
  }

  function closeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
    const inp = document.getElementById('v2-global-search');
    if (inp) inp.value = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('v2-global-search');
    if (!inp) return;

    inp.addEventListener('input', () => {
      const q = inp.value.trim();
      if (!q) { if (dropdown) dropdown.remove(); dropdown = null; return; }
      const matches = searchMenuItems.filter(m => m.label.includes(q));
      buildDropdown(matches);
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDropdown();
      if (e.key === 'Enter' && dropdown) {
        const first = dropdown.querySelector('[data-tab]');
        if (first) { window.switchSATab(first.dataset.tab); closeDropdown(); }
      }
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.v2-search-wrap')) closeDropdown();
    });
  });
})();

/* ─── SIDEBAR MOBILE TOGGLE (v2 version) ────────────────────── */

window.toggleSASidebar = function() {
  const sb = document.getElementById('sa-sidebar');
  const bd = document.getElementById('sa-sidebar-backdrop');
  if (!sb) return;
  const open = sb.classList.toggle('sidebar-open');
  if (bd) bd.style.display = open ? 'block' : 'none';
};

/* ─── INIT AFTER DOM + AUTH ──────────────────────────────────── */

function v2Init() {
  v2SetGreeting();
  // Auto-navigate to pulse on load
  if (typeof window.switchSATab === 'function') {
    window.switchSATab('pulse');
  }
}

/* Hook into the existing sa-app.js post-auth flow.
   sa-app.js calls updateSADashboard after login — we already override that.
   We also listen for the custom event dispatched by sa-app.js. */
document.addEventListener('sa:authenticated', () => {
  v2SetGreeting();
});

/* Patch: if sa-app.js calls loadSADashboard on DOMContentLoaded path, we're covered.
   As a safety net, watch for dashboard container becoming visible. */
(function watchDashboardReady() {
  const observer = new MutationObserver(() => {
    const c = document.getElementById('sa-dashboard-container');
    if (c && !c.classList.contains('hidden')) {
      v2SetGreeting();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
})();
