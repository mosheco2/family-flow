import re,json,collections
src=open('/home/user/family-flow/server.js',encoding='utf-8').read()
lineof=lambda pos: src.count('\n',0,pos)+1
tables=collections.OrderedDict()
def split_top(s):
    parts=[];d=0;cur=''
    for ch in s:
        if ch=='(':d+=1
        elif ch==')':d-=1
        if ch==',' and d==0: parts.append(cur);cur=''
        else: cur+=ch
    if cur.strip(): parts.append(cur)
    return [re.sub(r'\s+',' ',p).strip() for p in parts if p.strip()]
for m in re.finditer(r'CREATE TABLE(?: IF NOT EXISTS)?\s+("?[\w.]+"?)\s*\(',src,re.I):
    name=m.group(1).strip('"').lower()
    i=m.end();d=1
    while d and i<len(src):
        c=src[i]
        if c=='(':d+=1
        elif c==')':d-=1
        i+=1
    body=re.sub(r'--[^\n]*','',src[m.end():i-1])
    if '${' in body and len(body)<20: continue
    t=tables.setdefault(name,{'creates':[],'cols':collections.OrderedDict(),'constraints':[],'alters':[]})
    t['creates'].append(lineof(m.start()))
    for p in split_top(body):
        p=re.sub(r'--[^\n]*','',p).strip()
        if not p: continue
        if re.match(r'(PRIMARY KEY|UNIQUE|FOREIGN KEY|CONSTRAINT|CHECK)\b',p,re.I):
            if p not in t['constraints']: t['constraints'].append(p)
        else:
            cm=re.match(r'"?(\w+)"?\s+(.*)',p)
            if cm and cm.group(1).lower() not in t['cols']:
                t['cols'][cm.group(1).lower()]=(cm.group(2),lineof(m.start()),'create')
for m in re.finditer(r'ALTER TABLE\s+(?:IF EXISTS\s+)?(?:ONLY\s+)?"?(\w+)"?\s+(.*?)(?:;|`|\'|\n\s*\n)',src,re.I|re.S):
    name=m.group(1).lower(); rest=re.sub(r'--[^\n]*','',m.group(2))
    t=tables.setdefault(name,{'creates':[],'cols':collections.OrderedDict(),'constraints':[],'alters':[]})
    for part in split_top(rest):
        a=re.match(r'ADD COLUMN(?: IF NOT EXISTS)?\s+"?(\w+)"?\s+(.+)',part,re.I)
        if a:
            c=a.group(1).lower()
            if c not in t['cols']: t['cols'][c]=(a.group(2).strip(),lineof(m.start()),'alter')
        elif part: t['alters'].append((lineof(m.start()),part[:200]))
idx=[]
for m in re.finditer(r'CREATE (UNIQUE )?INDEX(?: IF NOT EXISTS)?\s+(\w+)\s+ON\s+"?(\w+)"?\s*(\([^)]*\))',src,re.I):
    idx.append((m.group(3).lower(),m.group(2),bool(m.group(1)),m.group(4),lineof(m.start())))
for (tb,n,u,cols,l) in idx:
    tables.setdefault(tb,{'creates':[],'cols':collections.OrderedDict(),'constraints':[],'alters':[]}).setdefault('indexes',[]).append((n,u,cols,l))
# usage counts
for n,t in tables.items():
    t['refs']=len(re.findall(r'\b(?:FROM|JOIN|INTO|UPDATE)\s+'+re.escape(n)+r'\b',src,re.I))
json.dump(tables,open('schema.json','w'),ensure_ascii=False,indent=1)
print(len(tables),'tables', sum(len(t['cols']) for t in tables.values()),'cols', len(idx),'indexes')
nocreate=[n for n,t in tables.items() if not t['creates']]
print('altered but never created:',nocreate)
