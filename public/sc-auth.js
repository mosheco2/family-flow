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
            const { orders=[], bookings=[], classRegs=[], memberships=[], businessType='' } = r;
            // also store for future use
            if (businessType) window._scBizType = businessType;
            let html = '';

            if (memberships.length) {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 4px;text-align:right">🏆 מנוי פעיל</div>`;
                html += memberships.map(m => {
                    const color = m.type_color || '#6366f1';
                    const expiry = m.end_date ? new Date(m.end_date).toLocaleDateString('he-IL',{day:'numeric',month:'short',year:'numeric'}) : '';
                    const sessions = m.sessions_limit ? `${m.sessions_used||0}/${m.sessions_limit} כניסות` : '';
                    return `<div style="border:2px solid ${color}30;border-radius:12px;padding:12px;margin-bottom:8px;background:${color}08">
                      <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="font-size:11px;font-weight:700;color:${color};background:${color}20;padding:3px 8px;border-radius:8px">${m.status==='trial'?'ניסיון':'פעיל'}</span>
                        <span style="font-size:14px;font-weight:700;color:#1e293b;text-align:right">${m.type_name||'מנוי'}</span>
                      </div>
                      ${expiry ? `<div style="font-size:11px;color:#64748b;text-align:right;margin-top:4px">בתוקף עד: ${expiry}</div>` : ''}
                      ${sessions ? `<div style="font-size:11px;color:#64748b;text-align:right">${sessions}</div>` : ''}
                    </div>`;
                }).join('');
            }

            if (orders.length) {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 4px;text-align:right">📦 הזמנות</div>`;
                html += orders.map(o => {
                    const statusColors = { new:'#f59e0b', confirmed:'#3b82f6', ready:'#8b5cf6', delivered:'#10b981', cancelled:'#ef4444' };
                    const statusLabels = { new:'חדשה', confirmed:'אושרה', ready:'מוכן', delivered:'נמסר', cancelled:'בוטלה' };
                    return `<div style="border:1px solid #f1f5f9;border-radius:12px;padding:12px;margin-bottom:8px">
                      <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="font-size:12px;font-weight:700;color:${statusColors[o.status]||'#64748b'};background:${statusColors[o.status]||'#64748b'}15;padding:3px 8px;border-radius:8px">${statusLabels[o.status]||o.status}</span>
                        <span style="font-size:13px;font-weight:700;color:#1e293b">₪${parseFloat(o.total_amount||0).toFixed(0)}</span>
                      </div>
                      <div style="font-size:11px;color:#94a3b8;text-align:right;margin-top:4px">${new Date(o.created_at).toLocaleDateString('he-IL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                    </div>`;
                }).join('');
            }

            if (bookings.length) {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 4px;text-align:right">📅 תורים</div>`;
                html += bookings.map(b => `<div style="border:1px solid #f1f5f9;border-radius:12px;padding:12px;margin-bottom:8px">
                  <div style="font-weight:600;font-size:14px;color:#1e293b;text-align:right">${b.title||'תור'}</div>
                  <div style="font-size:12px;color:#64748b;text-align:right;margin-top:3px">${b.event_date||''} ${b.start_time?.slice(0,5)||''}</div>
                </div>`).join('');
            }

            if (classRegs.length) {
                html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;padding:8px 0 4px;text-align:right">🏋️ שיעורים</div>`;
                html += classRegs.map(c => `<div style="border:1px solid #f1f5f9;border-radius:12px;padding:12px;margin-bottom:8px">
                  <div style="font-weight:600;font-size:14px;color:#1e293b;text-align:right">${c.class_name||'שיעור'}</div>
                  <div style="font-size:12px;color:#64748b;text-align:right;margin-top:3px">${c.class_date||''} ${c.start_time?.slice(0,5)||''}</div>
                </div>`).join('');
            }

            // Business-type quick actions (shown after login)
            const _bizType = businessType || window._scBizType || '';
            if (_bizType === 'sport') {
                const _sp = window.storeData?.settings?.sport_settings;
                const _spObj = _sp ? (typeof _sp === 'string' ? JSON.parse(_sp) : _sp) : {};
                const sportBtns = [];
                if (_spObj.public_show_schedule !== false)
                    sportBtns.push(`<button onclick="_scSportAction('schedule')" style="flex:1;min-width:100px;padding:10px 8px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:12.5px;cursor:pointer;color:#475569;text-align:center">📋 לוח שיעורים</button>`);
                if (_spObj.public_show_trainer !== false)
                    sportBtns.push(`<button onclick="_scSportAction('trainer')" style="flex:1;min-width:100px;padding:10px 8px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:12.5px;cursor:pointer;color:#475569;text-align:center">📅 הזמן אימון</button>`);
                if (_spObj.public_show_membership !== false)
                    sportBtns.push(`<button onclick="_scSportAction('membership')" style="flex:1;min-width:100px;padding:10px 8px;border:1.5px solid #6366f1;border-radius:12px;background:#6366f115;font-size:12.5px;cursor:pointer;color:#6366f1;font-weight:700;text-align:center">🏋️ הצטרף כחבר</button>`);
                if (sportBtns.length) {
                    html = `<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #f1f5f9">
                      <div style="font-size:11px;font-weight:700;color:#94a3b8;padding:0 0 8px;text-align:right">⚡ פעולות מהירות</div>
                      <div style="display:flex;gap:8px;flex-wrap:wrap">${sportBtns.join('')}</div>
                    </div>` + html;
                }
            }

            if (!html) html = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:40px 0">אין פעילות עדיין עם העסק הזה</div>';

            // Add profile edit button
            html += `<div style="border-top:1px solid #f1f5f9;margin-top:12px;padding-top:12px">
              <button onclick="scAuth.openProfileEdit()" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:14px;cursor:pointer;color:#475569">✏️ עריכת פרופיל</button>
              <button onclick="scAuth.logout()" style="width:100%;padding:10px;border:none;background:none;font-size:13px;cursor:pointer;color:#94a3b8;margin-top:6px">יציאה</button>
            </div>`;
            list.innerHTML = html;
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

// Global sport action dispatcher — called from innerHTML buttons
window._scSportAction = function(action) {
    var panel = document.getElementById('sc-activity-panel');
    if (panel) panel.style.display = 'none';
    setTimeout(function() {
        try {
            if (action === 'schedule') {
                if (window.openScheduleModal) { window.openScheduleModal(); }
                else { alert('לוח שיעורים: הפונקציה לא נמצאה'); }
                return;
            }
            if (action === 'trainer') {
                if (window.openTrainerBooking) { window.openTrainerBooking(); }
                else { alert('הזמן אימון: הפונקציה לא נמצאה'); }
                return;
            }
            if (action === 'membership') {
                if (window.openMembershipModal) { window.openMembershipModal(); }
                else { alert('הצטרף כחבר: הפונקציה לא נמצאה'); }
                return;
            }
        } catch(e) { alert('שגיאה: ' + e.message); }
    }, 150);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scAuth.init());
} else {
    scAuth.init();
}

})();
