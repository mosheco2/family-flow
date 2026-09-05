/**
 * storefront-chat.js
 * צ'אט לקוח ↔ עסק — מוצג בתוך האזור האישי (sc-activity-panel) אחרי התחברות בלבד.
 *
 * תואם לכל תבנית ולכל סוג עסק עתידי ללא שינוי בקובץ זה.
 * תנאי: sc-auth.js נטען לפניו, ובתבנית קיים #sc-chat-in-panel ו-#sc-activity-panel.
 */
(function () {
  'use strict';

  if (window._storeCustomerChatLoaded) return;
  window._storeCustomerChatLoaded = true;

  var POLL_INTERVAL = 3000;
  var SC_TOKEN_KEY  = 'sc_auth_token';

  var _chatId        = null;
  var _pollTimer     = null;
  var _lastSince     = null;
  var _open          = false;
  var _openingPromise = null;   // guard: מונע קריאות מקבילות ל-_openChatSession
  var _renderedIds   = {};      // dedup: מזהי הודעות שכבר הוצגו

  // ── helpers ──────────────────────────────────────────────────
  function _token() { return localStorage.getItem(SC_TOKEN_KEY) || ''; }
  function _authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token() }; }
  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _groupId() { return window._scGroupId || (window.storeData && window.storeData.groupId); }
  function _isLoggedIn() { return !!_token(); }

  // ── CSS ───────────────────────────────────────────────────────
  function _injectCss() {
    if (document.getElementById('sc-chat-css')) return;
    var s = document.createElement('style');
    s.id = 'sc-chat-css';
    s.textContent = [
      /* חלון — bottom sheet, z-index מתחת ל-sc-header-btn (10500) */
      '#sc-chat-window{position:fixed;bottom:0;left:0;right:0;z-index:9998;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -4px 24px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden;font-family:inherit;max-height:75vh}',
      '#sc-chat-window.open{display:flex}',
      '#sc-chat-head{background:#6366f1;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
      '#sc-chat-head h4{margin:0;font-size:15px;font-weight:700}',
      '#sc-chat-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;padding:0 4px}',
      '#sc-chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}',
      /* הודעת לקוח — ימין (כמו וואטסאפ: שולח מימין) */
      '.sc-msg{max-width:80%;padding:9px 13px;border-radius:16px;font-size:14px;line-height:1.45;word-break:break-word}',
      '.sc-msg.customer{background:#6366f1;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
      '.sc-msg.business{background:#fff;color:#1e293b;align-self:flex-start;border:1px solid #e2e8f0;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.06)}',
      '.sc-msg-time{font-size:10px;opacity:.55;margin-top:3px;text-align:right}',
      '.sc-msg.business .sc-msg-time{text-align:left}',
      /* footer — ריפוד שמאלי מניח מקום לכפתור sc-header-btn (רוחב ~120px + margin) */
      '#sc-chat-footer{padding:12px 14px 12px 160px;border-top:1px solid #e2e8f0;display:flex;gap:10px;background:#fff;flex-shrink:0}',
      '#sc-chat-input{flex:1;border:1px solid #e2e8f0;border-radius:24px;padding:10px 16px;font-size:14px;outline:none;font-family:inherit;background:#f8fafc}',
      '#sc-chat-input:focus{border-color:#6366f1;background:#fff}',
      '#sc-chat-send{background:#6366f1;color:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s}',
      '#sc-chat-send:hover{background:#4f46e5}',
      '#sc-chat-empty{text-align:center;color:#94a3b8;font-size:13px;margin:auto;padding:30px;line-height:1.6}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── חלון צ'אט ─────────────────────────────────────────────
  function _injectWindow() {
    if (document.getElementById('sc-chat-window')) return;
    var win = document.createElement('div');
    win.id = 'sc-chat-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'צ\'אט עם העסק');
    win.innerHTML = [
      '<div id="sc-chat-head">',
        '<div><h4>💬 שיחה עם העסק</h4></div>',
        '<button id="sc-chat-close" onclick="window.closeCustomerChat()" aria-label="סגור">×</button>',
      '</div>',
      '<div id="sc-chat-msgs"><div id="sc-chat-empty">אין הודעות עדיין.<br>כתוב לנו — נשמח לעזור!</div></div>',
      '<div id="sc-chat-footer">',
        '<input id="sc-chat-input" type="text" placeholder="הקלד הודעה..." autocomplete="off" dir="auto" onkeydown="if(event.key===\'Enter\')window.sendCustomerChatMsg()">',
        '<button id="sc-chat-send" onclick="window.sendCustomerChatMsg()" aria-label="שלח">➤</button>',
      '</div>'
    ].join('');
    document.body.appendChild(win);
  }

  // ── כפתור בפאנל האישי ─────────────────────────────────────
  function _syncPanelButton() {
    var btn = document.getElementById('sc-chat-in-panel');
    if (!btn) return;
    btn.style.display = _isLoggedIn() ? 'block' : 'none';
  }

  // ── פולינג ────────────────────────────────────────────────────
  function _startPoll() {
    if (_pollTimer) return;
    _pollTimer = setInterval(_poll, POLL_INTERVAL);
  }
  function _stopPoll() { clearInterval(_pollTimer); _pollTimer = null; }

  async function _poll() {
    if (!_chatId || !_open) return;
    try {
      var url = '/api/public/customer-chat/' + _chatId + '/messages' + (_lastSince ? '?since=' + encodeURIComponent(_lastSince) : '');
      var r = await fetch(url, { headers: _authHeaders() });
      var d = await r.json();
      if (d.success && d.messages && d.messages.length) {
        _appendMessages(d.messages);
        _lastSince = d.messages[d.messages.length - 1].created_at;
      }
    } catch(e) {}
  }

  // ── render עם dedup לפי id ────────────────────────────────
  function _appendMessages(msgs) {
    var container = document.getElementById('sc-chat-msgs');
    if (!container) return;
    var empty = document.getElementById('sc-chat-empty');
    var added = 0;
    msgs.forEach(function(m) {
      if (_renderedIds[m.id]) return; // dedup
      _renderedIds[m.id] = true;
      if (empty) { empty.remove(); empty = null; }
      var div = document.createElement('div');
      div.className = 'sc-msg ' + m.sender_type;
      var t = m.created_at ? new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'}) : '';
      div.innerHTML = _esc(m.body) + '<div class="sc-msg-time">' + t + '</div>';
      container.appendChild(div);
      added++;
    });
    if (added) container.scrollTop = container.scrollHeight;
  }

  // ── פתיחת session (guard מפני קריאות מקבילות) ────────────
  function _openChatSession() {
    if (_openingPromise) return _openingPromise; // מחזיר את אותו promise לכל המחכים
    _openingPromise = _doOpenChatSession().finally(function() {
      _openingPromise = null;
    });
    return _openingPromise;
  }

  async function _doOpenChatSession() {
    var gid = _groupId();
    if (!gid) return;
    try {
      var r = await fetch('/api/public/customer-chat/open', {
        method: 'POST',
        headers: _authHeaders(),
        body: JSON.stringify({ groupId: gid })
      });
      var d = await r.json();
      if (!d.success) return;
      _chatId = d.chat.id;
      _renderedIds = {}; // איפוס dedup בפתיחה חדשה
      var r2 = await fetch('/api/public/customer-chat/' + _chatId + '/messages', { headers: _authHeaders() });
      var d2 = await r2.json();
      var container = document.getElementById('sc-chat-msgs');
      if (container) container.innerHTML = '<div id="sc-chat-empty">אין הודעות עדיין.<br>כתוב לנו — נשמח לעזור!</div>';
      if (d2.success && d2.messages && d2.messages.length) {
        _appendMessages(d2.messages);
        _lastSince = d2.messages[d2.messages.length - 1].created_at;
      }
      _startPoll();
    } catch(e) { console.error('sc-chat:', e); }
  }

  // ── API ציבורי ────────────────────────────────────────────────
  window.openCustomerChat = function() {
    var panel = document.getElementById('sc-activity-panel');
    if (panel) panel.style.display = 'none';
    var win = document.getElementById('sc-chat-window');
    if (!win) return;
    win.classList.add('open');
    _open = true;
    if (!_chatId) { _openChatSession(); } else { _startPoll(); }
  };

  window.closeCustomerChat = function() {
    var win = document.getElementById('sc-chat-window');
    if (win) win.classList.remove('open');
    _open = false;
    _stopPoll();
  };

  window.sendCustomerChatMsg = async function() {
    var input = document.getElementById('sc-chat-input');
    if (!input) return;
    var body = (input.value || '').trim();
    if (!body) return;
    if (!_chatId) { await _openChatSession(); if (!_chatId) return; }
    input.value = '';
    try {
      var r = await fetch('/api/public/customer-chat/' + _chatId + '/message', {
        method: 'POST',
        headers: _authHeaders(),
        body: JSON.stringify({ body: body })
      });
      var d = await r.json();
      if (d.success) {
        _appendMessages([d.message]);
        _lastSince = d.message.created_at;
      }
    } catch(e) { console.error('sc-chat send:', e); }
  };

  // ── אתחול ─────────────────────────────────────────────────────
  function _init() {
    _injectCss();
    _injectWindow();
    _syncPanelButton();

    if (window.scAuth) {
      var _orig = window.scAuth._updateHeaderBtn.bind(window.scAuth);
      window.scAuth._updateHeaderBtn = function() {
        _orig.apply(this, arguments);
        _syncPanelButton();
      };
    }

    var panel = document.getElementById('sc-activity-panel');
    if (panel) {
      var observer = new MutationObserver(function() {
        if (panel.style.display !== 'none') _syncPanelButton();
      });
      observer.observe(panel, { attributes: true, attributeFilter: ['style'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
