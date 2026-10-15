import re,json,os,collections
P='/home/user/family-flow/public/'
api=json.load(open('api.json'))
# route matchers
def rx(path):
    s=re.escape(path)
    s=re.sub(r'\\?:\w+',r'[^/]+',s)
    return re.compile('^'+s+'$')
rts=[(rx(r['path']),r) for r in api if not r['shadowed_by']]
def match(url,meth):
    c=[r for x,r in rts if x.match(url)]
    if not c: return None
    exact=[r for r in c if r['method']==meth]
    pool=exact or c
    # prefer literal-heavy path
    pool.sort(key=lambda r:-len(re.sub(r':\w+','',r['path'])))
    return pool[0]
files={}
for f in ['app.js','business-app.js','sa-app.js','zone-manager-app.js','kol-haam-app.js','kol-haam-author-app.js','community-store-app.js','common.js','community-help.js','sc-auth.js','storefront-btype.js','storefront-chat.js','survey-app.js','sa-v2-app.js']:
    if os.path.exists(P+f): files[f]=open(P+f,encoding='utf-8').read()
for f in sorted(os.listdir(P)):
    if f.endswith('.html') and not re.search(r'\d{6}|old|github',f):
        h=open(P+f,encoding='utf-8').read()
        inl='\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',h,re.S))
        if '/api/' in inl or 'API' in inl: files[f+' (inline)']=inl
fnre=re.compile(r'^\s*(?:async\s+)?function\s+(\w+)\s*\(|^\s*(?:window\.)?(\w+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)|^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>)|^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{\s*$')
calls=[]; byfile={}
unmatched=collections.Counter()
for fname,txt in files.items():
    lines=txt.split('\n'); off=[0]
    for l in lines: off.append(off[-1]+len(l)+1)
    fstarts=[]
    for i,l in enumerate(lines):
        m=fnre.match(l)
        if m:
            n=next(g for g in m.groups() if g)
            if n not in ('if','for','while','switch','catch','function','return'): fstarts.append((i,n))
    import bisect
    fl=[a for a,_ in fstarts]
    bm=re.search(r"const API\s*=\s*['\"]([^'\"]*)['\"]",txt)
    base=bm.group(1).rstrip('/') if bm else '/api'
    if base=='': base=''
    for m in re.finditer(r"[`'\"]((?:\$\{(?:API|API_URL|API_BASE|BASE|apiBase|API_ROOT)\}|/api)(/[^`'\"\s]*)?)[`'\"]",txt):
        raw=m.group(1); tail=m.group(2) or ''
        if raw.startswith('${API}'): url=(base if base else '')+tail
        elif raw.startswith('${'): url='/api'+tail
        else: url=raw
        if not url.startswith('/api'): continue
        url=url.split('?')[0]
        url=re.sub(r'\$\{[^}]*\}',':x',url)
        url=re.sub(r':x[^/]*',':x',url).rstrip('/')
        win=txt[m.end():m.end()+400]
        mm=re.search(r"method\s*:\s*['\"`](\w+)",win)
        nxt=re.search(r"\bfetch\(|saFetch\(|communityFetch\(|apiFetch\(",win)
        if mm and nxt and mm.start()>nxt.start(): mm=None
        meth=(mm.group(1).upper() if mm else 'GET')
        ln=txt.count('\n',0,m.start())
        k=bisect.bisect_right(fl,ln)-1
        func=fstarts[k][1] if k>=0 else '(top-level)'
        u2=re.sub(r':x',':p',url)
        r=match(url.replace(':x','1'),meth) or match(url.replace(':x','x'),meth)
        if not r: unmatched[(fname,meth,u2)]+=1
        calls.append(dict(file=fname,line=ln+1,func=func,method=meth,url=u2,route=(r['method']+' '+r['path']) if r else None,rline=r['line'] if r else None))
json.dump(calls,open('client_calls.json','w'),ensure_ascii=False)
used=set(c['route'] for c in calls if c['route'])
print(len(calls),'client call sites; matched',sum(1 for c in calls if c['route']),'; distinct routes used',len(used),'of',len(api))
print('unmatched sample:',list(unmatched.items())[:25])
