import json,os,re,collections
os.chdir('/home/user/family-flow')
S='/tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/'
d=json.load(open(S+'crawl.json')); reached=set(d['reached']); dyn=json.load(open(S+'dyn.json')); via=d['via']
BACKUP=re.compile(r'(030426|old1|old2|old\.|old55|old123|old2222|bunner1old|/old/|^old/|github|server1\.js|servertemp|server \(1\)|\(1\)\.)',re.I)
out=[]
for f in d['files']:
    sz=os.path.getsize(f) if os.path.exists(f) else 0
    b=os.path.basename(f); top=f.split('/')[0]
    if f.startswith('public/old/') or BACKUP.search(f): cat,why='F','גיבוי / גרסה ישנה (לא בשימוש)'
    elif f in ('server.js','package.json','package-lock.json','services/whatsapp.js'): cat,why='A','שרת: נטען בהפעלה'
    elif f=='build.js' or f.startswith('public/comic-pages/'): cat,why='C','מקור לבנייה: build.js מייצר את public/comic.html (תמונות מוטמעות כ-base64)'
    elif f.startswith('public/images/products/'): cat,why='C','תמונות מוצרים שנטענו לקטלוג (מקושרות מנתוני DB, scripts/attach-moti-toys-images.js)'
    elif f in ('seed_quizzes.js','seedqabook.js','reset-db.js','services/seed_quizzes.js') or f.startswith('scripts/'): cat,why='C','סקריפט נתונים / זריעה / תחזוקה חד-פעמי (לא נדרש להרצה, שימושי לשחזור תוכן)'
    elif f.startswith('public/') and f.endswith('.md'): cat,why='D','מסמך פנימי שמוגש מתיקיית public (מוצג במציג המסמכים של SA)'
    elif f.startswith('public/') and (f in reached or (f in dyn and not dyn[f].startswith('old')) or f.startswith('public/marketing/assets/')):
        if f.startswith('public/docs/'): cat,why='D','מסמך פנימי שמוגש מתיקיית public'
        elif f in reached and f.endswith('.html'): cat,why='B','דף שמוגש ללקוח'
        elif f in reached: cat,why='B','קובץ לקוח בשימוש'+(f' (מקושר מ-{via[f]})' if f in via else '')
        else: cat,why='B','נכס שנטען דינמית מתיקייה ('+(dyn.get(f) or 'marketing/assets')+')'
    elif top in ('tests','test','QA tests') or b in ('playwright.config.js','test-screenshot.js','test-db.js') or b.endswith('.spec.js'): cat,why='E','בדיקות'
    elif top=='docs' or (('/' not in f) and f.endswith('.md')) or f.endswith('SPECIFICATION.html'): cat,why='D','תיעוד / אפיון קיים'
    elif f in ('apply-changes-on-approval.yml',) or top=='.claude' or b in ('.gitignore',): cat,why='G','תפעול/כלי פיתוח (workflow, הגדרות Claude)'
    elif top in ('routes','middleware') or f in ('services/authService.js',): cat,why='F','קוד מת: לא מחובר לשרת'
    elif f.startswith('public/guide-biz-') or f=='public/.well-known/assetlinks.json':
        cat,why='B','נכס בשימוש (נטען דינמית ב-biz-pitch.html / אימות אפליקציית Android)'
    elif f in ('.env','.mcp.json'):
        cat,why='G','קובץ הגדרות/סודות: נמצא במאגר ולא אמור להיות בו (לא נדרש בהעתקה; ערכים מוגדרים בסביבת השרת)'
    elif f.startswith('public/'):
        cat,why='H','לא נמצאה הפניה בקוד (ייתכן שמוזכר מנתוני DB או לא בשימוש)'
    else: cat,why='H','לא נמצאה הפניה בקוד'
    out.append(dict(path=f,size=sz,cat=cat,why=why))
json.dump(out,open(S+'manifest.json','w'),ensure_ascii=False)
c=collections.Counter(o['cat'] for o in out); print(c)
for k in 'ABCDEFGH': print(k, sum(o['size'] for o in out if o['cat']==k)//1024,'KB')
print([o['path'] for o in out if o['cat']=='H'][:60])
