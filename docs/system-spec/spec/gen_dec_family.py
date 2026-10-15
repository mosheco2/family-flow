import json
D = "סביבת משפחה"
R = "rules-family.html#"
items = []
def add(area, cat, sev, title, as_is, proposal, refs, alts=None):
    items.append({"id": "FAM-%02d" % (len(items) + 1), "domain": D, "area": area, "category": cat,
                  "severity": sev, "title": title, "as_is": as_is, "proposal": proposal,
                  "alternatives": alts or [], "refs": refs})

# ---- הקמה ----
add("הקמת סביבה", "data-integrity", "high", "יצירת קבוצה: return בלי ROLLBACK ו-TypeError כשאין טלפון",
    "ב-POST /api/groups ההחזרות 400 על lastName/city מתבצעות אחרי BEGIN בלי ROLLBACK (server.js:10125-10126) — ה-client חוזר ל-pool עם טרנזקציה פתוחה; phone.replace מחושב לפני בדיקת null (10144-10147) → 500 לכל מי שלא הזין טלפון (למשל מתחת לגיל 10).",
    "כל הולידציות (שדות חובה, טלפון מגיל 10, ייחודיות טלפון, מגבלת 2 סביבות למייל) רצות לפני BEGIN; כל יציאה אחרי BEGIN עוברת ב-finally עם ROLLBACK ו-release. טלפון ריק מותר מתחת לגיל 10 ולא מפעיל בדיקת ייחודיות. בדיקה: יצירה בלי טלפון לגיל 8 מצליחה.",
    ["server.js:10064-10220", "server.js:10125-10126", "server.js:10144", R + "יצירת קבוצה משפחתית (הקמת סביבה)"])

add("הקמת סביבה", "functional", "medium", "בחירות 'מה לנהל' בוויזארד לא נשמרות",
    "מסך 4 בוויזארד (family-onboarding.html:1023-1101) מציג בחירת מודולים, אך הבחירה לא נשלחת לשרת; מסך 5 (הזמנות WhatsApp) הוא UI בלבד.",
    "הבחירות נשמרות ב-family_groups.features (מפתחות FAMILY הקיימים: store, finance, budget, forecast, tasks, academy, inventory, foodcost, community, cashflow, crm, members) דרך PUT מאומת (verifyFamily, ADMIN); מה שלא נבחר מוסתר (לא נעול) וניתן להפעלה מחדש בהגדרות.",
    ["family-onboarding.html:1023-1101", "app.js:9505-9575", R + "יצירת קבוצה משפחתית (הקמת סביבה)"],
    ["להסיר את מסך 4 מהוויזארד"])

add("הקמת סביבה", "data-integrity", "low", "הפניה (referral) ללא בדיקת הפניה עצמית או כפולה",
    "referralGroupCode מאתר משפחה פעילה ומזכה אותה ב-FLW (awardFlow referral_join, 10184-10186) בלי לבדוק שהמפנה אינו אותו admin_email/טלפון של הנרשם.",
    "זיכוי referral_join ניתן רק אם admin_email והטלפון של הנרשם שונים מאלה של קבוצת המפנה, ולכל היותר פעם אחת לכל טלפון נרשם; אחרת הקבוצה נוצרת בלי זיכוי (registration_source='self').",
    ["server.js:10112-10120", "server.js:10184-10186", R + "יצירת קבוצה משפחתית (הקמת סביבה)"])

# ---- קישורים / SOLO ----
add("איחוד משפחות", "functional", "high", "זרימת איחוד חשבונות SOLO שבורה מקצה לקצה",
    "הלקוח קורא ל-search-by-phone/link-request/respond בלי Authorization (verifyFamily → 401); שולח targetGroupId בעוד השרת דורש targetPhone+role (400); checkIncomingLinkRequests מסנן status שהשרת לא מחזיר; UPDATE … LIMIT 1 (2619-2623) אינו SQL חוקי ומפיל אישור שבו לאורח יש ארנק FLW ילד.",
    "הלקוח משתמש ב-apiFetch עם Bearer ושולח {targetPhone, role ∈ parent|child|partner}; GET link-requests מחזיר status ומסונן בשרת ל-pending; מיזוג ארנקי FLW ילד מתבצע לפי child_user_id בלי LIMIT. בדיקה E2E: שני חשבונות SOLO → בקשה → אישור → משתמשי האורח בקבוצת הקולט והאורח frozen.",
    ["app.js:2005-2131", "server.js:2506-2640", "server.js:2619-2623", R + "בקשת איחוד חשבונות SOLO / משפחות (link-request)"])

add("איחוד משפחות", "functional", "medium", "אין ארכוב אוטומטי לחשבון מוקפא אחרי 30 יום",
    "האורח מוקפא (account_status='frozen', frozen_at) וה-UI מזהיר 'יוקפא ל-30 יום ואז יוארכב', ו-/api/login מחשב days_left, אך אין קוד שמעביר frozen → archived.",
    "משימה יומית מעבירה family_groups עם account_status='frozen' ו-frozen_at < NOW()-30 days ל-'archived' (archived_at=NOW). חשבון archived חסום לכניסה; הנתונים נשמרים (ללא מחיקה).",
    ["server.js:10645-10656", "server.js:2555", "app.js:1977", R + "בקשת איחוד חשבונות SOLO / משפחות (link-request)"],
    ["להשאיר frozen ללא תפוגה ולשנות את טקסט האזהרה"])

# ---- /api/data ----
add("טעינת נתונים", "money", "medium", "/api/data מאפס מכסת AI ל-10 ודורס את מכסת ה-premium",
    "GET /api/data (server.js:10766) מאפס ai_tokens=10 ו-last_token_reset בכל יום חדש לפני handleAITokens (4170), כך שמנוי premium לעולם לא מקבל 50 ביום.",
    "איפוס המכסה מתבצע רק ב-handleAITokens לפי plan: standard/solo/member 10, premium 50, enterprise ללא הגבלה. /api/data רק קורא את ai_tokens. שגיאה פנימית ב-handleAITokens מחזירה 500 ולא 'BATTERY_EMPTY'.",
    ["server.js:10766", "server.js:4170-4199", R + "מכסת AI יומית (\"סוללה\")", R + "טעינת דשבורד וסנכרון נתונים (/api/data)"])

add("טעינת נתונים", "security", "high", "הקצאות לומדות ל-ADMIN מחזירות שורות של כל המערכת",
    "השאילתה ב-/api/data (server.js:10779) משתמשת ב-OR $2='ADMIN' ללא סינון קבוצה, כך שמנהל משפחה מקבל את user_assignments של כל המשפחות.",
    "ADMIN מקבל רק הקצאות של משתמשים ב-group_id של הסשן (JOIN users ON group_id=$groupId); משתמש אחר — רק שלו.",
    ["server.js:10779", R + "טעינת דשבורד וסנכרון נתונים (/api/data)"])

add("טעינת נתונים", "functional", "low", "תחילת שבוע להוצאה שבועית של ילד לא מאופסת לחצות",
    "weekly_stats.spent מחושב מ-now − getDay() ימים ושומר את שעת היום (server.js:10787), כך שהוצאות מיום ראשון בבוקר לא נספרות אם הבדיקה בערב.",
    "תחילת שבוע = יום ראשון 00:00 בשעון Asia/Jerusalem (date_trunc בשאילתה עם AT TIME ZONE).",
    ["server.js:10787", R + "טעינת דשבורד וסנכרון נתונים (/api/data)"])

add("טעינת נתונים", "security", "low", "'חוכמת ההמונים' חושפת מחירים ושמות חנויות של משפחות אחרות",
    "best price ב-/api/data (server.js:10822-10843) מחפש ב-shopping_trip_items של כל הקבוצות ומחזיר מחיר ו-store_name ללא אנונימיזציה.",
    "מכל משפחות אחרות מוחזר רק המחיר המינימלי ושם רשת מנורמל, ללא branch_name ובתנאי שהמחיר נצפה ב-3 משפחות שונות לפחות; לנתוני המשפחה עצמה (is_local) מוחזר הפירוט המלא.",
    ["server.js:10822-10843", R + "טעינת דשבורד וסנכרון נתונים (/api/data)"],
    ["לבטל את ההשוואה בין משפחות ולהשאיר רק היסטוריה של המשפחה"])

# ---- כספים ----
add("מודל יתרה", "architecture", "high", "שני מקורות אמת ליתרה: users.balance מול סכום התנועות",
    "users.balance מתעדכן ידנית בכל endpoint, ובמקביל היתרה מחושבת מ-SUM(transactions). FamilAI ADD_TRANSACTION (23572), /api/kids/redeem (35395) ו-checkout לא מעדכנים balance; loans/approve, adjust-balance ו-payroll מעדכנים balance בלי 'צד הורה'. רשימת חברים, ריבית ב-payday ותשקיף נשענים על balance, הכותרת על התנועות.",
    "מקור אמת יחיד: יומן transactions. יתרת משתמש = SUM(income) − SUM(expense) שלו; users.balance הופך לעמודת cache שמתעדכנת רק בפונקציה postTransaction() אחת (או trigger) באותה טרנזקציה. כל העברת כסף להורה↔ילד נרשמת בזוג תנועות עם transfer_id משותף. מיגרציה: איזון balance לפי התנועות ודוח פערים.",
    ["server.js:10773", "server.js:10790", "server.js:11815", "server.js:23572", "server.js:35395", R + "מודל היתרה (users.balance מול סכום תנועות)"])

add("תנועות", "money", "high", "כל חבר (גם ילד) יכול לרשום לעצמו הכנסה בכל סכום, כולל שלילי",
    "POST /api/transaction (server.js:11387) מאפשר לכל משתמש לרשום תנועה לעצמו, type income/expense, amount=parseFloat||0 בלי חסימת שלילי/0, ומעדכן users.balance. גם adjust-balance לא בודק amount חיובי.",
    "משתמש שאינו ADMIN רשאי לרשום לעצמו רק expense; income נרשם רק ע\"י ADMIN. amount חייב להיות > 0 ועד 1,000,000 (אחרת 400 'סכום לא תקין'); type קובע את הכיוון. אותו כלל ב-adjust-balance וב-adhoc-payment.",
    ["server.js:11387-11408", "server.js:11729", "app.js:5546", R + "רישום, עריכה ומחיקה של תנועה (תזרים)"],
    ["לאפשר לילד לרשום הכנסה בסטטוס 'ממתין לאישור הורה' שלא משפיעה על היתרה עד אישור"])

add("עקביות כספית", "data-integrity", "high", "פעולות כספיות מרובות כתיבות ללא טרנזקציה אמיתית",
    "BEGIN/COMMIT רצים על pool.query (חיבורים שונים) ב-payday (11807), אישור משימה (12049), הפקדה ליעד, checkout (11048), payroll-run; adjust-balance, kids/redeem, vision-verify ו-flow/redeem ללא טרנזקציה בכלל.",
    "כל פעולה שכותבת יותר משורה אחת בכסף/מלאי משתמשת ב-client ייעודי (pool.connect) עם BEGIN/COMMIT/ROLLBACK ו-release ב-finally, דרך helper withTransaction(fn). בדיקה: כשל מלאכותי באמצע payday לא משאיר תנועות חלקיות.",
    ["server.js:11807", "server.js:12049", "server.js:11520", "server.js:11048", "server.js:11853", "server.js:11729", "server.js:35377", "server.js:12549"])

add("דמי כיס", "money", "high", "Payday: לחיצה כפולה משלמת פעמיים, כולל MEMBER, ללא תיעוד מועד",
    "POST /api/admin/payday (server.js:11801-11822) מחלק לכל משתמש active שאינו ADMIN (כולל MEMBER) בכל הפעלה, בלי רישום מועד חלוקה אחרון; ריבית על users.balance ללא עיגול; u.nickname לא נשלף ולכן התיאור תמיד 'דמי כיס לילד'.",
    "Payday מחלק רק ל-role='CHILD'. חלוקה אחת לכל שבוע קלנדרי (טבלת family_paydays(group_id, period_start) UNIQUE); הפעלה שנייה באותו שבוע → 409 'כבר חולקו דמי כיס השבוע'. ריבית = round(balance × rate/100, 2) על היתרה המחושבת מהיומן. התיאור כולל את שם הילד.",
    ["server.js:11801-11822", "app.js:5534", R + "דמי כיס וריבית — הגדרה וחלוקה (Payday)"],
    ["מחזור חודשי במקום שבועי", "חלוקה אוטומטית בקרון ביום קבוע במקום כפתור ידני"])

add("שכר", "security", "critical", "payroll-preview / payroll-run / adhoc-payment ללא אימות",
    "GET /api/timeclock/payroll-preview/:groupId (11829), POST /api/timeclock/payroll-run (11853) ו-POST /api/timeclock/adhoc-payment (11874) ללא middleware; groupId ו-items מה-body/URL — כל אחד יכול להזרים יתרה. ה-INSERT לתנועות ב-run לא מוגבל לקבוצה.",
    "שלושתם מחייבים verifyBiz + verifyBizAdminOnly; groupId נלקח מהסשן; כל item חייב להיות משתמש active בקבוצה (אחרת 400 על כל הבקשה); amount > 0. הרצה עטופה בטרנזקציה.",
    ["server.js:11829-11890", "s1-rbac.html#BIZ — נוכחות ושכר", R + "הרצת שכר (payroll-run) ותשלום חד-פעמי"])

add("הלוואות", "functional", "medium", "הלוואות: סכום מוצג undefined, אין החזר ודחייה אחרי אישור",
    "הלקוח מציג l.amount שאינו קיים (העמודה original_amount) → '₪undefined' (app.js:5581, 5590); remaining_amount לא מתעדכן בשום מקום; /api/loans/reject (11489) לא בודק סטטוס ולכן דוחה הלוואה מאושרת בלי לבטל את הזיכוי.",
    "הלקוח מציג original_amount/remaining_amount. reject מותר רק מ-pending. זרימת החזר: ADMIN רושם החזר (POST /api/loans/repay {loanId, amount ≤ remaining}) → expense לילד, remaining_amount−=amount, ובהגעה ל-0 status='repaid'. מכונת מצבים: pending → approved → repaid; pending → rejected.",
    ["app.js:5581", "app.js:5590", "server.js:11456-11503", R + "הלוואות / מקדמות", "s1-docsvscode.html#הלוואות pending→active→paid"])

add("יעדי חיסכון", "money", "medium", "הפקדה ליעד של אחר יורדת מהיתרה של המפקיד; אין משיכה/סגירה",
    "POST /api/goals/deposit (11520) מוריד מה-balance של המפקיד גם כשהיעד שייך לילד אחר; אין endpoint למשיכה או לסגירת יעד שהושג.",
    "הפקדה מותרת לבעל היעד (target_user_id ?? user_id) מהיתרה שלו; ADMIN רשאי להפקיד כמתנה — expense להורה ו-income 'savings' לילד. POST /api/goals/:id/withdraw (בעל היעד או ADMIN, עד current_amount) מחזיר ליתרה; יעד שהגיע ל-target מסומן achieved.",
    ["server.js:11504-11540", "app.js:5536-5538", R + "יעדי חיסכון והפקדה"])

add("תקציב", "data-integrity", "medium", "UPSERT תקציב 'כל המשפחה' יוצר כפילויות (NULL ב-UNIQUE)",
    "POST /api/budget/update (11349) מבצע UPSERT על (group_id, category, target_user_id) עם target_user_id NULL; ב-PostgreSQL NULL לא מתנגש ולכן נוצרות שורות כפולות שמוצגות דרך MAX. כפתור הוספת סעיף מוצג גם לילד (app.js:1848) והשרת דוחה.",
    "אינדקס ייחודי חלקי UNIQUE(group_id, category) WHERE target_user_id IS NULL בנוסף לאינדקס הקיים, ו-UPSERT מתאים; מיגרציה ממזגת כפילויות (שומרת את העדכנית). הכפתור מוסתר למי שאינו ADMIN.",
    ["server.js:11349-11368", "server.js:11330", "app.js:1848", R + "תקציבים וקטגוריות תקציב"])

add("תשקיף", "functional", "medium", "התשקיף מבוסס על 200 התנועות האחרונות בלבד",
    "renderForecast (app.js:5691) מחשב על allTransactions (LIMIT 200 מ-/api/transactions), כך שתנועות חוזרות ישנות נעלמות מהתשקיף.",
    "endpoint GET /api/forecast/base מחזיר את כל התנועות is_recurring הפעילות (end_month ≥ החודש הנוכחי או NULL) ואת התנועות העתידיות של הקבוצה/המשתמש, והתשקיף מחושב עליהן.",
    ["app.js:5691-5790", "server.js:11371", R + "תשקיף כלכלי (Forecast)"])

add("תזרים", "data-integrity", "medium", "עריכה/מחיקה של תנועה לא נרשמת ביומן ביקורת",
    "PUT/DELETE /api/transaction/:id (11409/11432) משנים סכום ויתרה בלי activity_log או family_audit_log; רק POST נרשם.",
    "כל עריכה/מחיקה נרשמת ב-family_audit_log (action edit_transaction/delete_transaction, performed_by מהסשן, ערכים לפני/אחרי). תנועות מערכת (is_manual=FALSE) לא ניתנות לעריכה/מחיקה — 403.",
    ["server.js:11409-11455", "server.js:517", R + "רישום, עריכה ומחיקה של תנועה (תזרים)"])

add("ניהול חברים", "data-integrity", "high", "מחיקת משתמש מוחקת את כל ההיסטוריה הכספית שלו (CASCADE)",
    "DELETE /api/users/:id (11627) מבצע DELETE FROM users; FK עם CASCADE מוחקים transactions, loans, goals וכו', ומשנים יתרות והיסטוריה של המשפחה.",
    "מחיקה רכה: users.status='deleted', deleted_at, ניקוי phone/email/password_hash ומחיקת סשנים; התנועות נשמרות ומוצגות כ'משתמש שהוסר'. מחיקה קשיחה רק ל-pending/invited שלא ביצעו פעולות.",
    ["server.js:11627-11655", "server.js:6472", R + "עריכת פרטי משתמש, סיסמה ומחיקה"])

# ---- משימות ----
add("משימות — יצירה", "money", "high", "יצירת משימה מקבלת status שרירותי ו-assignee מקבוצה אחרת",
    "POST /api/tasks (11890) שומר status מה-body (כולל 'approved' בלי תשלום) ולא בודק שה-assignee שייך לקבוצה.",
    "status ביצירה: ADMIN → pending; 'מעשה טוב' של ילד לעצמו → done; כל ערך אחר → 400. assignee חייב להיות משתמש active בקבוצת הסשן (אחרת 400). אותו כלל ב-bulk.",
    ["server.js:11890-11931", "server.js:11932", "app.js:2563", R + "יצירת משימה (יחיד, מרובה, \"מעשה טוב\")"])

add("משימות — אישור", "money", "high", "אישור משימה ללא בדיקת מצב קודם — אישור כפול משלם פעמיים",
    "POST /api/tasks/update (12023) עם approved מעדכן ומזכה בלי לבדוק את הסטטוס הקודם (12049-12059); מותר מכל מצב, כולל approved/deleted.",
    "מעבר ל-approved רק מ-done (או מ-pending כשה-ADMIN מאשר ישירות), בעדכון אטומי UPDATE … WHERE id=$1 AND status IN ('done','pending') RETURNING; 0 שורות → 409 'המשימה כבר טופלה'. התשלום מתבצע רק כשהעדכון הצליח, באותה טרנזקציה.",
    ["server.js:12023-12070", "app.js:3090", R + "מחזור חיים של משימה: ביצוע, הוכחה, אישור ותשלום, דחייה"])

add("משימות חוזרות", "functional", "high", "משימות חוזרות לא מופצות ולא משולמות",
    "הלקוח שומר recurring_days כספרות '0,1,2' (app.js:3112) והקרון (server.js:6800) מחפש שמות עבריים ב-includes על מחרוזת — לכן אין הפצה; 'בוצע' על משימה חוזרת רק מעדכן last_completed_at בלי תשלום (12040); הקרון תלוי ב-timezone של השרת.",
    "recurring_days נשמר כמערך INT 0–6 (0=ראשון). הקרון רץ בשעון Asia/Jerusalem מ-08:00 ומייצר מופע חד-פעמי (pending, deadline סוף היום) לכל יום פעיל. המופע משולם באישור כמו כל משימה; תבנית החוזרת עצמה אינה ניתנת לסימון done. מיגרציה ממירה ערכים קיימים (שמות/ספרות).",
    ["app.js:3108-3140", "server.js:6790-6817", "server.js:12040", R + "משימות חוזרות ו-cron הפצת משימות חוזרות"],
    ["לבטל את הקרון ולשלם על כל 'בוצע היום' של התבנית ישירות לאחר אישור הורה"])

add("סטטוסים", "functional", "medium", "סטטוסים לא קנוניים: deleted מוצג, completed/pending_approval לא קיימים",
    "משימות deleted לא מסוננות ב-/api/data וב-renderTasks; הלקוח בודק completed (app.js:9781, 11801) ו-pending_approval לקניות (9776, 11807) שהשרת לא כותב — תגי הניווט ו'מה מחכה לך' תמיד 0; bought נבדק ב-toggleSelectAll.",
    "סט קנוני — tasks: pending, done, approved, rejected, deleted (completed_self מוסר או מתועד); shopping_list: requested, pending, in_cart. /api/data מחזיר משימות ללא deleted. תגים: הורה — קניות requested + משימות done; ילד — משימות pending שלו + לומדות assigned.",
    ["app.js:9773-9790", "app.js:11780-11810", "app.js:4731", "server.js:10755", R + "ניווט משפחתי (ALL_TABS, ROLE_DEFAULTS, FAMILY_GNAV_GROUPS)", R + "הוספת פריט לרשימה, בקשת ילד ואישור הורה"])

add("משימות — AI", "money", "high", "אימות תמונה ב-AI מאשר ומשלם בלי הורה וללא הגנת כפילות",
    "POST /api/tasks/vision-verify (12549) — אם Gemini מחזיר verified: status='approved' ותשלום reward+10% בונוס בלי אישור הורה ובלי טרנזקציה; חוסם רק approved קיים. מסמך הלקוח מבטיח התנהגות זו.",
    "לשמר את האישור האוטומטי (כמובטח במסמך הלקוח) עם הגנות: מעבר אטומי רק מ-pending/rejected; רק ה-assignee; הגדרת קבוצה ai_auto_approve (ברירת מחדל true) שההורה יכול לכבות — כשהיא כבויה AI מסמן done + ai_verified=true וההורה מאשר; תשלום בטרנזקציה.",
    ["server.js:12549-12595", "app.js:2706-2708", "s1-docsvscode.html#בדיקת AI מאשרת ומשלמת + בונוס 10%", R + "אימות ביצוע משימה בתמונה ע\"י AI (vision-verify)"],
    ["AI לעולם לא משלם — תמיד done + ai_verified והורה מאשר"])

add("משימות — AI", "functional", "medium", "רעיונות משימה ב-AI לא נגישים מהממשק",
    "generateAITasks (app.js:2622) קורא val('task-assignee') שלא קיים ב-index.html (המודל משתמש ב-.task-assignee-cb), ולכן תמיד נעצר ב'קודם כל בחרו למעלה עבור מי המשימה'.",
    "generateAITasks קורא את ה-checkbox הראשון המסומן (.task-assignee-cb:checked) לחישוב גיל; אם אין — הודעה. בדיקה: בחירת ילד + נושא מחזירה 3 הצעות.",
    ["app.js:2622", "index.html:2200", "server.js:12310", R + "רעיונות משימה ב-AI"])

add("משימות — תגובות", "ux", "low", "תגובה על משימה לא מתריעה לצד השני",
    "POST /api/tasks/:id/comments (12006) רק שומר; אין התראה ואין polling בחלון התגובות.",
    "תגובה יוצרת alert_notifications למשתתף השני (ה-assignee או יוצר המשימה/ADMIN), מפתח task_comment_<taskId>_<commentId>; מונה הפעמון מתעדכן ב-polling הקיים.",
    ["server.js:11994-12020", "app.js:3266-3305", R + "תגובות על משימה"])

# ---- ילדים ----
add("ארנק FLW ילד", "security", "high", "הגדרות ארנק ילד: ללא בדיקת ADMIN וללא בדיקת שייכות הילד",
    "POST /api/kids/config (35362) בודק רק familyGroupId=קבוצת הסשן; ילד יכול לשנות לעצמו את שווי המטבע, ו-childUserId של משפחה אחרת נדרס (ON CONFLICT child_user_id). auto_approve נשמר ולא בשימוש.",
    "רק ADMIN; childUserId חייב להיות CHILD בקבוצת הסשן (אחרת 403). flw_value_ils בטווח 0.01–1, max_daily_flw 0–1000. auto_approve מוסר או מיושם (מימוש עד max_daily מאושר אוטומטית).",
    ["server.js:35352-35375", "app.js:16426-16440", R + "ארנק FLW לילד והגדרות הורה (שווי ותקרה יומית)"])

add("מימוש FLW ילד", "money", "high", "ילד יכול לממש FLW לכסף ישירות בלי הורה",
    "POST /api/kids/redeem (35377) לא בודק ADMIN, לא בודק ש-requestId שייך לילד, לא מעדכן users.balance ואינו בטרנזקציה; אין דחייה לבקשה.",
    "רק ADMIN; requestId חובה, חייב להיות pending ושל הילד; הסכום נלקח מהבקשה. POST /api/kids/redeem-requests/:id/reject (ADMIN). מימוש נרשם דרך postTransaction (זוג תנועות) בטרנזקציה עם עדכון הארנק.",
    ["server.js:35377-35420", "server.js:35422", "server.js:35438", R + "מימוש FLW של ילד לכסף (בקשה ואישור הורה)"])

add("משחקים", "money", "high", "צבירת FLW במשחקים: ניקוד מהלקוח, תקרה יומית חלקית והקצאה בלי ADMIN",
    "use-round (35619) ו-award-flw (35294) מקבלים score/flwEarned מהלקוח (TODO מפורש); use-round ללא תקרה יומית; free play מוגבל רק בלקוח; listener של postMessage לא בודק origin; assign-game (35555) לא בודק ADMIN ושייכות הילד.",
    "תקרה יומית max_daily_flw (ברירת מחדל 50) חלה על כל צבירת FLW של ילד (משחק חופשי, סיבובים, קווסטים) ונבדקת בשרת. award-flw בודק kid_free_play_log בשרת (פעם ביום למשחק). flw לסיבוב מחושב בשרת מ-score ומוגבל ל-flw_per_round. assign-game: ADMIN וילד בקבוצה. postMessage מקבל רק מ-origin של השרת.",
    ["server.js:35294-35330", "server.js:35555-35640", "app.js:16029", R + "משחקים: קטלוג, הקצאה, סיבובים וצבירת FLW"],
    ["אימות ניקוד בשרת באמצעות טוקן סיבוב חתום שנוצר בתחילת הסיבוב"])

add("קווסטים", "money", "high", "הגשת קווסט חוזרת מזכה שוב ושוב",
    "POST /api/kids/quests/:questId/submit (35803) לא בודק שהקווסט שייך לילד ושהוא עדיין active, ולכן כל הגשה מזכה FLW.",
    "הגשה מותרת רק אם kid_quests.child_user_id = המשתמש בסשן ו-status='active'; המעבר ל-completed אטומי (UPDATE … WHERE status='active' RETURNING) ורק אז זיכוי. הגשה שנייה → 409.",
    ["server.js:35803-35850", R + "קווסטים (אתגרי שאלות) וספריית קווסטים"])

add("ספריית קווסטים", "security", "medium", "ספריית קווסטים: endpoints ללא אימות וסינון קהילה שגוי",
    "GET /api/quest-library, /:id/use, /rate, /report ו-share (3906-4052) ללא אימות; share סומך על userId מה-body; ספריית community מסננת community_id=$groupId (מזהה קבוצה מול קהילה).",
    "כל נתיבי הספרייה מחייבים verifyFamily; userId/groupId מהסשן; use רק ל-ADMIN ולילד בקבוצה; rate/report — משתמש אחד פעם אחת. סינון community לפי family_communities של הקבוצה.",
    ["server.js:3906-4060", "app.js:17529-17620", R + "קווסטים (אתגרי שאלות) וספריית קווסטים"])

add("אקדמיה", "functional", "low", "אקדמיה: כפילויות הקצאה, תגמול מוצג לפני השרת, type ברירת מחדל שגוי",
    "request-challenge (12084) משתמש ב-ON CONFLICT DO NOTHING בלי אינדקס ייחודי; הלקוח מציג 'זכית ב-🪙' לפני תשובת השרת; POST bundles שומר type ברירת מחדל 'professional' גם למשפחה; קטגוריית התקציב 'academy' לא מקבלת תנועות.",
    "UNIQUE(user_id, bundle_id) על user_assignments; הלקוח מציג תגמול רק לפי rewardCredited בתשובה; type ברירת מחדל 'financial' לקבוצת FAMILY; קטגוריית academy מוסרת מתצוגת התקציב (התגמול ב-FLW).",
    ["server.js:12084-12170", "app.js:4480", "app.js:73", R + "אקדמיה: לומדות, הקצאה, הגשה ומורה AI"])

add("קריאה ללא אימות", "security", "high", "דוח שבועי ויומן פעילות חושפים נתוני כל משפחה ללא אימות",
    "GET /api/family/weekly-report/:groupId (35898) ו-GET /api/activity?userId= (24532) ללא middleware — כל groupId/userId מחזיר נתוני ילדים ויומן פעילות. parent-overview (35075) לא בודק ADMIN.",
    "weekly-report ו-parent-overview: verifyFamily + ADMIN + groupId של הסשן. /api/activity: verifyFamily; userId ו-group מהסשן; ADMIN רואה את כל הקבוצה, אחר רק את עצמו. 'לא נקראו' נקבע לפי users.activity_seen_at שמתעדכן בפתיחת הפאנל (במקום חלון 24 שעות).",
    ["server.js:35898", "server.js:24532", "server.js:35075", R + "סקירת הורה על הילדים, תמונת פרופיל ודוח שבועי", R + "יומן פעילות ופעמון"])

add("ילדים — תמונה", "architecture", "low", "תמונת פרופיל נשמרת לדיסק הזמני של השרת",
    "POST /api/kids/profile-image/:userId (35196) שומר dataUrl ל-public/uploads/avatars כשאין imageUrl — נמחק ב-deploy בסביבה עם דיסק ephemeral.",
    "כל העלאת תמונה עוברת ל-Cloudinary (כמו הוכחות משימה); השרת שומר רק URL; גודל מקסימלי 2MB ו-MIME image/jpeg|png|webp.",
    ["server.js:35196", R + "סקירת הורה על הילדים, תמונת פרופיל ודוח שבועי"])

# ---- FamilAI ----
add("FamilAI", "security", "critical", "צ'אט FamilAI ללא אימות מבצע פעולות כספיות ומחיקות לכל groupId",
    "POST /api/family/chat-assistant (23615) ו-/confirm-action (23683) ללא middleware; groupId/userId מה-body — חשיפת כל נתוני המשפחה (buildFamilyAIContext) וביצוע ADJUST_BALANCE/DELETE_*; אין בדיקת תפקיד; תשובת ה-AI מוזרקת כ-HTML.",
    "שני ה-endpoints מחייבים verifyFamily; group/user מהסשן. פעולות כספיות ומחיקות (ADJUST_BALANCE, DELETE_TASK, DELETE_GROCERY_ITEM, ADD_TRANSACTION income) רק ל-ADMIN; ילד מקבל הסבר בלבד. confirm-action מקבל רק pending_action_id שנשמר בשרת (תוקף 5 דק') ולא action_data מהלקוח. התשובה מוצגת כטקסט עם escape.",
    ["server.js:23469-23700", "app.js:11407-11460", R + "FamilAI — עוזרת צ'אט עם ביצוע פעולות"])

add("FamilAI", "data-integrity", "medium", "פעולות FamilAI לא עקביות עם שאר המערכת",
    "COMPLETE_TASK קובע approved בלי תשלום; ADD_TRANSACTION לא מעדכן balance וקטגוריה 'כללי'; DELETE_TASK/DELETE_GROCERY_ITEM מוחקים כל התאמת ILIKE; UPDATE_PANTRY קובע כמות במקום להוסיף; הלקוח מטפל ב-OPEN_TAB שהשרת לא מחזיר.",
    "כל פעולה קוראת לאותה פונקציית שירות של ה-endpoint הרגיל (createTask, approveTask עם תשלום, postTransaction, addPantry). מחיקה פועלת על פריט אחד שזוהה במדויק; כמה התאמות → ה-AI מבקש הבהרה. קטגוריות מהרשימה הקנונית בלבד.",
    ["server.js:23532-23610", "app.js:11440", R + "FamilAI — עוזרת צ'אט עם ביצוע פעולות"])

add("XSS", "security", "medium", "הזרקת HTML ללא escape באפליקציית המשפחה",
    "שם פריט בהתראה הצפה במצב סופר (app.js:5107) ותשובת FamilAI (Markdown→HTML) מוזרקים ל-innerHTML ללא escape.",
    "כל טקסט שמקורו במשתמש או ב-AI עובר escapeHtml לפני הצגה; Markdown מומר רק לאחר escape (תמיכה ב-** בלבד). בדיקה: פריט בשם <img onerror=alert(1)> מוצג כטקסט.",
    ["app.js:5107", "app.js:11440", R + "מצב \"אני בסופר\" (Supermarket Mode)", R + "FamilAI — עוזרת צ'אט עם ביצוע פעולות"])

# ---- member ----
add("חשבון חבר", "security", "critical", "endpoints של חשבון חבר ושל SA לפתיחת מודולים ללא אימות",
    "POST /api/member/request-module (31042), POST /api/member/link/:linkId/respond (31016), GET my-businesses/my-orders (31116/31135) ללא אימות; גם /api/sa/groups/:id/modules|unlock-module|upgrade-member (31063-31110) ללא verifySA — כל אחד פותח מודולים לכל קבוצה.",
    "נתיבי member מחייבים verifyFamily ו-groupId מהסשן (respond — רק ADMIN של member_group_id של הקישור). נתיבי /api/sa/groups/* מחייבים verifySA (+ הרשאת biz).",
    ["server.js:31016-31140", "server.js:31063-31110", "s1-rbac.html#unlocked_modules", R + "חשבון \"חבר\" (member) — נעילת מודולים ובקשת פתיחה", R + "שיוך חשבון משפחה/חבר לעסק"])

add("חשבון חבר", "functional", "low", "בקשות מודול כפולות ונעילות שלא משתחררות בלי רענון",
    "DISTINCT על אובייקט עם requested_at לא מונע כפילות — כל לחיצה מוסיפה בקשה; applyMemberLocks (app.js:13512) רק נועל, ובשדרוג ל-family (2253) טאבים נשארים נעולים עד רענון.",
    "בקשה פתוחה אחת לכל (group, moduleKey): אם קיימת — 200 'הבקשה כבר נשלחה'. applyMemberLocks מסיר קודם את כל הנעילות ואז נועל לפי המצב הנוכחי.",
    ["server.js:31042-31060", "app.js:13512", "app.js:2253", R + "חשבון \"חבר\" (member) — נעילת מודולים ובקשת פתיחה"])

add("שיוך לעסק", "data-integrity", "low", "התראת link_approved כותבת לעמודות שאולי לא קיימות",
    "התראת שיוך אושר כותבת ל-alert_notifications עם type, title, reference_id, בעוד שאר ה-INSERTים משתמשים ב-trigger_type/message/reference_key (server.js:760).",
    "INSERT אחיד ל-alert_notifications דרך helper createAlert(groupId, trigger_type, message, reference_key) בלבד; לאמת את הסכמה ולהסיר עמודות שאינן קיימות.",
    ["server.js:31016-31040", "server.js:760", R + "שיוך חשבון משפחה/חבר לעסק"])

# ---- קניות ----
add("רשימת קניות", "functional", "low", "הרשאות פריטים וקוד מת ברשימת הקניות",
    "כל חבר (כולל ילד) יכול למחוק/לסמן פריטים של אחרים; הלקוח מצפה ל-data.alert ('חוכמה') שהשרת לא מחזיר (app.js:4533, 4829).",
    "מחיקה: ADMIN או מבקש הפריט; סימון in_cart/pending מותר לכל חבר (כמו היום). להסיר את קוד ה-data.alert.",
    ["server.js:10879-10915", "app.js:4533", "app.js:4829", R + "הוספת פריט לרשימה, בקשת ילד ואישור הורה"])

add("Checkout", "functional", "medium", "סיום קנייה: 'חסר' ממצב סופר לא עובר וטיוטת חסרים מכפילה פריטים",
    "_smMissing לא מועבר ל-checkout שקורא רק את DOM הרשימה הראשית; createDraftFromMissing (app.js:5514) מוסיף שוב פריטים שהשרת כבר החזיר ל-pending; תנועת ה-checkout לא מעדכנת balance.",
    "checkout מקבל מצב פריטים מאובייקט state אחד (רשימה + מצב סופר): bought[] ו-missing[]. פריטים חסרים חוזרים ל-pending בשרת בלבד, וטיוטת חסרים רק מציגה אותם (בלי INSERT חוזר). התנועה נרשמת דרך postTransaction.",
    ["app.js:4862-4900", "app.js:5514", "server.js:11048-11085", R + "סיום קנייה (Checkout) — תנועה, מזווה והיסטוריה"])

add("מצב סופר", "ux", "low", "באנר 'נמצא בסופר' נשאר לנצח אם לא לחצו סיום",
    "sm_user_id/sm_started_at (12752) מתאפסים רק ב-/end; סגירת האפליקציה משאירה באנר לשאר המשפחה.",
    "הבאנר מוצג רק אם sm_started_at בתוך 3 השעות האחרונות; polling של מצב סופר מעדכן sm_last_ping כל דקה, ואחרי 15 דק' בלי ping המצב מתאפס.",
    ["server.js:12752-12770", "app.js:5121", R + "מצב \"אני בסופר\" (Supermarket Mode)"])

add("רשימות שמורות", "functional", "low", "שמירת רשימה ראשונה מציגה 'שגיאת תקשורת' למרות הצלחה",
    "_doSaveList קורא startAutoSave() (app.js:5463) שאינה מוגדרת → ReferenceError נתפס ומוצג 'שגיאת תקשורת'.",
    "להסיר את הקריאה (או לממש שמירה אוטומטית debounce 2 שניות ל-PUT /saved/:id). בדיקה: שמירה ראשונה מציגה הודעת הצלחה.",
    ["app.js:5438-5465", R + "רשימות קניות שמורות ושם \"סשן\" משותף"])

add("סריקת קבלה", "functional", "medium", "שמירת קבלה סרוקה מוסיפה לרשימת הקניות במקום למזווה",
    "POST /api/shopping/scan-receipt/save (12730) מכניס את פריטי הקבלה לרשימת הקניות כ-pending — מה שכבר נקנה נכנס כדרישה חדשה.",
    "ברירת מחדל: פריטי קבלה נכנסים למזווה (כמו checkout) ונרשמת תנועת הוצאה groceries בסכום הקבלה עם shopping_trip. אפשרות משנית במסך האישור: 'הוסף לרשימת קניות' (לרכישה חוזרת).",
    ["server.js:12599-12750", "app.js:2724-2808", R + "סריקת קבלה ויצירת רשימת קניות ב-AI"])

add("מזווה", "ux", "low", "מזווה: העברה לקניות מוחקת בלי אישור, התאמת שם רגישה לרישיות ופונקציות כפולות",
    "movePantryToCart מוחק את פריט המזווה בלי confirm; התאמת שם מדויקת מפצלת פריטים ברישיות/רווחים; openPantryUseModal/submitPantryUse מוגדרות פעמיים (2905/2947 ו-6096/6138); bulk-update שולח מייל ישירות דרך SMTP_USER/PASS.",
    "העברה לקניות מבקשת confirm ומאפשרת 'השאר במזווה'; התאמת פריטים לפי normalized_name (lower+trim+רווח יחיד); הגדרה אחת לכל פונקציה; מיילים רק דרך sendSystemEmail.",
    ["app.js:2905", "app.js:6096", "app.js:2965", "server.js:11206", "server.js:11264", R + "מזווה: הוספה, עדכון כמות, שימוש, מחיקה וספירה"])

# ---- FLW משפחתי ----
add("מימוש FLW משפחתי", "functional", "high", "קודי הנחה FL* מהאפליקציה לא עובדים בחנות",
    "POST /api/flow/redeem (21950) יוצר flow_redemptions עם status 'active', בעוד /api/flow/redeem/validate (22025) מחפש רק NULL/'pending'; הניכוי והתנועות לא בטרנזקציה אחת.",
    "סטטוסים קנוניים: active → used / expired. validate מקבל רק active שלא פג ומסמן used אטומית. redeem ו-deduct מבצעים ניכוי, תנועות וזיכוי עסק בטרנזקציה אחת.",
    ["server.js:21950-22050", "server.js:22025", "server.js:22119", R + "מימוש FLW משפחתי: קוד הנחה, ניכוי בחנות ואימות קוד"])

# ---- ניהול הבית ----
add("ניהול הבית", "data-integrity", "low", "השלמת תחזוקה כפולה יוצרת מחזור כפול; מחיקה תמיד מצליחה",
    "PUT /api/equipment/maintenance/:id/complete (26118) מותר גם לרשומה completed ויוצר רשומת pending נוספת; DELETE פריט (26081) מחזיר success גם אם לא נמצא.",
    "complete מותר רק מ-pending (UPDATE … WHERE status='pending' RETURNING; אחרת 409). DELETE מחזיר 404 כשלא נמחקה שורה; מחיקת ציוד עם תחזוקות/תקלות מבקשת אישור מפורש בלקוח.",
    ["server.js:26081", "server.js:26118-26137", R + "תחזוקה מתוזמנת לציוד", R + "ציוד הבית (פריטים)"])

add("ניהול הבית", "security", "medium", "בדיקת התראות תחזוקה חושפת קריאות שירות של משפחות אחרות בקהילה",
    "POST /api/equipment/notifications/check/:groupId (26264) — שאילתת קריאות השירות של מחר כוללת family_group_id IN (משפחות באותה קהילה) (26299-26306), כך שכותרות קריאות של אחרים נכנסות להתראות.",
    "השאילתה מסוננת ל-family_group_id = קבוצת הסשן בלבד.",
    ["server.js:26264-26310", R + "בדיקת התראות תחזוקה (on-demand)"])

# ---- ניווט / תיעוד ----
add("ניווט", "ux", "low", "marketplace/kol-haam ב-dropdown אך לא בקבוצות הניווט",
    "fgdrop-marketplace ו-fgdrop-kol-haam קיימים ב-index.html:534,563 אך לא ב-FAMILY_GNAV_GROUPS (app.js:9690) — אין הדגשת קבוצה פעילה ולא חלים עליהם כללי הסתרה; FAMILY_ENV_SPEC מונה אותם ב-ALL_TABS.",
    "להוסיף marketplace לקבוצת home ו-kol-haam לקבוצת family ב-FAMILY_GNAV_GROUPS, ולכלול אותם ב-ALL_TABS/ROLE_DEFAULTS (ADMIN, MEMBER, CHILD), כך שהרשאות ונעילת features חלות עליהם.",
    ["index.html:534", "index.html:563", "app.js:9690-9694", "app.js:9461", R + "ניווט משפחתי (ALL_TABS, ROLE_DEFAULTS, FAMILY_GNAV_GROUPS)"],
    ["להשאיר אותם כקישורים חיצוניים ולעדכן את המסמך בלבד"])

add("זיהוי מוצר", "functional", "low", "הלקוח קורא ל-/api/shopping/identify-product שלא קיים",
    "app.js:2818 קורא ל-/api/shopping/identify-product; הנתיב לא קיים בשרת (מתועד גם ב-spec-family ובדוח האבטחה).",
    "להסיר את הכפתור והקריאה מהלקוח, או לממש endpoint מאומת (verifyFamilyOrBiz + handleAITokens) שמזהה מוצר מתמונה ומחזיר {name, category}.",
    ["app.js:2818", "s1-docsvscode.html#spec-family: /api/shopping/identify-product"])

add("תיעוד", "docs", "low", "FAMILY_ENV_SPEC לא תואם לקוד בשמות נתיבים ובמכונות מצבים",
    "המסמך מתאר GET /api/dashboard/family (בפועל /api/data/:userId), נתיבי budget/transactions/saved-lists אחרים, הלוואות pending→active→paid, משימות verified ונוסחת FLW לחידון בלקוח — שאינם קיימים.",
    "אחרי אישור פריטי FAM, FAMILY_ENV_SPEC מתעדכן לנתיבים, לסטטוסים הקנוניים (משימות, הלוואות, קניות) ולמודל היתרה שאושרו, ומסמך spec-family-environment (יוני 2026) מסומן כמיושן.",
    ["s1-docsvscode.html#docs/FAMILY_ENV_SPEC.md", "s1-docsvscode.html#docs/spec-biz-environment.md / spec-family-environment.md"])

json.dump(items, open("/tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/spec/dec-family.json", "w"), ensure_ascii=False, indent=1)
print(len(items))
