import json,sys,re
a=json.load(open('api.json'));s=json.load(open('schema.json'))
def r(pat):
    out=[(x['method'],x['path'],x['line'],','.join(x['mw'])) for x in a if re.search(pat,x['path'])]
    return out
def t(name): return name in s
if __name__=='__main__':
    mode=sys.argv[1]
    for q in sys.argv[2:]:
        if mode=='r':
            res=r(q); print(f'## {q}: {len(res)}'); [print('  ',*x) for x in res[:12]]
        elif mode=='c':
            print(q, len(r(q)))
        else: print(q, t(q), (list(s[q])[:0] if t(q) else ''))
