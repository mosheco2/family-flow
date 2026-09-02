# סקיל: יישום סוג עסק — גשר לקוח↔עסק

## מתי להשתמש
כשמוסיפים **סוג עסק חדש** (business type) למערכת family-flow, או מרחיבים סוג קיים.
הסקיל מגדיר את הארכיטקטורה הסטנדרטית שכל סוג עסק חייב לממש — צד עסק + צד לקוח + שרת.

---

## ארכיטקטורה — 3 שכבות

```
server.js          — API routes עם prefix /api/<type>/
business-app.js    — ממשק ניהול (מודאל ספורט-סטייל)
sc-auth.js         — ממשק לקוח (IIFE, vanilla JS, inline styles)
```

---

## 1. שרת (server.js)

### טבלאות בסיס לכל סוג עסק
```sql
-- לקוחות / חברים
CREATE TABLE <type>_customers (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT DEFAULT 'active',  -- active, vip, blocked
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- היסטוריית ביקורים / ביצועים
CREATE TABLE <type>_visits (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL,
  customer_id INT REFERENCES <type>_customers(id),
  customer_name TEXT,
  visited_at TIMESTAMP DEFAULT NOW(),
  checked_out_at TIMESTAMP,   -- לתיחום זמן
  notes TEXT
);
```

### Routes חובה
```
GET    /api/<type>/dashboard/:groupId     — KPIs + סטטיסטיקות
GET    /api/<type>/customers/:groupId     — רשימת לקוחות
POST   /api/<type>/customers              — הוספת לקוח
GET    /api/<type>/customer/:id           — פרטי לקוח + היסטוריה
POST   /api/<type>/visit                  — רישום ביקור/צ'ק-אין
DELETE /api/<type>/visit/:id             — ביטול ביקור (מחזיר מכסות)
POST   /api/<type>/visit/:id/checkout    — תיחום זמן יציאה
GET    /api/<type>/visits/:groupId       — ביקורי היום
POST   /api/<type>/self-visit            — צ'ק-אין עצמי ע"י לקוח (phone)
GET    /api/<type>/alerts/:groupId       — התראות: פגי תוקף, רדומים, קפואים
```

### Route לאקטיביטי לקוח (sc-auth activity)
```js
// ב-GET /api/sc-auth/activity/:bizGroupId — להוסיף לPromise.all:
pool.query(
  `SELECT v.id, v.visited_at, v.checked_out_at
   FROM <type>_visits v
   JOIN <type>_customers c ON c.id = v.customer_id
   WHERE v.group_id=$1 AND c.customer_phone=$2
   ORDER BY v.visited_at DESC`,
  [bizId, phone]
).then(r => r.rows).catch(() => [])
// ולהוסיף visits לתשובה: res.json({ ..., visits, businessType })
```

### כלל ביטול ביקור — תמיד לחשב
```js
// ביטול ← בדוק אם יש מכסה ← החזר יחידה
const hasQuota = customer.quota_total !== null;
await pool.query('DELETE FROM <type>_visits WHERE id=$1', [id]);
if (hasQuota) await pool.query(
  'UPDATE <type>_customers SET quota_used=GREATEST(quota_used-1,0) WHERE id=$1', [customerId]
);
```

---

## 2. ממשק ניהול (business-app.js)

### דשבורד — renderXxxDashboard(el)
```js
async function render<Type>Dashboard(el) {
  // 1. fetch stats + alerts בParallel
  const [stats, alerts] = await Promise.all([...]);

  // 2. KPI grid — 6 כרטיסים
  const kpis = [
    { label:'...', value:stats.x, icon:'🏃', color:'indigo', cb:`window.show<Type>Xxx()` },
    // ...
  ];

  // 3. Quick actions grid (roleQuickActions)
  // 4. alertBanner אם יש התראות דחופות
  el.innerHTML = `${alertBanner}${kpiHtml}${quickActions}`;
}
```

### KPIs סטנדרטיים
| label | מה בודק | color |
|-------|---------|-------|
| לקוחות פעילים | status='active' | indigo |
| היום | count today | emerald |
| בפנים כרגע | visited_at today + no checkout | red |
| רדומים | no visit 30 days | orange (if >0) |
| הכנסה החודש | SUM revenue this month | emerald |
| פגי תוקף | expiring in 14 days | orange (if >0) |

### מסך צ'ק-אין (_sportLoadXxx → _{type}LoadVisitsToday)
```js
// כל שורה בביקורי היום חייבת להראות:
// שם + שעת כניסה + כפתור "יציאה" (אם אין checkout) + כפתור "ביטול"
// לאחר יציאה: שעת יציאה + משך (דקות/שעות)
```

### מסך רדומים (showXxxDormant)
```js
// לקוחות פעילים שלא ביקרו 30+ יום
// לכל אחד: שם, תאריך ביקור אחרון, כפתור "כרטיס" + כפתור חיוג
```

### ניתוב actions — שני מקומות
```js
// 1. rdAction override
if (action === '<type>-dashboard') { window.render<Type>Dashboard(...); return; }
if (action === '<type>-customers') { window.show<Type>Customers(); return; }
// ...

// 2. מסך ניווט שני (לוח גדול)
if (action === '<type>-customers') { window.show<Type>Customers(); return; }
```

### Quick actions — סדר סטנדרטי
```js
roleQuickActions([
  {icon:'🚪', label:"כניסה", action:'<type>-visit'},
  {icon:'👥', label:'לקוחות', action:'<type>-customers'},
  {icon:'🎟️', label:'סוגי מנויים / תוכניות', action:'<type>-plans'},
  {icon:'📅', label:'הזמנות / תורים', action:'<type>-bookings'},
  {icon:'⚠️', label:'רדומים', action:'<type>-dormant'},
  {icon:'🔔', label:'התראות', action:'<type>-alerts'},
  {icon:'📊', label:'דוחות', action:'<type>-reports'},
])
```

---

## 3. ממשק לקוח (sc-auth.js)

### openActivityPanel — destructure + render
```js
// בfetch activity, להוסיף visits לdestructuring:
const { orders, bookings, classRegs, memberships, appointments, visits, checkins, businessType } = r;

// בrender — אחרי appointments:
if (_bizType === '<type>') {
  html += `<div>🚪 היסטוריית ביקורים<span>${visits.length ? visits.length+' ביקורים' : ''}</span></div>`;
  if (!visits.length) {
    html += `<div>אין ביקורים רשומים עדיין</div>`;
  } else {
    html += visits.map((v, i) => {
      const dt = v.visited_at ? new Date(v.visited_at) : null;
      const visitNum = visits.length - i;
      const dateStr = dt ? dt.toLocaleDateString('he-IL',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) : '';
      const timeStr = dt ? dt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '';
      const outDt = v.checked_out_at ? new Date(v.checked_out_at) : null;
      const outStr = outDt ? ' — יצא '+outDt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) : '';
      return `<div>#${visitNum} ${dateStr} ${timeStr}${outStr}</div>`;
    }).join('');
  }
}
```

### פאנל לקוח — פרטי תוכנית / מנוי
```js
// כפתור צ'ק-אין עצמי (רק אם status='active')
// POST /api/<type>/self-visit { groupId, phone }
// מניעת כפילות: בדוק אם visited_at today קיים
// הצגת מכסה שנותרה
// QR code עם qrcodejs (אם יש qr_token)
```

---

## 4. כללי חובה לכל סוג עסק

1. **לא שוברים קיים** — כל הוספה בתוך `if (businessType === '<type>')` בלבד
2. **PostgreSQL DATE** — תמיד לנרמל: `instanceof Date ? .toISOString().slice(0,10) : String(x).slice(0,10)`
3. **API arrays** — תמיד: `Array.isArray(res) ? res : (res.items || [])`
4. **ביטול צ'ק-אין** — תמיד מחזיר מכסה אם רלוונטי
5. **רדומים** — תמיד 30 יום, תמיד מתוך status='active', תמיד לפי ביקורים ולא תאריכים
6. **כפתור "ביטול" בביקורי היום** — תמיד require confirmation
7. **checkout = זמן יציאה** — עמודה `checked_out_at TIMESTAMP NULL` בטבלת ביקורים

---

## 5. Sport — מימוש ייחוס (reference implementation)

### טבלאות ייחוס
- `sport_memberships` — מנויים, status, sessions_total, sessions_used
- `sport_checkins` — ביקורים, checked_out_at, membership_id FK
- `sport_membership_types` — סוגים: monthly/yearly/punch_card/day_pass/pt_sessions
- `sport_classes` — שיעורים קבוצתיים
- `sport_class_registrations` — רישום לשיעורים
- `sport_trainers` — מאמנים

### KPIs ספורט
```
מנויים פעילים → showSportMembers('active')
פג תוקף בקרוב → showSportAlerts()
כניסות היום → showSportCheckIn()
בפנים כרגע → showSportCheckIn()
רדומים → showSportAtRisk()
הכנסה החודש → showSportReports()
```

### פונקציות עסק ספורט
```
renderSportDashboard(el)
showSportCheckIn()        — כניסה + רשימת היום עם יציאה/ביטול
showSportMembers()        — רשימת חברים
showSportMemberDetail(id) — כרטיס חבר + היסטוריה ללא הגבלה
showSportMembershipTypes() — סוגי מנויים
showSportAlerts()         — התראות: פגי תוקף + רדומים + קפואים
showSportAtRisk()         — רדומים בלבד
showSportReports()        — דוחות
showSportSchedule()       — שיעורים
showSportTrainers()       — מאמנים
```

### פונקציות לקוח ספורט (sc-auth.js)
```
_scMembershipPanel()      — רכישת מנוי
_scSchedulePanel()        — הזמנת שיעור קבוצתי
_scTrainerPanel()         — הזמנת אימון אישי + תאריכים פנויים
_scShowMembershipDetail() — פרטי מנוי + QR + צ'ק-אין עצמי
```

---

## 6. מסעדה — checklist מימוש (restaurant)

### טבלאות
- [ ] `restaurant_customers` — לקוחות נאמנים
- [ ] `restaurant_visits` — ביקורי שולחן (עם checked_out_at)
- [ ] `restaurant_reservations` — הזמנות שולחן (date, time, guests, status)

### Routes שרת
- [ ] `GET  /api/restaurant/dashboard/:gid`
- [ ] `GET  /api/restaurant/customers/:gid`
- [ ] `POST /api/restaurant/customer`
- [ ] `POST /api/restaurant/visit`
- [ ] `DELETE /api/restaurant/visit/:id`
- [ ] `POST /api/restaurant/visit/:id/checkout`
- [ ] `GET  /api/restaurant/visits/:gid`
- [ ] `POST /api/restaurant/self-visit`
- [ ] `GET  /api/restaurant/reservations/:gid`
- [ ] `POST /api/restaurant/reservation`
- [ ] `GET  /api/restaurant/alerts/:gid`

### דשבורד עסק — KPIs מסעדה
- [ ] שולחנות פעילים היום
- [ ] סועדים כרגע
- [ ] הכנסה היום
- [ ] הזמנות ממתינות
- [ ] לקוחות חוזרים החודש
- [ ] רדומים (לא ביקרו 30 יום)

### Quick actions מסעדה
- [ ] 🪑 כניסת שולחן (visit)
- [ ] 👥 לקוחות
- [ ] 📅 הזמנות שולחן
- [ ] 📊 דוחות
- [ ] ⚠️ רדומים
- [ ] 🔔 התראות

### ממשק לקוח (sc-auth.js)
- [ ] היסטוריית ביקורים בפאנל הפעילות (אם businessType='restaurant')
- [ ] הזמנת שולחן עצמי (בחירת תאריך + שעה + אורחים)
- [ ] צ'ק-אין עצמי בכניסה למסעדה
