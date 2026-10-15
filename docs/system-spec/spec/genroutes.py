import json,re,collections,html
E=lambda s: html.escape(str(s))
api=json.load(open('api.json')); items={i['id']:i for i in json.load(open('../decisions/items.json'))}
rng=[(r['line'],r['end'],i) for i,r in enumerate(api)]
per=collections.defaultdict(set)
for it in items.values():
    cid=it.get('dup_of') or it['id']
    t=' '.join(it.get('refs',[]))+' '+it['as_is']+' '+it['proposal']
    lines=set(int(x) for x in re.findall(r'server\.js:(\d{3,5})',t))
    for a,b in re.findall(r'server\.js:(\d{3,5})[–-](\d{3,5})',t):
        if 0<int(b)-int(a)<400: lines|=set(range(int(a),int(b)+1))
    for ln in lines:
        for s,e,i in rng:
            if s<=ln<=e: per[i].add(cid)
    for p in re.findall(r'(/api/[A-Za-z0-9_\-/:.]+)',t):
        p=p.rstrip('/.')
        for i,r in enumerate(api):
            if r['path']==p: per[i].add(cid)
REMOVE={'ARC-10','STR-07','RST-02'}
PREF=[('kol-haam','קול העם','tobe-kolhaam'),('sa','Super Admin','tobe-sa'),('superadmin','Super Admin','tobe-sa'),('admin','Super Admin','tobe-sa'),('zone-manager','קהילה ומנהלי אזור','tobe-community'),('zm','קהילה ומנהלי אזור','tobe-community'),('community','קהילה ומנהלי אזור','tobe-community'),('communities','קהילה ומנהלי אזור','tobe-community'),('live-games','קהילה ומנהלי אזור','tobe-community'),('quest-library','קהילה ומנהלי אזור','tobe-community'),('member','קהילה ומנהלי אזור','tobe-community'),('sport','ספורט','tobe-sport'),('beauty','יופי','tobe-beauty'),('logistics','לוגיסטיקה','tobe-logistics'),('routines','שגרות','tobe-routines'),('routine-occurrences','שגרות','tobe-routines'),('routine-documents','שגרות','tobe-routines'),('task-set-templates','שגרות','tobe-routines'),('store','חנות וקופה','tobe-store'),('storefront','חנות וקופה','tobe-store'),('public','חנות וקופה','tobe-store'),('branding','חנות וקופה','tobe-store'),('campaign','חנות וקופה','tobe-store'),('c','חנות וקופה','tobe-store'),('marketplace','חנות וקופה','tobe-store'),('restaurant','מסעדה','tobe-restaurant'),('tables','מסעדה','tobe-restaurant'),('food-cost','מסעדה','tobe-restaurant'),('menu','מסעדה','tobe-restaurant'),('menus','מסעדה','tobe-restaurant'),('menu-templates','מסעדה','tobe-restaurant'),('menu-sections','מסעדה','tobe-restaurant'),('menu-items','מסעדה','tobe-restaurant'),('menu-quote-requests','מסעדה','tobe-restaurant'),('suppliers','מסעדה','tobe-restaurant'),('b2b','מסעדה','tobe-restaurant'),('init-procurement','מסעדה','tobe-restaurant'),('recipes','מסעדה','tobe-restaurant'),('work-orders','תחזוקה ושירות','tobe-services'),('equipment','תחזוקה ושירות','tobe-services'),('service-calls','תחזוקה ושירות','tobe-services'),('sc-auth','תחזוקה ושירות','tobe-services'),('calendar','תחזוקה ושירות','tobe-services'),('timelog','תחזוקה ושירות','tobe-services'),('professional','תחזוקה ושירות','tobe-services')]
def dom(p):
    s=p.split('/')[2] if p.startswith('/api/') else p.split('/')[1]
    for k,l,f in PREF:
        if s==k or (k=='professional' and s.startswith('professional')): return l,f
    if s in ('login','logout','join','forgot-code','reset-password','solo') : return 'אימות וזהות','tobe-auth'
    if s in ('family','users','groups','group','transaction','transactions','tasks','shopping','pantry','kids','flow','loans','goals','budget','data','game','academy','surveys','inbox','messages','chat','activity','forecast'):
        return ('משפחה','tobe-family') if s in ('family','transaction','transactions','shopping','pantry','kids','flow','loans','goals','budget','data','game') else ('ליבת עסק','tobe-biz')
    return 'ליבת עסק','tobe-biz'
rows=collections.defaultdict(list); stats=collections.Counter()
for i,r in enumerate(api):
    ds=sorted(per.get(i,[]),key=lambda x:(x.split('-')[0],int(x.split('-')[1])))
    if r['shadowed_by']: disp=('רישום כפול: מאוחד לרישום בשורה %d'%r['shadowed_by'],'warn')
    elif REMOVE & set(ds) and '/seed' in r['path']: disp=('נשמר: SA בלבד עם audit (KH-05, ARC-10 בגרסה המתוקנת)','ok')
    elif REMOVE & set(ds): disp=('מוסר מהייצור (נתיב תחזוקה/זריעה)','bad')
    elif ds: disp=('נשמר, בשינויים לפי ההחלטות','ok')
    else: disp=('נשמר כמו שהוא, וחלים עליו כללי הפלטפורמה (ARC-02/ARC-04)','')
    stats[disp[0].split(':')[0].split(',')[0]]+=1
    l,f=dom(r['path'])
    rows[(l,f)].append((r,ds,disp))
o=['<div class="intro">מפת היעד של כל 1,511 נתיבי ה-API: מה קורה לכל נתיב במערכת החדשה. <strong>אף נתיב לא מושמט.</strong> כל נתיב שייך לעמוד אפיון יעד של תחום, ומופיעות לצידו ההחלטות שנוגעות בו. השיוך חושב מכנית מהפניות שורה ונתיב בכרטיסי ההחלטות, ולכן הוא מינימום: גם על נתיב בלי החלטות חלים כללי הפלטפורמה של tobe-arch, כלומר אימות ברירת מחדל, groupId מהסשן, טרנזקציות ומיגרציות. נתיב מוסר רק אם הוא נתיב תחזוקה או זריעה הרסני (ARC-10). כפתורי הזריעה של SA נשארים (KH-05). נתיב מוסר גם אם הוא רישום כפול שהמימוש שלו קיים בנתיב אחר (ARC-35 בגרסה המתוקנת). '+' · '.join(f'{k}: <strong>{v}</strong>' for k,v in stats.items())+'</div>']
for (l,f),rs in sorted(rows.items(),key=lambda x:-len(x[1])):
    o.append(f'<h2 class="grp">{E(l)} · {len(rs)} נתיבים · <a href="{f}.html">אפיון יעד</a></h2><section class="proc" data-f="{E(l)}"><div class="tbl-wrap"><table><thead><tr><th>Method</th><th>Path</th><th>שורה (קיים)</th><th>middleware היום</th><th>החלטות</th><th>ביעד</th></tr></thead><tbody>')
    for r,ds,(d,cls) in sorted(rs,key=lambda x:x[0]['path']):
        o.append(f"<tr data-f='{E(r['path'].lower())} {' '.join(ds).lower()}'><td class='c'>{r['method']}</td><td class='c'>{E(r['path'])}</td><td class='ln'>:{r['line']}</td><td class='c'>{E(', '.join(r['mw']) or 'ללא')}</td><td class='c'>{E(' '.join(ds))}</td><td><span class='tag {cls}'>{E(d)}</span></td></tr>")
    o.append('</tbody></table></div></section>')
open('tobe-routes.html','w',encoding='utf-8').write(''.join(o))
print(stats)
