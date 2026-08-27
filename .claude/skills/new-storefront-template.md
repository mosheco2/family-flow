# סקיל: יישום תבנית חנות ציבורית חדשה (storefront)

## מתי להשתמש
כשמקבלים קובץ HTML חדש של תבנית חנות ציבורית (storefront) — יש לממש בו את כל הדרישות, הלוגיקות והפיצ'רים הרשומים כאן, **לפני** כל עבודה נוספת על התבנית.

---

## 1. מבנה בסיסי חובה

### פונטים
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```
- כותרות / לוגו / מספרים → `font-family: 'Rubik', sans-serif`
- גוף טקסט → `font-family: 'Heebo', system-ui, sans-serif`

### CSS Variables חובה
```css
:root {
  --accent: #e63946;
  --accent-dark: #c0392b;
  --bg: #FAFAF7;
  --dark: #111113;
  --border: #ECEAE3;
  --card: #fff;
  --muted: #8C8C86;
  --subtle: #F1EFE9;
  --radius: 14px;
}
```

### Animations חובה
```css
@keyframes rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
@keyframes pop  { 0%{transform:scale(.72);opacity:0} 65%{transform:scale(1.07)} 100%{transform:scale(1);opacity:1} }
@keyframes glow { 0%,100%{opacity:.45} 50%{opacity:1} }
@keyframes spin { to{transform:rotate(360deg)} }
```

### HTML עטיפה חובה
```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title id="page-title">חנות</title>
```

---

## 2. State Variables — כל משתן חייב להיות מוגדר

```js
const API = '/api';
let storeData = null, catalog = [], groupId = null;
let favs = new Set();
let cart = {}; // {key: {id,name,price,qty,note,colorName}}
let isDelivery = true, _cartStep = 'cart';
let _couponDiscount = 0, _couponCode = '';
let _sheetId = null, _sheetQty = 1, _sheetExtras = {}, _sheetNote = '', _sheetSelOpt = {};
let _panelOpen = false, _loyaltyJoined = false;
let _bookingType = 'table', _payMethod = 0;
let _bookStep = 1, _bookTempId = null, _bookSelectedSlot = null;
let _address = '', _orderNo = '';
let _activePromos = [];
let _galleryImages = [], _lbIndex = 0;
let _searchQ = '';
let _expandedId = null;       // לתבניות עם expand-row
let _selectedColors = {};     // {productId: colorName}
let _selectedQtys = {};       // {productId: qty}
let _filterCat = '', _sortMode = 'popular', _priceMax = 10000;
let _onlyDeals = false, _onlyStock = false;

// Multi-language
const _langParam = new URLSearchParams(window.location.search).get('lang') || 'he';
let isEn = _langParam === 'en';
function t(he, en) { return isEn ? en : he; }

// Catalog view
let catalogViewMode = 'grid'; // 'grid' | 'list'

// Pizza builder
let _isPizzaProduct = false;
let _pizzaToppings = [], _pizzaState = {}, _activePizzaTopping = null;
```

---

## 3. initStore — רצף אתחול מחויב

```js
async function initStore() {
  try {
    // 1. קרא store code מ-URL (pathname או ?store=)
    const path = window.location.pathname.replace(/^\//, '');
    const code = path || new URLSearchParams(window.location.search).get('store') || 'demo';
    // 2. fetch /api/storefront/:code
    const res = await fetch(`${API}/storefront/${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error('not found');
    storeData = await res.json();
    groupId = storeData.groupId;
    // 3. שמור catalog (סנן מוצרים לא זמינים)
    catalog = (storeData.catalog || []).filter(p => p.is_available !== false);
    // 4. הגדר accent color מהגדרות
    applyAccent(storeData.settings?.accent_color || '#e63946');
    // 5. כותרת דף
    document.title = storeData.groupName || 'חנות';
    // 6. render ראשוני
    renderAll();
    // 7. הסתר loading screen
    document.getElementById('loading-screen').style.display = 'none';
    // 8. טעינה אסינכרונית
    loadAsync();
  } catch(e) {
    document.getElementById('loading-screen').innerHTML =
      '<div style="text-align:center;color:rgba(255,255,255,.55)">שגיאה בטעינת החנות</div>';
    console.error(e);
  }
}
```

**loadAsync חייב לכלול:**
```js
async function loadAsync() {
  if (!groupId) return;
  // 1. מבצעים
  try {
    const r = await fetch(`${API}/store/promotions/${groupId}`);
    const d = await r.json();
    if (d.success) { _activePromos = d.promotions || []; renderCatalog(); }
  } catch(e) {}
  // 2. ביקורות
  try {
    const r = await fetch(`${API}/public/reviews/${groupId}`);
    const d = await r.json();
    if (d.success && d.reviews?.length) renderReviews(d.reviews);
  } catch(e) {}
  // 3. גלריה
  try {
    const r = await fetch(`${API}/public/gallery/${groupId}`);
    const d = await r.json();
    if (d.success && d.images?.length) {
      _galleryImages = d.images;
      // הצג כפתור גלריה ב-quick-actions או בhero
    }
  } catch(e) {}
}
```

---

## 4. renderAll — סדר קריאות חובה

```js
function renderAll() {
  const s = storeData.settings || {};
  renderTicker(s);
  renderHeader(s);
  renderHero(s);
  renderQuickActions(s);
  renderCategories();
  renderCatalog();
  renderCartDock();
  renderPayMethods(s);
  renderFooter(s);
}
```

---

## 5. Quick Actions — חובה להציג

**לוגיקה:** קרא מ-`settings` של העסק, בנה כפתורי ghost על רקע dark.

```js
function renderQuickActions(s) {
  const btns = [];
  // טלפון
  if (s.phone) btns.push(`<a class="qa-btn" href="tel:${escHtml(s.phone)}">📞 ${escHtml(s.phone)}</a>`);
  // וואטסאפ
  const wa = s.whatsapp_number || s.phone;
  if (wa) btns.push(`<a class="qa-btn" href="https://wa.me/972${wa.replace(/\D/g,'').replace(/^0/,'')}" target="_blank">💬 וואטסאפ</a>`);
  // Waze + Google Maps
  if (s.biz_lat && s.biz_lng) {
    btns.push(`<a class="qa-btn" href="https://waze.com/ul?ll=${s.biz_lat},${s.biz_lng}&navigate=yes" target="_blank">🚗 Waze</a>`);
    btns.push(`<a class="qa-btn" href="https://maps.google.com/?q=${s.biz_lat},${s.biz_lng}" target="_blank">📍 ${escHtml(s.biz_address||'מפה')}</a>`);
  } else if (s.biz_address) {
    btns.push(`<a class="qa-btn" href="https://maps.google.com/?q=${encodeURIComponent(s.biz_address)}" target="_blank">📍 ${escHtml(s.biz_address)}</a>`);
  }
  // כפתורי הזמנה — מהגדרות בלבד
  if (s.has_table_booking) btns.push(`<button class="qa-btn" onclick="openBooking('table')">🪑 הזמנת שולחן</button>`);
  if (s.has_space_booking) btns.push(`<button class="qa-btn" onclick="openBooking('space')">🏛 הזמנת מקום</button>`);
  if (s.has_event_booking) btns.push(`<button class="qa-btn" onclick="openBooking('event')">🎉 הזמנת אירוע</button>`);
  const el = document.getElementById('quick-actions');
  if (el) { el.innerHTML = btns.join(''); el.style.display = btns.length ? 'flex' : 'none'; }
}

function openBooking(type) {
  // פתח את פאנל הצעת מחיר / הזמנת שולחן בהתאם לסוג
  openQuote();
  const msg = document.getElementById('qf-msg');
  if (msg) msg.value = type === 'table' ? 'הזמנת שולחן — ' : type === 'space' ? 'הזמנת מקום — ' : 'הזמנת אירוע — ';
}
```

CSS:
```css
.qa-btn { display:inline-flex;align-items:center;gap:7px;padding:8px 14px;
  border:1px solid rgba(255,255,255,.22);border-radius:99px;
  background:rgba(255,255,255,.08);color:rgba(255,255,255,.88);
  font-size:12.5px;font-weight:500;cursor:pointer;text-decoration:none;
  transition:.15s;white-space:nowrap;font-family:inherit;border:1px solid rgba(255,255,255,.22) }
.qa-btn:hover { background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.4) }
#quick-actions { display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px }
```

---

## 6. הזמנת שולחן — 3 שלבים עם SMS

**API Endpoints:**
- בדיקת זמינות: `GET /api/public/restaurants/:groupId/availability/:date`
- הזמנה + SMS: `POST /api/public/restaurants/:groupId/book-table` → מחזיר `{tempId}`
- אימות SMS: `POST /api/public/restaurants/:groupId/verify-table-sms` עם `{tempId, code}`

**שלב 1:** תאריך → slots grid → שם + טלפון + שליחה → המתן ל-SMS
**שלב 2:** 4 שדות digit בודד, auto-advance, אימות אוטומטי בשדה אחרון
**שלב 3:** הצגת אישור

```js
let _bookStep = 1, _bookTempId = null, _bookSelectedSlot = null;

async function bookDateChange(date) {
  const r = await fetch(`${API}/public/restaurants/${groupId}/availability/${date}`);
  const d = await r.json();
  renderSlots(d.slots || []);
}

async function submitTableStep1() {
  // שלח book-table, קבל tempId, עבור לשלב 2
}
async function submitTableStep2() {
  // שלח verify-table-sms עם 4 ספרות, עבור לשלב 3
}

// SMS digits — auto-advance
function smsDigitInput(el, idx) {
  if (el.value.length === 1 && idx < 3) {
    document.querySelectorAll('.sms-digit')[idx+1]?.focus();
  }
  if (idx === 3) {
    const code = [...document.querySelectorAll('.sms-digit')].map(d=>d.value).join('');
    if (code.length === 4) submitTableStep2();
  }
}
```

**פרוגרס dots:**
```html
<div id="book-progress">
  <div class="bprog-dot active" id="bprog-1"></div>
  <div class="bprog-dot" id="bprog-2"></div>
  <div class="bprog-dot" id="bprog-3"></div>
</div>
```

---

## 7. מחיר קהילה

```js
const isCommunity = storeData?.communityData?.discount_active && storeData?.communityData?.discount_pct > 0;
const communityPrice = isCommunity
  ? Math.round(p.price * (1 - storeData.communityData.discount_pct / 100))
  : null;
// בכרטיס מוצר:
// אם communityPrice — הצג "✨ מחיר קהילה" + מחיר מקורי חוצה + מחיר קהילה
```

---

## 8. BOGO — חישוב הנחה

```js
function calcBogoDiscount() {
  const bogoPromo = _activePromos.find(p => p.promo_type === 'bogo' && p.is_active);
  if (!bogoPromo || _couponDiscount) return 0;
  let discount = 0;
  const byId = {};
  Object.values(cart).forEach(c => { byId[c.id] = (byId[c.id]||0) + c.qty; });
  Object.entries(byId).forEach(([id, qty]) => {
    const p = catalog.find(x=>x.id==id);
    if (!p) return;
    discount += Math.floor(qty / 2) * p.price;
  });
  return discount;
}
```

---

## 9. קופונים אמיתיים

```js
function applyCoupon() {
  const code = document.getElementById('coupon-input').value.trim().toUpperCase();
  if (!code) return;
  const promo = _activePromos.find(p => (p.promo_code||'').toUpperCase() === code && p.is_active);
  if (!promo) { showCouponMsg('קוד לא תקין', 'red'); return; }
  _couponCode = code;
  if (promo.promo_type === 'discount_pct') {
    _couponDiscount = (promo.promo_value||0) / 100;
    showCouponMsg(`✅ ${promo.promo_value}% הנחה הופעל`);
  } else if (promo.promo_type === 'discount_fixed') {
    _couponDiscount = 'fixed:' + (promo.promo_value||0);
    showCouponMsg(`✅ הנחה של ₪${promo.promo_value} הופעלה`);
  }
}

function getPanelFinal(sub) {
  const bogoDisc = calcBogoDiscount();
  let couponDisc = 0;
  if (typeof _couponDiscount === 'number') couponDisc = Math.round(sub * _couponDiscount);
  else if (typeof _couponDiscount === 'string' && _couponDiscount.startsWith('fixed:'))
    couponDisc = Math.min(sub, parseFloat(_couponDiscount.split(':')[1])||0);
  const delivery = isDelivery ? (storeData?.settings?.delivery_fee || 0) : 0;
  const total = Math.max(0, sub - bogoDisc - couponDisc + delivery);
  return { sub, bogoDisc, couponDisc, delivery, total };
}
```

---

## 10. גלריה + Lightbox

```js
// Lightbox HTML (מוסיפים דינמית ל-body):
function openGallery(i) {
  _lbIndex = i;
  const imgs = _galleryImages;
  if (!imgs.length) return;
  const existing = document.getElementById('lb-overlay');
  if (existing) existing.remove();
  const ov = document.createElement('div');
  ov.id = 'lb-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px';
  ov.innerHTML = `
    <button onclick="document.getElementById('lb-overlay').remove()"
      style="position:absolute;top:16px;left:16px;background:rgba(255,255,255,.12);border:none;color:#fff;font-size:22px;width:40px;height:40px;border-radius:50%;cursor:pointer">✕</button>
    <button onclick="lbNav(-1)"
      style="position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.12);border:none;color:#fff;font-size:28px;width:44px;height:44px;border-radius:50%;cursor:pointer">›</button>
    <img id="lb-img" src="${escHtml(imgs[i].url||imgs[i])}"
      style="max-width:90vw;max-height:75vh;border-radius:12px;object-fit:contain">
    <div id="lb-counter" style="color:rgba(255,255,255,.55);font-size:13px">${i+1} / ${imgs.length}</div>
    <button onclick="lbNav(1)"
      style="position:absolute;left:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.12);border:none;color:#fff;font-size:28px;width:44px;height:44px;border-radius:50%;cursor:pointer">‹</button>`;
  document.body.appendChild(ov);
}

function lbNav(dir) {
  _lbIndex = (_lbIndex + dir + _galleryImages.length) % _galleryImages.length;
  const ov = document.getElementById('lb-overlay');
  if (ov) {
    ov.querySelector('#lb-img').src = escHtml(_galleryImages[_lbIndex].url || _galleryImages[_lbIndex]);
    ov.querySelector('#lb-counter').textContent = `${_lbIndex+1} / ${_galleryImages.length}`;
  }
}
```

---

## 11. Scroll Spy

```js
function initScrollSpy() {
  const groups = document.querySelectorAll('.cat-group');
  if (!groups.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const cat = e.target.dataset.cat;
        document.querySelectorAll('#cat-nav .cat-pill').forEach(b =>
          b.classList.toggle('active', b.dataset.cat === cat)
        );
      }
    });
  }, { rootMargin: '-120px 0px -60% 0px' });
  groups.forEach(g => obs.observe(g));
}
// קרא initScrollSpy() אחרי כל renderCatalog()
```

---

## 12. הירו — מ-Settings בלבד

**כותרת וסלוגן חייבים לבוא מהגדרות העסק — לא hardcoded:**

```js
function renderHero(s) {
  // כותרת — שם העסק מ-storeData
  const name = storeData.groupName || '';
  document.getElementById('hero-title').textContent = name;

  // סלוגן — מהגדרות
  const sub = document.getElementById('hero-sub');
  if (sub) sub.textContent = s.slogan || s.description || '';

  // Stats — רק מה שמוגדר (לא hardcoded!)
  const stats = [];
  if (s.max_volume_discount) stats.push({val: s.max_volume_discount+'%', lbl: 'הנחת כמות'});
  if (s.delivery_eta) stats.push({val: s.delivery_eta+'h', lbl: 'זמן אספקה'});
  if (s.free_delivery_above) stats.push({val: '₪'+s.free_delivery_above, lbl: 'משלוח חינם מעל'});
  const statsEl = document.getElementById('hero-stats');
  if (statsEl) statsEl.innerHTML = stats.map(st =>
    `<div class="hstat"><div class="hstat-val">${escHtml(st.val)}</div><div class="hstat-lbl">${escHtml(st.lbl)}</div></div>`
  ).join('');

  // Banner — מהגדרות
  const bannerUrl = s.banner_url && s.banner_url !== 'DELETE' && s.banner_url !== 'null' ? s.banner_url : '';
  if (bannerUrl) {
    const bg = document.getElementById('hero-banner-bg');
    if (bg) { bg.style.backgroundImage = `url('${bannerUrl}')`; bg.style.opacity = '0.28'; }
  }

  // תמונות מהקטלוג — אם אין banner
  if (!bannerUrl) {
    const imgItems = catalog.filter(p => p.image_url);
    const shuffled = [...imgItems].sort(() => Math.random() - 0.5);
    // [0] → hero-img-main, [1] → hero-side-top, [2] → hero-side-bottom
    ['hero-img-main', 'hero-side-top', 'hero-side-bottom'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && shuffled[i]) el.innerHTML = `<img src="${escHtml(shuffled[i].image_url)}" style="width:100%;height:100%;object-fit:cover">`;
    });
  }
}
```

**CSS hero banner:**
```css
#hero-banner-bg { position:absolute;inset:0;background-size:cover;background-position:center;opacity:.22;pointer-events:none }
```

**⚠️ אסור לרשום נתונים מספריים hardcoded בהירו (500+, 48h וכד') — רק מ-settings.**

---

## 13. Multi-Language

**אתחול:**
```js
const _langParam = new URLSearchParams(window.location.search).get('lang') || 'he';
let isEn = _langParam === 'en';
function t(he, en) { return isEn ? en : he; }
```

**Toggle:**
```js
function toggleLang() {
  isEn = !isEn;
  document.documentElement.lang = isEn ? 'en' : 'he';
  document.documentElement.dir = isEn ? 'ltr' : 'rtl';
  document.getElementById('lang-label').textContent = isEn ? 'עברית' : 'English';
  renderAll();
}
```

**כפתור בהירו:**
```html
<button onclick="toggleLang()" id="lang-toggle">🌐 <span id="lang-label">English</span></button>
```

**כל טקסט UI** — שימוש ב-`t('עברית', 'English')` על כל טקסט גלוי.

---

## 14. Side Menu

```html
<div id="menu-overlay" onclick="toggleSideMenu(false)"
  style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:900;display:none;opacity:0;transition:opacity .3s"></div>
<div id="side-menu"
  style="position:fixed;top:0;right:0;bottom:0;width:min(280px,85vw);background:var(--card);z-index:901;box-shadow:-8px 0 32px rgba(0,0,0,.2);transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1)">
  <div id="side-categories-list"></div>
</div>
```

```js
function toggleSideMenu(isOpen) {
  const menu = document.getElementById('side-menu');
  const overlay = document.getElementById('menu-overlay');
  if (isOpen) {
    menu.style.transform = 'translateX(0)';
    overlay.style.display = 'block';
    setTimeout(() => overlay.style.opacity = '1', 10);
    const cats = [...new Set(catalog.map(p => p.category).filter(Boolean))];
    document.getElementById('side-categories-list').innerHTML = cats.map(cat =>
      `<button onclick="scrollToCat('${escHtml(cat)}');toggleSideMenu(false)"
        style="display:block;width:100%;padding:12px 20px;text-align:right;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:1px solid var(--border)">${escHtml(cat)}</button>`
    ).join('');
  } else {
    menu.style.transform = 'translateX(100%)';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display = 'none', 300);
  }
}
function scrollToCat(cat) {
  document.getElementById('cat-group-' + cat)?.scrollIntoView({behavior:'smooth',block:'start'});
}
```

---

## 15. Grid/List Toggle

```js
let catalogViewMode = 'grid';

function toggleViewMode() {
  catalogViewMode = catalogViewMode === 'grid' ? 'list' : 'grid';
  const btn = document.getElementById('view-mode-btn');
  if (btn) btn.textContent = catalogViewMode === 'grid' ? '☰' : '⊞';
  renderCatalog();
}
```

```html
<button id="view-mode-btn" onclick="toggleViewMode()" title="החלף תצוגה">☰</button>
```

**ב-renderCatalog:**
```js
const isList = catalogViewMode === 'list';
// בנה: isList ? productCardListHtml(p) : productCardHtml(p)
```

```css
.products-list { display:flex;flex-direction:column;gap:12px }
.product-card-list { display:flex;gap:12px;background:var(--card);border-radius:20px;padding:13px;border:1px solid var(--border);cursor:pointer }
.product-card-list .product-img-wrap { width:84px;height:84px;flex:none;border-radius:14px;overflow:hidden }
```

---

## 16. Pizza Builder

**מתי פעיל:** `p.product_type === 'pizza_builder'` או `options[0].isPizza === true`

```js
let _isPizzaProduct = false;
let _pizzaToppings = [], _pizzaState = {}, _activePizzaTopping = null;
// _pizzaState: { toppingName: [q0,q1,q2,q3] }  0=ריק, 1=חצי, 2=כפול
```

**פונקציות חובה:**
- `initPizzaBuilder(toppings)` — אתחול state
- `renderPizzaBuilder()` — ציור SVG + UI
- `selectPizzaTopping(name)` — בחירת תוספת פעילה
- `togglePizzaSlice(qi)` — 0→1→2→0 לכל רבע
- `fillPizza(action)` — `'whole'|'half1'|'half2'|'clear'`
- `calcPizzaExtra()` — חישוב מחיר תוספות לפי רבעים
- `getPizzaSelections()` — מחזיר `{selections:[], extraPrice}` לעגלה

**SVG בסיסי (100×100):** 4 רבעים `<path>`, fill: 0=transparent, 1=#fca5a5, 2=#ef4444.
**חישוב מחיר:** `(price / 4) * quartersCount` לכל תוספת.

---

## 17. badge_color — תמיכה בצבעי badge

```js
// badge_color: 'red'|'green'|'blue'|'purple'|'orange'|'dark'
const badge = p.badge ? `<span class="product-badge-pill ${escHtml(p.badge_color||'dark')}">${escHtml(p.badge)}</span>` : '';
```

```css
.product-badge-pill { font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;display:inline-block }
.product-badge-pill.red    { background:#fee2e2;color:#b91c1c }
.product-badge-pill.green  { background:#dcfce7;color:#166534 }
.product-badge-pill.blue   { background:#dbeafe;color:#1d4ed8 }
.product-badge-pill.purple { background:#f3e8ff;color:#7e22ce }
.product-badge-pill.orange { background:#ffedd5;color:#c2410c }
.product-badge-pill.dark   { background:var(--dark);color:#fff }
```

---

## 18. isStoreOpen — סטטוס פתוח/סגור

```js
function isStoreOpen(s) {
  if (!s.open_time || !s.close_time) return true;
  const now = new Date();
  const [oh,om] = s.open_time.split(':').map(Number);
  const [ch,cm] = s.close_time.split(':').map(Number);
  const nowMins = now.getHours()*60 + now.getMinutes();
  return nowMins >= oh*60+om && nowMins < ch*60+cm;
}
// בhero: dot ירוק/אדום, open badge, ticker-bar
```

---

## 19. Loyalty

```js
let _loyaltyJoined = false;
// הצג section רק אם storeData.settings.has_loyalty
async function joinLoyalty() {
  if (_loyaltyJoined) return;
  const r = await fetch(`${API}/store/loyalty/join`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({groupId})
  });
  const d = await r.json();
  if (d.success) { _loyaltyJoined = true; /* עדכן UI */ }
}
```

---

## 20. escHtml + showToast + applyAccent + fmtPrice — חובה

```js
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _toastTimer;
function showToast(msg, dur=2800) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.style.display='none', dur);
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const r=parseInt(m[1].slice(0,2),16), g=parseInt(m[1].slice(2,4),16), b=parseInt(m[1].slice(4,6),16);
    document.documentElement.style.setProperty('--accent-dark',
      `rgb(${Math.max(0,r-30)},${Math.max(0,g-30)},${Math.max(0,b-30)})`);
  }
}

function fmtPrice(n) { return '₪' + Number(n||0).toLocaleString('he-IL'); }
function cartKey(id, variant) { return `${id}__${variant||'default'}`; }
function cartTotal() { return Object.values(cart).reduce((s,i) => s + i.price*i.qty, 0); }
function cartCount() { return Object.values(cart).reduce((s,i) => s + i.qty, 0); }
```

---

## 21. Product Sheet — מודל פרטי מוצר

**HTML (לפני `</body>`):**
```html
<div id="sheet-overlay" onclick="closeSheet(event)">
  <div id="product-sheet">
    <button id="sheet-close-btn" onclick="closeSheet(null,true)">✕</button>
    <img id="sheet-img" src="" alt="" style="display:none">
    <div id="sheet-name"></div>
    <div id="sheet-price"></div>
    <div id="sheet-desc"></div>
    <div id="sheet-options"></div>
    <div id="sheet-qty-row">
      <div id="sheet-qty-stepper">
        <button onclick="sheetQtyChange(-1)">−</button>
        <span id="sheet-qty-val">1</span>
        <button onclick="sheetQtyChange(1)">+</button>
      </div>
    </div>
    <button id="sheet-add-btn" onclick="sheetAdd()">הוסף לעגלה</button>
  </div>
</div>
```

**CSS:**
```css
#sheet-overlay{position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.5);display:none;align-items:flex-end;justify-content:center}
#sheet-overlay.open{display:flex}
#product-sheet{position:relative;background:var(--card);border-radius:22px 22px 0 0;padding:24px 20px 36px;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;animation:rise .25s ease}
#sheet-img{width:100%;height:200px;object-fit:cover;border-radius:16px;margin-bottom:16px}
#sheet-name{font-family:'Rubik',sans-serif;font-size:20px;font-weight:700;margin-bottom:4px}
#sheet-price{font-size:18px;font-weight:700;color:var(--accent);margin-bottom:8px}
#sheet-desc{font-size:13.5px;color:var(--muted);line-height:1.6;margin-bottom:16px}
.sheet-opt-label{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px}
.sheet-opt-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.sheet-opt-btn{padding:6px 14px;border-radius:99px;border:1.5px solid var(--border);font-size:13px;background:var(--card);cursor:pointer;transition:.12s}
.sheet-opt-btn.active{border-color:var(--accent);background:var(--accent);color:#fff}
#sheet-qty-stepper{display:inline-flex;align-items:center;gap:12px;background:var(--subtle);border-radius:99px;padding:4px 8px;margin-bottom:16px}
#sheet-qty-stepper button{width:32px;height:32px;border-radius:50%;border:none;background:var(--card);font-size:18px;cursor:pointer}
#sheet-qty-val{font-size:16px;font-weight:700;min-width:24px;text-align:center}
#sheet-add-btn{width:100%;padding:14px;border-radius:14px;background:var(--accent);color:#fff;font-size:15px;font-weight:700;cursor:pointer;border:none}
#sheet-add-btn:hover{background:var(--accent-dark)}
#sheet-close-btn{position:absolute;top:16px;left:16px;width:32px;height:32px;border-radius:50%;background:var(--subtle);border:none;font-size:16px;cursor:pointer;color:var(--muted)}
```

**JS:**
```js
let _sheetId = null, _sheetQty = 1, _sheetSelOpt = {};

function openSheet(id, e) {
  if (e) e.stopPropagation();
  const p = catalog.find(x => x.id == id);
  if (!p) return;
  _sheetId = id; _sheetQty = 1; _sheetSelOpt = {};
  const img = document.getElementById('sheet-img');
  if (p.image_url) { img.src = escHtml(p.image_url); img.style.display = 'block'; }
  else img.style.display = 'none';
  document.getElementById('sheet-name').textContent = p.name || '';
  document.getElementById('sheet-price').textContent = fmtPrice(p.price);
  document.getElementById('sheet-desc').textContent = p.description || '';
  document.getElementById('sheet-qty-val').textContent = '1';
  // אפשרויות (צבעים / גרסאות)
  const opts = p.colors || p.options || [];
  let optHtml = '';
  if (opts.length) {
    const first = opts[0]?.name || opts[0]?.label || String(opts[0]);
    _sheetSelOpt.val = first;
    optHtml = `<div class="sheet-opt-label">צבע / גרסה</div><div class="sheet-opt-row">` +
      opts.map((o,i) => {
        const lbl = o.name || o.label || String(o);
        return `<button class="sheet-opt-btn${i===0?' active':''}" onclick="sheetSelectOpt(this,'${escHtml(lbl)}')">${escHtml(lbl)}</button>`;
      }).join('') + '</div>';
  }
  document.getElementById('sheet-options').innerHTML = optHtml;
  sheetUpdateBtn(p);
  document.getElementById('sheet-overlay').classList.add('open');
}

function sheetSelectOpt(btn, val) {
  document.querySelectorAll('#sheet-options .sheet-opt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _sheetSelOpt.val = val;
}

function sheetQtyChange(delta) {
  _sheetQty = Math.max(1, _sheetQty + delta);
  document.getElementById('sheet-qty-val').textContent = _sheetQty;
  const p = catalog.find(x => x.id == _sheetId);
  if (p) sheetUpdateBtn(p);
}

function sheetUpdateBtn(p) {
  document.getElementById('sheet-add-btn').textContent = `הוסף לעגלה — ${fmtPrice(p.price * _sheetQty)}`;
}

function sheetAdd() {
  const p = catalog.find(x => x.id == _sheetId);
  if (!p) return;
  const variant = _sheetSelOpt.val || '';
  const key = cartKey(p.id, variant);
  if (cart[key]) cart[key].qty += _sheetQty;
  else cart[key] = {id:p.id, name:p.name, price:p.price, qty:_sheetQty, note:variant, colorName:variant};
  showToast(`✓ ${p.name} נוסף לעגלה`);
  closeSheet(null, true);
  renderCartDock();
  updateHeaderCart?.();
}

function closeSheet(e, force) {
  if (!force && e && document.getElementById('product-sheet').contains(e.target)) return;
  document.getElementById('sheet-overlay').classList.remove('open');
}
```

---

## 22. Volume Tiers — הנחות כמות (B2B)

```js
function renderVolumeTiers(s) {
  const tiers = storeData.volume_tiers || s.volume_tiers || [];
  if (!tiers.length) return;
  const total = cartCount();
  document.getElementById('volume-tiers').innerHTML = tiers.map((tier, i) => {
    const next = tiers[i+1];
    const active = next ? (total >= tier.min_qty && total < next.min_qty) : (total >= tier.min_qty);
    return `<div class="vtier${active?' hl':''}">
      <div class="vtier-range">${escHtml(tier.label)}</div>
      <div class="vtier-note">${escHtml(tier.note)}</div>
    </div>`;
  }).join('');
}
```

```css
#volume-tiers { display:flex;flex-wrap:wrap }
.vtier { flex:1;min-width:110px;padding:12px 14px;border-left:1px solid rgba(255,255,255,.08);text-align:center }
.vtier.hl .vtier-range { color:var(--accent) }
```

---

## 23. Bundles — חבילות מוכנות

```js
function renderBundles() {
  const bundles = storeData.bundles || [];
  if (!bundles.length) return;
  document.getElementById('bundles-section').style.display = '';
  document.getElementById('bundles-grid').innerHTML = bundles.map(b => `
    <div class="bundle-card">
      <div class="bundle-name">${escHtml(b.name)}</div>
      <div class="bundle-desc">${escHtml(b.description||'')}</div>
      <div class="bundle-price">${fmtPrice(b.price)}</div>
      <button onclick="addBundle(${JSON.stringify(b).replace(/"/g,'&quot;')})">הוסף לעגלה</button>
    </div>`).join('');
}

function addBundle(b) {
  const key = 'bundle__' + b.name;
  if (cart[key]) cart[key].qty++;
  else cart[key] = {id:'bundle_'+b.name, name:b.name, price:b.price, qty:1, note:'חבילה', colorName:''};
  showToast(`✓ חבילה "${b.name}" נוספה לעגלה`);
  renderCartDock();
}
```

---

## 24. Quote Request Modal — הצעת מחיר

```html
<div id="quote-overlay" onclick="closeQuote(event)"
  style="position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;padding:20px">
  <div id="quote-panel" style="background:var(--card);border-radius:22px;padding:28px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;animation:pop .3s ease;position:relative">
    <button onclick="closeQuote(null,true)" style="position:absolute;top:16px;left:16px;...">✕</button>
    <div id="quote-title">בקשת הצעת מחיר</div>
    <input id="qf-biz" placeholder="שם העסק *">
    <input id="qf-contact" placeholder="טלפון / אימייל *">
    <textarea id="qf-msg" rows="4" placeholder="פרטו דרישות..."></textarea>
    <button onclick="sendQuote()">שלח בקשה</button>
  </div>
</div>
```

```js
function openQuote() { document.getElementById('quote-overlay').style.display = 'flex'; }
function closeQuote(e, force) {
  if (!force && e && document.getElementById('quote-panel').contains(e.target)) return;
  document.getElementById('quote-overlay').style.display = 'none';
}
async function sendQuote() {
  const biz = document.getElementById('qf-biz').value.trim();
  const contact = document.getElementById('qf-contact').value.trim();
  if (!biz || !contact) { showToast('נא למלא שם ופרטי קשר'); return; }
  const msg = document.getElementById('qf-msg').value.trim();
  try {
    await fetch(`${API}/storefront/quote`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({groupId, biz, contact, msg})
    });
    showToast('✓ הבקשה נשלחה! נחזור אליכם בהקדם');
    closeQuote(null, true);
  } catch(e) { showToast('שגיאה, נסו שוב'); }
}
```

---

## 25. Footer — מנוהל מ-Settings

```js
function renderFooter(s) {
  const name = storeData.groupName || '';
  document.getElementById('footer-name').textContent = name;
  if (s.description) document.getElementById('footer-desc').textContent = s.description;
  if (s.phone) {
    document.getElementById('footer-phone-text').textContent = s.phone;
    document.getElementById('footer-phone-link').href = `tel:${s.phone}`;
  }
  if (s.address) document.getElementById('footer-addr').textContent = s.address;
  if (s.email) document.getElementById('footer-email').textContent = s.email;
  document.getElementById('footer-year').textContent = new Date().getFullYear();
}
```

---

## 26. Mobile — כללי CSS חובה

```css
/* מניעת overflow אופקי */
body { overflow-x:hidden }
* { box-sizing:border-box }

/* שמות מוצרים ארוכים */
.product-name { overflow-wrap:break-word;word-break:break-word }

/* עמודות responsive */
@media(max-width:767px) {
  /* הסתר אלמנטים פחות קריטיים */
  #header-name { display:none }
  #quote-btn { display:none }
  /* search לרוחב מלא */
  #header-search-wrap { min-width:0;max-width:none;flex:1 }
  /* hero text קטן יותר */
  #hero h1 { font-size:clamp(22px,6vw,36px) }
  /* stats עם wrap */
  #hero-stats { flex-wrap:wrap;gap:16px }
  /* top bar slim */
  #top-bar { padding:6px 12px;font-size:11px }
  /* cart dock static */
  #cart-dock { position:static }
}
```

---

## 27. Top Bar — מידע פעיל

```html
<div id="top-bar">
  <span id="ref-badge">REF#<span id="session-ref">---</span></span>
  <div id="top-bar-center">
    <!-- הודעות קבועות — אפשר לקרוא מ-s.ticker_messages -->
  </div>
  <span id="top-open-status"></span>
</div>
```

```js
// ב-renderTicker:
document.getElementById('session-ref').textContent = Math.random().toString(36).slice(2,8).toUpperCase();
document.getElementById('top-open-status').textContent = isOpen ? '🟢 פתוח' : '🔴 סגור';
```

---

## 28. Ticker Bar — סטטוס שעות

```js
function renderTicker(s) {
  const isOpen = isStoreOpen(s);
  const bar = document.getElementById('ticker-bar');
  if (s.open_time || s.phone) {
    bar.style.display = 'flex';
    document.getElementById('ticker-dot').style.background = isOpen ? '#7FB77E' : '#ef4444';
    document.getElementById('ticker-status').textContent = isOpen ? 'פתוח עכשיו' : 'סגור כעת';
  }
}
```

---

## 29. Service Worker — עדכן גרסה

אחרי **כל** שינוי בתבנית — **חובה** להעלות גרסה:
```js
// public/sw.js
const CACHE_NAME = 'family-flow-vNNN'; // N+1
```

---

## 30. הוספת תבנית לממשק הניהול

כשיוצרים תבנית חדשה, יש לעדכן **3 מקומות** (ללא פגיעה בקיים):

**א. `server.js` — templateMap:**
```js
const templateMap = {
  'classic':    'storefront.html',
  'restaurant': 'storefront-restaurant.html',
  'sport':      'storefront-sport.html',
  'NEW_ID':     'storefront-NEW.html',  // ← הוסף
};
```

**ב. `business.html` — template-picker:**
```html
<!-- שנה grid-cols-N בהתאם -->
<div class="template-card ..." data-tid="NEW_ID" onclick="selectStoreTemplate('NEW_ID')">
  <div class="text-2xl mb-1">EMOJI</div>
  <div class="text-xs font-bold text-slate-700">שם התבנית</div>
  <div class="text-[10px] text-slate-400">תת-כותרת</div>
</div>
```

**ג. `business-app.js` — אותו שינוי + עדכון `selectStoreTemplate`:**
```js
// אם התבנית צריכה שדות הגדרה ייחודיים — הוסף tid לתנאי:
if (extra) extra.style.display = (tid === 'restaurant' || tid === 'sport' || tid === 'NEW_ID') ? '' : 'none';
```

---

## 31. חוקי עבודה קריטיים

1. **אין נגיעה ב-business.html / business-app.js** — אלא אם התבקש במפורש
2. **אין שינוי backend** — כל הלוגיקה frontend בלבד עם API קיים
3. **escHtml על כל input משתמש/API** — ללא יוצא מן הכלל
4. **RTL כברירת מחדל** — `dir="rtl"` ב-html, רק toggleLang משנה
5. **כל API call עם try/catch** — אין קריסות מ-network errors
6. **מוצרים עם `is_available === false`** — לסנן מהתצוגה
7. **תמיד loadAsync אחרי render ראשוני** — לא לחסום render בנתונים לא-קריטיים
8. **אחרי renderCatalog** — קרא `initScrollSpy()` מחדש
9. **תמונות מוצרים** — לבדוק `p.image_url` (לא `p.has_image`)
10. **אין hardcoded stats בהירו** — כל נתון מספרי מ-`storeData.settings`
11. **banner_url** — לבדוק `s.banner_url !== 'DELETE' && s.banner_url !== 'null'`
12. **sw.js** — להעלות גרסה אחרי כל שינוי

---

## 32. בדיקות לאחר יישום

- [ ] Quick actions מופיעים מהגדרות? (טלפון, וואטסאפ, Waze, מפה)
- [ ] כפתורי הזמנה (שולחן/מקום/אירוע) — מופיעים רק כשמוגדר ב-settings?
- [ ] הזמנת שולחן — 3 שלבים? (slots → SMS → אישור)
- [ ] כותרת hero = שם העסק מ-storeData.groupName?
- [ ] סלוגן = s.slogan (לא hardcoded)?
- [ ] Stats בhero — רק מה שמוגדר בhגדרות?
- [ ] banner_url מוצג כ-overlay?
- [ ] תמונות קטלוג בהירו — כשאין banner?
- [ ] מחיר קהילה מוצג כשיש discount_active?
- [ ] BOGO מחשב נכון (כל 2 = 1 חינם)?
- [ ] קופון מ-API נקלט ומפחית?
- [ ] גלריה נטענת ו-lightbox עובד?
- [ ] Scroll spy מעדכן nav?
- [ ] Multi-language toggle מחליף כיוון + טקסטים?
- [ ] Side menu נפתח עם כל הקטגוריות?
- [ ] Grid/list toggle מחליף תצוגה?
- [ ] Product sheet נפתח בלחיצה — תמונה, תיאור, אפשרויות, כמות, הוספה?
- [ ] Pizza builder: רבעים, X2, מחיר, עגלה?
- [ ] badge_color עם CSS class?
- [ ] Volume tiers — מתעדכנים עם שינוי עגלה?
- [ ] Bundles — מוצגים כשקיימים ב-storeData?
- [ ] Quote modal — שולח ל-/api/storefront/quote?
- [ ] Footer — כל השדות מ-settings?
- [ ] Mobile — אין overflow אופקי? word-break על שמות?
- [ ] sw.js גרסה עלתה?
- [ ] templateMap בserver.js עודכן?
- [ ] template-picker ב-business.html + business-app.js עודכן?
