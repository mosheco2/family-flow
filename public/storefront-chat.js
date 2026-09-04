/**
 * storefront-chat.js
 * צ'אט לקוח ↔ עסק — מודול ציבורי משותף לכל תבניות החנות
 *
 * דרישות:
 *   - sc-auth.js נטען לפני קובץ זה
 *   - window._scGroupId מוגדר (groupId של העסק)
 *   - window.API מוגדר (base URL)
 *
 * מתאים לכל תבנית ולכל סוג עסק חדש — ללא שינוי בקובץ זה.
 */
(function () {
  'use strict';

  // ── guard: לא לטעון פעמיים ─────────────────────────────────
  if (window._storeCustomerChatLoaded) return;
  window._storeCustomerChatLoaded = true;

  // ── קבועים ───────────────────────────────────────────────────
  var POLL_INTERVAL = 3000; // ms
  var SC_TOKEN_KEY  = 'sc_auth_token';

  // ── state ─────────────────────────────────────────────────────
  var _chatId      = null;
  var _pollTimer   = null;
  var _lastSince   = null;
  var _open        = false;

  // ── helpers ───────────────────────────────────────────────────
  function _token() { return localStorage.getItem(SC_TOKEN_KEY) || ''; }
  function _authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token() }; }
  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _groupId() { return window._scGroupId || window.storeData && window.storeData.groupId; }

  function _api(path, opts) {
    var base = (window.API || '').replace(/\/$/, '');
    return fetch(base + path, opts);
  }

  // ── CSS ───────────────────────────────────────────────────────
  function _injectCss() {
    if (document.getElementById('sc-chat-css')) return;
    var s = document.createElement('style');
    s.id = 'sc-chat-css';
    s.textContent = [
      '#sc-chat-fab{position:fixed;bottom:80px;left:16px;z-index:9000;background:#6366f1;color:#fff;border:none;border-radius:50%;width:52px;height:52px;font-size:22px;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.45);display:flex;align-items:center;justify-content:center;transition:transform .15s}',
      '#sc-chat-fab:active{transform:scale(.92)}',
      '#sc-chat-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;border:2px solid #fff}',
      '#sc-chat-window{position:fixed;bottom:144px;left:12px;z-index:9001;width:320px;max-width:calc(100vw - 24px);background:#fff;border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;font-family:inherit}',
      '#sc-chat-window.open{display:flex}',
      '#sc-chat-head{background:#6366f1;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '#sc-chat-head h4{margin:0;font-size:14px;font-weight:700}',
      '#sc-chat-head p{margin:0;font-size:10px;opacity:.8}',
      '#sc-chat-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:0}',
      '#sc-chat-msgs{flex:1;min-height:220px;max-height:320px;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;background:#f8fafc}',
      '.sc-msg{max-width:80%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.45;word-break:break-word}',
      '.sc-msg.customer{background:#6366f1;color:#fff;align-self:flex-start;border-bottom-left-radius:4px}',
      '.sc-msg.business{background:#fff;color:#1e293b;align-self:flex-end;border:1px solid #e2e8f0;border-bottom-right-radius:4px}',
      '.sc-msg-time{font-size:9px;opacity:.6;margin-top:2px}',
      '#sc-chat-footer{padding:10px 12px;border-top:1px solid #e2e8f0;display:flex;gap:8px;background:#fff}',
      '#sc-chat-input{flex:1;border:1px solid #e2e8f0;border-radius:20px;padding:8px 14px;font-size:13px;outline:none;font-family:inherit}',
      '#sc-chat-input:focus{border-color:#6366f1}',
      '#sc-chat-send{background:#6366f1;color:#fff;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '#sc-chat-login-msg{padding:20px;text-align:center;font-size:13px;color:#64748b}',
      '#sc-chat-login-msg button{margin-top:10px;background:#6366f1;color:#fff;border:none;border-radius:10px;padding:8px 20px;cursor:pointer;font-size:13px;font-family:inherit}',
      '#sc-chat-empty{text-align:center;color:#94a3b8;font-size:12px;margin:auto;padding:20px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── HTML ──────────────────────────────────────────────────────
  function _injectHtml() {
    if (document.getElementById('sc-chat-window')) return;

    // כפתור צ'אט (FAB)
    var fab = document.createElement('button');
    fab.id = 'sc-chat-fab';
    fab.title = 'שוחח עם העסק';
    fab.innerHTML = '💬<span id="sc-chat-badge"></span>';
    fab.onclick = window.toggleCustomerChat;
    document.body.appendChild(fab);

    // חלון צ'אט
    var win = document.createElement('div');
    win.id = 'sc-chat-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'צ\'אט עם העסק');
    win.innerHTML = [
      '<div id="sc-chat-head">',
        '<div><h4>💬 שוחח איתנו</h4><p id="sc-chat-status-txt">מחובר</p></div>',
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

  // ── כפתור בתוך quick-actions ────────────────────────────────
  function _injectQuickBtn() {
    // הוסף כפתור ל-#quick-actions אם קיים (classic / restaurant / market templates)
    // בכל תבנית חדשה שתכלול #quick-actions — הכפתור יוסף אוטומטית
    var qa = document.getElementById('quick-actions');
    if (qa && !document.getElementById('sc-chat-qa-btn')) {
      var btn = document.createElement('button');
      btn.id = 'sc-chat-qa-btn';
      btn.className = 'qa-btn';
      btn.style.cssText = 'background:#6366f1;color:#fff;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit';
      btn.textContent = '💬 שוחח איתנו';
      btn.onclick = window.toggleCustomerChat;
      qa.appendChild(btn);
      qa.style.display = 'flex';
    }
  }

  // ── פולינג ───────────────────────────────────────────────────
  function _startPoll() {
    if (_pollTimer) return;
    _pollTimer = setInterval(_poll, POLL_INTERVAL);
  }

  function _stopPoll() {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }

  async function _poll() {
    if (!_chatId || !_open) return;
    try {
      var url = '/api/public/customer-chat/' + _chatId + '/messages' + (_lastSince ? '?since=' + encodeURIComponent(_lastSince) : '');
      var r = await _api(url, { headers: _authHeaders() });
      var d = await r.json();
      if (d.success && d.messages && d.messages.length) {
        _appendMessages(d.messages);
        _lastSince = d.messages[d.messages.length - 1].created_at;
      }
    } catch(e) {}
  }

  // ── render הודעות ─────────────────────────────────────────────
  function _appendMessages(msgs) {
    var container = document.getElementById('sc-chat-msgs');
    if (!container) return;
    var empty = document.getElementById('sc-chat-empty');
    if (empty && msgs.length) empty.remove();

    msgs.forEach(function(m) {
      var div = document.createElement('div');
      div.className = 'sc-msg ' + m.sender_type;
      var t = m.created_at ? new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'}) : '';
      div.innerHTML = _esc(m.body) + '<div class="sc-msg-time">' + t + '</div>';
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  // ── פתיחת שיחה ────────────────────────────────────────────────
  async function _openChat() {
    var gid = _groupId();
    if (!gid) return;
    try {
      var r = await _api('/api/public/customer-chat/open', {
        method: 'POST',
        headers: _authHeaders(),
        body: JSON.stringify({ groupId: gid })
      });
      var d = await r.json();
      if (!d.success) return;
      _chatId = d.chat.id;
      // טען היסטוריה
      var r2 = await _api('/api/public/customer-chat/' + _chatId + '/messages', { headers: _authHeaders() });
      var d2 = await r2.json();
      var container = document.getElementById('sc-chat-msgs');
      if (container) container.innerHTML = '<div id="sc-chat-empty">אין הודעות עדיין.<br>כתוב לנו — נשמח לעזור!</div>';
      if (d2.success && d2.messages && d2.messages.length) {
        _appendMessages(d2.messages);
        _lastSince = d2.messages[d2.messages.length - 1].created_at;
      }
      _startPoll();
    } catch(e) { console.error('sc-chat open error', e); }
  }

  // ── API ציבורי ────────────────────────────────────────────────
  window.toggleCustomerChat = function() {
    _open ? window.closeCustomerChat() : window.openCustomerChat();
  };

  window.openCustomerChat = function() {
    var t = _token();
    var win = document.getElementById('sc-chat-window');
    if (!win) return;
    if (!t) {
      // לא מחובר — הצג הנחיה
      var msgs = document.getElementById('sc-chat-msgs');
      var footer = document.getElementById('sc-chat-footer');
      if (msgs) msgs.innerHTML = '<div id="sc-chat-login-msg">כדי לשוחח עם העסק יש להתחבר תחילה.<br><button onclick="window.scAuth && scAuth.openModal && scAuth.openModal()">התחבר / הרשם</button></div>';
      if (footer) footer.style.display = 'none';
      win.classList.add('open');
      _open = true;
      return;
    }
    var footer = document.getElementById('sc-chat-footer');
    if (footer) footer.style.display = 'flex';
    win.classList.add('open');
    _open = true;
    if (!_chatId) _openChat();
    else _startPoll();
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
    if (!_chatId) { await _openChat(); if (!_chatId) return; }
    input.value = '';
    try {
      var r = await _api('/api/public/customer-chat/' + _chatId + '/message', {
        method: 'POST',
        headers: _authHeaders(),
        body: JSON.stringify({ body: body })
      });
      var d = await r.json();
      if (d.success) {
        _appendMessages([d.message]);
        _lastSince = d.message.created_at;
      }
    } catch(e) { console.error('sc-chat send error', e); }
  };

  // ── אתחול ─────────────────────────────────────────────────────
  function _init() {
    _injectCss();
    _injectHtml();

    // המתן לטעינת quick-actions (שמתמלא async בחלק מהתבניות)
    var attempts = 0;
    var qaTimer = setInterval(function() {
      _injectQuickBtn();
      attempts++;
      if (document.getElementById('sc-chat-qa-btn') || attempts > 20) clearInterval(qaTimer);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
