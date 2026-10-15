import re,sys,html
for f in sys.argv[1:]:
    s=open(f,encoding='utf-8').read()
    procs=re.findall(r'<section class="proc".*?</section>',s,re.S)
    tot=gap=0; thin=[]
    for p in procs:
        t=len(re.sub(r'<[^>]+>','',p))
        g=re.search(r'<div>פערים</div><div>(.*?)</div>\s*</div>\s*</section>',p,re.S)
        gl=len(re.sub(r'<[^>]+>','',g.group(1))) if g else 0
        tot+=t; gap+=gl
        if t-gl<600: thin.append(re.search(r'<h3>(.*?)</h3>',p).group(1))
    print(f, len(procs),'procs', f'{len(s)//1024}KB', f'gaps share {gap*100//max(tot,1)}%', 'thin:',thin[:6])
