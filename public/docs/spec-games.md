# אפיון משחקים חינוכיים — Games & Live Game Host
מסמך אפיון · OneFlow Life · עודכן 24.08.2026

---

## סקירה כללית

2 רכיבים:
1. **`/public/games/`** — ספריית משחקים חינוכיים עצמאיים (HTML יחיד כל אחד)
2. **`/public/game.html`** — מנחה משחק חי (Live Game Host) רב-משתתפים בזמן אמת

---

## ספריית משחקים (`/public/games/`)

| קובץ | נושא |
|---|---|
| `trivia-1.html` | טריוויה כללית |
| `math-1.html` | מתמטיקה |
| `logic-puzzle-1.html` | חידות לוגיות |
| `finance-city-1.html` | עיר פיננסית |
| `time-manager-1.html` | ניהול זמן |
| `hebrew-letters-1.html` | אותיות עברית |
| `english-alphabet-1.html` | אלפבית אנגלי |
| `israel-geo-1.html` | גאוגרפיה של ישראל |
| `trivia-questions.json` | בסיס שאלות טריוויה |

כל משחק הוא קובץ HTML עצמאי — ניתן לשחק ישירות דרך הדפדפן ללא שרת.

---

## Live Game Host — `game.html`

### ארכיטקטורה

- **שם בדפדפן:** "OneFlow Life — משחק חי"
- **עיצוב:** Tailwind CSS, Heebo, רקע כהה `#0f172a`
- **ספריות:** canvas-confetti
- **מנגנון:** polling (`pollState()`) לסנכרון סטטוס המשחק

---

### מסכי המשחק

#### `#auth-screen` — הרשמה/כניסה

**Login (`#auth-login`):**

| שדה | תיאור |
|---|---|
| `#auth-game-title` | שם המשחק |
| `#auth-game-prize` | הפרס |
| `#lg-code` | קוד משפחה/קהילה |
| `#lg-nick` | שם משתמש |
| `#lg-pass` | סיסמה |

פונקציה: `doLogin()` (שורה 368)

**Register (`#auth-register`):**

| שדה | חובה | תיאור |
|---|---|---|
| `#rg-name` | ✅ | שם פרטי |
| `#rg-family` | ✅ | שם משפחה |
| `#rg-group-name` | ✅ | שם הבית/משפחה |
| `#rg-email` | ✅ | מייל |
| `#rg-city` | ❌ | עיר |
| `#rg-phone` | ❌ | טלפון |
| `#rg-year` | ✅ | שנת לידה (1940–2015) |
| `#rg-pass` | ✅ | סיסמה (מינ' 4 תווים) |
| `#rg-tos` | ✅ | אישור תנאים |

פונקציה: `doRegister()` (שורה 384)

---

#### `#join-confirm-screen` — אישור הצטרפות

למשתמשים כבר מחוברים — מציג:
- `#confirm-game-title` — שם המשחק
- `#confirm-game-prize` — הפרס
- `#confirm-player-name` — שם השחקן

פונקציה: `confirmJoin()`

---

#### `#game-screen` — המשחק (Full-screen)

| אלמנט | תפקיד |
|---|---|
| `#g-title` | שם המשחק |
| `#g-sponsor-logo` | לוגו ספונסר |
| `#g-participants` | מספר משתתפים |
| `#g-score` | ניקוד נוכחי |
| `#screen-pending` | ממתין לאישור מנהל (animation dots) |

---

### פונקציות JavaScript

| פונקציה | שורה | תפקיד |
|---|---|---|
| `doLogin()` | 368 | כניסת שחקן |
| `doRegister()` | 384 | הרשמת שחקן חדש |
| `pollState()` | 492 | polling סטטוס משחק (interval) |
| `submitAnswer(questionId, answerIndex, btn, opts, correctIndex, timeSec)` | 613 | שליחת תשובה |
| `confirmJoin()` | - | אישור הצטרפות למשחק |

---

### אנימציות

| אנימציה | תיאור |
|---|---|
| `firework` | קונפטי זיקוקים (scale + rotate) |
| `pulse-glow` | זוהר זהב לזוכה |
| `spin-slow` | סיבוב 3 שניות |
| `slidedown` | toast מהצד |

---

### מחזור חיי משחק

```
1. שחקן נכנס (doLogin / doRegister)
2. מנהל מפעיל משחק
3. pollState() מזהה: state='active'
4. שאלות מוצגות בזו אחר זו
5. submitAnswer() שולח תשובה + זמן תגובה
6. לידרבורד מוצג בין שאלות
7. סיום: הכרזת זוכה + confetti
```

---

### API Calls (צפוי)

| Method | Endpoint | תפקיד |
|---|---|---|
| POST | `/api/game/login` | כניסת שחקן |
| POST | `/api/game/register` | הרשמה |
| POST | `/api/game/join/:gameId` | הצטרפות למשחק |
| GET | `/api/game/:gameId/state` | סטטוס נוכחי (polling) |
| POST | `/api/game/:gameId/answer` | שליחת תשובה |
| GET | `/api/game/:gameId/leaderboard` | לידרבורד |

---

### ניהול משחק (Admin)

מנהל המשחק שולט מממשק נפרד:
- הפעלה/עצירה
- מעבר בין שאלות
- הצגת לידרבורד
- הגדרת פרס + ספונסר
