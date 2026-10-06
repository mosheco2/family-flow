/**
 * seed-moti-toys.js
 * הזרמת נתוני דמו מקיפים לעסק קיים מסוג חנות קמעונאית (צעצועים) — חנות ציבורית + כל צד הניהול.
 * מבוסס על אותו דפוס בדיוק כמו scripts/seed-demo-business.js, מותאם לעסק קמעונאות:
 * 25 מוצרים (5 קטגוריות צעצועים x 5 מוצרים), עם תיאור/מאפיינים מלאים, מלאי, SKU/ברקוד,
 * וריאציות (צבע/גודל) למוצרים נבחרים, מבצעים (כולל "קנה X קבל Y"), החזרה, ספירת מלאי,
 * ועוד כל צדדי הניהול (צוות, לקוחות, הזמנות, תנועות כספיות, משימות, יומן).
 *
 * הרצה:
 *   BIZ_URL=https://weflowz.co.il BIZ_CODE=BA8D4D53 BIZ_PHONE=0526626619 BIZ_PASS=123456 \
 *     node scripts/seed-moti-toys.js
 *
 * חשוב:
 * - BIZ_PHONE הוא מספר הטלפון של משתמש ה-ADMIN (מוטי ישראלי), לא שם המשתמש —
 *   כך /api/biz/login מזהה משתמשים.
 * - group_id מספרי נפתר אוטומטית מ-group_code (BA8D4D53) דרך GET /api/storefront/:code.
 * - מגבלת הקטלוג לעסק זה נשארת כברירת המחדל של התוכנית (50 מוצרים במסלול standard) —
 *   הסקריפט מזריע 25 בדיוק מתוך ה-50, בלי מנגנון override ייעודי.
 * - הסקריפט לא הורץ מול ה-DB האמיתי (אין גישת רשת מסביבת הכתיבה) — יש להריץ בעצמכם
 *   בסביבה עם גישה, ולעבור על פלט הקונסול.
 */

const BASE_URL = process.env.BIZ_URL || 'https://weflowz.co.il';
const API = `${BASE_URL}/api`;
const GROUP_CODE = process.env.BIZ_CODE || 'BA8D4D53';
const ADMIN_NAME = process.env.BIZ_NAME || 'מוטי ישראלי';
const ADMIN_PASS = process.env.BIZ_PASS || '123456';
const ADMIN_PHONE = process.env.BIZ_PHONE || '0526626619';

let TOKEN = null;
let GROUP_ID = null;

async function api(method, path, body, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch (e) { data = { success: false, error: `non-json response (${res.status})` }; }
  return { ok: res.ok, status: res.status, data };
}

function log(ok, label, extra) {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${extra ? ' — ' + extra : ''}`);
}

// ------------------------------------------------------------------
async function resolveGroupIdAndLogin() {
  console.log(`🔎 מאתר עסק לפי קוד ${GROUP_CODE}...`);
  const lookup = await api('GET', `/storefront/${GROUP_CODE}`, undefined, false);
  if (lookup.ok && lookup.data && lookup.data.groupId) {
    GROUP_ID = lookup.data.groupId;
    console.log(`   נמצא group_id=${GROUP_ID} (${lookup.data.groupName || ''})`);
  } else {
    GROUP_ID = process.env.BIZ_GROUP_ID ? parseInt(process.env.BIZ_GROUP_ID) : null;
    if (!GROUP_ID) throw new Error(`לא הצלחתי לפתור group_id מקוד העסק (status ${lookup.status}, error: ${lookup.data?.error || 'unknown'}) — קבע BIZ_GROUP_ID (מזהה מספרי) והרץ שוב.`);
  }

  const r = await api('POST', '/biz/login', { phone: ADMIN_PHONE, password: ADMIN_PASS, groupId: GROUP_ID }, false);
  if (!r.ok || !r.data.success || !r.data.token) {
    throw new Error(`התחברות נכשלה: ${JSON.stringify(r.data)}. ודא/י ש-BIZ_PHONE, BIZ_PASS ו-group_id נכונים.`);
  }
  TOKEN = r.data.token;
  log(true, 'התחברות עסקית הצליחה', `group_id=${GROUP_ID}`);
}

// ------------------------------------------------------------------
// 1. קטלוג — 5 קטגוריות צעצועים x 5 מוצרים = 25 מוצרים, עם תיאור/מאפיינים מלאים
const CATEGORIES = {
  'תינוקות ופעוטות': [
    {
      name: 'מוביל פעילויות קוביות צבעוניות',
      price: 89.9, costPrice: 42, stock: 24, sku: 'TOY-BAB-001', barcode: '7290011122234',
      description: 'מוביל עץ עם 5 קוביות צבעוניות להתפתחות מוטורית וזיהוי צורות',
      longDescription: 'מוביל פעילות מעץ טבעי בגימור לא רעיל, מתאים מגיל 12 חודשים. כולל 5 קוביות בצבעים שונים עם חורים בצורות גיאומטריות (עיגול, ריבוע, משולש, כוכב, לב) שמתאימות לפתחים בגוף המוביל. מפתח קואורדינציה בין יד לעין, זיהוי צבעים וצורות, ומוטוריקה עדינה. כולל ידית אחיזה אורגונומית לגרירה. עמיד, קל לניקוי, ללא חלקים קטנים מסוכנים.',
      badge: 'רב מכר',
    },
    {
      name: 'שטיח פעילות לתינוק עם קשת צעצועים',
      price: 159.9, costPrice: 78, stock: 14, sku: 'TOY-BAB-002', barcode: '7290011122241',
      description: 'שטיח רך עם קשת תלויה ו-5 צעצועים תלויים, כולל נגן מוזיקה',
      longDescription: 'שטיח פעילות מרופד ורך לתינוקות מגיל לידה ועד 9 חודשים, עם קשת פלסטיק רכה הנושאת 5 צעצועים תלויים (פעמון, מראה בטיחות, בד מרשרש, טבעת כרסום ודמות בעלי חיים). כולל יחידת מוזיקה נשלפת עם 3 מנגינות הרגעה ותאורת לד עדינה. השטיח ניתן לקיפול לאחסון ולנסיעות, בד נשיף וניתן לכביסה.',
    },
    {
      name: 'סט טבעות ערימה מתכנסות',
      price: 49.9, costPrice: 19, stock: 40, sku: 'TOY-BAB-003', barcode: '7290011122258',
      description: 'סט 8 טבעות פלסטיק בגדלים וצבעים שונים לערימה',
      longDescription: 'צעצוע קלאסי להתפתחות: 8 טבעות בגדלים יורדים ובצבעי קשת, על בסיס עם ידית אחיזה. מלמד סדר גודל, זיהוי צבעים, ותיאום תנועה. עשוי פלסטיק עמיד ללא BPA, קצוות מעוגלים בטוחים לתינוקות מגיל 6 חודשים.',
    },
    {
      name: 'קוביית פעילות רב-תכליתית',
      price: 129.9, costPrice: 61, stock: 9, lowStock: 3, sku: 'TOY-BAB-004', barcode: '7290011122265',
      description: 'קובייה עם 5 צדי פעילות: גלגלי שיניים, מבוך חרוזים, שעון וטלפון',
      longDescription: 'קוביית פעילות מעץ עם חמישה צדדים שונים: גלגלי שיניים מסתובבים, מבוך חרוזים צבעוניים, שעון לימוד שעות עם מחוגים מסתובבים, חוגה מספרים, וטלפון חיוג. מפתחת מוטוריקה עדינה, חשיבה לוגית וזיהוי מספרים. מתאימה מגיל שנה וחצי, עשויה עץ מלא עם צבעים לא רעילים.',
    },
    {
      name: 'בובת כרסום סיליקון בצורת בעלי חיים',
      price: 34.9, costPrice: 12, stock: 60, sku: 'TOY-BAB-005', barcode: '7290011122272',
      description: 'סט 3 בובות כרסום רכות מסיליקון מזון, בצורות שפן, דוב וצב',
      longDescription: 'סט 3 טבעות כרסום מסיליקון ברמת מזון (Food Grade), ללא BPA, פתלטים או לטקס. מגיעות בצורות חמודות: שפן, דובון וצב, כל אחת במרקם שונה המותאם לשלבי בקיעת שיניים שונים. ניתנות לשטיפה וחיטוי בקיטור, בטיחותיות לכניסה לפה. מומלצות מגיל 3 חודשים.',
      badge: 'חדש',
    },
  ],
  'משחקי קופסה ולוח': [
    {
      name: 'דומינו חיות אפריקה מאוירות',
      price: 44.9, costPrice: 18, stock: 22, sku: 'TOY-BRD-001', barcode: '7290011123231',
      description: 'סט דומינו 28 קלפים עם איורי חיות אפריקה צבעוניים',
      longDescription: 'משחק דומינו קלאסי בעיבוד ילדים עם איורי חיות אפריקה (אריה, ג׳ירפה, פיל, זברה ועוד) במקום מספרים — מתאים לילדים שעדיין לא מזהים ספרות. מפתח חשיבה אסטרטגית, זיהוי דפוסים והתאמה. כולל 28 קלפי קרטון עבה ועמיד, בקופסת אחסון עם מכסה.',
    },
    {
      name: 'משחק זיכרון קלפים "בעלי מקצוע"',
      price: 39.9, costPrice: 15, stock: 30, sku: 'TOY-BRD-002', barcode: '7290011123248',
      description: '36 קלפי זיכרון (18 זוגות) בנושא מקצועות ותעסוקות',
      longDescription: 'משחק זיכרון קלאסי עם 18 זוגות קלפים (36 קלפים בסך הכל) המציגים בעלי מקצוע שונים: רופא, כבאי, שוטרת, טבחית, מורה ועוד — חושף ילדים לעולם המקצועות תוך פיתוח זיכרון חזותי וריכוז. קלפים מצופים למניעת שריטות, מתאים מגיל 4.',
    },
    {
      name: 'פאזל רצפה ענק — מפת ישראל',
      price: 69.9, costPrice: 29, stock: 17, sku: 'TOY-BRD-003', barcode: '7290011123255',
      description: 'פאזל רצפה 48 חלקים בגודל 100x70 ס״מ, מפת ישראל עם ערים וסמלים',
      longDescription: 'פאזל רצפה ענק מקרטון עבה במיוחד (5 מ"מ) בגודל מורכב 100x70 ס"מ, מציג את מפת ישראל עם סימון ערים מרכזיות, נחלים, ואייקונים של אתרים ידועים. מחולק ל-48 חלקים בגודל נוח לאחיזה. מפתח אוריינות גיאוגרפית, חשיבה מרחבית וסבלנות. מגיל 5 ומעלה.',
      badge: 'מבצע',
    },
    {
      name: 'משחק קלפים "התפסן" — משפחתי',
      price: 29.9, costPrice: 11, stock: 35, sku: 'TOY-BRD-004', barcode: '7290011123262',
      description: 'משחק תגובה מהירה ל-2-6 שחקנים, קלפי סמלים וקריאת "תפוס!"',
      longDescription: 'משחק קלפים דינמי ומצחיק למשפחה כולה: חושפים קלפים בתורות, ומי שמזהה ראשון שני סמלים זהים בין שני הקלפים העליונים צועק "תפוס!" וחוטף את הערימה. מפתח מהירות תגובה, ריכוז ואבחנה חזותית. 2-6 שחקנים, מגיל 6, משחק קצר (10-15 דקות).',
    },
    {
      name: 'שש-בש ושחמט מעץ מתקפל',
      price: 99.9, costPrice: 47, stock: 11, sku: 'TOY-BRD-005', barcode: '7290011123279',
      description: 'לוח עץ דו-צדדי מתקפל: שש-בש מצד אחד, שחמט מהצד השני',
      longDescription: 'סט משחקי קלאסיקה 2-ב-1: לוח עץ איכותי המתקפל כמו ספר — צד אחד מודפס כלוח שש-בש עם חישובי קוביות וכלים, הצד השני כלוח שחמט 32X32 מ"מ. כולל את כל הכלים הדרושים (אבני שש-בש, קוביות, וכלי שחמט) המאוחסנים בתוך הקופסה המתקפלת. מתאים מגיל 8 ולמבוגרים כאחד.',
    },
  ],
  'בובות ודמויות אקשן': [
    {
      name: 'דמות אקשן "גיבור העל הכחול" 30 ס״מ',
      price: 79.9, costPrice: 34, stock: 20, sku: 'TOY-ACT-001', barcode: '7290011124238',
      description: 'דמות אקשן מפרקית בגובה 30 ס״מ עם 8 נקודות תנועה ואביזר נשק',
      longDescription: 'דמות אקשן מפורטת בגובה 30 ס"מ עם 8 נקודות מפרק (ידיים, רגליים, ראש, מותניים) המאפשרות תנוחות דינמיות. כוללת אביזר נשק נשלף ובסיס תצוגה. עשויה פלסטיק ABS עמיד זעזועים, צבעים לא דוהים. מתאימה למשחק דמיוני ולאיסוף. מגיל 5 ומעלה.',
      variants: [
        { name: 'כחול קלאסי', attrs: { color: 'כחול' }, stock: 8 },
        { name: 'אדום להבה', attrs: { color: 'אדום' }, stock: 7 },
        { name: 'ירוק קרב', attrs: { color: 'ירוק' }, stock: 5 },
      ],
    },
    {
      name: 'בובת תינוקת מדברת עם אביזרים',
      price: 149.9, costPrice: 71, stock: 8, lowStock: 3, sku: 'TOY-ACT-002', barcode: '7290011124245',
      description: 'בובה אינטראקטיבית 40 ס״מ, אומרת 12 משפטים, כוללת בקבוק ומוצץ',
      longDescription: 'בובת תינוקת אינטראקטיבית בגובה 40 ס"מ עם חיישן מגע הגורם לה לומר 12 משפטים שונים בעברית ("אמא", "אני רעבה", צחוק וכו׳). עיניים נעצמות בשכיבה. כוללת בקבוק האכלה, מוצץ ושמיכה רכה. גוף רך מבד, ראש וגפיים ויניל רך. דורשת 3 סוללות AA (לא כלולות). מגיל 3.',
      badge: 'רב מכר',
    },
    {
      name: 'סט דינוזאורים ריאליסטיים (6 יח׳)',
      price: 59.9, costPrice: 24, stock: 26, sku: 'TOY-ACT-003', barcode: '7290011124252',
      description: 'סט 6 פיגורות דינוזאורים בגדלים שונים עם כרטיסי מידע',
      longDescription: 'אוסף 6 פיגורות דינוזאורים ריאליסטיות (טי-רקס, טריצרטופס, סטגוזאורוס, ברכיוזאורוס, ולוצירפטור וספינוזאורוס) בגימור צבע מפורט ומרקם עור. כולל 6 כרטיסי מידע עם עובדות מרתקות על כל דינוזאור, לשילוב משחק ולמידה. פלסטיק עמיד, ללא קצוות חדים. מגיל 4.',
    },
    {
      name: 'ערכת תחפושת סופרגיבור + גלימה',
      price: 89.9, costPrice: 38, stock: 15, sku: 'TOY-ACT-004', barcode: '7290011124269',
      description: 'ערכת תחפושת מלאה: גלימה, מסכה, חגורה ואצעדות',
      longDescription: 'ערכת תחפושת סופרגיבור מלאה הכוללת גלימת סאטן בוהקת עם סמל רקום, מסכת עיניים, חגורה עם אבזם סמל, וזוג אצעדות יד תואמות. בד נעים ונושם, מידה אוניברסלית (3-8 שנים) עם סקוטש מתכוונן. מתאימה למשחק דמיוני יומיומי ולמסיבות תחפושות.',
    },
    {
      name: 'רובוט טרנספורמר הפיך לרכב',
      price: 119.9, costPrice: 54, stock: 13, sku: 'TOY-ACT-005', barcode: '7290011124276',
      description: 'דמות רובוט 20 ס״מ ההופכת למכונית מרוץ ב-15 תזוזות',
      longDescription: 'דמות טרנספורמר מורכבת בגובה 20 ס"מ במצב רובוט, ההופכת למכונית מרוץ אדומה מלאה ב-15 שלבי קיפול/הפיכה. עשויה פלסטיק קשיח איכותי עם מפרקים חזקים שלא נשברים בשימוש חוזר. כוללת חוברת הדרכה מצוירת. מפתחת חשיבה מרחבית וסבלנות. מגיל 6 ומעלה.',
    },
  ],
  'צעצועי בנייה והרכבה': [
    {
      name: 'ערכת קוביות בנייה קלאסית 500 חלקים',
      price: 149.9, costPrice: 68, stock: 18, sku: 'TOY-BLD-001', barcode: '7290011125235',
      description: 'ארגז 500 קוביות בנייה תואמות מידה סטנדרטית, 6 צבעים',
      longDescription: 'ערכת קוביות בנייה בסיסית עם 500 חלקים בגדלים ובצבעים מגוונים (אדום, כחול, צהוב, ירוק, לבן, כתום), תואמת מידה לרוב מערכות הבנייה הסטנדרטיות בשוק. מגיעה בארגז אחסון פלסטיק עם מכסה ותא מיון. מפתחת יצירתיות, חשיבה מרחבית ומוטוריקה עדינה. מגיל 4 ומעלה.',
      variants: [
        { name: 'ארגז 500 חלקים', attrs: { size: '500 חלקים' }, stock: 10 },
        { name: 'ארגז 1000 חלקים', attrs: { size: '1000 חלקים' }, stock: 8, priceOverride: 249.9 },
      ],
    },
    {
      name: 'סט מסילת רכבת עץ עם רכבת חשמלית',
      price: 199.9, costPrice: 92, stock: 7, lowStock: 2, sku: 'TOY-BLD-002', barcode: '7290011125242',
      description: 'מסילת עץ 90 חלקים כולל רכבת הנעה בסוללות, גשר ותחנה',
      longDescription: 'סט מסילת רכבת מעץ מלא עם 90 חלקי מסילה בעיצובים שונים (עקומות, הסתעפויות, גשר מוגבה, מנהרה), תחנת רכבת מעוצבת, ורכבת קטר הנעה חשמלית בסוללות עם תאורת חזית. תואם למותגי מסילות עץ מובילים בשוק. מפתח חשיבה הנדסית ותכנון מרחבי. מגיל 3 ומעלה.',
      badge: 'חדש',
    },
    {
      name: 'ערכת מגנטים גיאומטריים לבנייה תלת-ממדית',
      price: 179.9, costPrice: 84, stock: 10, sku: 'TOY-BLD-003', barcode: '7290011125259',
      description: '60 אריחים מגנטיים (משולשים וריבועים) לבניית מבנים תלת-ממדיים',
      longDescription: 'ערכת בנייה מגנטית חדשנית עם 60 אריחים גיאומטריים (משולשים, ריבועים ומלבנים) במגנטים חזקים בקצוות, מאפשרת בניית מבנים תלת-ממדיים, בתים, רכבים וצורות מופשטות. צבעים שקופים וזוהרים. מפתחת חשיבה STEM, הבנה גיאומטרית ויצירתיות ללא גבול. מגיל 5 ומעלה.',
    },
    {
      name: 'ערכת רובוטיקה לילדים עם מנוע ושלט',
      price: 249.9, costPrice: 118, stock: 6, lowStock: 2, sku: 'TOY-BLD-004', barcode: '7290011125266',
      description: 'ערכת הרכבה STEM לרובוט נשלט, מנוע חשמלי וחיישן מכשולים',
      longDescription: 'ערכת רובוטיקה חינוכית להרכבה עצמית הכוללת כ-150 חלקי פלסטיק, מנוע חשמלי קטן, חיישן מכשולים אולטרה-סוני, ושלט רחוק אינפרא-אדום. לאחר ההרכבה (לפי חוברת הדרכה שלב-אחר-שלב) הרובוט נע קדימה/אחורה ונמנע ממכשולים אוטומטית. מקדמת לימוד STEM מעשי. מגיל 8 ומעלה.',
    },
    {
      name: 'ערכת בניית בית עץ עם רהיטים (לבובות)',
      price: 219.9, costPrice: 103, stock: 9, sku: 'TOY-BLD-005', barcode: '7290011125273',
      description: 'בית בובות עץ תלת-קומתי עם 25 פריטי ריהוט ואביזרים',
      longDescription: 'בית בובות מעץ בעל 3 קומות וגג נשלף לגישה נוחה, בגודל 60x30x55 ס"מ, כולל 25 פריטי ריהוט ואביזרים (מיטה, שולחן, כיסאות, מטבח, אמבטיה ועוד) בקנה מידה תואם. מפתח משחק דמיוני, מיומנויות חברתיות וסידור מרחבי. מגיל 3 ומעלה, הרכבה פשוטה עם ברגים מצורפים.',
    },
  ],
  'צעצועי חוץ וספורט': [
    {
      name: 'קורקינט ילדים 3 גלגלים עם אור LED',
      price: 189.9, costPrice: 89, stock: 12, sku: 'TOY-OUT-001', barcode: '7290011126232',
      description: 'קורקינט יציב תלת-גלגלי עם גלגלי LED מוארים וכידון מתכוונן',
      longDescription: 'קורקינט 3 גלגלים יציב במיוחד לילדים מגיל 3-7, עם גלגלי פוליאורתן הכוללים תאורת LED הנדלקת מתנועה (ללא סוללות). כידון בגובה מתכוונן (3 מצבים) להתאמה לגדילת הילד. פלטפורמה רחבה עם משטח אנטי-החלקה ובלם אחורי. גוף אלומיניום קל משקל, מתקפל לאחסון קל. תומך עד 50 ק"ג.',
      variants: [
        { name: 'ורוד', attrs: { color: 'ורוד' }, stock: 4 },
        { name: 'כחול', attrs: { color: 'כחול' }, stock: 5 },
        { name: 'סגול', attrs: { color: 'סגול' }, stock: 3 },
      ],
      badge: 'רב מכר',
    },
    {
      name: 'סט כדורי ספורט (כדורגל, כדורסל, כדוריד)',
      price: 99.9, costPrice: 41, stock: 20, unitType: 'piece', sku: 'TOY-OUT-002', barcode: '7290011126249',
      description: 'סט 3 כדורים בגדלים מותאמים לילדים, כולל משאבת יד',
      longDescription: 'סט 3 כדורי ספורט בגימור מקצועי מוקטן בגודל המותאם לילדים: כדורגל מידה 3, כדורסל מידה 5, וכדוריד מידה 1. עשויים גומי PVC עמיד הניתן לניפוח. כוללים משאבת יד קטנה ומחט ניפוח נוספת. אידיאליים למשחק בחצר, בגינה או בחוף.',
    },
    {
      name: 'אוהל משחק פופ-אפ לילדים עם מנהרה',
      price: 139.9, costPrice: 62, stock: 15, sku: 'TOY-OUT-003', barcode: '7290011126256',
      description: 'אוהל פתיחה עצמית בצורת בית עם מנהרת חיבור ו-2 אוהלי קצה',
      longDescription: 'סט משחק הכולל 2 אוהלי פופ-אפ בצורת בית (פתיחה אוטומטית בתנועת סיבוב) המחוברים במנהרת זחילה אורכית. בד פוליאסטר קל ועמיד עם רשתות אוורור ופתחי כניסה מרובים. מתקפל לדיסקית דקה לאחסון נוח. מתאים לפנים הבית ולחצר כאחד. מגיל שנה וחצי ומעלה.',
    },
    {
      name: 'טרמפולינה קפיצה ביתית עם רשת בטיחות',
      price: 349.9, costPrice: 168, stock: 5, lowStock: 2, sku: 'TOY-OUT-004', barcode: '7290011126263',
      description: 'טרמפולינה קוטר 140 ס״מ עם רשת הגנה מלאה, לפנים/חוץ',
      longDescription: 'טרמפולינה ביתית בקוטר 140 ס"מ עם מסגרת פלדה מצופה, בד קפיצה עמיד ו-48 קפיצי פלדה איכות. כוללת רשת הגנה היקפית בגובה 120 ס"מ עם רוכסן כניסה, ורפידות הגנה על המסגרת. עומס מקסימלי 50 ק"ג. מתאימה להצבה בחצר או בחלל פנים גדול. דורשת הרכבה (כלים כלולים).',
    },
    {
      name: 'אופני איזון לפעוטות (ללא פדלים)',
      price: 229.9, costPrice: 107, stock: 8, sku: 'TOY-OUT-005', barcode: '7290011126270',
      description: 'אופני איזון קלילים לגיל 2-5, גלגלי EVA, מושב מתכוונן',
      longDescription: 'אופני איזון (Balance Bike) ללא פדלים, מתאימים לפעוטות בגיל 2-5 ללמידת שיווי משקל לפני מעבר לאופניים רגילים. מסגרת אלומיניום קלת משקל (כ-3 ק"ג בלבד), גלגלי קצף EVA שלא מתנפחים, מושב וכידון מתכווננים בגובה לגדילת הילד. בלם יד אחורי לדגמים הגדולים. תומך עד 25 ק"ג.',
      variants: [
        { name: 'אדום', attrs: { color: 'אדום' }, stock: 4 },
        { name: 'ירוק', attrs: { color: 'ירוק' }, stock: 4 },
      ],
    },
  ],
};

let catalogIds = []; // [{id, name, category}]

async function seedCatalog() {
  console.log('\n📦 קטלוג — 5 קטגוריות צעצועים x 5 מוצרים (25 בסה"כ)');
  for (const [category, items] of Object.entries(CATEGORIES)) {
    for (const p of items) {
      const r = await api('POST', '/store/catalog', {
        name: p.name, description: p.description, longDescription: p.longDescription,
        price: p.price, category, productType: 'retail',
        unitType: p.unitType || 'piece', sku: p.sku, barcode: p.barcode,
        costPrice: p.costPrice, stockQuantity: p.stock,
        lowStockThreshold: p.lowStock || Math.max(2, Math.round(p.stock * 0.15)),
        trackInventory: true, badgeText: p.badge || null, badgeColor: p.badge === 'מבצע' ? 'red' : 'blue',
      });
      log(r.ok && r.data.success !== false, `מוצר [${category}]: ${p.name}`, r.ok ? '' : JSON.stringify(r.data));
      if (r.ok && r.data.item) {
        catalogIds.push({ id: r.data.item.id, name: p.name, category, price: p.price, variants: p.variants || null });
      }
    }
  }
  console.log(`   סה"כ נוצרו ${catalogIds.length} מוצרים`);
}

// ------------------------------------------------------------------
// 1.5 וריאציות (צבע/גודל) למוצרים שהוגדרו עם variants
async function seedVariants() {
  console.log('\n🎨 וריאציות מוצר (צבע/גודל)');
  const withVariants = catalogIds.filter(c => c.variants);
  for (const c of withVariants) {
    for (const v of c.variants) {
      const r = await api('POST', `/biz/retail/variants/${c.id}`, {
        variantName: v.name, attributes: v.attrs, stockQuantity: v.stock,
        priceOverride: v.priceOverride || null,
      });
      log(r.ok && r.data.success !== false, `וריאציה: ${c.name} — ${v.name}`, r.ok ? '' : JSON.stringify(r.data));
    }
  }
}

// ------------------------------------------------------------------
// 2. מבצעים + קופון — כולל "קנה X קבל Y"
async function seedPromotionsAndCoupons() {
  console.log('\n🎟️  מבצעים וקופונים');
  const buildingSet = catalogIds.find(c => c.category === 'צעצועי בנייה והרכבה');
  const promos = [
    { title: '15% הנחה על כל קטגוריית תינוקות ופעוטות', promoType: 'percent', promoValue: 15, targetType: 'category', targetIds: ['תינוקות ופעוטות'], showInBanner: true },
    buildingSet ? { title: 'קנה 2 קבל 1 — ערכות בנייה', promoType: 'buy_x_get_y', buyQty: 2, getQty: 1, targetType: 'product', targetIds: [buildingSet.id], showInBanner: true } : null,
  ].filter(Boolean);
  for (const p of promos) {
    const r = await api('POST', '/store/promotions', { groupId: GROUP_ID, ...p }, false);
    log(r.ok && r.data.success !== false, `מבצע: ${p.title}`, r.ok ? '' : JSON.stringify(r.data));
  }
  const r = await api('POST', '/store/coupons', { groupId: GROUP_ID, code: 'MOTI10', discountPct: 10 }, false);
  log(r.ok && r.data.success !== false, 'קופון: MOTI10', r.ok ? '' : JSON.stringify(r.data));
}

// ------------------------------------------------------------------
// 3. הגדרות חנות
async function seedStoreSettings() {
  console.log('\n🏪 הגדרות חנות');
  const r = await api('POST', '/store/settings', {
    groupId: GROUP_ID,
    isActive: true,
    welcomeMessage: 'ברוכים הבאים לצעצועי מוטי — הצעצוע הנכון לכל גיל ולכל אירוע',
    slogan: 'משחקים. לומדים. מחייכים.',
    openTime: '09:00',
    closeTime: '19:00',
    whatsappNumber: ADMIN_PHONE,
    deliveryFee: 25,
    freeDeliveryAbove: 200,
  }, false);
  log(r.ok && r.data.success !== false, 'עדכון הגדרות חנות', r.ok ? '' : JSON.stringify(r.data));
}

// ------------------------------------------------------------------
// 4. צוות — עובדים (מוכרת + מלאי)
const TEAM = [
  { nickname: 'שירה מוכרת', firstName: 'שירה', lastName: 'אזולאי', phone: '0500000301', email: 'shira.sale@example.com', employee_role_type: 'sales' },
  { nickname: 'דני מלאי', firstName: 'דני', lastName: 'פרץ', phone: '0500000302', email: 'dani.stock@example.com', employee_role_type: 'warehouse' },
];
let teamUserIds = {};

async function seedTeam() {
  console.log('\n👷 צוות — עובדים');
  for (const t of TEAM) {
    const joinRes = await api('POST', '/join', {
      groupCode: GROUP_CODE, nickname: t.nickname, firstName: t.firstName, lastName: t.lastName,
      phone: t.phone, email: t.email, password: '123456', role: 'MEMBER', employee_role_type: t.employee_role_type,
    }, false);
    log(joinRes.ok && joinRes.data.error === undefined, `בקשת הצטרפות: ${t.nickname}`, joinRes.ok ? '' : JSON.stringify(joinRes.data));

    const pendingRes = await api('GET', `/admin/pending-users?groupId=${GROUP_ID}`, undefined, false);
    const pendingList = Array.isArray(pendingRes.data) ? pendingRes.data : [];
    const match = pendingList.find(u => u.nickname === t.nickname);
    if (match) {
      const approveRes = await api('POST', '/admin/approve-user', { userId: match.id }, false);
      log(approveRes.ok && approveRes.data.success !== false, `אישור עובד: ${t.nickname}`, approveRes.ok ? '' : JSON.stringify(approveRes.data));
      teamUserIds[t.nickname] = match.id;
    } else {
      log(false, `אישור עובד: ${t.nickname}`, 'לא נמצא ברשימת הממתינים לאישור (ייתכן שכבר קיים משתמש עם אותו טלפון)');
    }
  }
}

// ------------------------------------------------------------------
// 5. לקוחות
const CUSTOMERS = [
  { name: 'מיכל שלומי', phone: '0521112200', email: 'michal@example.com', notes: 'קונה קבועה, שני ילדים קטנים' },
  { name: 'אבי רוזן', phone: '0522223301', email: 'avi.rozen@example.com', notes: 'הזמין מתנת יום הולדת' },
  { name: 'גן ילדים "ניצנים"', phone: '0523334402', email: 'ganim.nitzanim@example.com', notes: 'לקוח עסקי — רוכש ציוד לגן' },
];
let customerIds = [];

async function seedCustomers() {
  console.log('\n👥 לקוחות');
  for (const c of CUSTOMERS) {
    const r = await api('POST', '/store/customers', { groupId: GROUP_ID, ...c, adminName: ADMIN_NAME }, false);
    log(r.ok && r.data.success !== false, `לקוח: ${c.name}`, r.ok ? '' : JSON.stringify(r.data));
    if (r.ok && r.data.customer) customerIds.push(r.data.customer.id);
  }
}

// ------------------------------------------------------------------
// 6. הזמנות — מגוון: משלוח, איסוף עצמי, עם וריאציה
async function seedOrders() {
  console.log('\n🛒 הזמנות');
  const babyToy = catalogIds.find(c => c.category === 'תינוקות ופעוטות');
  const scooter = catalogIds.find(c => c.name.includes('קורקינט'));
  const boardGame = catalogIds.find(c => c.category === 'משחקי קופסה ולוח');
  const orders = [
    babyToy ? { customerName: 'מיכל שלומי', customerPhone: '0521112200', items: [{ catalogId: babyToy.id, name: babyToy.name, price: babyToy.price, quantity: 1 }], totalAmount: babyToy.price + 25, isDelivery: true, deliveryFee: 25, deliveryDetails: { city: 'ראשון לציון', street: 'הרצל', house: '12' }, notes: 'נא לדפוק בדלת, התינוק ישן' } : null,
    scooter ? { customerName: 'אבי רוזן', customerPhone: '0522223301', items: [{ catalogId: scooter.id, name: scooter.name, price: scooter.price, quantity: 1 }], totalAmount: scooter.price, isDelivery: false, notes: 'איסוף עצמי בסוף השבוע' } : null,
    boardGame ? { customerName: 'גן ילדים "ניצנים"', customerPhone: '0523334402', items: [{ catalogId: boardGame.id, name: boardGame.name, price: boardGame.price, quantity: 5 }], totalAmount: boardGame.price * 5, isDelivery: true, deliveryFee: 0, deliveryDetails: { city: 'ראשון לציון', street: 'ויצמן', house: '40' }, notes: 'חשבונית עסק - גן ילדים' } : null,
  ].filter(Boolean);
  for (const o of orders) {
    const r = await api('POST', '/store/orders', { groupId: GROUP_ID, familyGroupId: null, orderSource: 'website', ...o }, false);
    log(r.ok && r.data.success !== false, `הזמנה: ${o.customerName}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 7. תנועות פיננסיות
async function seedTransactions() {
  console.log('\n💰 תנועות פיננסיות');
  const txs = [
    { amount: 480, description: 'מכירה — גן ילדים ניצנים (5 משחקי קופסה)', category: 'sales', type: 'income' },
    { amount: 189.9, description: 'מכירה — קורקינט 3 גלגלים (אבי רוזן)', category: 'sales', type: 'income' },
    { amount: 3200, description: 'רכישת מלאי מספק — אצווה חדשה של צעצועי בנייה', category: 'supplies', type: 'expense' },
    { amount: 450, description: 'עיצוב ויטרינת חלון ראווה לחג', category: 'marketing', type: 'expense' },
  ];
  for (const t of txs) {
    const r = await api('POST', '/transaction', { groupId: GROUP_ID, ...t }, false);
    log(r.ok && r.data.success !== false, `תנועה: ${t.description}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 8. משימות
async function seedTasks() {
  console.log('\n✅ משימות');
  const sellerId = teamUserIds['שירה מוכרת'] || null;
  const stockId = teamUserIds['דני מלאי'] || null;
  const tasks = [
    { title: 'לספור מלאי קטגוריית תינוקות ופעוטות', priority: 'medium', requireAiCheck: false, assignedTo: stockId || undefined },
    { title: 'להזמין אצווה נוספת של אופני איזון', priority: 'high', requireAiCheck: false, assignedTo: stockId || undefined },
    { title: 'לעדכן ויטרינה לקראת סוף שבוע', priority: 'low', requireAiCheck: false, assignedTo: sellerId || undefined },
  ];
  for (const t of tasks) {
    const r = await api('POST', '/tasks', t);
    log(r.ok && r.data.success !== false, `משימה: ${t.title}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 9. יומן
async function seedCalendar() {
  console.log('\n📅 יומן');
  const today = new Date();
  const inDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const events = [
    { title: 'הגעת משלוח ספק — צעצועי בנייה', eventDate: inDays(2), startTime: '10:00', notes: 'לבדוק כמויות מול חשבונית' },
    { title: 'אירוע הדגמת מוצרים בחנות', eventDate: inDays(5), startTime: '16:00', notes: 'הדגמת רובוטיקה וקורקינטים' },
  ];
  for (const e of events) {
    const r = await api('POST', '/calendar/events', { groupId: GROUP_ID, ...e }, false);
    log(r.ok && r.data.success !== false, `אירוע יומן: ${e.title}`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
// 10. ספק + הזמנת רכש
async function seedSupplierAndProcurement() {
  console.log('\n🧾 ספק והזמנת רכש');
  const r = await api('POST', '/suppliers', { groupId: GROUP_ID, name: 'יבואני צעצוע בע"מ', category: 'צעצועים', phone: '0509998877' }, false);
  log(r.ok && r.data.success !== false, 'ספק: יבואני צעצוע בע"מ', r.ok ? '' : JSON.stringify(r.data));
}

// ------------------------------------------------------------------
// 11. החזרה (retail) — מדגים זיכוי + restock
async function seedReturn() {
  console.log('\n↩️  החזרה (retail)');
  const babyToy = catalogIds.find(c => c.category === 'תינוקות ופעוטות');
  if (!babyToy) { console.log('   ⚠️  אין מוצר מתאים — מדלג'); return; }
  const r = await api('POST', '/biz/retail/returns', {
    items: [{ catalogId: babyToy.id, qty: 1, unitPrice: babyToy.price }],
    refundMethod: 'store_credit', reason: 'הלקוחה שינתה דעתה', restock: true, customerPhone: '0521112200',
  });
  log(r.ok && r.data.success !== false, `החזרה: ${babyToy.name} — זיכוי לקוחה`, r.ok ? '' : JSON.stringify(r.data));
}

// ------------------------------------------------------------------
// 12. התאמת מלאי ידנית + ספירת מלאי תקופתית
async function seedInventoryOps() {
  console.log('\n📊 מלאי — התאמה ידנית + ספירה תקופתית');
  const scooter = catalogIds.find(c => c.name.includes('קורקינט'));
  if (scooter) {
    const r = await api('POST', `/biz/retail/inventory/${scooter.id}/adjust`, { changeQty: -1, note: 'פגם קל שהתגלה בבדיקת איכות' });
    log(r.ok && r.data.success !== false, `התאמת מלאי: ${scooter.name} (-1, פגם)`, r.ok ? '' : JSON.stringify(r.data));
  }
  // ספירה תקופתית על 3 מוצרים ראשונים — מדמה פער קטן שמתגלה ומיושר
  const sample = catalogIds.slice(0, 3);
  if (sample.length) {
    const items = sample.map((c, i) => ({ catalogId: c.id, countedQty: Math.max(0, (CATEGORIES['תינוקות ופעוטות'][i]?.stock || 10) - (i === 0 ? 1 : 0)) }));
    const r = await api('POST', '/biz/retail/stock-counts', { items });
    log(r.ok && r.data.success !== false, `ספירת מלאי תקופתית (${sample.length} מוצרים)`, r.ok ? '' : JSON.stringify(r.data));
  }
}

// ------------------------------------------------------------------
async function main() {
  console.log('🚀 מתחיל הזרמת נתוני דמו מקיפים — צעצועי מוטי (חנות קמעונאית)...\n');
  try {
    await resolveGroupIdAndLogin();
    await seedStoreSettings();
    await seedCatalog();
    await seedVariants();
    await seedPromotionsAndCoupons();
    await seedTeam();
    await seedCustomers();
    await seedOrders();
    await seedTransactions();
    await seedTasks();
    await seedCalendar();
    await seedSupplierAndProcurement();
    await seedReturn();
    await seedInventoryOps();
    console.log('\n✅ הושלם! "צעצועי מוטי" מלא כעת ב-25 מוצרים (5 קטגוריות x 5), עם וריאציות, מבצעים, צוות, לקוחות, הזמנות ועוד — בכל תחומי הניהול והחנות הציבורית.');
  } catch (e) {
    console.error('\n❌ שגיאה:', e.message);
    process.exit(1);
  }
}

main();
