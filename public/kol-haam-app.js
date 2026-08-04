'use strict';

// ── Context (passed via URL params from parent) ──────────────
const _p = new URLSearchParams(location.search);
const CTX = {
    userId:      parseInt(_p.get('userId'))      || null,
    groupId:     parseInt(_p.get('groupId'))     || null,
    communityId: parseInt(_p.get('communityId')) || null,
    role:        _p.get('role') || 'member',   // member / zm / sa
    isZM:        _p.get('role') === 'zm',
    isSA:        _p.get('role') === 'sa',
    zmToken:     _p.get('zmToken') || null,
    communityName: _p.get('communityName') || '',
};

const API = '/api/kol-haam';

// ── State ─────────────────────────────────────────────────────
const STATE = {
    view: 'feed',
    prevView: null,
    scope: 'local',
    categoryId: null,
    categories: [],
    editingItemId: null,
    tags: [],
    editorDirty: false,
    confirmResolve: null,
};

// ── Fetch helpers ─────────────────────────────────────────────
function khFetch(url, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (CTX.isZM && CTX.zmToken) headers['Authorization'] = `Bearer ${CTX.zmToken}`;
    if (CTX.isSA) headers['Authorization'] = 'SA_SECRET_TOKEN_2026';
    return fetch(url, { ...opts, headers }).then(r => r.json());
}

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type = 'info') {
    const el = document.getElementById('kh-toast');
    el.textContent = (type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ') + msg;
    el.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Confirm dialog ────────────────────────────────────────────
function confirm(title, msg, okLabel = 'אישור', danger = false) {
    return new Promise(resolve => {
        STATE.confirmResolve = resolve;
        document.getElementById('kh-confirm-title').textContent = title;
        document.getElementById('kh-confirm-msg').textContent = msg;
        const btn = document.getElementById('kh-confirm-ok');
        btn.textContent = okLabel;
        btn.className = 'kh-btn ' + (danger ? 'kh-btn-danger' : 'kh-btn-primary');
        document.getElementById('kh-confirm').classList.add('show');
    });
}

// ── Format helpers ────────────────────────────────────────────
const TYPE_LABELS = { ARTICLE: 'כתבה', QA_QUESTION: 'שאלה', SUCCESS_STORY: 'סיפור הצלחה', WIKI_GUIDE: 'מדריך' };
const TYPE_ICONS  = { ARTICLE: '📰', QA_QUESTION: '❓', SUCCESS_STORY: '🏆', WIKI_GUIDE: '📖' };
// fallback גלובלי — מוחלף ע"י onerror ב-img
window.khImgFallback = function(el) {
    const icon = el.getAttribute('data-ph') || '📰';
    const cls  = el.className || '';
    el.outerHTML = `<div class="${cls}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--primary-light)">${icon}</div>`;
};
function khCoverImg(url, icon, cls, style) {
    const phStyle = style || 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--primary-light)';
    if (!url) return `<div class="${cls||''}" style="${phStyle}">${icon||'📰'}</div>`;
    return `<img src="${url}" alt="" class="${cls||''}" style="${style||'width:100%;height:100%;object-fit:cover;display:block'}" data-ph="${icon||'📰'}" onerror="khImgFallback(this)">`;
}
function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── khToast alias (some code uses khToast, some uses toast) ──────────
function khToast(type, msg) { toast(msg, type); }

// ── showView helper (used by author/search/tag/collection loaders) ──
function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); const body = document.getElementById('kh-body'); if(body) body.scrollTop = 0; }
}

// ── Navigation ────────────────────────────────────────────────
const KH = {
    nav(view, params = {}) {
        STATE.prevView = STATE.view;
        STATE.view = view;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const el = document.getElementById('view-' + view.replace('_', '-'));
        if (el) {
            el.classList.add('active');
            document.getElementById('kh-body').scrollTop = 0;
        }
        // load data for the view
        if (view === 'feed') KH.loadFeed();
        else if (view === 'editor') KH.renderEditor(params.itemId || null);
        else if (view === 'content') KH.loadContent(params.id);
        else if (view === 'my-drafts') KH.loadDrafts();
        else if (view === 'my-content') KH.loadMyContent();
        else if (view === 'zm-queue') KH.loadZMQueue();
        else if (view === 'sa-queue') KH.loadSAQueue();
        else if (view === 'saved') KH.loadSaved();
        else if (view === 'zm-reports') KH.loadZMReports();
        else if (view === 'following') KH.loadFollowingFeed();
        else if (view === 'author') KH.loadAuthor(params.id);
        else if (view === 'search') KH.doSearch();
        else if (view === 'tag') KH.loadTagPage(params.tag);
        else if (view === 'list') KH.loadList(params.mode || 'tag', params.param || '');
        else if (view === 'collections') KH.loadCollections();
        else if (view === 'collection') KH.loadCollection(params.id);
    },

    back() {
        const prev = STATE.prevView || 'feed';
        KH.nav(prev);
    },

    setScope(scope, btn) {
        STATE.scope = scope;
        STATE.categoryId = null;
        document.querySelectorAll('.scope-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.kh-nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        KH.loadFeed();
    },

    setCategory(id, chip) {
        STATE.categoryId = id;
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c === chip));
        document.querySelectorAll('.kh-nav-link').forEach(l => l.classList.toggle('active', l === chip));
        KH.loadFeed();
    },

    confirmResolve(val) {
        document.getElementById('kh-confirm').classList.remove('show');
        if (STATE.confirmResolve) STATE.confirmResolve(val);
        STATE.confirmResolve = null;
    },

    // ── Feed ────────────────────────────────────────────────
    async loadFeed(sort) {
        STATE.feedSort = sort || STATE.feedSort || 'trending';
        const el = document.getElementById('view-feed-inner');
        if (!el) return;
        el.innerHTML = '<div class="kh-spinner" style="padding:2rem 0"></div>';
        const params = new URLSearchParams({ scope: STATE.scope, sort: STATE.feedSort, limit: 30 });
        if (STATE.scope === 'local' && CTX.communityId) params.set('community_id', CTX.communityId);
        if (STATE.categoryId) params.set('category', STATE.categoryId);

        try {
            // Category filter → simple card grid
            if (STATE.categoryId) {
                const data = await khFetch(`${API}/feed?${params}`);
                const items = data.items || [];
                if (data.error) { el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>${esc(data.error)}</p></div>`; return; }
                if (!items.length) { el.innerHTML = `<div class="empty-state" style="padding:2rem"><div class="ei">📭</div><p>אין תוכן בקטגוריה זו</p></div>`; return; }
                el.innerHTML = `<div class="feed-grid" style="padding:.75rem">${items.map(it => KH.renderFeedCard(it)).join('')}</div>`;
                return;
            }

            // Full homepage — parallel loads
            const [data, trendingData, hotData] = await Promise.all([
                khFetch(`${API}/feed?${params}`),
                khFetch(`${API}/feed/trending?community_id=${CTX.communityId||''}&limit=8`),
                khFetch(`${API}/feed/hot-comments?community_id=${CTX.communityId||''}&limit=5`),
            ]);

            const items = data.items || [];
            const trending = trendingData?.items || [];
            const hot = hotData?.items || [];

            if (data.error && !items.length && !trending.length) {
                el.innerHTML = `<div class="empty-state" style="padding:2rem"><div class="ei">⚠️</div><p>שגיאה: ${esc(data.error)}</p></div>`;
                return;
            }

            // ── Hero
            const hero = items[0];
            const heroHtml = hero ? KH.renderFeedHero(hero) : '';

            // ── Strips
            const strip1 = trending.length ? KH.renderFeedStrip('🔥 הכי חמים עכשיו', trending,
                c => `👁 ${(c.views_count||c.likes_count||0).toLocaleString('he-IL')}`) : '';
            const strip2 = hot.length ? KH.renderFeedStrip('💬 התגובות החמות', hot,
                c => `💬 ${c.recent_comments||c.comments_count||0}`) : '';

            // ── Category grid (group remaining items by category)
            const restItems = items.slice(1);
            const catGridHtml = KH.renderFeedCatGrid(restItems);

            // ── Solutions module (QA + SUCCESS from all items)
            const qa = items.find(i => i.content_type === 'QA_QUESTION');
            const success = items.find(i => i.content_type === 'SUCCESS_STORY');
            const solutionsHtml = KH.renderFeedSolutions(qa, success);

            // ── Footer
            const footerHtml = `<footer class="feed-kh-footer">
                <span>ONE flow LIFE · מגזין קהילתי</span>
                <a>אודות</a><a>כתבו לנו</a><a>תנאי שימוש</a><a>נגישות</a>
            </footer>`;

            if (!hero && !trending.length && !hot.length) {
                const cta = CTX.groupId
                    ? `<button class="kh-btn kh-btn-primary" onclick="KH.nav('editor')" style="margin-top:.75rem">✍️ כתוב את הכתבה הראשונה</button>`
                    : '';
                el.innerHTML = `<div class="feed-wrap"><div class="empty-state" style="padding:2rem"><div class="ei">📭</div><p>אין תוכן עדיין</p>${cta}</div>${footerHtml}</div>`;
                return;
            }

            el.innerHTML = `<div class="feed-wrap">${heroHtml}${strip1}${strip2}${catGridHtml}${solutionsHtml}${footerHtml}</div>`;
        } catch(e) {
            el.innerHTML = `<div class="empty-state" style="padding:2rem"><div class="ei">⚠️</div><p>שגיאה: ${esc(e.message)}</p></div>`;
        }
    },

    renderFeedHero(it) {
        const editorBadge = it.is_editor_pick ? `<span class="feed-hero-editor-badge">⭐ בחירת העורך</span>` : '';
        const imgEl = it.cover_image_url
            ? khCoverImg(it.cover_image_url, TYPE_ICONS[it.content_type]||'📰', '', 'width:100%;height:100%;object-fit:cover;display:block')
            : `<div class="feed-hero-img-placeholder">${TYPE_ICONS[it.content_type]||'📰'}</div>`;
        const communityName = it.community_name ? esc(it.community_name) : '';
        return `<div class="feed-hero" onclick="KH.nav('content',{id:${it.id}})">
            <div class="feed-hero-img-wrap">${imgEl}${editorBadge}</div>
            <div class="feed-hero-body">
                <div class="feed-hero-tags">
                    <span class="feed-hero-pill">הכתבה המובילה</span>
                    ${communityName ? `<span class="feed-hero-community">קהילת ${communityName}</span>` : ''}
                </div>
                <h1 class="feed-hero-title">${esc(it.title)}</h1>
                ${it.subtitle ? `<p class="feed-hero-lead">${esc(it.subtitle)}</p>` : ''}
                <div class="feed-hero-meta">
                    ${it.author_name ? `<span>מאת ${esc(it.author_name)}</span><span>·</span>` : ''}
                    <span>🕒 ${it.reading_time_minutes||1} דק׳</span>
                    <span>·</span><span>💬 ${it.comments_count||0}</span>
                    <span>·</span><span>👍 ${it.likes_count||0}</span>
                </div>
            </div>
        </div>`;
    },

    renderFeedStrip(title, items, statFn) {
        const cards = items.map(it => {
            const imgEl = it.cover_image_url
                ? khCoverImg(it.cover_image_url, TYPE_ICONS[it.content_type]||'📄', '', 'width:100%;height:100%;object-fit:cover;display:block')
                : `<div class="feed-strip-card-img-placeholder">${TYPE_ICONS[it.content_type]||'📄'}</div>`;
            const editorBadge = it.is_editor_pick ? `<span class="feed-strip-card-editor">⭐ בחירת העורך</span>` : '';
            return `<div class="feed-strip-card" onclick="KH.nav('content',{id:${it.id}})">
                <div class="feed-strip-card-img-wrap">${imgEl}${editorBadge}<span class="feed-strip-card-stat">${statFn(it)}</span></div>
                <div class="feed-strip-card-body">
                    <div class="feed-strip-card-community">${esc(it.community_name||it.category_title||'')}</div>
                    <div class="feed-strip-card-title">${esc(it.title)}</div>
                </div>
            </div>`;
        }).join('');
        return `<div class="feed-strip-wrap">
            <div class="feed-section-hdr"><h2>${title}</h2><a>לכל הכתבות ←</a></div>
            <div class="feed-strip-scroll">${cards}</div>
        </div>`;
    },

    renderFeedCatGrid(items) {
        const cats = STATE.categories.slice(0, 6);
        if (!cats.length) return '';
        // group items by category_id
        const bycat = {};
        items.forEach(it => {
            const k = it.category_id;
            if (!bycat[k]) bycat[k] = [];
            bycat[k].push(it);
        });
        const blocks = cats.map(cat => {
            const catItems = bycat[cat.id] || [];
            const lead = catItems[0];
            const sub = catItems.slice(1, 4);
            const imgEl = lead?.cover_image_url
                ? khCoverImg(lead.cover_image_url, '📁', '', 'width:100%;height:100%;object-fit:cover;display:block')
                : `<div class="feed-catblock-img-placeholder">📁</div>`;
            const editorBadge = lead?.is_editor_pick ? `<span class="feed-catblock-editor-badge">⭐ בחירת העורך</span>` : '';
            const leadHtml = lead ? `<div class="feed-catblock-lead" onclick="KH.nav('content',{id:${lead.id}})">
                <div class="feed-catblock-img-wrap">${imgEl}${editorBadge}</div>
                <div class="feed-catblock-lead-title">${esc(lead.title)}</div>
            </div>` : `<div class="feed-catblock-img-wrap" style="background:#F5F5F2;"><div class="feed-catblock-img-placeholder" style="color:#C9C9C0;font-size:.9rem;font-family:Heebo,sans-serif;">אין כתבות עדיין</div></div>`;
            const subHtml = sub.map(it => `<div class="feed-catblock-item" onclick="KH.nav('content',{id:${it.id}})">
                <span class="feed-catblock-bullet">•</span><span>${esc(it.title)}</span>
            </div>`).join('');
            return `<div class="feed-catblock">
                <div class="feed-catblock-hdr">
                    <h3>${esc(cat.title)}</h3>
                    <a onclick="KH.setCategory(${cat.id}, null)">עוד ←</a>
                </div>
                ${leadHtml}${subHtml}
            </div>`;
        }).join('');
        return `<div class="feed-catgrid-wrap">
            <div class="feed-section-hdr"><h2>לפי מדורים</h2></div>
            <div class="feed-catgrid">${blocks}</div>
        </div>`;
    },

    renderFeedSolutions(qa, success) {
        const qaTitle = qa ? esc(qa.title) : 'איך מארגנים הסעה משותפת לחוגים בלי אפליקציה בתשלום?';
        const qaBody = qa ? (qa.subtitle ? `<p class="feed-solutions-body">${esc(qa.subtitle)}</p>` : '') : '<p class="feed-solutions-body">14 הורים מהשכונה, 3 ימים בשבוע, לוח זמנים שמשתנה כל חודש. שלוש הצעות כבר על השולחן.</p>';
        const qaStats = qa ? `💬 ${qa.comments_count||0} תשובות · 👍 ${qa.likes_count||0}` : '💬 23 תשובות · 👍 61';
        const qaClick = qa ? `KH.nav('content',{id:${qa.id}})` : `KH.nav('editor')`;
        const successTitle = success ? esc(success.title) : 'גן הירק השכונתי שהתחיל מ־4 עציצים במרפסת';
        const successBody = success ? (success.subtitle ? `<p class="feed-solutions-body">${esc(success.subtitle)}</p>` : '') : '<p class="feed-solutions-body">שאלה שנשאלה כאן לפני שנה הפכה ל־120 מ״ר של גינה משותפת. הנה כל השלבים, כולל מה לא עבד.</p>';
        const successSource = success ? (success.community_name ? `קהילת ${esc(success.community_name)}` : 'קהילת רמת־אלה') : 'קהילת רמת־אלה';
        const successClick = success ? `KH.nav('content',{id:${success.id}})` : 'void 0';
        return `<div class="feed-solutions-wrap">
        <div class="feed-solutions-hdr">
            <img src="/kol-haam-assets/images/ui/ROBOTAI.webp" alt="" class="feed-solutions-robot">
            <h2 class="feed-solutions-hdr-title">פתרונות מהקהילה</h2>
            <a>כל הפתרונות ←</a>
        </div>
        <div class="feed-solutions-cards">
            <div class="feed-solutions-card feed-solutions-card-gold">
                <div class="feed-solutions-label feed-solutions-label-gold">השאלה החמה של היום</div>
                <h3 class="feed-solutions-title">${qaTitle}</h3>
                ${qaBody}
                <div class="feed-solutions-footer">
                    <button class="feed-solutions-btn feed-solutions-btn-primary" onclick="${qaClick}">הצע פתרון</button>
                    <span class="feed-solutions-stat">${qaStats}</span>
                </div>
            </div>
            <div class="feed-solutions-card feed-solutions-card-teal">
                <div class="feed-solutions-label feed-solutions-label-teal">סיפור ההצלחה של השבוע</div>
                <h3 class="feed-solutions-title">${successTitle}</h3>
                ${successBody}
                <div class="feed-solutions-footer">
                    <button class="feed-solutions-btn feed-solutions-btn-secondary" onclick="${successClick}">קרא את הסיפור</button>
                    <span class="feed-solutions-stat">${successSource}</span>
                </div>
            </div>
        </div>
    </div>`;
    },

    renderFeedCard(it) {
        const img = it.cover_image_url
            ? khCoverImg(it.cover_image_url, TYPE_ICONS[it.content_type]||'📄', 'feed-card-img', '')
            : `<div class="feed-card-img">${TYPE_ICONS[it.content_type] || '📄'}</div>`;
        const pin = it.is_pinned_global ? '<span class="pin-badge">📌 מוצמד</span>' : it.is_pinned_local ? '<span class="pin-badge">📌</span>' : '';
        const engagement = `<span>👍 ${it.likes_count||0}</span><span>💬 ${it.comments_count||0}</span>`;
        const authorName = it.author_name ? esc(it.author_name) : '';
        const authorBadge = badgeHtml(it.badge_level, it.is_revoked);
        const editorBadge = it.is_editor_pick ? '<span class="editor-pick-badge">⭐ בחירת עורך</span>' : '';
        return `<div class="feed-card-wrap"><div class="feed-card" onclick="KH.nav('content',{id:${it.id}})">
            ${editorBadge}
            ${img}
            <div class="feed-card-body">
                <div class="feed-card-meta">
                    <span class="type-badge type-${it.content_type}">${TYPE_LABELS[it.content_type]}</span>
                    <span style="font-size:.65rem;color:var(--muted2)">${esc(it.category_title)}</span>
                    ${pin}
                </div>
                <div class="feed-card-title">${esc(it.title)}</div>
                ${it.subtitle ? `<div class="feed-card-sub">${esc(it.subtitle)}</div>` : ''}
                <div class="feed-card-footer">
                    ${authorName ? `<span onclick="event.stopPropagation();KH.nav('author',{id:${it.author_profile_id}})" style="cursor:pointer;color:var(--primary)">${authorName} ${authorBadge}</span>` : `<span>🏘️ ${esc(it.community_name)}</span>`}
                    <span>⏱ ${it.reading_time_minutes} דק'</span>
                    ${engagement}
                    <span>${fmtDate(it.published_at)}</span>
                </div>
            </div>
        </div></div>`;
    },

    // ── Single content ───────────────────────────────────────
    async loadContent(id) {
        STATE.currentContentId = id;
        document.getElementById('content-inner').innerHTML = '<div class="kh-spinner"></div>';
        // register view
        if (CTX.userId) khFetch(`${API}/content/${id}/view`, { method:'POST', body:JSON.stringify({ user_id: CTX.userId }) }).catch(()=>{});

        const [data, stateData] = await Promise.all([
            khFetch(`${API}/content/${id}`),
            CTX.userId ? khFetch(`${API}/content/${id}/user-state?user_id=${CTX.userId}`) : Promise.resolve({ reaction: null, saved: false })
        ]);
        if (!data.success) { document.getElementById('content-inner').innerHTML = '<p>שגיאה בטעינה</p>'; return; }
        const it = data.item;
        const userState = stateData || { reaction: null, saved: false };
        const tags = Array.isArray(it.tags) ? it.tags : (typeof it.tags === 'string' ? JSON.parse(it.tags || '[]') : []);
        const tagsHtml = tags.length ? `<div class="cv-tags"><span class="cv-tag-label">תגיות:</span>${tags.map(t => `<span class="cv-tag" onclick="KH.nav('tag',{tag:'${esc(t).replace(/'/g,'\\\'')}'})"">${esc(t)}</span>`).join('')}</div>` : '';
        const seriesChapterInfo = (it.series_name && it.chapter_number && it.total_chapters) ? `<span style="font-family:monospace;font-size:11px;color:#8A8A82;white-space:nowrap;">סדרה · ${it.chapter_number} מתוך ${it.total_chapters}</span>` : '';
        const seriesNav = (it.prev_chapter_id || it.next_chapter_id) ? `
            <nav class="cv-series-nav">
                ${it.prev_chapter_id ? `<button class="cv-series-nav-btn" onclick="KH.nav('content',{id:${it.prev_chapter_id}})">← פרק קודם: ${esc(it.prev_chapter_title||'')}</button>` : '<div></div>'}
                ${seriesChapterInfo}
                ${it.next_chapter_id ? `<button class="cv-series-nav-btn" onclick="KH.nav('content',{id:${it.next_chapter_id}})">פרק הבא: ${esc(it.next_chapter_title||'')} →</button>` : '<div></div>'}
            </nav>` : '';
        const isOwner = String(it.author_group_id) === String(CTX.groupId);
        const editBtn = isOwner && ['DRAFT','REJECTED'].includes(it.status) ? `<button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.nav('editor',{itemId:${it.id}})"><i class="fa-solid fa-pen"></i> ערוך</button>` : '';
        const deleteBtn = isOwner && it.status !== 'DRAFT' && !it.deletion_requested ? `<button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.requestDeletion(${it.id})"><i class="fa-solid fa-flag"></i> בקש מחיקה</button>` : '';

        const engBar = `<div class="cv-eng-bar" id="eng-bar-${id}">
            <button class="cv-eng-btn ${userState.reaction==='LIKE'?'cv-active-like':''}" id="btn-like-${id}" onclick="KH.react(${id},'LIKE')">👍 <span id="like-count-${id}">${it.likes_count||0}</span></button>
            <button class="cv-eng-btn ${userState.reaction==='DISLIKE'?'cv-active-dislike':''}" id="btn-dislike-${id}" onclick="KH.react(${id},'DISLIKE')">👎 <span id="dislike-count-${id}">${it.dislikes_count||0}</span></button>
            <button class="cv-eng-btn" onclick="(function(){const s=document.getElementById('comments-section');if(s)s.scrollIntoView({behavior:'smooth'});})()">💬 <span>${it.comments_count||0}</span></button>
            <button class="cv-eng-btn ${userState.saved?'cv-active-save':''}" id="btn-save-${id}" onclick="KH.toggleSave(${id})">⭐ <span id="save-count-${id}">${it.saves_count||0}</span></button>
            <button class="cv-eng-btn" id="kh-print-btn" onclick="KH.printContent()">🖨️</button>
            <div class="cv-eng-share"><button class="cv-eng-btn" onclick="KH.share(${id},'${esc(it.title).replace(/'/g,"\\'")}')">📤 שיתוף</button></div>
            <button class="cv-eng-btn" onclick="KH.openReport(${id},null)" title="דיווח">⚠️</button>
        </div>`;

        const allChapters = Array.isArray(it.series_chapters) ? it.series_chapters.filter(c => c.id !== id) : [];
        const seriesAside = (it.series_name && allChapters.length) ? `
        <div class="cv-series-box">
            <div class="cv-series-box-title">עוד בסדרה · ${esc(it.series_name)}</div>
            ${allChapters.map(c => `<div class="cv-series-link" onclick="KH.nav('content',{id:${c.id}})"><div class="cv-series-thumb">${c.cover_image_url ? `<img src="${esc(c.cover_image_url)}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:4px" onerror="this.style.display='none'">` : ''}</div><div><div style="font-size:11px;color:#8A8A82;margin-bottom:2px">פרק ${c.chapter_number}</div><span>${esc(c.title)}</span></div></div>`).join('')}
        </div>` : '';

        const figCaption = `<figcaption class="cv-hero-figcaption">צילום: ${it.cover_photo_credit ? esc(it.cover_photo_credit) : `קהילת ${esc(it.community_name||'')}`}</figcaption>`;
        const breadcrumb = `<div class="cv-breadcrumb"><span class="cv-bc-link" onclick="KH.nav('feed')">בית</span><span class="cv-bc-sep">›</span><span class="cv-bc-link" onclick="KH.nav('feed')">קהילה</span><span class="cv-bc-sep">›</span><span class="cv-bc-cur">${esc(it.category_title||it.community_name||'כתבה')}</span></div>`;
        document.getElementById('content-inner').innerHTML = `
        <div class="cv-page">
            ${breadcrumb}
            ${it.cover_image_url
                ? `<figure class="cv-hero"><img class="cv-hero-img" src="${it.cover_image_url}" alt="${esc(it.title)}"><span class="cv-badge">${esc(it.category_title)||''}</span>${figCaption}</figure>`
                : `<figure class="cv-hero"><div class="cv-hero-placeholder">📣</div><span class="cv-badge">${esc(it.category_title)||''}</span></figure>`}
            <div class="cv-inner">
                <article class="cv-article">
                    <h1 class="cv-h1">${esc(it.title)}</h1>
                    ${it.subtitle ? `<h2 class="cv-h2">${esc(it.subtitle)}</h2>` : ''}
                    <div class="cv-meta">
                        <div class="cv-meta-left">
                            <div class="cv-avatar"></div>
                            <span>מאת: <strong style="color:#16294D;cursor:pointer" onclick="KH.nav('author',{id:${it.author_profile_id}})">${esc(it.author_name)}</strong> ${badgeHtml(it.author_badge_level, it.author_is_revoked)}</span>
                            <span class="cv-sep">|</span>
                            <span style="color:#1F7A72">🏘️ ${esc(it.community_name)}</span>
                            ${it.scope_type === 'GLOBAL' ? '<span style="font-size:11px;color:#8A8A82">🌍 גלובלי</span>' : ''}
                        </div>
                        <div class="cv-meta-right">
                            <span>פורסם: ${fmtDate(it.published_at)}</span>
                            ${it.updated_at ? `<span class="cv-sep">|</span><span>עודכן: ${fmtDate(it.updated_at)}</span>` : ''}
                            <span class="cv-sep">|</span>
                            <span>🕒 ${it.reading_time_minutes} דק' קריאה</span>
                        </div>
                    </div>
                    ${(()=>{
                        if(!it.quick_summary_20s) return '';
                        try {
                            const items = JSON.parse(it.quick_summary_20s);
                            if(Array.isArray(items) && items.length)
                                return `<div class="cv-tldr"><div class="cv-tldr-label">תקציר ב־20 שניות</div><ul>${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`;
                        } catch(e) {}
                        return `<div class="cv-tldr"><p>${esc(it.quick_summary_20s)}</p></div>`;
                    })()}
                    <div class="content-html">${it.content_html}</div>
                    ${seriesNav}
                    ${tagsHtml}
                    ${engBar}
                    <div class="cv-admin-row">
                        ${editBtn}${deleteBtn}
                        ${CTX.isSA ? `<button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.addEditorPick(${it.id})">⭐ בחירת עורך</button>` : ''}
                        <button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.openAddToCollection(${it.id})">📚 אוסף</button>
                        ${(isOwner || CTX.isZM || CTX.isSA) ? `<button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.showVersionHistory(${it.id})">🕐 גרסאות</button>` : ''}
                    </div>
                    ${it.comments_enabled !== false ? `<div id="comments-section" class="comments-section" style="margin-top:32px"></div>` : '<p style="color:#8A8A82;text-align:center;margin:1.5rem 0">התגובות מושבתות לפריט זה</p>'}
                </article>
                <aside class="cv-aside">
                    <div class="cv-newsletter">
                        <img src="/kol-haam-assets/images/ui/ROBOTAI.webp" alt="" style="width:76px;height:76px;object-fit:contain;display:block;margin:0 auto 6px;" onerror="this.style.display='none'">
                        <div class="cv-newsletter-title">שליטה חכמה, זרימה אחת</div>
                        <div class="cv-newsletter-sub">הצטרפו לניוזלטר הקהילתי — כתבה אחת בשבוע.</div>
                        <button class="cv-newsletter-cta">הרשמה</button>
                    </div>
                    ${seriesAside}
                </aside>
            </div>
        </div>`;

        if (it.comments_enabled !== false) {
            KH.loadComments(id, it.content_type);
        }
    },

    async react(id, type) {
        if (!CTX.userId) { toast('יש להתחבר כדי להגיב', 'error'); return; }
        const r = await khFetch(`${API}/content/${id}/react`, { method:'POST', body:JSON.stringify({ user_id: CTX.userId, type }) });
        if (r.success) {
            const m = r.metrics || {};
            const el = document.getElementById(`like-count-${id}`);
            const el2 = document.getElementById(`dislike-count-${id}`);
            if (el) el.textContent = m.likes_count || 0;
            if (el2) el2.textContent = m.dislikes_count || 0;
            const likeBtn = document.getElementById(`btn-like-${id}`);
            const dislikeBtn = document.getElementById(`btn-dislike-${id}`);
            if (likeBtn) likeBtn.classList.toggle('eng-active', r.userReaction === 'LIKE');
            if (dislikeBtn) dislikeBtn.classList.toggle('eng-active', r.userReaction === 'DISLIKE');
            if (dislikeBtn) dislikeBtn.classList.toggle('eng-dislike', r.userReaction === 'DISLIKE');
        }
    },

    async toggleSave(id) {
        if (!CTX.userId) { toast('יש להתחבר כדי לשמור', 'error'); return; }
        const r = await khFetch(`${API}/content/${id}/save`, { method:'POST', body:JSON.stringify({ user_id: CTX.userId }) });
        if (r.success) {
            const btn = document.getElementById(`btn-save-${id}`);
            if (btn) btn.classList.toggle('eng-active', r.saved);
            toast(r.saved ? 'נשמר לקריאה מאוחר יותר ⭐' : 'הוסר מהשמורים', 'success');
        }
    },

    share(id, title) {
        const url = `${location.origin}/kol-haam?view=content&id=${id}`;
        const text = `קרא/י: ${title}\n${url}`;
        // log share
        if (CTX.userId) khFetch(`${API}/content/${id}/share`, { method:'POST', body:JSON.stringify({ user_id: CTX.userId, channel: 'whatsapp' }) }).catch(()=>{});
        if (navigator.share) {
            navigator.share({ title, text, url }).catch(() => {});
        } else {
            window.parent.postMessage({ type: 'OPEN_URL', url: `https://wa.me/?text=${encodeURIComponent(text)}` }, '*');
        }
    },

    // ── Comments ─────────────────────────────────────────────
    async loadComments(contentId, contentType, sort = 'top') {
        const section = document.getElementById('comments-section');
        if (!section) return;
        section.innerHTML = '<div class="kh-spinner"></div>';
        const data = await khFetch(`${API}/content/${contentId}/comments?sort=${sort}&user_id=${CTX.userId||''}`);
        const comments = data.comments || [];

        const sortBar = `<div class="cv-sort-bar">
            <button class="cv-csort-btn ${sort==='top'?'active':''}" onclick="KH.loadComments(${contentId},'${contentType}','top')">הכי אהובות</button>
            <button class="cv-csort-btn ${sort==='new'?'active':''}" onclick="KH.loadComments(${contentId},'${contentType}','new')">חדשות</button>
            <button class="cv-csort-btn ${sort==='author'?'active':''}" onclick="KH.loadComments(${contentId},'${contentType}','author')">הכותב</button>
            <button class="cv-csort-btn ${sort==='management'?'active':''}" onclick="KH.loadComments(${contentId},'${contentType}','management')">הנהלה</button>
        </div>`;

        const addForm = `<div class="cv-comment-form-wrap">
            <div style="font-size:12px;color:#8A8A82;margin-bottom:10px;">התגובה תפורסם בשם הקהילה שלך. אנא שמרו על שיח מכבד.</div>
            <textarea id="new-comment-text" class="cv-comment-txt" placeholder="כתבו תגובה…" rows="3"></textarea>
            <div><button class="cv-comment-submit" onclick="KH.addComment(${contentId}, null)">פרסמו תגובה</button></div>
        </div>`;

        const renderComment = (c, depth = 0) => {
            const indent = depth * 16;
            const solutionBadge = c.is_solution_marked ? '<span class="solution-badge">✓ פתרון נבחר</span>' : '';
            const mgmtBadge = c.is_from_zm_or_sa ? '<span class="mgmt-badge">👤 הנהלה</span>' : '';
            const editedMark = c.is_edited ? '<span style="color:var(--muted2);font-size:.65rem">[נערכה]</span>' : '';
            const pinIcon = c.is_pinned_by_author ? '📌 ' : '';
            const solutionClass = c.is_solution_marked ? 'comment-solution' : '';
            const likeClass = c.userLiked ? 'eng-active' : '';
            const canMarkSolution = contentType === 'QA_QUESTION' && !c.is_solution_marked;
            const repliesHtml = (c.replies||[]).map(r => renderComment(r, depth+1)).join('');
            return `<div class="comment-item ${solutionClass}" id="comment-${c.id}" style="margin-right:${indent}px">
                ${solutionBadge}
                <div class="comment-header">
                    <strong>${esc(pinIcon+c.author_name)}</strong>
                    ${mgmtBadge}
                    <span class="comment-time">${fmtDate(c.created_at)}</span>
                    ${editedMark}
                </div>
                <div class="comment-body">${esc(c.content_text)}</div>
                ${c.solution_upvotes > 0 ? `<div class="solution-votes">🔼 ${c.solution_upvotes} הצבעות כפתרון</div>` : ''}
                <div class="comment-actions">
                    <button class="cact-btn ${likeClass}" onclick="KH.likeComment(${c.id},this)">👍 ${c.likes_count||0}</button>
                    ${depth < 3 ? `<button class="cact-btn" onclick="KH.toggleReply(${c.id},${contentId})">↩ תגובה</button>` : ''}
                    ${canMarkSolution ? `<button class="cact-btn cact-solution" onclick="KH.markSolution(${contentId},${c.id})">✓ סמן כפתרון</button>` : ''}
                    ${c.is_solution_marked ? `<button class="cact-btn" onclick="KH.upvoteSolution(${c.id})">🔼 הצבע כפתרון</button>` : ''}
                    <button class="cact-btn cact-report" onclick="KH.openReport(null,${c.id})">⚠️</button>
                    ${(CTX.isZM||CTX.isSA) ? `<button class="cact-btn cact-danger" onclick="KH.hideComment(${c.id})">🙈 הסתר</button>` : ''}
                </div>
                <div id="reply-form-${c.id}" class="reply-form hidden">
                    <textarea id="reply-text-${c.id}" class="comment-input" placeholder="כתוב תגובה..." rows="2"></textarea>
                    <button class="kh-btn kh-btn-primary" onclick="KH.addComment(${contentId},${c.id})">שלח</button>
                </div>
                ${repliesHtml}
            </div>`;
        };

        section.innerHTML = `
            <div class="cv-comments-header">
                <h3 class="cv-comments-title">תגובות (${comments.length})</h3>
                ${sortBar}
            </div>
            ${addForm}
            <div class="comments-list">${comments.map(c => renderComment(c)).join('')}</div>
        `;
    },

    async addComment(contentId, parentId) {
        if (!CTX.userId) { toast('יש להתחבר כדי לכתוב תגובה', 'error'); return; }
        const textEl = parentId ? document.getElementById(`reply-text-${parentId}`) : document.getElementById('new-comment-text');
        const text = textEl?.value?.trim();
        if (!text) { toast('יש לכתוב טקסט', 'error'); return; }
        const r = await khFetch(`${API}/content/${contentId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ user_id: CTX.userId, content_text: text, parent_comment_id: parentId || null })
        });
        if (r.success) {
            textEl.value = '';
            if (parentId) document.getElementById(`reply-form-${parentId}`)?.classList.add('hidden');
            KH.loadComments(contentId, null, 'new');
        } else {
            toast(r.error || 'שגיאה בשליחת תגובה', 'error');
        }
    },

    toggleReply(commentId, contentId) {
        const form = document.getElementById(`reply-form-${commentId}`);
        if (form) form.classList.toggle('hidden');
    },

    async likeComment(commentId, btn) {
        if (!CTX.userId) { toast('יש להתחבר', 'error'); return; }
        const r = await khFetch(`${API}/comments/${commentId}/like`, { method:'POST', body:JSON.stringify({ user_id: CTX.userId }) });
        if (r.success) {
            btn.classList.toggle('eng-active', r.liked);
            const count = parseInt(btn.textContent.replace(/[^0-9]/g,'')) || 0;
            btn.textContent = `👍 ${r.liked ? count+1 : Math.max(0,count-1)}`;
        }
    },

    async markSolution(contentId, commentId) {
        const r = await khFetch(`${API}/content/${contentId}/mark-solution/${commentId}`, { method:'POST', body:JSON.stringify({ user_id: CTX.userId }) });
        if (r.success) { toast('פתרון סומן ✓', 'success'); KH.loadComments(contentId, 'QA_QUESTION'); }
        else toast(r.error||'שגיאה', 'error');
    },

    async upvoteSolution(commentId) {
        const r = await khFetch(`${API}/comments/${commentId}/upvote-solution`, { method:'POST', body:JSON.stringify({ user_id: CTX.userId }) });
        if (r.success) toast(`הצבעה נרשמה 🔼 (${r.solution_upvotes})`, 'success');
        else toast(r.error||'שגיאה', 'error');
    },

    async hideComment(commentId) {
        const ok = await confirm('הסתרת תגובה', 'להסתיר תגובה זו?', 'הסתר', false);
        if (!ok) return;
        const r = await khFetch(`${API}/comments/${commentId}`, { method:'DELETE' });
        if (r.success) {
            document.getElementById(`comment-${commentId}`)?.remove();
            toast('תגובה הוסתרה', 'success');
        }
    },

    // ── Report modal ──────────────────────────────────────────
    openReport(contentId, commentId) {
        STATE.reportTarget = { contentId, commentId };
        document.getElementById('kh-report-modal')?.classList.add('show');
    },

    closeReport() {
        document.getElementById('kh-report-modal')?.classList.remove('show');
        STATE.reportTarget = null;
    },

    async submitReport() {
        if (!CTX.userId) { toast('יש להתחבר', 'error'); return; }
        const reason = document.querySelector('input[name="report-reason"]:checked')?.value;
        if (!reason) { toast('יש לבחור סיבה', 'error'); return; }
        const notes = document.getElementById('report-notes')?.value || '';
        const { contentId, commentId } = STATE.reportTarget || {};
        const r = await khFetch(`${API}/report`, {
            method: 'POST',
            body: JSON.stringify({ content_item_id: contentId, comment_id: commentId, user_id: CTX.userId, reason, notes })
        });
        if (r.success) { toast('הדיווח נשלח', 'success'); KH.closeReport(); }
        else toast(r.error||'שגיאה', 'error');
    },

    async requestDeletion(id) {
        const ok = await confirm('בקשת מחיקה', 'לשלוח בקשת מחיקה לסופר אדמין?', 'שלח', false);
        if (!ok) return;
        const r = await khFetch(`${API}/content/${id}/request-deletion`, { method: 'POST', body: JSON.stringify({ userId: CTX.userId }) });
        if (r.success) toast('בקשת המחיקה נשלחה', 'success');
        else toast(r.error || 'שגיאה', 'error');
    },

    // ── Saved items ──────────────────────────────────────────
    async loadSaved() {
        const el = document.getElementById('saved-list');
        if (!el) { KH.nav('saved'); return; }
        el.innerHTML = '<div class="kh-spinner"></div>';
        if (!CTX.userId) { el.innerHTML = '<div class="empty-state"><p>יש להתחבר</p></div>'; return; }
        let data;
        try { data = await khFetch(`${API}/my-saved?user_id=${CTX.userId}`); }
        catch(e) { el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>שגיאה: ${esc(e.message)}</p></div>`; return; }
        if (data.error) { el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>${esc(data.error)}</p></div>`; return; }
        const items = data.items || [];
        if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="ei">⭐</div><p>אין פריטים שמורים</p></div>'; return; }
        el.innerHTML = items.map(it => `
            <div class="feed-card" onclick="KH.nav('content',{id:${it.id}})">
                <div class="feed-card-body">
                    <div class="feed-card-meta"><span class="type-badge type-${it.content_type}">${TYPE_LABELS[it.content_type]||it.content_type}</span></div>
                    <div class="feed-card-title">${esc(it.title)}</div>
                    <div class="feed-card-footer"><span>נשמר: ${fmtDate(it.saved_at)}</span></div>
                </div>
            </div>`).join('');
    },

    // ── ZM: Reports ──────────────────────────────────────────
    async loadZMReports() {
        const el = document.getElementById('zm-reports-list') || document.getElementById('zm-reports-list-view');
        if (!el) return;
        el.innerHTML = '<div class="kh-spinner"></div>';
        const data = await khFetch(`${API}/zm/reports`);
        const reports = data.reports || [];
        if (!reports.length) { el.innerHTML = '<p class="empty-state">אין דיווחים ממתינים</p>'; return; }
        el.innerHTML = reports.map(r => `
            <div class="report-card">
                <div class="report-header">
                    <span class="report-reason-badge">${r.reason}</span>
                    <span class="report-date">${fmtDate(r.created_at)}</span>
                </div>
                <div class="report-target">${r.item_title ? `📄 ${esc(r.item_title)}` : `💬 ${esc(r.comment_text||'').slice(0,80)}`}</div>
                <div class="report-reporter">מדווח: ${esc(r.reporter_name)}</div>
                <div class="report-actions">
                    <button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.resolveReport(${r.id},'dismiss')">התעלם</button>
                    ${r.comment_id ? `<button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.resolveReport(${r.id},'hide_comment')">הסתר תגובה</button>` : ''}
                    ${r.content_item_id ? `<button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.resolveReport(${r.id},'unpublish_content')">בטל פרסום</button>` : ''}
                </div>
            </div>`).join('');
    },

    async resolveReport(reportId, action) {
        const r = await khFetch(`${API}/reports/${reportId}/resolve`, { method:'POST', body:JSON.stringify({ action }) });
        if (r.success) { toast('טופל', 'success'); KH.loadZMReports(); }
        else toast(r.error||'שגיאה', 'error');
    },

    async unQuarantine(contentId) {
        const r = await khFetch(`${API}/content/${contentId}/un-quarantine`, { method:'POST' });
        if (r.success) toast('שוחרר מהסגר', 'success');
        else toast(r.error||'שגיאה', 'error');
    },

    // ── Editor ───────────────────────────────────────────────
    async renderEditor(itemId) {
        STATE.editingItemId = itemId || null;
        STATE.tags = [];
        const inner = document.getElementById('editor-inner');
        inner.innerHTML = '<div class="kh-spinner"></div>';

        let existing = null;
        if (itemId) {
            const d = await khFetch(`${API}/content/${itemId}`);
            if (d.success) {
                existing = d.item;
                const tags = Array.isArray(existing.tags) ? existing.tags : (typeof existing.tags === 'string' ? JSON.parse(existing.tags || '[]') : []);
                STATE.tags = [...tags];
            }
        }

        const categories = STATE.categories.length ? STATE.categories : await khFetch(`${API}/categories?community_id=${CTX.communityId || ''}`).then(d => {
            STATE.categories = d.categories || [];
            return STATE.categories;
        });

        const selCatId = existing?.category_id || '';
        const selCat = categories.find(c => c.id === selCatId);
        const isLocalCategory = selCat?.scope_level === 'LOCAL';

        inner.innerHTML = `
            <h2 style="font-size:1rem;font-weight:900;margin-bottom:1rem">${itemId ? '✏️ עריכת תוכן' : '✍️ כתיבה חדשה'}</h2>

            <!-- סוג תוכן -->
            <div class="field-group">
                <label class="field-label">סוג תוכן</label>
                <div class="type-cards" id="type-cards">
                    ${[['ARTICLE','📰','כתבה','חדשות, מאמרים, עדכונים'],['QA_QUESTION','❓','שאלה','שאל את הקהילה'],['SUCCESS_STORY','🏆','סיפור הצלחה','השראה ועצות מהשטח'],['WIKI_GUIDE','📖','מדריך','מידע שימושי לכל'],].map(([v,ic,lb,ds]) => `
                        <div class="type-card${existing?.content_type===v||(!existing&&v==='ARTICLE')?' selected':''}" data-type="${v}" onclick="KH.selectType('${v}')">
                            <div class="tc-icon">${ic}</div>
                            <div class="tc-label">${lb}</div>
                            <div class="tc-desc">${ds}</div>
                        </div>`).join('')}
                </div>
            </div>

            <!-- כותרת -->
            <div class="field-group">
                <label class="field-label">כותרת *</label>
                <input class="field-input" id="ed-title" placeholder="כותרת הכתבה..." value="${esc(existing?.title||'')}">
            </div>

            <!-- תת-כותרת -->
            <div class="field-group">
                <label class="field-label">תת-כותרת</label>
                <input class="field-input" id="ed-subtitle" placeholder="תקציר קצר (אופציונלי)..." value="${esc(existing?.subtitle||'')}">
            </div>

            <!-- תמונת שער -->
            <div class="field-group">
                <label class="field-label">תמונת שער</label>
                <div id="cover-preview-wrap">
                    ${existing?.cover_image_url ? `<img id="cover-preview" class="img-preview" src="${existing.cover_image_url}">` : ''}
                </div>
                <div class="img-upload-area" onclick="KH.pickCover()">
                    <i class="fa-solid fa-image"></i> ${existing?.cover_image_url ? 'החלף תמונה' : 'לחץ להעלאת תמונת שער'}
                </div>
                <input type="hidden" id="ed-cover-url" value="${existing?.cover_image_url||''}">
            </div>

            <!-- קטגוריה -->
            <div class="field-group">
                <label class="field-label">קטגוריה *</label>
                <select class="field-select" id="ed-category" onchange="KH.onCategoryChange()">
                    <option value="">-- בחר קטגוריה --</option>
                    <optgroup label="🌍 קטגוריות ארציות">
                        ${categories.filter(c=>c.scope_level==='GLOBAL').map(c=>`<option value="${c.id}"${c.id===selCatId?' selected':''}>${esc(c.title)}</option>`).join('')}
                    </optgroup>
                    <optgroup label="🏠 קטגוריות קהילתיות">
                        ${categories.filter(c=>c.scope_level==='LOCAL').map(c=>`<option value="${c.id}"${c.id===selCatId?' selected':''}>${esc(c.title)}</option>`).join('')}
                    </optgroup>
                </select>
            </div>

            <!-- היקף הפצה -->
            <div class="field-group" id="scope-field">
                <label class="field-label">היקף הפצה</label>
                <div class="scope-toggle-row">
                    <button class="scope-toggle-btn${existing?.scope_type==='GLOBAL'?'':' active'}" id="scope-local-btn" onclick="KH.selectScope('LOCAL')">🏠 מקומי בלבד</button>
                    <button class="scope-toggle-btn${existing?.scope_type==='GLOBAL'?' active':''}" id="scope-global-btn" onclick="KH.selectScope('GLOBAL')">🌍 בקש הפצה ארצית</button>
                </div>
                <div class="scope-info" id="scope-info">כתבה זו תפורסם בקהילתך ותועבר לאישור ארצי אם תבחר "הפצה ארצית"</div>
            </div>

            <!-- גוף התוכן -->
            <div class="field-group">
                <label class="field-label">גוף התוכן *</label>
                <div class="rte-toolbar">
                    <button class="rte-btn" title="מודגש" onclick="KH.rteExec('bold')"><b>B</b></button>
                    <button class="rte-btn" title="נטוי" onclick="KH.rteExec('italic')"><i>I</i></button>
                    <button class="rte-btn" title="קו תחתון" onclick="KH.rteExec('underline')"><u>U</u></button>
                    <div class="rte-divider"></div>
                    <button class="rte-btn" title="כותרת" onclick="KH.rteExec('formatBlock','h2')">H2</button>
                    <button class="rte-btn" title="כותרת קטנה" onclick="KH.rteExec('formatBlock','h3')">H3</button>
                    <div class="rte-divider"></div>
                    <button class="rte-btn" title="רשימת נקודות" onclick="KH.rteExec('insertUnorderedList')"><i class="fa-solid fa-list-ul"></i></button>
                    <button class="rte-btn" title="רשימה ממוספרת" onclick="KH.rteExec('insertOrderedList')"><i class="fa-solid fa-list-ol"></i></button>
                    <div class="rte-divider"></div>
                    <button class="rte-btn" title="נקה עיצוב" onclick="KH.rteExec('removeFormat')"><i class="fa-solid fa-eraser"></i></button>
                </div>
                <div id="rte-body" contenteditable="true" data-placeholder="כתוב כאן את תוכן הכתבה...">${existing?.content_html||''}</div>
            </div>

            <!-- תגיות -->
            <div class="field-group">
                <label class="field-label">תגיות (עד 10)</label>
                <div class="tags-input-wrap" id="tags-wrap" onclick="document.getElementById('tag-input').focus()">
                    <div id="tags-chips"></div>
                    <input id="tag-input" placeholder="הקלד תגית ולחץ Enter..." autocomplete="off"
                        oninput="KH.tagSuggest(this.value)" onkeydown="KH.tagKeydown(event)">
                </div>
                <div id="tags-suggestions" class="tags-suggestions" style="display:none;position:relative"></div>
            </div>

            <!-- תקציר 20 שניות -->
            <div class="field-group">
                <label class="field-label">תקציר ב-20 שניות <span style="color:var(--muted2);font-weight:400">(אופציונלי)</span></label>
                <textarea class="field-input" id="ed-summary" rows="2" placeholder="משפט או שניים שמסכמים את הכתבה...">${esc(existing?.quick_summary_20s||'')}</textarea>
            </div>

            <!-- שיוך לסדרה -->
            <div class="field-group">
                <label class="field-label">חלק מסדרה? <span style="color:var(--muted2);font-weight:400">(אופציונלי)</span></label>
                <div style="display:flex;gap:.4rem;align-items:center">
                    <select class="field-select" id="ed-series" style="flex:1">
                        <option value="">ללא סדרה</option>
                    </select>
                    <button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.createSeriesFromEditor()">+ סדרה חדשה</button>
                </div>
                <input class="field-input" id="ed-series-chapter" type="number" min="1" placeholder="מספר פרק..." value="${existing?.series_chapter_number||''}" style="margin-top:.35rem;width:120px">
            </div>

            <!-- כפתורי פעולה -->
            <div class="editor-actions">
                <button class="kh-btn kh-btn-outline" onclick="KH.saveDraft()"><i class="fa-solid fa-floppy-disk"></i> שמור כטיוטה</button>
                <button class="kh-btn kh-btn-primary" onclick="KH.submitContent()"><i class="fa-solid fa-paper-plane"></i> שלח לאישור</button>
            </div>

            ${itemId ? KH.renderAICopilot(itemId) : '<div class="ai-panel"><div class="ai-panel-title">🤖 עוזר הכתיבה AI</div><div style="font-size:.82rem;color:var(--muted)">שמור קודם כטיוטה כדי להפעיל את עוזר הכתיבה</div></div>'}
        `;

        KH.renderTagChips();
        KH.onCategoryChange();

        // טעינת סדרות לדרופדאון
        if (CTX.groupId) {
            khFetch(`${API}/series/my?groupId=${CTX.groupId}&communityId=${CTX.communityId||''}`).then(d => {
                const sel = document.getElementById('ed-series');
                if (!sel) return;
                (d.series || []).forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = `${esc(s.title)} (${s.chapter_count||0} פרקים)`;
                    if (existing?.series_id === s.id) opt.selected = true;
                    sel.appendChild(opt);
                });
            }).catch(() => {});
        }
    },

    selectType(type) {
        document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('selected', c.dataset.type === type));
    },

    selectScope(scope) {
        document.getElementById('scope-local-btn')?.classList.toggle('active', scope === 'LOCAL');
        document.getElementById('scope-global-btn')?.classList.toggle('active', scope === 'GLOBAL');
        const info = document.getElementById('scope-info');
        if (info) info.textContent = scope === 'GLOBAL'
            ? 'הכתבה תפורסם מקומית ותועבר לאישור SA לפרסום ארצי'
            : 'הכתבה תפורסם בקהילה שלך בלבד';
    },

    onCategoryChange() {
        const catId = parseInt(document.getElementById('ed-category')?.value);
        const cat = STATE.categories.find(c => c.id === catId);
        const scopeField = document.getElementById('scope-field');
        const info = document.getElementById('scope-info');
        if (!scopeField) return;
        if (cat?.scope_level === 'LOCAL') {
            scopeField.style.display = 'none';
        } else {
            scopeField.style.display = '';
        }
    },

    rteExec(cmd, val) {
        document.getElementById('rte-body')?.focus();
        document.execCommand(cmd, false, val || null);
    },

    // ── Tags ────────────────────────────────────────────────
    renderTagChips() {
        const wrap = document.getElementById('tags-chips');
        if (!wrap) return;
        wrap.innerHTML = STATE.tags.map((t, i) => `
            <span class="tag-rm">#${esc(t)} <button type="button" onclick="KH.removeTag(${i})">×</button></span>
        `).join('');
    },

    removeTag(i) {
        STATE.tags.splice(i, 1);
        KH.renderTagChips();
    },

    tagKeydown(e) {
        if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
            e.preventDefault();
            KH.addTag(e.target.value.trim());
            e.target.value = '';
            document.getElementById('tags-suggestions').style.display = 'none';
        }
    },

    addTag(name) {
        name = name.toLowerCase().replace(/[^֐-׿\w-]/g, '').trim();
        if (!name || STATE.tags.includes(name) || STATE.tags.length >= 10) return;
        STATE.tags.push(name);
        KH.renderTagChips();
    },

    async tagSuggest(q) {
        const sugEl = document.getElementById('tags-suggestions');
        if (!q.trim()) { sugEl.style.display = 'none'; return; }
        const d = await khFetch(`${API}/tags?q=${encodeURIComponent(q)}`);
        const suggestions = (d.tags || []).filter(t => !STATE.tags.includes(t));
        if (!suggestions.length) { sugEl.style.display = 'none'; return; }
        sugEl.style.display = '';
        sugEl.innerHTML = suggestions.map(t => `<div class="tags-suggestion-item" onclick="KH.addTag('${esc(t)}');document.getElementById('tag-input').value='';document.getElementById('tags-suggestions').style.display='none'">#${esc(t)}</div>`).join('');
    },

    // ── Cover image upload ──────────────────────────────────
    pickCover() {
        document.getElementById('kh-file-input').onchange = KH.onCoverFile;
        document.getElementById('kh-file-input').click();
    },

    async onCoverFile(e) {
        const file = e.target.files[0]; if (!file) return;
        e.target.value = '';
        try {
            const [cnRes, upRes] = await Promise.all([
                fetch('/api/public/settings/cloudinary_cloud_name').then(r => r.json()),
                fetch('/api/public/settings/cloudinary_upload_preset').then(r => r.json()),
            ]);
            const cloudName = cnRes.value; const preset = upRes.value;
            if (!cloudName || !preset) { toast('הגדרות Cloudinary חסרות', 'error'); return; }
            toast('מעלה תמונה...');
            const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', preset);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
            const data = await res.json();
            if (!data.secure_url) { toast('שגיאה בהעלאה', 'error'); return; }
            document.getElementById('ed-cover-url').value = data.secure_url;
            let prev = document.getElementById('cover-preview');
            if (!prev) {
                prev = document.createElement('img');
                prev.id = 'cover-preview'; prev.className = 'img-preview';
                document.getElementById('cover-preview-wrap').appendChild(prev);
            }
            prev.src = data.secure_url;
            toast('תמונה הועלתה', 'success');
        } catch(err) { toast('שגיאת תקשורת', 'error'); }
    },

    // ── Save / Submit ────────────────────────────────────────
    collectEditorPayload() {
        const selectedType = document.querySelector('.type-card.selected')?.dataset.type || 'ARTICLE';
        const scopeLocal = document.getElementById('scope-local-btn')?.classList.contains('active');
        const catId = parseInt(document.getElementById('ed-category')?.value) || null;
        const cat = STATE.categories.find(c => c.id === catId);
        const scopeType = cat?.scope_level === 'LOCAL' ? 'LOCAL' : (scopeLocal ? 'LOCAL' : 'GLOBAL');
        return {
            groupId: CTX.groupId,
            userId: CTX.userId,
            communityId: CTX.communityId,
            contentType: selectedType,
            categoryId: catId,
            scopeType,
            title: document.getElementById('ed-title')?.value.trim() || '',
            subtitle: document.getElementById('ed-subtitle')?.value.trim() || '',
            quickSummary: document.getElementById('ed-summary')?.value.trim() || '',
            coverImageUrl: document.getElementById('ed-cover-url')?.value || '',
            contentHtml: document.getElementById('rte-body')?.innerHTML || '',
            tags: [...STATE.tags],
            seriesId: document.getElementById('ed-series')?.value || null,
            seriesChapterNumber: parseInt(document.getElementById('ed-series-chapter')?.value) || null,
        };
    },

    createSeriesFromEditor: async function() {
        const title = prompt('שם הסדרה החדשה:');
        if (!title || !title.trim()) return;
        const d = await khFetch(`${API}/series`, {
            method: 'POST', body: JSON.stringify({ title, groupId: CTX.groupId, communityId: CTX.communityId })
        });
        if (d.success) {
            const sel = document.getElementById('ed-series');
            if (sel) {
                const opt = document.createElement('option');
                opt.value = d.series.id;
                opt.textContent = esc(d.series.title) + ' (0 פרקים)';
                opt.selected = true;
                sel.appendChild(opt);
            }
            khToast('success', 'סדרה נוצרה');
        }
    },

    async saveDraft() {
        const payload = KH.collectEditorPayload();
        if (!payload.title) { toast('יש להזין כותרת', 'error'); return; }
        if (!payload.categoryId) { toast('יש לבחור קטגוריה', 'error'); return; }
        try {
            let r;
            if (STATE.editingItemId) {
                r = await khFetch(`${API}/content/${STATE.editingItemId}`, { method: 'PUT', body: JSON.stringify({ ...payload }) });
            } else {
                r = await khFetch(`${API}/content`, { method: 'POST', body: JSON.stringify(payload) });
                if (r.success) STATE.editingItemId = r.id;
            }
            if (r.success) toast('טיוטה נשמרה', 'success');
            else toast(r.error || 'שגיאה', 'error');
        } catch(e) { toast('שגיאת תקשורת', 'error'); }
    },

    async submitContent() {
        const payload = KH.collectEditorPayload();
        if (!payload.title) { toast('יש להזין כותרת', 'error'); return; }
        if (!payload.categoryId) { toast('יש לבחור קטגוריה', 'error'); return; }
        if (!payload.contentHtml || payload.contentHtml === '<br>') { toast('יש לכתוב תוכן', 'error'); return; }

        // אזהרה אם LOCAL
        if (payload.scopeType === 'LOCAL' && !STATE.editingItemId) {
            const ok = await confirm('אישור פרסום מקומי', 'כתבה זו תישאר מקומית לתמיד ולא ניתן יהיה לשנות זאת בעתיד. להמשיך?', 'אשר ושלח');
            if (!ok) return;
        }

        // שמור תחילה
        await KH.saveDraft();
        if (!STATE.editingItemId) return;

        try {
            const r = await khFetch(`${API}/content/${STATE.editingItemId}/submit`, {
                method: 'POST', body: JSON.stringify({ groupId: CTX.groupId }),
            });
            if (r.success) { toast('נשלח לאישור Zone Manager', 'success'); KH.nav('my-content'); }
            else toast(r.error || 'שגיאה', 'error');
        } catch(e) { toast('שגיאת תקשורת', 'error'); }
    },

    // ── My Drafts ───────────────────────────────────────────
    async loadDrafts() {
        const el = document.getElementById('drafts-list');
        el.innerHTML = '<div class="kh-spinner"></div>';
        let d;
        try { d = await khFetch(`${API}/my-drafts?groupId=${CTX.groupId}&userId=${CTX.userId}`); }
        catch(e) { el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>שגיאה: ${esc(e.message)}</p></div>`; return; }
        if (d.error) { el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>${esc(d.error)}</p></div>`; return; }
        const items = d.drafts || [];
        if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="ei">✍️</div><p>אין טיוטות עדיין</p></div>'; return; }
        el.innerHTML = items.map(it => `
            <div class="content-list-item">
                <div class="content-list-item-body">
                    <div class="content-list-item-title">${esc(it.title)}</div>
                    <div class="content-list-item-meta">
                        ${TYPE_LABELS[it.content_type] || it.content_type} · עודכן ${fmtDate(it.updated_at || it.created_at)}
                        ${it.is_shared ? ' · <span style="color:var(--primary)">שותף איתי</span>' : ''}
                    </div>
                    <span class="status-badge s-${it.status}">${statusLabel(it.status)}</span>
                    ${it.status === 'REJECTED' && it.zm_rejection_note ? `<div class="rejection-note">❌ ${esc(it.zm_rejection_note)}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="kh-btn kh-btn-primary kh-btn-sm" onclick="KH.nav('editor',{itemId:${it.id}})"><i class="fa-solid fa-pen"></i></button>
                    ${!it.is_shared ? `<button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.deleteDraft(${it.id})"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>
        `).join('');
    },

    async deleteDraft(id) {
        const ok = await confirm('מחיקת טיוטה', 'למחוק את הטיוטה לצמיתות?', 'מחק', true);
        if (!ok) return;
        const r = await khFetch(`${API}/content/${id}`, { method: 'DELETE', body: JSON.stringify({ groupId: CTX.groupId }) });
        if (r.success) { toast('נמחקה', 'success'); KH.loadDrafts(); }
        else toast(r.error || 'שגיאה', 'error');
    },

    // ── My Content ──────────────────────────────────────────
    async loadMyContent() {
        const el = document.getElementById('my-content-list');
        el.innerHTML = '<div class="kh-spinner"></div>';
        let d;
        try { d = await khFetch(`${API}/my-content?groupId=${CTX.groupId}`); }
        catch(e) { el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>שגיאה: ${esc(e.message)}</p></div>`; return; }
        if (d.error) { el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>${esc(d.error)}</p></div>`; return; }
        const items = d.items || [];
        if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="ei">📚</div><p>לא פרסמת תוכן עדיין</p></div>'; return; }
        el.innerHTML = items.map(it => `
            <div class="content-list-item" onclick="KH.nav('content',{id:${it.id}})">
                <div class="content-list-item-body">
                    <div class="content-list-item-title">${esc(it.title)}</div>
                    <div class="content-list-item-meta">
                        ${esc(it.category_title)} · ${fmtDate(it.created_at)} · 👁 ${it.views_count || 0}
                    </div>
                    <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.25rem">
                        <span class="status-badge s-${it.status}">${statusLabel(it.status)}</span>
                        ${it.sa_approval_status === 'PENDING' ? '<span class="status-badge" style="background:#ede9fe;color:#5b21b6">ממתין אישור ארצי</span>' : ''}
                        ${it.sa_approval_status === 'REJECTED' ? '<span class="status-badge" style="background:#fee2e2;color:#991b1b">נדחה ארצית</span>' : ''}
                    </div>
                    ${it.zm_rejection_note ? `<div class="rejection-note">❌ ${esc(it.zm_rejection_note)}</div>` : ''}
                    ${it.sa_rejection_note ? `<div class="rejection-note">🌍 ${esc(it.sa_rejection_note)}</div>` : ''}
                </div>
            </div>
        `).join('');
    },

    // ── ZM Queue ────────────────────────────────────────────
    async loadZMQueue() {
        const el = document.getElementById('zm-queue-list');
        el.innerHTML = '<div class="kh-spinner"></div>';

        // Categories management
        const catEl = document.getElementById('zm-queue-categories');
        const commId = CTX.communityId;
        if (commId) {
            catEl.innerHTML = `
                <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:.75rem;margin-bottom:.5rem">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
                        <span style="font-weight:800;font-size:.85rem">📂 קטגוריות קהילתיות</span>
                        <button class="kh-btn kh-btn-primary kh-btn-sm" onclick="KH.showAddLocalCat()"><i class="fa-solid fa-plus"></i> הוסף</button>
                    </div>
                    <div id="zm-local-cats-list"></div>
                </div>
            `;
            KH.loadLocalCats();
        }

        const d = await khFetch(`${API}/zm/pending`);
        const items = d.items || [];
        if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="ei">🎉</div><p>אין כתבות ממתינות לאישור</p></div>'; return; }
        el.innerHTML = items.map(it => KH.renderQueueCard(it, 'zm')).join('');
    },

    async loadLocalCats() {
        const el = document.getElementById('zm-local-cats-list');
        if (!el) return;
        const d = await khFetch(`${API}/categories?community_id=${CTX.communityId}`);
        const cats = (d.categories || []).filter(c => c.scope_level === 'LOCAL' && !c.is_default);
        if (!cats.length) { el.innerHTML = '<p style="font-size:.75rem;color:var(--muted2)">אין קטגוריות מותאמות</p>'; return; }
        el.innerHTML = cats.map(c => `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--border)">
                <span style="flex:1;font-size:.82rem">${esc(c.title)}</span>
                <button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.deleteLocalCat(${c.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    },

    async showAddLocalCat() {
        const name = window.prompt('שם הקטגוריה החדשה:');
        if (!name?.trim()) return;
        const r = await khFetch(`${API}/categories`, { method: 'POST', body: JSON.stringify({ title: name.trim(), communityId: CTX.communityId }) });
        if (r.success) { toast('קטגוריה נוספה', 'success'); KH.loadLocalCats(); STATE.categories = []; }
        else toast(r.error || 'שגיאה', 'error');
    },

    async deleteLocalCat(id) {
        const ok = await confirm('מחיקת קטגוריה', 'למחוק קטגוריה זו?', 'מחק', true);
        if (!ok) return;
        const r = await khFetch(`${API}/categories/${id}`, { method: 'DELETE' });
        if (r.success) { toast('נמחקה', 'success'); KH.loadLocalCats(); STATE.categories = []; }
        else toast(r.error || 'שגיאה', 'error');
    },

    renderQueueCard(it, role) {
        const img = it.cover_image_url
            ? `<img class="queue-card-img" src="${it.cover_image_url}" alt="" style="width:56px;height:50px;object-fit:cover;border-radius:.4rem">`
            : `<div class="queue-card-img">${TYPE_ICONS[it.content_type]||'📄'}</div>`;
        const scopeTag = it.scope_type === 'GLOBAL' ? '<span class="status-badge" style="background:#ede9fe;color:#5b21b6">🌍 בקשה ארצית</span>' : '';
        return `<div class="queue-card" id="qcard-${it.id}">
            <div class="queue-card-header">
                ${img}
                <div style="flex:1">
                    <div class="queue-card-title">${esc(it.title)}</div>
                    <div class="queue-card-meta">✍️ ${esc(it.author_name)} · 🏘️ ${esc(it.community_name)} · ${fmtDate(it.created_at)}</div>
                    <div style="display:flex;gap:.3rem;margin-top:.25rem">
                        <span class="type-badge type-${it.content_type}">${TYPE_LABELS[it.content_type]}</span>
                        ${scopeTag}
                    </div>
                </div>
            </div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                <button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.nav('content',{id:${it.id}})"><i class="fa-solid fa-eye"></i> תצוגה מקדימה</button>
                <button class="kh-btn kh-btn-success kh-btn-sm" onclick="KH.${role}Approve(${it.id})"><i class="fa-solid fa-check"></i> אשר</button>
                <button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.toggleRejectForm(${it.id})"><i class="fa-solid fa-times"></i> דחה</button>
            </div>
            <div class="reject-form" id="reject-form-${it.id}">
                <textarea class="reject-textarea" id="reject-note-${it.id}" placeholder="הערת דחייה (חובה)..."></textarea>
                <div style="display:flex;gap:.4rem;margin-top:.3rem">
                    <button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.${role}Reject(${it.id})"><i class="fa-solid fa-times-circle"></i> דחה עם הערה</button>
                    <button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.toggleRejectForm(${it.id})">ביטול</button>
                </div>
            </div>
        </div>`;
    },

    toggleRejectForm(id) {
        document.getElementById(`reject-form-${id}`)?.classList.toggle('open');
    },

    async zmApprove(id) {
        const ok = await confirm('אישור כתבה', 'לאשר כתבה זו לפרסום?', 'אשר');
        if (!ok) return;
        const r = await khFetch(`${API}/zm/${id}/approve`, { method: 'POST' });
        if (r.success) { toast('אושר!', 'success'); document.getElementById(`qcard-${id}`)?.remove(); }
        else toast(r.error || 'שגיאה', 'error');
    },

    async zmReject(id) {
        const note = document.getElementById(`reject-note-${id}`)?.value.trim();
        if (!note) { toast('יש להזין הערת דחייה', 'error'); return; }
        const r = await khFetch(`${API}/zm/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
        if (r.success) { toast('נדחה', 'success'); document.getElementById(`qcard-${id}`)?.remove(); }
        else toast(r.error || 'שגיאה', 'error');
    },

    // ── SA Queue ────────────────────────────────────────────
    async loadSAQueue() {
        const el = document.getElementById('sa-queue-list');
        el.innerHTML = '<div class="kh-spinner"></div>';

        // Deletion requests
        const delEl = document.getElementById('sa-deletion-section');
        const delData = await khFetch(`${API}/sa/deletion-requests`);
        const delItems = delData.items || [];
        delEl.innerHTML = delItems.length ? `
            <div style="background:var(--card);border:1px solid #fde68a;border-radius:var(--radius);padding:.75rem">
                <div style="font-weight:800;font-size:.85rem;margin-bottom:.5rem">🗑️ בקשות מחיקה (${delItems.length})</div>
                ${delItems.map(it => `
                    <div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem">
                        <span style="flex:1">${esc(it.title)}</span>
                        <span style="color:var(--muted2)">${esc(it.community_name)}</span>
                        <button class="kh-btn kh-btn-success kh-btn-sm" onclick="KH.approveDeletion(${it.id})">אשר מחיקה</button>
                        <button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.rejectDeletion(${it.id})">דחה</button>
                    </div>
                `).join('')}
            </div>
        ` : '';

        const d = await khFetch(`${API}/sa/pending-global`);
        const items = d.items || [];
        if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="ei">🌍</div><p>אין כתבות ממתינות לאישור ארצי</p></div>'; }
        else el.innerHTML = items.map(it => KH.renderQueueCard(it, 'sa')).join('');

        // Global categories
        KH.loadGlobalCats();

        // Editor picks
        KH.loadEditorPicksSA();
    },

    async loadGlobalCats() {
        const el = document.getElementById('sa-global-cats');
        if (!el) return;
        const d = await khFetch(`${API}/categories`);
        const cats = (d.categories || []).filter(c => c.scope_level === 'GLOBAL');
        el.innerHTML = cats.map(c => `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--border)">
                <span style="flex:1;font-size:.85rem">${esc(c.title)}</span>
                <span class="status-badge" style="background:${c.is_active?'#d1fae5':'#f1f5f9'};color:${c.is_active?'#065f46':'#475569'}">${c.is_active?'פעיל':'מושבת'}</span>
                <button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.toggleGlobalCat(${c.id},${!c.is_active})">${c.is_active?'השבת':'הפעל'}</button>
            </div>
        `).join('');
    },

    async showAddGlobalCat() {
        const name = window.prompt('שם הקטגוריה הארצית החדשה:');
        if (!name?.trim()) return;
        const r = await khFetch(`${API}/sa/global-categories`, { method: 'POST', body: JSON.stringify({ title: name.trim() }) });
        if (r.success) { toast('קטגוריה נוספה', 'success'); KH.loadGlobalCats(); STATE.categories = []; }
        else toast(r.error || 'שגיאה', 'error');
    },

    async toggleGlobalCat(id, isActive) {
        const r = await khFetch(`${API}/sa/global-categories/${id}`, { method: 'PUT', body: JSON.stringify({ isActive }) });
        if (r.success) KH.loadGlobalCats();
        else toast(r.error || 'שגיאה', 'error');
    },

    async saApprove(id) {
        const ok = await confirm('אישור ארצי', 'לאשר פרסום ארצי?', 'אשר');
        if (!ok) return;
        const r = await khFetch(`${API}/sa/${id}/approve`, { method: 'POST' });
        if (r.success) { toast('אושר לפרסום ארצי!', 'success'); document.getElementById(`qcard-${id}`)?.remove(); }
        else toast(r.error || 'שגיאה', 'error');
    },

    async saReject(id) {
        const note = document.getElementById(`reject-note-${id}`)?.value.trim();
        if (!note) { toast('יש להזין הערת דחייה', 'error'); return; }
        const r = await khFetch(`${API}/sa/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
        if (r.success) { toast('נדחה (כתבה נשארת מקומית)', 'success'); document.getElementById(`qcard-${id}`)?.remove(); }
        else toast(r.error || 'שגיאה', 'error');
    },

    async approveDeletion(id) {
        const ok = await confirm('אישור מחיקה', 'למחוק את הכתבה לצמיתות?', 'מחק', true);
        if (!ok) return;
        const r = await khFetch(`${API}/sa/content/${id}/request-deletion/approve`, { method: 'POST' });
        if (r.success) { toast('נמחקה', 'success'); KH.loadSAQueue(); }
        else toast(r.error || 'שגיאה', 'error');
    },

    async rejectDeletion(id) {
        const r = await khFetch(`${API}/sa/content/${id}/request-deletion/reject`, { method: 'POST' });
        if (r.success) { toast('בקשה נדחתה', 'success'); KH.loadSAQueue(); }
        else toast(r.error || 'שגיאה', 'error');
    },
};

// make KH explicitly global so onclick="KH.nav(...)" always works
window.KH = KH;

// ── Phase 3: Author profile, Follow, Editor picks ─────────────

// locked progress hints (content bundle)
const AP_LOCKED_PROGRESS = {
    QUARTER_MILLION:'312K / 250K — בבדיקה', VIDEO_WRITER:'0 מתוך 3',
    FULL_SERIES:'2 מתוך 5', EDITOR_CHOICE_X10:'7 מתוך 10',
};
const AP_FRONT_TITLES = new Set([
    'החופש הגדול נגמר בפלוס: שבע משפחות בנו לוח קיץ משותף וחסכו 4,300 ₪ לילד',
    'כמה באמת עולה קיץ אחד למשפחה ישראלית — פירוק ההוצאה',
    'המקלט שהפך למעבדת רובוטיקה — כל השלבים',
]);
const AP_TYPE_META = {
    ARTICLE:{label:'כתבת עומק',cls:'apt-article'}, WIKI_GUIDE:{label:'מדריך',cls:'apt-guide'},
    SUCCESS_STORY:{label:'סיפור קהילה',cls:'apt-story'}, QA_QUESTION:{label:'שאלה',cls:'apt-qa'},
};
function apTypeMeta(t){ return AP_TYPE_META[t]||{label:'כתבה',cls:'apt-article'}; }
function apFmtNum(n){ n=parseInt(n)||0; if(n>=1000000)return(n/1000000).toFixed(1)+'M'; if(n>=1000)return(n/1000).toFixed(n>=10000?0:1)+'K'; return String(n); }
function apFmtDate(d){ if(!d)return''; const dt=new Date(d); return`${dt.getDate().toString().padStart(2,'0')}.${(dt.getMonth()+1).toString().padStart(2,'0')}.${String(dt.getFullYear()).slice(-2)}`; }

let _apAllArticles=[], _apFiltered=[], _apFilter='all', _apSort='new', _apPage=0;
const AP_PAGE=8;

KH.loadAuthor = async function(authorId) {
    STATE.view = 'author';
    showView('view-author');
    _apAllArticles=[]; _apFiltered=[]; _apFilter='all'; _apSort='new'; _apPage=0;

    const cover = document.getElementById('ap-cover');
    const el    = document.getElementById('author-profile-content');
    if(cover) cover.innerHTML = '<div class="ap-cover-placeholder"></div>';
    el.innerHTML = '<div class="kh-spinner" style="margin:40px auto"></div>';

    let pd, cd;
    try {
        [pd, cd] = await Promise.all([
            khFetch(`${API}/authors/${authorId}?groupId=${CTX.groupId||''}`),
            khFetch(`${API}/authors/${authorId}/content?limit=100`)
        ]);
    } catch(e){ el.innerHTML=`<p class="empty-state">שגיאה: ${esc(String(e.message))}</p>`; return; }
    if (!pd.success){ el.innerHTML=`<p class="empty-state">${esc(pd.error||'שגיאה')}</p>`; return; }

    const a = pd.author;

    // cover
    if (a.cover_image_url && cover){
        cover.innerHTML=`<img src="${esc(a.cover_image_url)}" alt="" onerror="this.parentNode.innerHTML='<div class=ap-cover-placeholder></div>'">`;
    }

    // hero
    const name = a.display_name || a.family_name || 'כותב/ת';
    const avatar = a.avatar_url
        ? `<img src="${esc(a.avatar_url)}" class="ap-avatar" alt="${esc(name)}" onerror="this.style.display='none'">`
        : `<div class="ap-avatar-ph">👤</div>`;
    const badge = (a.badge_label||(a.badge_level&&a.badge_level!=='DEFAULT'))
        ? `<div class="ap-badge">🏅 ${esc(a.badge_label||a.badge_level)}</div>` : '';
    const followers = parseInt(a.followers_count)||0;
    const isSelf = String(a.family_group_id||a.group_id)===String(CTX.groupId);
    const isFollowing = pd.isFollowing;

    // metrics
    const pub   = parseInt(a.published_count)||0;
    const views = parseInt(a.total_views)||0;
    const comms = parseInt(a.total_comments)||0;
    const front = parseInt(a.front_page_count)||0;
    const natl  = parseInt(a.national_count)||0;
    const rep   = parseInt(a.reputation_score)||0;
    const avgV  = pub ? apFmtNum(Math.round(views/pub)) : '0';

    // achievements
    const achs = pd.achievements||[];
    const earned = achs.filter(x=>x.earned);
    const achCards = [...earned,...achs.filter(x=>!x.earned)].map(x=>{
        const prog = !x.earned ? (AP_LOCKED_PROGRESS[x.key]||'') : '';
        return `<div class="ap-ach-card ${x.earned?'earned':'locked'}">
            <div class="ap-ach-top"><span class="ap-ach-icon">${esc(x.icon||'🏆')}</span>${!x.earned?'<span style="font-size:13px;color:#C9C9C0">🔒</span>':''}</div>
            <div class="ap-ach-name">${esc(x.title)}</div>
            <div class="ap-ach-desc">${esc(x.description||'')}</div>
            ${x.earned&&x.earned_at?`<div class="ap-ach-date">הושג · ${apFmtDate(x.earned_at)}</div>`:''}
            ${prog?`<div class="ap-ach-prog">נעול · ${esc(prog)}</div>`:(!x.earned?`<div class="ap-ach-prog">נעול</div>`:'')}
        </div>`;
    }).join('');

    // articles section
    _apAllArticles = cd.items||[];
    const types = [...new Set(_apAllArticles.map(x=>x.content_type))];
    const typeCounts = {all:_apAllArticles.length};
    types.forEach(t=>typeCounts[t]=_apAllArticles.filter(x=>x.content_type===t).length);
    const chips = [
        {key:'all',label:`הכל (${_apAllArticles.length})`},
        ...types.map(t=>({key:t,label:`${apTypeMeta(t).label} (${typeCounts[t]})`}))
    ];

    el.innerHTML = `
    <!-- hero card -->
    <div class="ap-hero">
      <div class="ap-hero-inner">
        <div class="ap-info">
          <div class="ap-name">${esc(name)}</div>
          ${badge}
          <div class="ap-meta">
            ${a.community_name?`<span>קהילת ${esc(a.community_name)}</span><span class="sep">|</span>`:''}
            ${a.created_at?`<span>כותב/ת מאז ${new Date(a.created_at).toLocaleString('he-IL',{month:'long',year:'numeric'})}</span>`:''}
            ${a.sections?`<span class="sep">|</span><span>מדורים: ${esc(a.sections)}</span>`:''}
          </div>
          ${a.bio?`<div class="ap-bio">${esc(a.bio)}</div>`:''}
          ${!isSelf?`<div class="ap-follow-row">
            <button class="ap-btn-follow ${isFollowing?'following':''}" id="ap-follow-btn">${isFollowing?'✓ עוקב/ת':'+ עקוב'}</button>
            <button class="ap-btn-msg"><i class="fa-regular fa-envelope"></i></button>
            <span class="ap-follow-count">${apFmtNum(followers)} עוקבים</span>
          </div>`:''}
        </div>
        <div class="ap-avatar-wrap">${avatar}</div>
      </div>
    </div>

    <!-- metrics -->
    <div class="ap-metrics">
      <div class="ap-metric primary">
        <div class="ap-metric-val">${apFmtNum(rep)}</div>
        <div class="ap-metric-lbl">סך ציון מוניטין</div>
        <div class="ap-metric-sub">▲ 340 החודש · מקום 4 מתוך 128</div>
      </div>
      <div class="ap-metric"><div class="ap-metric-val">${pub}</div><div class="ap-metric-lbl">כתבות שפורסמו</div><div class="ap-metric-sub">3 החודש</div></div>
      <div class="ap-metric"><div class="ap-metric-val">${apFmtNum(views)}</div><div class="ap-metric-lbl">סך צפיות</div><div class="ap-metric-sub">ממוצע ${avgV} לכתבה</div></div>
      <div class="ap-metric"><div class="ap-metric-val">${apFmtNum(comms)}</div><div class="ap-metric-lbl">תגובות</div><div class="ap-metric-sub">84% נענו על ידה</div></div>
      <div class="ap-metric"><div class="ap-metric-val">${front}</div><div class="ap-metric-lbl">כותרת ראשית</div>${front?`<div class="ap-metric-sub">אחרונה: 15.08.26</div>`:''}</div>
      <div class="ap-metric"><div class="ap-metric-val">${natl}</div><div class="ap-metric-lbl">כתבות ארציות</div>${pub?`<div class="ap-metric-sub">מתוך ${pub}</div>`:''}</div>
    </div>

    <!-- achievements -->
    ${achs.length?`<div class="ap-section">
      <div class="ap-section-hdr"><h3>גלריית הישגים</h3><span>${earned.length} מתוך ${achs.length} הושגו</span></div>
      <div class="ap-ach-grid">${achCards}</div>
    </div>`:''}

    <!-- articles -->
    <div class="ap-section" style="margin-bottom:32px">
      <div class="ap-section-hdr"><h3>כל הכתבות</h3><span>${_apAllArticles.length} כתבות</span></div>
      <div class="ap-filter-row" id="ap-filter-row">
        ${chips.map(c=>`<button class="ap-chip ${c.key===_apFilter?'active':''}" data-f="${c.key}">${esc(c.label)}</button>`).join('')}
      </div>
      <div class="ap-sort-row">
        <span class="ap-sort-lbl">מיון:</span>
        <button class="ap-sort-btn active" id="ap-sort-new">חדשות</button>
        <button class="ap-sort-btn" id="ap-sort-views">הכי נצפות</button>
      </div>
      <div class="ap-art-list" id="ap-art-list"></div>
      <button class="ap-btn-more" id="ap-btn-more" style="display:none">טען עוד כתבות</button>
    </div>`;

    // bind follow
    const fbtn = document.getElementById('ap-follow-btn');
    if(fbtn) fbtn.addEventListener('click', ()=>KH.toggleFollow(authorId, fbtn));

    // bind filter chips
    document.querySelectorAll('#ap-filter-row .ap-chip').forEach(b=>{
        b.addEventListener('click',()=>{
            _apFilter=b.dataset.f;
            document.querySelectorAll('#ap-filter-row .ap-chip').forEach(x=>x.classList.toggle('active',x===b));
            apApplySort();
        });
    });
    // bind sort
    document.getElementById('ap-sort-new').addEventListener('click',function(){
        _apSort='new';
        document.querySelectorAll('.ap-sort-btn').forEach(b=>b.classList.remove('active'));
        this.classList.add('active'); apApplySort();
    });
    document.getElementById('ap-sort-views').addEventListener('click',function(){
        _apSort='views';
        document.querySelectorAll('.ap-sort-btn').forEach(b=>b.classList.remove('active'));
        this.classList.add('active'); apApplySort();
    });
    document.getElementById('ap-btn-more').addEventListener('click',()=>{ _apPage++; apRenderPage(); });

    apApplySort();
};

function apApplySort(){
    let list = _apFilter==='all'?[..._apAllArticles]:_apAllArticles.filter(x=>x.content_type===_apFilter);
    if(_apSort==='views') list.sort((a,b)=>(parseInt(b.views_count)||0)-(parseInt(a.views_count)||0));
    else list.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
    _apFiltered=list; _apPage=0; apRenderPage();
}

function apRenderPage(){
    const slice=_apFiltered.slice(0,(_apPage+1)*AP_PAGE);
    const el=document.getElementById('ap-art-list');
    if(!el) return;
    el.innerHTML = slice.map(a=>{
        const ti=apTypeMeta(a.content_type);
        const isFront=AP_FRONT_TITLES.has(a.title);
        const isNatl=a.scope_type==='GLOBAL';
        const img=a.cover_image_url
            ?`<img src="${esc(a.cover_image_url)}" class="ap-art-img" alt="" onerror="this.parentNode.innerHTML='<div class=ap-art-img-ph>📄</div>'">`
            :`<div class="ap-art-img-ph">📄</div>`;
        return `<div class="ap-art" data-id="${a.id}">
            ${img}
            <div class="ap-art-body">
                <div class="ap-art-tags">
                    <span class="ap-art-type ${ti.cls}">${esc(ti.label)}</span>
                    ${isFront?`<span class="ap-tag-front">כותרת ראשית</span>`:''}
                    ${isNatl?`<span class="ap-tag-natl">ארצי</span>`:''}
                </div>
                <div class="ap-art-title">${esc(a.title)}</div>
                <div class="ap-art-footer">
                    <span class="ap-art-stat"><i class="fa-regular fa-eye"></i> ${apFmtNum(a.views_count)}</span>
                    <span class="ap-art-stat"><i class="fa-regular fa-comment"></i> ${apFmtNum(a.comments_count)}</span>
                    <span class="ap-art-stat"><i class="fa-regular fa-heart"></i> ${apFmtNum(a.likes_count)}</span>
                    <span class="ap-art-date">${apFmtDate(a.published_at)}</span>
                </div>
            </div>
        </div>`;
    }).join('');
    document.getElementById('ap-btn-more').style.display = _apFiltered.length>slice.length?'':'none';
    el.querySelectorAll('.ap-art').forEach(c=>{
        c.addEventListener('click',()=>KH.nav('content',{id:parseInt(c.dataset.id)}));
    });
}

KH.toggleFollow = async function(authorId, btn) {
    const d = await khFetch(`${API}/authors/${authorId}/follow`, {
        method: 'POST', body: JSON.stringify({ groupId: CTX.groupId||'' })
    });
    if (!d.success) return;
    btn.classList.toggle('following', d.following);
    btn.textContent = d.following ? '✓ עוקב/ת' : '+ עקוב';
    khToast(d.following ? 'עוקב/ת אחרי כותב/ת זה' : 'הפסקת לעקוב');
};

KH.loadFollowingFeed = async function(page = 1) {
    const el = document.getElementById('following-feed-list');
    if (page === 1) el.innerHTML = '<div class="kh-spinner"></div>';
    if (!CTX.groupId) { el.innerHTML = '<p class="kh-empty">יש להיכנס כדי לראות עדכונים</p>'; return; }
    let d;
    try { d = await khFetch(`${API}/my-following-feed?groupId=${CTX.groupId}&page=${page}&limit=20`); }
    catch(e) { if (page===1) el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>שגיאה: ${esc(e.message)}</p></div>`; return; }
    if (d.error) { if (page===1) el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>${esc(d.error)}</p></div>`; return; }
    const items = d.items || [];
    if (page === 1) el.innerHTML = '';
    if (!items.length && page === 1) { el.innerHTML = '<p class="kh-empty">אין פוסטים — עקוב אחרי כותבים כדי לראות עדכונים</p>'; return; }
    items.forEach(it => {
        const div = document.createElement('div');
        div.innerHTML = KH.renderFeedCard(it);
        el.appendChild(div.firstElementChild);
    });
};

// Editor picks strip rendering (called in loadFeed)
KH.loadEditorPicksStrip = async function(container) {
    const d = await khFetch(`${API}/editor-picks/current`);
    const picks = d.picks || [];
    if (!picks.length) return;
    const html = `
        <div style="padding:.5rem .75rem 0">
            <div class="kh-strip-label">⭐ בחירת העורך</div>
        </div>
        <div class="kh-strip-scroll">
            ${picks.map(p => `
                <div class="kh-strip-card" onclick="KH.nav('content',{id:${p.id}})">
                    ${p.cover_image_url ? khCoverImg(esc(p.cover_image_url), '📰', 'kh-strip-img', '') : '<div class="kh-strip-img" style="background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:1.5rem">📰</div>'}
                    <div class="kh-strip-card-title">${esc(p.title)}</div>
                    <div style="font-size:.65rem;color:var(--muted)">${esc(p.author_name||'')}</div>
                </div>`).join('')}
        </div>`;
    const el = document.createElement('div');
    el.innerHTML = html;
    container.insertBefore(el, container.firstChild);
};

// SA editor picks management (extend existing SA queue view)
KH.loadEditorPicksSA = async function() {
    const d = await khFetch(`${API}/sa/editor-picks`);
    const picks = d.picks || [];
    const el = document.getElementById('sa-editor-picks-list');
    if (!el) return;
    el.innerHTML = picks.length ? picks.map(p => `
        <div class="report-card">
            <div class="report-header">
                <span class="report-reason-badge">⭐ בחירת עורך</span>
                <span style="font-size:.75rem;color:var(--muted)">${p.created_at?.slice(0,10)||''}</span>
            </div>
            <strong>${esc(p.title)}</strong>
            <div style="font-size:.8rem;color:var(--muted)">${esc(p.author_name||'')} · ${p.status||''}</div>
            ${p.note ? `<div style="font-size:.8rem;margin-top:.25rem">${esc(p.note)}</div>` : ''}
            <button class="kh-btn kh-btn-danger kh-btn-sm" style="margin-top:.4rem" onclick="KH.removeEditorPick(${p.id})">הסר</button>
        </div>`).join('')
        : '<p class="kh-empty">אין בחירות עורך כרגע</p>';
};

KH.addEditorPick = async function(contentId) {
    const note = prompt('הערת עורך (אופציונלי):') || '';
    const d = await khFetch(`${API}/sa/editor-picks`, {
        method: 'POST', body: JSON.stringify({ content_item_id: contentId, note })
    });
    if (d.success) { khToast('success', 'נוסף לבחירת עורך'); KH.loadEditorPicksSA(); }
    else khToast('error', d.error || 'שגיאה');
};

KH.removeEditorPick = async function(pickId) {
    if (!confirm('להסיר מבחירת עורך?')) return;
    const d = await khFetch(`${API}/sa/editor-picks/${pickId}`, { method: 'DELETE' });
    if (d.success) { khToast('success', 'הוסר'); KH.loadEditorPicksSA(); }
};

KH.revokeAuthor = async function(authorId) {
    const days = parseInt(prompt('משך הרחקה בימים (ברירת מחדל: 30):') || '30') || 30;
    const d = await khFetch(`${API}/sa/authors/${authorId}/revoke`, {
        method: 'POST', body: JSON.stringify({ days })
    });
    if (d.success) khToast('success', 'הכותב הורחק');
    else khToast('error', d.error || 'שגיאה');
};

// Badge helper
function badgeHtml(level, isRevoked) {
    const effective = isRevoked ? 'DEFAULT' : level;
    if (effective === 'LOCAL_LEADER') return '<span class="badge-tag badge-LOCAL_LEADER">🏅 מוביל קהילתי</span>';
    if (effective === 'GLOBAL_LEADER') return '<span class="badge-tag badge-GLOBAL_LEADER">🌍 מוביל ארצי</span>';
    if (effective === 'LEGACY') return '<span class="badge-tag badge-LEGACY">⏳ Legacy</span>';
    return '';
}

// ── Phase 4: Search, Tags, Collections, AI Copilot, Versions ──

// Search
KH.doSearch = async function(page = 1) {
    const q = document.getElementById('kh-search-input')?.value?.trim() || STATE.lastSearchQuery || '';
    if (!q) return;
    STATE.lastSearchQuery = q;
    STATE.view = 'search';
    showView('view-search');
    const listEl = document.getElementById('search-results-list');
    const countEl = document.getElementById('search-result-count');
    const titleEl = document.getElementById('search-results-title');
    if (page === 1) listEl.innerHTML = '<div class="kh-spinner"></div>';
    titleEl.textContent = `תוצאות עבור "${q}"`;

    const type = document.getElementById('sf-type')?.value || '';
    const scope = document.getElementById('sf-scope')?.value || '';
    const dateRange = document.getElementById('sf-date')?.value || 'all';

    const params = new URLSearchParams({ q, page, limit: 20 });
    if (type) params.set('type', type);
    if (scope) params.set('scope', scope);
    if (dateRange !== 'all') params.set('date_range', dateRange);
    if (CTX.communityId) params.set('community_id', CTX.communityId);

    const d = await khFetch(`${API}/search?${params}`);
    const items = d.items || [];
    countEl.textContent = items.length ? `נמצאו ${items.length} תוצאות` : '';
    if (page === 1) listEl.innerHTML = '';
    if (!items.length && page === 1) {
        listEl.innerHTML = '<div class="kh-empty">לא נמצאו תוצאות לחיפוש זה</div>';
        return;
    }
    items.forEach(it => {
        const div = document.createElement('div');
        div.innerHTML = KH.renderFeedCard(it);
        listEl.appendChild(div.firstElementChild);
    });
};

// Tag page
KH.loadTagPage = async function(tagName, page = 1) {
    STATE.currentTag = tagName;
    showView('view-tag');
    STATE.view = 'tag';
    document.getElementById('tag-page-title').textContent = `#${tagName}`;
    const listEl = document.getElementById('tag-page-list');
    if (page === 1) listEl.innerHTML = '<div class="kh-spinner"></div>';

    const params = new URLSearchParams({ page, limit: 20 });
    if (CTX.communityId) params.set('community_id', CTX.communityId);
    const d = await khFetch(`${API}/tags/${encodeURIComponent(tagName)}?${params}`);
    const items = d.items || [];
    if (page === 1) listEl.innerHTML = `<div style="font-size:.78rem;color:var(--muted);margin-bottom:.5rem">${d.tag?.usage_count||0} שימושים</div>`;
    if (!items.length && page === 1) { listEl.innerHTML += '<div class="kh-empty">אין תוכן בתגית זו עדיין</div>'; return; }
    items.forEach(it => {
        const div = document.createElement('div');
        div.innerHTML = KH.renderFeedCard(it);
        listEl.appendChild(div.firstElementChild);
    });
};

// Collections
KH.loadCollections = async function() {
    const el = document.getElementById('collections-list');
    el.innerHTML = '<div class="kh-spinner"></div>';
    if (!CTX.groupId) { el.innerHTML = '<div class="kh-empty">יש להיכנס עם קבוצה</div>'; return; }
    let d;
    try { d = await khFetch(`${API}/my-collections?groupId=${CTX.groupId}`); }
    catch(e) { el.innerHTML = `<div class="kh-empty">⚠️ שגיאה: ${esc(e.message)}</div>`; return; }
    if (d.error) { el.innerHTML = `<div class="kh-empty">⚠️ ${esc(d.error)}</div>`; return; }
    const cols = d.collections || [];
    if (!cols.length) { el.innerHTML = '<div class="kh-empty">אין אוספים עדיין — צור אוסף חדש</div>'; return; }
    el.innerHTML = cols.map(c => `
        <div class="collection-card" onclick="KH.loadCollection(${c.id})">
            <div class="collection-card-title">${esc(c.title)}</div>
            <div class="collection-card-meta">${c.item_count||0} פריטים · ${c.is_public ? '🌐 ציבורי' : '🔒 פרטי'}</div>
            ${c.is_public && c.share_slug ? `<div style="font-size:.72rem;color:var(--primary);margin-top:.25rem">קישור שיתוף: /kol-haam/collection/${esc(c.share_slug)}</div>` : ''}
        </div>`).join('');
};

KH.loadCollection = async function(colId) {
    STATE.currentCollectionId = colId;
    showView('view-collection');
    STATE.view = 'collection';
    const el = document.getElementById('collection-view-content');
    el.innerHTML = '<div class="kh-spinner"></div>';
    const d = await khFetch(`${API}/collections/${colId}?groupId=${CTX.groupId||''}`);
    if (!d.success) { el.innerHTML = '<div class="kh-empty">שגיאה בטעינה</div>'; return; }
    const c = d.collection;
    document.getElementById('collection-view-title').textContent = esc(c.title);
    const isOwner = String(c.owner_group_id) === String(CTX.groupId);

    el.innerHTML = `
        ${c.description ? `<div style="font-size:.82rem;color:var(--muted);padding:.5rem .75rem">${esc(c.description)}</div>` : ''}
        ${isOwner ? `<div style="padding:.5rem .75rem;display:flex;gap:.5rem;flex-wrap:wrap">
            <label class="collection-toggle">
                <input type="checkbox" ${c.is_public ? 'checked' : ''} onchange="KH.toggleCollectionPublic(${c.id}, this.checked)">
                ציבורי ${c.is_public && c.share_slug ? `<a style="font-size:.7rem" onclick="event.stopPropagation()">🔗</a>` : ''}
            </label>
            ${c.is_public && c.share_slug ? `<button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.copyShareLink('${esc(c.share_slug)}')">העתק קישור</button>` : ''}
            <button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.deleteCollection(${c.id})">מחק אוסף</button>
        </div>` : ''}
        <div id="col-items-list" style="padding:.5rem .75rem;display:flex;flex-direction:column;gap:.4rem">
            ${(d.items||[]).length ? (d.items||[]).map(it => `
                <div class="feed-card-wrap" style="position:relative">
                    <div class="feed-card" onclick="KH.nav('content',{id:${it.id}})">
                        <div class="feed-card-body">
                            <div class="feed-card-title">${esc(it.title)}</div>
                            <div class="feed-card-footer"><span>${esc(it.author_name||'')}</span><span>${esc(it.community_name||'')}</span></div>
                        </div>
                    </div>
                    ${isOwner ? `<button class="kh-btn kh-btn-danger kh-btn-sm" style="position:absolute;top:.5rem;left:.5rem" onclick="event.stopPropagation();KH.removeFromCollection(${c.id},${it.id})">×</button>` : ''}
                </div>`).join('')
            : '<div class="kh-empty">האוסף ריק — הוסף תוכן דרך כפתור "הוסף לאוסף" בעמוד כתבה</div>'}
        </div>`;
};

KH.showCreateCollection = async function() {
    const title = prompt('שם האוסף:');
    if (!title || !title.trim()) return;
    if (!CTX.groupId) { khToast('error', 'יש להיכנס עם קבוצה'); return; }
    const d = await khFetch(`${API}/collections`, { method: 'POST', body: JSON.stringify({ groupId: CTX.groupId, title }) });
    if (d.success) { khToast('success', 'האוסף נוצר'); KH.loadCollections(); }
};

KH.showCreateCollectionModal = async function() {
    const title = prompt('שם האוסף החדש:');
    if (!title || !title.trim()) return;
    if (!CTX.groupId) { khToast('error', 'יש להיכנס עם קבוצה'); return; }
    const d = await khFetch(`${API}/collections`, { method: 'POST', body: JSON.stringify({ groupId: CTX.groupId, title }) });
    if (d.success) {
        khToast('success', 'האוסף נוצר');
        KH.openAddToCollection(STATE.addToCollectionContentId);
    }
};

KH.openAddToCollection = async function(contentId) {
    if (!CTX.groupId) { khToast('error', 'יש להיכנס כדי להוסיף לאוסף'); return; }
    STATE.addToCollectionContentId = contentId;
    const d = await khFetch(`${API}/my-collections?groupId=${CTX.groupId}`);
    const cols = d.collections || [];
    const listEl = document.getElementById('collection-modal-list');
    listEl.innerHTML = cols.length ? cols.map(c => `
        <button class="kh-btn kh-btn-outline" style="justify-content:space-between" onclick="KH.addToCollection(${c.id},${contentId})">
            <span>${esc(c.title)}</span><span style="font-size:.72rem;color:var(--muted)">${c.item_count||0} פריטים</span>
        </button>`).join('')
        : '<div class="kh-empty" style="font-size:.8rem">אין אוספים עדיין</div>';
    document.getElementById('kh-collection-modal').classList.add('show');
};

KH.closeCollectionModal = function() { document.getElementById('kh-collection-modal').classList.remove('show'); };

KH.addToCollection = async function(colId, contentId) {
    const d = await khFetch(`${API}/collections/${colId}/items`, {
        method: 'POST', body: JSON.stringify({ groupId: CTX.groupId, content_item_id: contentId })
    });
    if (d.success) { khToast('success', 'נוסף לאוסף'); KH.closeCollectionModal(); }
    else khToast('error', d.error || 'שגיאה');
};

KH.removeFromCollection = async function(colId, contentId) {
    if (!confirm('להסיר מהאוסף?')) return;
    const d = await khFetch(`${API}/collections/${colId}/items/${contentId}`, {
        method: 'DELETE', body: JSON.stringify({ groupId: CTX.groupId })
    });
    if (d.success) { khToast('success', 'הוסר'); KH.loadCollection(colId); }
};

KH.toggleCollectionPublic = async function(colId, isPublic) {
    const d = await khFetch(`${API}/collections/${colId}`, {
        method: 'PUT', body: JSON.stringify({ groupId: CTX.groupId, is_public: isPublic })
    });
    if (d.success) { khToast('success', isPublic ? 'הפך לציבורי' : 'הפך לפרטי'); KH.loadCollection(colId); }
};

KH.copyShareLink = function(slug) {
    const url = `${location.origin}/kol-haam/collection/${slug}`;
    navigator.clipboard?.writeText(url).then(() => khToast('success', 'הקישור הועתק'))
        .catch(() => khToast('info', url));
};

KH.deleteCollection = async function(colId) {
    if (!confirm('למחוק את האוסף לצמיתות?')) return;
    const d = await khFetch(`${API}/collections/${colId}`, {
        method: 'DELETE', body: JSON.stringify({ groupId: CTX.groupId })
    });
    if (d.success) { khToast('success', 'האוסף נמחק'); KH.nav('collections'); }
};

// Version history
KH.showVersionHistory = async function(contentId) {
    const el = document.getElementById('versions-modal-list');
    el.innerHTML = '<div class="kh-spinner"></div>';
    document.getElementById('kh-versions-modal').classList.add('show');
    const d = await khFetch(`${API}/content/${contentId}/versions?groupId=${CTX.groupId||''}`);
    const versions = d.versions || [];
    if (!versions.length) { el.innerHTML = '<div class="kh-empty">אין גרסאות קודמות</div>'; return; }
    el.innerHTML = versions.map(v => `
        <div class="version-row">
            <span class="version-num">v${v.version_number}</span>
            <span style="flex:1;font-size:.8rem">${esc(v.title || '')}</span>
            <span style="color:var(--muted);font-size:.72rem">${v.created_at ? new Date(v.created_at).toLocaleDateString('he-IL') : ''}</span>
            <span style="font-size:.72rem;color:var(--muted)">${esc(v.editor_name || '')}</span>
        </div>`).join('');
};

// Print
KH.printContent = function() {
    window.print();
};

// AI Copilot
KH._aiSelectedActions = new Set(['grammar','title','summary','safety_scan']);

KH.renderAICopilot = function(contentId) {
    return `<div class="ai-panel" id="ai-copilot-panel">
        <div class="ai-panel-title">🤖 עוזר הכתיבה AI
            <span style="font-size:.7rem;color:var(--muted);font-weight:400">עד 10 קריאות ביום</span>
        </div>
        <div class="ai-action-btns">
            ${[
                ['grammar','✏️ תיקון דקדוק'],['title','💡 כותרות'],['subtitle','📝 תת-כותרת'],
                ['summary','📋 תקציר'],['tags','🏷️ תגיות'],['duplicate_check','🔍 כפילויות'],
                ['safety_scan','🛡️ בדיקת בטיחות'],['cover_suggestion','🖼️ תמונת שער']
            ].map(([k,l]) => `<button class="ai-action-btn ${KH._aiSelectedActions.has(k)?'selected':''}"
                onclick="KH.toggleAIAction('${k}',this)">${l}</button>`).join('')}
        </div>
        <button class="kh-btn kh-btn-primary kh-btn-sm" onclick="KH.runAICopilot(${contentId})" id="ai-run-btn">▶ הפעל עוזר</button>
        <div id="ai-results"></div>
    </div>`;
};

KH.toggleAIAction = function(key, btn) {
    if (KH._aiSelectedActions.has(key)) { KH._aiSelectedActions.delete(key); btn.classList.remove('selected'); }
    else { KH._aiSelectedActions.add(key); btn.classList.add('selected'); }
};

KH.runAICopilot = async function(contentId) {
    if (!CTX.groupId) { khToast('error', 'יש להיכנס עם קבוצה'); return; }
    const btn = document.getElementById('ai-run-btn');
    const resultsEl = document.getElementById('ai-results');
    if (btn) { btn.textContent = '⏳ מעבד...'; btn.disabled = true; }
    resultsEl.innerHTML = '<div class="kh-spinner"></div>';

    const d = await khFetch(`${API}/content/${contentId}/ai-copilot`, {
        method: 'POST',
        body: JSON.stringify({ actions: [...KH._aiSelectedActions], groupId: CTX.groupId, communityId: CTX.communityId })
    });
    if (btn) { btn.textContent = '▶ הפעל שוב'; btn.disabled = false; }

    if (!d.success) { resultsEl.innerHTML = `<div class="ai-safety-flag">${esc(d.error || 'שגיאה')}</div>`; return; }
    const r = d.result;
    let html = '';

    if (d.flagged) {
        html += `<div class="ai-safety-flag">⚠️ בדיקת הבטיחות זיהתה חשד לבעיה. דיווח נשלח ל-ZM לידיעה. תוכל להמשיך ולשלוח לאישור.</div>`;
    }

    if (r.grammar?.corrections?.length) {
        html += `<div class="ai-result-section"><div class="ai-result-label">✏️ תיקוני דקדוק (${r.grammar.corrections.length})</div>
            ${r.grammar.corrections.slice(0,8).map(c => `<div class="ai-correction-item">
                <span class="ai-correction-orig">${esc(c.original)}</span>
                <span>→</span>
                <span class="ai-correction-sugg">${esc(c.suggested)}</span>
                <button class="kh-btn kh-btn-outline kh-btn-sm" style="font-size:.7rem" onclick="KH.applyGrammar('${esc(c.original).replace(/'/g,'\\\'').replace(/"/g,'&quot;')}','${esc(c.suggested).replace(/'/g,'\\\'').replace(/"/g,'&quot;')}')">החל</button>
            </div>`).join('')}
            ${r.grammar.corrected_full_text ? `<button class="kh-btn kh-btn-primary kh-btn-sm" style="margin-top:.35rem" onclick="KH.applyFullCorrection()">החל את כל התיקונים</button>` : ''}
        </div>`;
        KH._aiGrammarFullText = r.grammar.corrected_full_text;
    }

    if (r.title_suggestions?.length) {
        html += `<div class="ai-result-section"><div class="ai-result-label">💡 הצעות לכותרת</div>
            ${r.title_suggestions.map(t => `<span class="ai-suggestion-chip" onclick="KH.applyTitle('${esc(t).replace(/'/g,'\\\'')}')">${esc(t)}</span>`).join('')}
        </div>`;
    }
    if (r.subtitle_suggestions?.length) {
        html += `<div class="ai-result-section"><div class="ai-result-label">📝 הצעות לתת-כותרת</div>
            ${r.subtitle_suggestions.map(t => `<span class="ai-suggestion-chip" onclick="KH.applySubtitle('${esc(t).replace(/'/g,'\\\'')}')">${esc(t)}</span>`).join('')}
        </div>`;
    }
    if (r.summary) {
        html += `<div class="ai-result-section"><div class="ai-result-label">📋 תקציר מוצע</div>
            <div style="font-size:.82rem;white-space:pre-wrap">${esc(r.summary)}</div>
            <button class="kh-btn kh-btn-outline kh-btn-sm" style="margin-top:.3rem" onclick="KH.applySummary()">החל תקציר</button>
        </div>`;
        KH._aiSummary = r.summary;
    }
    if (r.tag_suggestions?.length) {
        html += `<div class="ai-result-section"><div class="ai-result-label">🏷️ תגיות מוצעות</div>
            ${r.tag_suggestions.map(t => `<span class="ai-suggestion-chip" onclick="KH.applyTag('${esc(t).replace(/'/g,'\\\'')}')">${esc(t)}</span>`).join('')}
        </div>`;
    }
    if (r.duplicate_check) {
        const dc = r.duplicate_check;
        html += `<div class="ai-result-section"><div class="ai-result-label">🔍 כפילויות</div>
            ${dc.found_similar ? `<div style="color:var(--warn);font-size:.82rem">⚠️ נמצאו ${dc.similar_items.length} כתבות דומות:</div>
                ${dc.similar_items.map(s => `<div style="font-size:.8rem;padding:.2rem 0"><span style="color:var(--muted)">(${Math.round(s.similarity_score*100)}%)</span> ${esc(s.title)}</div>`).join('')}`
            : '<div style="color:var(--success);font-size:.82rem">✅ לא נמצאו כתבות דומות</div>'}
        </div>`;
    }
    if (r.safety_scan) {
        const ss = r.safety_scan;
        const issues = Object.entries(ss).filter(([k,v]) => k !== 'flags' && v === true);
        html += `<div class="ai-result-section"><div class="ai-result-label">🛡️ בדיקת בטיחות</div>
            ${issues.length ? issues.map(([k]) => `<div style="color:var(--danger);font-size:.8rem">⚠️ ${k}</div>`).join('')
            : '<div style="color:var(--success);font-size:.8rem">✅ לא נמצאו בעיות</div>'}
            ${(ss.flags||[]).length ? `<div style="font-size:.78rem;color:var(--danger)">${ss.flags.join('; ')}</div>` : ''}
        </div>`;
    }
    if (r.cover_image_suggestions?.length) {
        html += `<div class="ai-result-section"><div class="ai-result-label">🖼️ הצעות לתמונת שער</div>
            ${r.cover_image_suggestions.map(q => `<div style="font-size:.8rem;padding:.15rem 0;color:var(--muted)">🔎 ${esc(q)}</div>`).join('')}
        </div>`;
    }

    resultsEl.innerHTML = html || '<div class="kh-empty">אין תוצאות</div>';
};

KH.applyTitle = function(title) {
    const el = document.getElementById('kh-title');
    if (el) { el.value = title; khToast('success', 'כותרת הוחלה'); }
};
KH.applySubtitle = function(sub) {
    const el = document.getElementById('kh-subtitle');
    if (el) { el.value = sub; khToast('success', 'תת-כותרת הוחלה'); }
};
KH.applySummary = function() {
    const el = document.getElementById('kh-summary');
    if (el && KH._aiSummary) { el.value = KH._aiSummary; khToast('success', 'תקציר הוחל'); }
};
KH.applyTag = function(tag) {
    if (!STATE.tags) STATE.tags = [];
    if (!STATE.tags.includes(tag)) { STATE.tags.push(tag); }
    const tagsEl = document.getElementById('kh-tags-display');
    if (tagsEl) tagsEl.innerHTML = STATE.tags.map(t => `<span class="tag-chip">#${esc(t)} <span onclick="KH.removeTag('${esc(t)}')">×</span></span>`).join('');
    khToast('success', `תגית "${tag}" נוספה`);
};
KH.applyGrammar = function(original, suggested) {
    const editor = document.getElementById('kh-content-editor');
    if (!editor) return;
    editor.innerHTML = editor.innerHTML.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'g'), suggested);
    khToast('success', 'תיקון הוחל');
};
KH.applyFullCorrection = function() {
    const editor = document.getElementById('kh-content-editor');
    if (!editor || !KH._aiGrammarFullText) return;
    editor.innerHTML = KH._aiGrammarFullText.replace(/\n/g, '<br>');
    khToast('success', 'כל התיקונים הוחלו');
};

// ── Utilities ─────────────────────────────────────────────────
function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function statusLabel(s) {
    const m = { DRAFT:'טיוטה', PENDING_ZM:'ממתין לאישור מקומי', PENDING_SA:'ממתין לאישור ארצי',
        PUBLISHED_LOCAL:'פורסם מקומית', PUBLISHED_GLOBAL:'פורסם ארצית', REJECTED:'נדחה' };
    return m[s] || s;
}

// ══════════════════════════════════════════════════════════════
// ── Generic List View (tag / search / category) ───────────────
// ══════════════════════════════════════════════════════════════

const VL_KIND_COLORS = {
    ARTICLE:       '#16294D',
    WIKI_GUIDE:    '#1F7A72',
    SUCCESS_STORY: '#4A6491',
    QA_QUESTION:   '#8A5A0E',
};
const VL_KIND_LABELS = {
    ARTICLE:       'כתבת עומק',
    WIKI_GUIDE:    'מדריך',
    SUCCESS_STORY: 'סיפור קהילה',
    QA_QUESTION:   'שאלה',
};

let _vlAllItems = [];   // כל הפריטים שנטענו מה-API
let _vlFiltered = [];   // אחרי פילטרים
let _vlTime = 'all', _vlKind = 'all', _vlScope = 'all', _vlSort = 'new';
let _vlFollowing = false;
let _vlMode = 'tag';   // 'tag' | 'search' | 'category'
let _vlParam = '';     // tagName / query / categoryId
let _vlTotalFromServer = 0;

KH.loadList = async function(mode, param) {
    _vlMode = mode;
    _vlParam = param;
    _vlTime = 'all'; _vlKind = 'all'; _vlScope = 'all'; _vlSort = 'new';
    _vlFollowing = false;

    // Reset UI controls
    document.querySelectorAll('.vl-tab').forEach(b => b.classList.toggle('vl-tab-active', b.dataset.time === 'all'));
    document.querySelectorAll('#vl-kind-chips .vl-chip').forEach(b => b.classList.toggle('vl-chip-active', b.dataset.kind === 'all'));
    document.querySelectorAll('.vl-scope').forEach(b => b.classList.toggle('vl-chip-active', b.dataset.scope === 'all'));
    document.querySelectorAll('.vl-sort-btn').forEach(b => b.classList.toggle('vl-sort-active', b.dataset.sort === 'new'));
    document.getElementById('vl-q').value = (mode === 'search') ? param : '';
    document.getElementById('vl-follow-btn').classList.remove('following');

    // Breadcrumb / kicker / H1
    const bc = document.getElementById('vl-breadcrumb');
    const kicker = document.getElementById('vl-kicker');
    const h1 = document.getElementById('vl-h1');
    const desc = document.getElementById('vl-desc');
    const followBtn = document.getElementById('vl-follow-btn');

    if (mode === 'tag') {
        bc.innerHTML = `<a href="#" onclick="KH.nav('feed');return false;">בית</a><span class="sep">›</span><span style="color:#B9C6DC;">תגיות</span>`;
        kicker.textContent = 'תגית';
        h1.textContent = `#${param}`;
        desc.textContent = `כל הכתבות המתויגות ב-#${param}`;
        followBtn.textContent = '+ עקבו אחרי התגית';
    } else if (mode === 'search') {
        bc.innerHTML = `<a href="#" onclick="KH.nav('feed');return false;">בית</a><span class="sep">›</span><span style="color:#B9C6DC;">חיפוש</span>`;
        kicker.textContent = 'תוצאות חיפוש';
        h1.textContent = `"${param}"`;
        desc.textContent = `תוצאות חיפוש עבור "${param}"`;
        followBtn.style.display = 'none';
    } else {
        bc.innerHTML = `<a href="#" onclick="KH.nav('feed');return false;">בית</a><span class="sep">›</span><a href="#" onclick="KH.nav('feed');return false;" style="color:#8FD8CF;">מדורים</a><span class="sep">›</span><span style="color:#B9C6DC;">${esc(param)}</span>`;
        kicker.textContent = 'מדור';
        h1.textContent = param;
        desc.textContent = 'כל מה שנכתב בקהילות — מסודר לפי זמן, סוג תוכן והיקף.';
        followBtn.textContent = '+ עקבו אחרי המדור';
        followBtn.style.display = '';
    }

    // Show view
    STATE.prevView = STATE.view;
    STATE.view = 'list';
    showView('view-list');

    // Fetch
    document.getElementById('vl-list').innerHTML = '<div class="kh-spinner" style="margin:32px auto"></div>';
    document.getElementById('vl-empty').style.display = 'none';
    document.getElementById('vl-result-line').textContent = '';
    document.getElementById('vl-load-more-wrap').style.display = 'none';

    try {
        let d;
        if (mode === 'tag') {
            const p = new URLSearchParams({ page: 1, limit: 100 });
            if (CTX.communityId) p.set('community_id', CTX.communityId);
            d = await khFetch(`${API}/tags/${encodeURIComponent(param)}?${p}`);
            _vlAllItems = d.items || [];
            _vlTotalFromServer = _vlAllItems.length;
        } else if (mode === 'search') {
            const p = new URLSearchParams({ q: param, page: 1, limit: 100 });
            if (CTX.communityId) p.set('community_id', CTX.communityId);
            d = await khFetch(`${API}/search?${p}`);
            _vlAllItems = d.items || [];
            _vlTotalFromServer = _vlAllItems.length;
        } else {
            // category — use feed endpoint
            const p = new URLSearchParams({ scope: STATE.scope || 'local', page: 1, limit: 100 });
            if (CTX.communityId) p.set('community_id', CTX.communityId);
            if (param) p.set('category_id', param);
            d = await khFetch(`${API}/feed?${p}`);
            _vlAllItems = d.items || [];
            _vlTotalFromServer = _vlAllItems.length;
        }
    } catch(e) {
        document.getElementById('vl-list').innerHTML = `<div class="kh-empty">⚠️ שגיאת טעינה: ${esc(e.message)}</div>`;
        return;
    }

    vlApplyFilters();
};

function vlApplyFilters() {
    const q = (document.getElementById('vl-q')?.value || '').trim().toLowerCase();
    const now = new Date();
    const limits = { today: 1, week: 7, month: 31, year: 365, all: 99999 };
    const maxDays = limits[_vlTime] || 99999;

    let list = _vlAllItems.filter(it => {
        if (_vlKind !== 'all' && it.content_type !== _vlKind) return false;
        if (_vlScope !== 'all' && it.scope_type !== _vlScope) return false;
        if (q && !(it.title || '').toLowerCase().includes(q)) return false;
        if (maxDays < 99999 && it.published_at) {
            const days = (now - new Date(it.published_at)) / 86400000;
            if (days > maxDays) return false;
        }
        return true;
    });

    if (_vlSort === 'views') {
        list.sort((a,b) => (parseInt(b.views_count)||0) - (parseInt(a.views_count)||0));
    } else {
        list.sort((a,b) => new Date(b.published_at) - new Date(a.published_at));
    }

    _vlFiltered = list;

    const total = _vlTotalFromServer;
    const rLine = document.getElementById('vl-result-line');
    rLine.textContent = `${list.length} כתבות${total > list.length ? ` מתוך ${total}` : ''}`;

    const listEl = document.getElementById('vl-list');
    const emptyEl = document.getElementById('vl-empty');

    if (!list.length) {
        listEl.innerHTML = '';
        emptyEl.style.display = '';
        emptyEl.innerHTML = `<div class="vl-empty-inner">
            <div class="vl-empty-title">אין כתבות שתואמות את הסינון</div>
            <div class="vl-empty-sub">נסו טווח זמן רחב יותר או הסירו את סוג התוכן.</div>
            <button class="vl-reset-btn" onclick="vlReset()">נקה סינון</button>
        </div>`;
        return;
    }
    emptyEl.style.display = 'none';
    listEl.innerHTML = list.map(vlCardHtml).join('');
    document.getElementById('vl-load-more-wrap').style.display = 'none';
}

function vlCardHtml(it) {
    const kindColor = VL_KIND_COLORS[it.content_type] || '#16294D';
    const kindLabel = VL_KIND_LABELS[it.content_type] || 'כתבה';
    const isGlobal = it.scope_type === 'GLOBAL';
    const scopeLabel = isGlobal ? 'ארצי' : 'מקומי';
    const scopeFg = isGlobal ? '#1F7A72' : '#8A5A0E';

    const pub = it.published_at ? new Date(it.published_at) : null;
    const nowMs = Date.now();
    const diffMs = pub ? (nowMs - pub.getTime()) : null;
    const isNew = diffMs !== null && diffMs < 86400000;

    const imgHtml = it.cover_image_url
        ? khCoverImg(esc(it.cover_image_url), TYPE_ICONS[it.content_type]||'📄', 'vl-card-img', 'width:100%;height:100%;object-fit:cover;display:block')
        : `<div class="vl-card-img-ph">📄</div>`;

    const authorName = it.author_name || it.family_name || '';
    const community = it.community_name || '';
    const views = fmtNum(it.views_count || 0);
    const comments = fmtNum(it.comments_count || 0);
    const likes = fmtNum(it.likes_count || 0);
    const when = pub ? vlRelDate(pub) : '';

    return `<div class="vl-card" style="border-inline-start-color:${kindColor}" onclick="KH.nav('content',{id:${it.id}})">
        <div class="vl-card-img">${imgHtml}</div>
        <div class="vl-card-body">
            <div class="vl-card-badges">
                <span class="vl-badge-kind" style="background:${kindColor}">${esc(kindLabel)}</span>
                <span class="vl-badge-scope" style="color:${scopeFg};border-color:${scopeFg}">${esc(scopeLabel)}</span>
                ${isNew ? '<span class="vl-badge-new">חדש היום</span>' : ''}
            </div>
            <div class="vl-card-title">${esc(it.title)}</div>
            ${it.subtitle ? `<div class="vl-card-lead">${esc(it.subtitle)}</div>` : ''}
            <div class="vl-card-foot">
                ${authorName ? `<span class="vl-card-author">${esc(authorName)}</span><span class="vl-card-sep">|</span>` : ''}
                ${community ? `<span>${esc(community)}</span><span class="vl-card-sep">|</span>` : ''}
                <span>${esc(when)}</span>
                <span class="vl-card-stats">
                    <span>👁 ${esc(views)}</span>
                    <span>💬 ${esc(comments)}</span>
                    <span>👍 ${esc(likes)}</span>
                </span>
            </div>
        </div>
    </div>`;
}

function vlRelDate(d) {
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (h < 1) return 'לפני פחות משעה';
    if (h < 24) return `לפני ${h} שעות`;
    if (days === 1) return 'אתמול';
    if (days < 7) return `לפני ${days} ימים`;
    if (days < 14) return 'לפני שבוע';
    if (days < 30) return `לפני ${Math.floor(days/7)} שבועות`;
    return d.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

function fmtNum(n) {
    n = parseInt(n) || 0;
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n/1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
    return String(n);
}

function vlSetTime(btn, val) {
    _vlTime = val;
    document.querySelectorAll('.vl-tab').forEach(b => b.classList.toggle('vl-tab-active', b === btn));
    vlApplyFilters();
}
function vlSetKind(btn, val) {
    _vlKind = val;
    document.querySelectorAll('#vl-kind-chips .vl-chip').forEach(b => b.classList.toggle('vl-chip-active', b === btn));
    vlApplyFilters();
}
function vlSetScope(btn, val) {
    _vlScope = val;
    document.querySelectorAll('.vl-scope').forEach(b => b.classList.toggle('vl-chip-active', b === btn));
    vlApplyFilters();
}
function vlSetSort(btn, val) {
    _vlSort = val;
    document.querySelectorAll('.vl-sort-btn').forEach(b => b.classList.toggle('vl-sort-active', b === btn));
    vlApplyFilters();
}
function vlToggleFollow() {
    _vlFollowing = !_vlFollowing;
    const btn = document.getElementById('vl-follow-btn');
    btn.classList.toggle('following', _vlFollowing);
    btn.textContent = _vlFollowing
        ? (_vlMode === 'tag' ? '✓ עוקבים אחרי התגית' : '✓ עוקבים אחרי המדור')
        : (_vlMode === 'tag' ? '+ עקבו אחרי התגית' : '+ עקבו אחרי המדור');
}
function vlReset() {
    _vlTime = 'all'; _vlKind = 'all'; _vlScope = 'all';
    document.querySelectorAll('.vl-tab').forEach(b => b.classList.toggle('vl-tab-active', b.dataset.time === 'all'));
    document.querySelectorAll('#vl-kind-chips .vl-chip').forEach(b => b.classList.toggle('vl-chip-active', b.dataset.kind === 'all'));
    document.querySelectorAll('.vl-scope').forEach(b => b.classList.toggle('vl-chip-active', b.dataset.scope === 'all'));
    document.getElementById('vl-q').value = '';
    vlApplyFilters();
}
function vlLoadMore() { /* paginated load — not needed since we fetch all */ }

// ── Init ──────────────────────────────────────────────────────
async function init() {
    // Community name
    if (CTX.communityName) {
        const name = decodeURIComponent(CTX.communityName);
        const el = document.getElementById('kh-community-name');
        const wrap = document.getElementById('kh-community-name-wrap');
        if (el) el.textContent = name;
        if (wrap) wrap.style.display = '';
    }

    // Show ZM / SA buttons
    if (CTX.isZM) document.getElementById('btn-zm-queue').style.display = '';
    if (CTX.isSA) {
        document.getElementById('btn-sa-queue').style.display = '';
        document.getElementById('btn-zm-queue').style.display = ''; // SA can also see ZM queue
    }

    // Load categories for chips
    let catData;
    try { catData = await khFetch(`${API}/categories?community_id=${CTX.communityId || ''}`); }
    catch(e) { catData = { categories: [] }; }
    STATE.categories = (catData && catData.categories) || [];
    const scroll = document.getElementById('cat-scroll');
    if (scroll) scroll.innerHTML = STATE.categories.map(c => `
        <button class="cat-chip" onclick="KH.setCategory(${c.id},this)">${esc(c.title)}</button>
    `).join('');
    // Populate editorial nav links
    const navEl = document.getElementById('kh-nav-links');
    if (navEl && STATE.categories.length) {
        navEl.innerHTML = STATE.categories.map(c =>
            `<a class="kh-nav-link" onclick="KH.setCategory(${c.id},this)">${esc(c.title)}</a>`
        ).join('');
    }

    // URL-param deep-linking for list view
    const _initView = _p.get('view');
    if (_initView === 'tag') {
        const tag = _p.get('tag') || '';
        if (tag) { KH.loadList('tag', tag); return; }
    } else if (_initView === 'search') {
        const q = _p.get('q') || '';
        if (q) { KH.loadList('search', q); return; }
    }

    // Public collection via slug URL
    const slugMatch = location.pathname.match(/\/kol-haam\/collection\/([^/]+)/);
    if (slugMatch) {
        const slug = slugMatch[1];
        khFetch(`${API}/collections/public/${slug}`).then(d => {
            if (d.success) {
                STATE.currentCollectionId = d.collection.id;
                document.getElementById('collection-view-title').textContent = esc(d.collection.title);
                const el = document.getElementById('collection-view-content');
                el.innerHTML = (d.items||[]).map(it => KH.renderFeedCard(it)).join('') || '<div class="kh-empty">האוסף ריק</div>';
                showView('view-collection');
                STATE.view = 'collection';
            }
        }).catch(() => {});
        return;
    }

    // Load initial feed
    KH.loadFeed();

    // Handle postMessage from parent (support external nav)
    window.addEventListener('message', e => {
        if (e.data?.type === 'KH_NAV' && e.data.view) KH.nav(e.data.view, e.data.params || {});
    });
}

init().catch(e => {
    const el = document.getElementById('view-feed-inner');
    if (el) el.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>שגיאת אתחול: ${esc(e.message)}</p></div>`;
});
