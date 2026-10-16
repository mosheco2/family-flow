import json,re,html,collections,os
E=lambda s: html.escape(str(s),quote=True)
api=json.load(open('api.json')); _cc=json.load(open('client_calls.json')); CALLERS=collections.defaultdict(list)
for _c in _cc:
    if _c['route']: CALLERS[_c['route']].append(_c)
schema=json.load(open('schema.json')); STATES=json.load(open('states.json')); funcs=json.load(open('funcs.json'))
src=open('/home/user/family-flow/server.js',encoding='utf-8').read()
BUCKETS=[
 ('api-sa','Super Admin ותשתית',{'sa','superadmin','admin','setup-db','force-upgrade','test-email','debug','system','guide-config','health','qa','support','tickets','pilot-waitlist','guide'}),
 ('api-kolhaam','קול העם',{'kol-haam','kol-haam-author'}),
 ('api-community','קהילה, מנהל אזור ומשחקים',{'community','communities','zone-manager','zm','live-games','quest-library','c','campaign',':alias','game'}),
 ('api-store','חנות, מסעדה ותפריטים',{'store','storefront','public','branding','page-images','marketplace','menu','menus','menu-templates','menu-sections','menu-items','menu-quote-requests','restaurant','tables','food-cost','recipes','init-promotions','banners','ads','track','upload'}),
 ('api-verticals','ורטיקלים: ספורט, יופי, לוגיסטיקה, תחזוקה, מקצועי',{'sport','beauty','logistics','work-orders','equipment','service-calls','sc-auth','professional','professional-documents','professional-expertise','professional-articles','professional-leads','professional-doc-types','professional-content','calendar'}),
 ('api-biz','ליבת עסק',{'biz','b2b','suppliers','alerts','sla','tasks','reports','forecast','ai','settings','timeclock','timelog','shift-templates','academy','surveys','team-posts','inbox','messages','chat','init-procurement','biz-visibility','clients','activity'}),
 ('api-family','משפחה, משתמשים וזהות',None),
]
def seg(p): return p.split('/')[2] if p.startswith('/api/') else (p.split('/')[1] or '/')
def bucket(p):
    s=seg(p)
    for k,t,st in BUCKETS:
        if st and s in st: return k
    return 'api-family'
PAGES=[('index','סקירת המפרט')]+[('tobe-index','אפיון יעד · סקירה'),('tobe-arch','יעד · ארכיטקטורה'),('tobe-auth','יעד · אימות'),('tobe-family','יעד · משפחה'),('tobe-biz','יעד · עסק'),('tobe-routines','יעד · שגרות'),('tobe-store','יעד · חנות'),('tobe-restaurant','יעד · מסעדה'),('tobe-sport','יעד · ספורט'),('tobe-beauty','יעד · יופי'),('tobe-logistics','יעד · לוגיסטיקה'),('tobe-services','יעד · תחזוקה ומקצועי'),('tobe-community','יעד · קהילה'),('tobe-kolhaam','יעד · קול העם'),('tobe-sa','יעד · SA'),('tobe-routes','יעד · מפת נתיבים'),('tobe-reconcile','יעד · יישוב סתירות'),('tobe-journeys','יעד · מסעות משתמש')]+[('s1-glossary','מילון מונחים'),('s1-rbac','מטריצת הרשאות'),('s1-bizmatrix','מודולים × סוג עסק'),('s1-erd','מודל ישויות (ERD)'),('s1-messages','קטלוג הודעות'),('s1-prompts','קטלוג פרומפטים AI'),('s1-seed','נתוני ברירת מחדל'),('s1-docsvscode','מסמכים קיימים מול קוד')]+[(k,t) for k,t,_ in BUCKETS]+[('ui-biz','מסכים · עסק'),('ui-family','מסכים · משפחה'),('ui-sa','מסכים · SA'),('ui-other','מסכים · שאר')]+[('rules-auth','לוגיקה · אימות'),('rules-family','לוגיקה · משפחה'),('rules-biz','לוגיקה · עסק'),('rules-store','לוגיקה · חנות'),('rules-restaurant','לוגיקה · מסעדה'),('rules-sport','לוגיקה · ספורט'),('rules-beauty','לוגיקה · יופי'),('rules-logistics','לוגיקה · לוגיסטיקה'),('rules-services','לוגיקה · תחזוקה ומקצועי'),('rules-community','לוגיקה · קהילה'),('rules-kolhaam','לוגיקה · קול העם'),('rules-routines','לוגיקה · שגרות'),('rules-sa','לוגיקה · SA')]+[('db','מילון נתונים'),('functions','פונקציות עזר'),('ops','תפעול ותשתית')]
def shell(key,title,meta,content,extra_js=''):
    nav=''.join(f'<a href="{k}.html" class="{"cur" if k==key else ""}">{E(t)}</a>' for k,t in PAGES)
    return f'''<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="claude:viewport-fit-sides" content="cover"><title>{E(title)} · מפרט</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&family=Fira+Code:wght@400;500;700&display=swap"><link rel="stylesheet" href="spec.css"></head><body><div class="wrap">
<header class="top"><a class="back" href="../index.html">→ למסמך הראשי</a><h1>{E(title)}</h1><span class="meta">{meta}</span><input id="q" type="search" placeholder="סינון: נתיב, טבלה, שדה, טקסט…" aria-label="סינון"><span class="count" id="cnt"></span></header>
<nav class="specnav">{nav}</nav>
{content}
</div><script>
(function(){{var q=document.getElementById('q'),cnt=document.getElementById('cnt');var items=[].slice.call(document.querySelectorAll('[data-f]'));
function run(){{var v=q.value.trim().toLowerCase(),n=0;items.forEach(function(el){{var hit=!v||el.getAttribute('data-f').indexOf(v)>-1||el.textContent.toLowerCase().indexOf(v)>-1;el.classList.toggle('hidden',!hit);if(hit)n++;}});
document.querySelectorAll('h2.grp').forEach(function(h){{var g=h.nextElementSibling,any=false;while(g&&!g.matches('h2.grp')){{if(g.hasAttribute('data-f')&&!g.classList.contains('hidden'))any=true;g=g.nextElementSibling;}}h.classList.toggle('hidden',!any);}});
cnt.textContent=n+' / '+items.length;}}
q.addEventListener('input',run);run();{extra_js}}})();
</script></body></html>'''
MWNOTE={'verifyBizOrLegacy':'warn','requireModule':'warn','verifyZoneManager':'warn'}
def route_card(r):
    tags=[]
    if not r['mw']: tags.append('<span class="tag bad">ללא middleware</span>')
    for m in r['mw']:
        cls='warn' if any(m.startswith(k) for k in MWNOTE) else 'ok'
        tags.append(f'<span class="tag {cls}">{E(m)}</span>')
    if r['shadowed_by']: tags.append(f'<span class="tag bad">מוצל ע״י שורה {r["shadowed_by"]} — לא רץ</span>')
    if r['pooltx']: tags.append('<span class="tag bad">pool.query(BEGIN)</span>')
    elif r['tx']: tags.append('<span class="tag">טרנזקציה</span>')
    if r['ai']: tags.append('<span class="tag warn">AI</span>')
    if r['files']: tags.append('<span class="tag">קבצים</span>')
    kv=[]
    def row(k,v):
        if v: kv.append(f'<div>{k}</div><div>{v}</div>')
    chips=lambda xs: '<div class="chips">'+''.join(f'<code>{E(x)}</code>' for x in xs)+'</div>' if xs else ''
    row('שורות בקוד',f'<span class="code">server.js:{r["line"]}–{r["end"]}</span>')
    row('Path params',chips(r['params'])); row('Query',chips(r['query'])); row('Body',chips(r['body'])); row('Headers',chips(r['headers']))
    row('פונקציות עזר',chips(r['calls']))
    cl=CALLERS.get(r['method']+' '+r['path'],[])
    if cl:
        seen_=[]
        for c in cl:
            t=f"{c['file']}:{c['line']} · {c['func']}()"
            if t not in seen_: seen_.append(t)
        row('נקרא מהלקוח',chips(seen_[:25])+(f'<span class=count>+{len(seen_)-25}</span>' if len(seen_)>25 else ''))
    elif not r['shadowed_by']: row('נקרא מהלקוח','<span class="tag warn">לא נמצאה קריאה בקבצי הלקוח שנסרקו</span>')
    if r['errors']: row('שגיאות','<div class="tbl-wrap"><table>'+''.join(f'<tr><td class="c" style="width:48px">{E(c)}</td><td class="c">{E(m)}</td></tr>' for c,m in r['errors'])+'</table></div>')
    if r['responses']: row('תשובה (200)','<div class="sqls">'+''.join(f'<pre class="sql">{E(x)}</pre>' for x in r['responses'])+'</div>')
    if r['sql']: row(f'SQL ({len(r["sql"])})','<div class="sqls">'+''.join(f'<pre class="sql">{E(x)}</pre>' for x in r['sql'])+'</div>')
    f=' '.join([r['method'],r['path'],*r['mw'],*r['body'],*r['query']]).lower()
    return f'<details class="card" id="r{r["line"]}" data-f="{E(f)}"><summary><span class="m {r["method"]}">{r["method"]}</span><span class="p">{E(r["path"])}</span><span class="ln">:{r["line"]}</span>{"".join(tags)}</summary><div class="body"><div class="kv">{"".join(kv)}</div></div></details>'
os.makedirs('out',exist_ok=True)
by=collections.defaultdict(list)
for r in api: by[bucket(r['path'])].append(r)
INTRO_API='<div class="intro">כל כרטיס חולץ <strong>מכנית מהקוד</strong> (server.js): ה-middleware שמופיע ברישום, פרמטרי path, שדות <code>req.query</code>/<code>req.body</code>/<code>req.headers</code>, קודי שגיאה עם ההודעה המילולית, צורת ה-<code>res.json</code> בהצלחה, כל שאילתות ה-SQL שבגוף ה-handler (כולל placeholders), ופונקציות העזר שהוא קורא להן. "ללא middleware" פירושו שאין middleware ברישום. ייתכן שיש בדיקה inline בתוך ה-handler; התיאור המילולי של כל נתיב נמצא בסעיפים במסמך הראשי. "מוצל" פירושו שאותו method+path נרשם קודם, ולכן Express לא מגיע ל-handler הזה.</div>'
for k,t,_ in BUCKETS:
    rs=sorted(by[k],key=lambda r:(seg(r['path']),r['line']))
    groups=collections.OrderedDict()
    for r in rs: groups.setdefault(seg(r['path']),[]).append(r)
    content=INTRO_API+''.join(f'<h2 class="grp"><code>/{E(g)}</code> · {len(v)} נתיבים</h2>'+''.join(route_card(r) for r in v) for g,v in sorted(groups.items(),key=lambda x:-len(x[1])))
    nomw=sum(1 for r in rs if not r['mw'])
    open(f'out/{k}.html','w',encoding='utf-8').write(shell(k,f'API · {t}',f'{len(rs)} נתיבים · {nomw} ללא middleware',content))
# ---- DB ----
tab_routes=collections.defaultdict(list)
for r in api:
    ts=set()
    for q in r['sql']:
        ts|=set(x.lower() for x in re.findall(r'\b(?:FROM|JOIN|INTO|UPDATE|TABLE(?: IF NOT EXISTS)?|DELETE FROM)\s+([a-z_][a-z0-9_]+)',q,re.I))
    for x in ts: tab_routes[x].append(r)
missing=['cashflow_entries','content_item_tags','employees','group_notifications','membership_plan_types','zone_manager_sessions']
def domain_of(name):
    for pre,lab in [('kh_','קול העם'),('content_','קול העם'),('author_','קול העם'),('sa_','Super Admin'),('store_','חנות'),('sport_','ספורט'),('beauty_','יופי'),('logistics_','לוגיסטיקה'),('community','קהילה'),('zone_','מנהל אזור'),('routine','שגרות'),('menu','תפריטים'),('restaurant','מסעדה'),('professional','מקצועי'),('service_call','קריאות שירות'),('work_order','תחזוקה'),('whatsapp','WhatsApp'),('banner','באנרים'),('live_game','משחקים'),('kids','ילדים'),('family','משפחה'),('biz_','עסק'),('business','עסק'),('timeclock','שעון נוכחות'),('equipment','ציוד'),('pool','Pools'),('academy','אקדמיה'),('survey','סקרים'),('shopping','קניות'),('pantry','מזווה'),('flow','FLW')]:
        if name.startswith(pre) or pre in name: return lab
    return 'כללי'
rows=[]
dgroups=collections.defaultdict(list)
for n,t in schema.items():
    if not re.match(r'^[a-z_][a-z0-9_]*$',n): continue
    dgroups[domain_of(n)].append(n)
def tcard(n):
    t=schema[n]
    cols=''.join(f'<tr><td class="c">{E(c)}</td><td class="c">{E(v[0])}</td><td class="ln">{v[1]}{" · ALTER" if v[2]=="alter" else ""}</td></tr>' for c,v in t['cols'].items())
    cons=''.join(f'<pre class="sql">{E(c)}</pre>' for c in t['constraints'])
    idx=''.join(f'<pre class="sql">{"UNIQUE " if u else ""}INDEX {E(i)} {E(cols_)}  -- :{l}</pre>' for i,u,cols_,l in t.get('indexes',[]))
    alt=''.join(f'<pre class="sql">:{l}  {E(a)}</pre>' for l,a in t['alters'])
    rts=tab_routes.get(n,[])
    sth=''
    for col,d in STATES.get(n,{}).items():
        tr=''.join(f'<tr><td class="c">{E(a)}</td><td class="c">→ {E(b)}</td><td class="ln">×{k}</td></tr>' for a,b,k in d['trans'])
        sth+=f'<div><div class="count">מצבים · <code>{E(col)}</code>{" · ברירת מחדל <code>"+E(d["default"])+"</code>" if d["default"] else ""}</div><div class="chips">'+''.join(f'<code>{E(v)}</code>' for v in d['values'])+'</div>'+(f'<div class="tbl-wrap"><table><thead><tr><th>ממצב</th><th>למצב</th><th>מופעים</th></tr></thead><tbody>{tr}</tbody></table></div>' if tr else '')+'</div>'
    rl='<div class="chips">'+''.join(f'<code>{r["method"]} {E(r["path"])}</code>' for r in rts[:60])+(f'<span class="tag">+{len(rts)-60}</span>' if len(rts)>60 else '')+'</div>' if rts else '<span class="tag warn">אין נתיב API שנוגע ישירות</span>'
    tags=f'<span class="tag">{len(t["cols"])} עמודות</span><span class="tag">{len(rts)} נתיבים</span>'
    if len(t['creates'])>1: tags+=f'<span class="tag warn">CREATE ב-{len(t["creates"])} מקומות</span>'
    f=(n+' '+' '.join(t['cols'])).lower()
    return f'<details class="card" data-f="{E(f)}"><summary><span class="p"><strong>{E(n)}</strong></span><span class="ln">CREATE :{", ".join(map(str,t["creates"]))}</span>{tags}</summary><div class="body"><div class="tbl-wrap"><table><thead><tr><th>עמודה</th><th>טיפוס / אילוצים / ברירת מחדל</th><th>מקור</th></tr></thead><tbody>{cols}</tbody></table></div>{("<div><div class=count>אילוצים</div>"+cons+"</div>") if cons else ""}{("<div><div class=count>אינדקסים</div>"+idx+"</div>") if idx else ""}{("<div><div class=count>ALTER נוספים</div>"+alt+"</div>") if alt else ""}{sth}<div><div class="count">נתיבי API שקוראים / כותבים</div>{rl}</div></div></details>'
nt=sum(len(v) for v in dgroups.values()); nc=sum(len(schema[n]['cols']) for v in dgroups.values() for n in v)
intro=f'''<div class="intro">הסכמה <strong>לא מנוהלת במיגרציות</strong>. כל הטבלאות נוצרות בזמן עליית השרת ובתוך handlers, עם <code>CREATE TABLE IF NOT EXISTS</code>, ואחריו <code>ALTER TABLE … ADD COLUMN IF NOT EXISTS</code> מצטבר (325 CREATE, 527 ALTER). המילון מאחד את שני המקורות לכל טבלה: עמודות מ-CREATE לפי סדר ההגדרה, ואחריהן עמודות שנוספו ב-ALTER עם מספר השורה. <strong>{nt} טבלאות · {nc} עמודות · {sum(len(schema[n].get("indexes",[])) for n in schema)} אינדקסים.</strong><br>
<strong>טבלאות שהקוד משתמש בהן אבל לא יוצר:</strong> {", ".join(f"<code>{m}</code>" for m in missing)}. שאילתות אליהן ייכשלו בהתקנה חדשה.<br>
<strong>מצבים ומעברים:</strong> לכל עמודת status/stage מוצגים ערכי המצב שמופיעים <em>כמחרוזת מילולית</em> ב-SQL (ב-DEFAULT, ב-CHECK, ב-INSERT וב-UPDATE … SET), וגם מעברים מהצורה "ממצב (לפי WHERE) למצב". <code>*</code> פירושו שאין תנאי מצב, ו-<code>(INSERT)</code> פירושו מצב התחלתי. מצב שמגיע כפרמטר (<code>$1</code>) מהלקוח לא מופיע, ולכן הרשימה היא מינימום ולא בהכרח מלאה.<br><strong>עמודות דינמיות:</strong> <code>whatsapp_settings.ov_*</code> / <code>tpl_*</code> (:4475, :4479), <code>whatsapp_global_defaults.tpl_*</code> (:44391), <code>author_profiles</code> (:44625, :45146). שמות העמודות נבנים בלולאה, ולכן לא מופיעים במילון.</div>'''
content=intro+''.join(f'<h2 class="grp">{E(g)} · {len(v)} טבלאות</h2>'+''.join(tcard(n) for n in sorted(v)) for g,v in sorted(dgroups.items(),key=lambda x:-len(x[1])))
open('out/db.html','w',encoding='utf-8').write(shell('db','מילון נתונים (PostgreSQL)',f'{nt} טבלאות · {nc} עמודות',content))
# ---- functions ----
def fcard(f):
    tags=''
    if f['async_']: tags+='<span class="tag">async</span>'
    if f['dup_defs']: tags+=f'<span class="tag bad">מוגדרת פעמיים: {f["dup_defs"]}. האחרונה גוברת</span>'
    for x in f['ext']: tags+=f'<span class="tag warn">{E(x)}</span>'
    tags+=f'<span class="tag">{f["called_by_routes"]} נתיבים · {f["refs"]} קריאות</span>'
    sq=''.join(f'<pre class="sql">{E(q)}</pre>' for q in f['sql'])
    kv=f'<div>שורות</div><div><span class="code">server.js:{f["line"]}–{f["end"]}</span> ({f["len"]} שורות)</div><div>טבלאות</div><div class="chips">{"".join(f"<code>{E(t)}</code>" for t in f["tables"]) or "—"}</div>'
    if sq: kv+=f'<div>SQL</div><div class="sqls">{sq}</div>'
    return f'<details class="card" data-f="{E((f["name"]+" "+" ".join(f["tables"])).lower())}"><summary><span class="p"><strong>{E(f["name"])}</strong>({E(f["args"])})</span><span class="ln">:{f["line"]}</span>{tags}</summary><div class="body"><div class="kv">{kv}</div></div></details>'
fs_=sorted(funcs,key=lambda f:f['line'])
content='<div class="intro">כל הפונקציות שמוגדרות ברמה העליונה של server.js, מהצורה <code>function x()</code> או <code>const x = () =&gt;</code>, ממוינות לפי מיקום. לכל פונקציה מפורטים: הארגומנטים, הטבלאות שהיא נוגעת בהן, ה-SQL, השירותים החיצוניים, וכמה נתיבים וקריאות משתמשים בה. ב-handlers יש לוגיקה משותפת נוספת שמשוכפלת inline ולא חולצה לפונקציה.</div>'+'<h2 class="grp">כל הפונקציות</h2>'+''.join(fcard(f) for f in fs_)
open('out/functions.html','w',encoding='utf-8').write(shell('functions','פונקציות עזר בשרת',f'{len(funcs)} פונקציות',content))
print('pages ok', {k:len(v) for k,v in by.items()})
