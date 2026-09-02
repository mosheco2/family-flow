(function() {
'use strict';
const SC_TOKEN_KEY = 'sc_auth_token';
const SC_CUSTOMER_KEY = 'sc_customer';
const API = '';

const scAuth = window.scAuth = {
    _customer: null,
    _token: null,
    _pinResolve: null,
    _pinReject: null,

    init() {
        this._token = localStorage.getItem(SC_TOKEN_KEY);
        try { this._customer = JSON.parse(localStorage.getItem(SC_CUSTOMER_KEY)); } catch(e) {}
        if (this._token) this._verifySession();
        this._injectHeaderBtn();
    },

    _injectHeaderBtn() {
        const doInject = () => {
            if (document.getElementById('sc-header-btn')) return;
            const btn = document.createElement('button');
            btn.id = 'sc-header-btn';
            btn.style.cssText = 'position:fixed;bottom:24px;left:16px;z-index:10500;padding:10px 16px;border-radius:24px;border:none;cursor:pointer;font-size:13px;font-weight:600;background:#6366f1;color:#fff;box-shadow:0 4px 16px rgba(99,102,241,0.45);white-space:nowrap';
            btn.onclick = () => this._customer ? this.openActivityPanel() : this.openModal('phone');
            this._updateHeaderBtn(btn);
            document.body.appendChild(btn);
            // watch for loading-screen hide and keep button on top
            const ls = document.getElementById('loading-screen');
            if (ls) {
                const obs = new MutationObserver(() => {
                    if (ls.style.display === 'none' || ls.hidden) {
                        btn.style.zIndex = '10500';
                        obs.disconnect();
                    }
                });
                obs.observe(ls, { attributes: true, attributeFilter: ['style', 'hidden'] });
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', doInject);
        } else {
            setTimeout(doInject, 50);
        }
    },

    _updateHeaderBtn(btn) {
        btn = btn || document.getElementById('sc-header-btn');
        if (!btn) return;
        btn.textContent = this._customer ? `👤 ${this._customer.first_name}` : '🔑 כניסה';
        btn.style.background = this._customer ? '#10b981' : '#6366f1';
    },

    async _verifySession() {
        try {
            const r = await fetch(`${API}/api/sc-auth/me`, { headers: { Authorization: 'Bearer ' + this._token } });
            const d = await r.json();
            if (d.success) {
                this._customer = d.customer;
                localStorage.setItem(SC_CUSTOMER_KEY, JSON.stringify(d.customer));
                this._updateHeaderBtn();
            } else {
                this._clearSession();
            }
        } catch(e) {}
    },

    _clearSession() {
        this._token = null; this._customer = null;
        localStorage.removeItem(SC_TOKEN_KEY); localStorage.removeItem(SC_CUSTOMER_KEY);
        this._updateHeaderBtn();
    },

    openModal(step = 'phone') {
        document.getElementById('sc-auth-modal').style.display = 'block';
        this._renderStep(step);
    },

    closeModal() { document.getElementById('sc-auth-modal').style.display = 'none'; },

    _renderStep(step, data = {}) {
        const body = document.getElementById('sc-modal-body');
        const title = document.getElementById('sc-modal-title');

        if (step === 'phone') {
            title.textContent = 'כניסה / הרשמה';
            body.innerHTML = `
              <p style="text-align:right;font-size:13px;color:#64748b;margin:0 0 16px">הזן את מספר הטלפון שלך לקבלת קוד אימות</p>
              <input id="sc-phone" type="tel" inputmode="numeric" placeholder="050-0000000"
                style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:13px;font-size:16px;direction:ltr;text-align:center;box-sizing:border-box;margin-bottom:14px"
                onkeydown="if(event.key==='Enter')scAuth.sendOtp()"/>
              <button onclick="scAuth.sendOtp()" style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer">שלח קוד →</button>
              <div id="sc-phone-err" style="color:#ef4444;font-size:13px;text-align:center;margin-top:10px;min-height:18px"></div>`;
            setTimeout(() => document.getElementById('sc-phone')?.focus(), 100);
        }

        if (step === 'otp') {
            title.textContent = 'הזן קוד';
            body.innerHTML = `
              <p style="text-align:right;font-size:13px;color:#64748b;margin:0 0 6px">שלחנו קוד ל-<strong>${data.phone}</strong></p>
              <input id="sc-otp" type="text" inputmode="numeric" maxlength="6" placeholder="_ _ _ _ _ _"
                style="width:100%;border:1.5px solid #6366f1;border-radius:12px;padding:13px;font-size:24px;letter-spacing:10px;text-align:center;direction:ltr;box-sizing:border-box;margin-bottom:14px"
                onkeydown="if(event.key==='Enter')scAuth.verifyOtp('${data.phone}')"/>
              <button onclick="scAuth.verifyOtp('${data.phone}')" style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer">אמת →</button>
              <div id="sc-otp-err" style="color:#ef4444;font-size:13px;text-align:center;margin-top:10px;min-height:18px"></div>
              <button onclick="scAuth._renderStep('phone')" style="width:100%;margin-top:8px;background:none;border:none;color:#94a3b8;font-size:13px;cursor:pointer;text-decoration:underline">שנה מספר טלפון</button>`;
            setTimeout(() => document.getElementById('sc-otp')?.focus(), 100);
        }

        if (step === 'register') {
            title.textContent = 'הרשמה';
            body.innerHTML = `
              <p style="text-align:right;font-size:12px;color:#64748b;margin:0 0 14px">טלפון: <strong>${data.phone}</strong> · השלם פרטים כדי להצטרף</p>
              <div style="display:flex;flex-direction:column;gap:10px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                  <div>
                    <label style="display:block;text-align:right;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">שם פרטי *</label>
                    <input id="sc-fn" type="text" placeholder="ישראל" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;text-align:right;box-sizing:border-box"/>
                  </div>
                  <div>
                    <label style="display:block;text-align:right;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">שם משפחה *</label>
                    <input id="sc-ln" type="text" placeholder="ישראלי" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;text-align:right;box-sizing:border-box"/>
                  </div>
                </div>
                <div>
                  <label style="display:block;text-align:right;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">אימייל</label>
                  <input id="sc-email" type="email" placeholder="your@email.com" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;direction:ltr;text-align:center;box-sizing:border-box"/>
                </div>
                <div>
                  <label style="display:block;text-align:right;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">גיל</label>
                  <input id="sc-age" type="number" min="10" max="120" placeholder="35" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;text-align:center;box-sizing:border-box"/>
                </div>
                <div style="font-size:11px;font-weight:700;color:#475569;text-align:right;padding-top:4px">📍 כתובת</div>
                <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
                  <input id="sc-street" type="text" placeholder="שם הרחוב" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:right;box-sizing:border-box"/>
                  <input id="sc-number" type="text" placeholder="מס׳" style="width:60px;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:center;box-sizing:border-box"/>
                </div>
                <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
                  <input id="sc-city" type="text" placeholder="עיר" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:right;box-sizing:border-box"/>
                  <input id="sc-zip" type="text" placeholder="מיקוד" style="width:80px;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:center;direction:ltr;box-sizing:border-box"/>
                </div>
                <div style="border-top:1px solid #f1f5f9;padding-top:12px">
                  <label style="display:block;text-align:right;font-size:11px;font-weight:700;color:#6366f1;margin-bottom:4px">🔐 צור קוד PIN (6 ספרות) *</label>
                  <p style="font-size:11px;color:#94a3b8;text-align:right;margin:0 0 6px">הקוד ישמש לאישור הזמנות ופעולות עתידיות — במקום SMS חוזר</p>
                  <input id="sc-pin" type="password" inputmode="numeric" maxlength="6" placeholder="• • • • • •"
                    style="width:100%;border:2px solid #6366f1;border-radius:10px;padding:12px;font-size:22px;text-align:center;letter-spacing:8px;box-sizing:border-box"/>
                </div>
                <button onclick="scAuth.register('${data.phone}')" style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px">הרשם ✓</button>
                <div id="sc-reg-err" style="color:#ef4444;font-size:13px;text-align:center;min-height:18px"></div>
              </div>`;
        }

        if (step === 'forgot-pin') {
            title.textContent = 'איפוס PIN';
            body.innerHTML = `
              <p style="text-align:right;font-size:13px;color:#64748b;margin:0 0 16px">הזן טלפון — נשלח לך קוד לאיפוס</p>
              <input id="sc-fp-phone" type="tel" inputmode="numeric" placeholder="050-0000000"
                style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:13px;font-size:16px;direction:ltr;text-align:center;box-sizing:border-box;margin-bottom:14px"/>
              <button onclick="scAuth.sendForgotPin()" style="width:100%;padding:14px;background:#f59e0b;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer">שלח קוד איפוס</button>
              <div id="sc-fp-err" style="color:#ef4444;font-size:13px;text-align:center;margin-top:10px;min-height:18px"></div>`;
        }

        if (step === 'reset-pin-code') {
            title.textContent = 'הזן קוד + PIN חדש';
            body.innerHTML = `
              <p style="text-align:right;font-size:13px;color:#64748b;margin:0 0 16px">שלחנו קוד לטלפון <strong>${data.phone}</strong></p>
              <input id="sc-rpc-code" type="text" inputmode="numeric" maxlength="6" placeholder="קוד 6 ספרות"
                style="width:100%;border:1.5px solid #6366f1;border-radius:12px;padding:12px;font-size:20px;letter-spacing:8px;text-align:center;direction:ltr;box-sizing:border-box;margin-bottom:12px"/>
              <input id="sc-rpc-pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN חדש (6 ספרות)"
                style="width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;font-size:20px;letter-spacing:8px;text-align:center;direction:ltr;box-sizing:border-box;margin-bottom:14px"/>
              <button onclick="scAuth.doResetPin('${data.phone}')" style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer">שמור PIN חדש</button>
              <div id="sc-rpc-err" style="color:#ef4444;font-size:13px;text-align:center;margin-top:10px;min-height:18px"></div>`;
        }
    },

    async sendOtp() {
        const phone = document.getElementById('sc-phone')?.value?.replace(/\D/g, '');
        if (!phone || phone.length < 9) { document.getElementById('sc-phone-err').textContent = 'מספר לא תקין'; return; }
        document.getElementById('sc-phone-err').textContent = '';
        const btn = document.querySelector('#sc-modal-body button');
        btn.disabled = true; btn.textContent = '⏳ שולח...';
        try {
            const r = await fetch('/api/sc-auth/send-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone }) }).then(r=>r.json());
            if (!r.success) { btn.disabled=false; btn.textContent='שלח קוד →'; document.getElementById('sc-phone-err').textContent = r.error||'שגיאה'; return; }
            this._renderStep('otp', { phone });
        } catch(e) { btn.disabled=false; btn.textContent='שלח קוד →'; document.getElementById('sc-phone-err').textContent='שגיאת רשת'; }
    },

    async verifyOtp(phone) {
        const code = document.getElementById('sc-otp')?.value?.trim();
        if (!code || code.length < 6) { document.getElementById('sc-otp-err').textContent = 'הזן קוד 6 ספרות'; return; }
        const btn = document.querySelector('#sc-modal-body button');
        btn.disabled=true; btn.textContent='⏳ מאמת...';
        try {
            const r = await fetch('/api/sc-auth/verify-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone, code }) }).then(r=>r.json());
            if (!r.success) { btn.disabled=false; btn.textContent='אמת →'; document.getElementById('sc-otp-err').textContent=r.error||'שגיאה'; return; }
            if (r.isNew) { this._renderStep('register', { phone }); return; }
            this._saveSession(r.token, r.customer);
            this.closeModal();
        } catch(e) { btn.disabled=false; btn.textContent='אמת →'; document.getElementById('sc-otp-err').textContent='שגיאת רשת'; }
    },

    async register(phone) {
        const fn = document.getElementById('sc-fn')?.value?.trim();
        const ln = document.getElementById('sc-ln')?.value?.trim();
        const pin = document.getElementById('sc-pin')?.value?.trim();
        if (!fn || !ln) { document.getElementById('sc-reg-err').textContent='שם פרטי ושם משפחה חובה'; return; }
        if (!pin || pin.length!==6 || !/^\d{6}$/.test(pin)) { document.getElementById('sc-reg-err').textContent='PIN חייב להיות 6 ספרות'; return; }
        const btn = document.querySelector('#sc-modal-body button[onclick*="register"]');
        btn.disabled=true; btn.textContent='⏳ שולח...';
        try {
            const r = await fetch('/api/sc-auth/register', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ phone, firstName:fn, lastName:ln,
                    email: document.getElementById('sc-email')?.value?.trim()||null,
                    age: document.getElementById('sc-age')?.value||null,
                    street: document.getElementById('sc-street')?.value?.trim()||null,
                    number: document.getElementById('sc-number')?.value?.trim()||null,
                    city: document.getElementById('sc-city')?.value?.trim()||null,
                    zip: document.getElementById('sc-zip')?.value?.trim()||null, pin })
            }).then(r=>r.json());
            if (!r.success) { btn.disabled=false; btn.textContent='הרשם ✓'; document.getElementById('sc-reg-err').textContent=r.error||'שגיאה'; return; }
            this._saveSession(r.token, r.customer);
            this.closeModal();
        } catch(e) { btn.disabled=false; btn.textContent='הרשם ✓'; document.getElementById('sc-reg-err').textContent='שגיאת רשת'; }
    },

    _saveSession(token, customer) {
        this._token = token; this._customer = customer;
        localStorage.setItem(SC_TOKEN_KEY, token);
        localStorage.setItem(SC_CUSTOMER_KEY, JSON.stringify(customer));
        this._updateHeaderBtn();
        // pre-fill checkout fields if visible
        const nameEl = document.getElementById('cust-name');
        const phoneEl = document.getElementById('cust-phone');
        if (nameEl) nameEl.value = `${customer.first_name} ${customer.last_name}`;
        if (phoneEl) phoneEl.value = customer.phone;
    },

    // PIN confirmation promise
    requirePin() {
        return new Promise((resolve, reject) => {
            this._pinResolve = resolve; this._pinReject = reject;
            document.getElementById('sc-pin-input').value = '';
            document.getElementById('sc-pin-error').textContent = '';
            document.getElementById('sc-pin-overlay').style.display = 'flex';
            setTimeout(() => document.getElementById('sc-pin-input')?.focus(), 100);
        });
    },

    async confirmPin() {
        const pin = document.getElementById('sc-pin-input')?.value?.trim();
        if (!pin || pin.length < 6) { document.getElementById('sc-pin-error').textContent='הזן 6 ספרות'; return; }
        try {
            const r = await fetch('/api/sc-auth/verify-pin', { method:'POST',
                headers:{'Content-Type':'application/json','Authorization':'Bearer '+(this._token||'')},
                body: JSON.stringify({ pin }) }).then(r=>r.json());
            if (!r.success) { document.getElementById('sc-pin-error').textContent=r.error||'PIN שגוי'; return; }
            document.getElementById('sc-pin-overlay').style.display='none';
            if (this._pinResolve) { this._pinResolve(true); this._pinResolve=null; }
        } catch(e) { document.getElementById('sc-pin-error').textContent='שגיאת רשת'; }
    },

    openForgotPin() {
        document.getElementById('sc-pin-overlay').style.display='none';
        if (this._pinReject) { this._pinReject('cancelled'); this._pinReject=null; }
        this.openModal('forgot-pin');
    },

    async sendForgotPin() {
        const phone = document.getElementById('sc-fp-phone')?.value?.replace(/\D/g,'');
        if (!phone || phone.length<9) { document.getElementById('sc-fp-err').textContent='מספר לא תקין'; return; }
        const r = await fetch('/api/sc-auth/forgot-pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})}).then(r=>r.json()).catch(()=>({}));
        if (!r.success) { document.getElementById('sc-fp-err').textContent=r.error||'שגיאה'; return; }
        this._renderStep('reset-pin-code', { phone });
    },

    async doResetPin(phone) {
        const code = document.getElementById('sc-rpc-code')?.value?.trim();
        const newPin = document.getElementById('sc-rpc-pin')?.value?.trim();
        if (!code||!newPin||newPin.length!==6) { document.getElementById('sc-rpc-err').textContent='בדוק את השדות'; return; }
        const r = await fetch('/api/sc-auth/reset-pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,code,newPin})}).then(r=>r.json()).catch(()=>({}));
        if (!r.success) { document.getElementById('sc-rpc-err').textContent=r.error||'שגיאה'; return; }
        this._renderStep('phone');
        document.getElementById('sc-modal-title').textContent = '✅ PIN אופס — התחבר';
    },

    async openActivityPanel() {
        const panel = document.getElementById('sc-activity-panel');
        panel.style.display = 'block';
        const list = document.getElementById('sc-activity-list');
        list.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:30px">טוען...</div>';
        const bizId = window._scBizId || new URLSearchParams(location.search).get('store') || '';
        try {
            const r = await fetch(`/api/sc-auth/activity/${bizId}`, { headers:{'Authorization':'Bearer '+(this._token||'')} }).then(r=>r.json());
            if (!r.success) { list.innerHTML='<div style="text-align:center;color:#ef4444;font-size:13px;padding:20px">שגיאה</div>'; return; }
            const { orders=[], bookings=[], classRegs=[], memberships=[], appointments=[], checkins=[], restaurantVisits=[], businessType='' } = r;
            if (businessType) window._scBizType = businessType;
            const _bizType = businessType || window._scBizType || '';
            const _sp = window.storeData?.settings?.sport_settings;
            const _spObj = _sp ? (typeof _sp === 'string' ? JSON.parse(_sp) : _sp) : {};
            const _gid = window._scBizId || new URLSearchParams(location.search).get('store') || '';

            let html = '';

            // ── מנויים ──────────────────────────────────────────────────────
            if (memberships.length) {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 6px;text-align:right">🏆 המנוי שלי</div>`;
                html += memberships.map(m => {
                    const color = m.type_color || '#6366f1';
                    const expiry = m.end_date ? new Date(m.end_date).toLocaleDateString('he-IL',{day:'numeric',month:'short',year:'numeric'}) : '';
                    const hasExpired = m.end_date && new Date(m.end_date) < new Date();
                    const sessions = m.sessions_limit ? `${m.sessions_used||0} / ${m.sessions_limit} כניסות` : '';
                    const frozen = m.status === 'frozen';
                    const pending = m.status === 'pending';
                    const statusLabel = pending ? 'ממתין לאישור' : frozen ? 'מוקפא' : (m.is_trial || m.status==='trial') ? 'ניסיון' : hasExpired ? 'פג תוקף' : 'פעיל';
                    const statusColor = pending ? '#f59e0b' : frozen ? '#94a3b8' : hasExpired ? '#ef4444' : color;
                    // Progress bar for sessions
                    const pct = m.sessions_limit ? Math.min(100, Math.round(((m.sessions_used||0)/m.sessions_limit)*100)) : null;
                    return `<div style="border:2px solid ${color}30;border-radius:14px;padding:14px;margin-bottom:10px;background:${color}08" data-mem-id="${m.id}">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                        <span style="font-size:11px;font-weight:700;color:${statusColor};background:${statusColor}18;padding:3px 9px;border-radius:8px">${statusLabel}</span>
                        <span style="font-size:15px;font-weight:700;color:#1e293b">${m.type_name||'מנוי'}</span>
                      </div>
                      ${expiry ? `<div style="font-size:12px;color:#64748b;text-align:right">📅 בתוקף עד: <strong>${expiry}</strong></div>` : ''}
                      ${sessions ? `<div style="font-size:12px;color:#64748b;text-align:right;margin-top:4px">🚪 ${sessions}</div>` : ''}
                      ${pct !== null ? `<div style="margin-top:8px;background:#e2e8f0;border-radius:6px;height:6px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color};border-radius:6px;transition:width 0.3s"></div></div>` : ''}
                      <button data-mem-detail="${m.id}" style="margin-top:10px;width:100%;padding:8px;border:1.5px solid ${color}40;border-radius:10px;background:${color}10;color:${color};font-size:12px;cursor:pointer;font-weight:600">פרטי מנוי מלאים ←</button>
                    </div>`;
                }).join('');
            }

            // ── שיעורים קרובים ─────────────────────────────────────────────
            if (classRegs.length) {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 6px;text-align:right">🏋️ שיעורים קרובים</div>`;
                html += classRegs.map(c => {
                    const _cdk = c.class_date instanceof Date ? c.class_date.toISOString().slice(0,10) : String(c.class_date||'').slice(0,10);
                    const d = _cdk ? new Date(_cdk+'T12:00:00').toLocaleDateString('he-IL',{weekday:'short',day:'numeric',month:'short'}) : '';
                    const t = c.start_time ? c.start_time.slice(0,5) : '';
                    const cancelled = c.status === 'cancelled' || c.status === 'cancelled_late';
                    return `<div style="border:1px solid #f1f5f9;border-radius:12px;padding:12px;margin-bottom:8px;opacity:${cancelled?'0.6':'1'}">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start">
                        <div>
                          ${cancelled ? `<span style="font-size:10px;color:#ef4444;font-weight:700">בוטל</span>` : `<span style="font-size:10px;color:#10b981;font-weight:700">מאושר</span>`}
                        </div>
                        <div style="text-align:right">
                          <div style="font-weight:700;font-size:14px;color:#1e293b">${c.class_name||'שיעור'}</div>
                          <div style="font-size:12px;color:#64748b;margin-top:2px">${d} ${t}${c.trainer_name?' · '+c.trainer_name:''}</div>
                        </div>
                      </div>
                      ${!cancelled ? `<button data-cancel-class="${c.id}" data-class-date="${c.class_date}" style="margin-top:8px;width:100%;padding:7px;border:1px solid #fca5a5;border-radius:9px;background:#fff5f5;color:#ef4444;font-size:12px;cursor:pointer">ביטול רישום</button>` : ''}
                    </div>`;
                }).join('');
            }

            // ── אימונים אישיים ─────────────────────────────────────────────
            if (_bizType === 'sport') {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 6px;text-align:right">📅 אימונים אישיים</div>`;
                if (!appointments.length) {
                    html += `<div style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:10px;text-align:right">
                      <div style="color:#94a3b8;font-size:13px">אין אימונים קרובים</div>
                      <button data-sport-action="trainer" style="margin-top:8px;padding:7px 14px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer">+ הזמן אימון אישי</button>
                    </div>`;
                } else
                html += appointments.map(a => {
                    const dt = a.start_time ? new Date(a.start_time) : null;
                    const dateStr = dt ? dt.toLocaleDateString('he-IL',{weekday:'short',day:'numeric',month:'short'}) : '';
                    const timeStr = dt ? dt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '';
                    const statusColors = { pending:'#f59e0b', confirmed:'#10b981', cancelled:'#ef4444', completed:'#6366f1' };
                    const statusLabels = { pending:'ממתין לאישור', confirmed:'מאושר', cancelled:'בוטל', completed:'הושלם' };
                    const sc = statusColors[a.status] || '#64748b';
                    return `<div style="border:1px solid #f1f5f9;border-radius:12px;padding:12px;margin-bottom:8px">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start">
                        <span style="font-size:11px;font-weight:700;color:${sc};background:${sc}15;padding:3px 8px;border-radius:7px">${statusLabels[a.status]||a.status}</span>
                        <div style="text-align:right">
                          <div style="font-weight:700;font-size:14px;color:#1e293b">${a.service_name||'אימון אישי'}</div>
                          <div style="font-size:12px;color:#64748b;margin-top:2px">${dateStr} ${timeStr}${a.trainer_name?' · '+a.trainer_name:''}</div>
                        </div>
                      </div>
                      ${a.notes ? `<div style="font-size:11px;color:#94a3b8;text-align:right;margin-top:6px;padding-top:6px;border-top:1px solid #f8fafc">${a.notes}</div>` : ''}
                    </div>`;
                }).join('');
            }

            // ── היסטוריית ביקורים ──────────────────────────────────────────
            if (_bizType === 'sport') {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 6px;text-align:right;display:flex;justify-content:space-between;align-items:center"><span>🚪 היסטוריית ביקורים</span><span style="font-weight:400">${checkins.length ? checkins.length + ' ביקורים' : ''}</span></div>`;
                if (!checkins.length) {
                    html += `<div style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:10px;text-align:right;color:#94a3b8;font-size:13px">אין ביקורים רשומים עדיין</div>`;
                } else {
                    html += `<div style="border:1px solid #f1f5f9;border-radius:14px;overflow:hidden;margin-bottom:10px">`;
                    html += checkins.map((c, i) => {
                        const dt = c.checked_in_at ? new Date(c.checked_in_at) : null;
                        const dateStr = dt ? dt.toLocaleDateString('he-IL',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) : '';
                        const timeStr = dt ? dt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '';
                        const visitNum = checkins.length - i;
                        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;${i>0?'border-top:1px solid #f8fafc':''}">
                          <span style="font-size:11px;color:#cbd5e1;font-weight:600">#${visitNum}</span>
                          <div style="text-align:right">
                            <div style="font-size:13px;color:#1e293b;font-weight:600">${dateStr}</div>
                            <div style="font-size:11px;color:#94a3b8">${timeStr}</div>
                          </div>
                        </div>`;
                    }).join('');
                    html += `</div>`;
                }
            }

            // ── הזמנות מסעדה (שולחנות) ──────────────────────────────────────
            var tableReservations = bookings.filter(function(b) { return b.call_type === 'table_reservation'; });
            var otherBookings = bookings.filter(function(b) { return b.call_type !== 'table_reservation'; });

            if (_bizType === 'restaurant' || _bizType === 'cafe') {
                var tableStatusColors = { approved:'#10b981', pending:'#f59e0b', cancelled:'#ef4444' };
                var tableStatusLabels = { approved:'אושרה ✅', pending:'ממתין לאישור', cancelled:'בוטלה' };
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 6px;text-align:right;display:flex;justify-content:space-between;align-items:center"><span>🍽️ הזמנות שולחן</span>${tableReservations.length?'<span style="font-weight:400">'+tableReservations.length+' הזמנות</span>':''}</div>`;
                if (!tableReservations.length) {
                    html += `<div style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:10px;text-align:right;color:#94a3b8;font-size:13px">אין הזמנות שולחן. <span data-restaurant-action="table" style="color:#f97316;font-weight:700;cursor:pointer">הזמן שולחן →</span></div>`;
                } else {
                    html += tableReservations.map(function(b) {
                        var sc = tableStatusColors[b.status] || '#64748b';
                        var sl = tableStatusLabels[b.status] || b.status;
                        var dk = b.event_date instanceof Date ? b.event_date.toISOString().slice(0,10) : String(b.event_date||'').slice(0,10);
                        var ds = dk ? new Date(dk+'T12:00:00').toLocaleDateString('he-IL',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) : '';
                        var ts = b.start_time ? String(b.start_time).slice(0,5) : '';
                        var canCancel = b.status !== 'cancelled' && dk >= new Date().toISOString().slice(0,10);
                        return '<div style="border:1.5px solid '+sc+'30;border-radius:12px;padding:12px;margin-bottom:8px;background:'+sc+'06" data-table-res-id="'+b.id+'">'
                            +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
                            +'<span style="font-size:11px;font-weight:700;color:'+sc+';background:'+sc+'18;padding:3px 8px;border-radius:7px">'+sl+'</span>'
                            +(b.reserved_table_number ? '<span style="font-size:11px;color:#64748b">שולחן '+b.reserved_table_number+'</span>' : '')
                            +'</div>'
                            +'<div style="text-align:right">'
                            +'<div style="font-weight:700;font-size:14px;color:#1e293b">'+ds+(ts?' · '+ts:'')+'</div>'
                            +(b.num_guests ? '<div style="font-size:12px;color:#64748b;margin-top:2px">👥 '+b.num_guests+' סועדים</div>' : '')
                            +(b.notes ? '<div style="font-size:11px;color:#94a3b8;margin-top:3px">'+b.notes+'</div>' : '')
                            +'</div>'
                            +(canCancel ? '<button data-cancel-table-res="'+b.id+'" style="margin-top:8px;width:100%;padding:7px;border:1px solid #fca5a5;border-radius:9px;background:#fff5f5;color:#ef4444;font-size:12px;cursor:pointer">ביטול הזמנה</button>' : '')
                            +'</div>';
                    }).join('');
                }
            }

            // ── הזמנות חנות ─────────────────────────────────────────────────
            if (orders.length) {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 6px;text-align:right">📦 הזמנות</div>`;
                html += orders.map(o => {
                    var statusColors = { new:'#f59e0b', confirmed:'#3b82f6', ready:'#8b5cf6', delivered:'#10b981', cancelled:'#ef4444', pending_approval:'#f59e0b' };
                    var statusLabels = { new:'חדשה', confirmed:'אושרה', ready:'מוכן', delivered:'נמסר', cancelled:'בוטלה', pending_approval:'ממתין לאישור' };
                    const sc = statusColors[o.status] || '#64748b';
                    const sl = statusLabels[o.status] || o.status;
                    const items = o.items ? o.items.map(i => i.name).join(', ') : '';
                    const deliveryLabel = o.is_delivery ? '🛵 משלוח' : '🏠 איסוף עצמי';
                    return `<div style="border:1px solid #f1f5f9;border-radius:12px;padding:12px;margin-bottom:8px">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <span style="font-size:12px;font-weight:700;color:${sc};background:${sc}15;padding:3px 8px;border-radius:8px">${sl}</span>
                        <span style="font-size:14px;font-weight:700;color:#1e293b">₪${parseFloat(o.total_amount||0).toFixed(0)}</span>
                      </div>
                      ${items ? `<div style="font-size:12px;color:#475569;text-align:right;margin-top:4px">${items}</div>` : ''}
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
                        <span style="font-size:11px;color:#94a3b8">${o.is_delivery !== undefined ? deliveryLabel : ''}</span>
                        <span style="font-size:11px;color:#94a3b8">${new Date(o.created_at).toLocaleDateString('he-IL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    </div>`;
                }).join('');
            }

            // ── תורים (calendar — לא הזמנות שולחן) ─────────────────────────
            if (otherBookings.length) {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 6px;text-align:right">🗓️ תורים</div>`;
                html += otherBookings.map(b => {
                    var bStatusC = { pending:'#f59e0b', approved:'#10b981', cancelled:'#ef4444' };
                    var bStatusL = { pending:'ממתין', approved:'מאושר', cancelled:'בוטל' };
                    var bsc = bStatusC[b.status] || '#64748b';
                    return `<div style="border:1px solid #f1f5f9;border-radius:12px;padding:12px;margin-bottom:8px">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <span style="font-size:11px;font-weight:700;color:${bsc};background:${bsc}15;padding:2px 7px;border-radius:6px">${bStatusL[b.status]||b.status}</span>
                        <div style="font-weight:600;font-size:14px;color:#1e293b;text-align:right">${b.title||'תור'}</div>
                      </div>
                      <div style="font-size:12px;color:#64748b;text-align:right">${b.event_date||''} ${b.start_time?.slice(0,5)||''}</div>
                    </div>`;
                }).join('');
            }

            // ── היסטוריית ביקורים — מסעדה ───────────────────────────────────
            if (_bizType === 'restaurant' || _bizType === 'cafe') {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 6px;text-align:right;display:flex;justify-content:space-between;align-items:center"><span>🚪 היסטוריית ביקורים</span><span style="font-weight:400">${restaurantVisits.length ? restaurantVisits.length+' ביקורים' : ''}</span></div>`;
                if (!restaurantVisits.length) {
                    html += `<div style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:10px;text-align:right;color:#94a3b8;font-size:13px">אין ביקורים רשומים עדיין</div>`;
                } else {
                    html += `<div style="border:1px solid #f1f5f9;border-radius:14px;overflow:hidden;margin-bottom:10px">`;
                    html += restaurantVisits.map(function(v, i) {
                        var dt = v.visited_at ? new Date(v.visited_at) : null;
                        var dateStr = dt ? dt.toLocaleDateString('he-IL',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) : '';
                        var timeStr = dt ? dt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '';
                        var visitNum = restaurantVisits.length - i;
                        var outDt = v.checked_out_at ? new Date(v.checked_out_at) : null;
                        var durStr = '';
                        if (dt && outDt) { var mins = Math.round((outDt-dt)/60000); durStr = mins>=60 ? Math.floor(mins/60)+'ש׳ '+mins%60+'ד׳' : mins+'ד׳'; }
                        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;'+(i>0?'border-top:1px solid #f8fafc':'')+'">'
                            +'<span style="font-size:11px;color:#cbd5e1;font-weight:600">#'+visitNum+'</span>'
                            +'<div style="text-align:right">'
                            +'<div style="font-size:13px;color:#1e293b;font-weight:600">'+dateStr+'</div>'
                            +'<div style="font-size:11px;color:#94a3b8">'+timeStr+(v.guests && v.guests>1 ? ' · '+v.guests+' סועדים' : '')+(durStr?' · '+durStr:'')+'</div>'
                            +'</div></div>';
                    }).join('');
                    html += `</div>`;
                }
            }

            // ── פעולות מהירות ────────────────────────────────────────────────
            if (_bizType === 'restaurant' || _bizType === 'cafe') {
                html = `<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #f1f5f9">
                  <div style="font-size:11px;font-weight:700;color:#94a3b8;padding:0 0 8px;text-align:right">⚡ פעולות מהירות</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button data-restaurant-action="table" style="flex:1;min-width:90px;padding:10px 6px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:12px;cursor:pointer;color:#475569;text-align:center">🪑 הזמן שולחן</button>
                  </div>
                </div>` + html;
            }

            if (_bizType === 'sport') {
                const sportBtns = [];
                if (_spObj.public_show_schedule !== false)
                    sportBtns.push(`<button data-sport-action="schedule" style="flex:1;min-width:90px;padding:10px 6px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:12px;cursor:pointer;color:#475569;text-align:center">📋 לוח שיעורים</button>`);
                if (_spObj.public_show_trainer !== false)
                    sportBtns.push(`<button data-sport-action="trainer" style="flex:1;min-width:90px;padding:10px 6px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:12px;cursor:pointer;color:#475569;text-align:center">📅 הזמן אימון</button>`);
                if (_spObj.public_show_membership !== false && !memberships.some(m=>m.status==='active'))
                    sportBtns.push(`<button data-sport-action="membership" style="flex:1;min-width:90px;padding:10px 6px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:12px;cursor:pointer;color:#475569;text-align:center">🏋️ רכישת מנוי</button>`);
                if (sportBtns.length) {
                    html = `<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #f1f5f9">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;padding:0 0 8px;text-align:right">⚡ פעולות מהירות</div>
                      <div style="display:flex;gap:8px;flex-wrap:wrap">${sportBtns.join('')}</div>
                    </div>` + html;
                }
            }

            if (!html) html = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:40px 0">אין פעילות עדיין עם העסק הזה</div>';

            html += `<div style="border-top:1px solid #f1f5f9;margin-top:12px;padding-top:12px">
              <button id="sc-profile-btn" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:14px;cursor:pointer;color:#475569">✏️ עריכת פרופיל</button>
              <button id="sc-logout-btn" style="width:100%;padding:10px;border:none;background:none;font-size:13px;cursor:pointer;color:#94a3b8;margin-top:6px">יציאה</button>
            </div>`;
            list.innerHTML = html;

            // ── Event listeners (avoiding onclick-in-innerHTML scope issues) ──
            list.querySelector('#sc-profile-btn')?.addEventListener('click', () => scAuth.openProfileEdit());
            list.querySelector('#sc-logout-btn')?.addEventListener('click', () => scAuth.logout());

            list.querySelectorAll('[data-sport-action]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    document.getElementById('sc-activity-panel').style.display = 'none';
                    _scOpenSportPanel(btn.getAttribute('data-sport-action'), _gid, window.scAuth._customer);
                });
            });

            // פרטי מנוי
            list.querySelectorAll('[data-mem-detail]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const mid = btn.getAttribute('data-mem-detail');
                    const m = memberships.find(function(x){ return String(x.id)===mid; });
                    if (m) _scShowMembershipDetail(m);
                });
            });

            // ביטול רישום לשיעור
            list.querySelectorAll('[data-cancel-class]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const cid = btn.getAttribute('data-cancel-class');
                    if (!confirm('לבטל את הרישום לשיעור?')) return;
                    btn.disabled = true; btn.textContent = 'מבטל...';
                    fetch('/api/sport/public-class-register', {
                        method: 'DELETE',
                        headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({classId: cid, memberPhone: (window.scAuth._customer && window.scAuth._customer.phone) || '', groupId: _gid})
                    }).then(function(r){return r.json();}).then(function(res) {
                        if (res.success || res.status === 'cancelled') {
                            btn.closest('div[style]').style.opacity = '0.4';
                            btn.textContent = 'בוטל';
                        } else {
                            btn.disabled = false; btn.textContent = res.error || 'שגיאה';
                        }
                    }).catch(function() { btn.disabled=false; btn.textContent='שגיאת רשת'; });
                });
            });

            // ── מסעדה: פעולות מהירות ──────────────────────────────────────────
            list.querySelectorAll('[data-restaurant-action]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var action = btn.getAttribute('data-restaurant-action');
                    if (action === 'table') {
                        document.getElementById('sc-activity-panel').style.display = 'none';
                        _scRestaurantTablePanel(_gid, window.scAuth._customer);
                    }
                });
            });

            // ── מסעדה: ביטול הזמנת שולחן ──────────────────────────────────────
            list.querySelectorAll('[data-cancel-table-res]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var evtId = btn.getAttribute('data-cancel-table-res');
                    if (!confirm('לבטל את הזמנת השולחן?')) return;
                    btn.disabled = true; btn.textContent = 'מבטל...';
                    fetch('/api/public/restaurants/' + _gid + '/reservation/' + evtId, {
                        method: 'DELETE',
                        headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({ phone: (window.scAuth._customer && window.scAuth._customer.phone) || '' })
                    }).then(function(r){ return r.json(); }).then(function(res) {
                        if (res.success) {
                            var card = btn.closest('[data-table-res-id]');
                            if (card) { card.style.opacity = '0.4'; btn.textContent = 'בוטל'; }
                        } else {
                            btn.disabled = false; btn.textContent = res.error || 'שגיאה';
                        }
                    }).catch(function() { btn.disabled=false; btn.textContent='שגיאת רשת'; });
                });
            });
        } catch(e) { list.innerHTML='<div style="text-align:center;color:#ef4444;font-size:13px;padding:20px">שגיאת טעינה</div>'; }
    },

    openProfileEdit() {
        if (!this._customer) return;
        const c = this._customer;
        document.getElementById('sc-activity-panel').style.display = 'none';
        this.openModal('profile-edit');
        const body = document.getElementById('sc-modal-body');
        document.getElementById('sc-modal-title').textContent = 'עריכת פרופיל';
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div><label style="display:block;text-align:right;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">שם פרטי</label>
              <input id="ep-fn" type="text" value="${c.first_name||''}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;text-align:right;box-sizing:border-box"/></div>
              <div><label style="display:block;text-align:right;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">שם משפחה</label>
              <input id="ep-ln" type="text" value="${c.last_name||''}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;text-align:right;box-sizing:border-box"/></div>
            </div>
            <div><label style="display:block;text-align:right;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">אימייל</label>
            <input id="ep-email" type="email" value="${c.email||''}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;direction:ltr;text-align:center;box-sizing:border-box"/></div>
            <div><label style="display:block;text-align:right;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">גיל</label>
            <input id="ep-age" type="number" value="${c.age||''}" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;text-align:center;box-sizing:border-box"/></div>
            <div style="font-size:11px;font-weight:700;color:#475569;text-align:right;padding-top:4px">📍 כתובת</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
              <input id="ep-street" type="text" placeholder="רחוב" value="${c.address_street||''}" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:right;box-sizing:border-box"/>
              <input id="ep-number" type="text" placeholder="מס׳" value="${c.address_number||''}" style="width:60px;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:center;box-sizing:border-box"/>
            </div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
              <input id="ep-city" type="text" placeholder="עיר" value="${c.address_city||''}" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:right;box-sizing:border-box"/>
              <input id="ep-zip" type="text" placeholder="מיקוד" value="${c.address_zip||''}" style="width:80px;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:center;direction:ltr;box-sizing:border-box"/>
            </div>
            <button onclick="scAuth.saveProfile()" style="width:100%;padding:13px;background:#10b981;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px">שמור שינויים</button>
            <button onclick="scAuth._renderStep('change-pin-form')" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:13px;cursor:pointer;color:#6366f1">🔐 שנה PIN</button>
            <div id="ep-msg" style="text-align:center;font-size:13px;min-height:18px"></div>
          </div>`;
    },

    async saveProfile() {
        const payload = {
            firstName: document.getElementById('ep-fn')?.value?.trim()||null,
            lastName: document.getElementById('ep-ln')?.value?.trim()||null,
            email: document.getElementById('ep-email')?.value?.trim()||null,
            age: document.getElementById('ep-age')?.value||null,
            street: document.getElementById('ep-street')?.value?.trim()||null,
            number: document.getElementById('ep-number')?.value?.trim()||null,
            city: document.getElementById('ep-city')?.value?.trim()||null,
            zip: document.getElementById('ep-zip')?.value?.trim()||null,
        };
        const r = await fetch('/api/sc-auth/profile',{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(this._token||'')},body:JSON.stringify(payload)}).then(r=>r.json()).catch(()=>({}));
        const msg = document.getElementById('ep-msg');
        if (r.success) {
            Object.assign(this._customer, { first_name: payload.firstName||this._customer.first_name, last_name: payload.lastName||this._customer.last_name, email: payload.email||this._customer.email });
            localStorage.setItem(SC_CUSTOMER_KEY, JSON.stringify(this._customer));
            this._updateHeaderBtn();
            msg.style.color='#10b981'; msg.textContent='✓ נשמר בהצלחה';
        } else { msg.style.color='#ef4444'; msg.textContent=r.error||'שגיאה'; }
    },

    async goToOFL() {
        if (this._token) {
            try {
                const r = await fetch('/api/sc-auth/sso-token', { headers:{'Authorization':'Bearer '+this._token} }).then(r=>r.json());
                if (r.success && r.ssoToken) { window.open(`/?sso_token=${r.ssoToken}`, '_blank'); return; }
            } catch(e) {}
        }
        // fallback: open family app without SSO (user logs in there separately)
        window.open('/', '_blank');
    },

    async logout() {
        await fetch('/api/sc-auth/logout',{method:'POST',headers:{'Authorization':'Bearer '+(this._token||'')}}).catch(()=>{});
        this._clearSession();
        document.getElementById('sc-activity-panel').style.display='none';
    }
};

// ─── Membership detail panel ──────────────────────────────────────────────────
function _scShowMembershipDetail(m) {
    var ex = document.getElementById('sc-mem-detail-overlay');
    if (ex) ex.remove();
    var overlay = document.createElement('div');
    overlay.id = 'sc-mem-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif';
    overlay.dir = 'rtl';
    var sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-height:80vh;background:#fff;border-radius:20px 20px 0 0;overflow-y:auto;padding:20px;box-sizing:border-box;-webkit-overflow-scrolling:touch';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    var color = m.type_color || '#6366f1';
    var expiry = m.end_date ? new Date(m.end_date).toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'}) : '';
    var start = m.start_date ? new Date(m.start_date).toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'}) : '';
    var sessions = m.sessions_limit ? (m.sessions_used||0) + ' / ' + m.sessions_limit + ' כניסות שנוצלו' : '';
    var pct = m.sessions_limit ? Math.min(100, Math.round(((m.sessions_used||0)/m.sessions_limit)*100)) : null;
    var statusLabel = m.status==='frozen' ? 'מוקפא' : m.is_trial||m.status==='trial' ? 'ניסיון' : 'פעיל';

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'position:absolute;top:16px;left:20px;background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;padding:0';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function() { overlay.remove(); });
    sheet.style.position = 'relative';
    sheet.appendChild(closeBtn);

    var inner = document.createElement('div');
    inner.innerHTML =
        '<div style="text-align:right;margin-bottom:20px">' +
        '<span style="font-size:11px;font-weight:700;color:'+color+';background:'+color+'18;padding:3px 10px;border-radius:8px">'+statusLabel+'</span>' +
        '<h2 style="margin:8px 0 4px;font-size:20px;color:#1e293b">' + (m.type_name||'מנוי') + '</h2>' +
        (m.membership_kind === 'sessions' ? '<div style="font-size:12px;color:#64748b">כרטיסייה</div>' : '<div style="font-size:12px;color:#64748b">מנוי תקופתי</div>') +
        '</div>' +
        '<div style="background:#f8fafc;border-radius:14px;padding:14px;margin-bottom:16px">' +
        (start ? '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="color:#64748b;font-size:13px">תחילה</span><span style="font-weight:600;font-size:13px">'+start+'</span></div>' : '') +
        (expiry ? '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="color:#64748b;font-size:13px">תפוגה</span><span style="font-weight:600;font-size:13px">'+expiry+'</span></div>' : '') +
        (sessions ? '<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:#64748b;font-size:13px">כניסות</span><span style="font-weight:600;font-size:13px">'+sessions+'</span></div>' : '') +
        '</div>' +
        (pct !== null ? '<div style="margin-bottom:16px"><div style="font-size:11px;color:#94a3b8;text-align:right;margin-bottom:4px">ניצול</div><div style="background:#e2e8f0;border-radius:8px;height:10px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:8px"></div></div><div style="font-size:11px;color:#94a3b8;text-align:left;margin-top:2px">'+pct+'%</div></div>' : '') +
        (m.status === 'active' ? '<div id="sc-selfcheckin-wrap" style="margin-bottom:16px;text-align:center"><button id="sc-selfcheckin-btn" style="width:100%;padding:13px;border:none;border-radius:14px;background:'+color+';color:#fff;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:0.3px">✅ צ׳ק-אין עצמי — כניסה עכשיו</button><div id="sc-selfcheckin-msg" style="font-size:12px;margin-top:8px;display:none"></div></div>' : '') +
        (m.qr_token ? '<div style="text-align:center;margin-bottom:16px"><div style="font-size:11px;color:#94a3b8;margin-bottom:8px">קוד כניסה אישי — הצג בכניסה למועדון</div><div id="sc-mem-qr" style="display:inline-block;padding:12px;background:#fff;border:3px solid '+color+'25;border-radius:14px;line-height:0"></div><div style="font-size:10px;color:#94a3b8;margin-top:8px;letter-spacing:2px;font-family:monospace">'+m.qr_token.slice(-8).toUpperCase()+'</div></div>' : '') +
        '<div style="font-size:11px;color:#94a3b8;text-align:center;padding:8px">מספר מנוי: #'+m.id+'</div>';
    sheet.appendChild(inner);

    // Generate real QR code
    if (m.qr_token) {
        var qrContainer = sheet.querySelector('#sc-mem-qr');
        if (qrContainer) _scDrawQR(qrContainer, m.qr_token);
    }

    // Self check-in button
    var scBtn = sheet.querySelector('#sc-selfcheckin-btn');
    var scMsg = sheet.querySelector('#sc-selfcheckin-msg');
    if (scBtn && scMsg) {
        scBtn.addEventListener('click', async function() {
            var gid = window._scBizId || new URLSearchParams(location.search).get('store') || '';
            var phone = (window._scAuth && window._scAuth._customer && window._scAuth._customer.phone) || '';
            if (!gid || !phone) { scMsg.style.display='block'; scMsg.style.color='#ef4444'; scMsg.textContent='שגיאה: לא זוהה לקוח מחובר'; return; }
            scBtn.disabled = true; scBtn.textContent = 'שולח...';
            try {
                var r = await fetch('/api/sport/self-checkin', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groupId: gid, phone: phone }) });
                var d = await r.json();
                if (d.success) {
                    scBtn.style.background = '#10b981'; scBtn.textContent = '✅ נרשמת בהצלחה!';
                    scMsg.style.display='block'; scMsg.style.color='#10b981';
                    scMsg.textContent = 'כניסה נרשמה' + (d.sessionsLeft !== null ? ' · נותרו ' + d.sessionsLeft + ' כניסות' : '');
                } else {
                    scBtn.disabled = false; scBtn.textContent = '✅ צ׳ק-אין עצמי — כניסה עכשיו';
                    scMsg.style.display='block'; scMsg.style.color='#f59e0b';
                    scMsg.textContent = d.error || 'שגיאה';
                }
            } catch(e) {
                scBtn.disabled = false; scBtn.textContent = '✅ צ׳ק-אין עצמי — כניסה עכשיו';
                scMsg.style.display='block'; scMsg.style.color='#ef4444'; scMsg.textContent = 'שגיאת רשת';
            }
        });
    }
}

function _scDrawQR(container, text) {
    function doRender() {
        container.innerHTML = '';
        new window.QRCode(container, {
            text: text,
            width: 180,
            height: 180,
            colorDark: '#1e293b',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M
        });
    }
    if (window.QRCode) {
        doRender();
    } else {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        s.onload = doRender;
        document.head.appendChild(s);
    }
}

// ─── Inline sport panels — self-contained, no storefront DOM dependency ───────

function _scOpenSportPanel(action, gid, customer) {
    var ex = document.getElementById('sc-sport-overlay');
    if (ex) ex.remove();
    var overlay = document.createElement('div');
    overlay.id = 'sc-sport-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif';
    overlay.dir = 'rtl';
    var sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-height:88vh;background:#fff;border-radius:20px 20px 0 0;overflow:hidden;display:flex;flex-direction:column';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    var phone = (customer && customer.phone) || '';
    var name = customer ? ((customer.first_name || '') + ' ' + (customer.last_name || '')).trim() : '';
    if (action === 'schedule') _scSchedulePanel(sheet, gid, phone, name);
    else if (action === 'trainer') _scTrainerPanel(sheet, gid, phone, name);
    else if (action === 'membership') _scMembershipPanel(sheet, gid, phone, name);
}

// ─── Restaurant table booking panel ───────────────────────────────────────────

function _scRestaurantTablePanel(gid, customer) {
    var ex = document.getElementById('sc-restaurant-overlay');
    if (ex) ex.remove();
    var overlay = document.createElement('div');
    overlay.id = 'sc-restaurant-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif';
    overlay.dir = 'rtl';
    var sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-height:92vh;background:#fff;border-radius:20px 20px 0 0;overflow:hidden;display:flex;flex-direction:column';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    var phone = (customer && customer.phone) || '';
    var name = customer ? ((customer.first_name || '') + ' ' + (customer.last_name || '')).trim() : '';

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9;flex-shrink:0';
    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:16px;font-weight:700;color:#1e293b';
    titleEl.textContent = '🪑 הזמנת שולחן';
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;padding:0;line-height:1';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function() { overlay.remove(); });
    hdr.appendChild(titleEl); hdr.appendChild(closeBtn);
    sheet.appendChild(hdr);

    var body = document.createElement('div');
    body.style.cssText = 'overflow-y:auto;flex:1;padding:16px 20px;-webkit-overflow-scrolling:touch';
    sheet.appendChild(body);

    var today = new Date().toISOString().slice(0,10);
    var state = { step: 1, date: today, guests: 2, time: '', availableSlots: [] };

    function renderStep() {
        body.innerHTML = '';
        if (state.step === 1) {
            // Step 1: בחר תאריך + אורחים
            body.innerHTML = '<div style="font-size:13px;color:#64748b;text-align:right;margin-bottom:14px">שלב 1 / 3 — בחר תאריך ומספר סועדים</div>'
                + '<div style="margin-bottom:12px">'
                + '<label style="display:block;text-align:right;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">📅 תאריך</label>'
                + '<input id="rt-date" type="date" min="'+today+'" value="'+state.date+'" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;box-sizing:border-box">'
                + '</div>'
                + '<div style="margin-bottom:16px">'
                + '<label style="display:block;text-align:right;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">👥 מספר סועדים</label>'
                + '<div style="display:flex;align-items:center;gap:12px;justify-content:center;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px">'
                + '<button id="rt-minus" style="width:36px;height:36px;border:1.5px solid #e2e8f0;border-radius:50%;background:#f8fafc;font-size:18px;cursor:pointer">−</button>'
                + '<span id="rt-guests" style="font-size:18px;font-weight:700;color:#1e293b;min-width:30px;text-align:center">'+state.guests+'</span>'
                + '<button id="rt-plus" style="width:36px;height:36px;border:1.5px solid #e2e8f0;border-radius:50%;background:#f8fafc;font-size:18px;cursor:pointer">+</button>'
                + '</div></div>'
                + '<button id="rt-check-avail" style="width:100%;padding:14px;background:#f97316;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">בדוק זמינות →</button>';

            body.querySelector('#rt-minus').addEventListener('click', function() {
                if (state.guests > 1) { state.guests--; body.querySelector('#rt-guests').textContent = state.guests; }
            });
            body.querySelector('#rt-plus').addEventListener('click', function() {
                if (state.guests < 20) { state.guests++; body.querySelector('#rt-guests').textContent = state.guests; }
            });
            body.querySelector('#rt-check-avail').addEventListener('click', function() {
                state.date = body.querySelector('#rt-date').value;
                var btn = body.querySelector('#rt-check-avail');
                btn.disabled = true; btn.textContent = 'טוען...';
                fetch('/api/public/restaurants/' + gid + '/availability/' + state.date + '?guests=' + state.guests)
                    .then(function(r){ return r.json(); })
                    .then(function(res) {
                        state.availableSlots = (res.slots || []);
                        state.step = 2;
                        renderStep();
                    })
                    .catch(function() { btn.disabled=false; btn.textContent='שגיאת רשת — נסה שוב'; });
            });
        } else if (state.step === 2) {
            // Step 2: בחר שעה
            var dateStr = new Date(state.date+'T12:00:00').toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});
            body.innerHTML = '<div style="font-size:13px;color:#64748b;text-align:right;margin-bottom:14px">שלב 2 / 3 — בחר שעה</div>'
                + '<div style="text-align:right;font-size:14px;font-weight:600;color:#1e293b;margin-bottom:12px">'+dateStr+' · '+state.guests+' סועדים</div>';
            if (!state.availableSlots.length) {
                body.innerHTML += '<div style="background:#fef2f2;border-radius:12px;padding:16px;text-align:right;color:#b91c1c;font-size:13px">אין שעות פנויות בתאריך זה. נסה תאריך אחר.</div>'
                    + '<button id="rt-back" style="margin-top:12px;width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:14px;cursor:pointer;color:#475569">← חזור</button>';
                body.querySelector('#rt-back').addEventListener('click', function() { state.step=1; renderStep(); });
                return;
            }
            var slotsHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">';
            state.availableSlots.forEach(function(slot) {
                slotsHtml += '<button data-slot="'+slot.time+'" style="padding:12px 6px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:14px;font-weight:600;cursor:pointer;color:#1e293b;text-align:center">'+slot.time+(slot.table ? '<br><span style=\'font-size:10px;color:#94a3b8\'>שולחן '+slot.table+'</span>' : '')+'</button>';
            });
            slotsHtml += '</div>';
            slotsHtml += '<button id="rt-back" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:14px;cursor:pointer;color:#475569">← חזור</button>';
            body.innerHTML += slotsHtml;
            body.querySelectorAll('[data-slot]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    state.time = btn.getAttribute('data-slot');
                    state.step = 3;
                    renderStep();
                });
            });
            body.querySelector('#rt-back').addEventListener('click', function() { state.step=1; renderStep(); });
        } else if (state.step === 3) {
            // Step 3: אישור + שליחת SMS
            var dateStr2 = new Date(state.date+'T12:00:00').toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});
            body.innerHTML = '<div style="font-size:13px;color:#64748b;text-align:right;margin-bottom:14px">שלב 3 / 3 — אישור הזמנה</div>'
                + '<div style="background:#f8fafc;border-radius:14px;padding:16px;margin-bottom:16px;text-align:right">'
                + '<div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:8px">פרטי ההזמנה</div>'
                + '<div style="font-size:13px;color:#475569;display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span>👥 סועדים</span><span style="font-weight:600">'+state.guests+'</span></div>'
                + '<div style="font-size:13px;color:#475569;display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span>📅 תאריך</span><span style="font-weight:600">'+dateStr2+'</span></div>'
                + '<div style="font-size:13px;color:#475569;display:flex;justify-content:space-between;padding:6px 0"><span>🕐 שעה</span><span style="font-weight:600">'+state.time+'</span></div>'
                + '</div>'
                + '<div style="margin-bottom:12px">'
                + '<label style="display:block;text-align:right;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">📝 בקשות מיוחדות (אופציונלי)</label>'
                + '<textarea id="rt-notes" rows="2" placeholder="אלרגיות, מושב מיוחד, אירוע..." style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;text-align:right;box-sizing:border-box;resize:none"></textarea>'
                + '</div>';

            if (!phone) {
                body.innerHTML += '<div style="margin-bottom:12px">'
                    + '<label style="display:block;text-align:right;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">📱 מספר טלפון לאישור</label>'
                    + '<input id="rt-phone" type="tel" placeholder="05X-XXXXXXX" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;direction:ltr;text-align:center;box-sizing:border-box">'
                    + '</div>';
            }
            body.innerHTML += '<button id="rt-confirm" style="width:100%;padding:14px;background:#f97316;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">שלח הזמנה ואישור SMS</button>'
                + '<button id="rt-back2" style="margin-top:10px;width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:14px;cursor:pointer;color:#475569">← חזור</button>';

            body.querySelector('#rt-back2').addEventListener('click', function() { state.step=2; renderStep(); });
            body.querySelector('#rt-confirm').addEventListener('click', function() {
                var confirmPhone = phone || (body.querySelector('#rt-phone') && body.querySelector('#rt-phone').value.trim()) || '';
                if (!confirmPhone) { alert('נא להזין מספר טלפון'); return; }
                var notes = body.querySelector('#rt-notes').value.trim();
                var btn = body.querySelector('#rt-confirm');
                btn.disabled = true; btn.textContent = 'שולח...';
                fetch('/api/public/restaurants/' + gid + '/book-table', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ date: state.date, time: state.time, numGuests: state.guests, guests: state.guests, phone: confirmPhone, name: name || confirmPhone, notes: notes })
                }).then(function(r){ return r.json(); }).then(function(res) {
                    if (res.success || res.tempId) {
                        var verTempId = res.tempId;
                        body.innerHTML = '<div style="text-align:center;padding:30px 0">'
                            + '<div style="font-size:48px;margin-bottom:12px">✅</div>'
                            + '<div style="font-size:17px;font-weight:700;color:#1e293b;margin-bottom:8px">ההזמנה נשלחה!</div>'
                            + '<div style="font-size:13px;color:#64748b">קוד אימות נשלח ל-SMS למספר '+confirmPhone+'</div>'
                            + (verTempId ? '<div style="margin-top:16px"><input id="rt-sms-code" placeholder="קוד אימות מה-SMS" style="width:140px;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:16px;text-align:center;letter-spacing:4px"></div>'
                            + '<button id="rt-verify" style="margin-top:10px;padding:12px 24px;background:#f97316;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer">אמת קוד</button>' : '')
                            + '</div>';
                        if (verTempId) {
                            body.querySelector('#rt-verify').addEventListener('click', function() {
                                var code = body.querySelector('#rt-sms-code').value.trim();
                                if (!code) return;
                                var vBtn = body.querySelector('#rt-verify');
                                vBtn.disabled=true; vBtn.textContent='מאמת...';
                                fetch('/api/public/restaurants/' + gid + '/verify-table-sms', {
                                    method: 'POST',
                                    headers: {'Content-Type':'application/json'},
                                    body: JSON.stringify({ tempId: verTempId, code: code })
                                }).then(function(r){ return r.json(); }).then(function(vRes) {
                                    if (vRes.success) {
                                        body.innerHTML = '<div style="text-align:center;padding:30px 0">'
                                            + '<div style="font-size:48px;margin-bottom:12px">🎉</div>'
                                            + '<div style="font-size:17px;font-weight:700;color:#1e293b;margin-bottom:8px">ההזמנה אושרה!</div>'
                                            + '<div style="font-size:13px;color:#64748b">נשמח לראותך. פרטי ההזמנה נשמרו.</div>'
                                            + '<button id="rt-close" style="margin-top:20px;padding:12px 28px;background:#f97316;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer">סגור</button>'
                                            + '</div>';
                                        body.querySelector('#rt-close').addEventListener('click', function() { overlay.remove(); });
                                    } else {
                                        vBtn.disabled=false; vBtn.textContent='נסה שוב';
                                        body.querySelector('#rt-sms-code').style.borderColor='#ef4444';
                                    }
                                }).catch(function() { vBtn.disabled=false; vBtn.textContent='שגיאת רשת'; });
                            });
                        }
                    } else {
                        btn.disabled=false; btn.textContent = 'שלח הזמנה ואישור SMS';
                        var errDiv = document.createElement('div');
                        errDiv.style.cssText = 'color:#ef4444;font-size:12px;text-align:right;margin-top:8px';
                        errDiv.textContent = res.error || 'שגיאה — נסה שוב';
                        body.appendChild(errDiv);
                    }
                }).catch(function() { btn.disabled=false; btn.textContent='שלח הזמנה ואישור SMS'; });
            });
        }
    }

    renderStep();
}

function _scPanelHeader(title) {
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9;flex-shrink:0';
    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:16px;font-weight:700;color:#1e293b';
    titleEl.textContent = title;
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;padding:0;line-height:1';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function() { var o = document.getElementById('sc-sport-overlay'); if (o) o.remove(); });
    hdr.appendChild(titleEl);
    hdr.appendChild(closeBtn);
    return hdr;
}

function _scPanelBody() {
    var body = document.createElement('div');
    body.style.cssText = 'overflow-y:auto;flex:1;padding:16px 20px;-webkit-overflow-scrolling:touch';
    return body;
}

function _scTodayStr() { return new Date().toISOString().slice(0,10); }
function _scDateAhead(n) { var d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

// ── Schedule ──────────────────────────────────────────────────────────────────
function _scSchedulePanel(sheet, gid, phone, name) {
    sheet.appendChild(_scPanelHeader('📋 לוח שיעורים'));
    var body = _scPanelBody();
    body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px">טוען...</div>';
    sheet.appendChild(body);
    fetch('/api/sport/public-schedule/' + gid + '?from=' + _scTodayStr() + '&to=' + _scDateAhead(14))
    .then(function(r) { return r.json(); })
    .then(function(d) {
        var classes = (d && d.classes) || [];
        if (!classes.length) { body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px">אין שיעורים בשבועיים הקרובים</div>'; return; }
        var byDate = {};
        classes.forEach(function(c) {
            var dk = c.class_date instanceof Date ? c.class_date.toISOString().slice(0,10) : String(c.class_date).slice(0,10);
            (byDate[dk] = byDate[dk] || []).push(c);
        });
        var html = '';
        Object.keys(byDate).sort().forEach(function(date) {
            var dObj = new Date(date + 'T12:00:00');
            html += '<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:12px 0 6px">' +
                dObj.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long'}) + '</div>';
            byDate[date].forEach(function(c) {
                var t = [c.start_time, c.end_time].filter(Boolean).map(function(x){return x.slice(0,5);}).join(' — ');
                var full = c.capacity && (c.registered_count||0) >= c.capacity;
                var btnAttr = c.id && phone ? ' data-cid="' + c.id + '" data-cname="' + (c.class_name||'שיעור').replace(/"/g,'') + '"' : '';
                html += '<div style="background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:8px">' +
                    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
                    '<div style="flex:1">' +
                    '<div style="font-weight:700;font-size:14px;color:#1e293b">' + (c.class_name||'שיעור') + '</div>' +
                    '<div style="font-size:12px;color:#64748b;margin-top:3px">' + t + (c.trainer_name?' · '+c.trainer_name:'') + '</div>' +
                    (c.capacity ? '<div style="font-size:11px;color:#94a3b8">' + (c.registered_count||0) + '/' + c.capacity + ' משתתפים</div>' : '') +
                    '</div>' +
                    (btnAttr ? '<button' + btnAttr + ' style="padding:7px 14px;background:' + (full?'#f1f5f9':'#6366f1') + ';color:' + (full?'#94a3b8':'#fff') + ';border:none;border-radius:8px;font-size:12px;cursor:pointer;white-space:nowrap;flex-shrink:0">' + (full?'המתנה':'הירשם') + '</button>' : '') +
                    '</div></div>';
            });
        });
        body.innerHTML = html;
        body.querySelectorAll('[data-cid]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                btn.disabled = true; btn.textContent = '...';
                fetch('/api/sport/public-class-register', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({groupId:gid, classId:btn.getAttribute('data-cid'), memberPhone:phone, memberName:name})
                }).then(function(r){return r.json();}).then(function(res) {
                    if (res.status === 'registered') { btn.textContent = '✓ נרשמת'; btn.style.background = '#10b981'; }
                    else if (res.status === 'waitlisted') { btn.textContent = '⏳ #' + (res.waitlistPosition||''); btn.style.background = '#f59e0b'; btn.style.color = '#fff'; }
                    else { btn.disabled = false; btn.textContent = res.error || 'שגיאה'; btn.style.background = '#ef4444'; btn.style.color = '#fff'; }
                }).catch(function() { btn.disabled = false; btn.textContent = 'שגיאה'; btn.style.background = '#ef4444'; btn.style.color = '#fff'; });
            });
        });
    })
    .catch(function() { body.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px">שגיאת טעינה</div>'; });
}

// ── Trainer booking ───────────────────────────────────────────────────────────
function _scTrainerPanel(sheet, gid, phone, name) {
    sheet.appendChild(_scPanelHeader('📅 הזמנת אימון אישי'));
    var body = _scPanelBody();
    body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px">טוען מאמנים...</div>';
    sheet.appendChild(body);
    var st = {};

    function backBtn(onClick) {
        var b = document.createElement('button');
        b.style.cssText = 'background:none;border:none;cursor:pointer;font-size:20px;color:#6366f1;padding:0 8px 0 0;margin-bottom:12px;display:block';
        b.textContent = '← חזרה';
        b.addEventListener('click', onClick);
        return b;
    }

    function step1() {
        fetch('/api/sport/trainers/' + gid).then(function(r){return r.json();}).then(function(res) {
            var trainers = Array.isArray(res) ? res : (res.trainers || res.data || []);
            if (!trainers.length) { body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px">אין מאמנים זמינים</div>'; return; }
            body.innerHTML = '<div style="font-size:13px;color:#64748b;margin-bottom:10px">בחר/י מאמן:</div>';
            trainers.forEach(function(t) {
                var el = document.createElement('div');
                el.style.cssText = 'background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;border:2px solid #f1f5f9';
                el.innerHTML = '<div style="font-weight:700;font-size:15px;color:#1e293b">' + (t.full_name||t.name||'מאמן') + '</div>' +
                    (t.specialties ? '<div style="font-size:12px;color:#64748b;margin-top:3px">' + t.specialties + '</div>' : '');
                el.addEventListener('click', function() { st.trainerId = t.id; st.trainerName = t.full_name||t.name||'מאמן'; step2(); });
                body.appendChild(el);
            });
        }).catch(function() { body.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px">שגיאת טעינה</div>'; });
    }

    function step2() {
        body.innerHTML = '';
        body.appendChild(backBtn(step1));
        var lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:13px;color:#64748b;margin-bottom:6px';
        lbl.textContent = 'מאמן: ' + st.trainerName + ' — בחר/י תאריך:';
        body.appendChild(lbl);
        var hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:#94a3b8;margin-bottom:10px;text-align:right';
        hint.textContent = 'טוען זמינות...';
        body.appendChild(hint);
        var grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
        var dayBtns = {};
        for (var i = 0; i < 14; i++) {
            (function(i) {
                var d = new Date(); d.setDate(d.getDate()+i);
                var ds = d.toISOString().slice(0,10);
                var btn = document.createElement('button');
                btn.style.cssText = 'padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:12px;cursor:default;color:#94a3b8;min-width:80px;text-align:center';
                btn.innerHTML = '<div>' + d.toLocaleDateString('he-IL', {weekday:'short', day:'numeric', month:'short'}) + '</div><div style="font-size:10px;margin-top:2px">...</div>';
                btn.disabled = true;
                dayBtns[ds] = btn;
                grid.appendChild(btn);
            })(i);
        }
        body.appendChild(grid);

        // Fetch availability for all 14 days in parallel
        var pending = Object.keys(dayBtns).length;
        Object.keys(dayBtns).forEach(function(ds) {
            fetch('/api/sport/availability?groupId=' + gid + '&trainerId=' + (st.trainerId||'') + '&date=' + ds)
            .then(function(r){return r.json();})
            .then(function(res) {
                var slots = res.slots || [];
                var btn = dayBtns[ds];
                var d = new Date(ds + 'T12:00:00');
                var label = d.toLocaleDateString('he-IL', {weekday:'short', day:'numeric', month:'short'});
                if (slots.length > 0) {
                    btn.disabled = false;
                    btn.style.cursor = 'pointer';
                    btn.style.color = '#1e293b';
                    btn.style.background = '#fff';
                    btn.style.borderColor = '#6366f1';
                    btn.innerHTML = '<div>' + label + '</div><div style="font-size:10px;margin-top:2px;color:#10b981;font-weight:600">' + slots.length + ' שעות פנויות</div>';
                    btn.addEventListener('click', function() { st.date = ds; step3(); });
                } else {
                    btn.style.color = '#cbd5e1';
                    btn.innerHTML = '<div style="text-decoration:line-through">' + label + '</div><div style="font-size:10px;margin-top:2px;color:#e2e8f0">אין מקום</div>';
                }
            })
            .catch(function() {
                var btn = dayBtns[ds];
                btn.innerHTML = '<div>' + new Date(ds+'T12:00:00').toLocaleDateString('he-IL', {weekday:'short', day:'numeric', month:'short'}) + '</div><div style="font-size:10px;color:#e2e8f0">—</div>';
            })
            .finally(function() {
                pending--;
                if (pending === 0) { hint.textContent = 'בחר/י יום עם שעות פנויות:'; }
            });
        });
    }

    function step3() {
        body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px">טוען שעות...</div>';
        fetch('/api/sport/availability?groupId=' + gid + '&trainerId=' + (st.trainerId||'') + '&date=' + st.date)
        .then(function(r){return r.json();}).then(function(slots) {
            body.innerHTML = '';
            body.appendChild(backBtn(step2));
            var lbl = document.createElement('div');
            lbl.style.cssText = 'font-size:13px;color:#64748b;margin-bottom:10px';
            lbl.textContent = st.trainerName + ' · ' + st.date + ' — בחר/י שעה:';
            body.appendChild(lbl);
            if (!slots || !slots.length) { var noSlots = document.createElement('div'); noSlots.style.cssText = 'text-align:center;color:#94a3b8;padding:20px'; noSlots.textContent = 'אין שעות פנויות'; body.appendChild(noSlots); return; }
            var grid = document.createElement('div');
            grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
            slots.forEach(function(s) {
                var start = s.start || s.startTime || s;
                var end = s.end || s.endTime || '';
                var btn = document.createElement('button');
                btn.style.cssText = 'padding:10px 16px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:13px;cursor:pointer;color:#475569;font-weight:600';
                btn.textContent = ('' + start).slice(0,5);
                btn.addEventListener('click', function() { st.slot = {start: start, end: end}; step4(); });
                grid.appendChild(btn);
            });
            body.appendChild(grid);
        }).catch(function() { body.innerHTML = '<div style="text-align:center;color:#ef4444;padding:30px">שגיאת טעינה</div>'; });
    }

    function step4() {
        body.innerHTML = '';
        body.appendChild(backBtn(step3));
        var summary = document.createElement('div');
        summary.style.cssText = 'font-size:13px;color:#64748b;margin-bottom:16px;background:#f8fafc;padding:10px;border-radius:10px';
        summary.textContent = st.trainerName + ' · ' + st.date + ' · ' + ('' + st.slot.start).slice(0,5);
        body.appendChild(summary);
        var fields = [
            {id:'tbk-name', label:'שם מלא', type:'text', val:name},
            {id:'tbk-phone', label:'טלפון', type:'tel', val:phone, ltr:true},
            {id:'tbk-notes', label:'הערות (אופציונלי)', type:'textarea'}
        ];
        fields.forEach(function(f) {
            var wrap = document.createElement('div'); wrap.style.marginBottom = '10px';
            var lbl = document.createElement('label');
            lbl.style.cssText = 'display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-align:right';
            lbl.textContent = f.label;
            wrap.appendChild(lbl);
            var inp;
            if (f.type === 'textarea') { inp = document.createElement('textarea'); inp.rows = 2; inp.style.resize = 'none'; }
            else { inp = document.createElement('input'); inp.type = f.type; }
            inp.id = f.id;
            inp.style.cssText = 'width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;box-sizing:border-box;text-align:' + (f.ltr?'center':'right') + ';direction:' + (f.ltr?'ltr':'rtl');
            if (f.val) inp.value = f.val;
            wrap.appendChild(inp);
            body.appendChild(wrap);
        });
        var msg = document.createElement('div');
        msg.id = 'tbk-msg';
        msg.style.cssText = 'text-align:center;font-size:13px;min-height:16px;margin-top:4px';
        var submitBtn = document.createElement('button');
        submitBtn.style.cssText = 'width:100%;padding:13px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px';
        submitBtn.textContent = 'אשר הזמנה';
        submitBtn.addEventListener('click', function() {
            var n = document.getElementById('tbk-name').value.trim();
            var p = (document.getElementById('tbk-phone').value||'').replace(/\D/g,'');
            var notes = (document.getElementById('tbk-notes').value||'').trim();
            if (!n) { msg.style.color='#ef4444'; msg.textContent='נא להזין שם'; return; }
            submitBtn.disabled = true; submitBtn.textContent = 'שולח...';
            fetch('/api/sport/appointments', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({groupId:gid, clientName:n, clientPhone:p, trainerId:st.trainerId,
                    startTime:st.date+'T'+('' + st.slot.start).slice(0,5)+':00',
                    endTime:st.date+'T'+('' + (st.slot.end||st.slot.start)).slice(0,5)+':00',
                    notes:notes, serviceName:'אימון אישי'})
            }).then(function(r){return r.json();}).then(function(res) {
                if (res.id || res.success) {
                    body.innerHTML = '<div style="text-align:center;padding:40px">' +
                        '<div style="font-size:48px;margin-bottom:12px">✅</div>' +
                        '<div style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:8px">ההזמנה נשלחה!</div>' +
                        '<div style="font-size:14px;color:#64748b">' + st.trainerName + ' · ' + st.date + ' · ' + ('' + st.slot.start).slice(0,5) + '</div>' +
                        '<button id="tbk-close" style="margin-top:24px;padding:12px 32px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;cursor:pointer">סגור</button></div>';
                    document.getElementById('tbk-close').addEventListener('click', function() { var o=document.getElementById('sc-sport-overlay'); if(o) o.remove(); });
                } else {
                    submitBtn.disabled = false; submitBtn.textContent = 'אשר הזמנה';
                    msg.style.color='#ef4444'; msg.textContent = res.error||'שגיאה';
                }
            }).catch(function() { submitBtn.disabled=false; submitBtn.textContent='אשר הזמנה'; msg.style.color='#ef4444'; msg.textContent='שגיאת רשת'; });
        });
        body.appendChild(submitBtn);
        body.appendChild(msg);
    }

    step1();
}

// ── Membership purchase ───────────────────────────────────────────────────────
function _scMembershipPanel(sheet, gid, phone, name) {
    sheet.appendChild(_scPanelHeader('🏋️ רכישת מנוי'));
    var body = _scPanelBody();
    body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px">טוען...</div>';
    sheet.appendChild(body);

    function step1() {
        fetch('/api/sport/public-types/' + gid).then(function(r){return r.json();}).then(function(res) {
            var types = Array.isArray(res) ? res : (res.types || []);
            if (!types.length) { body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px">אין מנויים זמינים</div>'; return; }
            body.innerHTML = '<div style="font-size:13px;color:#64748b;margin-bottom:10px">בחר/י סוג מנוי:</div>';
            types.forEach(function(t) {
                var color = t.color || '#6366f1';
                var el = document.createElement('div');
                el.style.cssText = 'background:#f8fafc;border:2px solid ' + color + '30;border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer';
                el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">' +
                    '<div style="font-size:16px;font-weight:700;color:' + color + '">₪' + (t.price||0) + '</div>' +
                    '<div style="font-size:15px;font-weight:700;color:#1e293b">' + (t.name||'מנוי') + '</div></div>' +
                    (t.duration_days ? '<div style="font-size:12px;color:#64748b;margin-top:4px;text-align:right">תוקף: ' + t.duration_days + ' ימים</div>' : '') +
                    (t.sessions ? '<div style="font-size:12px;color:#64748b;text-align:right">' + t.sessions + ' כניסות</div>' : '');
                el.addEventListener('click', function() { step2(t); });
                body.appendChild(el);
            });
        }).catch(function() { body.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px">שגיאת טעינה</div>'; });
    }

    function step2(type) {
        body.innerHTML = '';
        var backBtn = document.createElement('button');
        backBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:20px;color:#6366f1;padding:0 8px 0 0;margin-bottom:12px;display:block';
        backBtn.textContent = '← חזרה';
        backBtn.addEventListener('click', step1);
        body.appendChild(backBtn);
        var summary = document.createElement('div');
        summary.style.cssText = 'font-size:14px;font-weight:700;color:#1e293b;margin-bottom:14px;background:#f8fafc;padding:10px;border-radius:10px;text-align:right';
        summary.textContent = (type.name||'מנוי') + ' · ₪' + (type.price||0);
        body.appendChild(summary);
        var fields = [
            {id:'mem-name', label:'שם מלא', type:'text', val:name},
            {id:'mem-phone', label:'טלפון', type:'tel', val:phone, ltr:true},
            {id:'mem-email', label:'אימייל (אופציונלי)', type:'email', ltr:true}
        ];
        fields.forEach(function(f) {
            var wrap = document.createElement('div'); wrap.style.marginBottom = '10px';
            var lbl = document.createElement('label');
            lbl.style.cssText = 'display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-align:right';
            lbl.textContent = f.label;
            wrap.appendChild(lbl);
            var inp = document.createElement('input'); inp.type = f.type; inp.id = f.id;
            inp.style.cssText = 'width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;font-size:14px;box-sizing:border-box;text-align:' + (f.ltr?'center':'right') + ';direction:' + (f.ltr?'ltr':'rtl');
            if (f.val) inp.value = f.val;
            wrap.appendChild(inp);
            body.appendChild(wrap);
        });
        var msg = document.createElement('div');
        msg.style.cssText = 'text-align:center;font-size:12px;color:#94a3b8;margin:4px 0;text-align:right';
        msg.textContent = 'לאחר הרישום הנהלת המועדון תיצור איתך קשר';
        body.appendChild(msg);
        var errMsg = document.createElement('div');
        errMsg.style.cssText = 'text-align:center;font-size:13px;min-height:16px';
        var submitBtn = document.createElement('button');
        submitBtn.style.cssText = 'width:100%;padding:13px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px';
        submitBtn.textContent = 'הירשם · ₪' + (type.price||0);
        submitBtn.addEventListener('click', function() {
            var n = document.getElementById('mem-name').value.trim();
            var p = (document.getElementById('mem-phone').value||'').replace(/\D/g,'');
            var email = (document.getElementById('mem-email').value||'').trim();
            if (!n) { errMsg.style.color='#ef4444'; errMsg.textContent='נא להזין שם'; return; }
            submitBtn.disabled = true; submitBtn.textContent = 'שולח...';
            fetch('/api/sport/public-membership-purchase', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({groupId:gid, memberName:n, memberPhone:p, memberEmail:email, membershipTypeId:type.id})
            }).then(function(r){return r.json();}).then(function(res) {
                if (res.memberId || res.success) {
                    body.innerHTML = '<div style="text-align:center;padding:40px">' +
                        '<div style="font-size:48px;margin-bottom:12px">🎉</div>' +
                        '<div style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:8px">הבקשה נשלחה!</div>' +
                        '<div style="font-size:14px;color:#64748b">' + (type.name||'מנוי') + '</div>' +
                        (res.endDate ? '<div style="font-size:13px;color:#94a3b8;margin-top:6px">בתוקף עד ' + res.endDate + '</div>' : '') +
                        '<div style="font-size:13px;color:#f59e0b;margin-top:12px;font-weight:600">⏳ ממתין לאישור המועדון</div>' +
                        '<div style="font-size:12px;color:#94a3b8;margin-top:6px">הנהלת המועדון תאשר ותיצור איתך קשר לתשלום</div>' +
                        '<button id="mem-close" style="margin-top:24px;padding:12px 32px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;cursor:pointer">סגור</button></div>';
                    document.getElementById('mem-close').addEventListener('click', function() { var o=document.getElementById('sc-sport-overlay'); if(o) o.remove(); });
                } else {
                    submitBtn.disabled = false; submitBtn.textContent = 'הירשם · ₪' + (type.price||0);
                    errMsg.style.color='#ef4444'; errMsg.textContent = res.error||'שגיאה';
                }
            }).catch(function() { submitBtn.disabled=false; submitBtn.textContent='הירשם · ₪'+(type.price||0); errMsg.style.color='#ef4444'; errMsg.textContent='שגיאת רשת'; });
        });
        body.appendChild(submitBtn);
        body.appendChild(errMsg);
    }

    step1();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scAuth.init());
} else {
    scAuth.init();
}

})();
