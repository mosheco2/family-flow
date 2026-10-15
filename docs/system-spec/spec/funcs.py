# top-level helper functions catalog
import re,json
src=open('/home/user/family-flow/server.js',encoding='utf-8').read()
lines=src.split('\n')
out=[]
pat=re.compile(r'^(async\s+)?function\s+(\w+)\s*\(([^)]*)\)|^const\s+(\w+)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>|^const\s+(\w+)\s*=\s*(async\s+)?function')
for i,l in enumerate(lines):
    m=pat.match(l)
    if not m: continue
    name=m.group(2) or m.group(4) or m.group(7)
    args=(m.group(3) if m.group(2) else m.group(6)) or ''
    asy=bool(m.group(1) or m.group(5) or m.group(8))
    # body until line '}' or '};' at col 0
    j=i+1
    while j<len(lines) and not re.match(r'^\}\)?;?\s*$',lines[j]): j+=1
    body='\n'.join(lines[i:j+1])
    sqls=[]
    for s in re.finditer(r"`([^`]*?\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|DROP|TRUNCATE)\b[^`]*)`",body,re.S):
        q=re.sub(r'\s+',' ',s.group(1)).strip()
        if len(q)>400: q=q[:400]+' …'
        if q not in sqls: sqls.append(q)
    tables=sorted(set(t.lower() for t in re.findall(r'\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]+)',body,re.I))-{'set','select'})
    ext=sorted(set(x for x,k in [('Gemini','gemini'),('Anthropic','anthropic'),('SMTP/nodemailer','sendMail'),('Twilio','twilio'),('WhatsApp','whatsapp'),('fetch()','fetch(')] if k in body.lower() or k in body))
    out.append(dict(name=name,line=i+1,end=j+1,args=re.sub(r'\s+',' ',args).strip(),async_=asy,sql_count=len(sqls),sql=sqls[:12],tables=tables,ext=ext,len=j-i+1))
# callers
a=json.load(open('api.json'))
for f in out:
    f['called_by_routes']=sum(1 for r in a if f['name'] in r['calls'])
    f['refs']=len(re.findall(r'\b'+re.escape(f['name'])+r'\s*\(',src))-1
names=[f['name'] for f in out]
f_d={}
for f in out: f_d.setdefault(f['name'],[]).append(f['line'])
for f in out: f['dup_defs']=f_d[f['name']] if len(f_d[f['name']])>1 else []
json.dump(out,open('funcs.json','w'),ensure_ascii=False)
print(len(out),'functions; duplicates:',{k:v for k,v in f_d.items() if len(v)>1})
