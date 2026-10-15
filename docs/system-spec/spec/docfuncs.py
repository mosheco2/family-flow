import re,glob,os,json,subprocess
R='/home/user/family-flow/'
src=''
for f in ['server.js']+glob.glob(R+'public/*.js')+glob.glob(R+'public/*.html')+glob.glob(R+'services/*.js'):
    if f=='server.js': f=R+'server.js'
    if re.search(r'030426|old1|\(1\)',f): continue
    try: src+=open(f,errors='ignore').read()+'\n'
    except: pass
ids=set(re.findall(r'[A-Za-z_$][A-Za-z0-9_$]*',src))
docs=sorted(glob.glob(R+'*.md')+glob.glob(R+'docs/*.md'))
res={}
for d in docs:
    t=open(d).read()
    names=[]
    for m in re.finditer(r'`?([A-Za-z_][A-Za-z0-9_]{3,})\(',t):
        n=m.group(1)
        if n in ('function','return','if','for','while','switch','catch','fetch','setInterval','setTimeout','JSON','Math','Object','require','async','await','console','parseInt','parseFloat','String','Number','Date','Array','Promise','encodeURIComponent'): continue
        if n not in names: names.append(n)
    missing=[n for n in names if n not in ids]
    res[os.path.relpath(d,R)]={'total':len(names),'missing':missing}
    print(f"{os.path.relpath(d,R)}: funcs {len(names)}, missing {len(missing)}")
json.dump(res,open('docfuncs.json','w'),ensure_ascii=False,indent=0)
