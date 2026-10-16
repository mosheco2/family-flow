// source: server.js:40465
const KH_THREAT_PATTERNS = [
    {
        key: 'script',
        re: /<script[\s>/]/i,
        badge: '🔴 סקריפט מוטמע',
        explanation: 'קוד שירוץ בדפדפן של כל מי שקורא את הכתבה — יכול לגנוב פרטי משתמשים או להשתלט על החשבון',
    },
    {
        key: 'handler',
        re: /\bon[a-z]{2,}\s*=/i,
        badge: '🔴 event handler',
        explanation: 'פקודה שמופעלת אוטומטית בתגובה לאירוע (טעינה, שגיאה, לחיצה) — דרך נפוצה להסתיר קוד זדוני',
    },
    {
        key: 'javascript_uri',
        re: /javascript\s*:/i,
        badge: '🔴 קישור javascript:',
        explanation: 'קישור שמריץ קוד במקום להוביל לאתר — יכול לבצע פעולות בשם המשתמש בלי ידיעתו',
    },
    {
        key: 'iframe',
        re: /<iframe[\s>/]/i,
        badge: '🟠 iframe מוטמע',
        explanation: 'מסגרת שמטמיעה אתר חיצוני בתוך הכתבה — יכולה להציג תוכן מזויף או לגנוב פרטי כניסה',
    },
    {
        key: 'other',
        re: /<(object|embed|form|input|link|meta|base)[\s>/]/i,
        badge: '🟡 תגית לא מורשית',
        explanation: 'תגית HTML שאינה ברשימה המאושרת — אינה אמורה להופיע בתוכן שנכתב דרך העורך',
    },
];
