'use strict';
const AP = (() => {
    const API = '/api/kol-haam';
    let authorId = null;
    let allArticles = [];
    let filteredArticles = [];
    let currentFilter = 'all';
    let currentSort = 'new';
    let page = 0;
    const PAGE_SIZE = 8;

    // ── helpers ──────────────────────────────────────────────────────
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const fmtNum = n => {
        n = parseInt(n) || 0;
        if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n/1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
        return String(n);
    };
    const fmtDate = d => {
        if (!d) return '';
        const dt = new Date(d);
        return `${dt.getDate().toString().padStart(2,'0')}.${(dt.getMonth()+1).toString().padStart(2,'0')}.${String(dt.getFullYear()).slice(-2)}`;
    };

    const TYPE_LABELS = {
        ARTICLE: { label:'כתבת עומק', cls:'t-article' },
        WIKI_GUIDE: { label:'מדריך', cls:'t-guide' },
        SUCCESS_STORY: { label:'סיפור קהילה', cls:'t-story' },
        QA_QUESTION: { label:'שאלה', cls:'t-article' },
        INVESTIGATION: { label:'תחקיר נתונים', cls:'t-investigation' },
    };
    function typeInfo(t) {
        return TYPE_LABELS[t] || { label: t || 'כתבה', cls:'t-article' };
    }

    function toast(msg) {
        const el = document.getElementById('author-toast');
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 2500);
    }

    async function apiFetch(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    }

    // ── init ─────────────────────────────────────────────────────────
    async function init() {
        const params = new URLSearchParams(location.search);
        authorId = params.get('id');
        if (!authorId) {
            document.getElementById('author-card').innerHTML = '<div class="empty">מזהה כותב לא סופק</div>';
            return;
        }

        try {
            const [pd, cd] = await Promise.all([
                apiFetch(`${API}/authors/${authorId}`),
                apiFetch(`${API}/authors/${authorId}/content?limit=100`)
            ]);
            renderAuthorCard(pd);
            renderMetrics(pd);
            renderAchievements(pd.achievements || []);
            allArticles = cd.items || [];
            renderArticles();
        } catch(e) {
            document.getElementById('author-card').innerHTML = `<div class="empty">שגיאה בטעינה: ${esc(e.message)}</div>`;
        }
    }

    // ── cover ────────────────────────────────────────────────────────
    function renderCover(a) {
        const wrap = document.getElementById('cover-wrap');
        if (a.cover_image_url) {
            wrap.innerHTML = `<img src="${esc(a.cover_image_url)}" class="author-cover-img" alt="" onerror="this.style.display='none'">`;
        }
    }

    // ── author card ──────────────────────────────────────────────────
    function renderAuthorCard(pd) {
        const a = pd.author;
        renderCover(a);

        const name = a.display_name || a.family_name || 'כותב/ת';
        document.getElementById('page-title').textContent = name;

        const avatarHtml = a.avatar_url
            ? `<img src="${esc(a.avatar_url)}" class="author-avatar" alt="${esc(name)}" onerror="this.style.display='none';">`
            : `<div class="author-avatar-placeholder">👤</div>`;

        const badgeHtml = (a.badge_label || a.badge_level !== 'DEFAULT')
            ? `<div class="author-badge-chip">🏅 ${esc(a.badge_label || a.badge_level)}</div>`
            : '';

        const followLabel = pd.isFollowing ? '✓ עוקב/ת' : '+ עקוב';
        const followClass = pd.isFollowing ? 'following' : '';
        const followersN = parseInt(a.followers_count) || 0;

        const communityName = a.community_name ? `קהילת ${a.community_name}` : '';
        const joinedYear = a.created_at ? `כותב/ת מאז ${new Date(a.created_at).toLocaleString('he-IL', {month:'long', year:'numeric'})}` : '';
        const sections = a.sections ? `<div class="author-sections">${esc(a.sections)}</div>` : '';
        const bio = a.bio ? `<div class="author-bio">${esc(a.bio)}</div>` : '';

        document.getElementById('author-card').innerHTML = `
            <div class="author-avatar-row">
                ${avatarHtml}
                <div class="author-follow-row">
                    <button class="btn-follow ${followClass}" id="btn-follow" onclick="AP.toggleFollow()">${followLabel}</button>
                    <button class="btn-msg" title="שלח הודעה"><i class="fa-regular fa-envelope"></i></button>
                </div>
            </div>
            <div class="author-name">${esc(name)}</div>
            ${badgeHtml}
            <div class="author-meta-row">
                ${communityName ? `<span><i class="fa-solid fa-location-dot" style="color:var(--teal)"></i> ${esc(communityName)}</span>` : ''}
                ${joinedYear ? `<span><i class="fa-regular fa-calendar" style="color:var(--muted)"></i> ${esc(joinedYear)}</span>` : ''}
                <span><i class="fa-solid fa-users" style="color:var(--muted)"></i> ${fmtNum(followersN)} עוקבים</span>
            </div>
            ${sections}
            ${bio}
        `;
    }

    // ── metrics ──────────────────────────────────────────────────────
    function renderMetrics(pd) {
        const a = pd.author;
        const rep = parseInt(a.reputation_score) || 0;
        const pubs = parseInt(a.published_count) || 0;
        const views = parseInt(a.total_views) || 0;
        const comments = parseInt(a.total_comments) || 0;
        const frontPage = parseInt(a.front_page_count) || 0;
        const national = parseInt(a.national_count) || 0;

        document.getElementById('metrics-grid').innerHTML = `
            <div class="metric-card primary">
                <div class="metric-value">${fmtNum(rep)}</div>
                <div class="metric-label">ציון מוניטין</div>
                <div class="metric-sub">▲ מוביל בקהילה</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${pubs}</div>
                <div class="metric-label">כתבות שפורסמו</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${fmtNum(views)}</div>
                <div class="metric-label">סך צפיות</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${fmtNum(comments)}</div>
                <div class="metric-label">תגובות</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${frontPage}</div>
                <div class="metric-label">כניסות לכותרת ראשית</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${national}</div>
                <div class="metric-label">כתבות ארציות</div>
            </div>
        `;
        document.getElementById('metrics-section').style.display = '';
    }

    // ── achievements ─────────────────────────────────────────────────
    function renderAchievements(achievements) {
        if (!achievements.length) return;
        const earned = achievements.filter(a => a.earned);
        const locked = achievements.filter(a => !a.earned);
        document.getElementById('ach-count').textContent = `${earned.length} מתוך ${achievements.length} הושגו`;

        const html = [...earned, ...locked].map(a => `
            <div class="ach-item ${a.earned ? '' : 'locked'}" title="${esc(a.description || '')}">
                <div class="ach-icon">${esc(a.icon || '🏆')}</div>
                <div class="ach-name">${esc(a.title)}</div>
                ${a.earned && a.earned_at ? `<div class="ach-date">${fmtDate(a.earned_at)}</div>` : ''}
                ${!a.earned ? `<div class="ach-date" style="font-size:10px">🔒</div>` : ''}
            </div>
        `).join('');

        document.getElementById('ach-grid').innerHTML = html;
        document.getElementById('ach-section').style.display = '';
    }

    // ── articles ─────────────────────────────────────────────────────
    const FILTER_LABELS = {
        all: 'הכל',
        ARTICLE: 'כתבת עומק',
        WIKI_GUIDE: 'מדריך',
        SUCCESS_STORY: 'סיפור קהילה',
        QA_QUESTION: 'שאלה',
    };

    function renderArticles() {
        if (!allArticles.length) {
            document.getElementById('articles-section').style.display = '';
            document.getElementById('articles-list').innerHTML = '<div class="empty">אין כתבות עדיין</div>';
            return;
        }

        // build filter chips from available types
        const types = [...new Set(allArticles.map(a => a.content_type))];
        const chips = [{ key:'all', label:'הכל' }, ...types.map(t => ({ key:t, label:typeInfo(t).label }))];
        document.getElementById('filter-chips').innerHTML = chips.map(c =>
            `<button class="filter-chip ${c.key === currentFilter ? 'active' : ''}" onclick="AP.setFilter('${c.key}',this)">${esc(c.label)} ${c.key==='all' ? `(${allArticles.length})` : `(${allArticles.filter(a=>a.content_type===c.key).length})`}</button>`
        ).join('');

        applyFilterSort();
        document.getElementById('arts-count').textContent = `${allArticles.length} כתבות`;
        document.getElementById('articles-section').style.display = '';
    }

    function applyFilterSort() {
        let list = currentFilter === 'all' ? [...allArticles] : allArticles.filter(a => a.content_type === currentFilter);
        if (currentSort === 'views') {
            list.sort((a, b) => (parseInt(b.views_count) || 0) - (parseInt(a.views_count) || 0));
        } else {
            list.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        }
        filteredArticles = list;
        page = 0;
        renderPage(true);
    }

    function renderPage(reset) {
        const slice = filteredArticles.slice(0, (page + 1) * PAGE_SIZE);
        const el = document.getElementById('articles-list');
        el.innerHTML = slice.map(artHtml).join('');
        const hasMore = filteredArticles.length > slice.length;
        document.getElementById('btn-load-more').style.display = hasMore ? '' : 'none';
    }

    function artHtml(a) {
        const ti = typeInfo(a.content_type);
        const imgEl = a.cover_image_url
            ? `<img src="${esc(a.cover_image_url)}" class="art-card-img" alt="" onerror="this.parentNode.innerHTML='<div class=art-card-img-placeholder>📄</div>'">`
            : `<div class="art-card-img-placeholder">📄</div>`;
        const views = parseInt(a.views_count) || 0;
        const likes = parseInt(a.likes_count) || 0;
        const comments = parseInt(a.comments_count) || 0;

        return `
        <div class="art-card" onclick="AP.openArticle(${a.id})">
            ${imgEl}
            <div class="art-card-body">
                <span class="art-type-badge ${ti.cls}">${esc(ti.label)}</span>
                <div class="art-card-title">${esc(a.title)}</div>
                ${a.subtitle ? `<div class="art-card-sub">${esc(a.subtitle)}</div>` : ''}
                <div class="art-card-footer">
                    <span class="art-card-stat"><i class="fa-regular fa-eye"></i> ${fmtNum(views)}</span>
                    <span class="art-card-stat"><i class="fa-regular fa-heart"></i> ${fmtNum(likes)}</span>
                    <span class="art-card-stat"><i class="fa-regular fa-comment"></i> ${fmtNum(comments)}</span>
                    <span class="art-card-stat" style="margin-right:auto">${fmtDate(a.published_at)}</span>
                </div>
            </div>
        </div>`;
    }

    // ── public API ────────────────────────────────────────────────────
    return {
        setFilter(key, el) {
            currentFilter = key;
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            applyFilterSort();
        },
        setSort(key, el) {
            currentSort = key;
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            el.classList.add('active');
            applyFilterSort();
        },
        loadMore() {
            page++;
            renderPage(false);
        },
        openArticle(id) {
            // open in parent kol-haam iframe or new tab
            if (window.parent && window.parent.KH && window.parent.KH.nav) {
                window.parent.KH.nav('content', { id });
            } else {
                window.open(`/kol-haam.html?contentId=${id}`, '_blank');
            }
        },
        async toggleFollow() {
            const btn = document.getElementById('btn-follow');
            if (!btn) return;
            const isFollowing = btn.classList.contains('following');
            try {
                const r = await fetch(`${API}/authors/${authorId}/follow`, {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ groupId: '' })
                }).then(r => r.json());
                btn.classList.toggle('following', r.following);
                btn.textContent = r.following ? '✓ עוקב/ת' : '+ עקוב';
                toast(r.following ? 'עוקב/ת אחרי כותב/ת זה' : 'הפסקת לעקוב');
            } catch(e) {
                toast('שגיאה בעדכון עקיבה');
            }
        }
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    // call init via IIFE pattern
    (async () => {
        const API = '/api/kol-haam';
        const params = new URLSearchParams(location.search);
        const authorId = params.get('id');
        if (!authorId) {
            document.getElementById('author-card').innerHTML = '<div class="empty">מזהה כותב לא סופק ב-URL</div>';
            return;
        }

        const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const fmtNum = n => {
            n = parseInt(n) || 0;
            if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
            if (n >= 1000) return (n/1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
            return String(n);
        };
        const fmtDate = d => {
            if (!d) return '';
            const dt = new Date(d);
            return `${dt.getDate().toString().padStart(2,'0')}.${(dt.getMonth()+1).toString().padStart(2,'0')}.${String(dt.getFullYear()).slice(-2)}`;
        };
        const TYPE_LABELS = {
            ARTICLE:{ label:'כתבת עומק', cls:'t-article' },
            WIKI_GUIDE:{ label:'מדריך', cls:'t-guide' },
            SUCCESS_STORY:{ label:'סיפור קהילה', cls:'t-story' },
            QA_QUESTION:{ label:'שאלה', cls:'t-article' },
        };
        function typeInfo(t){ return TYPE_LABELS[t] || { label:'כתבה', cls:'t-article' }; }

        let allArticles = [], filteredArticles = [], currentFilter = 'all', currentSort = 'new', pg = 0;
        const PAGE_SIZE = 8;

        function toast(msg){
            const el = document.getElementById('author-toast');
            el.textContent = msg;
            el.classList.add('show');
            setTimeout(()=>el.classList.remove('show'),2500);
        }

        let pd, cd;
        try {
            [pd, cd] = await Promise.all([
                fetch(`${API}/authors/${authorId}`).then(r=>r.json()),
                fetch(`${API}/authors/${authorId}/content?limit=100`).then(r=>r.json())
            ]);
        } catch(e) {
            document.getElementById('author-card').innerHTML = `<div class="empty">שגיאה בטעינה: ${esc(e.message)}</div>`;
            return;
        }

        if (!pd.success || !pd.author) {
            document.getElementById('author-card').innerHTML = `<div class="empty">${esc(pd.error || 'כותב לא נמצא')}</div>`;
            return;
        }

        const a = pd.author;

        // cover
        if (a.cover_image_url) {
            document.getElementById('cover-wrap').innerHTML = `<img src="${esc(a.cover_image_url)}" class="author-cover-img" alt="" onerror="this.parentNode.innerHTML='<div class=author-cover-placeholder>📸</div>'">`;
        }

        // author card
        const name = a.display_name || a.family_name || 'כותב/ת';
        document.getElementById('page-title').textContent = name;
        const avatarHtml = a.avatar_url
            ? `<img src="${esc(a.avatar_url)}" class="author-avatar" alt="${esc(name)}" onerror="this.style.display='none'">`
            : `<div class="author-avatar-placeholder">👤</div>`;
        const badgeHtml = (a.badge_label || (a.badge_level && a.badge_level !== 'DEFAULT'))
            ? `<div class="author-badge-chip">🏅 ${esc(a.badge_label || a.badge_level)}</div>` : '';
        const communityName = a.community_name ? `קהילת ${a.community_name}` : '';
        const joinedText = a.created_at ? `כותב/ת מאז ${new Date(a.created_at).toLocaleString('he-IL',{month:'long',year:'numeric'})}` : '';
        const followersN = parseInt(a.followers_count) || 0;
        const followLabel = pd.isFollowing ? '✓ עוקב/ת' : '+ עקוב';
        const followCls = pd.isFollowing ? 'following' : '';

        document.getElementById('author-card').innerHTML = `
            <div class="author-avatar-row">
                ${avatarHtml}
                <div class="author-follow-row">
                    <button class="btn-follow ${followCls}" id="btn-follow">${followLabel}</button>
                    <button class="btn-msg" title="יצירת קשר"><i class="fa-regular fa-envelope"></i></button>
                </div>
            </div>
            <div class="author-name">${esc(name)}</div>
            ${badgeHtml}
            <div class="author-meta-row">
                ${communityName ? `<span><i class="fa-solid fa-location-dot" style="color:var(--teal)"></i> ${esc(communityName)}</span>` : ''}
                ${joinedText ? `<span><i class="fa-regular fa-calendar" style="color:var(--muted)"></i> ${esc(joinedText)}</span>` : ''}
                <span><i class="fa-solid fa-users" style="color:var(--muted)"></i> ${fmtNum(followersN)} עוקבים</span>
            </div>
            ${a.sections ? `<div class="author-sections">${esc(a.sections)}</div>` : ''}
            ${a.bio ? `<div class="author-bio">${esc(a.bio)}</div>` : ''}
        `;

        // follow button
        document.getElementById('btn-follow').addEventListener('click', async () => {
            const btn = document.getElementById('btn-follow');
            try {
                const r = await fetch(`${API}/authors/${authorId}/follow`,{
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ groupId: '' })
                }).then(r=>r.json());
                btn.classList.toggle('following', r.following);
                btn.textContent = r.following ? '✓ עוקב/ת' : '+ עקוב';
                toast(r.following ? 'עוקב/ת אחרי כותב/ת זה' : 'הפסקת לעקוב');
            } catch(e){ toast('שגיאה'); }
        });

        // metrics
        const rep = parseInt(a.reputation_score) || 0;
        const pubs = parseInt(a.published_count) || 0;
        const views = parseInt(a.total_views) || 0;
        const comments = parseInt(a.total_comments) || 0;
        const frontPage = parseInt(a.front_page_count) || 0;
        const national = parseInt(a.national_count) || 0;
        document.getElementById('metrics-grid').innerHTML = `
            <div class="metric-card primary">
                <div class="metric-value">${fmtNum(rep)}</div>
                <div class="metric-label">ציון מוניטין</div>
                <div class="metric-sub">▲ מוביל בקהילה</div>
            </div>
            <div class="metric-card"><div class="metric-value">${pubs}</div><div class="metric-label">כתבות שפורסמו</div></div>
            <div class="metric-card"><div class="metric-value">${fmtNum(views)}</div><div class="metric-label">סך צפיות</div></div>
            <div class="metric-card"><div class="metric-value">${fmtNum(comments)}</div><div class="metric-label">תגובות</div></div>
            <div class="metric-card"><div class="metric-value">${frontPage}</div><div class="metric-label">כניסות לכותרת ראשית</div></div>
            <div class="metric-card"><div class="metric-value">${national}</div><div class="metric-label">כתבות ארציות</div></div>
        `;
        document.getElementById('metrics-section').style.display = '';

        // achievements
        const achs = pd.achievements || [];
        if (achs.length) {
            const earned = achs.filter(x=>x.earned);
            document.getElementById('ach-count').textContent = `${earned.length} מתוך ${achs.length} הושגו`;
            document.getElementById('ach-grid').innerHTML = [...earned, ...achs.filter(x=>!x.earned)].map(x=>`
                <div class="ach-item ${x.earned?'':'locked'}" title="${esc(x.description||'')}">
                    <div class="ach-icon">${esc(x.icon||'🏆')}</div>
                    <div class="ach-name">${esc(x.title)}</div>
                    ${x.earned && x.earned_at ? `<div class="ach-date">${fmtDate(x.earned_at)}</div>` : ''}
                    ${!x.earned ? `<div class="ach-date">🔒</div>` : ''}
                </div>
            `).join('');
            document.getElementById('ach-section').style.display = '';
        }

        // articles
        allArticles = cd.items || [];
        document.getElementById('arts-count').textContent = `${allArticles.length} כתבות`;

        function buildFilterChips() {
            const types = [...new Set(allArticles.map(x=>x.content_type))];
            const chips = [{ key:'all', label:`הכל (${allArticles.length})` }, ...types.map(t=>({ key:t, label:`${typeInfo(t).label} (${allArticles.filter(x=>x.content_type===t).length})` }))];
            document.getElementById('filter-chips').innerHTML = chips.map(c=>
                `<button class="filter-chip ${c.key===currentFilter?'active':''}" data-filter="${c.key}">${esc(c.label)}</button>`
            ).join('');
            document.querySelectorAll('.filter-chip').forEach(btn=>{
                btn.addEventListener('click',()=>{
                    currentFilter = btn.dataset.filter;
                    document.querySelectorAll('.filter-chip').forEach(b=>b.classList.toggle('active',b===btn));
                    applySort();
                });
            });
        }

        function applySort() {
            let list = currentFilter==='all' ? [...allArticles] : allArticles.filter(x=>x.content_type===currentFilter);
            if (currentSort==='views') list.sort((a,b)=>(parseInt(b.views_count)||0)-(parseInt(a.views_count)||0));
            else list.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
            filteredArticles = list;
            pg = 0;
            renderPage();
        }

        function renderPage() {
            const slice = filteredArticles.slice(0, (pg+1)*PAGE_SIZE);
            document.getElementById('articles-list').innerHTML = slice.map(x=>{
                const ti = typeInfo(x.content_type);
                const imgEl = x.cover_image_url
                    ? `<img src="${esc(x.cover_image_url)}" class="art-card-img" alt="" onerror="this.parentNode.innerHTML='<div class=art-card-img-placeholder>📄</div>'">`
                    : `<div class="art-card-img-placeholder">📄</div>`;
                return `
                <div class="art-card" data-content-id="${x.id}">
                    ${imgEl}
                    <div class="art-card-body">
                        <span class="art-type-badge ${ti.cls}">${esc(ti.label)}</span>
                        <div class="art-card-title">${esc(x.title)}</div>
                        ${x.subtitle ? `<div class="art-card-sub">${esc(x.subtitle)}</div>` : ''}
                        <div class="art-card-footer">
                            <span class="art-card-stat"><i class="fa-regular fa-eye"></i> ${fmtNum(x.views_count)}</span>
                            <span class="art-card-stat"><i class="fa-regular fa-heart"></i> ${fmtNum(x.likes_count)}</span>
                            <span class="art-card-stat"><i class="fa-regular fa-comment"></i> ${fmtNum(x.comments_count)}</span>
                            <span class="art-card-stat" style="margin-right:auto">${fmtDate(x.published_at)}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
            document.getElementById('btn-load-more').style.display = filteredArticles.length > slice.length ? '' : 'none';

            document.querySelectorAll('.art-card').forEach(card=>{
                card.addEventListener('click',()=>{
                    const id = card.dataset.contentId;
                    if (window.parent && window.parent.KH && window.parent.KH.nav) {
                        window.parent.KH.nav('content',{id:parseInt(id)});
                    } else {
                        window.open(`/kol-haam.html?contentId=${id}`,'_blank');
                    }
                });
            });
        }

        // sort buttons
        document.getElementById('sort-new').addEventListener('click', function(){
            currentSort = 'new';
            document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
            this.classList.add('active');
            applySort();
        });
        document.getElementById('sort-views').addEventListener('click', function(){
            currentSort = 'views';
            document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
            this.classList.add('active');
            applySort();
        });
        document.getElementById('btn-load-more').addEventListener('click',()=>{ pg++; renderPage(); });

        buildFilterChips();
        applySort();
        document.getElementById('articles-section').style.display = '';
    })();
});
