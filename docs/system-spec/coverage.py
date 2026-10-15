import re,html,collections
src=open('/home/user/family-flow/server.js',encoding='utf-8').read().split('\n')
doc=html.unescape(re.sub(r'<[^>]+>','',open('system-doc.html',encoding='utf-8').read()))
skel=lambda p: re.sub(r':[A-Za-z_]+','_',p)
docskel=skel(doc)
routes=[]
for i,l in enumerate(src,1):
    for m in re.finditer(r"app\.(get|post|put|patch|delete)\(\s*['\"`]([^'\"`]+)",l):
        routes.append((i,m.group(1).upper(),m.group(2)))
miss=[r for r in routes if r[2] not in doc and skel(r[2]) not in docskel]
print('routes',len(routes),'covered',len(routes)-len(miss),'missing',len(miss))
open('missing-routes.txt','w').write('\n'.join(f'{a}\t{b}\t{c}' for a,b,c in miss)+'\n')
c=collections.Counter('/'.join(r[2].split('/')[:3]) for r in miss)
for k,v in c.most_common(): print(v,k)
