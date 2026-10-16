import json,re,html,os,collections
exec(open('gen.py').read().split('os.makedirs')[0])  # reuse E, shell, PAGES, api etc.
src=open('/home/user/family-flow/server.js',encoding='utf-8').read(); L=src.split('\n')
fmap={f['name']:f for f in funcs}
# crons
crons=[]
for i,l in enumerate(L):
    for m in re.finditer(r'setInterval\(\s*(async\s*)?(\(\)\s*=>\s*\{|(\w+))\s*,?\s*([^;]*)',l):
        name=m.group(3) or 'anonymous'
        tail=l[m.end(2):]
        iv=re.search(r',\s*([\d\s\*\.]+|\w+)\s*\)\s*;?',tail)
        interval=iv.group(1).strip() if iv and name!='anonymous' else ''
        if name=='anonymous':
            for k in range(i,min(i+40,len(L))):
                mm=re.search(r'^\s*\},\s*([\d\s\*\.]+|\w+)\s*\)',L[k])
                if mm: interval=mm.group(1).strip(); break
        body=''
        if name=='anonymous':
            j=i; buf=[]
            while j<len(L) and j<i+40:
                buf.append(L[j]); 
                if re.match(r'^\s*\},\s*[\d\w]',L[j]): break
                j+=1
            body='\n'.join(buf)
        crons.append(dict(line=i+1,name=name,interval=interval,body=body))
def human(iv):
    try:
        v=eval(iv.replace('CRON_INTERVAL_MS','86400000'),{}) if re.match(r'^[\d\s\*\.]+$|^CRON',iv) else None
    except Exception: v=None
    if not v: return iv
    s=v/1000
    if s<3600: return f'{s/60:g} דק׳'
    if s<86400: return f'{s/3600:g} שע׳'
    return f'{s/86400:g} ימים'
rows=''
for c in crons:
    f=fmap.get(c['name'])
    sqls=f['sql'] if f else [re.sub(r'\s+',' ',x).strip()[:400] for x in re.findall(r'`([^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*)`',c['body'],re.S)]
    loc=f'server.js:{f["line"]}' if f else f'server.js:{c["line"]}'
    rows+=f'<details class="card" data-f="{E(c["name"].lower())}"><summary><span class="p"><strong>{E(c["name"])}</strong></span><span class="tag ok">כל {E(human(c["interval"]))}</span><span class="ln">setInterval :{c["line"]} · הגדרה {loc}</span></summary><div class="body"><div class="sqls">{"".join(f"<pre class=sql>{E(q)}</pre>" for q in sqls) or "<span class=count>אין SQL ישיר (ניקוי מפה בזיכרון / קריאה לפונקציות אחרות)</span>"}</div></div></details>'
env=collections.defaultdict(list)
for i,l in enumerate(L):
    for v in re.findall(r'process\.env\.([A-Z_0-9]+)',l): env[v].append(i+1)
envdesc={'DATABASE_URL':'חיבור PostgreSQL (pg Pool)','PORT':'פורט HTTP (ברירת מחדל 3000)','GEMINI_API_KEY':'מפתח Google Gemini (רוב פיצ׳רי ה-AI)','ANTHROPIC_API_KEY':'מפתח Claude (Copilot קול העם, ai-analyze בקהילה)','SMTP_USER':'חשבון SMTP לשליחת מיילים (nodemailer)','SMTP_PASS':'סיסמת SMTP','SMS_SERVICE':'בחירת ספק SMS','TWILIO_ACCOUNT_SID':'Twilio SMS','TWILIO_AUTH_TOKEN':'Twilio SMS','TWILIO_PHONE_NUMBER':'מספר השולח ב-Twilio','APP_URL':'כתובת בסיס לקישורים במיילים/הודעות','BASE_URL':'כתובת בסיס חלופית','NODE_ENV':'סביבה','SEED_SECRET':'סוד לנתיבי seed','SUPERADMIN_PHONE':'טלפון SA להתראות','PIXABAY_API_KEY':'חיפוש תמונות','PEXELS_API_KEY':'חיפוש תמונות','HF_TOKEN':'HuggingFace'}
envrows=''.join(f'<tr data-f="{v.lower()}"><td class="c">{v}</td><td>{E(envdesc.get(v,""))}</td><td class="c">{", ".join(map(str,ls[:12]))}</td></tr>' for v,ls in sorted(env.items()))
pkg=json.load(open('/home/user/family-flow/package.json'))
deprows=''.join(f'<tr><td class="c">{k}</td><td class="c">{v}</td></tr>' for k,v in pkg['dependencies'].items())
htmls=sorted(f for f in os.listdir('/home/user/family-flow/public') if f.endswith('.html'))
pub=''.join(f'<code>{E(h)}</code>' for h in htmls)
stack='''<ol style="margin:0;padding-inline-start:20px;font-size:13px;display:grid;gap:4px">
<li><code>compression()</code> (:90)</li><li><code>cors()</code> ללא הגבלת origin (:91)</li>
<li>הפניית 301 מ-oneflowlife.co.il ל-weflowz.co.il (:94)</li>
<li><code>express.json({limit:'20mb'})</code> (:102)</li>
<li>Audit אוטומטי: כל POST/PUT/PATCH/DELETE שהסתיים ב-2xx/3xx ונשא <code>req.bizAuth.groupId</code> נרשם דרך <code>logBizAction</code> עם 12 שדות body ראשונים, בלי מפתחות password/token/secret/signature. יש רשימת החרגות מדויקת ורשימת regex (:105–144)</li>
<li><code>express.urlencoded</code> 20mb (:145)</li>
<li>הגשת WebP אוטומטית כש-Accept כולל image/webp וקיים ‎.webp תואם. fallback מ-PNG ל-SVG תחת images/home (:147)</li>
<li>הזרקת og:title/og:image לשבע תבניות storefront לפי <code>?store=</code>/<code>?g=</code>, כש-logo מסוג data: מוגש דרך <code>/api/public/store-logo/:id</code> (:162–209)</li>
<li><code>express.static('public')</code>: תמונות immutable ל-7 ימים, js/css/html עם no-cache (:211)</li>
<li>אחריהם כל 1,511 נתיבי ה-API, כל אחד עם middleware משלו ברישום. אין router מאוחד ואין middleware גלובלי של auth. האזנה ב-<code>app.listen</code> (:44130). <code>initDB()</code> (:4406) יוצר את הסכמה בעלייה.</li></ol>'''
content=f'''<div class="intro">תשתית ההרצה כפי שעולה מהקוד: שרשרת ה-middleware הגלובלית, משתני סביבה, תהליכי רקע (כולם <code>setInterval</code> בתוך התהליך, בלי תור או cron חיצוני, כך שבכמה מופעים כל משימה תרוץ בכל מופע), תלויות npm ונקודות כניסה סטטיות.</div>
<h2 class="grp">שרשרת middleware גלובלית (לפי סדר)</h2><div class="card"><div class="body">{stack}</div></div>
<h2 class="grp">תהליכי רקע · {len(crons)}</h2>{rows}
<h2 class="grp">משתני סביבה · {len(env)}</h2><div class="card"><div class="body tbl-wrap"><table><thead><tr><th>משתנה</th><th>שימוש</th><th>שורות</th></tr></thead><tbody>{envrows}</tbody></table></div></div>
<h2 class="grp">תלויות (package.json)</h2><div class="card"><div class="body tbl-wrap"><table><thead><tr><th>חבילה</th><th>גרסה</th></tr></thead><tbody>{deprows}</tbody></table><p class="count">start: <code>{E(pkg["scripts"]["start"])}</code>. <code>jsonwebtoken</code> לא מופיע, ו-<code>routes/auth.js</code>/<code>routes/users.js</code> לא מחוברים.</p></div></div>
<h2 class="grp">דפי HTML ב-public · {len(htmls)}</h2><div class="card"><div class="body chips">{pub}</div></div>'''
open('out/ops.html','w',encoding='utf-8').write(shell('ops','תפעול ותשתית',f'{len(crons)} תהליכי רקע · {len(env)} משתני סביבה',content))
# index
cards=''
counts={k:sum(1 for r in api if bucket(r['path'])==k) for k,_,_ in BUCKETS}
for k,t in PAGES[1:]:
    n={'db':f'{len([x for x in schema if re.match(r"^[a-z_][a-z0-9_]*$",x)])} טבלאות','functions':f'{len(funcs)} פונקציות','ops':f'{len(crons)} תהליכי רקע','ui-biz':'business-app.js + business.html','ui-family':'app.js + index.html','ui-sa':'sa-app.js + sa.html','ui-other':'ZM, קול העם, חנויות, שאר'}.get(k,'תהליכים עסקיים' if k.startswith('rules-') else ('שכבת אפיון' if k.startswith('s1-') else ('קטלוג טקסטים' if k.startswith('texts-') else ('מלאי ורשימות' if k in ('assets','repo-files') else ('אפיון יעד' if k.startswith('tobe-') else f'{counts.get(k,0)} נתיבים')))))
    cards+=f'<a class="card" data-f="{E(t)}" href="{k}.html" style="display:block;padding:14px 16px;text-decoration:none;color:inherit"><strong>{E(t)}</strong><div class="count">{n}</div></a>'
nomw=sum(1 for r in api if not r['mw']); sh=sum(1 for r in api if r['shadowed_by'])
content=f'''<div class="intro"><strong>שכבת המפרט לבנייה מחדש.</strong> המסמך הראשי מתאר יכולות, זרימות וממצאים. העמודים כאן מוסיפים את הפרטים המדויקים שנחוצים למימוש מחדש, וכולם חולצו מכנית מהקוד: server.js (46,397 שורות) וקבצי הלקוח (כ-104 אלף שורות JS ועוד דפי HTML):
<ul style="margin:8px 0 0;padding-inline-start:20px">
<li><strong>חוזה API</strong> לכל אחד מ-{len(api)} הנתיבים: middleware, קלטים, שגיאות, תשובה ו-SQL מלא.</li>
<li><strong>מילון נתונים</strong> של כל הטבלאות והעמודות, עם מקור כל עמודה.</li>
<li><strong>מפרט מסכים</strong> לכל ארבע הסביבות: קבועי תצורה (ניווט, מודולים לפי סוג עסק, מינוח), מסכים סטטיים, וכל פונקציית רינדור עם שדות הטופס, הכפתורים וקריאות ה-API שלה, כולל קישור לחוזה בשרת.</li><li><strong>לוגיקה עסקית</strong> ב-13 תחומים, 667 תהליכים: טריגרים, אימותים, סדר פעולות, נוסחאות, מכונות מצבים, תופעות לוואי והתנהגות ממשק.</li><li><strong>שכבת אפיון:</strong> מילון מונחים, מטריצת הרשאות, מודולים לפי סוג עסק, מודל ישויות (ERD), קטלוג הודעות, קטלוג פרומפטים של AI, נתוני ברירת מחדל, והשוואה בין מסמכי האפיון הקיימים לקוד.</li><li><strong>קטלוג פונקציות עזר.</strong></li>
<li><strong>תשתית:</strong> middleware גלובלי, תהליכי רקע, משתני סביבה ותלויות.</li></ul>
<p style="margin:8px 0 0">מדדים: {nomw} נתיבים בלי middleware ברישום · {sh} נתיבים מוצלים (רישום כפול) · {sum(1 for r in api if r["pooltx"])} עם <code>pool.query('BEGIN')</code> · {sum(1 for r in api if r["ai"])} עם קריאת AI.</p></div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">{cards}</div>'''
open('out/index.html','w',encoding='utf-8').write(shell('index','מפרט טכני מלא',f'{len(api)} נתיבים',content))
print(len(crons),'crons',len(env),'env')
