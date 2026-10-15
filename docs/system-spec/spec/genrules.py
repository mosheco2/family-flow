import json,re,html,collections,os
exec(open('gen.py').read().split('os.makedirs')[0])
RULES=[('rules-auth','לוגיקה · אימות וזהות'),('rules-family','לוגיקה · משפחה'),('rules-biz','לוגיקה · ליבת עסק'),('rules-store','לוגיקה · חנות וקופה'),('rules-restaurant','לוגיקה · מסעדה ומזון'),('rules-sport','לוגיקה · ספורט'),('rules-beauty','לוגיקה · יופי'),('rules-logistics','לוגיקה · לוגיסטיקה'),('rules-services','לוגיקה · תחזוקה ומקצועי'),('rules-community','לוגיקה · קהילה ומנהלי אזור'),('rules-kolhaam','לוגיקה · קול העם'),('rules-routines','לוגיקה · שגרות (עסק)'),('rules-sa','לוגיקה · Super Admin')]
INTRO='<div class="intro"><strong>לוגיקה עסקית לבנייה מחדש.</strong> בכל תהליך מתועדים, לפי סדר: מטרה וטריגר, תנאים ואימותים, שלבי עיבוד (כולל סדר הכתיבות ל-DB), חישובים ונוסחאות, מכונת מצבים, תופעות לוואי (התראות, מטבעות, AI, cron), התנהגות הממשק, ולבסוף פערים. רוב התוכן מתאר את ההתנהגות כפי שהיא ממומשת. "פערים" הוא החלק האחרון, ומופיע רק כשנמצא בקוד. כל כלל מגובה במספר שורה (server.js:N או file.js:N). החוזה הטכני של כל נתיב נמצא בעמודי ה-API, והסכמה במילון הנתונים.</div>'
for k,t in RULES:
    s=open(k+'.html',encoding='utf-8').read()
    s=re.sub(r'<section class="proc"',' <section class="proc"',s)
    n=len(re.findall(r'<section class="proc"',s))
    open(f'out/{k}.html','w',encoding='utf-8').write(shell(k,t,f'{n} תהליכים',INTRO+s))
    print(k,n)
