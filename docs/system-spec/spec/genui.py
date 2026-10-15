import json,re,html,collections
exec(open('gen.py').read().split('os.makedirs')[0])
ui=json.load(open('ui.json')); st=json.load(open('static.json')); calls=json.load(open('client_calls.json'))
P='/home/user/family-flow/public/'
UIP=[('ui-biz','מסכים · עסק (BIZ)',['business-app.js','business.html (inline)'],['business.html']),
     ('ui-family','מסכים · משפחה (FAMILY)',['app.js','common.js','family-onboarding.html (inline)'],['index.html']),
     ('ui-sa','מסכים · Super Admin',['sa-app.js','sa.html (inline)','sa-v2-app.js','sa-v2.html (inline)','sa-bigscreen.html (inline)','qa-book.html (inline)'],['sa.html']),
     ('ui-other','מסכים · מנהל אזור, קול העם, חנויות ציבוריות ושאר',None,['zone-manager.html','kol-haam.html','storefront.html','community-store.html','marketplace.html','game.html','survey.html'])]
assigned=set(f for _,_,fs,_ in UIP if fs for f in fs)
PAGES2=PAGES
globals()['PAGES']=PAGES2
CONSTS={'business-app.js':['ALL_TABS','ROLE_DEFAULTS','GNAV_GROUPS','BUSINESS_TYPES','BUSINESS_CONFIG','_ROLE_TYPE_OPTIONS','CATEGORIES','BUDGET_LABELS','_BRANDING_SECTION_TYPES','_WIZ_ITEM_TYPES','EXCEL_BIZ_TYPES','_FOODCOST_WEIGHT_UNITS','_FOODCOST_VOLUME_UNITS'],
 'app.js':['ALL_TABS','ROLE_DEFAULTS','FAMILY_GNAV_GROUPS','CATEGORIES','BUDGET_LABELS','MEMBER_MODULES','HM_STATUS_LABELS','HM_MTYPE_LABELS','HM_SEV_LABELS','HM_FSTATUS_LABELS','GAME_LEVELS_BY_PATH'],
 'sa-app.js':['SA_GROUPS','SA_ENV_LABELS','SA_MODULE_LIST','SA_BIZ_STAGE_LABELS','LEGAL_DOC_LABELS','BIZ_TEMPLATE_TREE','FLOW_CONFIG_LABELS','AD_SLOT_DEFS','AUDIT_LABELS','WA_TYPE_META','WA_DEFAULTS_JS','TPL_DEFS','WA_HOOKS','WA_RECIPIENTS','KH_SA_TABS','KH_STATUS_META','KH_TYPE_LABELS','BIZ_TYPE_MODULES','PRICING_CATALOG_DEFAULT'],
 'zone-manager-app.js':['LEAD_TYPE_LABELS','LEAD_STATUS_LABELS','ACTION_LABELS'],
 'kol-haam-app.js':['TYPE_LABELS','AP_TYPE_META','VL_KIND_LABELS']}
def const_lit(fname,name):
    t=open(P+fname,encoding='utf-8').read()
    m=re.search(r'^(?:const|let|var)\s+'+re.escape(name)+r'\s*=\s*',t,re.M)
    if not m: return None,None
    i=m.end(); op=t[i]; cl={'[':']','{':'}'}.get(op)
    if not cl: return None,None
    d=0;j=i;q=None
    while j<len(t):
        c=t[j]
        if q:
            if c=='\\': j+=1
            elif c==q: q=None
        elif c in '\'"`': q=c
        elif c in '[{': d+=1
        elif c in ']}':
            d-=1
            if d==0: break
        j+=1
    lit=t[i:j+1]
    if len(lit)>9000: lit=lit[:9000]+'\n/* … קוצר */'
    return lit,t.count('\n',0,m.start())+1
ROUTE_BY={(r['method']+' '+r['path']):r for r in api}
def rlink(route):
    r=ROUTE_BY.get(route)
    if not r: return E(route)
    return f'<a href="{bucket(r["path"])}.html#r{r["line"]}" style="color:inherit"><code>{E(route)}</code></a>'
NOMATCH='<span class="tag bad">אין נתיב תואם בשרת</span>'
def fcard(fname,x):
    tags=f'<span class="tag">{x["ninputs"]} שדות</span><span class="tag">{x["nbtn"]} כפתורים</span><span class="tag">{len(x["calls"])} קריאות API</span>'
    kv=f'<div>מיקום</div><div><span class="code">{E(fname.replace(" (inline)",""))}:{x["line"]}–{x["end"]}</span></div>'
    if x['heads']: kv+='<div>כותרות במסך</div><div>'+' · '.join(E(h) for h in x['heads'])+'</div>'
    if x['inputs']:
        kv+='<div>שדות טופס</div><div class="tbl-wrap"><table><thead><tr><th>רכיב</th><th>type</th><th>id</th><th>placeholder</th><th>חובה</th></tr></thead><tbody>'+''.join(f'<tr><td class="c">{E(a)}</td><td class="c">{E(b)}</td><td class="c">{E(c)}</td><td>{E(d)}</td><td>{"✓" if e else ""}</td></tr>' for a,b,c,d,e in x['inputs'])+'</tbody></table></div>'
    if x['buttons']:
        kv+='<div>פעולות (כפתורים)</div><div class="tbl-wrap"><table><thead><tr><th>תווית</th><th>onclick</th></tr></thead><tbody>'+''.join(f'<tr><td>{E(a)}</td><td class="c">{E(b)}</td></tr>' for a,b in x['buttons'])+'</tbody></table></div>'
    if x['calls']:
        seen=[];rows=''
        for m,u,rt,ln in x['calls']:
            if (m,u) in seen: continue
            seen.append((m,u))
            cell=rlink(rt) if rt else NOMATCH
            rows+=f'<tr><td class="c">{E(m)}</td><td class="c">{E(u)}</td><td>{cell}</td><td class="ln">:{ln}</td></tr>'
        kv+=f'<div>קריאות API</div><div class="tbl-wrap"><table><thead><tr><th>Method</th><th>URL בלקוח</th><th>נתיב בשרת</th><th>שורה</th></tr></thead><tbody>{rows}</tbody></table></div>'
    f=(x['func']+' '+' '.join(x['heads'])+' '+' '.join(i[2] for i in x['inputs'])).lower()
    return f'<details class="card" data-f="{E(f)}"><summary><span class="p"><strong>{E(x["func"])}</strong>()</span><span class="ln">:{x["line"]}</span>{tags}</summary><div class="body"><div class="kv">{kv}</div></div></details>'
def scard(hf,c):
    kv=f'<div>מיקום</div><div><span class="code">{E(hf)}:{c["line"]}</span></div>'
    if c['heads']: kv+='<div>כותרות</div><div>'+' · '.join(E(h) for h in list(dict.fromkeys(c['heads']))[:8])+'</div>'
    if c['labels']: kv+='<div>תוויות</div><div>'+' · '.join(E(h) for h in list(dict.fromkeys(c['labels']))[:30])+'</div>'
    if c['inputs']: kv+='<div>שדות</div><div class="tbl-wrap"><table><thead><tr><th>רכיב</th><th>type</th><th>id</th><th>placeholder</th><th>חובה</th></tr></thead><tbody>'+''.join(f'<tr><td class="c">{E(a)}</td><td class="c">{E(b)}</td><td class="c">{E(cc)}</td><td>{E(d)}</td><td>{"✓" if e else ""}</td></tr>' for a,b,cc,d,e in c['inputs'])+'</tbody></table></div>'
    if c['buttons']: kv+='<div>כפתורים</div><div class="tbl-wrap"><table><tbody>'+''.join(f'<tr><td>{E(a)}</td><td class="c">{E(b)}</td></tr>' for a,b in list(dict.fromkeys(map(tuple,c['buttons'])))[:40])+'</tbody></table></div>'
    return f'<details class="card" data-f="{E((c["id"]+" "+" ".join(c["heads"])).lower())}"><summary><span class="p"><strong>#{E(c["id"])}</strong></span><span class="ln">:{c["line"]}</span><span class="tag">{len(c["inputs"])} שדות</span><span class="tag">{len(c["buttons"])} כפתורים</span></summary><div class="body"><div class="kv">{kv}</div></div></details>'
for key,title,fs,hfs in UIP:
    fs=fs or [f for f in ui if f not in assigned]
    parts=['<div class="intro">החילוץ נעשה מכנית מקוד הלקוח (Vanilla JS + Tailwind, בלי framework). <strong>קבועי תצורה</strong> מופיעים כפי שהם בקוד, כי הם מגדירים ניווט, מודולים לפי סוג עסק, מינוח ותוויות. <strong>מסכים סטטיים</strong> הם קונטיינרים עם id שמכיל tab/modal/screen/panel וכו׳ בקובץ ה-HTML, יחד עם השדות והכפתורים שבתוכם. <strong>פונקציות רינדור ופעולה</strong> הן כל פונקציה בקובץ ה-JS שמייצרת שדות או כפתורים בתבניות HTML, או שקוראת ל-API. לכל קריאה מצוין הנתיב התואם בשרת, עם קישור לחוזה שלו. שימו לב: URL שמורכב משרשור של כמה מחרוזות עלול להופיע כ"אין נתיב תואם" גם כשהנתיב קיים בשרת.</div>']
    for f in fs:
        if f in CONSTS:
            cs=''
            for n in CONSTS[f]:
                lit,ln=const_lit(f,n)
                if lit: cs+=f'<details class="card" data-f="{n.lower()}"><summary><span class="p"><strong>{n}</strong></span><span class="ln">{f}:{ln}</span></summary><div class="body"><pre class="sql">{E(lit)}</pre></div></details>'
            if cs: parts.append(f'<h2 class="grp">קבועי תצורה · {E(f)}</h2>'+cs)
    for hf in hfs:
        if st.get(hf): parts.append(f'<h2 class="grp">מסכים סטטיים · {E(hf)} · {len(st[hf])}</h2>'+''.join(scard(hf,c) for c in st[hf]))
    for f in fs:
        if ui.get(f): parts.append(f'<h2 class="grp">פונקציות רינדור ופעולה · {E(f)} · {len(ui[f])}</h2>'+''.join(fcard(f,x) for x in ui[f]))
    um=collections.Counter((c['file'],c['method'],c['url']) for c in calls if not c['route'] and c['file'] in fs)
    if um: parts.append(f'<h2 class="grp">קריאות לקוח בלי נתיב תואם בשרת · {len(um)}</h2><div class="card" data-f="unmatched"><div class="body tbl-wrap"><table><thead><tr><th>קובץ</th><th>Method</th><th>URL</th><th>מופעים</th></tr></thead><tbody>'+''.join(f'<tr><td class="c">{E(a)}</td><td class="c">{b}</td><td class="c">{E(u)}</td><td>{n}</td></tr>' for (a,b,u),n in sorted(um.items()))+'</tbody></table><p class="count">חלק מהשורות הן URL שמורכב משרשור (prefix ואחריו המשך), וחלק הן קריאות לנתיבים שלא קיימים בשרת, כלומר פיצ׳ר שבור בצד הלקוח. כדי להכריע צריך לבדוק כל שורה.</p></div></div>')
    nf=sum(len(ui.get(f,[])) for f in fs)
    open(f'out/{key}.html','w',encoding='utf-8').write(shell(key,title,f'{nf} פונקציות · {sum(len(st.get(h,[])) for h in hfs)} מסכים סטטיים',''.join(parts)))
    print(key,nf)
