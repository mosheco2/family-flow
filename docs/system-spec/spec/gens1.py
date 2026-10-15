import json,re,html,collections,os
exec(open('gen.py').read().split('os.makedirs')[0])
S1=[('s1-glossary','מילון מונחים'),('s1-rbac','מטריצת הרשאות'),('s1-bizmatrix','מודולים × סוג עסק'),('s1-erd','מודל ישויות (ERD)'),('s1-messages','קטלוג הודעות'),('s1-prompts','קטלוג פרומפטים AI'),('s1-seed','נתוני ברירת מחדל'),('s1-docsvscode','מסמכים קיימים מול קוד')]
MER='''<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script><script>(function(){try{var dark=document.documentElement.getAttribute('data-theme')==='dark'||(document.documentElement.getAttribute('data-theme')!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);mermaid.initialize({startOnLoad:true,theme:dark?'dark':'neutral',securityLevel:'strict',er:{useMaxWidth:false}});}catch(e){}})();</script><style>pre.mermaid{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px;overflow-x:auto;direction:ltr;text-align:left}</style>'''
for k,t in S1:
    s=open(k+'.html',encoding='utf-8').read()
    n=len(re.findall(r'<section class="proc"',s))
    extra=MER if 'class="mermaid"' in s else ''
    open(f'out/{k}.html','w',encoding='utf-8').write(shell(k,t,f'{n} פריטים',s+extra))
    print(k,n,len(s)//1024,'KB')
