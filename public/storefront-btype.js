// ============================================================
// storefront-btype.js — Shared business-type config & modules
// Include in every storefront template (before sc-auth.js)
// ============================================================
(function () {
  'use strict';

  // ----------------------------------------------------------
  // BTYPE_CONFIG — master configuration per business type
  // ----------------------------------------------------------
  window.BTYPE_CONFIG = {
    beauty: {
      modules: ['catalog','appointments','deals','reviews','gallery','flow','popups','complex_builder','upsells','volume_tiers','bundles','ticker','scroll_spy','fulfil','app_badges'],
      bookingType: 'appointment',
      labels: { catalog: 'שירותים', booking: 'קביעת תור', order: 'הזמנה', hero_cta: 'לקביעת תור' }
    },
    restaurant: {
      modules: ['catalog','table_booking','event_booking','deals','reviews','upsells','fulfil','flow','popups','gallery','complex_builder','ticker','scroll_spy','app_badges'],
      bookingType: 'table',
      labels: { catalog: 'תפריט', booking: 'הזמנת שולחן', order: 'הזמנה', hero_cta: 'הזמינו שולחן' }
    },
    cafe: {
      modules: ['catalog','table_booking','deals','reviews','fulfil','flow','popups','gallery','ticker','scroll_spy','app_badges'],
      bookingType: 'table',
      labels: { catalog: 'תפריט', booking: 'הזמנת מקום', order: 'הזמנה', hero_cta: 'הזמינו מקום' }
    },
    sport: {
      modules: ['catalog','schedule','membership','trainer','waiver','event_booking','deals','reviews','gallery','flow','popups','complex_builder','volume_tiers','bundles','ticker','scroll_spy','fulfil','app_badges'],
      bookingType: 'event',
      labels: { catalog: 'פעילויות', booking: 'הרשמה לאימון', order: 'הרשמה', hero_cta: 'לאימון הבא' }
    },
    retail: {
      modules: ['catalog','complex_builder','deals','reviews','gallery','volume_tiers','bundles','quote','professional','flow','popups','ticker','scroll_spy','fulfil','app_badges','radius_delivery'],
      bookingType: null,
      labels: { catalog: 'מוצרים', booking: null, order: 'הזמנה', hero_cta: 'לקניה' }
    }
  };
  // Aliases
  window.BTYPE_CONFIG['other']    = window.BTYPE_CONFIG['retail'];
  window.BTYPE_CONFIG['gym']      = window.BTYPE_CONFIG['sport'];
  window.BTYPE_CONFIG['services'] = window.BTYPE_CONFIG['beauty'];

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  function _getAPI() { return window.API || '/api'; }

  function _showEl(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = '';
    el.classList.remove('hidden');
  }

  function _hideEl(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'none';
    el.classList.add('hidden');
  }

  // ----------------------------------------------------------
  // Flow Widget — auto balance detection from URL / session
  // Guards ensure templates that already define these skip them.
  // ----------------------------------------------------------
  window._flowRedeemParams = window._flowRedeemParams || {
    enabled: false, balance: 0, familyGroupId: null,
    rate: 100, minRedeem: 100, currentAmount: 0, currentDiscount: 0
  };

  if (!window._showFlowWidgetWithServerData) {
    window._showFlowWidgetWithServerData = function (familyGroupId, initialBal) {
      var p = window._flowRedeemParams;
      p.enabled = true;
      p.balance = initialBal || 0;
      p.familyGroupId = String(familyGroupId);
      p.currentAmount = 0;
      p.currentDiscount = 0;
      var section = document.getElementById('flow-redeem-section');
      if (section) {
        var labelEl = document.getElementById('flow-redeem-balance-label');
        if (labelEl) labelEl.textContent = '⚡ יתרה: ' + Math.floor(initialBal) + ' Flw';
        var input = document.getElementById('flow-redeem-input');
        if (input) { input.max = Math.floor(initialBal); input.min = 0; input.value = 0; }
        var hintEl = document.getElementById('flow-redeem-hint');
        if (hintEl) hintEl.textContent = 'כל 100 Flw = ₪10 הנחה · מינימום 100 Flw';
        _showEl('flow-redeem-section');
      }
      fetch(_getAPI() + '/flow/wallet/family/' + familyGroupId)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          p.rate = parseFloat(d.rate || 100);
          p.minRedeem = parseFloat(d.min_redeem || 100);
          p.balance = parseFloat(d.balance || initialBal);
          var bal = p.balance;
          var lbl = document.getElementById('flow-redeem-balance-label');
          if (lbl) lbl.textContent = '⚡ יתרה: ' + Math.floor(bal) + ' Flw';
          var inp = document.getElementById('flow-redeem-input');
          if (inp) inp.max = Math.floor(bal);
          var hint = document.getElementById('flow-redeem-hint');
          if (hint) hint.textContent = 'כל ' + p.rate + ' Flw = ₪10 הנחה · מינימום ' + p.minRedeem + ' Flw';
          if (bal <= 0) _hideEl('flow-redeem-section');
        })
        .catch(function () {});
    };
  }

  if (!window.onFlowRedeemInput) {
    window.onFlowRedeemInput = function () {
      var input = document.getElementById('flow-redeem-input');
      if (!input) return;
      var p = window._flowRedeemParams;
      var bal = Math.floor(p.balance || 0);
      var v = parseInt(input.value) || 0;
      if (v < 0) v = 0;
      if (v > bal) { v = bal; input.value = bal; }
      var rate = p.rate || 100;
      var ils = Math.round((v / rate) * 10 * 100) / 100;
      var el = document.getElementById('flow-redeem-ils');
      if (el) el.textContent = '₪' + ils.toFixed(2);
      p.currentAmount = v;
      p.currentDiscount = ils;
      if (window.updateCartFooter) window.updateCartFooter();
      if (window.renderCartSummary) window.renderCartSummary();
    };
  }

  if (!window.clearFlowRedeem) {
    window.clearFlowRedeem = function () {
      var p = window._flowRedeemParams;
      p.currentAmount = 0;
      p.currentDiscount = 0;
      var input = document.getElementById('flow-redeem-input');
      if (input) input.value = 0;
      var el = document.getElementById('flow-redeem-ils');
      if (el) el.textContent = '₪0';
      _hideEl('flow-redeem-section');
      if (window.updateCartFooter) window.updateCartFooter();
      if (window.renderCartSummary) window.renderCartSummary();
    };
  }

  function _applyFlowRedeemWidget() {
    var urlP = new URLSearchParams(window.location.search);
    var flowRedeem = parseInt(urlP.get('flowRedeem') || '0');
    var familyGroupIdParam = urlP.get('familyGroupId');

    if (flowRedeem && familyGroupIdParam) {
      window._showFlowWidgetWithServerData(familyGroupIdParam, flowRedeem);
      return;
    }

    try {
      var communityId = urlP.get('communityId');
      if (!communityId) return;
      var session = JSON.parse(localStorage.getItem('ofl_session'));
      if (!session || !session.group || session.group.type !== 'FAMILY' || !session.group.id) return;
      var familyGroupId = session.group.id;
      fetch(_getAPI() + '/flow/wallet/family/' + familyGroupId)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var bal = parseFloat(d.balance || 0);
          if (bal <= 0) return;
          window._showFlowWidgetWithServerData(familyGroupId, bal);
          window._flowRedeemParams.rate = parseFloat(d.rate || 100);
          window._flowRedeemParams.minRedeem = parseFloat(d.min_redeem || 100);
        })
        .catch(function () {});
    } catch (e) {}
  }

  // Expose for templates that already handle flow (storefront.html sets window._initFlowRedeemWidget)
  if (!window._initFlowRedeemWidget) {
    window._initFlowRedeemWidget = _applyFlowRedeemWidget;
  }

  // ----------------------------------------------------------
  // Store Popups
  // ----------------------------------------------------------
  if (!window.loadStorePopups) {
    window.loadStorePopups = async function () {
      if (!window.storeData || !window.storeData.groupId) return;
      try {
        var res = await fetch(_getAPI() + '/public/store-popups/' + window.storeData.groupId);
        var data = await res.json();
        if (!data.success || !data.popups || data.popups.length === 0) return;
        setTimeout(function () { window.showStorePopup(data.popups[0]); }, 1200);
      } catch (e) {}
    };
  }

  if (!window.showStorePopup) {
    window.showStorePopup = function (popup) {
      var modal = document.getElementById('store-popup-modal');
      if (!modal) return;
      var titleEl = document.getElementById('store-popup-title');
      var contentEl = document.getElementById('store-popup-content');
      var imgWrap = document.getElementById('store-popup-img-wrap');
      var img = document.getElementById('store-popup-img');
      if (titleEl) titleEl.textContent = popup.title || '';
      if (contentEl) contentEl.textContent = popup.content || '';
      if (imgWrap && img) {
        if (popup.image_base64) { img.src = popup.image_base64; imgWrap.style.display = ''; }
        else { imgWrap.style.display = 'none'; }
      }
      var btn = document.getElementById('store-popup-btn');
      if (btn) btn.style.display = 'none';
      _showEl('store-popup-modal');
    };
  }

  if (!window.closeStorePopup) {
    window.closeStorePopup = function () {
      _hideEl('store-popup-modal');
    };
  }

  // ----------------------------------------------------------
  // Sport module injection — creates modals + exposes functions
  // for templates that don't include sport-specific HTML
  // ----------------------------------------------------------
  function _injectSportModals() {
    if (document.getElementById('schedule-modal')) return; // already present
    var API = _getAPI();

    // ── HTML for all 3 sport modals ──
    var html = [
      // Schedule modal
      '<div id="schedule-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);align-items:flex-end;justify-content:center">',
      '<div style="background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:520px;padding:20px 20px 36px;max-height:88vh;overflow-y:auto">',
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">',
      '<button onclick="document.getElementById(\'schedule-modal\').style.display=\'none\'" style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;font-size:16px">✕</button>',
      '<h3 style="flex:1;text-align:right;font-size:18px;font-weight:700;color:#1e293b;margin:0">📋 לוח שיעורים</h3>',
      '</div>',
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">',
      '<button id="sched-next" onclick="window.schedNav(7)" style="padding:6px 14px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#475569">הבא ›</button>',
      '<span id="sched-range" style="font-size:13px;font-weight:600;color:#475569"></span>',
      '<button id="sched-prev" onclick="window.schedNav(-7)" disabled style="padding:6px 14px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#475569">‹ הקודם</button>',
      '</div>',
      '<div id="sched-list" style="min-height:80px"></div>',
      '</div></div>',

      // Class registration modal
      '<div id="class-reg-modal" style="display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);align-items:center;justify-content:center">',
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:400px;padding:24px 20px">',
      '<h3 id="crm-title" style="font-size:17px;font-weight:700;color:#1e293b;margin:0 0 6px;text-align:right"></h3>',
      '<div id="crm-info" style="font-size:13px;color:#64748b;margin-bottom:14px;text-align:right"></div>',
      '<div id="crm-capacity-warn" style="display:none;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:600;margin-bottom:12px;text-align:right">אין מקומות — תירשם לרשימת המתנה</div>',
      '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">',
      '<input id="crm-name" type="text" placeholder="שם מלא *" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-size:14px;text-align:right;width:100%;box-sizing:border-box"/>',
      '<input id="crm-phone" type="tel" placeholder="טלפון *" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-size:14px;direction:ltr;text-align:center;width:100%;box-sizing:border-box"/>',
      '</div>',
      '<div id="crm-success" style="display:none;text-align:center;padding:12px 0">',
      '<div style="font-size:36px;margin-bottom:8px">✅</div>',
      '<p id="crm-success-msg" style="font-weight:700;color:#16a34a;font-size:15px"></p>',
      '</div>',
      '<div style="display:flex;gap:10px">',
      '<button onclick="document.getElementById(\'class-reg-modal\').style.display=\'none\'" style="flex:1;padding:12px;background:#f1f5f9;border:none;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;color:#475569">סגור</button>',
      '<button id="crm-submit-btn" onclick="window.submitClassReg()" style="flex:2;padding:12px;background:#6366f1;color:#fff;border:none;border-radius:12px;cursor:pointer;font-size:14px;font-weight:700">הרשמה</button>',
      '</div></div></div>',

      // Membership modal
      '<div id="membership-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);align-items:flex-end;justify-content:center">',
      '<div style="background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:480px;padding:20px 20px 36px;max-height:88vh;overflow-y:auto">',
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">',
      '<button onclick="document.getElementById(\'membership-modal\').style.display=\'none\'" style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;font-size:16px">✕</button>',
      '<h3 style="flex:1;text-align:right;font-size:18px;font-weight:700;color:#1e293b;margin:0">🏋️ הצטרף כחבר</h3>',
      '</div>',
      '<div id="mem-step1"><p style="text-align:right;font-size:13px;color:#64748b;margin-bottom:12px">בחר סוג מנוי:</p><div id="mem-types-list" style="display:flex;flex-direction:column;gap:10px"></div></div>',
      '<div id="mem-step2" style="display:none">',
      '<div id="mem-type-badge" style="text-align:right;font-weight:600;color:#1e293b;font-size:14px;margin-bottom:16px"></div>',
      '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">',
      '<input id="mem-name" type="text" placeholder="שם מלא *" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-size:14px;text-align:right;width:100%;box-sizing:border-box"/>',
      '<input id="mem-phone" type="tel" placeholder="טלפון *" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-size:14px;direction:ltr;text-align:center;width:100%;box-sizing:border-box"/>',
      '<input id="mem-email" type="email" placeholder="אימייל (אופציונלי)" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-size:14px;text-align:right;width:100%;box-sizing:border-box"/>',
      '<textarea id="mem-health" rows="2" placeholder="הערות רפואיות (אופציונלי)" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-size:13px;text-align:right;resize:none;width:100%;box-sizing:border-box"></textarea>',
      '<input id="mem-emergency-name" type="text" placeholder="שם ליצירת קשר חירום" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-size:14px;text-align:right;width:100%;box-sizing:border-box"/>',
      '<input id="mem-emergency-phone" type="tel" placeholder="טלפון חירום" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:11px;font-size:14px;direction:ltr;text-align:center;width:100%;box-sizing:border-box"/>',
      '</div>',
      '<div id="mem-waiver-block" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px;margin-bottom:12px">',
      '<p id="mem-waiver-text" style="font-size:12px;color:#374151;text-align:right;margin-bottom:8px"></p>',
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="mem-waiver-agree" type="checkbox" style="width:16px;height:16px"><span style="font-size:12px;font-weight:600;color:#dc2626">אני מאשר/ת את ההצהרה</span></label>',
      '</div>',
      '<button onclick="window.submitMembership()" style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;box-sizing:border-box">הרשם/י</button>',
      '</div>',
      '<div id="mem-step3" style="display:none;text-align:center;padding:24px 0"><div style="font-size:56px;margin-bottom:12px">✅</div><h3 style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:8px">נרשמת בהצלחה!</h3><p style="color:#64748b;font-size:14px;margin-bottom:20px">ברוכ/ה הבא/ה! הפרטים נקלטו.</p><button onclick="document.getElementById(\'membership-modal\').style.display=\'none\'" style="padding:12px 28px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">סגור</button></div>',
      '</div></div>',

      // Trainer booking modal
      '<div id="trainer-booking-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);align-items:flex-end;justify-content:center">',
      '<div style="background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:480px;padding:24px 20px 32px;max-height:88vh;overflow-y:auto">',
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">',
      '<button onclick="window.closeTrainerBooking()" style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;font-size:16px">✕</button>',
      '<h3 style="flex:1;text-align:right;font-size:18px;font-weight:700;color:#1e293b;margin:0">📅 הזמנת אימון אישי</h3>',
      '</div>',
      '<div id="tbm-step1"><p style="text-align:right;font-size:13px;color:#64748b;margin-bottom:12px">בחר מאמן/ת:</p><div id="tbm-trainers-list" style="display:flex;flex-direction:column;gap:10px"><div style="text-align:center;color:#94a3b8;font-size:13px;padding:20px">טוען מאמנים...</div></div></div>',
      '<div id="tbm-step2" style="display:none">',
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><button onclick="window.tbmBack()" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;color:#475569">→ חזרה</button><div id="tbm-trainer-badge" style="flex:1;text-align:right;font-weight:600;color:#1e293b;font-size:14px"></div></div>',
      '<div style="margin-bottom:12px"><label style="display:block;text-align:right;font-size:12px;font-weight:600;color:#475569;margin-bottom:4px">תאריך</label><input type="date" id="tbm-date" style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;font-size:14px;text-align:center;box-sizing:border-box" onchange="window.tbmLoadSlots()"/></div>',
      '<div style="margin-bottom:16px"><label style="display:block;text-align:right;font-size:12px;font-weight:600;color:#475569;margin-bottom:8px">שעות פנויות</label><div id="tbm-slots" style="display:flex;flex-wrap:wrap;gap:8px;min-height:40px"><span style="color:#94a3b8;font-size:13px">בחר תאריך לראות שעות</span></div></div>',
      '<button id="tbm-next-btn" onclick="window.tbmGoStep3()" disabled style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;opacity:0.4;box-sizing:border-box">המשך</button>',
      '</div>',
      '<div id="tbm-step3" style="display:none">',
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><button onclick="window.tbmBack2()" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;color:#475569">→ חזרה</button><div id="tbm-summary-badge" style="flex:1;text-align:right;font-weight:600;color:#1e293b;font-size:13px"></div></div>',
      '<div style="display:flex;flex-direction:column;gap:12px">',
      '<input id="tbm-name" type="text" placeholder="שם מלא *" style="border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;font-size:14px;text-align:right;width:100%;box-sizing:border-box"/>',
      '<input id="tbm-phone" type="tel" placeholder="050-0000000" style="border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;font-size:14px;direction:ltr;text-align:center;width:100%;box-sizing:border-box"/>',
      '<input id="tbm-service" type="text" value="אימון אישי" style="border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;font-size:14px;text-align:right;width:100%;box-sizing:border-box"/>',
      '<textarea id="tbm-notes" rows="2" placeholder="הערות..." style="border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;font-size:13px;text-align:right;resize:none;width:100%;box-sizing:border-box"></textarea>',
      '<button onclick="window.tbmSubmit()" style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;box-sizing:border-box">שלח הזמנה</button>',
      '</div></div>',
      '<div id="tbm-step4" style="display:none;text-align:center;padding:24px 0"><div style="font-size:56px;margin-bottom:16px">✅</div><h3 style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:8px">הבקשה נשלחה!</h3><p style="color:#64748b;font-size:14px;margin-bottom:24px">נציג מהמועדון יצור איתך קשר לאישור התור.</p><button onclick="window.closeTrainerBooking()" style="padding:12px 28px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">סגור</button></div>',
      '</div></div>'
    ].join('');

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    // ── Schedule functions ──
    var _schedGroupId = null, _schedOffset = 0;
    function _schedFmt(d) { return d.toLocaleDateString('he-IL',{day:'numeric',month:'short'}); }

    if (!window.openScheduleModal) {
      window.openScheduleModal = function() {
        _injectSportModals();
        _schedGroupId = (window.storeData && (window.storeData.groupId || window.storeData.group_id)) || null;
        _schedOffset = 0;
        document.getElementById('schedule-modal').style.display = 'flex';
        _schedLoad();
      };
    }
    window.schedNav = function(days) { _schedOffset += days; _schedLoad(); };

    async function _schedLoad() {
      var gid = _schedGroupId; if (!gid) return;
      var from = new Date(); from.setDate(from.getDate() + _schedOffset);
      var to = new Date(from); to.setDate(to.getDate() + 6);
      document.getElementById('sched-range').textContent = _schedFmt(from) + ' — ' + _schedFmt(to);
      document.getElementById('sched-prev').disabled = _schedOffset <= 0;
      var list = document.getElementById('sched-list');
      list.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:20px">טוען...</div>';
      try {
        var fromStr = from.toISOString().split('T')[0];
        var toStr = to.toISOString().split('T')[0];
        var d = await fetch('/api/sport/public-schedule/' + gid + '?from=' + fromStr + '&to=' + toStr).then(function(r){return r.json();});
        var classes = d.classes || [];
        if (!classes.length) { list.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:40px 0">אין שיעורים בשבוע זה</div>'; return; }
        var byDate = {};
        classes.forEach(function(c) { var k = (c.class_date||'').split('T')[0]; (byDate[k] = byDate[k]||[]).push(c); });
        var colorMap = {indigo:'#6366f1',purple:'#a855f7',blue:'#3b82f6',green:'#22c55e',red:'#ef4444',orange:'#f97316',pink:'#ec4899',teal:'#14b8a6'};
        list.innerHTML = Object.keys(byDate).sort().map(function(date) {
          var dayLabel = new Date(date+'T12:00:00').toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});
          var rows = byDate[date].map(function(c) {
            var spots = c.capacity - (c.registered_count||0);
            var full = spots <= 0;
            var color = colorMap[c.color] || '#6366f1';
            var timeStr = [c.start_time,c.end_time].filter(Boolean).map(function(t){return t.slice(0,5);}).join(' — ');
            var cJson = JSON.stringify(c).replace(/"/g,'&quot;');
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f8fafc">' +
              '<div style="width:4px;height:48px;border-radius:4px;flex-shrink:0;background:'+color+'"></div>' +
              '<div style="flex:1"><div style="font-weight:700;font-size:14px;color:#1e293b">'+(c.class_name||c.type_name||'שיעור')+'</div>' +
              '<div style="font-size:12px;color:#64748b;margin-top:2px">'+timeStr+(c.trainer_name?' · '+c.trainer_name:'')+'</div>' +
              '<div style="font-size:11px;margin-top:3px;color:'+(full?'#ef4444':'#22c55e')+';font-weight:600">'+(full?'מלא — רשימת המתנה':spots+' מקומות פנויים')+'</div></div>' +
              '<button onclick="window.openClassReg('+cJson+')" style="padding:7px 14px;background:'+(full?'#f1f5f9':'#6366f1')+';color:'+(full?'#64748b':'#fff')+';border:none;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">'+(full?'המתנה':'הרשמה')+'</button></div>';
          }).join('');
          return '<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:700;color:#94a3b8;padding:8px 0 4px;text-align:right">'+dayLabel+'</div>'+rows+'</div>';
        }).join('');
      } catch(e) { list.innerHTML = '<div style="text-align:center;color:#ef4444;font-size:13px;padding:20px">שגיאת טעינה</div>'; }
    }

    // ── Class registration ──
    var _crmClassId = null, _crmIsFull = false;
    window.openClassReg = function(c) {
      _crmClassId = c.id; _crmIsFull = (c.capacity - (c.registered_count||0)) <= 0;
      var timeStr = [c.start_time,c.end_time].filter(Boolean).map(function(t){return t.slice(0,5);}).join(' — ');
      var dateStr = c.class_date ? new Date(c.class_date+'T12:00:00').toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'}) : '';
      document.getElementById('crm-title').textContent = c.class_name || c.type_name || 'שיעור';
      document.getElementById('crm-info').innerHTML = '<div style="font-weight:600;margin-bottom:4px">'+dateStr+' · '+timeStr+'</div>'+(c.trainer_name?'<div>מאמן: '+c.trainer_name+'</div>':'');
      document.getElementById('crm-capacity-warn').style.display = _crmIsFull ? 'block' : 'none';
      document.getElementById('crm-submit-btn').textContent = _crmIsFull ? 'הרשם לרשימת המתנה' : 'הרשם לשיעור';
      document.getElementById('crm-success').style.display = 'none';
      document.getElementById('crm-name').value = '';
      document.getElementById('crm-phone').value = '';
      document.getElementById('class-reg-modal').style.display = 'flex';
    };
    window.submitClassReg = async function() {
      var name = (document.getElementById('crm-name').value||'').trim();
      var phone = (document.getElementById('crm-phone').value||'').trim();
      if (!name||!phone) { alert('שם וטלפון חובה'); return; }
      var gid = window.storeData && (window.storeData.groupId||window.storeData.group_id);
      var btn = document.getElementById('crm-submit-btn');
      btn.disabled = true; btn.textContent = '⏳ שולח...';
      try {
        var r = await fetch('/api/sport/public-class-register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId:gid,classId:_crmClassId,memberName:name,memberPhone:phone})});
        var d = await r.json();
        if (!d.success) { alert(d.message||d.error||'שגיאה'); btn.disabled=false; btn.textContent=_crmIsFull?'הרשם לרשימת המתנה':'הרשם לשיעור'; return; }
        document.getElementById('crm-success').style.display = 'block';
        document.getElementById('crm-success-msg').textContent = d.status==='waitlisted'?'נרשמת לרשימת המתנה (מקום '+d.position+')':'✅ נרשמת בהצלחה!';
        _schedLoad();
      } catch(e) { alert('שגיאת רשת'); btn.disabled=false; }
    };

    // ── Membership ──
    var _memSelectedTypeId = null, _memSelectedType = null;
    if (!window.openMembershipModal) {
      window.openMembershipModal = async function() {
        _injectSportModals();
        _memSelectedTypeId = null;
        var gid = window.storeData && (window.storeData.groupId||window.storeData.group_id);
        document.getElementById('membership-modal').style.display = 'flex';
        _memShowStep(1);
        try {
          var d = await fetch('/api/sport/public-types/' + gid).then(function(r){return r.json();});
          var types = d.types || d.membership_types || [];
          var cMap = {indigo:'#6366f1',purple:'#a855f7',blue:'#3b82f6',green:'#22c55e',red:'#ef4444',orange:'#f97316',pink:'#ec4899',teal:'#14b8a6'};
          var list = document.getElementById('mem-types-list');
          if (!types.length) { list.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:20px">אין מנויים זמינים</div>'; return; }
          list.innerHTML = types.map(function(t) {
            var col = cMap[t.color]||'#6366f1';
            var dur = t.duration_days?(t.duration_days>=365?Math.round(t.duration_days/365)+' שנה':t.duration_days>=30?Math.round(t.duration_days/30)+' חודשים':t.duration_days+' ימים'):'';
            var sess = t.sessions?' · '+t.sessions+' כניסות':'';
            var nm = (t.name||'').replace(/'/g,"\\'");
            return '<button onclick="window.memSelectType('+t.id+',\''+nm+'\')" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border:1.5px solid #e2e8f0;border-radius:14px;background:#fff;cursor:pointer;text-align:right;width:100%;box-sizing:border-box">'+
              '<div style="width:44px;height:44px;border-radius:12px;background:'+col+'20;display:flex;align-items:center;justify-content:center;color:'+col+';font-size:22px;flex-shrink:0">🏋️</div>'+
              '<div style="flex:1"><div style="font-weight:700;color:#1e293b;font-size:15px">'+t.name+'</div><div style="font-size:12px;color:#64748b;margin-top:2px">'+dur+sess+'</div></div>'+
              '<div style="font-size:17px;font-weight:800;color:'+col+'">₪'+parseFloat(t.price||0).toFixed(0)+'</div></button>';
          }).join('');
          var sp = window.storeData&&window.storeData.settings&&window.storeData.settings.sport_settings || {};
          var spObj = typeof sp==='string'?JSON.parse(sp):sp;
          var wb = document.getElementById('mem-waiver-block'), wt = document.getElementById('mem-waiver-text');
          if (spObj.waiver_text&&wb&&wt) { wb.style.display='block'; wt.textContent=spObj.waiver_text; }
        } catch(e) { document.getElementById('mem-types-list').innerHTML = '<div style="color:#ef4444;font-size:13px;text-align:center">שגיאת טעינה</div>'; }
      };
    }
    window.memSelectType = function(id, name) {
      _memSelectedTypeId=id; _memSelectedType=name;
      document.getElementById('mem-type-badge').textContent='📦 '+name;
      _memShowStep(2);
    };
    function _memShowStep(n) { [1,2,3].forEach(function(i){document.getElementById('mem-step'+i).style.display=i===n?'block':'none';}); }
    window.submitMembership = async function() {
      var name=(document.getElementById('mem-name').value||'').trim();
      var phone=(document.getElementById('mem-phone').value||'').trim();
      if (!name||!phone) { alert('שם וטלפון חובה'); return; }
      var wb=document.getElementById('mem-waiver-block');
      if (wb&&wb.style.display!=='none'&&!document.getElementById('mem-waiver-agree').checked) { alert('יש לאשר את הצהרת הכשירות'); return; }
      var gid=window.storeData&&(window.storeData.groupId||window.storeData.group_id);
      try {
        var r=await fetch('/api/sport/public-membership-purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId:gid,memberName:name,memberPhone:phone,memberEmail:(document.getElementById('mem-email').value||'').trim()||null,membershipTypeId:_memSelectedTypeId,healthNotes:(document.getElementById('mem-health').value||'').trim()||null,emergencyContact:(document.getElementById('mem-emergency-name').value||'').trim()||null,emergencyPhone:(document.getElementById('mem-emergency-phone').value||'').trim()||null})});
        var d=await r.json();
        if (!d.success) { alert(d.error||'שגיאה'); return; }
        if (document.getElementById('mem-waiver-agree')&&document.getElementById('mem-waiver-agree').checked&&d.memberId) {
          var sp=window.storeData&&window.storeData.settings&&window.storeData.settings.sport_settings||{};
          var spObj=typeof sp==='string'?JSON.parse(sp):sp;
          fetch('/api/sport/public-sign-declaration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId:gid,membershipId:d.memberId,memberName:name,memberPhone:phone,declarationText:spObj.waiver_text||''})}).catch(function(){});
        }
        _memShowStep(3);
      } catch(e) { alert('שגיאת רשת'); }
    };

    // ── Trainer booking ──
    var _tbmTrainerId=null, _tbmTrainerName=null, _tbmSlotStart=null, _tbmSlotEnd=null;
    if (!window.openTrainerBooking) {
      window.openTrainerBooking = async function() {
        _injectSportModals();
        document.getElementById('trainer-booking-modal').style.display='flex';
        _tbmShowStep(1);
        var gid=window.storeData&&(window.storeData.groupId||window.storeData.group_id);
        if (!gid) return;
        try {
          var d=await fetch('/api/sport/trainers/'+gid).then(function(r){return r.json();});
          var list=document.getElementById('tbm-trainers-list');
          var trainers=(d.trainers||[]).filter(function(t){return t.is_active;});
          if (!trainers.length) { list.innerHTML='<div style="text-align:center;color:#94a3b8;font-size:13px;padding:20px">אין מאמנים זמינים</div>'; return; }
          list.innerHTML=trainers.map(function(t){
            var nm=(t.name||'').replace(/'/g,"\\'"), col=t.color_hex||'#6366f1';
            return '<button onclick="window.tbmSelectTrainer('+t.id+',\''+nm+'\',\''+col+'\')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid #e2e8f0;border-radius:14px;background:#fff;cursor:pointer;text-align:right;width:100%;box-sizing:border-box">'+
              '<div style="width:40px;height:40px;border-radius:50%;background:'+col+';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;flex-shrink:0">'+(t.name||'?')[0]+'</div>'+
              '<div style="flex:1"><div style="font-weight:600;color:#1e293b;font-size:14px">'+(t.name||'')+'</div>'+(t.specialties?'<div style="font-size:12px;color:#64748b;margin-top:2px">'+t.specialties+'</div>':'')+'</div>'+
              '<span style="color:#6366f1;font-size:18px">←</span></button>';
          }).join('');
        } catch(e) { document.getElementById('tbm-trainers-list').innerHTML='<div style="color:#ef4444;font-size:13px;text-align:center">שגיאת טעינה</div>'; }
      };
    }
    window.closeTrainerBooking=function(){document.getElementById('trainer-booking-modal').style.display='none'; _tbmTrainerId=_tbmTrainerName=_tbmSlotStart=_tbmSlotEnd=null;};
    window.tbmSelectTrainer=function(id,name,color){
      _tbmTrainerId=id; _tbmTrainerName=name;
      document.getElementById('tbm-trainer-badge').innerHTML='<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:'+color+';display:inline-block"></span>'+name+'</span>';
      var today=new Date().toISOString().split('T')[0];
      document.getElementById('tbm-date').value=today; document.getElementById('tbm-date').min=today;
      _tbmShowStep(2); window.tbmLoadSlots();
    };
    window.tbmBack=function(){_tbmShowStep(1);}; window.tbmBack2=function(){_tbmShowStep(2);};
    window.tbmLoadSlots=async function(){
      var date=document.getElementById('tbm-date').value;
      var gid=window.storeData&&(window.storeData.groupId||window.storeData.group_id);
      if (!date||!gid||!_tbmTrainerId) return;
      _tbmSlotStart=_tbmSlotEnd=null;
      document.getElementById('tbm-next-btn').disabled=true; document.getElementById('tbm-next-btn').style.opacity='0.4';
      var slotsEl=document.getElementById('tbm-slots');
      slotsEl.innerHTML='<span style="color:#94a3b8;font-size:13px">טוען...</span>';
      try {
        var d=await fetch('/api/sport/availability?groupId='+gid+'&trainerId='+_tbmTrainerId+'&date='+date).then(function(r){return r.json();});
        if (!d.slots||!d.slots.length) { slotsEl.innerHTML='<span style="color:#94a3b8;font-size:13px">אין שעות פנויות</span>'; return; }
        slotsEl.innerHTML=d.slots.map(function(s){return '<button type="button" data-start="'+s.start+'" data-end="'+s.end+'" onclick="window.tbmPickSlot(this,\''+s.time+'\')" style="padding:8px 14px;border:1.5px solid #e2e8f0;border-radius:99px;background:#fff;font-size:13px;font-weight:500;color:#374151;cursor:pointer">'+s.time+'</button>';}).join('');
      } catch(e){slotsEl.innerHTML='<span style="color:#ef4444;font-size:13px">שגיאת טעינה</span>';}
    };
    window.tbmPickSlot=function(btn,time){
      document.querySelectorAll('#tbm-slots button').forEach(function(b){b.style.background='#fff';b.style.color='#374151';b.style.borderColor='#e2e8f0';});
      btn.style.background='#6366f1';btn.style.color='#fff';btn.style.borderColor='#6366f1';
      _tbmSlotStart=btn.dataset.start; _tbmSlotEnd=btn.dataset.end;
      document.getElementById('tbm-next-btn').disabled=false; document.getElementById('tbm-next-btn').style.opacity='1';
    };
    window.tbmGoStep3=function(){
      if (!_tbmSlotStart) return;
      var date=document.getElementById('tbm-date').value;
      var time=new Date(_tbmSlotStart).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
      document.getElementById('tbm-summary-badge').textContent=_tbmTrainerName+' · '+date+' · '+time;
      _tbmShowStep(3);
    };
    window.tbmSubmit=async function(){
      var name=(document.getElementById('tbm-name').value||'').trim();
      if (!name) { alert('נא להזין שם'); return; }
      if (!_tbmSlotStart||!_tbmSlotEnd) { alert('נא לבחור שעה'); return; }
      var gid=window.storeData&&(window.storeData.groupId||window.storeData.group_id);
      try {
        var r=await fetch('/api/sport/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId:gid,trainerId:_tbmTrainerId,clientName:name,clientPhone:(document.getElementById('tbm-phone').value||'').trim()||null,serviceName:(document.getElementById('tbm-service').value||'אימון אישי').trim(),startTime:_tbmSlotStart,endTime:_tbmSlotEnd,notes:(document.getElementById('tbm-notes').value||'').trim()||null})});
        var d=await r.json();
        if (!d.success) { alert(d.message||d.error||'שגיאה'); return; }
        _tbmShowStep(4);
      } catch(e){alert('שגיאת רשת');}
    };
    function _tbmShowStep(n){[1,2,3,4].forEach(function(i){document.getElementById('tbm-step'+i).style.display=i===n?'block':'none';});}
    window.tbmShowStep=_tbmShowStep;
  }

  // Public: inject sport modals on demand (guarded — only if bizType is sport/gym)
  if (!window.btypeSportInject) {
    window.btypeSportInject = _injectSportModals;
  }

  // ----------------------------------------------------------
  // btypeInit — main entry point, call from each initStore
  // Returns the active BTYPE_CONFIG entry
  // ----------------------------------------------------------
  window.btypeInit = function (data) {
    var bizType = (data && (data.businessType || data.business_type || data.store_type)) || 'retail';
    if (!window._scBizType) window._scBizType = bizType;
    if (!window.storeData)  window.storeData  = data;
    if (!window.API)        window.API        = '/api';

    _applyFlowRedeemWidget();

    if (window.loadStorePopups) window.loadStorePopups();

    // Inject sport modals when the business is a sport/gym type
    if (bizType === 'sport' || bizType === 'gym') {
      _injectSportModals();
    }

    return window.BTYPE_CONFIG[bizType] || window.BTYPE_CONFIG['retail'];
  };

  window.btypeGetConfig = function () {
    var bt = window._scBizType || 'retail';
    return window.BTYPE_CONFIG[bt] || window.BTYPE_CONFIG['retail'];
  };

  window.btypeHasModule = function (mod) {
    var cfg = window.btypeGetConfig();
    return cfg && cfg.modules && cfg.modules.indexOf(mod) !== -1;
  };

})();
