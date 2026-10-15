import re,json,collections
src=open('/home/user/family-flow/server.js',encoding='utf-8').read()
schema=json.load(open('schema.json'))
st=collections.defaultdict(lambda: collections.defaultdict(lambda: {'values':collections.Counter(),'trans':collections.Counter(),'default':None}))
for n,t in schema.items():
    for c,v in t['cols'].items():
        if re.search(r'(status|state|stage|phase)$',c):
            d=re.search(r"DEFAULT\s+'([^']+)'",v[0]); 
            st[n][c]['default']=d.group(1) if d else None
            ch=re.search(r"CHECK\s*\(.*?IN\s*\(([^)]*)\)",v[0],re.I)
            if ch:
                for x in re.findall(r"'([^']+)'",ch.group(1)): st[n][c]['values'][x]+=0
for m in re.finditer(r"`([^`]*)`",src,re.S):
    q=m.group(1)
    for u in re.finditer(r'UPDATE\s+(\w+)\s+(?:\w+\s+)?SET\s+(.*?)(?:\bWHERE\b(.*?))?(?:RETURNING|$)',q,re.I|re.S):
        tb=u.group(1).lower()
        if tb not in st: continue
        for col in list(st[tb].keys()):
            for v in re.findall(r"\b"+col+r"\s*=\s*'([^']+)'",u.group(2)):
                st[tb][col]['values'][v]+=1
                if u.group(3):
                    frm=re.findall(r"\b"+col+r"\s*(?:=\s*'([^']+)'|IN\s*\(([^)]*)\))",u.group(3))
                    srcs=[]
                    for a,b in frm: srcs+= [a] if a else re.findall(r"'([^']+)'",b)
                    for s_ in srcs: st[tb][col]['trans'][(s_,v)]+=1
                    if not srcs: st[tb][col]['trans'][('*',v)]+=1
                else: st[tb][col]['trans'][('*',v)]+=1
    for ins in re.finditer(r'INSERT INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*?)\)',q,re.I|re.S):
        tb=ins.group(1).lower()
        if tb not in st: continue
        cols=[c.strip().lower() for c in ins.group(2).split(',')]
        vals=[v.strip() for v in re.split(r",(?![^(]*\))",ins.group(3))]
        for c,v in zip(cols,vals):
            if c in st[tb] and re.match(r"^'[^']+'$",v): st[tb][c]['values'][v.strip("'")]+=1; st[tb][c]['trans'][('(INSERT)',v.strip("'"))]+=1
    for w in re.finditer(r"(\w+)\.?(\w*status\w*|\w*stage)\s*=\s*'([^']+)'",q): pass
out={}
for tb,cols in st.items():
    for c,d in cols.items():
        if d['values'] or d['default']:
            out.setdefault(tb,{})[c]={'default':d['default'],'values':sorted(set(d['values'])|({d['default']} if d['default'] else set())),'trans':[[a,b,n] for (a,b),n in d['trans'].most_common()]}
json.dump(out,open('states.json','w'),ensure_ascii=False)
print(len(out),'tables with state columns;',sum(len(v) for v in out.values()),'columns')
print(json.dumps(out.get('store_orders',{}),ensure_ascii=False)[:800])
