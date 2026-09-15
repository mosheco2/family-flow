// WEFLOWZ — Community Campaign public store page (visual language matches the "חמה" storefront template)
(function() {
    const params = new URLSearchParams(window.location.search);
    const campaignCode = window.__CAMPAIGN_CODE__ || params.get('c') || params.get('campaign') || '';

    let campaignData = null;
    let selectedBizFilter = 'all';
    let cart = []; // [{catalogId, businessGroupId, businessName, name, price, quantity, note}]
    let panelState = 'cart'; // 'cart' | 'checkout' | 'done'
    let _sheetId = null, _sheetQty = 1, _sheetExtras = {};

    function csSafe(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    function csToast(msg, ms) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.style.display = 'block';
        clearTimeout(window._csToastTimer);
        window._csToastTimer = setTimeout(() => { t.style.display = 'none'; }, ms || 2600);
    }

    async function init() {
        if (!campaignCode) {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('cs-title').textContent = 'קמפיין לא נמצא';
            document.getElementById('hero').style.display = 'block';
            document.getElementById('cs-products').innerHTML = '<div class="catalog-empty">לא צויין קוד קמפיין בכתובת</div>';
            return;
        }
        try {
            const res = await fetch(`/api/campaign/${encodeURIComponent(campaignCode)}`);
            const data = await res.json();
            document.getElementById('loading-screen').style.display = 'none';
            if (!data.success) {
                document.getElementById('cs-title').textContent = 'קמפיין לא זמין';
                document.getElementById('hero-sub').textContent = data.error || '';
                document.getElementById('hero').style.display = 'block';
                return;
            }
            campaignData = data;
            document.getElementById('main-header').style.display = 'block';
            document.getElementById('hero').style.display = 'block';
            document.getElementById('biz-nav-wrap').style.display = 'block';
            document.getElementById('store-footer').style.display = 'block';
            renderHeader();
            renderBizChips();
            renderProducts();
        } catch(e) {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('cs-title').textContent = 'שגיאת תקשורת';
            document.getElementById('hero').style.display = 'block';
        }
    }

    function renderHeader() {
        const c = campaignData.campaign;
        document.getElementById('cs-community-name').textContent = c.community_name || 'קמפיין קהילה';
        document.getElementById('header-name').textContent = c.title || c.community_name || 'קמפיין קהילה';
        document.getElementById('page-title').textContent = `${c.title || c.community_name || 'קמפיין קהילה'} | WEFLOWZ`;
        // הכותרת בתוך ה-hero מוסתרת אם הוגדר כך (למשל כשהיא כבר מופיעה גרפית בתמונת הנושא) או אם לא הוגדרה כותרת כלל
        if (c.hide_title || !c.title) {
            document.getElementById('cs-title').style.display = 'none';
        } else {
            document.getElementById('cs-title').textContent = c.title;
        }
        if (c.slogan) {
            const el = document.getElementById('hero-slogan');
            el.textContent = c.slogan;
            el.style.display = 'block';
        }
        document.getElementById('hero-sub').textContent = c.description || '';
        // הלוגו מוצג רק בכותרת העליונה הדביקה — בדיוק כמו בחנות הציבורית המקורית
        // של עסק (storefront-restaurant.html וכו'), ששם אין בכלל לוגו בתוך הבאנר
        if (c.logo_url) {
            const headerLogo = document.getElementById('header-logo');
            headerLogo.innerHTML = `<img src="${c.logo_url}">`;
        }
        if (c.banner_image_url) {
            // גודל/מיקום/חזרה נקבעים ב-CSS (כולל media query למסכים רחבים) —
            // כאן רק מחליפים את התמונה עצמה כדי לא לדרוס את ההתנהגות הרספונסיבית
            document.getElementById('hero').style.backgroundImage = `linear-gradient(rgba(17,17,19,.55),rgba(17,17,19,.55)), url('${c.banner_image_url}')`;
        }
    }

    function renderBizChips() {
        const wrap = document.getElementById('biz-nav');
        const chips = [{ group_id: 'all', name: 'הכל', logo_url: null }].concat(campaignData.businesses);
        wrap.innerHTML = chips.map(b => `
            <button onclick="csFilterBiz('${b.group_id}')" class="biz-pill ${selectedBizFilter == b.group_id ? 'active' : ''}">
                ${b.logo_url ? `<img src="${b.logo_url}">` : ''}
                ${csSafe(b.name)}
            </button>`).join('');
    }

    function renderProducts() {
        const grid = document.getElementById('cs-products');
        const items = selectedBizFilter === 'all'
            ? campaignData.products
            : campaignData.products.filter(p => String(p.group_id) === String(selectedBizFilter));
        if (!items.length) {
            grid.innerHTML = '<div class="catalog-empty" style="grid-column:1/-1">אין מוצרים להצגה</div>';
            return;
        }
        grid.innerHTML = items.map(p => `
            <div class="product-card">
                <div class="product-img-wrap">
                    ${p.has_image ? `<img src="/api/store/item-image/${p.id}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-image product-img-ph\\'></i>'">` : '<i class="fa-solid fa-box product-img-ph"></i>'}
                </div>
                <div class="product-body">
                    <span class="community-badge"><i class="fa-solid fa-store" style="font-size:9px"></i> ${csSafe(p.business_name)}</span>
                    <div class="product-name">${csSafe(p.name)}</div>
                    <div class="product-footer">
                        <span class="product-price">₪${parseFloat(p.price).toFixed(0)}</span>
                        <button class="add-pill" onclick="quickAdd(${p.id})">הוספה</button>
                    </div>
                </div>
            </div>`).join('');
    }

    // מוצר עם תוספות/מרכיבים לבחירה (options_text) — כמו בחנות הציבורית המקורית
    function hasOptions(p) {
        try { const o = JSON.parse(p.options_text || '[]'); return Array.isArray(o) && o.length > 0; } catch(e) { return false; }
    }

    function findProduct(id) { return (campaignData.products || []).find(x => x.id === id); }

    window.quickAdd = function(id) {
        const p = findProduct(id);
        if (!p) return;
        if (hasOptions(p)) { openSheet(id); return; }
        csAddToCart({ id: p.id, group_id: p.group_id, business_name: p.business_name, name: p.name, price: parseFloat(p.price) });
    };

    window.openSheet = function(id) {
        const p = findProduct(id);
        if (!p) return;
        // אותו כלל ברזל — לא ניתן לפתוח מוצר מעסק אחר כשיש כבר עגלה פעילה מעסק שונה
        if (campaignData?.campaign?.ordering_enabled === false) {
            csToast('שמחים שאתם נלהבים כמונו ממוצרי השוק, הם יהיו זמינים בקרוב - ניתן להתעדכן מול רכזת הקהילה', 4500);
            return;
        }
        if (cart.length && String(cart[0].businessGroupId) !== String(p.group_id)) {
            csOpenCart();
            csToast(`אפשר להזמין רק מעסק אחד — רוקנו את העגלה כדי לעבור ל-"${p.business_name}"`);
            return;
        }
        _sheetId = id; _sheetQty = 1; _sheetExtras = {};
        document.getElementById('sheet-name').textContent = p.name;
        document.getElementById('sheet-price').textContent = `₪${p.price}`;
        document.getElementById('sheet-desc').textContent = p.description || '';
        document.getElementById('sheet-meta-text').textContent = '';
        document.getElementById('sheet-qty-val').textContent = 1;
        document.getElementById('sheet-note-input').value = '';

        const imgEl = document.getElementById('sheet-img');
        if (p.has_image) {
            imgEl.innerHTML = `<img src="/api/store/item-image/${id}" alt="${csSafe(p.name)}" style="width:100%;height:100%;object-fit:cover"><button id="sheet-close" onclick="closeSheet()">✕</button>`;
        } else {
            imgEl.innerHTML = `<div id="sheet-img-ph" style="font-size:48px;opacity:.5">🍽️</div><button id="sheet-close" onclick="closeSheet()">✕</button>`;
        }

        let optHtml = '';
        try {
            const opts = JSON.parse(p.options_text || '[]');
            if (Array.isArray(opts) && opts.length) {
                optHtml = opts.map((g, gi) => `
                <div>
                    <div class="sheet-section-title">${csSafe(g.name || g.title || '')}</div>
                    ${(g.options || g.items || []).map((o, oi) => {
                        const nm = typeof o === 'string' ? o : (o.name || '');
                        const pr = typeof o === 'object' && o.price ? `+₪${o.price}` : '';
                        return `<button class="sheet-option" id="sopt-${gi}-${oi}" onclick="toggleOpt(${gi},${oi},'${g.type || 'single'}')">
                          <span class="opt-check" id="soptcheck-${gi}-${oi}"></span>
                          <span style="flex:1">${csSafe(nm)}</span>
                          ${pr ? `<span class="opt-extra-price">${pr}</span>` : ''}
                        </button>`;
                    }).join('')}
                </div>`).join('');
            }
        } catch(e) {}
        document.getElementById('sheet-options').innerHTML = optHtml;

        updateSheetTotal();
        document.getElementById('sheet-overlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.closeSheet = function() {
        document.getElementById('sheet-overlay').style.display = 'none';
        document.body.style.overflow = '';
    };

    window.toggleOpt = function(gi, oi, type) {
        if (!_sheetExtras[gi]) _sheetExtras[gi] = [];
        if (type === 'single' || type === 'radio') {
            _sheetExtras[gi] = [oi];
        } else {
            const idx = _sheetExtras[gi].indexOf(oi);
            if (idx > -1) _sheetExtras[gi].splice(idx, 1); else _sheetExtras[gi].push(oi);
        }
        const p = findProduct(_sheetId);
        try {
            const opts = JSON.parse(p.options_text || '[]');
            opts.forEach((g, gidx) => {
                (g.options || g.items || []).forEach((_, oidx) => {
                    const on = _sheetExtras[gidx]?.includes(oidx);
                    const btn = document.getElementById(`sopt-${gidx}-${oidx}`);
                    const chk = document.getElementById(`soptcheck-${gidx}-${oidx}`);
                    if (btn) btn.classList.toggle('checked', !!on);
                    if (chk) { chk.classList.toggle('on', !!on); chk.textContent = on ? '✓' : ''; }
                });
            });
        } catch(e) {}
        updateSheetTotal();
    };

    window.sheetQty = function(d) {
        _sheetQty = Math.max(1, _sheetQty + d);
        document.getElementById('sheet-qty-val').textContent = _sheetQty;
        updateSheetTotal();
    };

    function _sheetExtraTotal() {
        const p = findProduct(_sheetId);
        let extra = 0;
        if (!p) return extra;
        try {
            const opts = JSON.parse(p.options_text || '[]');
            Object.entries(_sheetExtras).forEach(([gi, sel]) => {
                const g = opts[gi], items = g?.options || g?.items || [];
                sel.forEach(oi => { const o = items[oi]; if (o && typeof o === 'object' && o.price) extra += parseFloat(o.price) || 0; });
            });
        } catch(e) {}
        return extra;
    }

    function updateSheetTotal() {
        const p = findProduct(_sheetId);
        if (!p) return;
        const total = (parseFloat(p.price) + _sheetExtraTotal()) * _sheetQty;
        document.getElementById('sheet-add-btn').textContent = `הוספה לעגלה · ₪${total.toFixed(0)}`;
    }

    window.sheetAdd = function() {
        const p = findProduct(_sheetId);
        if (!p) return;
        if (cart.length && String(cart[0].businessGroupId) !== String(p.group_id)) {
            closeSheet();
            csOpenCart();
            csToast(`אפשר להזמין רק מעסק אחד — רוקנו את העגלה כדי לעבור ל-"${p.business_name}"`);
            return;
        }
        const extra = _sheetExtraTotal();
        const noteArr = [];
        try {
            const opts = JSON.parse(p.options_text || '[]');
            Object.entries(_sheetExtras).forEach(([gi, sel]) => {
                const g = opts[gi], items = g?.options || g?.items || [];
                sel.forEach(oi => { const o = items[oi]; const nm = typeof o === 'string' ? o : (o?.name || ''); if (nm) noteArr.push(nm); });
            });
        } catch(e) {}
        const note = [document.getElementById('sheet-note-input').value.trim(), ...noteArr].filter(Boolean).join(', ');
        const finalPrice = parseFloat(p.price) + extra;
        // מוצר עם תוספות שונות נשמר כשורה נפרדת בעגלה (לפי שילוב המחיר+הערה),
        // כדי שאפשר יהיה להזמין את אותו מוצר פעמיים עם תוספות שונות
        const existing = cart.find(i => i.catalogId === p.id && i.note === note);
        if (existing) existing.quantity += _sheetQty;
        else cart.push({ catalogId: p.id, businessGroupId: p.group_id, businessName: p.business_name, name: p.name, price: finalPrice, quantity: _sheetQty, note });
        closeSheet();
        updateCartBadges();
        csToast(`${p.name} נוסף לעגלה`);
    };

    window.csFilterBiz = function(groupId) {
        selectedBizFilter = groupId;
        renderBizChips();
        renderProducts();
    };

    // כלל ברזל: אי אפשר להזמין מוצרים משני עסקים שונים באותה הזמנה — נאכף גם בשרת.
    window.csAddToCart = function(product) {
        if (campaignData?.campaign?.ordering_enabled === false) {
            csToast('שמחים שאתם נלהבים כמונו ממוצרי השוק, הם יהיו זמינים בקרוב - ניתן להתעדכן מול רכזת הקהילה', 4500);
            return;
        }
        if (cart.length && String(cart[0].businessGroupId) !== String(product.group_id)) {
            csOpenCart();
            csToast(`אפשר להזמין רק מעסק אחד — רוקנו את העגלה כדי לעבור ל-"${product.business_name}"`);
            return;
        }
        const existing = cart.find(i => i.catalogId === product.id && !i.note);
        if (existing) existing.quantity += 1;
        else cart.push({ catalogId: product.id, businessGroupId: product.group_id, businessName: product.business_name, name: product.name, price: product.price, quantity: 1, note: '' });
        updateCartBadges();
        csToast(`${product.name} נוסף לעגלה`);
    };

    // ממוען לפי אינדקס בעגלה, לא לפי catalogId בלבד — כי אותו מוצר עם תוספות
    // שונות (note שונה) יכול להופיע כמה שורות נפרדות בעגלה
    window.csChangeQty = function(index, delta) {
        const item = cart[index];
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) cart.splice(index, 1);
        updateCartBadges();
        renderCartStep();
    };

    window.csEmptyCart = function() {
        if (!cart.length) return;
        if (!confirm('לרוקן את העגלה?')) return;
        cart = [];
        updateCartBadges();
        renderCartStep();
    };

    function cartTotal() { return cart.reduce((s, i) => s + i.price * i.quantity, 0); }
    function cartCount() { return cart.reduce((s, i) => s + i.quantity, 0); }

    function updateCartBadges() {
        const has = cart.length > 0;
        document.getElementById('cart-header-count').textContent = cartCount();
        document.getElementById('cart-bar').style.display = has ? 'block' : 'none';
        document.getElementById('cart-bar-count').textContent = cartCount();
        document.getElementById('cart-bar-total').textContent = `₪${cartTotal().toFixed(0)}`;
    }

    function renderCartStep() {
        const notice = document.getElementById('cs-single-biz-notice');
        if (cart.length) {
            notice.style.display = 'flex';
            notice.querySelector('span').textContent = `מזמינים מ-"${cart[0].businessName}" · אי אפשר לערבב עסקים בהזמנה אחת`;
        } else {
            notice.style.display = 'none';
        }
        document.getElementById('cs-cart-items').innerHTML = cart.length ? cart.map((i, idx) => `
            <div class="cart-line">
                <div class="cart-line-img"><i class="fa-solid fa-box"></i></div>
                <div class="cart-line-info">
                    <div class="cart-line-name">${csSafe(i.name)}</div>
                    ${i.note ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${csSafe(i.note)}</div>` : ''}
                    <button class="cart-line-remove" onclick="csChangeQty(${idx}, -${i.quantity})">הסר</button>
                </div>
                <div class="cart-line-right">
                    <div class="cart-line-price">₪${(i.price * i.quantity).toFixed(0)}</div>
                    <div class="qty-mini">
                        <button onclick="csChangeQty(${idx}, -1)">−</button>
                        <span class="qm-val">${i.quantity}</span>
                        <button onclick="csChangeQty(${idx}, 1)">+</button>
                    </div>
                </div>
            </div>`).join('') + `<button onclick="csEmptyCart()" style="align-self:center;background:none;border:none;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;margin-top:6px">רוקן עגלה</button>`
            : '<div id="cart-empty-msg">העגלה ריקה</div>';
    }

    function setPanelState(state) {
        panelState = state;
        document.getElementById('panel-cart-step').style.display = state === 'cart' ? 'flex' : 'none';
        document.getElementById('panel-checkout-step').style.display = state === 'checkout' ? 'flex' : 'none';
        document.getElementById('panel-done-step').style.display = state === 'done' ? 'flex' : 'none';
        document.getElementById('panel-back-btn').style.display = state === 'checkout' ? 'block' : 'none';
        document.getElementById('panel-summary').style.display = state === 'done' ? 'none' : 'flex';
        document.getElementById('panel-title').textContent = state === 'cart' ? 'העגלה שלך' : state === 'checkout' ? 'פרטי הזמנה' : 'תודה!';
        document.getElementById('panel-primary-btn').textContent = state === 'cart' ? 'המשך להזמנה' : 'שלח הזמנה';
        document.getElementById('panel-primary-btn').disabled = false;
        document.getElementById('cs-panel-total').textContent = `₪${cartTotal().toFixed(0)}`;
    }

    window.csOpenCart = function() {
        renderCartStep();
        setPanelState('cart');
        document.getElementById('panel-overlay').style.display = 'flex';
    };
    window.csCloseCart = function() { document.getElementById('panel-overlay').style.display = 'none'; };
    window.csBackToCart = function() { renderCartStep(); setPanelState('cart'); };

    window.csPrimaryAction = function() {
        if (panelState === 'cart') {
            if (!cart.length) return;
            if (!window.scAuth.requireLogin('csGoToCheckoutStep', '🔒 כדי להשלים הזמנה יש להתחבר או להירשם.<br><span style="font-size:11px;color:#15803d">ההרשמה מקשרת אותך אוטומטית לכל העסקים בקמפיין.</span>')) return;
            csGoToCheckoutStep();
        } else if (panelState === 'checkout') {
            csSubmitOrder();
        }
    };

    window.csGoToCheckoutStep = function() {
        const customer = window.scAuth._customer || {};
        document.getElementById('cs-cust-name').value = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
        document.getElementById('cs-cust-phone').value = customer.phone || '';
        document.getElementById('cs-cust-notes').value = '';
        setPanelState('checkout');
    };

    window.csSubmitOrder = async function() {
        const btn = document.getElementById('panel-primary-btn');
        btn.disabled = true; btn.textContent = 'שולח...';
        try {
            const res = await fetch(`/api/campaign/${encodeURIComponent(campaignCode)}/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (window.scAuth._token || '') },
                body: JSON.stringify({ items: cart, notes: document.getElementById('cs-cust-notes').value.trim() || null })
            });
            const data = await res.json();
            if (!data.success) {
                csToast(data.error || 'שגיאה בשליחת ההזמנה');
                btn.disabled = false; btn.textContent = 'שלח הזמנה';
                return;
            }
            cart = [];
            updateCartBadges();
            setPanelState('done');
        } catch(e) {
            csToast('שגיאת תקשורת, נסו שנית');
            btn.disabled = false; btn.textContent = 'שלח הזמנה';
        }
    };

    function csFmtDate(iso) {
        try { return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
        catch(e) { return ''; }
    }
    const CS_STATUS_LABELS = { pending_approval: 'ממתין לאישור', approved: 'אושר', preparing: 'בהכנה', ready: 'מוכן', completed: 'הושלם', cancelled: 'בוטל' };

    // sc-auth.js's floating "👤 שם" button calls scAuth.openActivityPanel() by default — that
    // panel is normally built around ONE business's orders/bookings (bizId from ?store=), which
    // has no meaning on a multi-business campaign page. Override it to show the customer's own
    // order history ACROSS all businesses in this campaign (GET /api/campaign/:code/my-orders)
    // instead, plus edit-profile/logout actions — mirrors the pattern sc-auth.js itself uses for
    // a single business (list ends with #sc-profile-btn/#sc-logout-btn).
    if (window.scAuth) {
        window.scAuth.openActivityPanel = async function() {
            const panel = document.getElementById('sc-activity-panel');
            const list = document.getElementById('sc-activity-list');
            if (!panel || !list) return this.openProfileEdit();
            panel.style.display = 'block';
            list.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px"><i class="fa-solid fa-spinner fa-spin"></i></div>';
            let ordersHtml = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:30px 0">עדיין אין הזמנות בקמפיין הזה</div>';
            try {
                const res = await fetch(`/api/campaign/${encodeURIComponent(campaignCode)}/my-orders`, { headers: { Authorization: 'Bearer ' + (this._token || '') } });
                const data = await res.json();
                if (data.success && data.orders && data.orders.length) {
                    ordersHtml = data.orders.map(o => `
                        <div style="border:1px solid #f1f5f9;border-radius:12px;padding:12px;margin-bottom:8px">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                                <span style="font-weight:700;font-size:13px;color:#1e293b">${csSafe(o.business_name)}</span>
                                <span style="font-size:11px;font-weight:700;color:#6366f1">${csSafe(CS_STATUS_LABELS[o.status] || o.status)}</span>
                            </div>
                            <div style="font-size:12px;color:#64748b;line-height:1.6">${(o.items || []).map(it => `${csSafe(it.name)} ×${it.qty}`).join(', ')}</div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:#94a3b8">
                                <span>${csFmtDate(o.created_at)}</span>
                                <span style="font-weight:700;color:#1e293b">₪${parseFloat(o.total_amount).toFixed(2)}</span>
                            </div>
                        </div>`).join('');
                }
            } catch(e) { ordersHtml = '<div style="text-align:center;color:#ef4444;font-size:13px;padding:20px">שגיאת טעינה</div>'; }

            list.innerHTML = `
                <div style="font-size:11px;font-weight:700;color:#94a3b8;padding:0 0 8px;text-align:right">📦 ההזמנות שלי בקמפיין</div>
                ${ordersHtml}
                <div style="border-top:1px solid #f1f5f9;margin-top:12px;padding-top:12px">
                    <button id="cs-profile-btn" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:14px;cursor:pointer;color:#475569">✏️ עריכת פרופיל</button>
                    <button id="cs-logout-btn" style="width:100%;padding:11px;border:1.5px solid #fee2e2;border-radius:12px;background:#fff5f5;font-size:13px;font-weight:600;cursor:pointer;color:#dc2626;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px">🚪 התנתקות</button>
                </div>`;
            list.querySelector('#cs-profile-btn')?.addEventListener('click', () => window.scAuth.openProfileEdit());
            list.querySelector('#cs-logout-btn')?.addEventListener('click', () => window.scAuth.logout());
        };
    }

    document.addEventListener('DOMContentLoaded', init);
})();
