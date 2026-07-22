/* ═══════════════════════════════════════════════════════════════════
   sa-v2-app.js  —  SuperAdmin v2 logic layer (runs after sa-app.js)
═══════════════════════════════════════════════════════════════════ */

/* ─── HELPERS ─────────────────────────────────────────────────── */

function v2Fmt(n) {
  n = parseFloat(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return Math.round(n).toLocaleString('he-IL');
}

function v2ILS(n) {
  n = parseFloat(n) || 0;
  if (n >= 1000000) return '₪' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000)    return '₪' + (n / 1000).toFixed(0) + 'K';
  return '₪' + Math.round(n).toLocaleString('he-IL');
}

function v2Set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function v2Token() { return localStorage.getItem('ofl_sa_token') || ''; }

/* avatar colors cycle */
const AVATAR_COLORS = [
  ['#0e7490','rgba(6,182,212,0.15)'], ['#0d9488','rgba(16,185,129,0.15)'],
  ['#7c3aed','rgba(139,92,246,0.15)'], ['#b45309','rgba(245,158,11,0.15)'],
  ['#b91c1c','rgba(244,63,94,0.15)'], ['#1d4ed8','rgba(59,130,246,0.15)'],
];
function v2Avatar(name, idx) {
  const [fg, bg] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const initials = (name || '?').trim().slice(0, 2);
  return `<div class="comm-avatar" style="background:${bg};color:${fg}">${initials}</div>`;
}

/* ─── NAVIGATION ──────────────────────────────────────────────── */

const V2_NAV_TITLES = {
  pulse:'מרכז בקרה', clients:'משפחות', biz:'עסקים', comm:'קהילות',
  finance:'פיננסים', stats:'דוחות', support:'מרכז תמיכה', hr:'צוות ונציגים',
  partners:'שותפים', devops:'פיתוח ומוצר', content:'תוכן ושיווק',
  games:'משחקי ילדים', auditlog:'לוג אירועים', inbox:'שיווק', legal:'משפטי',
  templates:'תבניות עסקים', adslots:'שטחי פרסום', sysmap:'מפת המערכת',
  archive:'ארכיון', feed:'פיד קהילתי', dashboard:'ספר מוצר',
};

window.v2NavTo = function(tabId, btnEl) {
  /* update sidebar active state */
  document.querySelectorAll('.sb-nav-item').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  /* update topbar title */
  v2Set('sa-topbar-title', V2_NAV_TITLES[tabId] || tabId);

  /* call original sa-app.js tab switcher */
  if (typeof window.switchSATab === 'function') window.switchSATab(tabId);

  /* ensure data is loaded for tabs whose loaders aren't triggered by switchSATab */
  if (tabId === 'clients'  && typeof window.loadSAData     === 'function') window.loadSAData();
  if (tabId === 'support'  && typeof window.loadSATickets  === 'function') window.loadSATickets();
  if (tabId === 'comm'     && typeof window.loadSACommunities === 'function') window.loadSACommunities();
  if (tabId === 'biz'      && typeof window.loadSACommunityData === 'function') window.loadSACommunityData();
  if (tabId === 'hr'       && typeof window.loadSAHRData   === 'function') window.loadSAHRData();
  if (tabId === 'partners' && typeof window.loadSAPartners === 'function') window.loadSAPartners();
  if (tabId === 'auditlog' && typeof window.loadAuditLog   === 'function') window.loadAuditLog();
  if (tabId === 'archive'  && typeof window.loadArchive    === 'function') window.loadArchive();
  if (tabId === 'content'  && typeof window.loadSAArticles === 'function') window.loadSAArticles();
  if (tabId === 'inbox'    && typeof window.loadSABizFeedSection === 'function') window.loadSABizFeedSection();

  /* mobile: close sidebar */
  if (window.innerWidth < 768) {
    const sb = document.getElementById('sa-sidebar');
    const bd = document.getElementById('sa-sidebar-backdrop');
    if (sb) sb.classList.remove('sidebar-open');
    if (bd) bd.style.display = 'none';
  }
};

/* ─── DASHBOARD LOADER ────────────────────────────────────────── */

window.loadDashboardV2 = async function() {
  const icon = document.getElementById('v2-refresh-icon');
  if (icon) icon.style.animation = 'spin 0.8s linear infinite';

  try {
    const [dashRes, dataRes, commRes] = await Promise.all([
      fetch('/api/sa/dashboard',    { headers: { 'Authorization': v2Token() } }),
      fetch('/api/superadmin/data', { headers: { 'Authorization': v2Token() } }),
      fetch('/api/sa/communities',  { headers: { 'Authorization': v2Token() } }),
    ]);

    const dash = dashRes.ok ? await dashRes.json() : {};
    const data = dataRes.ok ? await dataRes.json() : {};
    const commData = commRes.ok ? await commRes.json() : {};

    if (!dashRes.ok) console.warn('[v2 dash] /api/sa/dashboard status:', dashRes.status);
    if (!dataRes.ok) console.warn('[v2 dash] /api/superadmin/data status:', dataRes.status);

    const s   = dash.stats   || data.stats || {};
    const pnd = dash.pending || {};
    const fl  = dash.flow    || {};
    const comms = commData.communities || [];

    /* ── KPI 1: Tickets ── */
    v2Set('v2-kpi-tickets', v2Fmt(pnd.open_tickets || 0));
    v2Set('v2-kpi-closed24', v2Fmt(pnd.closed_24h  || 0));
    v2Set('v2-kpi-urgent',   v2Fmt(pnd.urgent_tickets || 0));

    /* badge in sidebar */
    const badge = document.getElementById('v2-nav-badge-support');
    if (badge) {
      const cnt = parseInt(pnd.open_tickets) || 0;
      if (cnt > 0) { badge.textContent = cnt > 99 ? '99+' : cnt; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    }

    /* ── KPI 2: FLOW economy ── */
    const issued   = parseFloat(fl.total_issued)   || 0;
    const redeemed = parseFloat(fl.total_redeemed) || 0;
    v2Set('v2-kpi-flow',          v2ILS(issued));
    v2Set('v2-kpi-flow-issued',   v2ILS(issued));
    v2Set('v2-kpi-flow-redeemed', v2ILS(redeemed));

    /* ── KPI 3: Users ── */
    const totalUsers = parseInt(s.total_users) || 0;
    const families   = parseInt(s.families)    || 0;
    const businesses = parseInt(s.businesses)  || 0;
    v2Set('v2-kpi-users',    v2Fmt(totalUsers));
    v2Set('v2-kpi-families', v2Fmt(families));
    v2Set('v2-kpi-biz',      v2Fmt(businesses));

    /* week growth badge: compare fam+biz 24h vs total */
    const new24h = (parseInt(s.fam_24h) || 0) + (parseInt(s.biz_24h) || 0);
    const weekBadge = document.getElementById('v2-kpi-week-badge');
    if (weekBadge && totalUsers > 0) {
      const pct = ((new24h / totalUsers) * 100).toFixed(1);
      weekBadge.textContent = '+' + pct + '% היום';
    }

    /* ── KPI 4: Online now ── */
    v2Set('v2-kpi-online',       v2Fmt(s.online_now   || s.onlineNow || 0));
    v2Set('v2-kpi-comms',        v2Fmt(s.communities  || 0));
    v2Set('v2-kpi-connections',  v2Fmt(s.connections  || 0));

    /* ── Communities table ── */
    /* build FLOW wallet index from wallets_top */
    const walletIndex = {};
    (dash.wallets_top || []).forEach(w => { walletIndex[w.name] = parseFloat(w.balance) || 0; });

    const tbody = document.getElementById('v2-comm-tbody');
    if (tbody) {
      if (comms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#1e293b;font-size:0.75rem">אין קהילות במערכת</td></tr>';
      } else {
        tbody.innerHTML = comms.slice(0, 10).map((c, i) => {
          const statusPill = c.status === 'active'
            ? '<span class="pill pill-active"><i class="fa-solid fa-circle" style="font-size:5px"></i> פעיל</span>'
            : c.status === 'pending'
            ? '<span class="pill pill-pending">ממתין</span>'
            : '<span class="pill pill-inactive">' + (c.status || 'לא פעיל') + '</span>';

          const flow = walletIndex[c.name];
          const flowCell = flow ? v2ILS(flow) : '--';

          return `<tr>
            <td>
              <div style="display:flex;align-items:center;gap:0.6rem">
                ${v2Avatar(c.name, i)}
                <div>
                  <div class="comm-name">${c.name || '—'}</div>
                  ${c.city ? `<div style="font-size:0.65rem;color:#334155">${c.city}</div>` : ''}
                </div>
              </div>
            </td>
            <td>${statusPill}</td>
            <td style="font-size:0.75rem;color:#64748b">
              <span style="color:#60a5fa;font-weight:700">${v2Fmt(c.family_count || 0)}</span> •
              <span style="color:#34d399;font-weight:700">${v2Fmt(c.business_count || 0)}</span>
            </td>
            <td style="font-weight:700;color:#f59e0b;font-variant-numeric:tabular-nums">${flowCell}</td>
          </tr>`;
        }).join('');
      }
    }

  } catch(e) {
    console.error('[v2 dashboard]', e);
  } finally {
    if (icon) icon.style.animation = '';
  }
};

/* spin animation */
const _spinStyle = document.createElement('style');
_spinStyle.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
document.head.appendChild(_spinStyle);

/* ─── OVERRIDE sa-app.js hooks ────────────────────────────────── */

window.loadSADashboard   = () => window.loadDashboardV2();
window.updateSADashboard = () => window.loadDashboardV2();

/* ─── helper: pop modal above stacking context ─────────────────── */
function v2ShowModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal || modal.classList.contains('hidden')) return;
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:999999;';
  /* ensure toast stays on top of modal */
  const toast = document.getElementById('toast');
  if (toast) { document.body.appendChild(toast); toast.style.zIndex = '9999999'; }
}

/* ─── PATCH: modals that need stacking-context escape ──────────── */
(function patchModals() {
  /* ticket modal */
  const _origTicket = window.openSATicketModal;
  window.openSATicketModal = async function(id) {
    if (!_origTicket) return;
    try { _origTicket(id); } catch(e) { console.error('[v2] openSATicketModal threw:', e); }
    const modal = document.getElementById('sa-ticket-modal');
    if (modal && modal.classList.contains('hidden') && typeof window.loadSATickets === 'function') {
      await window.loadSATickets();
      try { _origTicket(id); } catch(e) {}
    }
    v2ShowModal('sa-ticket-modal');
  };

  /* group edit modal */
  const _origGroup = window.openSAEditGroupModal;
  window.openSAEditGroupModal = async function(id, name, email) {
    if (!_origGroup) return;
    try { _origGroup(id, name, email); } catch(e) { console.error('[v2] openSAEditGroupModal threw:', e); }
    const modal = document.getElementById('sa-edit-group-modal');
    if (modal && modal.classList.contains('hidden') && typeof window.loadSAData === 'function') {
      await window.loadSAData();
      try { _origGroup(id, name, email); } catch(e) {}
    }
    v2ShowModal('sa-edit-group-modal');
  };

  /* new ticket modal */
  const _origNewTicket = window.openNewTicketModal;
  window.openNewTicketModal = function() {
    if (_origNewTicket) try { _origNewTicket(); } catch(e) { console.error('[v2] openNewTicketModal threw:', e); }
    v2ShowModal('sa-new-ticket-modal');
  };
})();

/* ─── DIAGNOSTICS ─────────────────────────────────────────────── */

window._v2DiagSupport = async function() {
  const tbody = document.getElementById('sa-tickets-table-body');
  const rowCount = tbody ? tbody.querySelectorAll('tr').length : -1;
  const spinner = tbody ? tbody.innerHTML.includes('fa-spin') : null;
  const token = localStorage.getItem('ofl_sa_token') || '';
  const modal = document.getElementById('sa-ticket-modal');

  let apiStatus = '?';
  try {
    const r = await fetch('/api/superadmin/tickets', { headers: { 'Authorization': token } });
    apiStatus = r.status + ' ' + (r.ok ? 'OK' : 'ERROR');
    if (r.ok) {
      const d = await r.json();
      apiStatus += ' | ' + (d.tickets ? d.tickets.length + ' tickets' : JSON.stringify(d).slice(0,60));
    }
  } catch(e) { apiStatus = 'FETCH ERROR: ' + e.message; }

  alert(
    'שורות בטבלה: ' + rowCount + '\n' +
    'ספינר פעיל: ' + spinner + '\n' +
    'טוקן: ' + (token ? token.slice(0,20) + '...' : 'אין') + '\n' +
    'מודל קיים: ' + !!modal + '\n' +
    'API: ' + apiStatus
  );
};

/* ─── GLOBAL SEARCH ───────────────────────────────────────────── */

const SEARCH_MAP = [
  { label:'מרכז בקרה',           tab:'pulse',    btn:'v2-nav-pulse' },
  { label:'משפחות',              tab:'clients',  btn:'v2-nav-clients' },
  { label:'עסקים',               tab:'biz',      btn:'v2-nav-biz' },
  { label:'קהילות',              tab:'comm',     btn:'v2-nav-comm' },
  { label:'פיננסים',             tab:'finance',  btn:'v2-nav-finance' },
  { label:'דוחות',               tab:'stats',    btn:'v2-nav-stats' },
  { label:'מרכז תמיכה',          tab:'support',  btn:'v2-nav-support' },
  { label:'צוות ונציגים',        tab:'hr',       btn:'v2-nav-hr' },
  { label:'שותפים',              tab:'partners', btn:'v2-nav-partners' },
  { label:'פיתוח ומוצר',         tab:'devops',   btn:'v2-nav-devops' },
  { label:'תוכן ושיווק',         tab:'content',  btn:'v2-nav-content' },
  { label:'משחקי ילדים',         tab:'games',    btn:'v2-nav-games' },
  { label:'לוג אירועים',         tab:'auditlog', btn:'v2-nav-auditlog' },
  { label:'שיווק והשקות',        tab:'inbox',    btn:null },
  { label:'מסמכים משפטיים',      tab:'legal',    btn:null },
  { label:'תבניות עסקים',        tab:'templates',btn:null },
  { label:'שטחי פרסום',          tab:'adslots',  btn:null },
  { label:'מפת המערכת',          tab:'sysmap',   btn:null },
  { label:'ארכיון',              tab:'archive',  btn:null },
  { label:'פיד קהילתי',          tab:'feed',     btn:null },
];

(function initSearch() {
  const inputId = 'v2-global-search';
  const ddId    = 'v2-search-dd';

  function renderDD(q) {
    const dd = document.getElementById(ddId);
    if (!dd) return;
    if (!q) { dd.classList.add('hidden'); dd.innerHTML = ''; return; }
    const hits = SEARCH_MAP.filter(m => m.label.includes(q));
    if (!hits.length) { dd.classList.add('hidden'); return; }
    dd.innerHTML = hits.slice(0, 6).map(m =>
      `<div class="v2-search-row" data-tab="${m.tab}" data-btn="${m.btn||''}">
        <i class="fa-solid fa-arrow-left" style="color:#06b6d4;font-size:0.65rem"></i>${m.label}
      </div>`
    ).join('');
    dd.classList.remove('hidden');
  }

  function pick(tabId, btnId) {
    const btn = btnId ? document.getElementById(btnId) : null;
    window.v2NavTo(tabId, btn);
    const dd = document.getElementById(ddId);
    if (dd) { dd.classList.add('hidden'); dd.innerHTML = ''; }
    const inp = document.getElementById(inputId);
    if (inp) inp.value = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById(inputId);
    const dd  = document.getElementById(ddId);
    if (!inp || !dd) return;

    inp.addEventListener('input', () => renderDD(inp.value.trim()));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { dd.classList.add('hidden'); inp.value = ''; }
      if (e.key === 'Enter') {
        const first = dd.querySelector('[data-tab]');
        if (first) pick(first.dataset.tab, first.dataset.btn);
      }
    });
    dd.addEventListener('click', e => {
      const row = e.target.closest('[data-tab]');
      if (row) pick(row.dataset.tab, row.dataset.btn);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.v2-search')) { dd.classList.add('hidden'); }
    });
  });
})();

/* ─── MOBILE SIDEBAR ──────────────────────────────────────────── */

window.toggleSASidebar = function() {
  const sb = document.getElementById('sa-sidebar');
  const bd = document.getElementById('sa-sidebar-backdrop');
  if (!sb) return;
  const open = sb.classList.toggle('sidebar-open');
  if (bd) bd.style.display = open ? 'block' : 'none';
};

/* ─── INIT ON DASHBOARD SHOW ──────────────────────────────────── */

(function watchDash() {
  const obs = new MutationObserver(() => {
    const c = document.getElementById('sa-dashboard-container');
    if (c && !c.classList.contains('hidden')) {
      obs.disconnect();
      /* show pulse view */
      window.v2NavTo('pulse', document.getElementById('v2-nav-pulse'));
    }
  });
  obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
})();
