import json,html
E=lambda s: html.escape(str(s))
d=json.load(open('bt.json')); L=d['_lines']
tabs={t['id']:t['name'] for t in d['ALL_TABS']}
bts=d['BUSINESS_TYPES']; cfg=d['BUSINESS_CONFIG']; sam=d['BIZ_TYPE_MODULES']; gn=d['GNAV_GROUPS']
price={}
for g in d['PRICING_CATALOG_DEFAULT']:
    for m in g.get('modules',[]): price.setdefault(m['id'],(m.get('price'),m.get('free'),g.get('groupName')))
gof={m:g for g,ms in gn.items() for m in ms}
mods=list(tabs)
for b in bts:
    for m in (b['modules'] or []):
        if m not in mods: mods.append(m)
for v in sam.values():
    for m in v:
        if m not in mods: mods.append(m)
o=['<div class="intro">כל הנתונים בעמוד נשלפו מקבועי התצורה בקוד הלקוח ומוצגים כפי שהם. המקורות:'+', '.join(f'<code>{k}</code> ({v})' for k,v in L.items())+'.<br><strong>חשוב:</strong> לפי ניתוח הלוגיקה העסקית, <code>BUSINESS_TYPES[].modules</code> לא משמש לחסימה בפועל, כי <code>getEnabledModules</code> לא נקרא בשום מקום (business-app.js:37599). החסימה בפועל נשענת על <code>billing_config</code>, <code>managed_modules</code> ו-<code>features</code> (ראו "לוגיקה · עסק"). לכן כל תא במטריצה מציין שני מקורות: <strong>B</strong> = מופיע ב-<code>BUSINESS_TYPES</code> בלקוח העסקי; <strong>S</strong> = מופיע ב-<code>BIZ_TYPE_MODULES</code> במסך ה-SA (ברירת המחדל שה-SA מציע); <strong>●</strong> = מופיע בשניהם. סוג <code>other</code> מוגדר עם <code>modules: null</code>, כלומר כל המודולים זמינים לו.</div>']
o.append('<h2 class="grp">סוגי עסק ומינוח</h2><section class="proc" data-f="business types terminology"><h3>15 סוגי העסק ו-BUSINESS_CONFIG</h3><div class="tbl-wrap"><table><thead><tr><th>id</th><th>שם</th><th></th><th>לקוח</th><th>לקוחות</th><th>מוצר</th><th>פגישה/תור</th><th>ספק</th><th>תמחור</th><th>הזמנה</th><th>מס׳ מודולים</th></tr></thead><tbody>')
for b in bts:
    c=cfg.get(b['id'],{})
    o.append(f"<tr><td><code>{b['id']}</code></td><td>{E(b['name'])}</td><td>{b['icon']}</td>"+''.join(f"<td>{E(c.get(k,'—'))}</td>" for k in ['customer','customer_pl','product','appointment','supplier','costing','order'])+f"<td>{len(b['modules']) if b['modules'] else 'הכל'}</td></tr>")
o.append('</tbody></table></div></section>')
o.append('<h2 class="grp">מטריצת מודולים × סוג עסק</h2><section class="proc" data-f="modules matrix"><h3>מודולים לפי סוג עסק, קבוצת ניווט ומחיר</h3><div class="tbl-wrap"><table><thead><tr><th>מודול</th><th>שם בממשק</th><th>קבוצת GNAV</th><th>מחיר ₪/חודש</th>'+''.join(f"<th title='{E(b['name'])}'>{b['icon']}<br><span style='font-size:10px'>{b['id']}</span></th>" for b in bts)+'</tr></thead><tbody>')
for m in mods:
    p=price.get(m); ps=('חינם' if p and p[1] else (str(p[0]) if p else '—'))
    cells=''
    for b in bts:
        inb = b['modules'] is None or m in (b['modules'] or [])
        ins = m in sam.get(b['id'],[])
        mark = '●' if (inb and ins) else ('B' if inb else ('S' if ins else ''))
        if b['modules'] is None: mark='כל'
        cells+=f"<td style='text-align:center'>{mark}</td>"
    o.append(f"<tr><td><code>{m}</code></td><td>{E(tabs.get(m,'—'))}</td><td>{gof.get(m,'—')}</td><td>{ps}</td>{cells}</tr>")
o.append('</tbody></table></div></section>')
# discrepancies
dis=[]
for b in bts:
    if b['modules'] is None: continue
    B=set(b['modules']); S=set(sam.get(b['id'],[]))
    if B-S-{'feed'} or S-B: dis.append(f"<tr><td><code>{b['id']}</code></td><td>{', '.join(sorted(B-S-{'feed'})) or '—'}</td><td>{', '.join(sorted(S-B)) or '—'}</td></tr>")
o.append('<h2 class="grp">אי-התאמות בין שני המקורות</h2><section class="proc" data-f="discrepancy"><h3>BUSINESS_TYPES (לקוח עסקי) מול BIZ_TYPE_MODULES (SA)</h3><div class="tbl-wrap"><table><thead><tr><th>סוג</th><th>רק ב-BUSINESS_TYPES</th><th>רק ב-BIZ_TYPE_MODULES</th></tr></thead><tbody>'+''.join(dis)+'</tbody></table></div><p>לפני הבנייה מחדש צריך להחליט מה מקור האמת היחיד (מועמד ליומן ההחלטות).</p></section>')
# roles
rd=d['ROLE_DEFAULTS']
o.append('<h2 class="grp">ברירות מחדל של טאבים לפי תפקיד (ROLE_DEFAULTS)</h2><section class="proc" data-f="roles role_defaults"><h3>תפקיד × טאב</h3><div class="tbl-wrap"><table><thead><tr><th>טאב</th>'+''.join(f'<th>{E(r)}</th>' for r in rd)+'</tr></thead><tbody>')
for m in mods:
    if not any(m in v for v in rd.values()): continue
    o.append(f"<tr><td><code>{m}</code> {E(tabs.get(m,''))}</td>"+''.join(f"<td style='text-align:center'>{'✓' if m in v else ''}</td>" for v in rd.values())+'</tr>')
o.append('</tbody></table></div></section>')
# pricing
o.append('<h2 class="grp">מחירון ברירת מחדל (PRICING_CATALOG_DEFAULT)</h2>')
for g in d['PRICING_CATALOG_DEFAULT']:
    rows=''.join(f"<tr><td><code>{E(m.get('id'))}</code></td><td>{E(m.get('name'))}</td><td>{'חינם' if m.get('free') else E(m.get('price'))}</td><td>{E(m.get('desc',''))}</td></tr>" for m in g.get('modules',[]))
    extra={k:v for k,v in g.items() if k not in ('modules','groupName','groupId','color')}
    o.append(f"<section class='proc' data-f='pricing {E(g.get('groupId',''))}'><h3>{E(g.get('groupName',''))} <code>{E(g.get('groupId',''))}</code></h3>"+(f"<pre class='sql'>{E(json.dumps(extra,ensure_ascii=False))}</pre>" if extra else '')+f"<div class='tbl-wrap'><table><thead><tr><th>id</th><th>שם</th><th>מחיר</th><th>תיאור</th></tr></thead><tbody>{rows}</tbody></table></div></section>")
open('s1-bizmatrix.html','w',encoding='utf-8').write(''.join(o))
print(len(mods),'modules', len(dis),'discrepant types')
