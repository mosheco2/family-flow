import json,re,glob,os,sys,collections
R='/home/user/family-flow/'
a=json.load(open('api.json'))
routes=[(x['method'],x['path'],x['line']) for x in a]
def norm(p):
    p=p.split('?')[0].rstrip('/.,;:)`\'"')
    segs=p.split('/')
    return segs
def match(method,p):
    ds=norm(p)
    best=None
    for m,rp,ln in routes:
        rs=rp.split('/')
        if len(rs)!=len(ds): continue
        ok=True
        for d,r in zip(ds,rs):
            if r.startswith(':') or d.startswith(':') or d.startswith('{') or d.startswith('$') or d in ('X','Y','ID','id','xxx'): continue
            if d!=r: ok=False;break
        if ok:
            if method and m==method: return (m,rp,ln,'exact')
            best=best or (m,rp,ln,'path-only')
    return best
docs=sorted(glob.glob(R+'*.md')+glob.glob(R+'docs/*.md'))
out={}
for d in docs:
    t=open(d).read()
    found=collections.OrderedDict()
    for mm in re.finditer(r'(?:(GET|POST|PUT|PATCH|DELETE)\s+)?`?(/api/[A-Za-z0-9_\-/:{}\.$]+)',t):
        meth,p=mm.group(1),mm.group(2)
        p=p.rstrip('.,;:)`')
        key=(meth or '')+' '+p
        if key in found: continue
        found[key]=match(meth,p)
    out[os.path.relpath(d,R)]=[(k,v) for k,v in found.items()]
json.dump(out,open('docroutes.json','w'),ensure_ascii=False,indent=0)
for d,lst in out.items():
    n=len(lst); ok=sum(1 for k,v in lst if v); ex=sum(1 for k,v in lst if v and v[3]=='exact')
    print(f'{d}: {n} refs, matched {ok}, exact-method {ex}')
