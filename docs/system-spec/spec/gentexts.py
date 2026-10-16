import json,re,html,collections,csv
exec(open('gen.py').read().split('os.makedirs')[0])
TX=json.load(open('../texts.json'))
G=[('texts-family','טקסטים · משפחה',lambda f: f in ('public/app.js','public/index.html','public/family-onboarding.html','public/common.js')),
 ('texts-biz','טקסטים · עסק',lambda f: f in ('public/business-app.js','public/business.html','public/biz-onboarding.html')),
 ('texts-sa','טקסטים · Super Admin',lambda f: 'sa' in f.split('/')[-1][:3] or 'qa-book' in f),
 ('texts-community','טקסטים · מנהל אזור וקול העם',lambda f: 'zone-manager' in f or 'kol-haam' in f),
 ('texts-public','טקסטים · חנויות ודפים ציבוריים',lambda f: any(k in f for k in ('storefront','sc-auth','community-store','community-help','marketplace','campaign','menu','track','survey','game','games/','demo-login','comic'))),
 ('texts-server','טקסטים · הודעות שרת',lambda f: not f.startswith('public/')),
 ('texts-guides','טקסטים · מדריכים ודפי שיווק',lambda f: True)]
grp=collections.defaultdict(list)
for e in TX:
    for k,t,fn in G:
        if fn(e[1]): grp[k].append(e); break
KIND={'markup':'תבנית HTML','html':'טקסט בדף','alert':'alert','confirm':'confirm','toast':'הודעה קופצת','error':'שגיאה','placeholder':'placeholder','title':'כותרת','label':'תווית'}
stats=[]
for k,t,_ in G:
    rows=grp[k]; byf=collections.defaultdict(list)
    for e in rows: byf[e[1]].append(e)
    parts=[f'<div class="intro">כל הטקסטים בעברית שמופיעים בקבצים הפעילים של הקבוצה, כפי שהם בקוד. נכללים טקסטים בדפים, תבניות שנבנות ב-JS, placeholders, כותרות, הודעות alert/confirm והודעות שגיאה. <code>{{…}}</code> מסמן ערך דינמי. העמודה "הקשר" היא שם הפונקציה הקרובה בקוד, ולכן היא משוערת. יש כאן {len(rows)} מופעים של {len(set(e[0] for e in rows))} טקסטים שונים. הקטלוג המלא גם כקובץ CSV/JSON: <code>texts.csv</code> ו-<code>texts.json</code> בתיקיית התיעוד.</div>']
    for f,es in sorted(byf.items(),key=lambda x:-len(x[1])):
        es.sort(key=lambda e:e[2])
        tr=''.join(f"<tr data-f='{E(e[0][:200].lower())}'><td class='ln'>{e[2]}</td><td>{E(e[0])}</td><td class='c'>{E(e[3])}</td><td>{E(KIND.get(e[4].split(':')[-1],e[4]))}</td></tr>" for e in es)
        parts.append(f'<h2 class="grp"><code>{E(f)}</code> · {len(es)}</h2><div class="tbl-wrap"><table><thead><tr><th>שורה</th><th>טקסט</th><th>הקשר</th><th>סוג</th></tr></thead><tbody>{tr}</tbody></table></div>')
    open(f'out/{k}.html','w',encoding='utf-8').write(shell(k,t,f'{len(rows)} מופעים',''.join(parts)))
    stats.append((k,t,len(rows)))
with open('../texts.csv','w',encoding='utf-8-sig',newline='') as fh:
    w=csv.writer(fh); w.writerow(['text','file','line','context','kind'])
    for e in TX: w.writerow(e)
json.dump(stats,open('texts-stats.json','w'),ensure_ascii=False)
print(stats)
