import re,sys,glob,html
# grep stripped text of rules pages: prints file + snippet around match
pat=re.compile(sys.argv[1],re.I); n=int(sys.argv[2]) if len(sys.argv)>2 else 6
for f in sorted(glob.glob('rules-*.html')):
    t=html.unescape(re.sub(r'<[^>]+>',' ',open(f).read())); t=re.sub(r'\s+',' ',t)
    c=0
    for m in pat.finditer(t):
        print(f, '…'+t[max(0,m.start()-160):m.end()+220]+'…'); c+=1
        if c>=n: break
