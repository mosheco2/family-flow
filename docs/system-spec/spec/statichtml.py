import re,json,html
P='/home/user/family-flow/public/'
CONT=re.compile(r'(tab|modal|screen|view|page|panel|section|wizard|step|dialog|drawer|sheet)',re.I)
res={}
for f in ['index.html','business.html','sa.html','kol-haam.html','kol-haam-author.html','storefront.html','zone-manager.html','member.html','community-store.html','menu.html','campaign.html','survey.html','track.html','marketplace.html','game.html']:
    try: h=open(P+f,encoding='utf-8').read()
    except FileNotFoundError: continue
    h=re.sub(r'<script.*?</script>','',h,flags=re.S); h=re.sub(r'<style.*?</style>','',h,flags=re.S)
    conts=[];cur=None
    for m in re.finditer(r'<label\b[^>]*>(?P<lab>(?:(?!<input|<select|<textarea|</label>).)*)</label>|<button\b(?P<ba>[^>]*)>(?P<bt>.*?)</button>|<h[1-4][^>]*>(?P<h>.*?)</h[1-4]>|<(?P<tag>\w+)\b(?P<at>[^>]*)>',h,re.S|re.I):
        if m.group('tag'):
            tag=m.group('tag').lower(); at=m.group('at')
            idm=re.search(r'\bid\s*=\s*"([^"]+)"',at)
            if idm and tag in('div','section','form','main','aside','dialog','nav') and CONT.search(idm.group(1)):
                cur={'id':idm.group(1),'line':h.count('\n',0,m.start())+1,'inputs':[],'buttons':[],'labels':[],'heads':[]}; conts.append(cur)
            elif tag in('input','select','textarea') and cur is not None:
                g=lambda n:(re.search(r'\b'+n+r'\s*=\s*"([^"]*)"',at) or [None,''])[1]
                cur['inputs'].append((tag,g('type') or ('text' if tag=='input' else ''),g('id'),g('placeholder'),'req' if 'required' in at else ''))
        elif cur is not None:
            txt=lambda s: re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',s or '')).strip()[:70]
            if m.group('lab') is not None: cur['labels'].append(txt(m.group('lab')))
            elif m.group('bt') is not None:
                oc=(re.search(r'onclick\s*=\s*"([^"]*)"',m.group('ba') or '') or [None,''])[1][:70]
                t=txt(m.group('bt'))
                if t: cur['buttons'].append((t,oc))
            elif m.group('h') is not None: cur['heads'].append(txt(m.group('h')))
    res[f]=[c for c in conts if c['inputs'] or c['buttons'] or c['heads']]
json.dump(res,open('static.json','w'),ensure_ascii=False)
for f,v in res.items(): print(f,len(v),'containers',sum(len(c['inputs']) for c in v),'inputs')
