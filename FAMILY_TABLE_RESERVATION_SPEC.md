# אפיון: הזמנת שולחנות ללקוחות ONEFLOW LIFE

## 🎯 מטרה
הוספת ממשק הזמנת שולחנות עם זמינות בזמן-אמת עבור לקוחות משפחה המקושרים לעסקי מסעדה/בית קפה דרך אפליקציית ONEFLOW LIFE.

---

## 📍 מיקום בממשק
**"הפעילות שלי" → בכרטיסיה של מסעדה → כפתור "+" (פעולות מהירות)**

### מבנה קיים כבר:
```
[עסק: "מסעדת פיצה עמית"]
├── [סמל עסק] 🍕
├── [שם עסק] | [תאריך קישור]
├── [כפתור "חנות"] → פותח storefront.html
├── [כפתור "+"] → מציג sheet עם פעולות מהירות:
│   ├── בצע הזמנה (storefront)
│   ├── הזמן שולחן ← פותח modal הזמנה
│   └── שלח הודעה
```

---

## 🔄 זרימת המשתמש (User Flow)

### שלב 1: לחיצה על "הזמן שולחן"
```
משתמש → כפתור "הזמן שולחן" בפעולות מהירות
        ↓
        פתיחת modal "הזמנת שולחן"
```

### שלב 2: בחירת תאריך וטעינת זמינות
```
modal מוצג עם שדות:
├── 📅 בחירת תאריך (input[type=date])
│   └── onChange: קרא ל- /api/public/restaurants/:groupId/availability/:date
│
├── [טוען זמינות...]
│
├── 🕐 בחירת שעה מתוך רשימה דינמית:
│   ├── 10:00 | 8 שולחנות    [זמין]
│   ├── 11:00 | 7 שולחנות    [זמין]
│   ├── 12:00 | 2 שולחנות    [זמין אך תקוע]
│   ├── 13:00 | 0 שולחנות    [לא זמין - כפתור מוכן]
│   └── ...
│
├── 👥 מספר סועדים (input[type=number])
├── 📝 הערות (textarea)
│
└── [שלח בקשת הזמנה]
```

### שלב 3: בדיקת הזמינות בשרת
```
GET /api/public/restaurants/:groupId/availability/:date

response:
{
  "success": true,
  "slots": [
    { "time": "10:00", "available": true, "tables": 8 },
    { "time": "11:00", "available": true, "tables": 7 },
    { "time": "12:00", "available": true, "tables": 2 },
    { "time": "13:00", "available": false, "tables": 0 }
  ]
}
```

### שלב 4: שליחת הזמנה
```
POST /api/calendar/events
{
  "groupId": bizGroupId,
  "title": "משפחת לוי — 4 סועדים",
  "customerPhone": "+972545103343",
  "eventDate": "2026-06-20",
  "startTime": "19:00",
  "status": "pending",
  "customerGroupId": currentGroup.id,
  "numGuests": 4,
  "callType": "table_reservation",
  "notes": "..."
}

response:
{
  "success": true,
  "status": "pending|approved",
  "assignedTable": 5,
  "message": "בקשה נשלחה / אושרה"
}
```

---

## 🖼️ ממשק משתמש (UI)

### שינויים בקוד `_tableReservationModal`:

#### **לפני (קיים כיום):**
```html
<div style="...">
  <!-- תאריך -->
  <input type="date" id="tres-date" ... >

  <!-- שעה - input רגיל -->
  <input type="time" id="tres-time" ... >

  <!-- מספר סועדים -->
  <input type="number" id="tres-guests" ... >

  <!-- הערות -->
  <textarea id="tres-notes" ... ></textarea>

  <!-- שליחה -->
  <button onclick="...">שלח בקשת הזמנה</button>
</div>
```

#### **אחרי (עם זמינות):**
```html
<div style="...">
  <!-- תאריך - יטרוג זמינות כאשר משתנה -->
  <input type="date" id="tres-date" 
         onchange="window._loadTableAvailabilityForModal(bizGroupId, this.value)" ... >

  <!-- טעינה + הודעת סטטוס -->
  <div id="tres-availability-status" style="display:none;...">
    <i class="fa-solid fa-spinner fa-spin"></i> טוען זמינות...
  </div>

  <!-- שעה - גריד של כפתורים עם זמינות -->
  <div id="tres-time-slots" class="grid grid-cols-3 gap-2">
    <!-- דיnamically rendered -->
    <button>10:00<br>8 שולחנות</button>
    <button>11:00<br>7 שולחנות</button>
    <button disabled>13:00<br>אין זמינות</button>
  </div>

  <!-- מספר סועדים - זהה -->
  <input type="number" id="tres-guests" ... >

  <!-- הערות - זהה -->
  <textarea id="tres-notes" ... ></textarea>

  <!-- שליחה - זהה -->
  <button onclick="...">שלח בקשת הזמנה</button>
</div>
```

---

## 💻 שינויים בקוד

### **1. פונקציית טעינת זמינות חדשה**
```javascript
window._loadTableAvailabilityForModal = async function(bizGroupId, dateStr) {
    if (!dateStr) return;
    
    const statusEl = document.getElementById('tres-availability-status');
    const slotsEl = document.getElementById('tres-time-slots');
    
    if (statusEl) statusEl.style.display = 'block';
    if (slotsEl) slotsEl.innerHTML = '';
    
    try {
        // קרא לAPI - אותו endpoint כמו בStorefront
        const res = await fetch(`${API}/public/restaurants/${bizGroupId}/availability/${dateStr}`);
        const data = await res.json();
        
        if (!data.success || !data.slots?.length) {
            if (slotsEl) slotsEl.innerHTML = '<p class="col-span-3">אין זמינות בתאריך זה</p>';
            return;
        }
        
        // רינדור כפתורי שעות
        const html = data.slots.map(slot => `
            <button type="button" 
                    onclick="document.getElementById('tres-time').value='${slot.time}'; window._highlightSelectedTime()"
                    ${!slot.available ? 'disabled' : ''}
                    class="py-2 px-1 rounded text-xs font-bold ...">
                ${slot.time}<br>
                <span class="text-[10px]">${slot.tables} שולחנות</span>
            </button>
        `).join('');
        
        if (slotsEl) slotsEl.innerHTML = html;
    } catch (e) {
        if (slotsEl) slotsEl.innerHTML = '<p class="col-span-3 text-red-500">שגיאה בטעינה</p>';
    } finally {
        if (statusEl) statusEl.style.display = 'none';
    }
};
```

### **2. עדכון `_tableReservationModal`**
```javascript
window._tableReservationModal = function(bizGroupId, bizName) {
    const today = new Date().toISOString().split('T')[0];
    const modal = document.createElement('div');
    // ... קוד קיים ...
    
    modal.innerHTML = `<div style="...">
        <!-- כותרת -->
        <div style="...">...</div>
        
        <!-- שדות -->
        <div style="...">
            <!-- תאריך -->
            <div>
                <label>📅 תאריך</label>
                <input type="date" id="tres-date" min="${today}" value="${today}"
                       onchange="window._loadTableAvailabilityForModal(${bizGroupId}, this.value)" ... />
            </div>
            
            <!-- סטטוס טעינה -->
            <div id="tres-availability-status" style="display:none;...">
                <i class="fa-solid fa-spinner fa-spin"></i> טוען זמינות...
            </div>
            
            <!-- שעות - grid דינמי -->
            <div>
                <label>🕐 בחר שעה</label>
                <div id="tres-time-slots" class="grid grid-cols-3 gap-2" style="...">
                    <p class="col-span-3 text-slate-400 text-center">בחר תאריך קודם</p>
                </div>
                <input type="hidden" id="tres-time" />
            </div>
            
            <!-- מספר סועדים -->
            <div>
                <label>👥 מספר סועדים</label>
                <input type="number" id="tres-guests" ... />
            </div>
            
            <!-- הערות -->
            <div>
                <label>📝 הערות</label>
                <textarea id="tres-notes" ... ></textarea>
            </div>
            
            <!-- שגיאה -->
            <div id="tres-err" style="display:none;..."></div>
            
            <!-- שליחה -->
            <button onclick="window._submitTableReservation(${bizGroupId}, '${bizName}', this)">
                🍽️ שלח בקשת הזמנה
            </button>
        </div>
    </div>`;
    
    // ... קוד קיים ...
    
    // טען זמינות עבור היום
    document.getElementById('tres-date')?.addEventListener('change', (e) => {
        window._loadTableAvailabilityForModal(bizGroupId, e.target.value);
    });
    
    // טען זמינות עבור היום בעת פתיחה
    setTimeout(() => window._loadTableAvailabilityForModal(bizGroupId, today), 100);
};
```

### **3. עדכון `_submitTableReservation`**
```javascript
window._submitTableReservation = async function(bizGroupId, bizName, btn) {
    const date = document.getElementById('tres-date')?.value;
    const time = document.getElementById('tres-time')?.value;  // ← עכשיו מ-hidden input
    const guests = document.getElementById('tres-guests')?.value || '2';
    const notes = document.getElementById('tres-notes')?.value?.trim() || '';
    const errEl = document.getElementById('tres-err');
    
    // בדיקות
    if (!date || !time) { 
        if (errEl) { errEl.textContent = 'נא לבחור תאריך ושעה'; errEl.style.display = 'block'; }
        return; 
    }
    
    // ... קוד שליחה זהה לקיים ...
};
```

### **4. פונקציה עוזרת להדגשת שעה נבחרת**
```javascript
window._highlightSelectedTime = function() {
    document.querySelectorAll('#tres-time-slots button').forEach(btn => {
        if (btn.textContent.includes(document.getElementById('tres-time')?.value)) {
            btn.style.background = '#dbeafe';
            btn.style.borderColor = '#0284c7';
        } else {
            btn.style.background = 'white';
            btn.style.borderColor = '#e2e8f0';
        }
    });
};
```

---

## 🔌 API Integration

### Endpoints שכבר קיימים:
- ✅ `GET /api/public/restaurants/:groupId/availability/:date` → זמינות שולחנות
- ✅ `POST /api/calendar/events` → יצירת בקשת הזמנה
- ✅ `GET /api/family/business-activity/:familyGroupId/:bizGroupId` → פעילות משתמש

### אין צורך ב-API חדשים!

---

## 🎨 צבעים וסטיילינג

| מצב | צבע | סטיילינג |
|-----|-----|---------|
| שעה זמינה | לבן עם border כחול | `bg-white border-slate-200` |
| שעה נבחרת | כחול בהיר | `bg-blue-100 border-blue-500` |
| שעה לא זמינה | אפור בהיר | `bg-slate-100 disabled text-slate-400` |
| טעינה | ספינר | `fa-spinner fa-spin` |

---

## ⚠️ לא לשנות

- ✅ ממשק "הפעילות שלי" הקיים
- ✅ רשימת עסקים
- ✅ כפתור "חנות" קיים
- ✅ כפתור "שלח הודעה"
- ✅ modal הודעה הקיים
- ✅ דירוגים קיימים
- ✅ Accordion עם היסטוריית הזמנות

---

## ✨ פיצ'ר אקסטרה (לעתיד)

- [ ] SMS verification מחדש כאשר לוקח הזמנה דרך ONEFLOW (כמו בStorefront)
- [ ] ראיית מספר השולחן שהוקצה מיד אחרי אישור
- [ ] עדכון real-time כשעסק משנה את ההזמנה
- [ ] Notifications: "ההזמנה שלך אושרה"
