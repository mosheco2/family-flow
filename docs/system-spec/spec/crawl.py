import os,re,json,subprocess,urllib.parse,collections
os.chdir('/home/user/family-flow')
files=subprocess.run(['git','-c','core.quotepath=off','ls-files'],capture_output=True,text=True).stdout.splitlines()
files=[f for f in files if not f.startswith('docs/system-spec/')]
TEXT=('.js','.html','.css','.json','.md','.jsx','.yml','.txt','.svg')
BACKUP=re.compile(r'(030426|old|github|server1\.js|servertemp|server \(1\)|\(1\)|copy|backup)',re.I)
bybase=collections.defaultdict(list)
for f in files: bybase[os.path.basename(f)].append(f)
def refs(f):
    try: t=open(f,encoding='utf-8',errors='ignore').read()
    except: return set()
    t2=urllib.parse.unquote(t)
    out=set()
    for b,paths in bybase.items():
        if len(b)<4: continue
        if b in t or b in t2:
            for p in paths:
                if p!=f: out.add(p)
    # webp/png alternates
    return out
seed=['server.js','package.json','services/whatsapp.js','public/index.html','public/business.html','public/sa.html']
seed+=[f for f in files if f.startswith('public/') and f.endswith('.html') and not BACKUP.search(f)]
reached=set();q=list(seed);via={}
srvtxt=open('server.js',encoding='utf-8').read()
while q:
    f=q.pop()
    if f in reached or f not in files: continue
    reached.add(f)
    if f.endswith(TEXT) and not BACKUP.search(f):
        for r in refs(f):
            if r not in reached:
                via.setdefault(r,f); q.append(r)
json.dump({'files':files,'reached':sorted(reached),'via':via},open('/tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/crawl.json','w'),ensure_ascii=False)
print(len(files),'files; reached',len(reached))
nr=[f for f in files if f not in reached]
c=collections.Counter(f.split('/')[0] if '/' in f else '(root)' for f in nr); print('not reached by dir',c.most_common())
