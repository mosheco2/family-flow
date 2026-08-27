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
}
```

### Animations חובה
```css
@keyframes rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
@keyframes pop  { 0%{transform:scale(.72);opacity:0} 65%{transform:scale(1.07)} 100%{transform:scale(1);opacity:1} }
@keyframes glow { 0%,100%{opacity:.45} 50%{opacity:1} }
@keyframes spin { to{transform:rotate(360deg)} }
```

---

## 2. State Variables — כל משתן חייב להיות מוגדר

```js
const API = '/api';
let storeData = null, catalog = [], favs = new Set();
let cart = {}; // {key: {id,name,price,qty,note}}
let isDelivery = true, _cartStep = 'cart', _couponDiscount = 0, _couponCode = '';
let _sheetId = null, _sheetQty = 1, _sheetExtras = {}, _sheetNote = '';
let _panelOpen = false, _loyaltyJoined = false;
let _bookingType = 'table', _payMethod = 0, _bookStep = 1, _bookTempId = null, _bookSelectedSlot = null;
let _address = '', _orderNo = '';
let _activePromos = [];
let _galleryImages = [], _lbIndex = 0;
let _searchQ = '';

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
  // 1. קרא store code מ-URL (pathname או ?store=)
  // 2. fetch /api/storefront/:code
  // 3. שמור storeData, catalog
  // 4. קרא renderAll()
  // 5. הסתר loading screen
  // 6. קרא loadAsync(groupId) לטעינת data אסינכרוני
  // 7. initScrollSpy() אחרי renderCatalog
  // 8. initSlots() לכפתורי זמן
}
```

**loadAsync חייב לכלול:**
1. `/api/store/promotions/:groupId` → `_activePromos` → `renderDeals()`
2. `/api/public/reviews/:groupId` → `renderReviews()`
3. `/api/public/gallery/:groupId` → `_galleryImages` → הצג כפתור גלריה

---

## 4. renderAll — סדר קריאות חובה

```js
function renderAll() {
  renderTicker(storeData);
  renderHeader(storeData, storeData.settings);
  renderHero(storeData, storeData.settings);
  renderQuickActions(storeData, storeData.settings);
  renderInfoSection(storeData, storeData.settings);
  renderCategories();
  renderCatalog();
  updateCartBar();
  updateFulfilBtn();
  initSlots();
  if (_panelOpen) renderPanelCart();
}
```

---

## 5. Quick Actions — חובה להציג

**לוגיקה:** קרא מ-`settings` של העסק, בנה כפתורי ghost על רקע dark.

```js
function renderQuickActions(data, s) {
  const btns = [];
  // טלפון
  if (s.phone) btns.push(`<a class="qa-btn" href="tel:${s.phone}">📞 ${s.phone}</a>`);
  // וואטסאפ
  const wa = s.whatsapp_number || s.phone;
  if (wa) btns.push(`<a class="qa-btn" href="https://wa.me/972${wa.replace(/\D/g,'').replace(/^0/,'')}" target="_blank">💬 וואטסאפ</a>`);
  // Waze + Google Maps
  if (s.biz_lat && s.biz_lng) {
    btns.push(`<a class="qa-btn" href="https://waze.com/ul?ll=${s.biz_lat},${s.biz_lng}&navigate=yes" target="_blank">🚗 Waze</a>`);
    btns.push(`<a class="qa-btn" href="https://maps.google.com/?q=${s.biz_lat},${s.biz_lng}" target="_blank">📍 ${s.biz_address||'מפה'}</a>`);
  } else if (s.biz_address) {
    btns.push(`<a class="qa-btn" href="https://maps.google.com/?q=${encodeURIComponent(s.biz_address)}" target="_blank">📍 ${s.biz_address}</a>`);
  }
  document.getElementById('quick-actions').innerHTML = btns.join('');
}
```

CSS בסיסי:
```css
.qa-btn { display:inline-flex;align-items:center;gap:7px;padding:8px 14px;
  border:1px solid rgba(255,255,255,.22);border-radius:99px;
  background:rgba(255,255,255,.08);color:rgba(255,255,255,.88);
  font-size:12.5px;font-weight:500;cursor:pointer;text-decoration:none;
  transition:.15s;white-space:nowrap }
.qa-btn:hover { background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.4) }
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
// state
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
  Object.values(cart).forEach(c => {
    byId[c.id] = (byId[c.id]||0) + c.qty;
  });
  Object.entries(byId).forEach(([id, qty]) => {
    const p = catalog.find(x=>x.id==id);
    if (!p) return;
    const free = Math.floor(qty / 2);
    discount += free * p.price;
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
  renderPanelCart();
}
```

**חישוב סופי:**
```js
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
// טעינה
const r3 = await fetch(`${API}/public/gallery/${groupId}`);
const d3 = await r3.json();
if (d3.success && d3.images?.length) {
  _galleryImages = d3.images;
  // הצג כפתור "גלריית תמונות · X תמונות"
}

// Lightbox
function openLb(i) {
  _lbIndex = i;
  document.getElementById('lb-overlay').style.display = 'flex';
  renderLb();
}
function lbNav(dir) {
  _lbIndex = (_lbIndex + dir + _galleryImages.length) % _galleryImages.length;
  renderLb();
}
function renderLb() {
  const img = _galleryImages[_lbIndex];
  document.getElementById('lb-img').src = img.url || img;
  document.getElementById('lb-counter').textContent = `${_lbIndex+1} / ${_galleryImages.length}`;
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
```

---

## 12. הירו — תמונות רנדומליות מהקטלוג

```js
function renderHero(data, s) {
  // בנה 3 קוביות תמונה מתוך מוצרים עם תמונות, בסדר רנדומלי
  const imgItems = catalog.filter(p => p.has_image);
  const shuffled = [...imgItems].sort(() => Math.random() - 0.5);
  // [0] → hero-img-main, [1] → hero-side-top, [2] → hero-side-bottom
  // אם אין תמונות — placeholder emoji
}
```

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
<button onclick="toggleLang()" id="lang-toggle">
  🌐 <span id="lang-label">English</span>
</button>
```

**כל טקסט UI** — שימוש ב-`t('עברית', 'English')` על כל טקסט גלוי.

---

## 14. Side Menu

**HTML:**
```html
<div id="menu-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:900;display:none;opacity:0;transition:opacity .3s" onclick="toggleSideMenu(false)"></div>
<div id="side-menu" style="position:fixed;top:0;right:0;bottom:0;width:min(280px,85vw);background:#fff;z-index:901;box-shadow:-8px 0 32px rgba(0,0,0,.2);transform:translateX(100%);transition:transform .3s">
  <!-- כותרת + רשימת קטגוריות -->
  <div id="side-categories-list"></div>
</div>
```

**CSS:**
```css
#side-menu { transform: translateX(100%); transition: transform .3s cubic-bezier(.4,0,.2,1); }
#side-menu.open { transform: translateX(0); }
```

**JS:**
```js
function toggleSideMenu(isOpen) {
  const menu = document.getElementById('side-menu');
  const overlay = document.getElementById('menu-overlay');
  if (isOpen) {
    menu.classList.add('open');
    overlay.style.display = 'block';
    setTimeout(() => overlay.style.opacity = '1', 10);
    // בנה רשימת קטגוריות ב-#side-categories-list
    const cats = [...new Set(catalog.map(p => p.category).filter(Boolean))];
    document.getElementById('side-categories-list').innerHTML = cats.map(cat =>
      `<button onclick="scrollToCat('${escHtml(cat)}');toggleSideMenu(false)" ...>${escHtml(cat)}</button>`
    ).join('');
  } else {
    menu.classList.remove('open');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display = 'none', 300);
  }
}
function scrollToCat(cat) {
  document.getElementById('cat-group-' + cat)?.scrollIntoView({behavior:'smooth',block:'start'});
}
```

**כפתור בהדר:**
```html
<button onclick="toggleSideMenu(true)" title="תפריט קטגוריות">≡</button>
```

---

## 15. Grid/List Toggle

**State:**
```js
let catalogViewMode = 'grid'; // 'grid' | 'list'
```

**Toggle:**
```js
function toggleViewMode() {
  catalogViewMode = catalogViewMode === 'grid' ? 'list' : 'grid';
  const btn = document.getElementById('view-mode-btn');
  if (btn) btn.textContent = catalogViewMode === 'grid' ? '☰' : '⊞';
  renderCatalog();
}
```

**בכפתור הדר:**
```html
<button id="view-mode-btn" onclick="toggleViewMode()" title="החלף תצוגה">☰</button>
```

**ב-renderCatalog:**
```js
const isList = catalogViewMode === 'list';
const gridClass = isList ? 'products-list' : 'products-grid';
// בנה כרטיסים: isList ? productCardListHtml(p) : productCardHtml(p)
```

**CSS list:**
```css
.products-list { display:flex;flex-direction:column;gap:12px }
.product-card-list { display:flex;gap:12px;background:var(--card);border-radius:20px;padding:13px;border:1px solid var(--border);cursor:pointer }
.product-card-list .product-img-wrap { width:84px;height:84px;flex:none;border-radius:14px;overflow:hidden }
```

---

## 16. Pizza Builder

**מתי פעיל:** `p.product_type === 'pizza_builder'` או `options[0].isPizza === true`

**State:**
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

**SVG בסיסי (100×100):**
- רקע עיגול צהוב `fill="#fef08a"`
- 4 רבעים כ-`<path>` עם `onclick="togglePizzaSlice(qi)"`
- צבע fill: `0=transparent`, `1=#fca5a5`, `2=#ef4444`
- X2 text כש-val===2
- קווי חלוקה אופקי/אנכי

**חישוב מחיר:** `(price / 4) * quartersCount` לכל תוספת.

**שילוב ב-openSheet:**
```js
if (p.product_type === 'pizza_builder' || opts[0]?.isPizza) {
  initPizzaBuilder(opts[0]?.toppings || opts);
  optHtml = `<div id="pizza-builder-wrapper"></div>`;
  // אחרי הכנסה ל-DOM:
  renderPizzaBuilder();
}
```

**שילוב ב-sheetAdd:**
```js
if (_isPizzaProduct) {
  const {selections, extraPrice} = getPizzaSelections();
  extra = extraPrice;
  noteArr = selections;
}
```

---

## 17. badge_color — תמיכה בצבעי badge

```js
const badgeColor = p.badge_color || '';
// badge_color יכול להיות: 'red', 'green', 'blue', 'purple', 'orange', 'dark'
// הוסף CSS classes בהתאם:
```
```css
.product-badge-pill { font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;display:inline-block }
.product-badge-pill.red { background:#fee2e2;color:#b91c1c }
.product-badge-pill.green { background:#dcfce7;color:#166534 }
.product-badge-pill.blue { background:#dbeafe;color:#1d4ed8 }
.product-badge-pill.purple { background:#f3e8ff;color:#7e22ce }
.product-badge-pill.orange { background:#ffedd5;color:#c2410c }
.product-badge-pill.dark { background:var(--dark);color:#fff }
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
  const openMins = oh*60+om, closeMins = ch*60+cm;
  return nowMins >= openMins && nowMins < closeMins;
}
// בהירו: ticker, dot ירוק/אפור, open badge
```

---

## 19. Loyalty

```js
// הצג section רק אם storeData.settings.has_loyalty
// כפתור "הצטרפות" → POST /api/store/loyalty/join עם groupId
let _loyaltyJoined = false;
async function joinLoyalty() {
  if (_loyaltyJoined) return;
  const r = await fetch(`${API}/store/loyalty/join`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({groupId})});
  const d = await r.json();
  if (d.success) { _loyaltyJoined = true; /* עדכן UI */ }
}
```

---

## 20. escHtml + showToast — חובה בכל תבנית

```js
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
let _toastTimer;
function showToast(msg, duration=2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.style.display='none', duration);
}
```

---

## 21. Service Worker — עדכן גרסה

אחרי כל שינוי בתבנית — **חובה** להעלות גרסה ב-`public/sw.js`:
```js
const CACHE_NAME = 'family-flow-vNNN'; // N+1
```

---

## 22. חוקי עבודה קריטיים

1. **אין נגיעה ב-business.html / business-app.js** — אלא אם התבקש במפורש
2. **אין שינוי backend** — כל הלוגיקה היא frontend בלבד עם API קיים
3. **escHtml על כל input משתמש/API** — ללא יוצא מן הכלל
4. **RTL כברירת מחדל** — `dir="rtl"` ב-html, רק toggleLang משנה
5. **כל API call עם try/catch** — אין קריסות מ-network errors
6. **מוצרים עם `is_available === false`** — לסנן מהתצוגה
7. **תמיד `loadAsync` אחרי render ראשוני** — לא לחכות לנתונים לא-קריטיים
8. **אחרי renderCatalog** — קרא `initScrollSpy()` מחדש (observer על elements חדשים)

---

## 23. בדיקות לאחר יישום

לאחר יישום כל פיצ'ר, בדוק שאלות אלו:

- [ ] Quick actions מופיעים? (טלפון, וואטסאפ, Waze, מפה)
- [ ] הזמנת שולחן עוברת 3 שלבים? (slots → SMS → אישור)
- [ ] מחיר קהילה מוצג כשיש discount_active?
- [ ] BOGO מחשב נכון (כל 2 = 1 חינם)?
- [ ] קופון מ-API נקלט ומפחית?
- [ ] גלריה נטענת ו-lightbox עובד?
- [ ] Scroll spy מעדכן nav?
- [ ] הירו מציג תמונות מוצרים רנדומלית?
- [ ] Multi-language toggle מחליף כיוון + טקסטים?
- [ ] Side menu נפתח עם כל הקטגוריות?
- [ ] Grid/list toggle מחליף תצוגה?
- [ ] Pizza builder: רבעים, X2, מחיר, עגלה?
- [ ] badge_color עם CSS class?
- [ ] sw.js גרסה עלתה?
