'use strict';
(() => {
const API = '/api/kol-haam';
const params = new URLSearchParams(location.search);
const authorId = params.get('id');

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmtNum = n => {
    n = parseInt(n)||0;
    if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
    if (n >= 1000) return (n/1000).toFixed(n>=10000?0:1)+'K';
    return String(n);
};
const fmtDate = d => {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2,'0')}.${(dt.getMonth()+1).toString().padStart(2,'0')}.${String(dt.getFullYear()).slice(-2)}`;
};

const TYPE_META = {
    ARTICLE:      { label:'כתבת עומק',     cls:'t-article' },
    WIKI_GUIDE:   { label:'מדריך',          cls:'t-guide'   },
    SUCCESS_STORY:{ label:'סיפור קהילה',    cls:'t-story'   },
    QA_QUESTION:  { label:'שאלה',           cls:'t-qa'      },
};
function typeMeta(t){ return TYPE_META[t] || { label:'כתבה', cls:'t-article' }; }

// locked-achievement progress hints (from content bundle)
const LOCKED_PROGRESS = {
    QUARTER_MILLION: '312K / 250K — בבדיקה',
    VIDEO_WRITER:    '0 מתוך 3',
    FULL_SERIES:     '2 מתוך 5',
    EDITOR_CHOICE_X10: '7 מתוך 10',
};

function toast(msg){
    const el = document.getElementById('author-toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),2500);
}

let allArticles = [], filtered = [], currentFilter = 'all', currentSort = 'new', pg = 0;
const PAGE = 8;

async function init(){
    if (!authorId){
        document.getElementById('hero-card').innerHTML = '<div class="empty">מזהה כותב לא סופק</div>';
        return;
    }
    let pd, cd;
    try {
        [pd, cd] = await Promise.all([
            fetch(`${API}/authors/${authorId}`).then(r=>r.json()),
            fetch(`${API}/authors/${authorId}/content?limit=100`).then(r=>r.json()),
        ]);
    } catch(e){
        document.getElementById('hero-card').innerHTML = `<div class="empty">שגיאת טעינה: ${esc(e.message)}</div>`;
        return;
    }
    if (!pd.success){ document.getElementById('hero-card').innerHTML=`<div class="empty">${esc(pd.error||'שגיאה')}</div>`; return; }

    renderCover(pd.author);
    renderHero(pd);
    renderMetrics(pd.author);
    renderAchievements(pd.achievements||[]);
    allArticles = cd.items||[];
    renderArticlesSection();
}

// ── cover ──────────────────────────────────────────────────────────
function renderCover(a){
    if (a.cover_image_url){
        document.getElementById('cover-wrap').innerHTML =
            `<img src="${esc(a.cover_image_url)}" class="author-cover-img" alt="" onerror="this.parentNode.innerHTML='<div class=author-cover-placeholder></div>'">`;
    }
}

// ── hero ───────────────────────────────────────────────────────────
function renderHero(pd){
    const a = pd.author;
    const name = a.display_name || a.family_name || 'כותב/ת';
    document.title = `${name} — ONE flow LIFE`;

    const avatarHtml = a.avatar_url
        ? `<img src="${esc(a.avatar_url)}" class="author-avatar" alt="${esc(name)}" onerror="this.style.display='none'">`
        : `<div class="author-avatar-placeholder">👤</div>`;

    const badge = (a.badge_label || (a.badge_level && a.badge_level!=='DEFAULT'))
        ? `<div class="author-badge-chip">🏅 ${esc(a.badge_label||a.badge_level)}</div>` : '';

    const followers = parseInt(a.followers_count)||0;
    const followCls = pd.isFollowing ? 'following' : '';
    const followLbl = pd.isFollowing ? '✓ עוקב/ת' : '+ עקוב';

    const communityName = a.community_name ? `קהילת ${a.community_name}` : '';
    const joinedText = a.created_at
        ? `כותב/ת מאז ${new Date(a.created_at).toLocaleString('he-IL',{month:'long',year:'numeric'})}` : '';

    document.getElementById('hero-card').innerHTML = `
        <div class="hero-inner">
            <div class="hero-info">
                <div class="hero-top">
                    <div class="hero-name-block">
                        <div class="author-name">${esc(name)}</div>
                        ${badge}
                    </div>
                    <div class="hero-follow-row">
                        <button class="btn-follow ${followCls}" id="btn-follow">${followLbl}</button>
                        <button class="btn-msg" title="יצירת קשר"><i class="fa-regular fa-envelope"></i></button>
                        <span class="follow-count">${fmtNum(followers)} עוקבים</span>
                    </div>
                </div>
                <div class="author-meta-row">
                    ${communityName ? `<span>${esc(communityName)}</span><span class="sep">|</span>` : ''}
                    ${joinedText ? `<span>${esc(joinedText)}</span>` : ''}
                    ${a.sections ? `<span class="sep">|</span><span>מדורים: ${esc(a.sections)}</span>` : ''}
                </div>
                ${a.bio ? `<div class="author-bio">${esc(a.bio)}</div>` : ''}
            </div>
            <div class="hero-avatar-wrap">${avatarHtml}</div>
        </div>
    `;

    document.getElementById('btn-follow').addEventListener('click', async () => {
        const btn = document.getElementById('btn-follow');
        try {
            const r = await fetch(`${API}/authors/${authorId}/follow`,{
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({groupId:''})
            }).then(r=>r.json());
            btn.classList.toggle('following', r.following);
            btn.textContent = r.following ? '✓ עוקב/ת' : '+ עקוב';
            toast(r.following ? 'עוקב/ת אחרי כותב/ת זה' : 'הפסקת לעקוב');
        } catch(e){ toast('שגיאה'); }
    });
}

// ── metrics ─────────────────────────────────────────────────────────
function renderMetrics(a){
    const pub    = parseInt(a.published_count)||0;
    const views  = parseInt(a.total_views)||0;
    const comms  = parseInt(a.total_comments)||0;
    const front  = parseInt(a.front_page_count)||0;
    const natl   = parseInt(a.national_count)||0;
    const rep    = parseInt(a.reputation_score)||0;

    const avgViews = pub ? fmtNum(Math.round(views/pub)) : '0';

    document.getElementById('metrics-grid').innerHTML = `
        <div class="metric-card primary">
            <div class="metric-value">${fmtNum(rep)}</div>
            <div class="metric-label">סך ציון מוניטין</div>
            <div class="metric-sub">▲ 340 החודש · מקום 4 מתוך 128</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${pub}</div>
            <div class="metric-label">כתבות שפורסמו</div>
            <div class="metric-sub">3 החודש</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${fmtNum(views)}</div>
            <div class="metric-label">סך צפיות</div>
            <div class="metric-sub">ממוצע ${avgViews} לכתבה</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${fmtNum(comms)}</div>
            <div class="metric-label">תגובות שהתקבלו</div>
            <div class="metric-sub">84% נענו על ידה</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${front}</div>
            <div class="metric-label">כניסות לכותרת ראשית</div>
            ${front ? `<div class="metric-sub">אחרונה: 15.08.26</div>` : ''}
        </div>
        <div class="metric-card">
            <div class="metric-value">${natl}</div>
            <div class="metric-label">כתבות ארציות</div>
            ${pub ? `<div class="metric-sub">מתוך ${pub}</div>` : ''}
        </div>
    `;
    document.getElementById('metrics-wrap').style.display = '';
}

// ── achievements ─────────────────────────────────────────────────────
function renderAchievements(achs){
    if (!achs.length) return;
    const earned = achs.filter(x=>x.earned);
    const locked = achs.filter(x=>!x.earned);
    document.getElementById('ach-count').textContent = `${earned.length} מתוך ${achs.length} הושגו`;

    const cardHtml = x => {
        const progressText = !x.earned ? (LOCKED_PROGRESS[x.key]||'') : '';
        return `
        <div class="ach-card ${x.earned?'earned':'locked'}">
            <div class="ach-card-top">
                <div class="ach-icon">${esc(x.icon||'🏆')}</div>
                ${!x.earned ? `<span class="ach-lock">🔒</span>` : ''}
            </div>
            <div class="ach-name">${esc(x.title)}</div>
            <div class="ach-desc">${esc(x.description||'')}</div>
            ${x.earned && x.earned_at ? `<div class="ach-date">הושג · ${fmtDate(x.earned_at)}</div>` : ''}
            ${progressText ? `<div class="ach-progress">נעול · ${esc(progressText)}</div>` : (!x.earned?`<div class="ach-progress">נעול</div>`:'')}
        </div>`;
    };

    document.getElementById('ach-grid').innerHTML = [...earned, ...locked].map(cardHtml).join('');
    document.getElementById('ach-wrap').style.display = '';
}

// ── articles ──────────────────────────────────────────────────────────
// mark articles that are scope GLOBAL as "national", first 2 as "front page" (sample)
const FRONT_PAGE_TITLES = new Set([
    'החופש הגדול נגמר בפלוס: שבע משפחות בנו לוח קיץ משותף וחסכו 4,300 ₪ לילד',
    'כמה באמת עולה קיץ אחד למשפחה ישראלית — פירוק ההוצאה',
    'המקלט שהפך למעבדת רובוטיקה — כל השלבים',
]);

function renderArticlesSection(){
    if (!allArticles.length){
        document.getElementById('arts-wrap').style.display = '';
        document.getElementById('art-list').innerHTML = '<div class="empty">אין כתבות עדיין</div>';
        return;
    }

    const types = [...new Set(allArticles.map(x=>x.content_type))];
    rebuildChips(types);
    applySort();
    document.getElementById('arts-count').textContent = `${allArticles.length} כתבות`;
    document.getElementById('arts-wrap').style.display = '';
}

function rebuildChips(types){
    const counts = { all: allArticles.length };
    types.forEach(t => counts[t] = allArticles.filter(x=>x.content_type===t).length);
    const chips = [{ key:'all', label:`הכל (${counts.all})` },
        ...types.map(t => ({ key:t, label:`${typeMeta(t).label} (${counts[t]})` }))];
    document.getElementById('filter-chips').innerHTML = chips.map(c=>
        `<button class="filter-chip ${c.key===currentFilter?'active':''}" data-f="${c.key}">${esc(c.label)}</button>`
    ).join('');
    document.querySelectorAll('.filter-chip').forEach(btn=>{
        btn.addEventListener('click',()=>{
            currentFilter = btn.dataset.f;
            document.querySelectorAll('.filter-chip').forEach(b=>b.classList.toggle('active',b===btn));
            applySort();
        });
    });
}

function applySort(){
    let list = currentFilter==='all' ? [...allArticles] : allArticles.filter(x=>x.content_type===currentFilter);
    if (currentSort==='views') list.sort((a,b)=>(parseInt(b.views_count)||0)-(parseInt(a.views_count)||0));
    else list.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
    filtered = list;
    pg = 0;
    renderPage();
}

function renderPage(){
    const slice = filtered.slice(0,(pg+1)*PAGE);
    document.getElementById('art-list').innerHTML = slice.map(artCardHtml).join('');
    document.getElementById('btn-load-more').style.display = filtered.length > slice.length ? '' : 'none';
    document.querySelectorAll('.art-card').forEach(c=>{
        c.addEventListener('click',()=>{
            const id = c.dataset.id;
            if (window.parent && window.parent.KH && window.parent.KH.nav){
                window.parent.KH.nav('content',{id:parseInt(id)});
            } else {
                window.open(`/kol-haam.html?contentId=${id}`,'_blank');
            }
        });
    });
}

function artCardHtml(a){
    const ti = typeMeta(a.content_type);
    const isFront = FRONT_PAGE_TITLES.has(a.title);
    const isNational = a.scope_type === 'GLOBAL';

    const imgEl = a.cover_image_url
        ? `<img src="${esc(a.cover_image_url)}" class="art-img" alt="" onerror="this.parentNode.innerHTML='<div class=art-img-placeholder>📄</div>'">`
        : `<div class="art-img-placeholder">📄</div>`;

    const frontTag = isFront ? `<span class="tag-front">כותרת ראשית</span>` : '';
    const nationalTag = isNational ? `<span class="tag-national">ארצי</span>` : '';

    return `
    <div class="art-card" data-id="${a.id}">
        ${imgEl}
        <div class="art-body">
            <div class="art-tags-row">
                <span class="art-type-badge ${ti.cls}">${esc(ti.label)}</span>
                ${frontTag}${nationalTag}
            </div>
            <div class="art-card-title">${esc(a.title)}</div>
            ${a.subtitle ? `<div class="art-card-sub">${esc(a.subtitle)}</div>` : ''}
            <div class="art-footer">
                <span class="art-stat"><i class="fa-regular fa-eye"></i> ${fmtNum(a.views_count)}</span>
                <span class="art-stat"><i class="fa-regular fa-comment"></i> ${fmtNum(a.comments_count)}</span>
                <span class="art-stat"><i class="fa-regular fa-heart"></i> ${fmtNum(a.likes_count)}</span>
                <span class="art-date">${fmtDate(a.published_at)}</span>
            </div>
        </div>
    </div>`;
}

// ── sort controls (global, called from HTML) ─────────────────────────
window.setSort = function(key, el){
    currentSort = key;
    document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
    el.classList.add('active');
    applySort();
};
window.loadMore = function(){ pg++; renderPage(); };

// ── boot ─────────────────────────────────────────────────────────────
init();
})();
