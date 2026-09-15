// WEFLOWZ — Community Campaign public store page (visual language matches the "חמה" storefront template)
(function() {
    const params = new URLSearchParams(window.location.search);
    const campaignCode = window.__CAMPAIGN_CODE__ || params.get('c') || params.get('campaign') || '';

    let campaignData = null;
    let selectedBizFilter = 'all';
    let cart = []; // [{catalogId, businessGroupId, businessName, name, price, quantity}]
    let panelState = 'cart'; // 'cart' | 'checkout' | 'done'

    function csSafe(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    function csToast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.style.display = 'block';
        clearTimeout(window._csToastTimer);
        window._csToastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
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
        if (c.logo_url) {
            const heroLogo = document.getElementById('hero-logo');
            heroLogo.src = c.logo_url;
            heroLogo.style.display = 'block';
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
                        <button class="add-pill" onclick='csAddToCart(${JSON.stringify({id:p.id, group_id:p.group_id, business_name:p.business_name, name:p.name, price:parseFloat(p.price)}).replace(/'/g,"&#39;")})'>הוסף</button>
                    </div>
                </div>
            </div>`).join('');
    }

    window.csFilterBiz = function(groupId) {
        selectedBizFilter = groupId;
        renderBizChips();
        renderProducts();
    };

    // כלל ברזל: אי אפשר להזמין מוצרים משני עסקים שונים באותה הזמנה — נאכף גם בשרת.
    window.csAddToCart = function(product) {
        if (cart.length && String(cart[0].businessGroupId) !== String(product.group_id)) {
            csOpenCart();
            csToast(`אפשר להזמין רק מעסק אחד — רוקנו את העגלה כדי לעבור ל-"${product.business_name}"`);
            return;
        }
        const existing = cart.find(i => i.catalogId === product.id);
        if (existing) existing.quantity += 1;
        else cart.push({ catalogId: product.id, businessGroupId: product.group_id, businessName: product.business_name, name: product.name, price: product.price, quantity: 1 });
        updateCartBadges();
        csToast(`${product.name} נוסף לעגלה`);
    };

    window.csChangeQty = function(catalogId, delta) {
        const item = cart.find(i => i.catalogId === catalogId);
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) cart = cart.filter(i => i.catalogId !== catalogId);
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
        document.getElementById('cs-cart-items').innerHTML = cart.length ? cart.map(i => `
            <div class="cart-line">
                <div class="cart-line-img"><i class="fa-solid fa-box"></i></div>
                <div class="cart-line-info">
                    <div class="cart-line-name">${csSafe(i.name)}</div>
                    <button class="cart-line-remove" onclick="csChangeQty(${i.catalogId}, -${i.quantity})">הסר</button>
                </div>
                <div class="cart-line-right">
                    <div class="cart-line-price">₪${(i.price * i.quantity).toFixed(0)}</div>
                    <div class="qty-mini">
                        <button onclick="csChangeQty(${i.catalogId}, -1)">−</button>
                        <span class="qm-val">${i.quantity}</span>
                        <button onclick="csChangeQty(${i.catalogId}, 1)">+</button>
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
