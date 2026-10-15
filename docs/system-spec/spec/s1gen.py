import json, re, html as H

SP = '/tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/spec/'
OUT = SP + 's1-docsvscode.html'

def e(s):
    """escape text, then turn `x` into <code>x</code>"""
    s = H.escape(str(s), quote=False)
    return re.sub(r'`([^`]+)`', r'<code>\1</code>', s)

CLS = {
    'as': 'ממומש כמתואר',
    'diff': 'ממומש אחרת',
    'no': 'לא ממומש',
    'undoc': 'ממומש בקוד אך לא מתועד במסמך',
    'part': 'ממומש חלקית',
}

def table(headers, rows):
    o = ['<div class="tbl-wrap"><table><thead><tr>']
    o += ['<th>%s</th>' % e(h) for h in headers]
    o.append('</tr></thead><tbody>')
    for r in rows:
        o.append('<tr>' + ''.join('<td>%s</td>' % e(c) for c in r) + '</tr>')
    o.append('</tbody></table></div>')
    return ''.join(o)

def section(title, keywords, body):
    return '<section class="proc" data-f="%s"><h3>%s</h3>%s</section>' % (H.escape(keywords.lower()), e(title), body)

def claims(rows):
    # rows: (requirement, doc section, cls, evidence)
    return table(['דרישה / הבטחה במסמך', 'סעיף', 'סיווג', 'ראיה בקוד (file:line)'],
                 [(r[0], r[1], CLS[r[2]], r[3]) for r in rows])

parts = []

# ---------------------------------------------------------------- intro
dr = json.load(open(SP + 'docroutes.json'))
df = json.load(open(SP + 'docfuncs.json'))
gp = json.load(open(SP + 'guidepaths.json'))

parts.append('<div class="intro">' + e(
    'עמוד זה מיישב בין מסמכי הכוונה הקיימים במאגר (מפרטים, מסמכי לקוח, תוכניות, דוחות ומדריכי משתמש) לבין הקוד בפועל. '
    'לכל מסמך חולצו הדרישות/ההבטחות המרכזיות וכל אחת סווגה: ממומש כמתואר / ממומש אחרת / לא ממומש / ממומש בקוד אך לא מתועד במסמך (ובמקומות שבהם רק חלק קיים — "ממומש חלקית"). '
    'אופן הגזירה: (1) קריאה ידנית של כל מסמך md ושל המדריכים; (2) בדיקה אוטומטית של כל נתיב `/api/...` המוזכר במסמכים מול רשימת 1,511 הנתיבים שחולצה מ-server.js (api.json), ושל כל שם פונקציה `name(` המוזכר במסמך מול מזהי הקוד ב-server.js וב-public/*.js|html; '
    '(3) אימות ידני של טענות התנהגותיות מול הקוד ומול עמודי חוקי העסק (rules-*.html), עם ציון file:line. '
    'תאריכי מסמכים נלקחו מכותרת המסמך עצמו; היסטוריית git במאגר רדודה (כל הקבצים מופיעים כנוספים ב-2026-10-05/06) ולכן אינה מעידה על גיל המסמך. '
    'שום קובץ במאגר לא שונה.') + '</div>')

# ---------------------------------------------------------------- 1 inventory
parts.append('<h2 class="grp">1. מצאי מסמכי כוונה</h2>')
inv = [
 ('SYSTEM_SPEC.md', 'מפרט טכני כולל — 4 סביבות, DB, API, זרימות, אינטגרציות', 'גרסה: אוקטובר 2026', 'מפרט כוונה (תיאורי)'),
 ('SPECIFICATION.md', 'אפיון מוצר WEFLOWZ — 3 סביבות (FAMILY/BIZ/ADMIN), 13+20 מודולים, QA', 'גרסה 1.0, ינואר 2026, "בהשקה"', 'מפרט כוונה (חזון מוצר)'),
 ('IMPLEMENTATION_PLAN.md', '5 שיפורים למסעדה (טיימר, הנחה, דוח יום, דירוגים, חלונות הושבה)', 'עדכון אחרון 2026-06-16', 'תוכנית עבודה'),
 ('BUSINESS_ADMIN_MAPPING.md', 'מיפוי 52 פעולות ניהול BIZ + הצעת ארגון ניווט "ניהול"', 'לא צוין', 'ניתוח UX / הצעה'),
 ('FAMILY_TABLE_RESERVATION_SPEC.md', 'הזמנת שולחן עם זמינות מתוך "הפעילות שלי" באפליקציית משפחה', 'לא צוין', 'מפרט כוונה (פיצ\'ר)'),
 ('FAMILY_UX_CHANGES.md', 'מפרט UX/פיקסלים לאותו פיצ\'ר', 'לא צוין', 'מפרט UX'),
 ('RESTAURANT_PROCESSES.md', 'מפת 18 תהליכי מסעדה, תפקידים, KPI', 'לא צוין ("מתעדכן כל שישי")', 'מפרט תהליכים (כוונה)'),
 ('SMS_SERVICE_SETUP.md', 'הגדרת ספק SMS (test/Twilio/Mada)', 'דוגמת לוג 2026-06-18', 'הוראות תפעול'),
 ('README.md', 'ריק (0 שורות)', '—', '—'),
 ('README_RENDER.md', 'פריסה ל-Render + DB', 'לא צוין', 'הוראות פריסה'),
 ('CLAUDE.md', 'כללי עבודה קבועים (כולל כלל 5 בחירת סוג עסק וכלל 6 עדכון מדריך)', 'לא צוין', 'כללי פיתוח (נבדקו כללים 5–6)'),
 ('docs/BIZ_ENV_SPEC.md', 'סביבת BIZ — 40 סעיפים, כולל יופי/מסעדה/מומחים/ספורט/תיקונים/קמעונאות', 'גרסה: אוקטובר 2026', 'מפרט טכני'),
 ('docs/FAMILY_ENV_SPEC.md', 'סביבת FAMILY — 25 סעיפים', 'גרסה: אוקטובר 2026', 'מפרט טכני'),
 ('docs/SA_ENV_SPEC.md', 'סביבת Super-Admin — 36 סעיפים', 'גרסה: אוקטובר 2026', 'מפרט טכני'),
 ('docs/ZM_ENV_SPEC.md', 'סביבת Zone-Manager — 17 סעיפים', 'גרסה: אוקטובר 2026', 'מפרט טכני'),
 ('docs/spec-biz-environment.md', 'מפרט BIZ ל-NotebookLM', '2026-06-20 (מבוסס "server1.js")', 'מפרט טכני (ישן)'),
 ('docs/spec-family-environment.md', 'מפרט FAMILY + "הערות היסטוריות" של תיקוני אבטחה', '2026-06-20 (מבוסס "server1.js"), עודכן חלקית באוקטובר', 'מפרט טכני'),
 ('docs/spec-super-admin.md', 'מפרט SA', '2026-06-20', 'מפרט טכני (ישן)'),
 ('docs/spec-zone-community.md', 'מפרט ZM + קהילה', '2026-06-20', 'מפרט טכני (ישן)'),
 ('docs/spec-qa-book.md', 'ספר QA — 4 סביבות, edge cases, smoke tests', '2026-06-20', 'תוכנית בדיקות'),
 ('docs/spec-retail-store.md', 'הרחבת חנות קמעונאית (וריאציות, מלאי, החזרות, מבצעים)', '2026-10-06, "טרם אושר ליישום" + עדכוני שלבים', 'מפרט כוונה (פיצ\'ר)'),
 ('docs/spec-shuka-feature.md', 'שוקה — קמפייני שוק קהילתיים', '2026-10-05', 'מפרט כוונה (פיצ\'ר)'),
 ('docs/retail-module-map-internal.md', 'מיפוי 14 מודולי retail והרשאות בפועל', 'לא צוין', 'מיפוי פנימי'),
 ('docs/security-audit-report-2026-10.md', 'דוח אבטחה מצטבר — 17 מודולי FAMILY', 'אוקטובר 2026', 'דוח'),
 ('docs/test-checklist-shuka.md', 'צ\'ק-ליסט בדיקה ידנית לשוקה', 'לא צוין', 'צ\'ק-ליסט'),
 ('docs/WEFLOWZ-family-capabilities-customer-v1.md', 'יכולות למשפחות — 17 פרקים', 'v1', 'מסמך לקוח'),
 ('docs/WEFLOWZ-retail-capabilities-customer-v1.md', 'יכולות לקמעונאות — 12 פרקים', 'v1', 'מסמך לקוח'),
 ('docs/WEFLOWZ-retail-modules-customer-v1.md', '16 אזורי ניהול לקמעונאות + מי משתמש', 'v1', 'מסמך לקוח'),
 ('docs/WEFLOWZ-shuka-customer-doc.md', 'שוקה — חומר שיווקי לעסקים', 'לא צוין', 'מסמך לקוח'),
 ('public/beauty-guide.html', 'סלון יופי', 'לא צוין', 'מדריך משתמש (חובת עדכון לפי CLAUDE.md כלל 6)'),
 ('public/biz-guide.html', 'מדריך עסקי כללי', 'לא צוין', 'מדריך משתמש'),
 ('public/biz-setup-guide.html', 'מדריך שימוש מלא BIZ (8,968 שורות)', 'לא צוין', 'מדריך משתמש (לא נכלל ברשימת הבקשה; נבדק אוטומטית בלבד)'),
 ('public/sport-guide.html', 'מועדון ספורט', 'לא צוין', 'מדריך משתמש'),
 ('public/logistics-guide.html', 'לוגיסטיקה ושליחויות', 'לא צוין', 'מדריך משתמש'),
 ('public/maintenance-guide.html', 'תחזוקה ותיקונים', 'יוני 2026, v1.0', 'מדריך משתמש'),
 ('public/restaurant-guide.html', 'מסעדה / בית קפה', 'יוני 2026, v2.3', 'מדריך משתמש'),
 ('public/retail-guide.html', 'חנות קמעונאית', 'יוני 2026, v1.0', 'מדריך משתמש'),
 ('public/services-guide.html', 'שירותים מקצועיים', 'יוני 2026, v1.0', 'מדריך משתמש'),
 ('public/professional-guide.html', 'עסק מקצועי / ייעוץ', 'לא צוין', 'מדריך משתמש'),
 ('public/marketing-guide.html', 'מדריך שיווקי', 'לא צוין', 'מדריך / חומר שיווקי'),
 ('public/community-guide.html', 'ניהול קהילות', 'גרסה 1.0 · 2026', 'מדריך משתמש'),
 ('public/flow-guide.html', 'מטבע Flw', 'גרסה 1.0 · 2026', 'מדריך משתמש'),
 ('public/flowpool-guide.html', 'FlowPool', 'גרסה 1.0 · 2026', 'מדריך משתמש'),
 ('public/kol-haam-guide.html', 'קול העם', 'לא צוין', 'מדריך משתמש'),
]
parts.append(section('טבלת מצאי', 'inventory מצאי מסמכים docs guides', table(['מסמך', 'היקף', 'תאריך / גרסה כפי שמופיע', 'תפקיד'], inv)))

# ---------------------------------------------------------------- 2 automatic metrics
parts.append('<h2 class="grp">2. מדדי התאמה אוטומטיים</h2>')
rows = []
for d, lst in dr.items():
    if not lst and not df.get(d, {}).get('total'):
        continue
    n = len(lst); ok = sum(1 for k, v in lst if v); ex = sum(1 for k, v in lst if v and v[3] == 'exact')
    f = df.get(d, {'total': 0, 'missing': []})
    rows.append((d, n, ok, ex, f['total'], len(f['missing'])))
body = table(['מסמך', 'הפניות /api', 'נמצא נתיב תואם', 'מתוכם גם method תואם', 'שמות פונקציות שהוזכרו', 'שמות שאינם קיימים בקוד'], rows)
body += '<p>' + e('"נמצא נתיב תואם" = קיים route עם אותם מקטעים (פרמטר `:x` תואם כל ערך); "גם method" = נכון רק כשהמסמך ציין GET/POST/... . נתיבים כלליים בסגנון `/api/family/` נספרים כלא-תואמים. '
                  'שמות פונקציות נבדקו כמזהה בכל server.js, public/*.js|html (ללא קבצי גיבוי 030426/old) ו-services/*.js.') + '</p>'
miss = {d: [k for k, v in lst if not v] for d, lst in dr.items()}
body += '<p>' + e('נתיבים לא-קיימים בולטים — BIZ_ENV_SPEC (85): ') + e(', '.join('`%s`' % x.strip() for x in miss['docs/BIZ_ENV_SPEC.md'][:40])) + ' …</p>'
body += '<p>' + e('FAMILY_ENV_SPEC (44): ') + e(', '.join('`%s`' % x.strip() for x in miss['docs/FAMILY_ENV_SPEC.md'][:30])) + ' …</p>'
body += '<p>' + e('SYSTEM_SPEC: ') + e(', '.join('`%s`' % x.strip() for x in miss['SYSTEM_SPEC.md'] if x.strip().startswith(('POST', 'GET')))) + '</p>'
body += '<p>' + e('SA_ENV_SPEC (5): ') + e(', '.join('`%s`' % x.strip() for x in miss['docs/SA_ENV_SPEC.md'])) + e(' — בפועל הלקוח קורא ל-`/api/kol-haam/sa/queue`, `/api/sa/finance-summary`, `/api/sa/settings/<keys>` (sa-app.js:14322, 8353, 10288).') + '</p>'
body += '<p>' + e('BIZ_ENV_SPEC — 140 מתוך 258 שמות פונקציות אינם קיימים בקוד, למשל: ') + e(', '.join('`%s`' % x for x in df['docs/BIZ_ENV_SPEC.md']['missing'][:45])) + ' …</p>'
parts.append(section('התאמת נתיבי API ושמות פונקציות במסמכי md', 'api routes functions metrics docroutes', body))

grow = [(g, v['paths'], v['segs'], v['found'], '%d%%' % (100 * v['found'] // max(1, v['segs']))) for g, v in gp.items()]
gbody = table(['מדריך', 'ביטויי ניווט "A → B"', 'מקטעים שונים', 'מקטע נמצא מילולית בממשק', 'שיעור'], grow)
gbody += '<p>' + e('היוריסטיקה חלשה: כל מקטע בביטוי ניווט (אחרי הסרת אמוג\'י) חופש כמחרוזת ב-business.html, business-app.js, index.html, app.js, sa*, zone-manager*, kol-haam*, storefront*. '
                   'מקטעים רבים הם טקסט חופשי ("לחץ על…") ולכן שיעור נמוך אינו מוכיח סטייה; הממצאים הספציפיים מאומתים ידנית בסעיף 3.') + '</p>'
parts.append(section('מדריכי משתמש — היוריסטיקת נתיבי ניווט', 'guides navigation paths heuristic', gbody))

# ---------------------------------------------------------------- 3 per-document
parts.append('<h2 class="grp">3. התאמה לפי מסמך</h2>')

parts.append(section('SYSTEM_SPEC.md — מפרט מערכת טכני', 'system_spec architecture auth jwt tables api flows', claims([
 ('אינטגרציות: Gemini, Twilio, Nodemailer, Cloudinary', '§1, §10', 'as', 'nodemailer server.js:42; GEMINI_API_KEY server.js:222; sendSMSviaTwilio server.js:237; Cloudinary server.js:5848-5854'),
 ('Cloudinary מאומת דרך `CLOUDINARY_*` env', '§10', 'diff', 'הגדרות נשמרות ב-system_settings (`cloudinary_cloud_name`, `cloudinary_upload_preset`) והעלאה unsigned — server.js:5848-5854'),
 ('גדלי קבצים: app.js ~18,750, business-app.js ~62,500, sa-app.js ~16,400', '§1', 'as', 'בפועל 18,959 / 62,485 / 16,832 שורות'),
 ('ZM ב-`/zm.html`', '§1', 'diff', 'הקובץ הוא public/zone-manager.html; אין zm.html'),
 ('חנות ב-`/:alias` או `/store/:code`', '§1', 'part', '`/:alias` קיים (server.js:23346); נתיב `/store/...` אינו מוגדר בשרת (ראו rules-restaurant, QR שולחן)'),
 ('migrations ב-initDB עם CREATE/ALTER IF NOT EXISTS', '§2', 'as', 'initDB server.js:4406, נקרא ב-4503'),
 ('טבלאות `time_log_entries`, `shifts`, `payroll_runs`, `kh_articles/kh_content/kh_categories`, `ticket_replies`, `audit_log`', '§2', 'diff', 'לא קיימות. בפועל: `time_logs`; משמרות = משימות עם קידומת `SHIFT|` (business-app.js:72) + `shift_templates`; שכר דרך `/api/timeclock/payroll-run` (server.js:11853) ללא טבלה; קול-העם ב-`content_items`/`content_categories`; לוגים: `family_audit_log`/`biz_audit_log`/`sa_audit_log`'),
 ('7 middleware מבוססי JWT', '§3', 'diff', 'אין JWT בקוד. טוקן אקראי 32 בתים, sha256 ב-`family_sessions` (createFamilySession, verifyFamily server.js:41876, verifyBiz 41914 בודק session_type=biz); SA: טוקן גולמי ב-`sa_sessions` (6661); ZM: Map בזיכרון + שחזור לפי קידומת `ZM_<id>_` (6498-6525)'),
 ('קבוצות API: `/api/zm/*` ~15, `/api/transactions/*` ~15, `/api/sa/*` ~60', '§3', 'diff', 'בפועל `/api/zone-manager/*` 58 נתיבים ו-`/api/zm/articles` 3; תנועות: 4 נתיבים (`GET /api/transactions` 11371, `POST/PUT/DELETE /api/transaction` 11387-11432); `/api/sa/*` 290'),
 ('פורמט תגובה אחיד `{success,data}`', '§3', 'diff', 'אין עטיפה אחידה, למשל `/api/login` מחזיר `{success,user,group,token}` (server.js:10709-10714)'),
 ('טאבי FAMILY (14)', '§4', 'as', 'ALL_TABS app.js:9461-9476'),
 ('מחזור משימה pending→done→verified→rejected', '§4', 'diff', 'אין `verified`; סטטוסים: pending/done/approved/rejected/deleted/completed_self; תשלום רק ב-approved (POST /api/tasks/update server.js:12023)'),
 ('בדיקת תמונת הוכחה ב-Gemini', '§4', 'as', 'POST /api/tasks/vision-verify server.js:12549'),
 ('אישור אוטומטי + בונוס 10% אחרי בדיקת AI (עוקף אישור הורה)', '—', 'undoc', 'server.js:12584-12592'),
 ('אקדמיה: הלקוח מחשב ציון ושולח award-flw', '§4, §9 זרימה 3', 'diff', 'finishQuiz שולח תשובות ל-/api/academy/submit (app.js:4496); השרת מחשב ציון ומזכה (`rewardCredited` server.js:12141-12156). award-flw משמש משחקים (app.js:16055)'),
 ('כניסה במייל+סיסמה', '§4', 'diff', 'כניסה בקוד סביבה+כינוי+סיסמה (`/api/login` server.js:10619) או OTP טלפון (`/api/family/login/*` 10486-10558)'),
 ('SSO מחנות; חסימת קבוצה BUSINESS', '§8', 'as', '`/api/family/sso-login` server.js:43791, חסימה 43810; app.js:114-117'),
 ('15 סוגי עסק + מינוח דינמי', '§5', 'as', 'BUSINESS_TYPES business-app.js:37526; BUSINESS_CONFIG 37545; getBizTerm 37562'),
 ('GNAV 5 קבוצות עם הטאבים המפורטים', '§5', 'as', 'GNAV_GROUPS business-app.js:5402-5408 (תוויות בפועל: "רכש וספקים", "מלאי מחסן", "תקשורת" — business.html:735-830)'),
 ('לוגיסטיקה "12 sub-tabs" / יופי "7 sub-tabs"', '§4 טבלה', 'diff', 'בקוד 11 טאבי logistics_* ו-8 טאבי beauty_* (ALL_TABS business-app.js:3838-3891)'),
 ('שגרות רק ל-restaurant / maintenance_repair', '§5', 'as', 'ROUTINES_ALLOWED_BUSINESS_TYPES business-app.js:37895; verifyRoutinesBizType server.js:27211'),
 ('בקשת פתיחת מודול נעול ל-SA', '§5', 'as', 'POST /api/biz/module-request server.js:5918; PATCH /api/sa/groups/:id/module-request 5971'),
 ('RBAC של SA לפי permissions', '§6', 'diff', 'נאכף בצד לקוח בלבד (checkTabAccess sa-app.js:126-143); verifySA בודק רק קיום סשן (server.js:6661-6676)'),
 ('טאבי SA (15)', '§6', 'part', 'allTabs sa-app.js:442 — אין `families`; יש בנוסף insights, stats, legal, templates, auditlog, archive, games, feed, livegames, whatsapp, kol-haam, pricing, ai-builder, inbox'),
 ('קול-העם: אישור ZM ואז תמיד אישור SA', '§7', 'diff', 'אישור ZM מפרסם מקומית (`PUBLISHED_LOCAL`); רק scope GLOBAL עובר ל-`PENDING_SA` (server.js:40059-40085)'),
 ('Polling 30 שניות', '§8', 'as', 'app.js:1854; פעמון 30 שניות app.js:1855'),
 ('ריענון "הזמנות שלי" כל 15 שניות', '§8', 'diff', 'כל 3 שניות (app.js:951-1042)'),
 ('8 נקודות קצה `/api/ai/*` (budget-insight, recipe, quiz, advice, tutor…)', '§8', 'no', 'אינן קיימות. בפועל: /api/budget/familai-insight 12460, /api/pantry/familai-insight 12486, /api/forecast/familai-insight 12513, /api/tasks/ai-generate 12310, /api/recipes/generate 12206, /api/academy/ai-generate 12226, /api/goals/familai-advice 12430, /api/academy/tutor 12770'),
 ('סוללת AI', '§8', 'as', 'handleAITokens server.js:4170-4199 (10 ביום, premium 50, enterprise ללא הגבלה)'),
 ('זרימת FLW דרך `POST /api/flow/spend`', '§9 זרימה 2', 'diff', 'אין נתיב כזה; `/api/flow/redeem` 21950, `/api/flow/deduct` 22044 עם UPDATE אטומי ו-CHECK balance>=0 (21678)'),
 ('יצירת עסק: `POST /api/sa/create-business`, INSERT store_settings + flow_wallets + SMS', '§9 זרימה 4', 'diff', 'רישום עסק ב-`POST /api/biz/register` (server.js:8096) — INSERT ל-family_groups ו-users בלבד (8133, 8143); אין SMS/חנות/ארנק ביצירה'),
])))

parts.append(section('SPECIFICATION.md — אפיון מוצר (ינואר 2026)', 'specification vision family biz admin qa', claims([
 ('3 סביבות; ADMIN ב-`admin.html` + `admin-app.js`', 'סקירה', 'diff', 'אין admin.html; בפועל 4 סביבות: index.html, business.html, sa.html, zone-manager.html'),
 ('PayDay — חלוקת דמי כיס בלחיצה', 'FAMILY §5', 'as', 'POST /api/admin/payday server.js:11801'),
 ('הלוואה עם תאריך החזרה וריבית אפשרית', 'FAMILY §5', 'diff', 'טבלת loans ללא תאריך/ריבית (server.js:6476); סטטוסים pending→approved/rejected (11473-11503)'),
 ('יעדי חיסכון', 'FAMILY §5', 'as', 'POST /api/goals, /api/goals/deposit server.js:11504, 11520'),
 ('מזווה: מעקב תוקף, מעבר אוטומטי לרשימת קניות', 'FAMILY §4', 'part', 'מעבר ידני ("חסר") לרשימת קניות — לפי מסמך הלקוח; לא נמצא מעקב תאריך תפוגה בטבלת pantry'),
 ('שעון נוכחות עם GPS', 'BIZ §6', 'as', 'POST /api/timeclock/punch server.js:12919, רדיוס ברירת מחדל 150 מ\' (12938)'),
 ('שעות נוספות 125%', 'BIZ §6', 'no', 'לא נמצא חישוב שעות נוספות'),
 ('קופה: ברקוד', 'BIZ §1', 'part', 'שדה barcode בקטלוג (business-app.js:27640) ובווריאציות (62218); אין חיפוש לפי ברקוד בקופה'),
 ('נאמנות/נקודות, מחירון VIP', 'BIZ §2, §10', 'no', 'לא נמצאו מנגנוני נקודות/מחירון VIP בקוד הלקוח'),
 ('אקדמיה: תעודות, חסימת עבודה עד סיום קורס', 'BIZ §9', 'no', 'לא נמצא'),
 ('Session פג אחרי 30 דק\' חוסר פעילות', 'QA Security', 'diff', 'סשן משפחה/עסק 30 ימים (createFamilySession); SA 30 ימים (server.js:8545)'),
])))

parts.append(section('IMPLEMENTATION_PLAN.md — 5 שיפורי מסעדה', 'implementation plan restaurant timer discount daily report ratings seating', claims([
 ('שלב 1: טיימר צבעוני (ירוק/ענבר/כתום/אדום) — "בתהליך"', 'שלב 1', 'as', 'business-app.js:40431-40451'),
 ('שלב 2: הנחה ידנית %/סכום בקופה — "בתכנון"', 'שלב 2', 'as', 'manualDiscount נשמר במטא של ההזמנה business-app.js:33433'),
 ('שלב 3: דוח יום — טיפים, הנחות, top 5 מנות', 'שלב 3', 'as', 'business-app.js:33670-33720 (topItems slice(0,5))'),
 ('שלב 3: progress bars ליעדים יומיים', 'שלב 3', 'diff', 'יעד יומי קיים רק באנליטיקה (`analytics-target-revenue` business-app.js:1482), לא בדוח היום'),
 ('שלב 4: טרנד שבועי ואזהרת דירוגים שליליים', 'שלב 4', 'as', 'trendHtml ו-negative (≤2 כוכבים) business-app.js:55261-55280'),
 ('שלב 4: "מילים נפוצות"', 'שלב 4', 'no', 'לא נמצא'),
 ('שלב 5: חלונות הושבה', 'שלב 5', 'as', 'openSeatingWindowsModal business-app.js:40546-40564'),
 ('סטטוס המסמך ("בתכנון")', 'כללי', 'diff', 'רוב השלבים כבר ממומשים — המסמך מיושן'),
])))

parts.append(section('BUSINESS_ADMIN_MAPPING.md — מיפוי פעולות ניהול והצעת ארגון', 'business admin mapping settings hub ux', claims([
 ('הצעה: מרכז "ניהול/הגדרות" אחד בניווט', 'הצעה לסדר חדש', 'part', 'טאב `settings` ב-GNAV "עוד" (business-app.js:5407) עם renderSettingsHub (41834) — קיצורי דרך להגדרות חנות/יומן/צוות/מודאל הגדרות עסק/אזורי שירות; פרופיל המשתמש נשאר מודאל'),
 ('שולחנות כטאב רגיל ולא פאנל צף', 'הצעה', 'no', 'עדיין פאנל: אריח `__tables__` → openAdminTablesPanel (business-app.js:35127, 35171)'),
 ('openBusinessSettingsModal / openBankSettings קיימים', 'טבלה #36, #51', 'as', 'business-app.js:42103, 7580'),
 ('מחיקת חשבון עסק ב-Business Settings Modal', 'טבלה #52', 'no', 'לא נמצאה פעולת מחיקת חשבון עסק בצד העסק'),
 ('הרשאות לפי תפקיד: Cashier=קופה בלבד, Waiter=שולחנות', 'קבוצות משתמשים', 'part', 'ROLE_TYPE_TABS business-app.js:37506 מרחיב טאבים לפי תפקיד (קופאי מקבל pos, sales, tasks, timeclock, shifts) — לא "קופה בלבד"'),
])))

parts.append(section('FAMILY_TABLE_RESERVATION_SPEC.md + FAMILY_UX_CHANGES.md — הזמנת שולחן ממשפחה', 'table reservation family availability modal ux', claims([
 ('מודאל עם גריד שעות וזמינות לפי תאריך', 'שינויים בקוד §1-2', 'as', '_tableReservationModal app.js:14637; _loadTableAvailabilityForModal 14690'),
 ('`_highlightSelectedTime()`', '§4', 'diff', 'השם בפועל `_highlightSelectedTimeModal(time)` app.js:14732'),
 ('GET /api/public/restaurants/:groupId/availability/:date', 'API', 'as', 'server.js:33488 — סלוטים 10:00-23:00 (33513), תפוסה ±שעה, שולחן לכל 2 סועדים, ברירת מחדל 8 שולחנות'),
 ('POST /api/calendar/events עם callType=table_reservation, החזרת assignedTable', 'שלב 4', 'as', 'app.js:14759-14771; server.js:22891, 22952'),
 ('אין צורך ב-API חדש / אישור אוטומטי', 'API', 'undoc', 'אישור אוטומטי ושיבוץ שולחן לפי auto_approve_max_guests (server.js:22899-22918)'),
 ('POST /api/calendar/events ללא אימות; status נלקח מהבקשה', '—', 'undoc', 'אין middleware (api.json); `finalStatus = status || \'pending\'` server.js:22896'),
 ('בחירה מחדש / העברת הזמנה (preSelectedTime)', '—', 'undoc', '_loadTableAvailabilityForModal(…, preSelectedTime) app.js:14690; ביטול ההזמנה המקורית app.js:14779'),
 ('Responsive: 2 עמודות במובייל, grid auto-fill', 'UX Mobile', 'no', 'קבוע 3 עמודות `repeat(3,1fr)` app.js:14663'),
 ('נגישות: aria-label לכל כפתור שעה', 'UX נגישות', 'no', 'לא נמצא aria-label בכפתורי השעה (app.js:14700-14725)'),
 ('Initial load: ללא קריאת API בפתיחה', 'UX ביצועים', 'diff', 'נטענת זמינות להיום מיד בפתיחה (app.js:14687)'),
])))

parts.append(section('RESTAURANT_PROCESSES.md — מפת תהליכי מסעדה', 'restaurant processes pos tables kds waitlist loyalty alerts', claims([
 ('מחזור שולחן ירוק→אדום→כתום→ירוק + טיימר', 'חלק 1 §2', 'as', 'TABLE_STATE_CYCLE business-app.js:40158; סנכרון /api/tables/:groupId/states server.js:14233'),
 ('העברת שולחן, מיזוג, קיבולת', 'חלק 1 §2', 'diff', 'העברה נשמרת בשרת; מיזוג וקיבולת רק ב-localStorage (mergeTable business-app.js:40833) — לא משפיעים על זמינות בשרת'),
 ('QR לשולחן → תפריט ציבורי', 'חלק 1 §2', 'diff', 'URL `/store/{alias}?table=N` (showTableQR business-app.js:40529) — נתיב שאינו קיים בשרת, ופרמטר table לא נקרא'),
 ('ביטול הזמנה באישור מנהל משמרת', 'חלק 1 §1', 'no', 'לא נמצא תהליך אישור ביטול'),
 ('פיצול לפי סכום ולפי מנות, טיפ, הנחה', 'חלק 1 §1', 'as', 'openItemSplitModal business-app.js:32864; updateTenderDisplay 32968'),
 ('שיטות תשלום: מזומן/אשראי/ביט/חשבון/שי', 'חלק 1 §1', 'part', 'מסוף מלצר: מזומן/כרטיס/אפליקציה (waiterCloseBill 32335); "שי" applyFullDiscount 32948'),
 ('תחנות מטבח (KDS)', 'חלק 1 §3', 'part', 'kitchenStation על פריט בחשבון שולחן (business-app.js:31867); KDS לפי items_ready (PATCH /api/store/orders/:id/item-ready server.js:26384)'),
 ('בקשת חילוף משמרת', 'חלק 1 §4', 'no', 'לא נמצא'),
 ('התראת "עובד לא הגיע" 30 דק\' אחרי תחילת משמרת', 'חלק 2 התראות', 'diff', 'בדיקה יומית 08:00-08:05 ב-WhatsApp cron (server.js:4544)'),
 ('התראת מלאי נמוך badge + email', 'חלק 2 התראות', 'diff', 'WhatsApp יומי 09:00 (server.js:4618)'),
 ('תור המתנה עם טיימר (אדום אחרי 30 דק\')', 'חלק 2 §3', 'diff', 'מקומי למכשיר בלבד (localStorage waitlist_{gid}); ≥30 דק\' כתום (business-app.js:40865-40936)'),
 ('תוכנית נאמנות, קופון יום הולדת, דוח VIP', 'חלק 2 §4', 'no', 'לא נמצא'),
 ('"לקוח לא חזר" 60 יום', 'חלק 2 התראות', 'diff', 'רדומים = 30 יום ב-/api/restaurant/alerts/:groupId (server.js:33211) — ללא צרכן בקליינט'),
 ('סימון "86"/אזל', 'חלק 1 §9', 'as', 'קיים בקופה (retail-module-map מציין שמוסתר ל-retail)'),
 ('ייבוא תפריט מ-Excel', 'חלק 1 §9', 'as', 'downloadCatalogTemplate business-app.js:20858; EXCEL_BIZ_TYPES 20101'),
 ('הזמנת שולחן מרחוק + אישור אוטומטי', 'חלק 2 §2', 'as', 'server.js:22891-22952'),
 ('סגירת חשבון שולחן → דוח יומי', 'זרימה 1', 'diff', 'סגירת חשבון לא רושמת הכנסה בשרת; ארכיון ב-localStorage closed_bills (waiterConfirmCloseBill 32378); הכנסה נרשמת רק כשהזמנה עוברת ל-completed (server.js:14684)'),
])))

parts.append(section('SMS_SERVICE_SETUP.md / README_RENDER.md', 'sms twilio mada render deploy', claims([
 ('מצב בדיקה כשאין SMS_SERVICE — הדפסה ללוג', 'SMS', 'as', 'smsService server.js:56-84'),
 ('תמיכה ב-Twilio', 'SMS', 'diff', 'מומש ב-fetch ישיר ל-REST (sendSMSviaTwilio server.js:237-262) ולא בחבילת twilio; חלק מהזרימות קוראות ישירות ל-Twilio בלי smsService (למשל server.js:43785)'),
 ('Mada SMS', 'SMS', 'no', 'ערך אחר מחזיר "ספק SMS לא מוכר" (server.js:82-83)'),
 ('קוד OTP בן 4 ספרות', 'SMS זיכרון', 'part', 'תלוי זרימה; לא נבדק לכל זרימה'),
 ('Fallback ל-DB בזיכרון אם אין DATABASE_URL', 'README_RENDER', 'no', 'Pool נוצר תמיד מ-DATABASE_URL (server.js:265-271)'),
 ('Seed ~920 מוצרים בהרצה ראשונה', 'README_RENDER §5', 'part', 'לא אומת בבדיקה זו'),
])))

parts.append(section('docs/BIZ_ENV_SPEC.md — סביבת BIZ (אוקטובר 2026)', 'biz_env_spec biz login pos kds shifts timeclock beauty professional settings onboarding', claims([
 ('כניסה `POST /api/auth/login` / `/api/auth/send-otp`', '§2', 'no', 'אינם קיימים; בפועל `/api/biz/send-otp` 7596, `/api/biz/verify-otp` 7636, `/api/biz/login` 8172, `/api/login` 10619'),
 ('SSO לעסק `/business.html?sso_token` + `/api/biz/sso-login`', '§2', 'no', 'SSO קיים רק למשפחה וחוסם BUSINESS (server.js:43791-43810)'),
 ('ROLE_DEFAULTS לתפקידי בסיס', '§3', 'as', 'business-app.js:3893-3898'),
 ('ALL_TABS — 50 טאבים', '§4', 'diff', '52 רשומות (business-app.js:3838-3891)'),
 ('GNAV_GROUPS', '§4', 'as', 'business-app.js:5402-5408'),
 ('BUSINESS_TYPES + מינוח', '§6', 'as', 'business-app.js:37526, 37545'),
 ('POS: renderPOSCatalog/addToCart/submitPOSOrder, paymentMethod cash/credit/bit/check/flw', '§9', 'diff', 'שמות הפונקציות אינם קיימים; סיום מכירה → `POST /api/store/orders` (server.js:14447) ללא middleware אימות'),
 ('KDS: `GET /api/store/kds/:groupId`, `PATCH /api/store/kds/:id`', '§9, §30', 'no', 'אין נתיבים; KDS מבוסס store_orders + `PATCH /api/store/orders/:id/item-ready` (server.js:26384)'),
 ('יומן: בקשות תורים `/api/calendar/requests/*`; תזכורת SMS שעתיים לפני', '§12', 'no', 'אין נתיבים; לא נמצאה תזכורת SMS לתור'),
 ('משמרות `/api/shifts` CRUD, copy-week, export', '§13', 'no', 'משמרות נשמרות כמשימות `SHIFT|` (business-app.js:72); תבניות `/api/shift-templates` (server.js:13005-13030)'),
 ('נוכחות punch-in/punch-out, התראת 10 שעות', '§14', 'diff', 'נתיב יחיד `POST /api/timeclock/punch` עם גידור GPS (12919-12938); התראת 10 שעות לא נמצאה'),
 ('ספקים `/api/b2b/suppliers`', '§15', 'diff', 'בפועל `/api/suppliers*` ו-`/api/b2b/orders/create` (spec-retail-store §9)'),
 ('תנועות `/api/transactions/add|update|delete|export`', '§18', 'no', 'בפועל `/api/transaction` (11387-11432)'),
 ('שליחויות `/api/deliveries/*`', '§27', 'no', 'אין נתיבים; שליחויות דרך סטטוסי store_orders'),
 ('דוחות `/api/reports/sales|employees|finance|inventory|clients`', '§28', 'diff', 'נתיב יחיד `GET /api/reports/:groupId` (server.js:33754)'),
 ('יופי: `/api/beauty/bookings`, `/commissions/rates`, `/practitioners/:id/schedule`', '§29', 'diff', 'מבנה בפועל `/api/beauty/:bizId/...` — appointments, practitioners, resources, clients, formulas, photos (server.js:31212-32128)'),
 ('מידע רפואי "מוצפן בשרת"', '§29', 'diff', 'לא נמצאה הצפנה; הגנה בהרשאת תפקיד verifyBeautyClientAccess (server.js:41952)'),
 ('מומחים: `/api/professional/cases|leads|timelog|documents|content`', '§31', 'diff', 'בפועל `/api/professional-documents` (28829), `-leads`, `-articles`, `-expertise`, `-content`, `-doc-types`; אין `/api/professional/cases`'),
 ('ספורט: חברים, freeze, renew', '§32', 'as', '`/api/sport/members/:id/freeze` 29404, `/renew` 29668'),
 ('קריאות שירות: open→assigned→in_progress→resolved→closed, `/assign`', '§33', 'diff', 'אין נתיב assign; עדכון דרך `PATCH /api/service-calls/:id` (25821)'),
 ('פרסום FLOW: `/api/biz/ads/*`, סלוטים home_banner/feed_inline…', '§35', 'diff', 'בפועל `POST /api/biz/banner/orders` (verifyBizAdminOnly, server.js:34865) מול banner_slots של SA'),
 ('הגדרות: `openBizTypeSection` לשינוי סוג עסק + `PUT /api/biz/update-type`', '§36', 'no', 'אינם קיימים (ובניגוד לכלל 5 ב-CLAUDE.md). Hub בפועל business-app.js:41834'),
 ('7 פונקציות AI ב-`/api/ai/*`', '§37', 'no', 'אינן קיימות (ראו SYSTEM_SPEC)'),
 ('אשף 5 שלבים: `PUT /api/biz/onboarding-step`, `POST /api/biz/onboarding-complete`', '§39', 'diff', 'showBusinessTypeWizardV2 (business-app.js:19462) כש-is_onboarded=false (3231); שמירה `PATCH /api/biz/wizard/complete` (server.js:8331)'),
 ('Token = JWT', '§40', 'diff', 'טוקן אופאק (ראו SYSTEM_SPEC)'),
])))

parts.append(section('docs/FAMILY_ENV_SPEC.md — סביבת FAMILY (אוקטובר 2026)', 'family_env_spec login tabs shop bank academy myorders', claims([
 ('JWT ב-`ofl_family_token`', '§2', 'diff', 'טוקן אופאק (createFamilySession)'),
 ('`/api/auth/send-otp|verify-otp|login`', '§2', 'no', 'בפועל `/api/family/login/send-otp|verify-otp|password` (10486-10558), `/api/login` 10619'),
 ('רשימת טאבים כוללת `marketplace`, `kol-haam`', '§4', 'diff', 'ALL_TABS app.js:9461 — 14 טאבים, ללא marketplace/kol-haam'),
 ('Polling 30 שניות + pending users', '§4', 'as', 'app.js:1854'),
 ('Auto-refresh הזמנות כל 3 שניות', '§17', 'as', 'app.js:1042'),
 ('רשימות שמורות `/api/shopping/saved-lists`, `save-list`, `delete-multiple`', '§6', 'diff', 'בפועל `/api/shopping/saved` 11114, `/api/shopping/save` 11122; אין delete-multiple'),
 ('סריקת קבלה `/api/ai/scan-receipt`', '§6', 'diff', 'בפועל `/api/shopping/scan-receipt` 12599 + `/save` 12730'),
 ('Checkout: shopping_trips, transaction groceries, pantry', '§6', 'as', 'POST /api/shopping/checkout server.js:11048'),
 ('תקציב `/api/budget`, `/api/budget/add`, `/update/:id`', '§10', 'diff', 'בפועל `/api/budget/filter` 11330, `POST /api/budget/update` 11349'),
 ('הלוואות pending→active→paid; `/approve/:id`', '§8', 'diff', 'pending→approved/rejected; `/api/loans/approve` עם loanId בגוף (11473), ADMIN בלבד'),
 ('מחזור משימה verified', '§12', 'diff', 'approved (ראו SYSTEM_SPEC)'),
 ('פרס FLW בחידון: max(5,min(20,reward×1.5)) ב-award-flw מהלקוח', '§13', 'diff', 'השרת מחשב ציון ותגמול ב-/api/academy/submit (server.js:12126-12160); הנוסחה לא נמצאה'),
 ('זמינות שולחן `GET /api/calendar/availability/:groupId`', '§17', 'diff', 'בפועל `/api/public/restaurants/:groupId/availability/:date` (33488)'),
 ('fetchData → `GET /api/dashboard/family/:groupId`', '§25', 'diff', 'בפועל `GET /api/data/:userId` (app.js:2236, server.js:10755)'),
 ('Service Worker sw.js', '§23', 'as', 'public/sw.js קיים'),
 ('SOLO activate', '§24', 'as', 'POST /api/solo/activate server.js:2469'),
])))

parts.append(section('docs/SA_ENV_SPEC.md — Super-Admin', 'sa_env_spec rbac tabs pulse support finance impersonation', claims([
 ('כניסה עם code+password, טוקן אופאק, Authorization ללא Bearer', '§1-2', 'as', 'POST /api/superadmin/login server.js:8558; verifySA 6661'),
 ('fallback לסיסמת ברירת מחדל `123456` כשלא הוגדרה', '—', 'undoc', 'server.js:8598 (ראו rules-sa)'),
 ('RBAC: tabRequirements / checkTabAccess', '§3', 'as', 'sa-app.js:91-143 — אך אין אכיפה בשרת (המסמך אינו מציין זאת)'),
 ('allTabs 30 טאבים, SA_GROUPS 14', '§4', 'as', 'sa-app.js:442, 533'),
 ('מכסות AI: solo/standard 10, premium 50, enterprise ללא הגבלה', '§8', 'as', 'server.js:4176-4182'),
 ('Live Pulse `GET /api/sa/live-pulse`', '§5', 'no', 'אין נתיב כזה (renderLivePulse sa-app.js:1303)'),
 ('Finance `GET /api/sa/finance`, Masterconfig `/api/sa/config`, `/api/sa/email-settings`', '§13, §21', 'diff', 'בפועל `/api/sa/finance-summary` (sa-app.js:8353), `/api/sa/settings/<keys>` (10288), `/api/superadmin/data` (10277)'),
 ('Kol-Haam queue `/api/sa/kol-haam-queue`', '§23', 'diff', 'בפועל `/api/kol-haam/sa/queue` (sa-app.js:14322)'),
 ('Impersonation דרך `/api/sa/biz-impersonate-token`', '§32', 'as', 'server.js:44011'),
])))

parts.append(section('docs/ZM_ENV_SPEC.md — Zone-Manager', 'zm_env_spec zone manager login campaigns kol-haam', claims([
 ('URL zone-manager.html, טוקן ב-zm_token, ללא Bearer', '§1', 'as', 'public/zone-manager.html; verifyZoneManager server.js:6498'),
 ('59/63 נתיבים קיימים; `GET /api/zm/zones` לא קיים', 'כללי', 'part', 'docroutes.json'),
 ('סשן ZM', '§2', 'undoc', 'Map בזיכרון; אחרי ריסטארט כל טוקן בתבנית `ZM_<id>_*` מתקבל עבור מנהל פעיל (server.js:6507-6520) — טוקן ניתן לזיוף; לא מתועד'),
 ('אישור תוכן קול-העם ע"י ZM', '§15', 'as', 'POST /api/kol-haam/zm/:id/approve server.js:40059 (מקומי → PUBLISHED_LOCAL)'),
])))

parts.append(section('docs/spec-biz-environment.md / spec-family-environment.md / spec-super-admin.md / spec-zone-community.md (יוני 2026)', 'spec biz family super-admin zone community notebooklm server1', claims([
 ('מבוסס על `server1.js`', 'כותרת', 'diff', 'אין server1.js במאגר; השרת הוא server.js (קיים גם services/server (1).js)'),
 ('כל הנתיבים המוזכרים קיימים (216/216 ב-biz, 257/261 ב-family, 134/134 ב-SA, 91/92 ב-ZM)', 'API', 'as', 'docroutes.json'),
 ('spec-family: myorders מתרענן "כל 20 שניות" (§1, §4) ובמקום אחר "כל 3 שניות בפועל"', '§1 שורה 86, §4 שורה 1813', 'diff', 'סתירה פנימית; בקוד 3 שניות (app.js:1042)'),
 ('spec-family: `/api/shopping/identify-product`', '§3', 'no', 'הלקוח קורא (app.js:2818) והנתיב לא קיים בשרת'),
 ('spec-biz: showBusinessTypeWizard כש-business_type חסר', '§3', 'diff', 'גרסה V2 נקראת כש-is_onboarded=false (business-app.js:3231); V1 עדיין קיימת (19378)'),
 ('spec-zone-community: Gemini 2.5 Flash עם fallback', '§7', 'as', 'gemini-2.5-flash ×23, 2.0-flash-lite ×4, 1.5-flash ×3 ב-server.js'),
])))

parts.append(section('docs/spec-qa-book.md — ספר QA', 'qa book tests edge cases', claims([
 ('Edge 6.2: POST ישיר ל-/api/store/orders עם items ריק → 400', '§6.2', 'part', 'לא אומת; הנתיב ללא אימות (server.js:14447)'),
 ('Edge 6.5: גישה ישירה לטאב נעול → guard', '§6.5', 'diff', 'אכיפה בצד לקוח בלבד; בשרת requireModule רק ל-logistics/sales/menu_templates (api.json mw)'),
 ('Edge 6.6: `/api/store/orders/status` עם delivering לא-משלוח → 400', '§6.6', 'no', 'הנתיב `/api/store/orders/status` לא קיים כפי שנכתב'),
 ('Premium עם ai_tokens=0 עדיין עובד', '§6.1', 'diff', 'premium מקבל 50 ביום; רק enterprise (או is_premium ללא plan) ללא הגבלה (server.js:4175-4182)'),
])))

parts.append(section('docs/spec-retail-store.md — חנות קמעונאית', 'retail store variants inventory returns promotions barcode', claims([
 ('סטטוס "טרם אושר ליישום"', 'כותרת', 'diff', 'רוב שלב א\' ו-ד\' ממומשים — המסמך מעודכן חלקית בגוף אך לא בכותרת'),
 ('עמודות store_catalog: barcode, unit_type, cost_price, low_stock_threshold, supplier_id, supplier_sku, has_variants, track_inventory, variant_attributes_schema', '§3.1', 'as', 'schema.json store_catalog (כל 9 העמודות קיימות)'),
 ('store_product_variants, store_inventory_movements, store_stock_counts(+items), store_returns(+items)', '§3.2-3.8', 'as', 'server.js:1283, 1305, 1320, 1361; נתיבים `/api/biz/retail/*` 13384-13594 (requireModule(\'sales\'))'),
 ('"לא endpoints חדשים תחת /api/biz/retail/..." (לספקים)', '§3.3', 'as', 'ספקים נשארו ב-/api/suppliers; /api/biz/retail משמש למלאי/וריאציות/החזרות/ספירות'),
 ('store_retail_promotions + מנוע מחיר שרתי', '§3.7, שלב ג\'', 'diff', 'הטבלה נוצרת (server.js:1343) ואינה בשימוש; buy_x_get_y מומש על store_promotions הקיימת (buy_qty/get_qty, חישוב server.js:14423-14440)'),
 ('החזרה ממסך "ההזמנות שלי" בסטטוס pending לאישור העסק', '§5.4', 'diff', 'החזרה נוצרת ונסגרת מיידית ע"י העסק (מסמך הלקוח פרק 3); לא נמצא כפתור החזרה בצד המשפחה'),
 ('סריקת ברקוד (סורק USB) בקופה', '§6.1', 'no', 'אין חיפוש לפי barcode בקופה (רק שדות barcode בטפסים business-app.js:27640, 62218)'),
 ('מכירה לפי משקל בקופה', '§6.2', 'part', 'unit_type בקטלוג (business-app.js:27648); לא אומת מחשבון משקל בקופה'),
 ('retail/store_only → storefront-market.html', '§5.1', 'as', 'server.js:23372-23378'),
 ('דוח רווחיות', 'שלב ה\'', 'no', 'המסמך עצמו מציין חסר'),
])))

parts.append(section('docs/spec-shuka-feature.md + test-checklist-shuka.md + WEFLOWZ-shuka-customer-doc.md', 'shuka community campaigns market radar', claims([
 ('טבלאות community_campaigns (+start_at,end_at,recurrence,is_open_for_requests), campaign_products (+price_override, approval_status), campaign_requests, store_orders.campaign_id', 'spec §2', 'as', 'schema.json'),
 ('start_at/end_at/recurrence תיאוריים בלבד; אין חסימת הזמנות לפי זמן', 'spec §12', 'diff', 'קיימת חסימת הזמנות לפי active_days/active_hours (שעון השרת) — server.js:15464-15500; עמודות active_days/active_hours (16548) אינן מתועדות'),
 ('עמוד ציבורי `/campaign/:code`, הזמנה מעסק אחד', 'spec §7', 'as', 'server.js:15354, 15385, 15450'),
 ('ניווט עסק: "חנות ומכירות" → "שוקה" → "רדאר שווקים"', 'customer doc / checklist 1.1', 'as', 'switchSalesTab(\'shuka\') business-app.js:941; switchShukaTab(\'radar\') 1639'),
 ('"דיגיטלי, זמין 24/7"', 'customer doc', 'diff', 'מנהל השוק יכול להגביל ימים/שעות ו-ordering_enabled (server.js:15462-15500)'),
 ('תגית "מחיר שוק ✨"', 'customer doc §3', 'as', 'community-store-app.js:216'),
])))

parts.append(section('docs/security-audit-report-2026-10.md — דוח אבטחה FAMILY', 'security audit idor join academy loans data password bootstrap', claims([
 ('/api/join לעולם לא מעניק ADMIN', '§3 #1', 'as', 'server.js:10370'),
 ('/api/academy/submit — ציון בשרת', '§3 #2', 'as', 'server.js:12126-12160'),
 ('/api/loans/approve — ADMIN, סכום מהרשומה, status=pending', '§3 #3', 'as', 'server.js:11473-11486'),
 ('/api/data/:userId — אימות והסרת password_hash', '§3 #4', 'as', 'server.js:10755-10762'),
 ('set-first-password עם verifyFamily', '§3 #7', 'as', 'server.js:11709'),
 ('Flow: UPDATE אטומי + CHECK balance>=0', '§4.7', 'as', 'server.js:21678'),
 ('"לא נותרה פרצת IDOR/אימות קריטית ידועה" בהיקף FAMILY', '§1, §7', 'diff', '`POST /api/community/bootstrap-token` (server.js:10721-10737) מנפיק סשן משפחה לכל זוג groupId+userId ללא סיסמה; `/api/login` מחזיר `user: userRow` כולל password_hash (server.js:10711)'),
 ('/api/shopping/identify-product לא קיים', '§6', 'as', 'app.js:2818; אין נתיב'),
 ('היקף: SA/ZM/BIZ לא נבדקו', '§7', 'as', 'בפועל: /setup-db ו-/api/force-upgrade ללא אימות (server.js:6439, 6391); ZM token ניתן לזיוף (6507)'),
])))

parts.append(section('docs/retail-module-map-internal.md + WEFLOWZ-retail-*-customer-v1.md', 'retail modules customer capabilities permissions pos', claims([
 ('14 מודולים ל-retail', 'map כותרת', 'as', 'BUSINESS_TYPES business-app.js:37526 (שורה מצוטטת 37524 — הסטה קלה)'),
 ('מי יכול להשתמש בקופה: רק תפקידי מכירה', 'customer modules §3', 'diff', '`POST /api/store/orders` ללא middleware (server.js:14447) — ההגבלה בממשק בלבד (כפי שה-map הפנימי מציין)'),
 ('מבצע "קנה X קבל Y", קופון', 'customer capabilities §6', 'as', 'server.js:14423-14440; store_coupons'),
 ('החזרה נסגרת מיידית + store credit', 'customer capabilities §3', 'as', '`POST /api/biz/retail/returns` 13523; store_customers.credit_balance'),
 ('נוכחות עם אימות מיקום', 'customer modules §12', 'as', 'server.js:12919-12945'),
 ('קופאי: פתיחה/סגירת קופה', 'customer modules §2', 'as', '`/api/biz/register/open|close` server.js:42024, 42043'),
])))

parts.append(section('docs/WEFLOWZ-family-capabilities-customer-v1.md — מסמך לקוח למשפחות', 'family customer capabilities join approval tasks ai bonus communities', claims([
 ('הצטרפות תמיד דורשת אישור מנהל', '§2', 'as', 'משתמש חדש נוצר status=\'pending\' (server.js:10394-10400); אישור ב-/api/admin/approve-user 11597'),
 ('בדיקת AI מאשרת ומשלמת + בונוס 10%', '§4', 'as', 'server.js:12584-12592 (הדוח האבטחתי מסווג זאת כסיכון "עקיפת ADMIN")'),
 ('עד 5 קהילות', '§13', 'as', 'server.js:18503'),
 ('כפתורי "שדרוג ל-Pro"', '—', 'undoc', 'placeholder ללא תשלום (security report §6)'),
])))

guide_rows = [
 ('beauty-guide — 6 KPIs בדשבורד', 'part', 'renderBeautyAdminDashboard (business-app.js:45808) מציג 7 KPIs — "ממתין לגביה מלקוחות" חסר במדריך; התווית "לקוחות מקושרים" בקוד "לקוחות עם חשבון מקושר"'),
 ('beauty-guide — 8 פעולות מהירות', 'as', 'business-app.js:45808 ואילך (יומן תורים, לקוחות, מטפלות, שירותים, מנויים, עמלות, קופה, משימות)'),
 ('restaurant-guide — QR לשולחן', 'diff', 'QR מצביע ל-/store/... שאינו קיים בשרת (business-app.js:40529)'),
 ('restaurant-guide — פיצול לפי מנות 2–6 חלקים, הנחה %/₪', 'as', 'business-app.js:32855-32968'),
 ('retail-guide — נקודות נאמנות, רמות חברות, מימוש נקודות בקופה', 'no', 'לא נמצא בקוד (אין "מימוש נקודות"/"נקודות נאמנות" ב-business-app.js/business.html)'),
 ('retail-guide — סריקת ברקוד בקופה', 'no', 'ראו spec-retail-store §6.1'),
 ('retail-guide — "הוסף מדפסת", מחסנים מרובים', 'no', 'לא נמצא; הדפסת קבלה דרך iframe (business-app.js:10917)'),
 ('sport-guide — "החלף מאמן" בפרטי שיעור', 'diff', 'אין פעולה ייעודית; עדכון trainer_id דרך `PUT /api/sport/classes/:id` (server.js:29770-29773)'),
 ('logistics-guide — מפה חיה של נהגים, Dispatcher Drag & Drop', 'no', 'אין ספריית מפות ואין גרירה בלוגיסטיקה (רק בשקופית שיווקית business-app.js:2159)'),
 ('CLAUDE.md כלל 6 — מדריך יופי בלבד מוגדר', 'diff', 'קיימים 15 מדריכים; לסוגים construction/healthcare/education/events/food_production/store_only/other אין מדריך'),
]
parts.append(section('מדריכי משתמש public/*-guide.html — בדיקות ממוקדות', 'guides beauty restaurant retail sport logistics kpi quick actions', table(['טענה במדריך', 'סיווג', 'ראיה'], [(a, CLS[b], c) for a, b, c in guide_rows])))

parts.append(section('CLAUDE.md — כללים 5 ו-6 מול הקוד', 'claude.md rule business type selection guide', claims([
 ('בחירת סוג עסק רק באשף ההקמה או ב-SA', 'כלל 5', 'diff', 'מודאל ייבוא Excel מציג בחירת "סוג עסק" (EXCEL_BIZ_TYPES business-app.js:20101) — משמש לתבנית קטגוריות בלבד; ובשרת `PATCH /api/groups/:id/business-settings` משנה business_type ללא אימות (server.js:26373-26381)'),
 ('ניווט BIZ: GNAV_GROUPS (5) + ALL_TABS + BUSINESS_TYPES[].modules', 'ארכיטקטורה', 'as', 'business-app.js:5402, 3838, 37526'),
 ('יופי: טאבים עם data-beauty-only מוסתרים ומוצגים ע"י renderBeautyAdminDashboard', 'ארכיטקטורה', 'as', 'renderBeautyAdminDashboard business-app.js:45808'),
])))

# ---------------------------------------------------------------- 4 deviations
parts.append('<h2 class="grp">4. סטיות מרכזיות — מועמדות להחלטת "התנהגות מיועדת"</h2>')
dev = [
 ('אימות', 'SYSTEM/BIZ/FAMILY_ENV: JWT', 'טוקן אקראי מגובב ב-family_sessions; SA טוקן גולמי; ZM Map בזיכרון', 'server.js:41876, 41914, 6661, 6498', 'האם לאמץ JWT או לעדכן את המסמכים לטוקן אופאק?'),
 ('אימות ZM', 'ZM_ENV: טוקן מאומת', 'אחרי ריסטארט מתקבל כל `ZM_<id>_*` של מנהל פעיל', 'server.js:6507-6520', 'לשמור סשני ZM ב-DB? (קיימות שאילתות ל-zone_manager_sessions — server.js:41097, 41428, 41457, 46160 — אך הטבלה אינה נוצרת בסכמה, והשגיאה נבלעת ב-catch)'),
 ('RBAC SA', 'SYSTEM §6, SA_ENV §3', 'אכיפה בצד לקוח בלבד', 'sa-app.js:126; server.js:6661', 'האם RBAC חייב להיאכף בשרת?'),
 ('סיסמת SA ברירת מחדל', '— (לא מתועד)', '`123456` כש-sa_password לא הוגדר', 'server.js:8598', 'לבטל ברירת מחדל?'),
 ('סשן משפחה ללא סיסמה', 'Security report: אין פרצה ידועה', '`/api/community/bootstrap-token` מנפיק סשן לפי groupId+userId', 'server.js:10721-10737', 'להגביל/להסיר?'),
 ('דליפת password_hash', 'Security report #4: הוסר', 'מוסר ב-/api/data אך מוחזר ב-/api/login', 'server.js:10711 מול 10762', 'להסיר מכל תגובות login?'),
 ('נקודות תחזוקה פתוחות', 'לא מתועד במסמכי כוונה', '/setup-db (DROP לטבלאות ליבה), /api/force-upgrade, /api/debug/*', 'server.js:6439, 6391, 25782, 34982', 'להסיר או להגן?'),
 ('שינוי סוג עסק', 'CLAUDE.md כלל 5', '`PATCH /api/groups/:id/business-settings` ללא אימות; בחירת סוג במודאל Excel', 'server.js:26373; business-app.js:20101', 'להגביל לאשף/SA ולהוסיף אימות'),
 ('קופה פתוחה', 'מסמכי לקוח: רק תפקידי מכירה', '`POST /api/store/orders` ללא middleware', 'server.js:14447', 'אכיפת תפקיד בשרת?'),
 ('יצירת אירוע ביומן', 'FAMILY_TABLE_RESERVATION: בקשה pending', 'ללא אימות; status מהגוף', 'server.js:22891-22896', 'לקבע pending/approved בשרת'),
 ('מחזור משימה', 'SYSTEM/FAMILY_ENV: verified', 'approved/rejected/deleted/completed_self', 'server.js:12023', 'לעדכן מסמכים או לשנות שמות'),
 ('אישור משימה ע"י AI', 'SYSTEM: AI כהוכחה; Security: סיכון', 'אישור ותשלום אוטומטי + 10%', 'server.js:12584', 'האם AI רשאי לשלם בלי הורה?'),
 ('תגמול אקדמיה', 'SYSTEM/FAMILY_ENV: award-flw מהלקוח', 'השרת מחשב ציון ותגמול ב-submit', 'server.js:12126-12160', 'לעדכן מסמכים'),
 ('נתיבי AI', 'SYSTEM/BIZ/FAMILY_ENV: `/api/ai/*`', 'נתיבי familai-* לפי מודול', 'server.js:12206-12770', 'לעדכן מסמכים'),
 ('זרימת FLW', 'SYSTEM: /api/flow/spend', 'redeem/deduct', 'server.js:21950, 22044', 'לעדכן מסמכים'),
 ('הקמת עסק', 'SYSTEM זרימה 4: store_settings, ארנק, SMS', 'רק family_groups+users', 'server.js:8096-8150', 'האם ליצור חנות/ארנק בהרשמה?'),
 ('הלוואות', 'SPECIFICATION: תאריך החזרה/ריבית; FAMILY_ENV: active/paid', 'אין תאריך/ריבית; approved/rejected', 'server.js:6476, 11473-11503', 'האם נדרש מעקב החזר?'),
 ('ריענון הזמנות', 'SYSTEM: 15 ש\'; spec-family: 20 ש\'', '3 שניות', 'app.js:1042', 'לקבע ערך'),
 ('אישור קול-העם', 'SYSTEM: ZM ואז SA', 'מקומי → פרסום מיידי; GLOBAL → SA', 'server.js:40059-40085', 'לאשר את המודל הדו-רמתי'),
 ('משמרות', 'BIZ_ENV: /api/shifts', 'משימות SHIFT| + shift_templates', 'business-app.js:72; server.js:13005', 'האם נדרשת טבלת shifts?'),
 ('נוכחות', 'BIZ_ENV: punch-in/out, התראת 10 שעות', 'punch יחיד + GPS 150 מ\'; ללא התראה', 'server.js:12919-12938', 'האם נדרשת התראת שעות?'),
 ('שעון נוכחות ללא אימות', '—', '/api/timeclock/punch ללא middleware, userId מהגוף', 'server.js:12919', 'לאמת זהות עובד'),
 ('KDS', 'BIZ_ENV: /api/store/kds', 'items_ready על store_orders', 'server.js:26384', 'לעדכן מסמכים'),
 ('שליחויות', 'BIZ_ENV: /api/deliveries/*', 'סטטוסי store_orders (shipped/delivering)', 'app.js:978 statusMap', 'לעדכן מסמכים'),
 ('דוחות', 'BIZ_ENV: 5 נתיבי דוחות', 'GET /api/reports/:groupId יחיד', 'server.js:33754', 'לעדכן מסמכים'),
 ('יופי — API', 'BIZ_ENV: /api/beauty/bookings…', '/api/beauty/:bizId/appointments…', 'server.js:31212-32128', 'לעדכן מסמכים'),
 ('יופי — מידע רפואי', 'BIZ_ENV: מוצפן', 'ללא הצפנה; הרשאת תפקיד', 'server.js:41952', 'האם נדרשת הצפנה?'),
 ('מומחים — API', 'BIZ_ENV: /api/professional/cases…', '/api/professional-documents|leads|…', 'server.js:28829', 'לעדכן מסמכים'),
 ('הגדרות', 'BIZ_ENV §36: שינוי סוג עסק, תשלומים, אינטגרציות', 'hub קיצורי דרך בלבד', 'business-app.js:41834', 'להחליט מה ה-hub כולל'),
 ('אשף הקמה', 'BIZ_ENV: onboarding-step/complete', 'Wizard V2 + PATCH /api/biz/wizard/complete', 'business-app.js:19462; server.js:8331', 'לעדכן מסמכים; להסיר V1 (19378)?'),
 ('SSO לעסק', 'BIZ_ENV: sso_token לעסק', 'SSO חוסם BUSINESS', 'server.js:43810', 'לאשר חסימה'),
 ('טאבי FAMILY', 'FAMILY_ENV: marketplace, kol-haam', '14 טאבים בלבד', 'app.js:9461', 'האם הם טאבים או overlay?'),
 ('טאבי SA', 'SYSTEM: families', 'אין families ב-allTabs', 'sa-app.js:442', 'לעדכן'),
 ('מבצעי קמעונאות', 'spec-retail §3.7: store_retail_promotions', 'טבלה מתה; BXGY על store_promotions', 'server.js:1343, 14423', 'למחוק טבלה או לאחד?'),
 ('החזרות', 'spec-retail §5.4: בקשת לקוח pending', 'נסגרת מיידית בצד העסק', 'server.js:13523', 'האם נדרש מסלול לקוח?'),
 ('ברקוד בקופה', 'spec-retail §6.1; retail-guide; SPECIFICATION', 'שדה בלבד', 'business-app.js:27640', 'לממש או להסיר מהמדריך'),
 ('נאמנות', 'RESTAURANT_PROCESSES, SPECIFICATION, retail-guide', 'לא קיים', '—', 'האם בתכולה?'),
 ('תור המתנה', 'RESTAURANT_PROCESSES', 'localStorage בלבד', 'business-app.js:40865', 'לשמור בשרת?'),
 ('מיזוג/קיבולת שולחן', 'RESTAURANT_PROCESSES', 'localStorage בלבד', 'business-app.js:40833', 'לסנכרן?'),
 ('QR שולחן', 'RESTAURANT_PROCESSES, restaurant-guide', 'קישור לנתיב לא קיים', 'business-app.js:40529', 'לתקן נתיב / קריאת table'),
 ('סגירת חשבון שולחן', 'RESTAURANT_PROCESSES: עסקה + דוח', 'ארכיון מקומי; הכנסה רק ב-completed', 'business-app.js:32378; server.js:14684', 'מקור אמת להכנסה?'),
 ('לקוח רדום', 'RESTAURANT: 60 יום', '30 יום, ללא צרכן', 'server.js:33211', 'לקבע סף ולהציג'),
 ('התראות', 'RESTAURANT: email/30 דק\'', 'WhatsApp cron 08:00/09:00/19:00', 'server.js:4544-4640', 'לאשר ערוץ ותזמון'),
 ('שוקה — זמני פעילות', 'spec-shuka §12: לא נאכף', 'active_days/hours נאכף בהזמנה', 'server.js:15464-15500', 'לעדכן מפרט; אזור זמן?'),
 ('שוקה — 24/7', 'customer doc', 'ניתן להגביל', 'server.js:15462', 'לעדכן מסמך לקוח'),
 ('הזמנת שולחן — UI', 'FAMILY_UX: responsive, aria', 'קבוע 3 עמודות, ללא aria', 'app.js:14663', 'האם נדרש?'),
 ('זמינות שולחנות', 'FAMILY_TABLE_RES: מספר שולחנות פנויים', 'שולחן לכל 2 סועדים, חלון ±שעה, 10:00-23:00', 'server.js:33513-33530', 'לאשר אלגוריתם'),
 ('SMS', 'SMS_SETUP: Twilio SDK, Mada', 'REST ישיר; Mada לא נתמך; זרימות עוקפות smsService', 'server.js:237, 82, 43785', 'לאחד שירות SMS'),
 ('DB fallback', 'README_RENDER: in-memory', 'לא קיים', 'server.js:265', 'לעדכן README'),
 ('אדמין', 'SPECIFICATION: admin.html', 'sa.html + zone-manager.html', 'public/', 'לעדכן'),
 ('סשן', 'SPECIFICATION QA: פג אחרי 30 דק\'', '30 ימים', 'createFamilySession; server.js:8545', 'מדיניות תוקף?'),
 ('מספר טאבים', 'BIZ_ENV 50; SYSTEM לוגיסטיקה 12, יופי 7', '52 / 11 / 8', 'business-app.js:3838-3891', 'לעדכן'),
 ('Beauty guide KPI', 'beauty-guide: 6', '7 (כולל ממתין לגביה)', 'business-app.js:45808', 'לעדכן מדריך (כלל 6)'),
 ('לוגיסטיקה', 'logistics-guide: מפה חיה, Drag&Drop', 'לא קיים', 'business-app.js:2159 (שקופית)', 'לממש או להסיר מהמדריך'),
 ('ספורט', 'sport-guide: "החלף מאמן"', 'עריכת שיעור כללית', 'server.js:29770', 'פעולה ייעודית?'),
 ('ספר QA', 'spec-qa: premium ללא הגבלה', 'premium=50/יום', 'server.js:4182', 'לעדכן'),
 ('תוכנית מסעדה', 'IMPLEMENTATION_PLAN: "בתכנון"', 'רוב השלבים ממומשים', 'business-app.js:33670, 40546', 'לסגור/לעדכן את התוכנית'),
 ('retail spec סטטוס', '"טרם אושר"', 'ממומש ברובו', 'server.js:13384-13594', 'לעדכן כותרת'),
 ('server1.js', 'spec-* (יוני)', 'server.js', '—', 'לעדכן הפניות'),
 ('Cloudinary config', 'SYSTEM: env', 'system_settings', 'server.js:5848', 'לעדכן'),
]
parts.append(section('טבלת סטיות (%d)' % len(dev), 'deviations decisions owner intended behavior', table(['#', 'תחום', 'מה המסמך אומר', 'מה הקוד עושה', 'ראיה', 'שאלה להחלטה'], [(str(i + 1),) + r for i, r in enumerate(dev)])))

# ---------------------------------------------------------------- 5 undocumented
parts.append('<h2 class="grp">5. יכולות בקוד שאינן מוזכרות באף מסמך כוונה</h2>')
und = [
 ('פקודות עבודה', '42 נתיבי `/api/work-orders` + טבלאות work_order_* (assignees, equipment, inventory, messages, timeline, payments, quote_links)', 'server.js:17246 ואילך'),
 ('מנוע שגרות', '`/api/routines` 26 + `/api/routine-occurrences` 9, אתרים, חוזי שירות, סבבי אישור, קישורי לקוח `/c/rt`', 'server.js:27284; 27778 (rules-routines)'),
 ('משחקים חיים', '`/api/live-games` 20 + live_game_*; `/game/:game_code`', 'server.js:38701, 39220'),
 ('אימות לקוחות חנות', '`/api/sc-auth` 13 (OTP, PIN, הרשמה, הנפקת SSO)', 'server.js:43210-43519'),
 ('CRM מסעדה וביקורים', '`/api/restaurant` 10 (צ\'ק-אין עצמי, דשבורד, רדומים)', 'server.js:33058-33211'),
 ('סנכרון מצב שולחנות', '`/api/tables` 8 (states, bills, assignments, reservations-today)', 'server.js:14233-14265, 23145'),
 ('סקרים', '`/api/surveys` 7, survey.html', 'server.js:24758'),
 ('מסמכים מקצועיים', 'גרסאות, סוגי מסמך, מאמרים, מומחיות, לידים, תוכן (~22 נתיבים)', 'server.js:28829'),
 ('תקשורת פנימית', 'team_posts, internal_messages, message_acknowledgments', 'server.js:13063'),
 ('עסקי דמו', 'הפעלה/איפוס/snapshot (demo_snapshots)', 'server.js:17965-18051'),
 ('גיבויי סביבה', 'group_snapshots + takeGroupSnapshot', 'server.js:6684; 7097'),
 ('תפריטי אירועים', 'menu_templates/sections/items/quote_requests; menu.html, menus.html', 'server.js:46314'),
 ('פלטפורמת כותבים קול-העם', 'author_profiles/followers/achievements, editor_picks, collections, AI copilot, scan whitelist', 'server.js:39236 (rules-kolhaam)'),
 ('WhatsApp cron', 'שכחת החתמה, הזמנות שלא טופלו, משימות שפגו, מלאי נמוך, תכנון מחר + סוגים דינמיים', 'server.js:4525-4719'),
 ('גבייה מעסקים', 'business_platform_dues/collections, payment_confirmations', 'server.js:18712'),
 ('מעקב משלוח ציבורי', '`/track/:token`, track.html', 'server.js:33239'),
 ('פופאפים לחנות ולעובדים', 'store_popups — כולל popup לעובד בהשלמת משימה', 'rules-family (POST /api/tasks/update)'),
 ('קופה רושמת', 'register_sessions, `/api/biz/register/today|open|close`', 'server.js:42012-42043'),
 ('הזמנת שולחן ציבורית עם SMS', 'temp_booking_requests / temp_table_reservations (2 שלבים)', 'rules-restaurant'),
 ('Food cost מתקדם', 'תקורות קבועות, presets, נקודת איזון', 'server.js:22714 (rules-restaurant)'),
 ('ספורט מורחב', 'הצהרות בריאות, waivers, רשימת המתנה לשיעור, ציוד, מדיניות ביטול', 'server.js:29229 ואילך'),
 ('יופי מורחב', 'משאבים (חדרים), מקטעי תור, פורמולות, תמונות', 'server.js:31335, 32074, 32101'),
 ('ארנקי קהילה', 'community_wallets + transactions, referrals, bundles', 'rules-community'),
 ('צ\'אט לקוח-עסק', 'customer_chats, biz_dm_messages', 'rules-store'),
 ('רשימת המתנה לפיילוט', 'pilot_waitlist, `POST /api/pilot-waitlist`', 'server.js:7534'),
 ('נקודות קצה מסוכנות', '/setup-db, /api/force-upgrade, /api/test-email, /api/debug/*', 'server.js:6439, 6391, 6360, 25782-35018'),
]
parts.append(section('רשימה מסכמת', 'undocumented features work orders routines live games sc-auth', table(['יכולת', 'מה קיים', 'ראיה'], und)
                     + '<p>' + e('בנוסף: 190 מתוך 300 טבלאות ב-schema.json אינן מוזכרות בשמן באף מסמך md (למשל family_sessions, sa_sessions, storefront_sessions, beauty_appointments, sport_*, logistics_route_stops, routine_*). '
                                 '56 קידומות נתיבים אינן מוזכרות כלל, הגדולות: /api/work-orders (42), /api/live-games (20), /api/sc-auth (13), /api/restaurant (10), /api/routine-occurrences (9).') + '</p>'))

open(OUT, 'w').write('\n'.join(parts))
print('written', OUT, len('\n'.join(parts)))
