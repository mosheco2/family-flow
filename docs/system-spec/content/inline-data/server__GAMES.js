// source: server.js:38483
const GAMES = [
    {
      id: 'trivia-1', name: 'טריביה', file: 'games/trivia-1.html',
      desc: 'שאלות ידע כללי — מרובה-שחקנים, דירוג, ניקוד',
      mechanics: 'TIMER_SEC=15 לשאלה, QUESTIONS_PER_GAME=10, שאלות מ-trivia-questions.json (~3.2MB), QR להצטרפות מרחוק',
      screens: ['lobby','question','answer-reveal','leaderboard'],
    },
    {
      id: 'math-1', name: 'מתמטיקה', file: 'games/math-1.html',
      desc: 'חישובים אריתמטיים מותאמים גיל — הפלוס/חיסור/כפל/חילוק',
      mechanics: 'יצירה פרוצדורלית (לא JSON), EMOJIS[] לאנימציות, 3 מסכים: level-map → game → result',
      screens: ['level-map','game','result'],
    },
    {
      id: 'israel-geo-1', name: 'גיאוגרפיה ישראל', file: 'games/israel-geo-1.html',
      desc: 'מפה אינטראקטיבית — זיהוי ערים, ים, נחלים, מבצרים',
      mechanics: `CITIES: 20 ערים, LANDMARKS: 5 (כינרת, ים המלח, נגב, גולן, כרמל)`,
      screens: ['map','question','score'],
    },
    {
      id: 'hebrew-letters-1', name: 'אותיות עברית', file: 'games/hebrew-letters-1.html',
      desc: 'זיהוי ולמידת 22 אותיות האלף-בית העברי',
      mechanics: 'כרטיסיות flash, רמות: זיהוי → כתיב → מילים',
      screens: ['menu','flashcard','quiz','result'],
    },
    {
      id: 'english-alphabet-1', name: 'אנגלית ABC', file: 'games/english-alphabet-1.html',
      desc: 'זיהוי 26 אותיות אנגלית + מילים בסיסיות',
      mechanics: 'flash cards + listening (TTS), A–Z match + spelling',
      screens: ['menu','flashcard','quiz','result'],
    },
    {
      id: 'logic-puzzle-1', name: 'חידות היגיון', file: 'games/logic-puzzle-1.html',
      desc: 'פאזלים ותעלומות לחשיבה ביקורתית',
      mechanics: 'רמות קושי: קל/בינוני/קשה, רמז חד-פעמי לכל שאלה',
      screens: ['difficulty','puzzle','hint','result'],
    },
    {
      id: 'time-manager-1', name: 'ניהול זמן', file: 'games/time-manager-1.html',
      desc: 'סימולציה — סידור משימות ביום מוגבל',
      mechanics: 'drag & drop לוח שעות, bonus על יעילות, debrief סוף יום',
      screens: ['briefing','scheduler','day-sim','debrief'],
    },
    {
      id: 'finance-city-1', name: 'עיר פיננסית', file: 'games/finance-city-1.html',
      desc: 'סימולציה כלכלית — ניהול תקציב עיר',
      mechanics: 'בניית עיר, אירועים אקראיים, תקציב רבעוני, חיסכון/השקעה',
      screens: ['city-map','budget','event','report'],
    },
  ];
