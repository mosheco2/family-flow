import json,html
d=json.load(open('verify-all.json')); claims=d['claims']
L={'CORRECT':'אומת','SHIFTED':'נכון, שורה מוסטת (תוקן)','PARTIAL':'חלקי (תוקן)','WRONG':'שגוי'}
DOM={'auth':'אימות','family':'משפחה','biz':'עסק','store':'חנות','restaurant':'מסעדה','sport':'ספורט','beauty':'יופי','logistics':'לוגיסטיקה','services':'תחזוקה ומקצועי','community':'קהילה','kolhaam':'קול העם','sa':'SA'}
SP='<br><span style="font-size:11px">'
rows=''
for r in sorted(d['res'],key=lambda r:r['id']):
    c=claims[str(r['id'])]
    cl=html.escape(c['claim'][:220])+('…' if len(c['claim'])>220 else '')
    corr=(SP+html.escape(r['correction'][:240])+'</span>') if r['correction'] else ''
    rows+=f"<tr><td>{r['id']}</td><td>{DOM[c['domain']]}</td><td>{html.escape(c['process'])}</td><td>{cl}</td><td>{L[r['verdict']]}{corr}</td></tr>"
tpl=open('sec65.tpl',encoding='utf-8').read()
open('sec65.html','w',encoding='utf-8').write(tpl.replace('@@ROWS@@',rows))
