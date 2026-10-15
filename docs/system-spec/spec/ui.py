import re,json,os,collections,bisect,html
exec(open('client.py').read().split('calls=[]')[0])
calls=json.load(open('client_calls.json'))
cbyf=collections.defaultdict(list)
for c in calls: cbyf[(c['file'],c['func'])].append(c)
TAG=re.compile(r'<(input|select|textarea)\b([^>]*)>',re.I)
BTN=re.compile(r'<button\b([^>]*)>(.*?)</button>',re.I|re.S)
def attr(a,n):
    m=re.search(r'\b'+n+r'\s*=\s*(["\'])(.*?)\1',a,re.S)
    return m.group(2) if m else ''
def clean(s): return re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',re.sub(r'\$\{[^}]*\}','…',s))).strip()[:80]
ui={}
for fname,txt in files.items():
    lines=txt.split('\n')
    fstarts=[]
    for i,l in enumerate(lines):
        m=fnre.match(l)
        if m:
            n=next(g for g in m.groups() if g)
            if n not in ('if','for','while','switch','catch','function','return'): fstarts.append((i,n))
    fstarts.append((len(lines),'__end'))
    out=[]
    for k in range(len(fstarts)-1):
        a,n=fstarts[k]; b=fstarts[k+1][0]
        body='\n'.join(lines[a:b])
        ins=[]
        for m in TAG.finditer(body):
            at=m.group(2)
            d=(m.group(1).lower(),attr(at,'type') or ('' if m.group(1).lower()!='input' else 'text'),clean(attr(at,'id')),clean(attr(at,'placeholder')),'req' if re.search(r'\brequired\b',at) else '')
            if d not in ins: ins.append(d)
        btns=[]
        for m in BTN.finditer(body):
            lab=clean(m.group(2)); oc=clean(attr(m.group(1),'onclick'))[:70]
            if lab and (lab,oc) not in btns: btns.append((lab,oc))
        cs=cbyf.get((fname,n),[])
        heads=[clean(h) for h in re.findall(r'<h[1-4][^>]*>(.*?)</h[1-4]>',body,re.S)]
        heads=[h for h in dict.fromkeys(heads) if h][:6]
        if ins or btns or cs:
            out.append(dict(func=n,line=a+1,end=b,inputs=ins[:60],buttons=btns[:40],calls=[(c['method'],c['url'],c['route'],c['line']) for c in cs],heads=heads,ninputs=len(ins),nbtn=len(btns)))
    ui[fname]=out
json.dump(ui,open('ui.json','w'),ensure_ascii=False)
for f,v in ui.items(): print(f,len(v),'functions', sum(x['ninputs'] for x in v),'inputs', sum(len(x['calls']) for x in v),'calls')
