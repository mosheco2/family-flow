import re,json
src=open('/home/user/family-flow/server.js',encoding='utf-8').read()
lines=src.split('\n')
starts=[0]
for l in lines: starts.append(starts[-1]+len(l)+1)
reg=re.compile(r"^\s*app\.(get|post|put|patch|delete|use|all)\(\s*(['\"`])([^'\"`]+)\2\s*,?(.*)$")
regs=[]
for i,l in enumerate(lines):
    m=reg.match(l)
    if m: regs.append((i,m.group(1).upper(),m.group(3),m.group(4)))
# function names defined
funcs=set(re.findall(r'(?:async\s+)?function\s+(\w+)\s*\(',src))|set(re.findall(r'const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>',src))
mw_names={'verifyFamily','verifyBiz','verifyBizOrLegacy','verifyFamilyOrBiz','verifySA','verifyZoneManager','verifyBizAdminOnly','requireModule','upload','rateLimit','otpLimiter','loginLimiter','verifyStorefront','verifyCommunityManager'}
seen={}
out=[]
for k,(i,meth,path,rest) in enumerate(regs):
    if meth in ('USE','ALL'): continue
    end=regs[k+1][0] if k+1<len(regs) else len(lines)
    # stop at a top-level line that starts a new top-level construct after handler close
    body_lines=lines[i:end]
    # trim trailing top-level code: find first line after i that equals '});' at column 0
    for j,bl in enumerate(body_lines[1:],1):
        if re.match(r'^\}\);?\s*$',bl) or re.match(r'^\}\)\);?\s*$',bl):
            body_lines=body_lines[:j+1];break
    body='\n'.join(body_lines)
    head=body[:600]
    mws=[]
    for mw in re.findall(r'\b(verify\w+|requireModule\([^)]*\)|upload\w*\.(?:single|array|fields)\([^)]*\)|\w+Limiter|rateLimit\w*)',head.split('=>')[0] if '=>' in head else head):
        if mw not in mws: mws.append(mw)
    params=re.findall(r':(\w+)',path)
    q=set(re.findall(r'req\.query\.(\w+)',body))
    for d in re.findall(r'\{([^{}]+)\}\s*=\s*req\.query',body): q|={x.split(':')[0].split('=')[0].strip() for x in d.split(',') if x.strip()}
    b=set(re.findall(r'req\.body\.(\w+)',body))
    for d in re.findall(r'\{([^{}]+)\}\s*=\s*req\.body',body): b|={x.split(':')[0].split('=')[0].strip().lstrip('.') for x in d.split(',') if x.strip()}
    b={x for x in b if re.match(r'^\w+$',x)}; q={x for x in q if re.match(r'^\w+$',x)}
    hdr=set(re.findall(r"req\.headers\[?['\"]?([\w-]+)",body))
    files='req.file' in body or 'req.files' in body
    errs=[]
    for m in re.finditer(r"res\.status\((\d{3})\)\.(?:json|send)\(\s*(\{[^}]{0,200}\}|'[^']{0,150}'|\"[^\"]{0,150}\"|`[^`]{0,150}`)?",body):
        e=(m.group(1),re.sub(r'\s+',' ',(m.group(2) or ''))[:160])
        if e not in errs: errs.append(e)
    sqls=[]
    for m in re.finditer(r"`([^`]*?\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|WITH)\b[^`]*)`|'((?:SELECT|INSERT|UPDATE|DELETE)\b[^']*)'",body,re.S):
        sq=re.sub(r'\s+',' ',m.group(1) or m.group(2)).strip()
        if len(sq)>700: sq=sq[:700]+' …'
        if sq not in sqls: sqls.append(sq)
    okjson=[]
    for m in re.finditer(r"res\.json\(\s*(\{[^;]{0,300}?\})\s*\)",body):
        okjson.append(re.sub(r'\s+',' ',m.group(1))[:250])
    okjson=list(dict.fromkeys(okjson))[:4]
    calls=sorted({c for c in re.findall(r'\b(\w+)\s*\(',body) if c in funcs and c not in mw_names and not c.startswith('verify')})
    key=(meth,re.sub(r':\w+',':_',path))
    dup=seen.get(key); seen.setdefault(key,i+1)
    tx='BEGIN' in body
    pooltx=bool(re.search(r"pool\.query\(\s*['\"`]BEGIN",body))
    out.append(dict(line=i+1,end=i+len(body_lines),method=meth,path=path,mw=mws,params=params,query=sorted(q),body=sorted(b),headers=sorted(hdr),files=files,errors=errs,sql=sqls,responses=okjson,calls=calls,shadowed_by=dup,tx=tx,pooltx=pooltx,ai=bool(re.search(r'gemini|anthropic|claude-|generateContent|callGemini',body,re.I))))
json.dump(out,open('api.json','w'),ensure_ascii=False,indent=0)
print(len(out),'routes; shadowed',sum(1 for r in out if r['shadowed_by']),'; no-mw',sum(1 for r in out if not r['mw']),'; with sql',sum(1 for r in out if r['sql']))
import collections
print(collections.Counter(tuple(r['mw'][:1]) for r in out).most_common(15))
