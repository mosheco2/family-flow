import json,re,os,bisect,collections,html as H
S='/tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/'
man=json.load(open(S+'manifest.json'))
files=[m['path'] for m in man if m['cat'] in ('A','B') and m['path'].endswith(('.js','.html')) and not m['path'].startswith('public/docs/')]
HEB=re.compile(r'[֐-׿]')
fnre=re.compile(r'^\s*(?:async\s+)?function\s+(\w+)\s*\(|^\s*(?:window\.)?(\w+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>)|^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>)|^\s*app\.(?:get|post|put|patch|delete)\(\s*[\'"`]([^\'"`]+)')
def clean(t):
    t=re.sub(r'\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}','{…}',t)
    return t
def kind_of(ctx):
    c=ctx[-60:].lower()
    for k,p in [('alert','alert('),('confirm','confirm('),('toast','toast'),('error','error'),('placeholder','placeholder'),('title','title'),('label','label')]:
        if p in c: return k
    return ''
entries=[]
for f in files:
    t=open(f,encoding='utf-8',errors='ignore').read()
    lines=t.split('\n'); off=[0]
    for l in lines: off.append(off[-1]+len(l)+1)
    fst=[];fl=[]
    for i,l in enumerate(lines):
        m=fnre.match(l)
        if m: fst.append(next(g for g in m.groups() if g)); fl.append(i)
    def func(ln):
        k=bisect.bisect_right(fl,ln)-1
        return fst[k] if k>=0 else ''
    def add(txt,pos,kind):
        txt=re.sub(r'\s+',' ',H.unescape(txt)).strip()
        if not txt or not HEB.search(txt) or len(txt)>600: return
        ln=t.count('\n',0,pos)
        entries.append((txt,f,ln+1,func(ln),kind))
    is_html=f.endswith('.html')
    # string literals (JS and inline scripts)
    for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`",t,re.S):
        g=m.group(1) if m.group(1) is not None else (m.group(2) if m.group(2) is not None else m.group(3))
        if g is None or not HEB.search(g): continue
        g=clean(g.replace("\\'","'").replace('\\"','"'))
        if '<' in g and '>' in g:
            # markup inside string: split text nodes + attributes
            for a in re.finditer(r'\b(placeholder|title|alt|aria-label|value|data-tip)\s*=\s*["\']([^"\']*)["\']',g): add(a.group(2),m.start(),a.group(1))
            for part in re.split(r'<[^>]*>',g): add(part,m.start(),'markup')
        else:
            add(g,m.start(),kind_of(t[max(0,m.start()-80):m.start()]))
    if is_html:
        body=re.sub(r'<script\b.*?</script>|<style\b.*?</style>',lambda x:' '*len(x.group(0)),t,flags=re.S)
        for a in re.finditer(r'\b(placeholder|title|alt|aria-label|content|value)\s*=\s*"([^"]*)"',body): add(a.group(2),a.start(),'attr:'+a.group(1))
        for m in re.finditer(r'>([^<>]+)<',body): add(m.group(1),m.start(),'html')
# dedupe exact (text,file,line)
seen=set();E=[]
for e in entries:
    k=(e[0],e[1],e[2])
    if k in seen: continue
    seen.add(k);E.append(e)
json.dump(E,open(S+'texts.json','w'),ensure_ascii=False)
uniq=collections.Counter(e[0] for e in E)
print(len(E),'occurrences',len(uniq),'unique texts')
print(collections.Counter(e[1] for e in E).most_common(12))
