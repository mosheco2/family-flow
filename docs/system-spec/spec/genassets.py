import json,os,collections,html
exec(open('gen.py').read().split('os.makedirs')[0])
S='/tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/'
man=json.load(open(S+'manifest.json')); via=json.load(open(S+'crawl.json'))['via']
idx=json.load(open('/home/user/family-flow/docs/system-spec/content/index.json'))
BIN=('.png','.jpg','.jpeg','.webp','.svg','.gif','.ico','.mp4','.mp3','.wav','.woff','.woff2','.ttf')
CAT={'A':'שרת (חובה)','B':'לקוח / דפים ונכסים בשימוש (חובה)','C':'מקורות תוכן ובנייה (מומלץ)','D':'תיעוד','E':'בדיקות (אופציונלי)','F':'גיבוי / קוד מת (לא נדרש)','G':'תפעול והגדרות','H':'ללא הפניה בקוד (לבדוק)'}
fmt=lambda n: f'{n/1048576:.1f}MB' if n>1048576 else f'{n//1024}KB'
# assets page
assets=[m for m in man if m['path'].lower().endswith(BIN)]
ac=collections.Counter(m['cat'] for m in assets); asz=collections.Counter()
for m in assets: asz[m['cat']]+=m['size']
rows=collections.defaultdict(list)
for m in assets: rows[m['cat']].append(m)
p=[f'<div class="intro"><strong>נכסים ומאגרי תוכן.</strong> העמוד מכיל מלאי של כל קובצי המדיה במאגר: תמונות, אייקונים, וידאו ו-SVG. לכל קובץ מצוין אם הוא בשימוש ומאיפה הוא נטען. הנכסים עצמם נמצאים ב-GitHub תחת <code>public/</code>, והם נמסרים גם כחבילת ZIP נפרדת. מאגרי התוכן, כלומר נתונים שקבועים בקוד וקובצי נתונים, חולצו לתיקייה <code>docs/system-spec/content/</code>: JSON לכל מאגר שאפשר היה להמיר, ו-JS גולמי לשאר. <br>סיכום הנכסים: '+' · '.join(f'{CAT[k]}: {ac[k]} קבצים ({fmt(asz[k])})' for k in sorted(ac))+'</div>']
p.append('<h2 class="grp">מאגרי תוכן · '+str(len(idx))+'</h2><section class="proc" data-f="content datasets"><div class="tbl-wrap"><table><thead><tr><th>מאגר</th><th>מקור בקוד</th><th>גודל</th><th>קובץ בחבילה</th></tr></thead><tbody>'+''.join(f"<tr data-f='{E(i['name'].lower())}'><td class='c'>{E(i['name'])}</td><td class='c'>{E(i['source'])}</td><td>{fmt(i['bytes'])}</td><td class='c'>{E(i['file'])}</td></tr>" for i in sorted(idx,key=lambda i:-i['bytes']))+'</tbody></table></div></section>')
for k in sorted(rows):
    rs=sorted(rows[k],key=lambda m:m['path'])
    p.append(f'<h2 class="grp">{E(CAT[k])} · {len(rs)}</h2><section class="proc" data-f="{k}"><div class="tbl-wrap"><table><thead><tr><th>קובץ</th><th>גודל</th><th>שימוש</th></tr></thead><tbody>'+''.join(f"<tr data-f='{E(m['path'].lower())}'><td class='c'>{E(m['path'])}</td><td>{fmt(m['size'])}</td><td>{E(m['why'])}</td></tr>" for m in rs)+'</tbody></table></div></section>')
open('out/assets.html','w',encoding='utf-8').write(shell('assets','נכסים ומאגרי תוכן',f'{len(assets)} נכסים · {len(idx)} מאגרים',''.join(p)))
# repo files page
rc=collections.Counter(m['cat'] for m in man); rsz=collections.Counter()
for m in man: rsz[m['cat']]+=m['size']
byc=collections.defaultdict(list)
for m in man: byc[m['cat']].append(m)
q=[f'''<div class="intro"><strong>רשימת קבצי המערכת ב-GitHub</strong> (<code>mosheco2/family-flow</code>). כל קובץ במאגר מסווג לפי התפקיד שלו, מלבד התיקייה <code>docs/system-spec/</code>, שהיא התיעוד הזה. הסיווג חושב מהפניות בין הקבצים: השרת, הדפים והסקריפטים, וגם טעינה דינמית מתיקיות.<br>
<strong>כדי להריץ ולבנות מחדש את המערכת הקיימת צריך את קטגוריות A ו-B, ומומלץ גם C.</strong> D הוא תיעוד, E בדיקות, F גיבויים וקוד מת שלא נדרשים, ו-G הגדרות. קבצי H לא נמצאה אליהם הפניה בקוד, וצריך לבדוק אם הם מוצגים מנתוני DB לפני שמוותרים עליהם.<br>
⚠️ <code>.env</code> ו-<code>.mcp.json</code> נמצאים במאגר. קבצי סודות לא אמורים להיות ב-git. הערכים מוגדרים בסביבת השרת (Render), ומומלץ להסיר אותם מהמאגר ולהחליף סודות שנחשפו.<br>
'''+' · '.join(f'{k} {CAT[k]}: {rc[k]} קבצים ({fmt(rsz[k])})' for k in sorted(rc))+'</div>']
for k in sorted(byc):
    rs=sorted(byc[k],key=lambda m:m['path'])
    q.append(f'<h2 class="grp">{k} · {E(CAT[k])} · {len(rs)} קבצים · {fmt(rsz[k])}</h2><section class="proc" data-f="{k}"><div class="tbl-wrap"><table><thead><tr><th>קובץ</th><th>גודל</th><th>סיבה</th></tr></thead><tbody>'+''.join(f"<tr data-f='{E(m['path'].lower())}'><td class='c'>{E(m['path'])}</td><td>{fmt(m['size'])}</td><td>{E(m['why'])}</td></tr>" for m in rs)+'</tbody></table></div></section>')
open('out/repo-files.html','w',encoding='utf-8').write(shell('repo-files','קבצי המערכת ב-GitHub',f'{len(man)} קבצים',''.join(q)))
# plain list
with open('/home/user/family-flow/docs/system-spec/REQUIRED_FILES.md','w',encoding='utf-8') as fh:
    fh.write('# רשימת הקבצים במאגר GitHub: mosheco2/family-flow\n\nכל הקבצים במאגר, ממוינים לפי תפקיד (חוץ מ-docs/system-spec). הרשימה נוצרה אוטומטית מהפניות בקוד. העמוד המלא, עם הסיבה לכל קובץ: spec/out/repo-files.html.\n\n')
    for k in sorted(byc):
        fh.write(f'\n## {k}. {CAT[k]} ({rc[k]} קבצים, {fmt(rsz[k])})\n\n')
        for m in sorted(byc[k],key=lambda m:m['path']): fh.write(f"- `{m['path']}`\n")
print(rc)
