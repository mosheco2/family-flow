#!/usr/bin/env python3
# Generates s1-prompts.html — verbatim AI prompt catalog (read-only extraction).
import html, os
ROOT = '/home/user/family-flow'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 's1-prompts.html')
_cache = {}
def lines(f):
    if f not in _cache:
        p = os.path.join(ROOT, f if f == 'server.js' else 'public/' + f)
        with open(p, encoding='utf-8') as fh:
            _cache[f] = fh.read().split('\n')
    return _cache[f]

def auto_end(f, s):
    L = lines(f)
    for i in range(s - 1, len(L)):
        if '`;' in L[i]:
            return i + 1
    raise Exception('no end ' + f + str(s))

def block(f, s, e=None, label=''):
    if e is None: e = auto_end(f, s)
    txt = '\n'.join(lines(f)[s - 1:e])
    # remove common leading indentation for readability (content unchanged otherwise)
    ls = txt.split('\n')
    ind = min((len(l) - len(l.lstrip(' ')) for l in ls if l.strip()), default=0)
    txt = '\n'.join(l[ind:] if len(l) >= ind else l for l in ls)
    cap = f'<p class="src"><b>{html.escape(label)}</b> — <code>{f}:{s}–{e}</code> (העתק מילולי)</p>' if label else f'<p class="src"><code>{f}:{s}–{e}</code> (העתק מילולי)</p>'
    return cap + '<pre class="sql">' + html.escape(txt) + '</pre>'

E = html.escape
def code(s): return '<code>' + E(s) + '</code>'

def table(head, rows):
    h = ''.join(f'<th>{c}</th>' for c in head)
    b = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<div class="tbl-wrap"><table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'

FEATURES = []  # (group, dict)
def F(group, **k):
    FEATURES.append((group, k))

# ------------------------------------------------------------------
G_INFRA = 'תשתית: לקוחות AI, סוללה ומכסות'
G_SA = 'סופר-אדמין (SA)'
G_FAM = 'משפחה (FAMILY) ומשותף FAMILY/BIZ'
G_BIZ = 'עסק (BIZ)'
G_IMG = 'תמונות: יצירה, חיפוש סטוק ו-Vision'
G_ZM = 'מנהל אזור (ZONE-MANAGER) וקהילה'
G_KH = 'קול העם (Kol HaAm) — Anthropic Claude'
G_GUIDE = 'מדריכים (Guide chat)'
G_CLIENT = 'פרומפטים שנבנים בצד הלקוח (Passthrough)'

# ============================ SA ============================
F(G_SA, id='sa-legacy-chat', title='צ\'אט AI ישן לסופר-אדמין', kw='sa chat legacy ai/chat gemini',
  route='POST /api/ai/chat', where='server.js:4720', mw='verifySA',
  client='לא נמצאה קריאה מצד הלקוח (חיפוש ב-public/*.js, *.html)',
  provider='Gemini (REST)', model='דינמי — callGeminiDirect (server.js:6260)', params='ללא (body: contents.parts.text בלבד, server.js:6301)',
  inputs=code('req.body.message'),
  prompts=[('server.js', 4728, 4735, 'systemInstruction + prompt')],
  output='טקסט חופשי; מוחזר כ-<code>{success, reply}</code> ללא פענוח (server.js:4739).',
  errors='חסר מפתח → 500 "מפתח Gemini אינו מוגדר בשרת." (server.js:4724-4726); חריגה → 500 "תקלת תקשורת מול גוגל: …" (server.js:4742).',
  quota='אין handleAITokens, אין לוג שימוש.')

F(G_SA, id='sa-flow-ai', title='FLOW AI — עוזרת סופר-אדמין עם NEED_DATA ו-EXECUTE', kw='sa flow ai need_data execute action suggestions',
  route='POST /api/sa/ai/chat', where='server.js:4980', mw='verifySA',
  client='sa-app.js:8067 <code>sendSAAIMessage</code> (fetch ב-8106); אישור פעולה רגישה: sa-app.js:7974 <code>confirmSAAIAction</code> → POST /api/sa/ai/confirm-action (server.js:5091)',
  provider='Gemini (REST)', model='דינמי — callGeminiDirect', params='ללא',
  inputs='<code>message</code>, <code>context.currentTab</code>, <code>context.extra</code> (server.js:4982); בסבב שני: <code>JSON.stringify(fetchSAAdditionalData(provider))</code> (server.js:4749)',
  prompts=[('server.js', 4988, 5034, 'systemPrompt (סבב 1)'), ('server.js', 5042, 5042, 'followupPrompt (סבב 2 — רק אם הוחזר NEED_DATA)')],
  output='''תהליך דו-שלבי: regex <code>/\\[NEED_DATA:([^\\]]+)\\]/</code> (server.js:5038) → שליפת provider ושליחה חוזרת. אחר כך:
<ul><li><code>&lt;SUGGESTIONS&gt;[…]&lt;/SUGGESTIONS&gt;</code> → JSON.parse למערך הצעות (server.js:5048-5052).</li>
<li>ניווט: <code>/\\[ACTION:(TAB|SUBTAB|LEDGER)\\|([^\\]]+)\\]/g</code> → מערך actions (server.js:5056-5063).</li>
<li>ביצוע: <code>/\\[ACTION:EXECUTE\\|([^|\\]]+)\\|?([^\\]]*)\\]/</code> (server.js:5067). אם action_type ב-<code>SA_AI_SENSITIVE_ACTIONS</code> (server.js:4869: REJECT_ZM, REJECT_BIZ_COMMUNITY, REJECT_COMMUNITY_JOIN, REJECT_PROMO, DENY_MODULE_REQUEST, REMOVE_BIZ_FROM_COMMUNITY) → מוחזר <code>pending_action</code> לאישור; אחרת מבוצע מיד ע"י <code>executeSAAction</code> (server.js:4872) ונרשם ב-logBizAction עם action <code>SA_AI_&lt;type&gt;</code> (server.js:5076).</li>
<li>כל תגיות <code>[ACTION:…]</code> מוסרות מהטקסט (server.js:5081).</li></ul>
providers ל-NEED_DATA: tickets, banner_orders, store_orders, billing, communities, businesses, families, wallets, zone_managers, pending_all, users_count, platform_stats, ai_usage, dev_tasks (מוגדרים בפרומפט ובמימוש server.js:4749-4868).''',
  errors='חסר מפתח → 500 (server.js:4983); חריגה → 500 עם e.message (server.js:5086).',
  quota='אין handleAITokens.')

F(G_SA, id='sa-build-business', title='בונה עסק AI (קטלוג/פרופיל מלא)', kw='sa ai build business catalog generator maintenance sport flux',
  route='POST /api/sa/ai-build-business', where='server.js:5183', mw='verifySA',
  client='sa-app.js:15497 <code>aiGenerateBusiness</code> (fetch ב-15516)',
  provider='Gemini (REST)', model='דינמי — callGeminiDirect', params='ללא',
  inputs='<code>businessName, businessNameEn, businessType, style, audience, languages (ברירת מחדל [\'he\']), productCount (ברירת מחדל 20)</code> (server.js:5185); נגזרים: <code>langStr</code>, <code>isSport</code>, <code>isMaintenance</code>.',
  prompts=[('server.js', 5185, 5420, 'הגדרת משתנים + פרומפט בשלושה ענפים (maintenance_repair / sport / ברירת מחדל מזון-קמעונאות)')],
  output='JSON. מנקה גדרות ```json בתחילה/סוף (server.js:5424) ו-JSON.parse; כשל → <code>{success:false, error:\'parse_error\', raw}</code> (server.js:5427). הצלחה → <code>{success, data, bizType}</code>.',
  errors='<code>!apiKey</code> → <code>{success:false,error:\'AI not configured\'}</code> (server.js:5422); חריגה → <code>{success:false,error}</code> (server.js:5430-5431).',
  quota='אין.')

F(G_SA, id='sa-brand-prompts', title='יצירת פרומפטים ללוגו/באנר (FLUX)', kw='sa brand prompts logo banner flux',
  route='POST /api/sa/ai-gen-brand-prompts', where='server.js:5624', mw='verifySA',
  client='sa-app.js:16145 <code>renderAIBBranding</code> (fetch ב-16159)',
  provider='Gemini (REST)', model='דינמי — callGeminiDirect', params='ללא',
  inputs='<code>businessName, businessNameEn, businessType, slogan, description</code> (server.js:5626)',
  prompts=[('server.js', 5628, 5661, 'prompt')],
  output='ניקוי גדרות ```json ו-JSON.parse (server.js:5662-5663); מחזיר <code>logo_prompt, banner_prompt</code>. התמונה עצמה נוצרת בלקוח דרך Pollinations (ראו קבוצת תמונות).',
  errors='<code>!getGenAIInstance()</code> → AI not configured (server.js:5627); חריגה/parse → <code>{success:false,error}</code> (server.js:5665).',
  quota='אין.')

F(G_SA, id='sa-triage', title='FamilAI Triage — סיווג קריאת שירות', kw='sa ticket triage sentiment priority',
  route='POST /api/superadmin/tickets/:id/ai-triage', where='server.js:6077', mw='verifySA',
  client='sa-app.js:6920 <code>runFamilAITriage</code>',
  provider='Gemini (REST)', model='דינמי — callGeminiDirect', params='ללא',
  inputs='<code>support_tickets.subject, description</code> (server.js:6083)',
  prompts=[('server.js', 6088, 6101, 'prompt')],
  output='מסיר ```json/``` ו-JSON.parse (server.js:6104-6105). כותב <code>priority</code>, <code>ticket_type</code> ושורת audit פנימית ל-<code>log</code> (server.js:6110-6117).',
  errors='חריגה → 500 (server.js:6123).', quota='אין.')

F(G_SA, id='sa-dedup', title='זיהוי כפילות קריאה מול משימות פיתוח', kw='sa dev duplicate tasks',
  route='POST /api/sa/dev/check-duplicates', where='server.js:6188', mw='verifySA',
  client='sa-app.js:6977 <code>convertTicketToDevTask</code>',
  provider='Gemini (REST)', model='דינמי — callGeminiDirect', params='ללא',
  inputs='<code>req.body.description</code>; <code>sa_dev_tasks</code> בסטטוס backlog/in_progress/qa (server.js:6191)',
  prompts=[('server.js', 6196, 6200, 'prompt')],
  output='ניקוי גדרות ו-JSON.parse; מחזיר <code>{success, ...aiData}</code> (server.js:6203-6206). אם אין משימות פעילות — מחזיר isDuplicate:false בלי AI (server.js:6194).',
  errors='500 "שגיאת AI: …" (server.js:6209).', quota='אין.')

F(G_SA, id='sa-ai-generate', title='מחולל טקסט חופשי לסופר-אדמין (Passthrough)', kw='sa ai generate release notes branding passthrough',
  route='POST /api/sa/ai-generate', where='server.js:6345', mw='verifySA <b>+</b> בדיקה ש-header Authorization קיים (server.js:6347-6348)',
  client='sa-app.js:7077 <code>generateReleaseNotesAI</code>; sa-app.js:16226 <code>aiGenBrandingImg</code> (אופטימיזציית פרומפט FLUX). הפרומפטים מופיעים בקבוצת "צד לקוח".',
  provider='Gemini (REST)', model='דינמי — callGeminiDirect', params='ללא',
  inputs='<code>context, query</code> מהלקוח',
  prompts=[('server.js', 6350, 6351, 'הרכבת prompt בשרת')],
  output='טקסט חופשי → <code>{success, answer}</code>.', errors='<code>{success:false, error:\'שגיאה במנוע ה-AI: …\'}</code> (server.js:6357).', quota='אין.')

F(G_SA, id='sa-qa', title='מחולל בדיקת QA', kw='sa qa test generator',
  route='POST /api/sa/ai/generate-qa', where='server.js:24018', mw='verifySA',
  client='לא נמצאה קריאה מצד הלקוח',
  provider='Gemini (SDK @google/generative-ai)', model=code('gemini-1.5-flash') + ' (server.js:24023)', params='ללא generationConfig',
  inputs='<code>taskTitle, taskDesc, module</code>',
  prompts=[('server.js', 24024, 24039, 'prompt')],
  output='הסרת ```json/``` ו-JSON.parse (server.js:24044-24047); לא נשמר ל-DB, מוחזר <code>{success, test}</code>.',
  errors='חסר מפתח → <code>{success:false}</code> (server.js:24021).', quota='אין.')

F(G_SA, id='sa-banner-headline', title='כותרת AI לבאנר קהילתי', kw='sa community banner headline',
  route='POST /api/sa/community/banner-ai/:id', where='server.js:21546', mw='verifySA',
  client='sa-app.js:9636 <code>generateBannerAI</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash') + ' (server.js:21559)', params='ללא',
  inputs='<code>community_promotions.title, content, discount_pct</code>, שם עסק, שם קהילה (server.js:21549-21557)',
  prompts=[('server.js', 21560, 21563, 'prompt')],
  output='טקסט; trim והסרת מרכאות ונקודה סופית (server.js:21565); נשמר ל-<code>community_banner_requests.banner_headline</code>.',
  errors='חסר מפתח → 500; 404 אם אין בקשה.', quota='אין.')

F(G_SA, id='sa-feed-analyze', title='ניתוח פיד קהילתי (Claude)', kw='sa community feed analyze anthropic claude',
  route='POST /api/sa/community/ai-analyze', where='server.js:36895', mw='verifySA',
  client='לא נמצאה קריאה מצד הלקוח',
  provider='Anthropic Messages API (fetch ישיר)', model=code('claude-sonnet-4-6') + ', <code>max_tokens:1500</code>, <code>anthropic-version: 2023-06-01</code> (server.js:36928-36932)', params='ללא temperature/system',
  inputs='<code>days</code> (ברירת מחדל 7), <code>communityId</code>; <code>analysisData</code> = עד 50 פוסטים, 20 מדווחים, פירוט סוגים (server.js:36920-36926)',
  prompts=[('server.js', 36928, 36935, 'בקשת fetch כולל תוכן ההודעה')],
  output='<code>aiData.content?.[0]?.text</code>; ברירת מחדל "לא ניתן לנתח כרגע" (server.js:36938).',
  errors='אין בדיקת ANTHROPIC_API_KEY לפני השליחה; חריגה → 500.', quota='אין.')

# ============================ FAMILY / shared ============================
F(G_FAM, id='recipes', title='שף AI — מתכון', kw='family recipe chef pantry',
  route='POST /api/recipes/generate', where='server.js:12206', mw='verifyFamilyOrBiz',
  client='app.js:2518 <code>generateRecipe</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash') + ' (server.js:12215)', params='ללא',
  inputs='<code>mealType, ignorePantry, customIngredients (≤500 תווים), pantryItems (≤500), diners (1-50, ברירת מחדל 4)</code>',
  prompts=[('server.js', 12216, 12219, 'prompt (נבנה בשרשור)')],
  output='Markdown טקסט → <code>{success, recipe}</code>.',
  errors='BATTERY_EMPTY; חסר מפתח → 500; handleAIError (server.js:4225).',
  quota='handleAITokens(groupId) — endpoint \'general\' (server.js:12211).')

F(G_FAM, id='academy-quiz', title='מחולל לומדה/חידון', kw='academy quiz generator training',
  route='POST /api/academy/ai-generate', where='server.js:12226', mw='verifyFamilyOrBiz + role ADMIN',
  client='app.js:2419 <code>generateAIQuiz</code>; business-app.js:29871, 30234 <code>generateAIQuiz</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params=code('responseMimeType: "application/json"') + ' (server.js:12238)',
  inputs='<code>ageGroup, topic</code>; <code>family_groups.type</code> קובע ענף BUSINESS/FAMILY',
  prompts=[('server.js', 12240, 12249, 'prompt (שני ענפים)')],
  output='חיתוך בין <code>{</code> הראשון ל-<code>}</code> האחרון ו-JSON.parse (server.js:12255-12258). נשמר ל-<code>quiz_bundles</code> (type professional/financial, threshold 80, reward 10.0) ו-<code>quiz_questions</code> (server.js:12260-12263).',
  errors='handleAIError.', quota='handleAITokens(groupId).')

F(G_FAM, id='tasks-gen', title='הצעת משימות AI', kw='tasks generator chores',
  route='POST /api/tasks/ai-generate', where='server.js:12310', mw='verifyFamilyOrBiz + groupId==token',
  client='app.js:2635, business-app.js:4792 <code>generateAITasks</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params=code('responseMimeType: "application/json"') + ' (server.js:12321)',
  inputs='<code>age, topic</code>; סוג קבוצה',
  prompts=[('server.js', 12323, 12330, 'prompt (שני ענפים)')],
  output='JSON.parse; אם לא מערך — מחפש <code>.tasks</code> או הערך הראשון שהוא מערך (server.js:12335-12340).',
  errors='handleAIError.', quota='handleAITokens(groupId).')

F(G_FAM, id='goal-advice', title='עצת familAI ליעד חיסכון', kw='goals advice savings',
  route='POST /api/goals/familai-advice', where='server.js:12430', mw='verifyFamilyOrBiz',
  client='app.js:2440 <code>getFamilAIAdvice</code>; business-app.js:4591 <code>getBusinessAIAdvice</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='<code>users.nickname, birth_year→age, balance, allowance_amount</code>; <code>goals.title, target_amount, current_amount</code>',
  prompts=[('server.js', 12448, 12453, 'prompt (שני ענפים)')],
  output='טקסט → <code>advice</code>.', errors='handleAIError.', quota='handleAITokens.')

F(G_FAM, id='budget-insight', title='תובנת תקציב חודשית', kw='budget insight transactions',
  route='POST /api/budget/familai-insight', where='server.js:12460', mw='verifyFamilyOrBiz + groupId==token',
  client='app.js:2452, business-app.js:4603 <code>getBudgetInsight</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='תנועות החודש הנוכחי (amount, category, type, nickname) (server.js:12471)',
  prompts=[('server.js', 12474, 12479, 'prompt')], output='טקסט → <code>insight</code>.', errors='handleAIError.', quota='handleAITokens.')

F(G_FAM, id='pantry-insight', title='תובנת מזווה/מלאי', kw='pantry inventory insight',
  route='POST /api/pantry/familai-insight', where='server.js:12486', mw='verifyFamilyOrBiz + groupId==token',
  client='app.js:2464, business-app.js:4615 <code>getPantryInsight</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='<code>pantry</code> + <code>shopping_trip_items</code> מהחודש הקודם (server.js:12497-12498)',
  prompts=[('server.js', 12501, 12506, 'prompt')], output='טקסט → <code>insight</code>.', errors='handleAIError.', quota='handleAITokens.')

F(G_FAM, id='forecast-insight', title='תובנת תשקיף', kw='forecast insight recurring',
  route='POST /api/forecast/familai-insight', where='server.js:12513', mw='verifyFamilyOrBiz',
  client='app.js:5795, business-app.js:8093 <code>getForecastInsight</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='<code>mode</code> (monthly/yearly), <code>targetUserId</code> (\'all\' דורש ADMIN); תנועות is_recurring',
  prompts=[('server.js', 12537, 12542, 'prompt')], output='טקסט → <code>insight</code>.', errors='handleAIError.', quota='handleAITokens.')

F(G_FAM, id='tutor', title='מורה פרטי — הסבר לטעות בחידון', kw='academy tutor explanation',
  route='POST /api/academy/tutor', where='server.js:12770', mw='verifyFamilyOrBiz',
  client='app.js:2477, business-app.js:4628 <code>askTutor</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='<code>question, wrongAnswer, correctAnswer</code>',
  prompts=[('server.js', 12783, 12788, 'prompt')], output='טקסט → <code>explanation</code>.', errors='handleAIError.', quota='handleAITokens.')

F(G_FAM, id='shopping-list', title='רשימת קניות שבועית AI', kw='shopping list generator fallback',
  route='POST /api/shopping/ai-generate-list', where='server.js:12700', mw='verifyFamilyOrBiz',
  client='app.js:4565 <code>openAiShoppingModal</code>',
  provider='Gemini (SDK)', model=code('gemini-2.0-flash-lite') + ' (server.js:12715)', params='ללא; timeout 18 שניות (Promise.race, server.js:12718)',
  inputs='אין קלט משתמש',
  prompts=[('server.js', 12716, 12716, 'prompt')],
  output='הסרת גדרות, חיתוך {…} ו-JSON.parse (server.js:12720-12722); אם אין categories → FALLBACK.',
  errors='כל שגיאה (כולל TIMEOUT או חסר מפתח) → <code>{success:true, categories: FALLBACK}</code> — רשימה קבועה של 6 קטגוריות (server.js:12701-12708, 12726).',
  quota='handleAITokens (נצרך גם כשמוחזר FALLBACK).')

F(G_FAM, id='family-chat', title='FamilAI — עוזרת משפחתית עם פעולות', kw='family chat assistant actions json',
  route='POST /api/family/chat-assistant', where='server.js:23615', mw='<b>ללא middleware אימות</b>; groupId/userId מגוף הבקשה',
  client='app.js:11440 <code>sendFamilaiChatMessage</code> (fetch ב-11484); אישור: app.js:11407 <code>confirmFamilaiAction</code> → POST /api/family/chat-assistant/confirm-action (server.js:23683, גם הוא ללא middleware)',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params=code('responseMimeType: "application/json"') + ' (server.js:23625-23628)',
  inputs='<code>query</code>; <code>buildFamilyAIContext(groupId)</code> (server.js:23469) — חברים, תנועות, מזווה, קניות, יעדים, הלוואות, קהילות, Flow-coin',
  prompts=[('server.js', 23630, 23661, 'prompt')],
  output='JSON.parse של כל התשובה (server.js:23664) → <code>answer, action_type, action_data</code>. אם action_type ב-<code>FAMILY_AI_SENSITIVE_ACTIONS</code> (DELETE_TASK, DELETE_GROCERY_ITEM, ADJUST_BALANCE, JOIN_COMMUNITY — server.js:23529) → <code>pending_action</code>; אחרת <code>executeFamilyAIAction</code> (server.js:23532) והודעת ביצוע מצורפת לתשובה.',
  errors='handleAIError.', quota='handleAITokens(groupId מגוף הבקשה).')

F(G_FAM, id='generate-catalog', title='אשף קטלוג/מזווה התחלתי', kw='wizard catalog pantry generator',
  route='POST /api/ai/generate-catalog', where='server.js:18308', mw='<b>ללא middleware</b>',
  client='app.js:9321 <code>generateWizardCatalog</code>; business-app.js:20206 <code>_excelCatOpenModal</code>, 20903 <code>generateWizardCatalog</code>, 22016 <code>_generateRepairServices</code>, 22139 <code>_showManualProdRows</code>, 22280 <code>_generateDocTemplate</code>, 22425 <code>_generateBeautyServices</code>, 22580 <code>_generateWizardMenu</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash') + ' (server.js:18316)', params='במכוון ללא responseMimeType (הערה server.js:18315)',
  inputs='<code>promptText, type (BUSINESS/אחר), groupId</code>',
  prompts=[('server.js', 18317, 18328, 'sysPrompt (שני ענפים)')],
  output='הסרת גדרות, חיתוך בין <code>[</code> ל-<code>]</code>, JSON.parse; מערך ריק → שגיאה (server.js:18331-18337).',
  errors='handleAIError.', quota='handleAITokens(groupId מגוף הבקשה).')

# ============================ BIZ ============================
F(G_BIZ, id='biz-famliai', title='FamliAI — עוזרת עסקית (BIZ) עם ACTION ו-NEED_DATA', kw='biz chat assistant famliai action need_data beauty sport logistics restaurant',
  route='POST /api/biz/chat-assistant', where='server.js:16038', mw='verifyBiz (groupId נלקח מגוף הבקשה, לא מ-req.bizAuth)',
  client='business-app.js:16172 <code>submitGlobalAI</code> (בונה systemContext 16172-16286); גרסאות מוחלפות: 46500 (ספורט), 54112 (לוגיסטיקה); גם 9856 <code>generateQuoteAI</code>, 9906 <code>cqGenerateIntroAI</code>, 9960 <code>cqGenerateNotesAI</code>, 24362 <code>analyzeRBCostAI</code>, 25284 <code>getAnalyticsAIInsight</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash') + ' (server.js:16045)', params='ללא',
  inputs='<code>query</code>, <code>context</code> (מחרוזת JSON מהלקוח; <code>business_type</code> נקרא ממנה, server.js:16049), <code>groupId</code>; בסבב 2: <code>fetchBizAdditionalData</code> (server.js:15941)',
  prompts=[('server.js', 16047, 16353, 'סקשנים לפי סוג עסק + systemPrompt'), ('server.js', 16363, 16363, 'followupPrompt (רק אם NEED_DATA)')],
  output='''שרת: regex <code>/\\[NEED_DATA:([^|\\]]+)\\|?([^\\]]*)\\]/</code> (server.js:16358) → סבב שני; מחזיר <code>{success, answer}</code> כטקסט גולמי (כולל תגיות ACTION).
לקוח (business-app.js:16295-16450): regex לכל תגית — ADD_TASK, ADD_SHOP, EXPORT_EXCEL, OPEN_TAB, CREATE_TABLE_RES, UPDATE_ORDER_STATUS, TOGGLE_CATALOG_ITEM, UPDATE_CATALOG_PRICE, UPDATE_RECIPE_INGREDIENT, UPDATE_APPT_STATUS, COMPLETE_APPT, NO_SHOW_APPT, ADD_BEAUTY_CLIENT, UPDATE_LEAD_STATUS, UPDATE_CASE_STATUS, UPDATE_SC_STATUS, CREATE_TASK, CREATE_ALERT_RULE, REPLY_CUSTOMER_CHAT, CREATE_COUPON, UPDATE_INVOICE_STATUS. כל תגית מוסרת מהטקסט והופכת לכפתור אישור שמפעיל פונקציה <code>window._ai*</code>; אין ביצוע אוטומטי. גרסת ספורט (46606-46670) מוסיפה FREEZE_MEMBER, UNFREEZE_MEMBER, CHECKIN_MEMBER, REGISTER_CLASS; גרסת לוגיסטיקה (54239-54285) מוסיפה UPDATE_DELIVERY_STATUS. <code>_aiToggleCatalogItem</code>/<code>_aiUpdateCatalogPrice</code> קוראים ל-POST /api/ai/actions (server.js:15920, ללא middleware).''',
  errors='handleAIError(\'שגיאה במערכת העוזרת\').', quota='handleAITokens(groupId) — נצרך טוקן אחד גם כשיש סבב NEED_DATA שני.')

F(G_BIZ, id='biz-ai-generate', title='ניסוח טקסט כללי לעסקים (Passthrough)', kw='biz ai generate newsletter sport compose passthrough',
  route='POST /api/ai/generate', where='server.js:13907', mw='<b>ללא middleware</b>',
  client='business-app.js:14351 <code>generateNLAI</code>, 49430 <code>_sportAICompose</code>, 49464 <code>showSportAIInsights</code>, 55682 <code>_profContentAI</code> (משמש aiGenerateHero/About/SuggestExpertise/FillExpertise/WriteExpertiseDesc/WriteArticle)',
  provider='Gemini (REST)', model='דינמי — callGeminiDirect', params='ללא',
  inputs='<code>context</code>, <code>query</code> מהלקוח',
  prompts=[('server.js', 13909, 13911, 'הרכבת prompt')],
  output='טקסט → <code>{success, answer}</code>. הלקוח בספורט קורא <code>d.response || d.answer || d.text</code> (business-app.js:49445).',
  errors='<code>{success:false,error}</code> (server.js:13915).', quota='אין.')

F(G_BIZ, id='store-desc', title='תיאור מוצר קצר', kw='store product description short',
  route='POST /api/store/ai-desc', where='server.js:15884', mw='<b>ללא middleware</b>',
  client='business-app.js:15976 <code>generateStoreProductAI</code>, 28466 <code>_wizGenDesc</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='<code>productName, groupId</code>', prompts=[('server.js', 15892, 15892, 'prompt')],
  output='טקסט → <code>description</code>.', errors='handleAIError.', quota='handleAITokens(groupId מגוף הבקשה).')

F(G_BIZ, id='store-long-desc', title='תיאור מוצר מורחב', kw='store product description long',
  route='POST /api/store/ai-long-desc', where='server.js:15898', mw='<b>ללא middleware</b>',
  client='business-app.js:15988 <code>generateStoreProductLongAI</code>, 28484 <code>_wizGenLongDesc</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='<code>productName, shortDesc, groupId</code>', prompts=[('server.js', 15906, 15913, 'prompt')],
  output='טקסט → <code>description</code>.', errors='handleAIError.', quota='handleAITokens.')

F(G_BIZ, id='sport-plan', title='תוכנית אימונים אישית (ספורט)', kw='sport training plan',
  route='POST /api/ai/sport/training-plan', where='server.js:30756', mw='<b>ללא middleware</b>',
  client='business-app.js:49349 <code>_sportAIGeneratePlan</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='<code>memberName, memberPhone, fitnessGoal, currentFitness, availableDays, healthNotes, membershipType, groupId</code>; ספירת <code>sport_checkins</code> לפי טלפון (server.js:30764-30769)',
  prompts=[('server.js', 30772, 30784, 'jsonSchema + prompt')],
  output='הסרת גדרות ו-JSON.parse; כשל → <code>{summary: rawText, weeks:[], nutrition:[], safetyNotes:[]}</code> (server.js:30789-30790).',
  errors='חסר מפתח → 500; BATTERY_EMPTY מוחזר עם <b>HTTP 429</b> (server.js:30761).', quota='handleAITokens(groupId, \'sport/training-plan\').')

F(G_BIZ, id='parse-pdf', title='חילוץ מוצרים מ-PDF/תמונה (Vision)', kw='pdf parse products vision invoice pricelist menu',
  route='POST /api/ai/parse-pdf', where='server.js:33874', mw='<b>ללא middleware</b>',
  client='business-app.js:57755 <code>scanPdfForProducts</code>',
  provider='Gemini (SDK) multimodal', model=code('gemini-2.5-flash'), params='ללא; inlineData (mimeType ברירת מחדל application/pdf)',
  inputs='<code>fileBase64, mimeType, groupId, context</code> (invoice/pricelist/menu)',
  prompts=[('server.js', 33882, 33889, 'contextHint + prompt')],
  output='הסרת גדרות ו-JSON.parse; כשל → 422 (server.js:33897).', errors='handleAIError.', quota='handleAITokens(groupId, \'parse-pdf\'); BATTERY_EMPTY עם HTTP 429.')

# ============================ Images / vision ============================
F(G_IMG, id='task-vision', title='אימות הוכחת ביצוע משימה (Vision)', kw='task proof vision verify bonus',
  route='POST /api/tasks/vision-verify', where='server.js:12549', mw='verifyFamilyOrBiz + groupId==token + בעלות משימה או ADMIN',
  client='app.js:2715, business-app.js:4858 <code>handleTaskProofUpload</code>',
  provider='Gemini (SDK) multimodal', model=code('gemini-2.5-flash'), params=code('responseMimeType: "application/json"') + ' (server.js:12567)',
  inputs='<code>tasks.title</code> מה-DB (עדיפות על title מהגוף), <code>imageBase64, mimeType</code>',
  prompts=[('server.js', 12569, 12574, 'prompt (שני ענפים)')],
  output='JSON.parse (server.js:12578). אם <code>verified</code>: בונוס = max(1, round(reward×10%)) כש-reward&gt;0; עדכון balance, שתי תנועות (income לילד/עובד, expense ל-ADMIN), status=approved (server.js:12579-12594).',
  errors='handleAIError.', quota='handleAITokens.')

F(G_IMG, id='receipt-scan', title='סריקת קבלה (Vision)', kw='receipt scan vision supermarket',
  route='POST /api/shopping/scan-receipt', where='server.js:12599', mw='verifyFamilyOrBiz',
  client='app.js:2733, business-app.js:4915 <code>handleReceiptUpload</code>; שמירה: app.js:2792 <code>confirmReceiptItems</code> → /api/shopping/scan-receipt/save',
  provider='Gemini (SDK) multimodal', model=code('gemini-2.0-flash-lite') + ' (server.js:12608)', params=code('responseMimeType: "application/json"'),
  inputs='<code>imageBase64, mimeType</code>',
  prompts=[('server.js', 12609, 12665, 'prompt')],
  output='עד 2 ניסיונות (המתנה 3 שניות, ללא ניסיון חוזר על 429) (server.js:12667-12678); הסרת גדרות ו-JSON.parse; מקבל מערך או <code>{store_name, items}</code>. לא נשמר — תצוגה מקדימה בלבד (server.js:12695-12696).',
  errors='parse → 500 parse_error; handleAIError.', quota='handleAITokens.')

F(G_IMG, id='gen-image', title='יצירת לוגו/באנר (HF FLUX → Pollinations)', kw='image generation logo banner huggingface flux pollinations hf_token',
  route='POST /api/ai/generate-image', where='server.js:12346', mw='<b>ללא middleware</b>',
  client='business-app.js:13712, 27200 <code>generateBannerAI</code>; 19907 <code>generateLogoAI</code>; 20023 <code>runBannerAI</code>',
  provider='Gemini (בניית פרומפט לבאנר בלבד) + HuggingFace router (nebius/together, FLUX schnell) + Pollinations', model=code('gemini-2.5-flash') + '; ' + code('black-forest-labs/flux-schnell') + ' (nebius), ' + code('black-forest-labs/FLUX.1-schnell') + ' (together), Pollinations <code>model=flux</code>',
  params='באנר 1024×576, לוגו 512×512; timeout 30s ל-HF, 45s ל-Pollinations (server.js:12373-12415)',
  inputs='<code>groupId, type (banner/logo), prompt</code> (= שם העסק)',
  prompts=[('server.js', 12354, 12370, 'פרומפט Gemini לבאנר + פרומפטי ברירת מחדל')],
  output='שרשרת ספקים: nebius → together → Pollinations; מחזיר <code>data:&lt;type&gt;;base64,…</code> (server.js:12424). HF_TOKEN מ-env (server.js:12372); ללא טוקן — מדלג ל-Pollinations.',
  errors='כל הספקים נכשלו → <code>{success:false}</code> (server.js:12419-12422).', quota='handleAITokens(groupId מגוף הבקשה) — נצרך גם אם הלוגו לא מפעיל Gemini.')

F(G_IMG, id='catalog-image', title='תמונת מוצר: Pixabay → Pexels → Pollinations', kw='product image pixabay pexels pollinations cloudinary stock',
  route='POST /api/store/catalog/generate-image', where='server.js:13658', mw='<b>ללא middleware</b>',
  client='business-app.js:16114 <code>generateProductImage</code>, 28445 <code>_wizGenImage</code>; sa-app.js:15879 <code>aiGenProdImg</code>',
  provider='Gemini (תרגום שם) + Pixabay API + Pexels API + Pollinations + Cloudinary', model=code('gemini-2.0-flash-lite') + ' (server.js:13673)',
  params='Pixabay: image_type=photo, per_page=15, safesearch=true, min_width=400, page=min(attempt,3) (server.js:13733); Pexels: per_page=10, orientation=square (server.js:13757); Pollinations 512×512, 2 ניסיונות, timeout 20s (server.js:13781-13795)',
  inputs='<code>groupId, productName, nameEn, description, category, productType, attempt</code>',
  prompts=[('server.js', 13670, 13677, 'תרגום שם מוצר (רק כאשר nameEn קצר מ-3)'), ('server.js', 13690, 13700, 'מיפוי שירותים למקצוע'), ('server.js', 13775, 13780, 'פרומפט Pollinations')],
  output='כתובת תמונה; אם Cloudinary מוגדר ב-system_settings — מועלה ומוחזר secure_url (server.js:13703-13721). <code>source</code>: cloudinary/pixabay/pexels/pollinations.',
  errors='כולם נכשלו → <code>{success:false}</code> (server.js:13797).', quota='אין handleAITokens.')

F(G_IMG, id='sa-pollinations', title='לוגו/באנר בבונה העסק של SA (Pollinations בצד לקוח)', kw='sa pollinations logo banner client',
  route='ללא route — כתובת Pollinations נבנית בדפדפן', where='sa-app.js:15993, 16000, 16267, 16271', mw='—',
  client='sa-app.js:16226 <code>aiGenBrandingImg</code>; יצירת עסק בבונה (sa-app.js:15985-16003)',
  provider='Pollinations', model='<code>model=flux</code>', params='לוגו 512×512, באנר 1200×400, negative prompt קבוע',
  inputs='logo_prompt / banner_prompt (מ-ai-gen-brand-prompts או ממשתמש)',
  prompts=[('sa-app.js', 15989, 16001, 'יצירה בעת שמירת העסק'), ('sa-app.js', 16262, 16272, 'יצירה ידנית')],
  output='ה-URL עצמו משמש כתמונה.', errors='שגיאות נבלעות (catch ריק / console.warn).', quota='אין.')

# ============================ ZM ============================
F(G_ZM, id='zm-banner', title='באנר SVG לקמפיין', kw='zone manager banner svg',
  route='POST /api/zone-manager/ai/generate-banner', where='server.js:20114', mw='verifyZoneManager',
  client='zone-manager-app.js:818 <code>zmAIGenerateBanner</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash') + ' → fallback ' + code('gemini-2.0-flash-lite') + ' על כל שגיאה (server.js:20133-20138)', params='ללא',
  inputs='<code>title</code> (לא בשימוש בפרומפט), <code>campaignType</code> → palette',
  prompts=[('server.js', 20117, 20131, 'palette + prompt')],
  output='regex <code>/&lt;svg[\\s\\S]*?&lt;\\/svg&gt;/i</code>; Base64 → <code>data:image/svg+xml</code> (server.js:20140-20144).', errors='500.', quota='אין.')

F(G_ZM, id='zm-draft', title='ניסוח טקסט קמפיין', kw='zone manager campaign draft',
  route='POST /api/zone-manager/ai/draft-campaign', where='server.js:20149', mw='verifyZoneManager',
  client='zone-manager-app.js:878 <code>zmAIDraftCampaign</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash') + ' → ' + code('gemini-1.5-flash') + ' רק על 503/overloaded/high demand (server.js:20184-20188)', params=code("responseMimeType: 'application/json'") + ' (server.js:20183)',
  inputs='<code>goal, audience, tone, campaignType, modules</code>',
  prompts=[('server.js', 20156, 20180, 'typeContexts + prompt')],
  output='JSON.parse → <code>title, subtitle, text_content</code>.', errors='500.', quota='אין.')

F(G_ZM, id='zm-leads', title='דירוג לידים', kw='zone manager leads score',
  route='POST /api/zone-manager/ai/analyze-leads', where='server.js:20197', mw='verifyZoneManager + בעלות קמפיין',
  client='zone-manager-app.js:1209 <code>analyzeLeads</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params=code("responseMimeType: 'application/json'") + ' (server.js:20205)',
  inputs='עד 50 לידים ללא ai_score (server.js:20203)',
  prompts=[('server.js', 20206, 20210, 'leadsText + prompt')],
  output='JSON.parse; <code>results[].id</code> = מספר שורה (1-based) → UPDATE ai_score, ai_notes (server.js:20212-20216).', errors='500.', quota='אין.')

F(G_ZM, id='zm-reply', title='הצעת תשובה לשיחה', kw='zone manager inbox suggest reply',
  route='POST /api/zone-manager/ai/suggest-reply', where='server.js:20223', mw='verifyZoneManager + בעלות שיחה',
  client='zone-manager-app.js:1315 <code>zmAISuggestReply</code>',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='6 הודעות אחרונות ב-<code>zm_inbox_messages</code>',
  prompts=[('server.js', 20231, 20232, 'history + prompt')],
  output='טקסט → <code>suggestion</code>.', errors='500.', quota='אין.')

# ============================ Kol HaAm ============================
F(G_KH, id='kh-copilot', title='AI Copilot לכותבי תוכן', kw='kol haam copilot claude grammar title summary tags safety cover',
  route='POST /api/kol-haam/content/:id/ai-copilot', where='server.js:45836', mw='verifyFamily (groupId מהטוקן, server.js:45839)',
  client='kol-haam-app.js:2193 <code>KH.runAICopilot</code> (פאנל: 2170 <code>KH.renderAICopilot</code>)',
  provider='Anthropic Messages API דרך <code>callClaudeKH</code> (server.js:45820)', model=code('claude-sonnet-4-6') + '; max_tokens: 1500 (עריכה), 400 (בטיחות), 200 (שער); <code>anthropic-version: 2023-06-01</code>',
  params='ללא system/temperature; הודעת user יחידה',
  inputs='<code>content_items.title, subtitle, content_html</code> (HTML מוסר; 3000 תווים לעריכה, 2000 לבטיחות); <code>actions[]</code>',
  prompts=[('server.js', 45865, 45881, 'עריכה (grammar/title/subtitle/summary/tags — קריאה אחת)'), ('server.js', 45924, 45937, 'safety_scan'), ('server.js', 45959, 45959, 'cover_suggestion')],
  output='לכל קריאה: הסרת ```json ו-JSON.parse. כשל בעריכה → <code>ai_parse_error</code>; כשל בבטיחות → אובייקט "נקי"; safety חיובי → INSERT ל-<code>content_reports</code> עם reason <code>SAFETY_AI_FLAG</code> (server.js:45944-45950). duplicate_check — ללא AI (pg_trgm similarity &gt; 0.35, fallback ILIKE).',
  errors='חסר ANTHROPIC_API_KEY → throw (server.js:45821) → 500; תשובה ריקה → \'\'.',
  quota='מכסה יומית נפרדת: <code>checkAICopilotQuota</code> (server.js:43153) — <code>system_settings.kh_ai_copilot_daily_limit</code> (ברירת מחדל 20) על <code>kh_ai_copilot_usage</code>; חריגה → 429. אחרי ריצה: <code>incrementAICopilotUsage</code> (+1 לכל בקשה, לא לכל קריאת Claude) ולוג audit ל-<code>ai_copilot_usage_log</code> (server.js:45967-45974). לא משתמש ב-handleAITokens.')

# ============================ Guide ============================
F(G_GUIDE, id='guide-chat', title='צ\'אט המדריך (guide.html / biz-guide.html)', kw='guide chat help',
  route='POST /api/guide/chat', where='server.js:12799', mw='<b>ללא middleware</b>',
  client='guide.html:570 <code>sendGuideQuestion</code> (שולח רק <code>question</code>, ללא guideType → תמיד guide.html)',
  provider='Gemini (SDK)', model=code('gemini-2.5-flash'), params='ללא',
  inputs='<code>question, guideType</code>; כל קובץ ה-HTML של המדריך נקרא מהדיסק ומוזרק (server.js:12804-12811)',
  prompts=[('server.js', 12815, 12836, 'prompt (BIZ / FAMILY)')],
  output='טקסט → <code>answer</code>.', errors='500 "מצטערת, לא הצלחתי לייצר תשובה כרגע." (server.js:12842).', quota='אין.')

F(G_GUIDE, id='setup-guide-chat', title='עוזר מדריך ההקמה — קריאת Gemini ישירה מהדפדפן', kw='biz setup guide client gemini api key exposed',
  route='GET /api/guide-config (server.js:12795) מחזיר את <code>GEMINI_API_KEY</code>; הקריאה ל-Gemini מהדפדפן', where='public/biz-setup-guide.html:8818 <code>window.sendGuideMessage</code>', mw='<b>ללא middleware</b> על guide-config',
  client='biz-setup-guide.html:8718 <code>loadGuideConfig</code> + 8818 <code>sendGuideMessage</code>',
  provider='Gemini REST מהלקוח', model=code('gemini-2.0-flash-lite') + ' (biz-setup-guide.html:8902)', params='ללא',
  inputs='<code>detectedBiz</code>, היסטוריית שיחה (עד 6 הודעות), <code>context</code> = טקסט סקשן המדריך, <code>msg</code>',
  prompts=[('biz-setup-guide.html', 8840, 8894, 'prompt')],
  output='<code>data.candidates[0].content.parts[0].text</code> מוצג כטקסט.', errors='429 → הודעת מכסה (8916-8918); אין תשובה → "שגיאה טכנית זמנית".', quota='אין (מכסת Google של המפתח).')

# ============================ Client-built prompts ============================
CLIENT_PROMPTS = [
  ('generateReleaseNotesAI → /api/sa/ai-generate', 'sa-app.js', 7075, 7081),
  ('aiGenBrandingImg (אופטימיזציית FLUX) → /api/sa/ai-generate', 'sa-app.js', 16238, 16247),
  ('generateNLAI (ניוזלטר) → /api/ai/generate', 'business-app.js', 14369, 14375),
  ('_sportAICompose → /api/ai/generate', 'business-app.js', 49437, 49443),
  ('showSportAIInsights → /api/ai/generate', 'business-app.js', 49483, 49495),
  ('aiGenerateHero → /api/ai/generate', 'business-app.js', 55822, None),
  ('aiGenerateAbout → /api/ai/generate', 'business-app.js', 55849, None),
  ('aiSuggestExpertise → /api/ai/generate', 'business-app.js', 55870, None),
  ('aiFillExpertise → /api/ai/generate', 'business-app.js', 56001, None),
  ('aiWriteExpertiseDesc → /api/ai/generate', 'business-app.js', 56079, None),
  ('aiWriteArticle → /api/ai/generate', 'business-app.js', 56167, None),
  ('generateQuoteAI → /api/biz/chat-assistant (query + context role)', 'business-app.js', 9858, 9860),
  ('generateQuoteAI — context', 'business-app.js', 9877, 9877),
  ('cqGenerateIntroAI → /api/biz/chat-assistant', 'business-app.js', 9907, 9915),
  ('cqGenerateNotesAI → /api/biz/chat-assistant', 'business-app.js', 9961, 9961),
  ('analyzeRBCostAI → /api/biz/chat-assistant', 'business-app.js', 24367, 24373),
  ('getAnalyticsAIInsight → /api/biz/chat-assistant', 'business-app.js', 25294, 25298),
]

# ------------------------------------------------------------------
def summary_rows():
    rows = []
    for g, f in FEATURES:
        rows.append([f'<a href="#ai-{f["id"]}">{E(f["title"])}</a>', f['provider'], f['model'], f['route'] if f['route'].startswith('ללא') or f['route'].startswith('GET') else code(f['route']), f['quota']])
    return rows

def render_feature(f):
    out = [f'<section class="proc" id="ai-{f["id"]}" data-f="{E(f["kw"].lower())}">', f'<h3>{E(f["title"])}</h3>']
    meta = [
        ['Route / פונקציה', (code(f['route']) if f['route'].startswith(('POST', 'GET')) and '(' not in f['route'] else f['route']) + ' — ' + f['where']],
        ['Middleware / הרשאה', f['mw']],
        ['מסך מפעיל (לקוח)', f['client']],
        ['ספק', f['provider']],
        ['מודל', f['model']],
        ['פרמטרי יצירה', f['params']],
        ['משתנים מוזרקים', f['inputs']],
    ]
    out.append(table(['שדה', 'ערך'], meta))
    for (fl, s, e, lab) in f['prompts']:
        out.append(block(fl, s, e, lab))
    out.append(table(['היבט', 'פירוט'], [
        ['פורמט פלט ופענוח', f['output']],
        ['Fallback / שגיאות', f['errors']],
        ['מכסה / סוללה / לוג', f['quota']],
    ]))
    out.append('</section>')
    return '\n'.join(out)

parts = []
parts.append('''<div class="intro">העמוד מקטלג את <strong>כל</strong> קריאות ה-AI במערכת, כולל הפרומפט המלא בהעתק מילולי מהקוד (placeholders בסגנון <code>${…}</code> נשמרו). המקור: חיפוש ב-<code>server.js</code> אחר <code>getGenAIInstance</code>, <code>getGenAIv2Instance</code>, <code>generateContent</code>, <code>callGeminiDirect</code>, <code>generativelanguage</code>, <code>api.anthropic.com</code>, <code>ANTHROPIC_API_KEY</code>, <code>HF_TOKEN</code>, <code>pixabay</code>, <code>pexels</code>, ומקביל ב-<code>public/*.js</code> ו-<code>*.html</code>. בלוקי הפרומפט נחתכו אוטומטית מטווחי השורות המצוינים, ורק ההזחה המשותפת הוסרה. קבצי גיבוי (<code>server1.js</code>, <code>server030426.js</code>, <code>old/*</code>, <code>services/server (1).js</code>, <code>business-app030426.js</code>, <code>business-appold1.js</code>) לא נטענים ע"י <code>server.js</code> (הדרישה היחידה מ-services היא <code>./services/whatsapp</code>, server.js:3) ולכן לא קוטלגו. לא נמצאו בקוד <code>temperature</code>, <code>maxOutputTokens</code>, <code>topP/topK</code> או <code>safetySettings</code> באף קריאה, כך שכל הקריאות רצות עם ברירות המחדל של הספק.</div>''')

# summary
parts.append('<h2 class="grp">טבלת סיכום</h2>')
parts.append('<section class="proc" data-f="summary table overview all features">' + '<h3>כל פיצ\'רי ה-AI</h3>' + table(['פיצ\'ר', 'ספק', 'מודל', 'Route', 'מכסה'], summary_rows()) + '</section>')

# infra
parts.append(f'<h2 class="grp">{E(G_INFRA)}</h2>')
parts.append('<section class="proc" data-f="infra sdk client genai lazy api key">')
parts.append('<h3>לקוחות SDK ומפתחות</h3>')
parts.append(table(['רכיב', 'פירוט', 'מקור'], [
  ['@google/generative-ai', 'נטען בעצלתיים: <code>getGenAI()</code> → <code>GoogleGenerativeAI</code>; מופע יחיד <code>getGenAIInstance()</code> עם <code>GEMINI_API_KEY</code>. גרסה ^0.24.1 (package.json:11).', 'server.js:40, 222-225'],
  ['@google/genai', '<code>getGenAIv2Instance()</code> מוגדר אך <b>לא נקרא בשום מקום</b> בקוד (חיפוש מלא). גרסה ^2.8.0 (package.json:10).', 'server.js:41, 226'],
  ['GEMINI_API_KEY', '<code>const apiKey = process.env.GEMINI_API_KEY || ""</code>. נחשף גם ללא אימות ב-GET /api/guide-config.', 'server.js:222, 12795-12797'],
  ['ANTHROPIC_API_KEY', 'שימוש בשני מקומות: <code>callClaudeKH</code> ו-/api/sa/community/ai-analyze.', 'server.js:45820-45832, 36928-36930'],
  ['HF_TOKEN', 'HuggingFace router ליצירת תמונות.', 'server.js:12372'],
  ['PIXABAY_API_KEY / PEXELS_API_KEY', 'חיפוש תמונות סטוק למוצרים.', 'server.js:13727, 13754'],
]))
parts.append('</section>')

parts.append('<section class="proc" data-f="callgeminidirect rest auto discovery retry fallback models">')
parts.append('<h3>callGeminiDirect — הגדרה כפולה (הגרסה המאוחרת גוברת)</h3>')
parts.append('<p>הפונקציה מוגדרת פעמיים כ-function declaration באותו scope של המודול: server.js:6054 (מודל קבוע <code>gemini-1.5-flash</code>) ו-server.js:6260. לפי כללי hoisting ב-JavaScript, ההגדרה השנייה גוברת על כל הקריאות, כולל קריאות שמופיעות לפני 6054 בקובץ. התנהגות אפקטיבית (server.js:6260-6338):</p><ul>'
  '<li>בכל קריאה נשלחת קודם בקשת GET לרשימת המודלים (<code>/v1beta/models?key=</code>) (server.js:6267-6273).</li>'
  '<li>מסנן מודלים שה-name שלהם כולל <code>gemini</code> ותומכים ב-<code>generateContent</code>; סדר עדיפות: flash-lite/flash-8b, אחר כך flash, אחר כך השאר; עד 4 מודלים (server.js:6275-6292).</li>'
  '<li>לכל מודל עד 3 ניסיונות עם המתנה של attempt×2000ms כשהשגיאה נראית כעומס (high demand, overloaded, RESOURCE_EXHAUSTED, quota, 503, 429). שגיאה אחרת נזרקת מיד (server.js:6264, 6294-6327).</li>'
  '<li>גוף הבקשה: <code>{contents:[{parts:[{text: prompt}]}]}</code> בלבד, ללא generationConfig (server.js:6301).</li>'
  '<li>כל שגיאה נעטפת ב-"תקלת תקשורת מול גוגל: …" (server.js:6338).</li></ul>')
parts.append(block('server.js', 6054, 6072, 'הגדרה ראשונה (מוצללת)'))
parts.append('</section>')

parts.append('<section class="proc" data-f="battery ai tokens quota plan premium enterprise usage log handleaitokens">')
parts.append('<h3>סוללת AI — handleAITokens ו-ai_usage_log</h3>')
parts.append(table(['כלל', 'פירוט', 'מקור'], [
  ['עמודות', '<code>family_groups.ai_tokens INT DEFAULT 10</code>, <code>last_token_reset DATE</code>, <code>plan VARCHAR(20) DEFAULT \'standard\'</code>; is_premium=true מומר ל-plan=\'enterprise\'.', 'server.js:810-811, 832-833'],
  ['enterprise', 'ללא הגבלה; רק INSERT ל-<code>ai_usage_log</code>.', 'server.js:4177-4180'],
  ['premium / standard', 'מכסה יומית 50 / 10. איפוס כש-last_token_reset &lt; היום, ואז הפחתה של 1 לכל קריאה ו-INSERT ללוג.', 'server.js:4182-4193'],
  ['איפוס נוסף בכניסה', 'בכניסת משתמש ובטעינת נתוני SA, ai_tokens מאופס ל-<b>10 קבוע</b> (גם ל-premium) ו-last_token_reset=היום, ולכן האיפוס ל-50 ב-handleAITokens לא מתרחש באותו יום.', 'server.js:10766, 9048'],
  ['חריגה', 'הפונקציה מחזירה false, וה-route מחזיר <code>{success:false, error:\'BATTERY_EMPTY\'}</code> (בדרך כלל HTTP 200; ב-training-plan וב-parse-pdf HTTP 429). שגיאת DB מחזירה false.', 'server.js:4195-4197'],
  ['UI', '<code>handleAIResponseCheck</code> פותח את <code>ai-battery-modal</code> (קטע שדרוג ל-ADMIN בלבד); המחוון מציג <code>⚡ n/10</code> או <code>∞ (Pro)</code>.', 'app.js:1715-1732; business-app.js:3102-3113'],
  ['endpoint בלוג', 'ברירת מחדל \'general\'; רק training-plan (\'sport/training-plan\') ו-parse-pdf (\'parse-pdf\') מעבירים שם.', 'server.js:4170, 30760, 33878'],
  ['דוחות', 'GET /api/sa/ai-usage מסכם לפי endpoint ל-BUSINESS בלבד; גם provider ai_usage ב-FLOW AI ומדדי SA.', 'server.js:18059-18080, 4847, 9169, 9292'],
  ['handleAIError', '429 → "מערכת ה-AI עמוסה…"; GEMINI_API_KEY → 500 "מפתח AI חסר בשרת"; אחר → 500 עם defaultMsg ו-detail.', 'server.js:4225-4230'],
  ['Kol HaAm', 'מכסה נפרדת (kh_ai_copilot_usage, ברירת מחדל 20 ביום).', 'server.js:43153-43179'],
]))
parts.append('</section>')

groups_order = [G_SA, G_FAM, G_BIZ, G_IMG, G_ZM, G_KH, G_GUIDE]
for g in groups_order:
    parts.append(f'<h2 class="grp">{E(g)}</h2>')
    for gg, f in FEATURES:
        if gg == g:
            parts.append(render_feature(f))

parts.append(f'<h2 class="grp">{E(G_CLIENT)}</h2>')
parts.append('<section class="proc" data-f="client prompts passthrough business-app sa-app">')
parts.append('<h3>פרומפטים שנבנים בדפדפן ונשלחים ל-routes גנריים</h3><p>ה-routes <code>/api/ai/generate</code> ו-<code>/api/sa/ai-generate</code> רק מרכיבים <code>${context}\\n\\nבקשה: ${query}</code> (או <code>query</code> בלבד), ולכן הפרומפט האמיתי נמצא בצד הלקוח. בקריאות ל-<code>/api/biz/chat-assistant</code> מהמסכים הבאים, ה-query עטוף בכל ה-systemPrompt של FamliAI (server.js:16262), כש-<code>context</code> הוא רק אובייקט <code>{role}</code>.</p>')
for lab, fl, s, e in CLIENT_PROMPTS:
    parts.append(block(fl, s, e, lab))
parts.append('</section>')

with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(parts))
print('features', len(FEATURES), 'client prompts', len(CLIENT_PROMPTS), 'bytes', os.path.getsize(OUT))
