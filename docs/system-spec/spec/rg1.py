import re,sys,html
f=sys.argv[1]; pat=re.compile(sys.argv[2],re.I); n=int(sys.argv[3]) if len(sys.argv)>3 else 2; w=int(sys.argv[4]) if len(sys.argv)>4 else 250
t=html.unescape(re.sub(r'<[^>]+>',' ',open(f).read())); t=re.sub(r'\s+',' ',t)
for i,m in enumerate(pat.finditer(t)):
    if i>=n: break
    print('…'+t[max(0,m.start()-w//2):m.end()+w]+'…')
