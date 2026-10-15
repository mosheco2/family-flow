import json
D = "אימות וזהות"
R = "rules-auth.html#"
items = []
def add(area, cat, sev, title, as_is, proposal, refs, alts=None):
    items.append({"id": "AUTH-%02d" % (len(items) + 1), "domain": D, "area": area, "category": cat,
                  "severity": sev, "title": title, "as_is": as_is, "proposal": proposal,
                  "alternatives": alts or [], "refs": refs})

add("סשנים", "security", "critical", "bootstrap-token מנפיק סשן מלא לכל משתמש לפי groupId+userId בלבד",
    "POST /api/community/bootstrap-token (server.js:10721-10737) יוצר סשן family ל-30 יום לכל משתמש active בקבוצת FAMILY בלי סיסמה, טוקן או OTP; ensureFamilyToken (app.js:832) קורא לו בכל fetchData כשחסר טוקן. המזהים רציפים ולכן ניתנים לניחוש.",
    "למחוק את ה-endpoint. טוקן סשן נוצר רק בזרימות כניסה/הרשמה מאומתות. לקוח בלי ofl_family_token תקף מנותק ומועבר למסך הכניסה (401 → logout). בדיקה: קריאה עם groupId+userId בלבד מחזירה 404/401.",
    ["server.js:10721", "app.js:832", "app.js:2235", R + "Bootstrap token", "s1-rbac.html#FAMILY — אימות והצטרפות", "s1-docsvscode.html#security-audit-report"],
    ["להשאיר endpoint לרענון בלבד שמחייב טוקן תקף קיים (refresh) ומחזיר טוקן חדש לאותו user_id"])

add("FAMILY — הפעלת SOLO", "security", "critical", "/api/solo/activate מאפשר לכל אחד לקבוע סיסמה לכל userId",
    "POST /api/solo/activate (server.js:2469-2486) ללא middleware: מעדכן password_hash של userId מה-body בלי לבדוק שהוא שייך ל-groupId או שהקבוצה ב-pending_activation, ומאשר אוטומטית את כל member_business_links של הקבוצה. GET /api/solo/status/:groupId (2489) גם ללא אימות.",
    "הפעלה מחייבת סשן (verifyFamily) שנוצר בכניסה עם הסיסמה הזמנית; userId ו-groupId נגזרים מהסשן; מותר רק אם family_groups.account_status='pending_activation' והמשתמש ADMIN של הקבוצה; אחרת 403. אישור קישורי עסק הוא פעולה נפרדת ומפורשת של המשתמש (approve/reject לכל קישור). solo/status מחייב verifyFamily ו-groupId של הסשן.",
    ["server.js:2469", "server.js:2489", "app.js:1908", R + "הפעלת חשבון SOLO (pending_activation)"],
    ["הפעלה דרך קישור חד-פעמי (טוקן 32 bytes, תוקף 72 שעות) שנשלח ב-SMS לטלפון של החשבון"])

add("ZONE-MANAGER", "security", "critical", "טוקן מנהל אזור ניתן לזיוף, ללא תפוגה ונשמר בזיכרון בלבד",
    "verifyZoneManager (server.js:6498-6525) מקבל כל מחרוזת בצורת ZM_<id>_x עבור מנהל אזור פעיל ויוצר לה סשן; סשן קיים ב-Map לא נבדק מול status; אין תפוגה ואין logout בשרת. הטוקן נוצר מ-Date.now+Math.random (18830).",
    "טבלת zm_sessions(token_hash CHAR(64) PK, manager_id FK, expires_at, created_at, last_seen) עם טוקן randomBytes(32) ותוקף 30 יום; כל בקשה בודקת hash + expires_at + zone_managers.status='active' (אחרת 401 ומחיקה). להסיר את ה-fallback לפי קידומת. POST /api/zone-manager/logout מוחק את השורה; שינוי status ע\"י SA מוחק את כל הסשנים של המנהל.",
    ["server.js:6495", "server.js:6498-6525", "server.js:18830", R + "Middleware ‏verifyZoneManager + סשנים בזיכרון", "s1-rbac.html#ZONE MANAGER"])

add("STOREFRONT", "security", "critical", "הרשמת לקוח חנות ללא הוכחת OTP — השתלטות על לקוח ושרשרת SSO",
    "POST /api/sc-auth/register (server.js:43297) מקבל כל phone בלי לוודא שה-OTP אומת; לקוח 'שקט' ללא PIN נלקח, והחשבון מקושר לקבוצה של בעל הטלפון האמיתי — ומשם SSO לאפליקציית המשפחה.",
    "verify-otp מוצלח עם isNew מחזיר registration_token (randomBytes 32, hash ב-storefront_otp, purpose='register', תוקף 15 דק', חד-פעמי, קשור לטלפון). register מחייב registration_token תואם לטלפון ומוחק אותו אטומית; אחרת 400 'יש לאמת את הטלפון מחדש'.",
    ["server.js:43255", "server.js:43297-43380", R + "הרשמת לקוח חנות (sc-auth/register)", "s1-rbac.html#STOREFRONT — לקוח קצה"])

add("STOREFRONT — SSO", "security", "high", "SSO מהחנות פותח סשן של מנהל המשפחה ולא של בעל הטלפון",
    "GET /api/family/sso-login (server.js:43791) בוחר משתמש active עם עדיפות ל-ADMIN ואז id נמוך, ללא קשר לטלפון של לקוח החנות.",
    "הסשן נוצר רק למשתמש בקבוצה שה-phone המנורמל שלו שווה לטלפון של storefront_customer; אם אין התאמה → 403 'לא נמצא משתמש משפחה תואם למספר זה' (ללא fallback ל-ADMIN). אם יש כמה התאמות — מוצגת בחירה ללקוח.",
    ["server.js:43791-43830", "sc-auth.js:960", "app.js:115", R + "SSO מהחנות לאפליקציית המשפחה"])

add("כניסה עם OTP", "security", "high", "שלב הסיסמה בכניסות OTP (משפחה ועסק) לא מחייב שה-OTP אומת",
    "POST /api/family/login/password (server.js:10558) ו-POST /api/biz/login (8172) מקבלים groupId/userId(או phone)+password בלבד; ה-OTP קיים רק בממשק. ב-biz/login אין גם rate limit ואין בדיקת is_deleted.",
    "verify-otp (family_login / login) מחזיר login_ticket (randomBytes 32, hash ב-business_otp purpose='login_ticket', תוקף 10 דק', קשור לטלפון ולרשימת ה-user_id שהוחזרו). שלב הסיסמה מחייב ticket תקף שכולל את המשתמש שנבחר, ומוחק אותו בהצלחה. כניסת עסק מקבלת אותו rate limit כמו /api/login ובודקת is_deleted=false.",
    ["server.js:10520-10610", "server.js:8172-8215", "biz-onboarding.html:1440-1497", R + "כניסת משפחה בטלפון: OTP → בחירת פרופיל → סיסמה", R + "כניסת עסק: OTP → בחירת סביבה → סיסמה (/api/biz/login)"])

add("כניסה", "security", "high", "password_hash מוחזר ללקוח ונשמר ב-localStorage",
    "/api/login ו-/api/family/login/password מחזירים user: SELECT * כולל password_hash (server.js:10709); family-onboarding.html:606 ו-game.html שומרים את האובייקט המלא ב-localStorage.",
    "כל תגובה שמחזירה משתמש עוברת sanitizeUser עם whitelist (id, group_id, nickname, first_name, last_name, role, status, phone, email, birth_year, permissions, employee_role_type, must_change_password, profile_image). password_hash, solo_temp_password ושדות סוד לעולם לא יוצאים מהשרת. בדיקה: אין מפתח password_hash באף תגובת API.",
    ["server.js:10709", "family-onboarding.html:606", "app.js:810", R + "כניסת משפחה/עסק בקוד סביבה + כינוי + סיסמה (/api/login)", "s1-docsvscode.html#security-audit-report"])

add("הצטרפות — invited", "security", "critical", "pre-invite ללא אימות + סיסמת placeholder צפויה + אישור invited",
    "POST /api/family/pre-invite (server.js:7757) ללא middleware — כל אחד מוסיף משתמשי invited לכל groupId עם hash של '__invited__'+groupId (7764). approve-user (11597) לא בודק status, כך שאישור invited יוצר חשבון active עם סיסמה ידועה.",
    "pre-invite מחייב verifyFamily ו-ADMIN של groupId שבסשן (הוויזארד כבר מחזיק token אחרי יצירה). משתמש invited נוצר עם password_hash=NULL ולא יכול להיכנס. approve-user מותר רק ל-status='pending' (invited → 400 'המשתמש טרם השלים הרשמה').",
    ["server.js:7757-7785", "server.js:11597-11606", "family-onboarding.html:993", R + "הצטרפות לקבוצה קיימת בקוד (/api/join) + פרופילי invited", R + "אישור משתמשים ממתינים (pending-users / approve-user)"])

add("סשנים", "security", "high", "שינוי/איפוס סיסמה לא מבטל סשנים קיימים",
    "destroyAllFamilySessions (server.js:41871) מוגדרת ולא נקראת. reset-password/confirm, /api/users/:id/password, set-first-password, solo/activate ו-PUT user-details לא נוגעים ב-family_sessions.",
    "כל שינוי סיסמה (עצמי, איפוס, ע\"י מנהל, ע\"י SA, הפעלת SOLO) מוחק את כל הסשנים של אותו user_id, פרט לסשן הנוכחי כשהמשתמש שינה בעצמו. להחליף את destroyAllFamilySessions(groupId) בפונקציה לפי user_id.",
    ["server.js:41871", "server.js:10305", "server.js:11689", "server.js:11709", R + "סשן משפחה/עסק — family_sessions (יצירה, מבנה, ביטול)"])

add("Middlewares", "security", "high", "middlewares לא בודקים סטטוס משתמש/קבוצה אחרי יצירת הסשן",
    "verifyFamily, verifyBiz ו-verifyFamilyOrBiz (server.js:41876, 41914, 43089) בודקים רק קיום ותפוגת טוקן. משתמש שנמחק-רך/הושהה או קבוצה frozen/archived/is_deleted ממשיכים לעבוד עד 30 יום. גם /api/login לא בודק is_deleted.",
    "כל middleware מצטרף ל-users ו-family_groups: users.status='active', family_groups.account_status NOT IN ('frozen','archived') ו-is_deleted IS NOT TRUE; אחרת 401 'החשבון אינו פעיל' ומחיקת הסשן. /api/login ו-biz/login מחזירים 401 גנרי לקבוצה is_deleted.",
    ["server.js:41876-41910", "server.js:41914-41948", "server.js:43089-43115", R + "Middleware ‏verifyFamily — אלגוריתם מדויק", R + "Middleware ‏verifyBiz ונגזרותיו (Admin-only, Beauty)"])

add("Middlewares", "security", "medium", "verifyFamily מקבל טוקן מסוג biz",
    "verifyFamily (server.js:41876) לא בודק session_type, כך שטוקן עסקי עובר כל endpoint משפחתי (160 נתיבים).",
    "verifyFamily מחייב session_type='family' (אחרת 403 'גישה מורשית לסביבת משפחה בלבד'). endpoints שמשרתים את שתי הסביבות עוברים ל-verifyFamilyOrBiz במפורש.",
    ["server.js:41876", "s1-rbac.html#Middlewares אימות — סיכום", R + "Middleware ‏verifyFamily — אלגוריתם מדויק"],
    ["middleware אחד authenticate({types:['family','biz']}) עם רשימת סוגים מותרת לכל נתיב"])

add("Middlewares", "security", "critical", "verifyBizOrLegacy: בלי טוקן groupId נלקח מהלקוח ללא אימות",
    "verifyBizOrLegacy (server.js:43056-43086) — אם אין טוקן, req.bizAuth.groupId=req.body/query.groupId עם console.warn בלבד; requireModule מדלג כש-fromToken=false. 101 נתיבים (store/logistics/menu) חשופים לכל group.",
    "להסיר את ה-fallback: בלי טוקן → 401 'נדרש token להתחברות עסקית'. verifyBizOrLegacy הופך לכינוי של verifyBiz (כולל role). לפני ההסרה — לוודא שכל קריאות הלקוח שולחות Bearer (לוג של console.warn כמדד).",
    ["server.js:43056-43086", "server.js:43126", "s1-rbac.html#BIZ — חנות/מכירות/קופה", R + "Middleware ‏verifyBizOrLegacy + requireModule (גידור מודולים)"])

add("גידור מודולים", "security", "medium", "requireModule fail-open ומערך ריק = גישה לכל המודולים",
    "requireModule (server.js:43126-43148): בשגיאה → next; managed_modules ריק/null → הכל מותר ('עסק ותיק'); cache 60 שניות שלא מתאפס באישור SA (5971).",
    "בשגיאה → 503 (fail-closed). קבוצה בלי managed_modules מקבלת רשימת מודולים מפורשת במיגרציה (נגזרת מ-billing_config), ולאחריה ריק = אין מודולים בתשלום. כל עדכון מודולים ע\"י SA מנקה את ה-cache של הקבוצה.",
    ["server.js:43120-43150", "server.js:5971", "s1-rbac.html#4. שערי מודולים וחיוב"],
    ["להשאיר 'ריק = הכל פתוח' לעסקים שנוצרו לפני תאריך מוגדר בלבד (grandfathering לפי created_at)"])

add("SUPER-ADMIN", "security", "critical", "אין RBAC בשרת לצוות SA; ההרשאות נשמרות ב-localStorage",
    "verifySA (server.js:6661) בודק רק קיום טוקן ב-sa_sessions (ללא user_id). sa_teams.permissions נאכפות רק בלקוח (sa-app.js:91-142) מתוך ofl_sa_user שניתן לעריכה; כל טוקן צוות = Master ב-353 נתיבים, כולל impersonation.",
    "להוסיף sa_sessions.sa_user_id (NULL=Master). verifySA טוען את המשתמש וההרשאות מה-DB ומצמיד req.saUser. middleware requireSAPerm(perm) לכל קבוצת נתיבים לפי אותה מפה של checkTabAccess (support, devops, marketing, stats, biz, comm, users, content, all); impersonation מחייב 'support' או 'all'. חבר צוות בלי הרשאה → 403.",
    ["server.js:6661-6680", "server.js:568-572", "sa-app.js:91-142", "server.js:44011", R + "Middleware ‏verifySA + טבלת sa_sessions", "s1-rbac.html#SUPER-ADMIN — SA_GROUPS × הרשאת צוות"])

add("SUPER-ADMIN", "security", "critical", "סיסמת Master בטקסט גלוי עם ברירת מחדל admin/123456",
    "כניסת Master משווה ל-system_settings.sa_password בטקסט גלוי, ברירת מחדל 'admin'/'123456' (server.js:8597-8598). /api/superadmin/credentials (8621) שומר plaintext; PUT /api/settings/tour משווה Authorization ל-sa_password (8947).",
    "sa_password נשמר כ-bcrypt(12) בלבד. אין ברירת מחדל: אם לא הוגדרה סיסמה, כניסת Master נחסמת עד הגדרה מ-env SA_INITIAL_PASSWORD בעלייה הראשונה. כל בדיקת SA עוברת דרך verifySA, לא השוואת סיסמה בהדר.",
    ["server.js:8558-8620", "server.js:8621", "server.js:8947-8949", "s1-seed.html#sa_password", R + "כניסת SA בשם משתמש/מייל + סיסמה"])

add("SUPER-ADMIN", "security", "high", "טוקני SA גולמיים, ללא logout וללא ביטול בחסימת עובד",
    "sa_sessions שומר טוקן גולמי (568); logoutSA (sa-app.js:418) לא קורא לשרת; אין ניקוי בקרון; חסימת עובד (PUT /api/sa/staff/:id status) לא מבטלת סשנים כי אין קישור טוקן↔משתמש; status הוא טקסט חופשי.",
    "לשמור sha256 של הטוקן; POST /api/sa/logout מוחק את השורה; שינוי status של sa_users ל-ערך שאינו 'active' (enum: active, blocked) מוחק את כל הסשנים שלו; הקרון היומי מוחק sa_sessions פגים. תוקף 30 יום ללא שינוי.",
    ["server.js:568-572", "sa-app.js:418", "server.js:8722", R + "ניהול צוות SA (RBAC)", R + "Middleware ‏verifySA + טבלת sa_sessions"])

add("הגבלת ניסיונות", "security", "high", "אין rate limit בכניסות SA, ZM, עסק ובאימות OTP של SA",
    "רק /api/login ו-/api/family/login/password מוגבלים. /api/superadmin/login, /api/zone-manager/login, /api/biz/login ללא הגבלה; verify של SA OTP (8523) ללא מגבלת ניסיונות; smsEnabled=false מסתיר רק ב-UI.",
    "מגביל אחיד לכל endpoint של סיסמה/OTP: לפי ip ולפי מזהה (code/phone/email): 3 כישלונות → 30 שניות, 5 → 5 דק', 10 → 30 דק' (כמו היום ב-/api/login). כל אימות OTP: מקסימום 3 ניסיונות לקוד. כש-sms_login_enabled=false, endpoints של SA OTP מחזירים 403.",
    ["server.js:10439-10482", "server.js:8496-8555", "server.js:8558", "server.js:18816", "server.js:8172", R + "כניסת SA Master ב-SMS (SUPERADMIN_PHONE)"])

add("הגבלת ניסיונות", "security", "medium", "Rate limit בזיכרון ו-IP מ-x-forwarded-for ניתן לזיוף",
    "_loginRateMap בזיכרון (server.js:10439-10482) מתאפס בריסטארט ולא משותף בין instances; ה-IP נלקח מהערך הראשון של x-forwarded-for (10626) שהלקוח שולט בו.",
    "מונה ניסיונות בטבלה login_attempts(key, attempts, locked_until, updated_at) או Redis. IP נלקח מ-req.ip עם app.set('trust proxy', 1) (הערך האחרון שהוסיף ה-proxy של Render).",
    ["server.js:10439-10482", "server.js:10626", R + "כניסת משפחה/עסק בקוד סביבה + כינוי + סיסמה (/api/login)"])

add("התנתקות", "security", "medium", "התנתקות ב-BIZ/SA/ZM לא מבטלת את הטוקן בשרת",
    "business-app.js:2390 ו-common.js:364 מוחקים ofl_session בלבד (לא ofl_family_token, בלי קריאת שרת); logoutSA (sa-app.js:418) ו-zmLogout (zone-manager-app.js:118) לא קוראים לשרת. הטוקנים נשארים תקפים 30 יום / ללא תפוגה.",
    "כל logout קורא ל-endpoint שרת שמוחק את הסשן (/api/logout ל-family/biz, /api/sa/logout, /api/zone-manager/logout) ומנקה את כל מפתחות האחסון של אותה סביבה. השרת מחזיר success גם אם הטוקן כבר לא קיים.",
    ["business-app.js:2390", "common.js:364", "sa-app.js:418", "zone-manager-app.js:118", "server.js:10740", R + "התנתקות (כל הסביבות)"])

add("סשנים", "security", "medium", "מדיניות תוקף סשן: קבוע 30 יום מול מסמכים שמבטיחים 30 דק' חוסר פעילות",
    "createFamilySession (server.js:41856) קובע expires_at=now+30d קבוע; last_seen מתעדכן אך לא מאריך. סשן חנות מתגלגל 30 יום (43202). SPECIFICATION QA דורש פקיעה אחרי 30 דק' חוסר פעילות.",
    "סשן FAMILY/BIZ מתגלגל: expires_at מוארך ל-now+30d לכל היותר פעם ביום בבקשה מאומתת, עם תקרה מוחלטת של 90 יום מ-created_at. Impersonation נשאר שעה קבועה. SA: 12 שעות מתגלגל.",
    ["server.js:41853-41862", "server.js:43202-43205", "s1-docsvscode.html#Session פג אחרי 30 דק' חוסר פעילות"],
    ["להשאיר 30 יום קבוע כמו היום ולעדכן את המסמך", "30 דק' חוסר פעילות כמו במסמך ה-QA (לא מתאים לאפליקציית משפחה במובייל)"])

add("Impersonation", "data-integrity", "medium", "השתלטות SA: user_id=0 בקבוצה ריקה, ללא יומן ודריסת סשן משותף",
    "POST /api/sa/biz-impersonate-token (server.js:44011-44040) מכניס user_id=0 כשאין משתמשים → הפרת FK → 500; בלקוח user מזויף 99999. ofl_session משותף לכל הטאבים ולכן דורס את סשן ה-SA/לקוח. ofl_sa_return_token נכתב ולא נקרא.",
    "אם אין ADMIN בקבוצה → 400 'אין משתמש מנהל בסביבה'. כל impersonation נרשם ב-sa_audit_log (sa_user_id, group_id, user_id, זמן). הסשן המתחזה נשמר ב-sessionStorage של הטאב החדש בלבד ולא נוגע ב-ofl_session/ofl_sa_token. להסיר את ofl_sa_return_token.",
    ["server.js:44011-44040", "sa-app.js:5891", "business-app.js:165", "business-app.js:305-322", R + "השתלטות SA על סביבת לקוח (Impersonation)"])

add("FAMILY — הרשמה", "security", "high", "אימות טלפון בהקמת משפחה אופציונלי בשרת",
    "POST /api/groups (server.js:10071-10085) בודק verified_token רק אם נשלח; handleCreate ב-app.js:748 יוצר משפחה בלי OTP כלל.",
    "ל-type='FAMILY' נדרש verified_token תקף התואם ל-phone שנשלח (אחרת 400 'אימות טלפון נדרש'). מסלול handleCreate הישן מוסר והכפתור מפנה לוויזארד family-onboarding.html.",
    ["server.js:10064-10085", "app.js:748-776", "family-onboarding.html:829-945", R + "הרשמת משפחה עם אימות טלפון (ויזארד) — אספקט האימות"])

add("היגיינת סיסמאות", "security", "high", "סיסמאות בטקסט גלוי: מייל ברוכים הבאים, סיסמה זמנית והשוואת plaintext",
    "מייל ההרשמה כולל את הסיסמה (server.js:10204); create-for-business שומר סיסמה זמנית plaintext ב-password_hash (30976-30981); /api/login, /family/login/password, SA ו-ZM תומכים בהשוואת plaintext ושדרוג. bcrypt cost לא אחיד (10/12).",
    "לעולם לא לשלוח סיסמה במייל/SMS — רק קוד סביבה, כינוי וקישור כניסה. מיגרציה חד-פעמית שמגבבת כל password_hash שלא מתחיל ב-$2 ולאחריה מסירים את ענף ה-plaintext מכל זרימות הכניסה. bcrypt cost אחיד 12.",
    ["server.js:10204", "server.js:30976-30981", "server.js:10673-10682", "server.js:18816-18829", R + "הגדרת סיסמה ראשונה (must_change_password)"])

add("מדיניות סיסמה", "security", "medium", "אורך סיסמה מינימלי לא אחיד (0/4/6) בין endpoints",
    "join ללא בדיקה (10362); 4 תווים ב-users/:id/password, set-first-password, solo/activate, user-details ובוויזארד; 6 ב-reset-password, biz/register, ZM.",
    "ולידטור שרת משותף: מינימום 6 תווים לכל משתמש שאינו CHILD, ו-4 תווים ל-CHILD; מקסימום 72 (מגבלת bcrypt). אותו כלל בלקוח ובכל endpoint שקובע סיסמה, כולל /api/join.",
    ["server.js:10362", "server.js:11689", "server.js:11709", "server.js:2469", "server.js:10305", "server.js:8096"],
    ["מינימום 8 תווים לכולם"])

add("FAMILY — שחזור", "functional", "medium", "איפוס סיסמת מנהל משנה את כל ה-ADMINs ומטפל רק בקבוצה הראשונה",
    "/api/forgot-code (server.js:10247) לוקח את השורה הראשונה בלבד; /api/reset-password/confirm (10323-10326) מעדכן password_hash לכל role='ADMIN' בקבוצה.",
    "family_password_resets שומר user_id. forgot-code שולח מייל אחד עם כל הסביבות שבהן המייל הוא admin_email, וקישור איפוס נפרד לכל משתמש ADMIN שהמייל שלו תואם (או ל-owner_user_id). confirm מעדכן רק את ה-user_id של הטוקן.",
    ["server.js:10247-10300", "server.js:10305-10330", R + "שחזור קוד סביבה + איפוס סיסמת מנהל משפחה"])

add("BIZ — שחזור", "functional", "medium", "איפוס סיסמת עסק נכשל בשקט לטלפון עם מקפים",
    "request (server.js:8220) משווה טלפון מנורמל, confirm (8265) מעדכן WHERE phone=$2 מדויק → 0 שורות ו-success. הלקוח מציג 'נשלח' גם בכישלון (biz-onboarding.html:1500).",
    "biz_password_resets שומר user_id; confirm מעדכן לפי user_id ומחזיר 400 אם לא עודכנה שורה. הלקוח מציג את תשובת השרת.",
    ["server.js:8220-8290", "biz-onboarding.html:1500", R + "איפוס סיסמת עסק (קישור במייל)"])

add("אחסון טוקנים", "functional", "high", "כניסה לעסק מ-index/family-onboarding משאירה את business.html בלי טוקן",
    "כניסה דרך /api/login שומרת רק ofl_family_token, וב-business-app.js:330 window._bizToken=session.token → null; /api/family/login/password יוצר session_type='family' גם ל-BUSINESS (10605) → verifyBiz מחזיר 403.",
    "מפתח אחסון יחיד לטוקן FAMILY/BIZ (ofl_token) שנכתב בכל זרימת כניסה; session_type נקבע תמיד לפי family_groups.type בפונקציית createSession אחת (BUSINESS→biz, אחרת family) ולא לפי ה-endpoint.",
    ["business-app.js:330", "server.js:10605", "server.js:10706", "app.js:156", R + "מפת מפתחות localStorage ודרך צירוף הטוקן לכל לקוח"])

add("אחסון טוקנים", "functional", "high", "קריאות לקוח ללא Authorization — שינוי סיסמה ושיוך תפקיד עובד שבורים",
    "submitChangePassword (app.js:6089) שולח fetch בלי Bearer → 401 תמיד; PATCH role-type בוויזארד (business-app.js:23023) בלי טוקן; app.js:10042-11486, 8851, 16016 קוראים מפתחות ofl_token/token/family_token שלעולם לא נכתבים.",
    "כל קריאה מאומתת עוברת דרך wrapper יחיד (apiFetch) שמוסיף Authorization: Bearer מהמפתח היחיד, ובתגובת 401 מנתק ומעביר לכניסה. להסיר את קריאות המפתחות המתים. בדיקה: שינוי סיסמה מהפרופיל מצליח.",
    ["app.js:6089", "business-app.js:23023", "app.js:10042", "app.js:846", R + "שינוי סיסמה עצמי ועריכת סיסמה ע\"י מנהל", R + "סיווג תפקיד עובד (employee_role_type)"])

add("תפקידים", "data-integrity", "medium", "אין הגנה מפני הורדת המנהל האחרון",
    "/api/admin/change-role (11609), PUT /api/admin/user-details (11668) ו-PUT /api/users/:id/permissions (11573, עם role) מאפשרים להוריד את ה-ADMIN הפעיל האחרון; ההגנה קיימת רק במחיקה (11646-11651).",
    "כל פעולה שמשנה role של ADMIN פעיל, מוחקת אותו או משנה את הסטטוס שלו נחסמת אם הוא ה-ADMIN הפעיל היחיד בקבוצה: 400 'חייב להישאר לפחות מנהל/ת אחד/ת'.",
    ["server.js:11609-11625", "server.js:11668", "server.js:11573", "server.js:11646-11651", R + "תפקידים ושינוי תפקיד (users.role)"])

add("תפקידים", "data-integrity", "medium", "ערכי role ו-employee_role_type ללא whitelist ולא תואמים בין שרת ללקוח",
    "PUT /api/users/:id/permissions שומר role חופשי (11573); change-role מכיר רק ADMIN/CHILD/MEMBER בעוד שהלקוחות משתמשים גם ב-MANAGER/SENIOR; PATCH role-type (26446) שומר כל מחרוזת ולא בודק רישוי.",
    "enum לפי סביבה: FAMILY = {ADMIN, MEMBER, CHILD}; BIZ = {ADMIN, MANAGER, SENIOR, MEMBER}. employee_role_type חייב להיות מתוך EMPLOYEE_ROLE_TYPES ומורשה לפי licensed_features של הקבוצה; אחרת 400. אותה רשימה מוגשת ללקוחות מהשרת.",
    ["server.js:11573", "server.js:11612", "server.js:26446-26463", "app.js:9478", "business-app.js:3893", "s1-rbac.html#1. שחקנים ותפקידים — זיהוי ומקור"])

add("הרשאות טאבים", "functional", "medium", "change-role דורס הרשאות עם רשימות שלא תואמות ל-ALL_TABS",
    "change-role (11617-11621) כותב permissions עם goals/loans (לא קיימים ב-ALL_TABS) ובלי forecast/recipes/home-maintenance/myorders; MEMBER מקבל 2 טאבים ולכן נחשב 'מותאם' (>1) ומאבד tasks/shop/academy. ברירת המחדל {\"tabs\":[\"feed\"]} מונעת הרשאה מותאמת של feed בלבד.",
    "permissions=NULL פירושו 'ברירת מחדל לתפקיד'. change-role מאפס ל-NULL. הרשאה מותאמת נשמרת כ-{custom:true, tabs:[...]} ותקפה בכל אורך. ROLE_DEFAULTS מוגדר פעם אחת בשרת ומוגש ללקוח.",
    ["server.js:11617-11621", "app.js:9478-9500", "server.js:6467", R + "הרשאות טאבים — users.permissions (JSON)", "s1-rbac.html#FAMILY — ALL_TABS × users.role"])

add("הרשאות טאבים", "security", "high", "הרשאות טאבים והרשאות קהילה נאכפות בלקוח בלבד",
    "אין אף הפניה ב-server.js ל-permissions.tabs או ל-can_order/can_post_feed/can_poll/can_live_game/can_store; MEMBER/CHILD יכולים לשנות מזווה, תקציב-צפייה וכו' ישירות ב-API. PUT permissions בלי tabs זורק TypeError → 500.",
    "middleware requireTab(tab) מחשב טאבים אפקטיביים (permissions או ROLE_DEFAULTS; ADMIN=הכל) וממופה לקידומות API (pantry→/api/pantry, budget→/api/budget …); טאב לא מורשה → 403. can_* נבדקים ב-endpoints הקהילה המתאימים (ברירת מחדל מותר). PUT permissions בלי מערך tabs → 400.",
    ["server.js:11555-11582", "app.js:9486-9590", "app.js:10262", "s1-rbac.html#FAMILY — הרשאות טאבים/קהילה (permissions JSON)", "s1-rbac.html#FAMILY — קניות, מזווה, מתכונים"])

add("הצטרפות", "data-integrity", "medium", "כינוי לא ייחודי בקבוצה חוסם כניסה בקוד+כינוי",
    "/api/join (10359-10434) לא בודק כפילות nickname; /api/login (10659-10662) לוקח את השורה הראשונה לפי group_id+nickname (case-sensitive), כך שהמשתמש השני לא יכול להיכנס.",
    "nickname ייחודי בקבוצה ללא תלות ברישיות (אינדקס UNIQUE על group_id, LOWER(nickname)); join/user-details/pre-invite עם כינוי קיים → 409 'הכינוי כבר תפוס בסביבה'. login מחפש LOWER(nickname).",
    ["server.js:10359-10434", "server.js:10659-10662", R + "הצטרפות לקבוצה קיימת בקוד (/api/join) + פרופילי invited"])

add("נרמול טלפון", "data-integrity", "medium", "טלפונים נשמרים ומושווים בלי נרמול אחיד",
    "כניסת משפחה ב-OTP משווה phone מדויק (10542); התאמת invited ב-join לפי טלפון גולמי; biz/login ו-biz reset request מנרמלים ב-SQL אבל confirm לא; storefront מנרמל לספרות.",
    "פונקציית normalizePhone אחת (ספרות בלבד, קידומת 972 → 0, תוצאה 05XXXXXXXX) מופעלת בכל שמירה ובכל השוואה; מיגרציה מנרמלת את users.phone הקיימים; אינדקס על הטלפון המנורמל.",
    ["server.js:10542-10549", "server.js:10391-10397", "server.js:8175", "server.js:8265", "server.js:43210", R + "כניסת משפחה בטלפון: OTP → בחירת פרופיל → סיסמה"])

add("הצטרפות", "ux", "low", "כפתור 'הורה' בטופס ההצטרפות מוריד בשקט ל-MEMBER",
    "setJoinRole('ADMIN') (app.js:792) שולח role=ADMIN והשרת ממיר ל-MEMBER (10370); גם pre-invite ממפה 'הורה'→MEMBER (7770). המשתמש לא יודע שלא קיבל הרשאות הורה.",
    "השרת שומר requested_role='ADMIN' כשנבחר 'הורה'; במסך 'ממתינים לאישור' המנהל רואה 'ביקש/ה הרשאת הורה' ובוחר תפקיד באישור (approve-user מקבל role ∈ {ADMIN, MEMBER, CHILD}, ברירת מחדל requested_role). ADMIN לעולם לא מוענק בלי אישור מנהל קיים.",
    ["app.js:792", "server.js:10370", "server.js:7770", R + "הצטרפות לקבוצה קיימת בקוד (/api/join) + פרופילי invited"])

add("אישור ממתינים", "functional", "medium", "אין דחייה מפורשת ואין התראה למאושר",
    "approve-user (11597) רק משנה ל-active בלי טרנזקציה ובלי בדיקת מצב קודם; דחייה = מחיקת משתמש; המאושר לא מקבל הודעה.",
    "POST /api/admin/approve-user מותר רק מ-pending; POST /api/admin/reject-user (ADMIN, אותה קבוצה, רק pending) מוחק את הבקשה. אחרי אישור נשלח SMS/מייל 'בקשתך אושרה — ניתן להתחבר' לטלפון/מייל שהוזן.",
    ["server.js:11584-11606", "app.js:5908-5919", R + "אישור משתמשים ממתינים (pending-users / approve-user)"])

add("חשבון שנוצר ע\"י עסק", "security", "high", "create-for-business ללא אימות וסיסמה זמנית לא נשמרת",
    "POST /api/member/create-for-business (server.js:30950) ללא middleware — כל אחד יוצר קבוצות/משתמשים בשם כל עסק. solo_temp_password נשמר NULL כי rawPassword מוגרל אחרי ה-INSERT (30975-30981), ולכן העסק לא יכול למסור את הסיסמה.",
    "מחייב verifyBiz ו-business_group_id = קבוצת הסשן. הסיסמה הזמנית (randomBytes, 10 תווים) מוגרלת לפני ה-INSERT, נשמרת רק כ-bcrypt, ונשלחת ללקוח ב-SMS עם קישור כניסה; solo_temp_password מוסר מהסכמה.",
    ["server.js:30950-31010", "server.js:30975-30981", R + "הגדרת סיסמה ראשונה (must_change_password)", "s1-rbac.html#רישוי, סוג עסק וחשבונות חבר"])

add("STOREFRONT — PIN", "security", "medium", "PIN לקוח: נעילה לא מתאפסת, בזיכרון, ו-forgot/reset ללא מגבלות",
    "_scPinLockout בזיכרון; אחרי 5 כישלונות ו-15 דק' המונה לא מתאפס (כל כישלון נועל שוב); forgot-pin (43442) ללא rate limit (הצפת SMS); reset-pin (43462) ללא מגבלת ניסיונות; handlers ללא try/catch.",
    "מונה PIN בטבלה (customer_id, attempts, locked_until): 5 כישלונות → נעילה 15 דק' ואיפוס המונה בסיומה. forgot-pin: עד 3 קודים ל-10 דק' לטלפון. reset-pin: עד 5 ניסיונות לקוד ואז הקוד מבוטל. כל handler עטוף ב-try/catch שמחזיר 500.",
    ["server.js:43393-43480", "server.js:43210-43260", R + "PIN לקוח: אימות פעולה, שינוי, שכחתי, איפוס SA", R + "OTP לקוח חנות (sc-auth send/verify)"])

add("OTP", "security", "low", "OTP: sha256 בלי salt, כישלון SMS נספר, purpose מת וקוד SMS מת",
    "כל קודי business_otp נשמרים כ-sha256 ללא salt (6 ספרות — ניתן לפיצוח מיידי מהטבלה); כישלון שליחת SMS אחרי INSERT נספר ל-rate limit; purpose reset_password ללא המשך; smsService (56-85) לא בשימוש.",
    "hash של OTP = HMAC-SHA256 עם סוד שרת (OTP_SECRET). אם השליחה נכשלה — מחיקת השורה והחזרת 502 'שליחת הקוד נכשלה'. להסיר את purpose reset_password ואת smsService.",
    ["server.js:1973-1985", "server.js:7596-7660", "server.js:56-85", "server.js:237", R + "OTP עסקי (send/verify) ותשתית SMS"])

add("ניקוי נתונים זמניים", "data-integrity", "low", "הקרון היומי לא מנקה חלק מטבלאות הטוקנים ותלוי בזמן עליית השרת",
    "setInterval 24ש' מרגע העלייה (server.js:43835) מנקה רק family_sessions/storefront_*; sa_sessions, business_otp, biz_password_resets, family_password_resets לא מנוקים; Maps בזיכרון (otpCache, zmPasswordResets, zoneManagerSessions) נעלמים בריסטארט.",
    "משימת ניקוי בשעה קבועה (03:00 Asia/Jerusalem, עם נעילה ב-DB) שמוחקת רשומות פגות מכל טבלאות הטוקנים/OTP/איפוס. כל מצב אימות שנשמר היום ב-Map עובר לטבלאות DB.",
    ["server.js:43835-43845", "server.js:10477-10482", "server.js:235", R + "ניקוי סשנים ונתונים זמניים (קרונים בזיכרון)"])

add("ZONE-MANAGER", "security", "medium", "איפוס סיסמת מנהל אזור: טוקן בזיכרון, Math.random ו-host injection",
    "forgot (server.js:18777) יוצר ZMR_{id}_{ts}_{Math.random} ב-Map zmPasswordResets (אובד בריסטארט); הקישור נבנה מ-x-forwarded-proto+host שהלקוח שולט בהם.",
    "טבלת zm_password_resets(manager_id, token_hash, expires_at 1h, used). טוקן randomBytes(32). הקישור נבנה מ-BASE_URL מוגדר בלבד. אין רמזים ב-response אם המייל קיים.",
    ["server.js:18777-18815", R + "שחזור סיסמת מנהל אזור"])

add("SUPER-ADMIN", "security", "low", "בדיקות SA inline לא אחידות ו-req.saUser לא קיים",
    "בדיקות inline ב-41090, 41424, 41453 משתמשות ב-Authorization גולמי ומחפשות zone_manager_sessions (טבלה שלא קיימת) — רק SA עובר; קוד שמשתמש ב-req.saUser?.name (19237) תמיד מקבל 'SA'.",
    "להסיר בדיקות inline: נתיבי מודרציה משתמשים ב-verifySA או verifyZoneManager כ-middleware (או middleware משולב saOrZm). req.saUser מוצמד ע\"י verifySA (ראו RBAC של SA) ומשמש ליומני ביקורת.",
    ["server.js:41090", "server.js:41424", "server.js:41453", "server.js:19237", R + "Middleware ‏verifySA + טבלת sa_sessions"])

add("אחסון טוקנים", "architecture", "medium", "כל הטוקנים ב-localStorage חשופים ל-XSS",
    "אין cookies; ofl_family_token, ofl_sa_token, zm_token, sc_auth_token נשמרים ב-localStorage ונשלחים בהדר Authorization; קיימות הזרקות HTML ללא escape באפליקציה.",
    "טוקני FAMILY/BIZ/SA/ZM עוברים ל-cookie HttpOnly; Secure; SameSite=Lax עם הגנת CSRF (double-submit token) לבקשות כתיבה. Authorization header נתמך בתקופת מעבר.",
    ["app.js:810", "app.js:846", "sa-app.js:382", "zone-manager-app.js:38", R + "מפת מפתחות localStorage ודרך צירוף הטוקן לכל לקוח"],
    ["להשאיר localStorage ולהוסיף Content-Security-Policy קשיח (ללא inline script) ו-escape לכל פלט"])

add("תגובות שרת", "security", "low", "הודעות הרשמה ושחזור חושפות קיום חשבון",
    "ZM register מבחין בין 'ממתין'/'פעיל'/'רשום' (18763); biz/register מחזיר 'מספר טלפון זה כבר רשום' (8119); forgot-pin מחזיר 'מספר לא רשום' (43442). לעומת זאת forgot-code ו-biz reset שקטים.",
    "בזרימות שחזור (forgot-*) תמיד תגובה זהה 'אם החשבון קיים — נשלחה הודעה'. בזרימות הרשמה מותר לציין שהחשבון קיים (UX), בכפוף ל-rate limit לכל IP.",
    ["server.js:18763", "server.js:8119", "server.js:43442", "server.js:10247"])

add("קודי סביבה", "data-integrity", "low", "קודי קבוצה נוצרים בלי טיפול בהתנגשות",
    "generateGroupCode (server.js:4141) — 6 תווים אקראיים ונשען על UNIQUE בלי ניסיון חוזר (שגיאה ממופה ל'המייל כבר רשום', 10216); קוד 'SC'+6 ספרות אחרונות של טלפון בהרשמת לקוח חנות ו-'MB'/'M'+6 ספרות timestamp באיחוד/עסק עלולים להתנגש.",
    "כל יצירת group_code משתמשת בפונקציה אחת: 6 תווים A-Z0-9 בלי תווים מבלבלים (0/O/1/I), ניסיון חוזר עד 5 פעמים על unique violation, ואז 500. שגיאת UNIQUE ממופה להודעה לפי שם האילוץ.",
    ["server.js:4141", "server.js:10216", "server.js:43297", "server.js:2555", "server.js:30950"])

add("תיעוד", "docs", "low", "מסמכי מפרט מתארים מנגנון אימות שלא קיים",
    "SYSTEM_SPEC/FAMILY_ENV_SPEC/BIZ_ENV_SPEC מתארים JWT, /api/auth/send-otp|verify-otp|login, כניסה במייל+סיסמה ו-SSO לעסק; security-audit-report-2026-10 קובע שלא נותרה פרצת IDOR/אימות קריטית ב-FAMILY; הערה 'לא מחובר לאף endpoint' ב-verifyBiz (41913) מיושנת.",
    "אחרי אישור פריטי AUTH — מסמך אימות יחיד (טבלאות סשן, middlewares, זרימות כניסה, מדיניות סיסמה/OTP/rate limit) מחליף את הסעיפים במסמכים הקיימים; דוח האבטחה מסומן כמיושן; הערות קוד מיושנות מוסרות.",
    ["s1-docsvscode.html#SYSTEM_SPEC.md", "s1-docsvscode.html#docs/FAMILY_ENV_SPEC.md", "s1-docsvscode.html#docs/security-audit-report-2026-10.md", "server.js:41913"])

json.dump(items, open("/tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/spec/dec-auth.json", "w"), ensure_ascii=False, indent=1)
print(len(items))
