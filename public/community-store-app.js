// WEFLOWZ — Community Campaign public store page (visual language matches the "חמה" storefront template)
(function() {
    const params = new URLSearchParams(window.location.search);
    const campaignCode = window.__CAMPAIGN_CODE__ || params.get('c') || params.get('campaign') || '';

    let campaignData = null;
    let selectedBizFilter = 'all';
    let searchQuery = '';
    let cart = []; // [{catalogId, businessGroupId, businessName, name, price, quantity, note}]
    let panelState = 'cart'; // 'cart' | 'checkout' | 'done'
    let _sheetId = null, _sheetQty = 1, _sheetExtras = {};

    function csSafe(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

    const _CS_DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    function _isMarketOpen(c) {
        if (!c || c.ordering_enabled === false) return false;
        const now = new Date();
        const effectiveDays = (c.active_days && c.active_days.length) ? c.active_days : [0,1,2,3,4,5,6];
        if (!effectiveDays.includes(now.getDay())) return false;
        if (c.active_hours && c.active_hours.start && c.active_hours.end) {
            const [sh, sm] = c.active_hours.start.split(':').map(Number);
            const [eh, em] = c.active_hours.end.split(':').map(Number);
            const nowMins = now.getHours() * 60 + now.getMinutes();
            if (nowMins < sh * 60 + sm || nowMins >= eh * 60 + em) return false;
        }
        return true;
    }
    function _nextOpenText(c) {
        if (!c || c.ordering_enabled === false) return null;
        const now = new Date();
        const effectiveDays = (c.active_days && c.active_days.length) ? c.active_days : [0,1,2,3,4,5,6];
        const ah = c.active_hours;
        const [sh, sm] = ah?.start ? ah.start.split(':').map(Number) : [0, 0];
        const nowMins = now.getHours() * 60 + now.getMinutes();
        for (let i = 0; i <= 7; i++) {
            const d = new Date(now); d.setDate(d.getDate() + i);
            const dow = d.getDay();
            if (!effectiveDays.includes(dow)) continue;
            if (i === 0 && nowMins < sh * 60 + sm) return `היום בשעה ${ah?.start || '00:00'}`;
            if (i === 0) continue; // past closing today
            return ah?.start ? `יום ${_CS_DAY_NAMES[dow]} בשעה ${ah.start}` : `יום ${_CS_DAY_NAMES[dow]}`;
        }
        return null;
    }
    function _showMarketClosedMsg(c) {
        if (c && c.ordering_enabled === false) {
            csToast('שמחים שאתם נלהבים כמונו ממוצרי השוק, הם יהיו זמינים בקרוב - ניתן להתעדכן מול רכזת הקהילה', 4500);
            return;
        }
        const next = _nextOpenText(c);
        csToast(next ? `השוק סגור כרגע. הפתיחה הקרובה: ${next}` : 'השוק סגור כרגע. ניתן להתעדכן מול רכזת הקהילה', 4500);
    }

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
            document.getElementById('hero').style.display = 'flex';
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
                document.getElementById('hero').style.display = 'flex';
                return;
            }
            campaignData = data;
            document.getElementById('main-header').style.display = 'block';
            document.getElementById('hero').style.display = 'flex';
            document.getElementById('biz-nav-wrap').style.display = 'block';
            document.getElementById('store-footer').style.display = 'block';
            renderHeader();
            renderBizChips();
            renderProducts();
        } catch(e) {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('cs-title').textContent = 'שגיאת תקשורת';
            document.getElementById('hero').style.display = 'flex';
        }
    }

    function renderHeader() {
        const c = campaignData.campaign;
        document.getElementById('cs-community-name').textContent = c.community_name || 'קמפיין קהילה';
        document.getElementById('header-name').textContent = c.community_name || 'קמפיין קהילה';
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

    // עסקים עם לפחות מוצר מאושר אחד — עסק בלי אף מוצר מוצג לא מופיע בכלל בסינון
    // (כל campaignData.products כבר מגיע מהשרת מסונן ל-approved בלבד)
    function _bizWithProducts() {
        const idsWithProducts = new Set(campaignData.products.map(p => String(p.group_id)));
        return campaignData.businesses.filter(b => idsWithProducts.has(String(b.group_id)));
    }

    function renderBizChips() {
        const wrap = document.getElementById('biz-nav');
        const activeBiz = _bizWithProducts();
        const chips = [{ group_id: 'all', name: 'הכל', logo_url: null }].concat(activeBiz);
        wrap.innerHTML = chips.map(b => `
            <button onclick="csFilterBiz('${b.group_id}')" class="biz-pill ${selectedBizFilter == b.group_id ? 'active' : ''}">
                ${b.logo_url ? `<img src="${b.logo_url}">` : ''}
                ${csSafe(b.name)}
            </button>`).join('');
    }

    window.csScrollBizNav = function(dir) {
        const nav = document.getElementById('biz-nav');
        if (!nav) return;
        nav.scrollBy({ left: dir * Math.round(nav.clientWidth * 0.75), behavior: 'smooth' });
    };

    window.csOpenBizDrawer = function() {
        const list = document.getElementById('biz-drawer-list');
        const activeBiz = _bizWithProducts();
        const counts = {};
        campaignData.products.forEach(p => { counts[p.group_id] = (counts[p.group_id] || 0) + 1; });
        const rows = [{ group_id: 'all', name: 'כל העסקים', logo_url: null }].concat(activeBiz);
        list.innerHTML = rows.map(b => `
            <div class="biz-drawer-item ${selectedBizFilter == b.group_id ? 'active' : ''}" onclick="csFilterBiz('${b.group_id}');csCloseBizDrawer()">
                ${b.logo_url ? `<img src="${b.logo_url}">` : '<div style="width:32px;height:32px;border-radius:50%;background:var(--subtle);flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted)"><i class="fa-solid fa-store"></i></div>'}
                <span class="biz-drawer-item-name">${csSafe(b.name)}</span>
                ${b.group_id !== 'all' ? `<span class="biz-drawer-item-count">${counts[b.group_id] || 0}</span>` : ''}
            </div>`).join('');
        document.getElementById('biz-drawer-overlay').style.display = 'block';
    };
    window.csCloseBizDrawer = function() {
        document.getElementById('biz-drawer-overlay').style.display = 'none';
    };

    window.csSearch = function(value) {
        searchQuery = (value || '').trim().toLowerCase();
        renderProducts();
    };

    function renderProducts() {
        const grid = document.getElementById('cs-products');
        let items = selectedBizFilter === 'all'
            ? campaignData.products
            : campaignData.products.filter(p => String(p.group_id) === String(selectedBizFilter));
        if (searchQuery) {
            items = items.filter(p =>
                (p.name || '').toLowerCase().includes(searchQuery) ||
                (p.business_name || '').toLowerCase().includes(searchQuery) ||
                (p.description || '').toLowerCase().includes(searchQuery));
        }
        if (!items.length) {
            grid.innerHTML = `<div class="catalog-empty" style="grid-column:1/-1">${searchQuery ? 'לא נמצאו תוצאות לחיפוש' : 'אין מוצרים להצגה'}</div>`;
            return;
        }
        grid.innerHTML = items.map(p => {
            // "מחיר מקור" להשוואה: הגבוה מבין original_price (מבצע בחנות הרגילה, אם קיים)
            // ו-base_price (מחיר הקטלוג הרגיל) - כדי שתגית ההנחה תופיע גם כשההנחה
            // היא רק מחיר-שוק ייעודי (price_override) שהעסק הגדיר, בלי שום קשר למבצע קיים
            const basePrice = parseFloat(p.base_price) || 0;
            const origPrice = parseFloat(p.original_price) || 0;
            const orig = Math.max(basePrice, origPrice);
            const curr = parseFloat(p.price);
            const hasDiscount = orig && orig > curr;
            const priceHtml = hasDiscount
                ? `<span style="display:flex;flex-direction:column;align-items:flex-start;gap:1px">
                     <span style="font-size:9px;font-weight:800;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;padding:1px 6px;border-radius:6px;width:fit-content">מחיר שוק ✨</span>
                     <span style="display:flex;align-items:center;gap:5px">
                       <span style="font-size:11px;color:#94a3b8;text-decoration:line-through">₪${orig.toFixed(0)}</span>
                       <span class="product-price">₪${curr.toFixed(0)}</span>
                     </span>
                   </span>`
                : `<span class="product-price">₪${curr.toFixed(0)}</span>`;
            const btnText = csProductBtnLabel(p);
            return `
            <div class="product-card">
                <div class="product-img-wrap">
                    ${p.has_image ? `<img src="/api/store/item-image/${p.id}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-image product-img-ph\\'></i>'">` : '<i class="fa-solid fa-box product-img-ph"></i>'}
                </div>
                <div class="product-body">
                    <span class="community-badge"><i class="fa-solid fa-store" style="font-size:9px"></i> ${csSafe(p.business_name)}</span>
                    <div class="product-name">${csSafe(p.name)}</div>
                    <div class="product-footer">
                        ${priceHtml}
                        <button class="add-pill" onclick="quickAdd(${p.id})">${btnText}</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // טקסט כפתור לפי product_type — כמו בחנות הציבורית המקורית (storefront.html)
    function csProductBtnLabel(p) {
        if (p.product_type === 'pizza_builder') return 'הרכב פיצה';
        if (p.product_type === 'service') return '📅 הזמן שירות';
        if (p.product_type === 'bundle') return '📦 בחר חבילה';
        if (p.product_type === 'complex_builder') return '📋 צפייה במפרט';
        return 'הוספה';
    }

    // מוצר עם תוספות/מרכיבים לבחירה (options_text) — כמו בחנות הציבורית המקורית
    function hasOptions(p) {
        try {
            const o = JSON.parse(p.options_text || '[]');
            if (p.product_type === 'pizza_builder' || (o && !Array.isArray(o) && o.isPizza)) return !!(o && o.toppings && o.toppings.length);
            return Array.isArray(o) && o.length > 0;
        } catch(e) { return false; }
    }

    // ===== PIZZA BUILDER (הרכבת פיצה/מנת-בסיס עם תוספות ברבעים) =====
    let _isPizzaProduct = false;
    let _pizzaToppings = [];
    let _pizzaState = {};
    let _activePizzaTopping = null;

    function initPizzaBuilder(toppings) {
        _isPizzaProduct = true;
        _pizzaToppings = toppings || [];
        _pizzaState = {};
        _pizzaToppings.forEach(t => _pizzaState[t.name] = [0, 0, 0, 0]);
        _activePizzaTopping = _pizzaToppings.length > 0 ? _pizzaToppings[0].name : null;
    }

    function renderPizzaBuilder() {
        const wrapper = document.getElementById('pizza-builder-wrapper');
        if (!wrapper) return;
        const getFill = qi => {
            if (!_activePizzaTopping || !_pizzaState[_activePizzaTopping]) return 'transparent';
            const v = _pizzaState[_activePizzaTopping][qi];
            return v === 2 ? '#ef4444' : v === 1 ? '#fca5a5' : 'transparent';
        };
        const getX2 = (qi, x, y) => {
            if (_activePizzaTopping && _pizzaState[_activePizzaTopping] && _pizzaState[_activePizzaTopping][qi] === 2)
                return `<text x="${x}" y="${y}" font-size="10" font-weight="900" fill="#fff" text-anchor="middle" pointer-events="none">X2</text>`;
            return '';
        };
        const toppingsHtml = _pizzaToppings.map(t =>
            `<button class="pizza-topping-btn${t.name === _activePizzaTopping ? ' active' : ''}" onclick="selectPizzaTopping('${csSafe(t.name)}')">${csSafe(t.name)} (+₪${t.price})</button>`
        ).join('');
        let summaryParts = [];
        _pizzaToppings.forEach(t => {
            const vals = _pizzaState[t.name];
            const active = vals.reduce((s, v) => s + Number(v || 0), 0);
            if (!active) return;
            let q1 = [], q2 = [];
            vals.forEach((v, i) => { if (v === 1) q1.push(i + 1); if (v === 2) q2.push(i + 1); });
            let parts = [];
            if (q1.length) parts.push(q1.length === 4 ? 'מגש שלם' : `רבעים ${q1.join(', ')}`);
            if (q2.length) parts.push(q2.length === 4 ? 'כפול הכל' : `כפול ${q2.join(', ')}`);
            summaryParts.push(`<span style="display:inline-block;background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:8px;font-size:11px;font-weight:700;margin:2px">${csSafe(t.name)} — ${parts.join(' | ')}</span>`);
        });
        wrapper.innerHTML = `
        <div style="background:#fff8f8;border:1px solid #fecaca;border-radius:18px;padding:16px;margin-bottom:14px">
            <h4 style="font-family:'Rubik',sans-serif;font-size:14px;font-weight:700;color:#991b1b;text-align:center;margin:0 0 4px">🍕 הרכבת הפיצה</h4>
            <p style="font-size:11px;color:#b91c1c;text-align:center;margin:0 0 12px">בחרו תוספת, לחצו על רבע פיצה. לחיצה כפולה = X2</p>
            <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x mandatory">${toppingsHtml}</div>
            <div style="position:relative;width:200px;height:200px;margin:16px auto">
                <svg viewBox="0 0 100 100" style="width:100%;height:100%;drop-shadow:0 4px 12px rgba(0,0,0,.15)">
                    <circle cx="50" cy="50" r="48" fill="#fef08a" stroke="#f59e0b" stroke-width="2"/>
                    <path d="M50 50 L50 2 A48 48 0 0 1 98 50 Z" fill="${getFill(0)}" class="pizza-slice" onclick="togglePizzaSlice(0)"/>
                    <path d="M50 50 L98 50 A48 48 0 0 1 50 98 Z" fill="${getFill(1)}" class="pizza-slice" onclick="togglePizzaSlice(1)"/>
                    <path d="M50 50 L50 98 A48 48 0 0 1 2 50 Z" fill="${getFill(2)}" class="pizza-slice" onclick="togglePizzaSlice(2)"/>
                    <path d="M50 50 L2 50 A48 48 0 0 1 50 2 Z" fill="${getFill(3)}" class="pizza-slice" onclick="togglePizzaSlice(3)"/>
                    <line x1="50" y1="2" x2="50" y2="98" stroke="#f59e0b" stroke-width="2" pointer-events="none"/>
                    <line x1="2" y1="50" x2="98" y2="50" stroke="#f59e0b" stroke-width="2" pointer-events="none"/>
                    <text x="75" y="29" font-size="13" font-weight="900" fill="#b45309" text-anchor="middle" dominant-baseline="middle" pointer-events="none">1</text>
                    <text x="75" y="71" font-size="13" font-weight="900" fill="#b45309" text-anchor="middle" dominant-baseline="middle" pointer-events="none">2</text>
                    <text x="25" y="71" font-size="13" font-weight="900" fill="#b45309" text-anchor="middle" dominant-baseline="middle" pointer-events="none">3</text>
                    <text x="25" y="29" font-size="13" font-weight="900" fill="#b45309" text-anchor="middle" dominant-baseline="middle" pointer-events="none">4</text>
                    ${getX2(0, 75, 40)}${getX2(1, 75, 85)}${getX2(2, 25, 85)}${getX2(3, 25, 40)}
                </svg>
                <div style="position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center">
                    <div style="background:rgba(255,255,255,.9);padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;color:#991b1b;border:1px solid #fecaca">
                        ${_activePizzaTopping ? 'פעיל: ' + _activePizzaTopping : 'בחרו תוספת'}
                    </div>
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:12px">
                <button onclick="fillPizza('whole')" style="padding:7px 14px;border:1px solid #fecaca;border-radius:10px;background:#fff;color:#b91c1c;font-size:11px;font-weight:700;cursor:pointer">מגש שלם</button>
                <button onclick="fillPizza('half1')" style="padding:7px 14px;border:1px solid #fecaca;border-radius:10px;background:#fff;color:#b91c1c;font-size:11px;font-weight:700;cursor:pointer">חצי ימין</button>
                <button onclick="fillPizza('half2')" style="padding:7px 14px;border:1px solid #fecaca;border-radius:10px;background:#fff;color:#b91c1c;font-size:11px;font-weight:700;cursor:pointer">חצי שמאל</button>
                <button onclick="fillPizza('clear')" style="padding:7px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#64748b;font-size:11px;font-weight:700;cursor:pointer">נקה</button>
            </div>
            <div style="background:#fff;padding:10px;border-radius:12px;border:1px solid #fecaca;min-height:42px">
                <div style="font-size:10px;font-weight:600;color:#9ca3af;margin-bottom:4px">סיכום:</div>
                ${summaryParts.length ? summaryParts.join('') : `<div style="font-size:11px;color:#9ca3af">פיצה חלקה (ללא תוספות)</div>`}
            </div>
        </div>`;
    }

    window.selectPizzaTopping = function(name) {
        _activePizzaTopping = name;
        renderPizzaBuilder();
    };
    window.togglePizzaSlice = function(qi) {
        if (!_activePizzaTopping) { csToast('בחרו תוספת תחילה'); return; }
        const v = _pizzaState[_activePizzaTopping][qi] || 0;
        _pizzaState[_activePizzaTopping][qi] = v === 0 ? 1 : v === 1 ? 2 : 0;
        renderPizzaBuilder();
        updateSheetTotal();
    };
    window.fillPizza = function(action) {
        if (!_activePizzaTopping && action !== 'clear') { csToast('בחרו תוספת תחילה'); return; }
        if (action === 'clear') _pizzaToppings.forEach(t2 => _pizzaState[t2.name] = [0, 0, 0, 0]);
        else if (action === 'whole') _pizzaState[_activePizzaTopping] = [1, 1, 1, 1];
        else if (action === 'half1') { _pizzaState[_activePizzaTopping][0] = 1; _pizzaState[_activePizzaTopping][1] = 1; }
        else if (action === 'half2') { _pizzaState[_activePizzaTopping][2] = 1; _pizzaState[_activePizzaTopping][3] = 1; }
        renderPizzaBuilder();
        updateSheetTotal();
    };
    function calcPizzaExtra() {
        let total = 0;
        _pizzaToppings.forEach(t2 => {
            if (_pizzaState[t2.name]) {
                const quarters = _pizzaState[t2.name].reduce((s, v) => s + Number(v || 0), 0);
                total += (parseFloat(t2.price) || 0) / 4 * quarters;
            }
        });
        return total;
    }
    function getPizzaSelections() {
        let selections = [], extraPrice = 0;
        _pizzaToppings.forEach(top => {
            const vals = _pizzaState[top.name];
            const active = vals.reduce((s, v) => s + Number(v || 0), 0);
            if (!active) return;
            extraPrice += (parseFloat(top.price) || 0) / 4 * active;
            let q1 = [], q2 = [];
            vals.forEach((v, i) => { if (v === 1) q1.push(i + 1); if (v === 2) q2.push(i + 1); });
            let parts = [];
            if (q1.length) parts.push(q1.length === 4 ? 'מגש שלם' : `רבעים ${q1.join(',')}`);
            if (q2.length) parts.push(q2.length === 4 ? 'כפול הכל' : `כפול ${q2.join(',')}`);
            selections.push(`${top.name} (${parts.join(' | ')})`);
        });
        return { selections, extraPrice };
    }

    function findProduct(id) { return (campaignData.products || []).find(x => x.id === id); }

    window.quickAdd = function(id) {
        const p = findProduct(id);
        if (!p) return;
        if (p.product_type === 'complex_builder') { window.openComplexProductModal(id); return; }
        if (hasOptions(p)) { openSheet(id); return; }
        csAddToCart({ id: p.id, group_id: p.group_id, business_name: p.business_name, name: p.name, price: parseFloat(p.price) });
    };

    window.openSheet = function(id) {
        const p = findProduct(id);
        if (!p) return;
        if (!_isMarketOpen(campaignData?.campaign)) {
            _showMarketClosedMsg(campaignData?.campaign);
            return;
        }
        if (cart.length && String(cart[0].businessGroupId) !== String(p.group_id)) {
            csOpenCart();
            csToast(`אפשר להזמין רק מעסק אחד — רוקנו את העגלה כדי לעבור ל-"${p.business_name}"`);
            return;
        }
        _sheetId = id; _sheetQty = 1; _sheetExtras = {}; _isPizzaProduct = false;
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
            if (p.product_type === 'pizza_builder' || (opts && !Array.isArray(opts) && opts.isPizza)) {
                const toppings = (opts && !Array.isArray(opts) && opts.toppings) ? opts.toppings : [];
                initPizzaBuilder(toppings);
                optHtml = `<div id="pizza-builder-wrapper"></div>`;
            } else if (Array.isArray(opts) && opts.length) {
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
        if (_isPizzaProduct) renderPizzaBuilder();

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
        if (_isPizzaProduct) return calcPizzaExtra();
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
        let noteArr = [];
        if (_isPizzaProduct) {
            noteArr = getPizzaSelections().selections;
        } else {
            try {
                const opts = JSON.parse(p.options_text || '[]');
                Object.entries(_sheetExtras).forEach(([gi, sel]) => {
                    const g = opts[gi], items = g?.options || g?.items || [];
                    sel.forEach(oi => { const o = items[oi]; const nm = typeof o === 'string' ? o : (o?.name || ''); if (nm) noteArr.push(nm); });
                });
            } catch(e) {}
        }
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
        if (!_isMarketOpen(campaignData?.campaign)) {
            _showMarketClosedMsg(campaignData?.campaign);
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
        if (!_isMarketOpen(campaignData?.campaign)) {
            _showMarketClosedMsg(campaignData?.campaign);
            return;
        }
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
                if (data.marketClosed) {
                    const msg = data.nextOpenText
                        ? `השוק סגור כרגע. הפתיחה הקרובה: ${data.nextOpenText}`
                        : (data.error || 'השוק סגור כרגע');
                    csToast(msg, 5000);
                } else {
                    csToast(data.error || 'שגיאה בשליחת ההזמנה');
                }
                btn.disabled = false; btn.textContent = 'שלח הזמנה';
                return;
            }
            cart = [];
            updateCartBadges();
            setPanelState('done');
            const doneSub = document.getElementById('done-sub');
            if (doneSub && data.orderId) doneSub.textContent = `מספר הזמנה #${data.orderId} — ניתן לאסוף מהעסק בהתאם לתיאום`;
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
                                <span style="font-weight:700;font-size:13px;color:#1e293b">${csSafe(o.business_name)} <span style="color:#94a3b8;font-weight:600">#${o.id}</span></span>
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

// ===== COMPLEX BUILDER (מנה מורכבת/קומבו/חבילה עם שלבי בחירה) — פורטינג מ-storefront.html =====
let _cxProduct = null, _cxBasePrice = 0, _cxQty = 1, _cxSteps = [], _cxPriceMode = 'per_guest';

function _cxEnsureModal() {
    if (document.getElementById('cx-modal-overlay')) return;
    const el = document.createElement('div');
    el.id = 'cx-modal-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.6);backdrop-filter:blur(2px);direction:rtl;padding:12px;';
    el.innerHTML = `
    <div style="background:#fff;border-radius:22px;width:min(96vw,520px);max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);">
        <div id="cx-modal-image-wrap" class="hidden"><img id="cx-modal-image" style="width:100%;height:160px;object-fit:cover;border-radius:22px 22px 0 0;"></div>
        <div style="padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
                <div style="min-width:0;">
                    <h3 id="cx-modal-title" style="font-weight:900;font-size:16px;color:#1e293b;margin:0;"></h3>
                    <div id="cx-modal-types" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;"></div>
                </div>
                <button onclick="window.closeComplexProductModal()" style="color:#94a3b8;font-size:20px;background:none;border:none;cursor:pointer;flex-shrink:0;">✕</button>
            </div>
            <p id="cx-modal-desc" style="font-size:12px;color:#64748b;margin:0 0 14px;"></p>
            <div id="cx-modal-steps-container"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding-top:12px;border-top:1px solid #f1f5f9;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:12px;font-weight:700;color:#475569;">כמות</span>
                    <div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border-radius:10px;padding:4px 10px;">
                        <button onclick="window.cxChangeQty(-1)" style="width:26px;height:26px;border:none;background:#fff;border-radius:8px;font-weight:900;cursor:pointer;">−</button>
                        <span id="cx-modal-qty-val" style="font-weight:800;min-width:16px;text-align:center;">1</span>
                        <button onclick="window.cxChangeQty(1)" style="width:26px;height:26px;border:none;background:#fff;border-radius:8px;font-weight:900;cursor:pointer;">+</button>
                    </div>
                </div>
            </div>
            <button onclick="window.submitComplexProduct()" style="width:100%;margin-top:14px;background:#059669;color:#fff;border:none;border-radius:14px;padding:14px;font-size:14px;font-weight:900;cursor:pointer;">הוספה לעגלה <span id="cx-total-display">(₪0)</span></button>
        </div>
    </div>`;
    el.addEventListener('click', e => { if (e.target === el) window.closeComplexProductModal(); });
    document.body.appendChild(el);
}

window.openComplexProductModal = function(id) {
    const p = findProduct(id);
    if (!p) return;
    if (!_isMarketOpen(campaignData?.campaign)) {
        _showMarketClosedMsg(campaignData?.campaign);
        return;
    }
    if (cart.length && String(cart[0].businessGroupId) !== String(p.group_id)) {
        csOpenCart();
        csToast(`אפשר להזמין רק מעסק אחד — רוקנו את העגלה כדי לעבור ל-"${p.business_name}"`);
        return;
    }
    _cxEnsureModal();
    _cxProduct = p;
    _cxBasePrice = parseFloat(p.price) || 0;
    _cxQty = 1;
    _cxSteps = [];
    _cxPriceMode = 'per_guest';

    try {
        const parsed = JSON.parse(p.options_text);
        if (parsed && parsed.isComplex) {
            _cxSteps = parsed.steps || [];
            _cxPriceMode = parsed.priceMode || 'per_guest';
            const imgWrap = document.getElementById('cx-modal-image-wrap');
            const imgEl = document.getElementById('cx-modal-image');
            if (parsed.imageUrl && imgWrap && imgEl) { imgEl.src = parsed.imageUrl; imgWrap.classList.remove('hidden'); }
            else if (imgWrap) imgWrap.classList.add('hidden');
            const typesEl = document.getElementById('cx-modal-types');
            const typeLabels = { event: 'ארוע', catering: 'קייטרינג', project: 'פרויקט', other: 'אחר' };
            const types = Array.isArray(parsed.complexTypes) ? parsed.complexTypes : (parsed.complexType ? [parsed.complexType] : []);
            if (typesEl) typesEl.innerHTML = types.map(t2 => `<span style="font-size:9px;font-weight:800;background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:999px;border:1px solid #a7f3d0;">${csSafe(typeLabels[t2] || t2)}</span>`).join('');
        }
    } catch(e) {}

    document.getElementById('cx-modal-title').textContent = p.name;
    document.getElementById('cx-modal-desc').textContent = p.description || '';
    document.getElementById('cx-modal-qty-val').textContent = _cxQty;
    const qtyRow = document.getElementById('cx-modal-qty-val')?.closest('div')?.parentElement;
    if (qtyRow) qtyRow.style.display = _cxPriceMode === 'per_total' ? 'none' : '';

    window.renderComplexStepsSelectionUI();
    window.calculateComplexTotal();
    document.getElementById('cx-modal-overlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeComplexProductModal = function() {
    const el = document.getElementById('cx-modal-overlay');
    if (el) el.style.display = 'none';
    document.body.style.overflow = '';
};

window.cxChangeQty = function(delta) {
    _cxQty = Math.max(1, _cxQty + delta);
    document.getElementById('cx-modal-qty-val').textContent = _cxQty;
    window.calculateComplexTotal();
};

window.renderComplexStepsSelectionUI = function() {
    const container = document.getElementById('cx-modal-steps-container');
    if (!container) return;
    let html = '';
    _cxSteps.forEach((step, stepIdx) => {
        const isMulti = step.max > 1 || step.max === 0;
        const inputType = isMulti ? 'checkbox' : 'radio';
        const badgeText = isMulti
            ? `בחר ${step.min > 0 ? `לפחות ${step.min} ` : ''}${step.max > 0 ? `ועד ${step.max}` : 'ללא הגבלה'}`
            : (step.min > 0 ? 'חובה לבחור 1' : 'בחירה אופציונלית');
        const optionsHtml = (step.options || []).map((opt, optIdx) => {
            const priceBadge = opt.price > 0 ? `<span style="font-size:10px;font-weight:800;color:#059669;background:#ecfdf5;padding:3px 8px;border-radius:8px;border:1px solid #a7f3d0;">+₪${opt.price}</span>` : '';
            return `<label style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;cursor:pointer;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="${inputType}" name="cx_step_${stepIdx}" value="${optIdx}" data-price="${opt.price}" class="cx-input-step-${stepIdx}" style="width:16px;height:16px;" onchange="window.handleComplexSelection(${stepIdx}, ${step.max}, this)">
                    <div style="display:flex;flex-direction:column;">
                        <span style="font-size:13px;font-weight:700;color:#334155;">${csSafe(opt.name)}</span>
                        ${opt.note ? `<span style="font-size:10px;color:#94a3b8;">${csSafe(opt.note)}</span>` : ''}
                    </div>
                </div>
                ${priceBadge}
            </label>`;
        }).join('');
        const stepPriceHtml = step.stepPrice > 0 ? `<span style="font-size:10px;font-weight:800;color:#059669;background:#ecfdf5;padding:2px 8px;border-radius:6px;border:1px solid #a7f3d0;">תוספת לשלב: ₪${step.stepPrice}</span>` : '';
        html += `<div style="background:#f8fafc;padding:12px;border-radius:14px;border:1px solid #e2e8f0;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="width:18px;height:18px;background:#ecfdf5;color:#059669;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;">${stepIdx + 1}</span>
                    <h4 style="font-weight:800;font-size:13px;color:#1e293b;margin:0;">${csSafe(step.name)}</h4>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    ${stepPriceHtml}
                    <span style="font-size:9px;font-weight:700;color:#64748b;background:#fff;padding:3px 7px;border-radius:6px;border:1px solid #e2e8f0;">${badgeText}</span>
                </div>
            </div>
            ${optionsHtml}
        </div>`;
    });
    container.innerHTML = html;
};

window.handleComplexSelection = function(stepIdx, max, inputEl) {
    if (max > 1) {
        const checked = document.querySelectorAll(`.cx-input-step-${stepIdx}:checked`);
        if (checked.length > max) { inputEl.checked = false; csToast(`ניתן לבחור עד ${max} אפשרויות בשלב זה`); }
    }
    window.calculateComplexTotal();
};

window.calculateComplexTotal = function() {
    let optionsTotal = 0, stepBaseTotals = 0;
    _cxSteps.forEach((step, stepIdx) => {
        const checked = document.querySelectorAll(`.cx-input-step-${stepIdx}:checked`);
        if (checked.length > 0 && step.stepPrice > 0) stepBaseTotals += parseFloat(step.stepPrice) || 0;
        checked.forEach(inp => { optionsTotal += parseFloat(inp.dataset.price) || 0; });
    });
    const subtotal = _cxBasePrice + stepBaseTotals + optionsTotal;
    const grandTotal = _cxPriceMode === 'per_total' ? subtotal : subtotal * _cxQty;
    const displayEl = document.getElementById('cx-total-display');
    if (displayEl) displayEl.textContent = `(₪${grandTotal.toFixed(2)})`;
};

window.submitComplexProduct = function() {
    let optionsSum = 0, stepBaseSum = 0, selectedTexts = [], isValid = true;
    _cxSteps.forEach((step, stepIdx) => {
        const checked = document.querySelectorAll(`.cx-input-step-${stepIdx}:checked`);
        if (step.min > 0 && checked.length < step.min) { csToast(`חובה לבחור לפחות ${step.min} אפשרויות ב: ${step.name}`); isValid = false; }
        let stepSelections = [];
        if (checked.length > 0 && step.stepPrice > 0) stepBaseSum += parseFloat(step.stepPrice) || 0;
        checked.forEach(inp => {
            const opt = step.options[parseInt(inp.value)];
            optionsSum += parseFloat(opt.price) || 0;
            stepSelections.push(opt.name);
        });
        if (stepSelections.length) selectedTexts.push(`${step.name}: ${stepSelections.join(', ')}`);
    });
    if (!isValid) return;

    const subtotal = _cxBasePrice + stepBaseSum + optionsSum;
    const unitPrice = _cxPriceMode === 'per_total' ? subtotal : subtotal; // מחיר ליחידה; הכמות נשמרת בשדה quantity כמו שאר העגלה
    const note = selectedTexts.join(' | ');

    cart.push({ catalogId: _cxProduct.id, businessGroupId: _cxProduct.group_id, businessName: _cxProduct.business_name, name: _cxProduct.name, price: unitPrice, quantity: _cxPriceMode === 'per_total' ? 1 : _cxQty, note });
    window.closeComplexProductModal();
    updateCartBadges();
    csToast('המפרט נוסף לעגלה בהצלחה! 📋');
};
