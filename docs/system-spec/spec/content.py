import re,os,json,subprocess,shutil
os.chdir('/home/user/family-flow')
OUT='docs/system-spec/content'
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT+'/inline-data',exist_ok=True); os.makedirs(OUT+'/data-files',exist_ok=True)
def lits(path,minlen=400):
    t=open(path,encoding='utf-8').read()
    res=[]
    for m in re.finditer(r'^\s*(?:const|let|var)\s+([A-Z][A-Z0-9_]{3,})\s*=\s*([\[{])',t,re.M):
        i=m.end()-1; d=0;j=i;q=None
        while j<len(t):
            c=t[j]
            if q:
                if c=='\\': j+=1
                elif c==q: q=None
            elif c in '\'"`': q=c
            elif c=='/' and t[j+1:j+2]=='/' : 
                k=t.find('\n',j); j=k if k>0 else len(t); continue
            elif c in '[{': d+=1
            elif c in ']}':
                d-=1
                if d==0: break
            j+=1
        lit=t[i:j+1]
        if len(lit)>=minlen: res.append((m.group(1),t.count('\n',0,m.start())+1,lit))
    return res
index=[]
SRC=['server.js','public/app.js','public/business-app.js','public/sa-app.js','public/zone-manager-app.js','public/kol-haam-app.js']
for src in SRC:
    for name,ln,lit in lits(src):
        base=f"{os.path.basename(src).replace('.js','')}__{name}"
        open(f'{OUT}/inline-data/{base}.js','w',encoding='utf-8').write(f'// source: {src}:{ln}\nconst {name} = {lit};\n')
        r=subprocess.run(['node','-e',f'const v=({lit});process.stdout.write(JSON.stringify(v,null,1))'],capture_output=True,text=True)
        js=r.returncode==0
        if js: open(f'{OUT}/inline-data/{base}.json','w',encoding='utf-8').write(r.stdout)
        index.append(dict(name=name,source=f'{src}:{ln}',bytes=len(lit),json=js,file=f'content/inline-data/{base}.'+('json' if js else 'js')))
DATA=['public/games/trivia-questions.json','public/manifest.json','public/manifest-business.json','public/manifest-biz.json','public/qa-results.json','public/.well-known/assetlinks.json','seed_quizzes.js','services/seed_quizzes.js','seedqabook.js','reset-db.js']
for f in DATA:
    if os.path.exists(f):
        dst=f'{OUT}/data-files/'+f.replace('/','__')
        shutil.copy(f,dst); index.append(dict(name=os.path.basename(f),source=f,bytes=os.path.getsize(f),json=f.endswith('.json'),file='content/data-files/'+f.replace('/','__')))
json.dump(index,open(OUT+'/index.json','w'),ensure_ascii=False,indent=1)
print(len(index),'datasets', sum(1 for i in index if i['json']),'as json')
print(sorted(((i['bytes'],i['name'],i['source']) for i in index),reverse=True)[:15])
