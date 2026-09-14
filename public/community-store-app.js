// WEFLOWZ — Community Campaign public store page
(function() {
    const params = new URLSearchParams(window.location.search);
    const campaignCode = params.get('c') || params.get('campaign') || '';

    let campaignData = null;
    let selectedBizFilter = 'all';
    let cart = []; // [{catalogId, businessGroupId, businessName, name, price, quantity}]

    function csSafe(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

    async function init() {
        if (!campaignCode) {
            document.getElementById('cs-title').textContent = 'קמפיין לא נמצא';
            document.getElementById('cs-products').innerHTML = '<div class="col-span-2 text-center text-slate-400 py-12">לא צויין קוד קמפיין בכתובת</div>';
            return;
        }
        try {
            const res = await fetch(`/api/campaign/${encodeURIComponent(campaignCode)}`);
            const data = await res.json();
            if (!data.success) {
                document.getElementById('cs-title').textContent = 'קמפיין לא זמין';
                document.getElementById('cs-desc').textContent = data.error || '';
                document.getElementById('cs-products').innerHTML = '';
                return;
            }
            campaignData = data;
            renderHeader();
            renderBizChips();
            renderProducts();
        } catch(e) {
            document.getElementById('cs-title').textContent = 'שגיאת תקשורת';
        }
    }

    function renderHeader() {
        document.getElementById('cs-community-name').textContent = campaignData.campaign.community_name || 'קמפיין קהילה';
        document.getElementById('cs-title').textContent = campaignData.campaign.title;
        document.getElementById('cs-desc').textContent = campaignData.campaign.description || '';
        document.title = `${campaignData.campaign.title} | WEFLOWZ`;
        if (campaignData.campaign.banner_image_url) {
            document.getElementById('cs-banner').style.backgroundImage = `linear-gradient(to bottom, rgba(79,70,229,0.75), rgba(147,51,234,0.75)), url('${campaignData.campaign.banner_image_url}')`;
            document.getElementById('cs-banner').style.backgroundSize = 'cover';
            document.getElementById('cs-banner').style.backgroundPosition = 'center';
        }
    }

    function renderBizChips() {
        const wrap = document.getElementById('cs-biz-chips');
        const chips = [{ group_id: 'all', name: 'הכל', logo_url: null }].concat(campaignData.businesses);
        wrap.innerHTML = chips.map(b => `
            <button onclick="csFilterBiz('${b.group_id}')" data-biz="${b.group_id}"
                class="cs-chip chip px-4 py-2 rounded-full text-xs font-bold border transition flex items-center gap-1.5 ${selectedBizFilter == b.group_id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}">
                ${b.logo_url ? `<img src="${b.logo_url}" class="w-4 h-4 rounded-full object-cover">` : ''}
                ${csSafe(b.name)}
            </button>`).join('');
    }

    function renderProducts() {
        const grid = document.getElementById('cs-products');
        const items = selectedBizFilter === 'all'
            ? campaignData.products
            : campaignData.products.filter(p => String(p.group_id) === String(selectedBizFilter));
        if (!items.length) {
            grid.innerHTML = '<div class="col-span-2 text-center text-slate-400 py-12">אין מוצרים להצגה</div>';
            return;
        }
        grid.innerHTML = items.map(p => `
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div class="aspect-square bg-slate-50 flex items-center justify-center">
                    ${p.has_image ? `<img src="/api/store/item-image/${p.id}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-image text-3xl text-slate-200\\'></i>'">` : '<i class="fa-solid fa-box text-3xl text-slate-200"></i>'}
                </div>
                <div class="p-3 flex-1 flex flex-col">
                    <span class="text-[10px] font-bold text-indigo-500 mb-0.5">${csSafe(p.business_name)}</span>
                    <p class="text-sm font-bold text-slate-800 leading-tight mb-1">${csSafe(p.name)}</p>
                    <div class="mt-auto flex items-center justify-between pt-2">
                        <span class="font-black text-slate-800">₪${parseFloat(p.price).toFixed(0)}</span>
                        <button onclick='csAddToCart(${JSON.stringify({id:p.id, group_id:p.group_id, business_name:p.business_name, name:p.name, price:parseFloat(p.price)}).replace(/'/g,"&#39;")})'
                            class="bg-indigo-50 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center font-bold hover:bg-indigo-100 transition"><i class="fa-solid fa-plus text-xs"></i></button>
                    </div>
                </div>
            </div>`).join('');
    }

    window.csFilterBiz = function(groupId) {
        selectedBizFilter = groupId;
        renderBizChips();
        renderProducts();
    };

    window.csAddToCart = function(product) {
        if (cart.length && String(cart[0].businessGroupId) !== String(product.group_id)) {
            if (!confirm(`אפשר להזמין רק מעסק אחד בכל הזמנה.\nהעגלה שלך מכילה מוצרים מ"${cart[0].businessName}".\nלרוקן את העגלה ולהתחיל הזמנה חדשה מ-"${product.business_name}"?`)) return;
            cart = [];
        }
        const existing = cart.find(i => i.catalogId === product.id);
        if (existing) existing.quantity += 1;
        else cart.push({ catalogId: product.id, businessGroupId: product.group_id, businessName: product.business_name, name: product.name, price: product.price, quantity: 1 });
        updateCartUI();
    };

    window.csChangeQty = function(catalogId, delta) {
        const item = cart.find(i => i.catalogId === catalogId);
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) cart = cart.filter(i => i.catalogId !== catalogId);
        updateCartUI();
        renderCartItems();
    };

    function cartTotal() { return cart.reduce((s, i) => s + i.price * i.quantity, 0); }
    function cartCount() { return cart.reduce((s, i) => s + i.quantity, 0); }

    function updateCartUI() {
        const btn = document.getElementById('cs-cart-btn');
        if (!cart.length) { btn.classList.add('hidden'); return; }
        btn.classList.remove('hidden');
        document.getElementById('cs-cart-count').textContent = cartCount();
        document.getElementById('cs-cart-total').textContent = cartTotal().toFixed(0);
    }

    function renderCartItems() {
        document.getElementById('cs-cart-biz-name').textContent = cart.length ? `מזמינים מ: ${cart[0].businessName}` : '';
        document.getElementById('cs-cart-items').innerHTML = cart.length ? cart.map(i => `
            <div class="flex items-center justify-between gap-2">
                <div class="flex-1">
                    <p class="text-sm font-bold text-slate-800">${csSafe(i.name)}</p>
                    <p class="text-xs text-slate-400">₪${i.price.toFixed(0)} ליחידה</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="csChangeQty(${i.catalogId}, -1)" class="w-7 h-7 rounded-full bg-slate-100 font-bold">−</button>
                    <span class="w-5 text-center font-bold">${i.quantity}</span>
                    <button onclick="csChangeQty(${i.catalogId}, 1)" class="w-7 h-7 rounded-full bg-slate-100 font-bold">+</button>
                </div>
            </div>`).join('') : '<p class="text-center text-slate-400 py-6">העגלה ריקה</p>';
        document.getElementById('cs-cart-modal-total').textContent = cartTotal().toFixed(0);
    }

    window.csOpenCart = function() {
        renderCartItems();
        document.getElementById('cs-cart-modal').classList.remove('hidden');
    };
    window.csCloseCart = function() { document.getElementById('cs-cart-modal').classList.add('hidden'); };

    window.csCheckout = async function() {
        if (!cart.length) return;
        if (!window.scAuth.requireLogin('csCheckout', '🔒 כדי להשלים הזמנה יש להתחבר או להירשם.<br><span style="font-size:11px;color:#15803d">ההרשמה מקשרת אותך אוטומטית לכל העסקים בקמפיין.</span>')) return;

        const btn = document.getElementById('cs-checkout-btn');
        btn.disabled = true; btn.textContent = 'שולח הזמנה...';
        try {
            const res = await fetch(`/api/campaign/${encodeURIComponent(campaignCode)}/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (window.scAuth._token || '') },
                body: JSON.stringify({ items: cart })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'שגיאה בשליחת ההזמנה');
                btn.disabled = false; btn.textContent = 'המשך להזמנה';
                return;
            }
            cart = [];
            updateCartUI();
            csCloseCart();
            alert('ההזמנה נשלחה בהצלחה! 🎉');
        } catch(e) {
            alert('שגיאת תקשורת, נסו שנית');
            btn.disabled = false; btn.textContent = 'המשך להזמנה';
        }
    };

    document.addEventListener('DOMContentLoaded', init);
})();
