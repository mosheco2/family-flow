import re,html,glob,os,json
P='/home/user/family-flow/public/'
ui=''
for f in ['business.html','business-app.js','index.html','app.js','sa.html','sa-app.js','zone-manager.html','zone-manager-app.js','kol-haam.html','kol-haam-app.js','community-store-app.js','storefront.html','storefront-restaurant.html','storefront-sport.html','storefront-market.html','storefront-professional.html','storefront-repairs.html','storefront-logistics.html','common.js','community-help.js']:
    try: ui+=open(P+f,errors='ignore').read()
    except: pass
def clean(s):
    s=re.sub(r'[\U0001F000-\U0001FFFF☀-➿️‍]','',s)
    s=s.replace('"','').replace('״','"').replace("'",'').replace('“','').replace('”','').replace('«','').replace('»','')
    return s.strip(' .,:;()[]-–—\t\n')
res={}
for g in sorted(glob.glob(P+'*-guide.html')):
    raw=open(g,errors='ignore').read()
    raw=re.sub(r'<script.*?</script>|<style.*?</style>','',raw,flags=re.S)
    t=html.unescape(re.sub(r'<[^>]+>',' ',raw)); t=re.sub(r'\s+',' ',t)
    paths=[]
    for m in re.finditer(r'((?:[^→←\.\!\?:]{2,28}\s*[→←]\s*){1,4}[^→←\.\!\?:,]{2,28})',t):
        segs=[clean(x) for x in re.split(r'[→←]',m.group(1))]
        segs=[s for s in segs if 1<len(s)<=26]
        if len(segs)>=2: paths.append(segs)
    segset=[]
    for p in paths:
        for s in p:
            if s not in segset: segset.append(s)
    found=[s for s in segset if s in ui]
    nf=[s for s in segset if s not in ui]
    res[os.path.basename(g)]={'paths':len(paths),'segs':len(segset),'found':len(found),'notfound':nf}
    print(f"{os.path.basename(g)}: paths {len(paths)}, distinct segments {len(segset)}, found-in-UI {len(found)} ({(100*len(found)//max(1,len(segset)))}%)")
json.dump(res,open('guidepaths.json','w'),ensure_ascii=False,indent=0)
