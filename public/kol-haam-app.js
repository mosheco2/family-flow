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
function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
    },

    back() {
        const prev = STATE.prevView || 'feed';
        KH.nav(prev);
    },

    setScope(scope, btn) {
        STATE.scope = scope;
        STATE.categoryId = null;
        document.querySelectorAll('.scope-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        KH.loadFeed();
    },

    setCategory(id, chip) {
        STATE.categoryId = id;
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c === chip));
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
        el.innerHTML = '<div class="kh-spinner"></div>';
        const params = new URLSearchParams({ scope: STATE.scope, sort: STATE.feedSort });
        if (STATE.scope === 'local' && CTX.communityId) params.set('community_id', CTX.communityId);
        if (STATE.categoryId) params.set('category', STATE.categoryId);

        // load trending strips + main feed in parallel (only on homepage, no category filter)
        const [data, trendingData, hotData] = await Promise.all([
            khFetch(`${API}/feed?${params}`),
            !STATE.categoryId ? khFetch(`${API}/feed/trending?community_id=${CTX.communityId||''}&limit=8`) : Promise.resolve(null),
            !STATE.categoryId ? khFetch(`${API}/feed/hot-comments?community_id=${CTX.communityId||''}&limit=5`) : Promise.resolve(null),
        ]);

        const items = data.items || [];
        const sortBar = `<div class="feed-sort-bar">
            <button class="feed-sort-btn ${STATE.feedSort==='trending'?'active':''}" onclick="KH.loadFeed('trending')">🔥 חמים</button>
            <button class="feed-sort-btn ${STATE.feedSort==='new'?'active':''}" onclick="KH.loadFeed('new')">🆕 חדשים</button>
        </div>`;

        let strips = '';
        if (trendingData && (trendingData.items||[]).length) {
            strips += `<div class="kh-strip">
                <div class="kh-strip-title">🔥 הכי חמים עכשיו</div>
                <div class="kh-strip-scroll">${(trendingData.items||[]).map(it => `
                    <div class="kh-strip-card" onclick="KH.nav('content',{id:${it.id}})">
                        ${it.cover_image_url ? `<img class="kh-strip-img" src="${it.cover_image_url}" alt="">` : `<div class="kh-strip-img">${TYPE_ICONS[it.content_type]||'📄'}</div>`}
                        <div class="kh-strip-title-sm">${esc(it.title)}</div>
                        <div class="kh-strip-meta">👍${it.likes_count||0} 💬${it.comments_count||0}</div>
                    </div>`).join('')}
                </div>
            </div>`;
        }
        if (hotData && (hotData.items||[]).length) {
            strips += `<div class="kh-strip">
                <div class="kh-strip-title">💬 התגובות החמות</div>
                <div class="kh-strip-scroll">${(hotData.items||[]).map(it => `
                    <div class="kh-strip-card" onclick="KH.nav('content',{id:${it.id}})">
                        ${it.cover_image_url ? `<img class="kh-strip-img" src="${it.cover_image_url}" alt="">` : `<div class="kh-strip-img">💬</div>`}
                        <div class="kh-strip-title-sm">${esc(it.title)}</div>
                        <div class="kh-strip-meta">💬 ${it.recent_comments} ב-6 שעות</div>
                    </div>`).join('')}
                </div>
            </div>`;
        }

        if (!items.length && !strips) {
            el.innerHTML = sortBar + '<div class="empty-state"><div class="ei">📭</div><p>אין תוכן עדיין בקטגוריה זו</p></div>';
            return;
        }
        el.innerHTML = sortBar + strips + `<div class="feed-grid">${items.map(it => KH.renderFeedCard(it)).join('')}</div>`;
    },

    renderFeedCard(it) {
        const img = it.cover_image_url
            ? `<img class="feed-card-img" src="${it.cover_image_url}" alt="" loading="lazy">`
            : `<div class="feed-card-img">${TYPE_ICONS[it.content_type] || '📄'}</div>`;
        const pin = it.is_pinned_global ? '<span class="pin-badge">📌 מוצמד</span>' : it.is_pinned_local ? '<span class="pin-badge">📌</span>' : '';
        const engagement = `<span>👍 ${it.likes_count||0}</span><span>💬 ${it.comments_count||0}</span>`;
        return `<div class="feed-card" onclick="KH.nav('content',{id:${it.id}})">
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
                    <span>🏘️ ${esc(it.community_name)}</span>
                    <span>⏱ ${it.reading_time_minutes} דק'</span>
                    ${engagement}
                    <span>${fmtDate(it.published_at)}</span>
                </div>
            </div>
        </div>`;
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
        const tagsHtml = tags.length ? `<div class="content-tags">${tags.map(t => `<span class="tag-chip">#${esc(t)}</span>`).join('')}</div>` : '';
        const seriesNav = (it.prev_chapter_id || it.next_chapter_id) ? `
            <div class="series-nav">
                ${it.prev_chapter_id ? `<button class="series-nav-btn" onclick="KH.nav('content',{id:${it.prev_chapter_id}})">← פרק קודם: ${esc(it.prev_chapter_title||'')}</button>` : '<div></div>'}
                ${it.next_chapter_id ? `<button class="series-nav-btn" onclick="KH.nav('content',{id:${it.next_chapter_id}})">פרק הבא: ${esc(it.next_chapter_title||'')} →</button>` : '<div></div>'}
            </div>` : '';
        const isOwner = String(it.author_group_id) === String(CTX.groupId);
        const editBtn = isOwner && ['DRAFT','REJECTED'].includes(it.status) ? `<button class="kh-btn kh-btn-outline kh-btn-sm" onclick="KH.nav('editor',{itemId:${it.id}})"><i class="fa-solid fa-pen"></i> ערוך</button>` : '';
        const deleteBtn = isOwner && it.status !== 'DRAFT' && !it.deletion_requested ? `<button class="kh-btn kh-btn-danger kh-btn-sm" onclick="KH.requestDeletion(${it.id})"><i class="fa-solid fa-flag"></i> בקש מחיקה</button>` : '';

        const engBar = `<div class="engagement-bar" id="eng-bar-${id}">
            <button class="eng-btn ${userState.reaction==='LIKE'?'eng-active':''}" id="btn-like-${id}" onclick="KH.react(${id},'LIKE')">
                👍 <span id="like-count-${id}">${it.likes_count||0}</span>
            </button>
            <button class="eng-btn ${userState.reaction==='DISLIKE'?'eng-active eng-dislike':''}" id="btn-dislike-${id}" onclick="KH.react(${id},'DISLIKE')">
                👎 <span id="dislike-count-${id}">${it.dislikes_count||0}</span>
            </button>
            <button class="eng-btn ${userState.saved?'eng-active':''}" id="btn-save-${id}" onclick="KH.toggleSave(${id})">
                ⭐ <span id="save-count-${id}">${it.saves_count||0}</span>
            </button>
            <button class="eng-btn" onclick="KH.share(${id},'${esc(it.title).replace(/'/g,"\\'")}')">
                📤 שיתוף
            </button>
            <button class="eng-btn" onclick="document.getElementById('comments-section').scrollIntoView({behavior:'smooth'})">
                💬 <span>${it.comments_count||0}</span>
            </button>
            <button class="eng-btn" onclick="KH.openReport(${id}, null)">⚠️</button>
        </div>`;

        document.getElementById('content-inner').innerHTML = `
            ${it.cover_image_url ? `<img class="content-cover" src="${it.cover_image_url}" alt="">` : ''}
            <div class="content-category-label">${esc(it.category_title)} ${it.scope_type === 'GLOBAL' ? '🌍' : '🏠'}</div>
            <h1 class="content-title">${esc(it.title)}</h1>
            ${it.subtitle ? `<p class="content-subtitle">${esc(it.subtitle)}</p>` : ''}
            <div class="content-byline">
                <span>✍️ <strong>${esc(it.author_name)}</strong></span>
                <span>🏘️ ${esc(it.community_name)}</span>
                <span>📅 ${fmtDate(it.published_at)}</span>
                ${it.updated_at ? `<span>עודכן: ${fmtDate(it.updated_at)}</span>` : ''}
                <span>⏱ ${it.reading_time_minutes} דק' קריאה</span>
            </div>
            <div style="display:flex;gap:.5rem;margin-bottom:.5rem">${editBtn}${deleteBtn}</div>
            ${engBar}
            <div class="content-html">${it.content_html}</div>
            ${tagsHtml}
            ${seriesNav}
            ${it.comments_enabled !== false ? `<div id="comments-section" class="comments-section"></div>` : '<p style="color:var(--muted2);text-align:center;margin:1rem 0">התגובות מושבתות לפריט זה</p>'}
        `;

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
            location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
        }
    },

    // ── Comments ─────────────────────────────────────────────
    async loadComments(contentId, contentType, sort = 'top') {
        const section = document.getElementById('comments-section');
        if (!section) return;
        section.innerHTML = '<div class="kh-spinner"></div>';
        const data = await khFetch(`${API}/content/${contentId}/comments?sort=${sort}&user_id=${CTX.userId||''}`);
        const comments = data.comments || [];

        const sortBar = `<div class="comments-sort-bar">
            <button class="csort-btn ${sort==='top'?'active':''}" onclick="KH.loadComments(${contentId},'${contentType}','top')">הכי אהובות</button>
            <button class="csort-btn ${sort==='new'?'active':''}" onclick="KH.loadComments(${contentId},'${contentType}','new')">חדשות</button>
            <button class="csort-btn ${sort==='author'?'active':''}" onclick="KH.loadComments(${contentId},'${contentType}','author')">הכותב</button>
            <button class="csort-btn ${sort==='management'?'active':''}" onclick="KH.loadComments(${contentId},'${contentType}','management')">הנהלה</button>
        </div>`;

        const addForm = `<div class="comment-add-form">
            <textarea id="new-comment-text" class="comment-input" placeholder="הוסף תגובה..." rows="2"></textarea>
            <button class="kh-btn kh-btn-primary" onclick="KH.addComment(${contentId}, null)">שלח</button>
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
            <h3 class="comments-title">💬 תגובות (${comments.length})</h3>
            ${addForm}
            ${sortBar}
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
        const data = await khFetch(`${API}/my-saved?user_id=${CTX.userId}`);
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

            <!-- כפתורי פעולה -->
            <div class="editor-actions">
                <button class="kh-btn kh-btn-outline" onclick="KH.saveDraft()"><i class="fa-solid fa-floppy-disk"></i> שמור כטיוטה</button>
                <button class="kh-btn kh-btn-primary" onclick="KH.submitContent()"><i class="fa-solid fa-paper-plane"></i> שלח לאישור</button>
            </div>
        `;

        KH.renderTagChips();
        KH.onCategoryChange();
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
        };
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
        const d = await khFetch(`${API}/my-drafts?groupId=${CTX.groupId}&userId=${CTX.userId}`);
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
        const d = await khFetch(`${API}/my-content?groupId=${CTX.groupId}`);
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

// ── Init ──────────────────────────────────────────────────────
async function init() {
    // Community name
    if (CTX.communityName) document.getElementById('kh-community-name').textContent = decodeURIComponent(CTX.communityName);

    // Show ZM / SA buttons
    if (CTX.isZM) document.getElementById('btn-zm-queue').style.display = '';
    if (CTX.isSA) {
        document.getElementById('btn-sa-queue').style.display = '';
        document.getElementById('btn-zm-queue').style.display = ''; // SA can also see ZM queue
    }

    // Load categories for chips
    const d = await khFetch(`${API}/categories?community_id=${CTX.communityId || ''}`);
    STATE.categories = d.categories || [];
    const scroll = document.getElementById('cat-scroll');
    scroll.innerHTML = STATE.categories.map(c => `
        <button class="cat-chip" onclick="KH.setCategory(${c.id},this)">${esc(c.title)}</button>
    `).join('');

    // Load initial feed
    KH.loadFeed();

    // Handle postMessage from parent (support external nav)
    window.addEventListener('message', e => {
        if (e.data?.type === 'KH_NAV' && e.data.view) KH.nav(e.data.view, e.data.params || {});
    });
}

init();
