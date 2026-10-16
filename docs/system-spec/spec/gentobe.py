import json,re,html,os,glob
exec(open('gen.py').read().split('os.makedirs')[0])
TO=[('tobe-arch','אפיון יעד · ארכיטקטורה ופלטפורמה'),('tobe-auth','אפיון יעד · אימות וזהות'),('tobe-family','אפיון יעד · משפחה'),('tobe-biz','אפיון יעד · ליבת עסק'),('tobe-routines','אפיון יעד · שגרות'),('tobe-store','אפיון יעד · חנות וקופה'),('tobe-restaurant','אפיון יעד · מסעדה ומזון'),('tobe-sport','אפיון יעד · ספורט'),('tobe-beauty','אפיון יעד · יופי'),('tobe-logistics','אפיון יעד · לוגיסטיקה'),('tobe-services','אפיון יעד · תחזוקה, שירות ומקצועי'),('tobe-community','אפיון יעד · קהילה ומנהלי אזור'),('tobe-kolhaam','אפיון יעד · קול העם'),('tobe-sa','אפיון יעד · Super Admin'),('tobe-routes','אפיון יעד · מפת נתיבים'),('tobe-reconcile','אפיון יעד · יישוב סתירות'),('tobe-journeys','אפיון יעד · מסעות משתמש')]
cnt={}
for k,t in TO:
    if not os.path.exists(k+'.html'): continue
    s=open(k+'.html',encoding='utf-8').read()
    n=len(re.findall(r'<section class="proc"',s)); cnt[k]=n
    open(f'out/{k}.html','w',encoding='utf-8').write(shell(k,t,f'{n} פריטים',s))
# index
maps={}
for f in glob.glob('tobe-*-map.json'):
    try: maps[f]=json.load(open(f))
    except: pass
cls={}
for m in maps.values():
    for k,v in m.get('classification',{}).items(): cls[k]=v
rev=sum(len(m.get('revised',{})) for m in maps.values())
import collections
cc=collections.Counter(cls.values())
cards=''.join(f'<a class="card" data-f="{E(t)}" href="{k}.html" style="display:block;padding:14px 16px;text-decoration:none;color:inherit"><strong>{E(t.replace("אפיון יעד · ",""))}</strong><div class="count">{cnt.get(k,0)} פריטים</div></a>' for k,t in TO if k in cnt)
intro=f'''<div class="intro"><strong>אפיון היעד: איך המערכת צריכה לעבוד.</strong> העמודים כאן הם האפיון המחייב לבנייה מחדש. הם נבנו מתיאור המערכת הקיימת (as-built) ומ-671 ההחלטות ביומן ההחלטות, שכולן אושרו.<br>
<strong>כלל העל:</strong> שומרים על מהות המערכת ועל כל יכולת ופעולה שקיימות היום. מתקנים את מה שבור, מאבטחים את מה שפתוח, ומאחדים את מה שכפול, אבל לא מסירים ולא מצמצמים יכולת. {rev} החלטות שהיו מצמצמות או משנות יכולת הוחלפו בגרסה שמרנית, וכל אחת מתועדת ב-intro של התחום שלה.<br>
<strong>סיווג ההחלטות:</strong> {" · ".join(f"{k}: {v}" for k,v in cc.most_common())}.<br>
<strong>כיסוי שנבדק:</strong>
<ul style="margin:6px 0 0;padding-inline-start:20px"><li>כל 667 תהליכי ה-as-built קיימים באפיון היעד.</li><li>669 מתוך 671 החלטות יושמו בתהליכים, ושתי הנותרות ברמה הרוחבית.</li><li>לכל אחד מ-1,511 הנתיבים יש קביעה מה קורה לו ביעד (מפת נתיבים).</li><li>36 סתירות בין תחומים יושבו (RECON).</li><li>מסעות משתמש מקצה לקצה נבדקו ותוקנו (E2E).</li></ul>
בכל תהליך השורה "שינויים מהקיים" מפרטת את מזהי ההחלטות שהוחלו עליו. את המזהים אפשר לחפש <a href="https://claude.ai/artifact/6uMxdB6giHLGEEdh7UM5sz">ביומן ההחלטות</a>.</div>'''
open('out/tobe-index.html','w',encoding='utf-8').write(shell('tobe-index','אפיון יעד לבנייה מחדש',f'{sum(cnt.values())} פריטים',intro+f'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">{cards}</div>'))
print(cnt, rev, cc)
