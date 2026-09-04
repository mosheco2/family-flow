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
