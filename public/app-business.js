// ==========================================
// Oneflow 360 Pro - Business Module (B2B)
// ==========================================

// --- State Variables ---
let employeesCache = [];
let procurementCache = [];
let inventoryCache = [];
let ticketsCache = [];
let payrollTransactions = [];
let timeclockRecords = [];
let trainingBundles = [];
let activePunchedIn = null; // שומר את רשומת שעון הנוכחות הפעילה
let timeclockInterval = null;

const BUSINESS_CATEGORIES = {
    income: [ {value:'sales', label:'💰 מכירות והכנסות'}, {value:'investment', label:'📈 השקעות'}, {value:'other', label:'💸 אחר'} ],
    expense: [ {value:'payroll', label:'👥 שכר ובונוסים'}, {value:'office', label:'🏢 שכירות ותחזוקה'}, {value:'software', label:'💻 רישוי ומחשוב'}, {value:'marketing', label:'🎯 שיווק ופרסום'}, {value:'travel', label:'🚗 אש"ל ונסיעות'}, {value:'inventory', label:'📦 רכש ומלאי'}, {value:'other', label:'💸 אחר'} ]
};

// ==========================================
// Initialization & Core Setup
// ==========================================

async function loadBusinessDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    // בהנחה שיש לך div כזה ב-business.html
    const dashContainer = document.getElementById('business-dashboard-container');
    if (dashContainer) dashContainer.classList.remove('hidden');
    
    document.getElementById('dash-group-name').innerHTML = `${currentGroup.name} <span class="text-[10px] font-mono bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full tracking-widest">PRO</span>`;
    document.getElementById('dash-nickname').innerText = currentUser.nickname;

    const isAdmin = currentUser.role === 'ADMIN';
    if(isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.employee-only').forEach(el => el.classList.add('hidden'));
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.employee-only').forEach(el => el.classList.remove('hidden'));
    }

    updateBatteryUI(); // מפנה לפונקציה מ-common.js
    
    try {
        await fetchBusinessData();
        setInterval(fetchBusinessData, 60000); // רענון כל דקה
    } catch (e) {
        console.error('Error fetching business data:', e);
        showToast('error', 'שגיאה בטעינת נתוני העסק');
    } finally {
        const preloader = document.getElementById('app-preloader');
        if (preloader && !preloader.classList.contains('hidden')) {
            preloader.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => preloader.classList.add('hidden'), 700);
        }
    }
}

function switchBusinessTab(t) {
    ['feed', 'timeclock', 'procurement', 'inventory', 'tickets', 'payroll', 'training', 'budget'].forEach(x => {
        const el = document.getElementById(`content-${x}`);
        if(el) el.classList.add('hidden');
        const btn = document.getElementById(`tab-${x}`);
        if(btn) btn.classList.remove('tab-active');
    });
    
    const targetContent = document.getElementById(`content-${t}`);
    const targetTab = document.getElementById(`tab-${t}`);
    if (targetContent) targetContent.classList.remove('hidden');
    if (targetTab) targetTab.classList.add('tab-active');

    // קריאות רנדור ספציפיות לפי הטאב
    if (t === 'timeclock') renderTimeclock();
    if (t === 'procurement') renderProcurement();
    if (t === 'inventory') renderInventory();
    if (t === 'tickets') renderTickets();
    if (t === 'payroll') renderPayroll();
}

async function fetchBusinessData() {
    if (!currentGroup || !currentGroup.id) return;
    
    try {
        // טעינת עובדים
        const membersRes = await fetch(`${API}/group/members?groupId=${currentGroup.id}&requesterId=${currentUser.id}`);
        employeesCache = await membersRes.json();
        
        // טעינת נתונים כלליים
        const res = await fetch(`${API}/data/${currentUser.id}`);
        const data = await res.json();
        
        if (data.group) {
            currentGroup.ai_tokens = data.group.ai_tokens;
            currentGroup.is_premium = data.group.is_premium;
            updateBatteryUI();
        }

        ticketsCache = Array.isArray(data.tasks) ? data.tasks : []; // משתמש במודול ה-tasks כבסיס לטיקטים
        inventoryCache = Array.isArray(data.pantry) ? data.pantry : []; // משתמש במזווה כבסיס למלאי
        procurementCache = Array.isArray(data.shopping_list) ? data.shopping_list : []; // משתמש ברשימת קניות כבסיס לרכש
        
        // טעינת שעון נוכחות יומי/חודשי
        await fetchTimeclockRecords();
        
        renderBusinessFeed();
    } catch(e) {
        console.error('Failed to fetch business data', e);
    }
}

// ==========================================
// Timeclock (שעון נוכחות)
// ==========================================

async function fetchTimeclockRecords() {
    try {
        const res = await fetch(`${API}/timeclock?groupId=${currentGroup.id}&userId=${currentUser.role === 'ADMIN' ? 'all' : currentUser.id}`);
        if(res.ok) {
            const data = await res.json();
            timeclockRecords = data.records || [];
            activePunchedIn = data.activeRecord || null;
            updateTimeclockUI();
        }
    } catch(e) { console.error('Timeclock fetch error:', e); }
}

function updateTimeclockUI() {
    const btnStatus = document.getElementById('btn-punch-status');
    const timerDisplay = document.getElementById('timeclock-timer');
    if(!btnStatus || !timerDisplay) return;

    if (activePunchedIn) {
        btnStatus.innerHTML = '<i class="fa-solid fa-stopwatch"></i> יציאה (Punch Out)';
        btnStatus.className = 'w-full py-4 rounded-2xl font-bold text-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shadow-sm transition';
        startTimeclockCounter(new Date(activePunchedIn.punch_in));
    } else {
        btnStatus.innerHTML = '<i class="fa-solid fa-fingerprint"></i> כניסה (Punch In)';
        btnStatus.className = 'w-full py-4 rounded-2xl font-bold text-lg bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 shadow-sm transition';
        stopTimeclockCounter();
        timerDisplay.innerText = '00:00:00';
    }
    renderTimeclock();
}

async function togglePunch() {
    const action = activePunchedIn ? 'out' : 'in';
    toggleLoader('punch', true);
    try {
        const res = await fetch(`${API}/timeclock/punch`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, groupId: currentGroup.id, action: action })
        });
        const data = await res.json();
        if(data.success) {
            showToast('success', action === 'in' ? 'החתמת כניסה בהצלחה' : 'החתמת יציאה בהצלחה');
            if(action === 'out') triggerConfetti();
            await fetchTimeclockRecords();
        } else {
            showToast('error', data.error);
        }
    } catch(e) {
        showToast('error', 'שגיאת תקשורת');
    } finally {
        toggleLoader('punch', false);
    }
}

function startTimeclockCounter(startTime) {
    if (timeclockInterval) clearInterval(timeclockInterval);
    const display = document.getElementById('timeclock-timer');
    
    timeclockInterval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now - startTime) / 1000); // שניות
        const h = String(Math.floor(diff / 3600)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const s = String(diff % 60).padStart(2, '0');
        if(display) display.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

function stopTimeclockCounter() {
    if (timeclockInterval) clearInterval(timeclockInterval);
}

function renderTimeclock() {
    const list = document.getElementById('timeclock-records-list');
    if (!list) return;

    if (timeclockRecords.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">אין דיווחי שעות החודש.</div>';
        return;
    }

    let html = '';
    timeclockRecords.forEach(r => {
        const dateStr = new Date(r.punch_in).toLocaleDateString('he-IL');
        const inTime = new Date(r.punch_in).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
        const outTime = r.punch_out ? new Date(r.punch_out).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'}) : 'פעיל';
        const totalHtml = r.total_minutes ? `<span class="font-bold text-blue-600">${(r.total_minutes / 60).toFixed(1)} ש'</span>` : '<span class="text-orange-500 text-xs animate-pulse">במשמרת</span>';
        const userBadge = currentUser.role === 'ADMIN' ? `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded ml-2">${r.nickname}</span>` : '';

        html += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2">
                <div>
                    <p class="font-bold text-slate-800 text-sm">${dateStr} ${userBadge}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${inTime} - ${outTime}</p>
                </div>
                <div class="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    ${totalHtml}
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

// ==========================================
// Procurement (ניהול רכש וסריקת חשבוניות ספק)
// ==========================================

function openProcurementModal() {
    document.getElementById('procurement-modal').classList.remove('hidden');
}

async function submitProcurementRequest() {
    const item = val('proc-item');
    const qty = val('proc-qty');
    const priority = val('proc-priority');
    if(!item) return showToast('error', 'יש להזין שם פריט');

    try {
        await fetch(`${API}/shopping/add`, { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({itemName: item, quantity: qty, unit: "יח'", estimatedPrice: 0, userId: currentUser.id, status: 'requested'}) 
        });
        document.getElementById('procurement-modal').classList.add('hidden');
        showToast('success', 'דרישת הרכש נשלחה לאישור ההנהלה!');
        fetchBusinessData();
    } catch(e) { showToast('error', 'שגיאה בשליחת הדרישה'); }
}

function renderProcurement() {
    const requestsList = document.getElementById('procurement-requests-list');
    const activeList = document.getElementById('procurement-active-list');
    if (!requestsList || !activeList) return;

    let reqHtml = '';
    let actHtml = '';

    procurementCache.forEach(i => {
        if (i.status === 'requested') {
            const adminActions = currentUser.role === 'ADMIN' ? `
                <div class="flex gap-2">
                    <button onclick="updateProcurementStatus(${i.id}, 'pending')" class="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold hover:bg-green-200">אשר לעגלה</button>
                    <button onclick="deleteProcurement(${i.id})" class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold hover:bg-red-200">דחה</button>
                </div>
            ` : `<span class="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold">ממתין לאישור מנהל</span>`;

            reqHtml += `
                <div class="bg-white p-3 rounded-xl border border-orange-200 shadow-sm flex justify-between items-center mb-2">
                    <div>
                        <span class="font-bold text-slate-700">${i.item_name} (x${i.quantity})</span>
                        <span class="text-[10px] text-slate-500 block">דרישה מאת: ${i.requester_name}</span>
                    </div>
                    ${adminActions}
                </div>
            `;
        } else {
            // פעיל בעגלת הרכש המאושרת
            const checkbox = currentUser.role === 'ADMIN' ? `<input type="checkbox" onchange="updateProcurementStatus(${i.id}, this.checked ? 'in_cart' : 'pending')" ${i.status === 'in_cart' ? 'checked' : ''} class="w-5 h-5 rounded border-slate-300 accent-blue-600">` : '';
            actHtml += `
                <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 mb-2 ${i.status === 'in_cart' ? 'opacity-70 bg-slate-50' : ''}">
                    ${checkbox}
                    <div class="flex-1">
                        <span class="font-bold text-slate-800 ${i.status === 'in_cart' ? 'line-through' : ''}">${i.item_name}</span>
                        <span class="text-[10px] text-slate-400 block">כמות: ${i.quantity}</span>
                    </div>
                    ${currentUser.role === 'ADMIN' ? `<button onclick="deleteProcurement(${i.id})" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            `;
        }
    });

    requestsList.innerHTML = reqHtml || '<p class="text-xs text-slate-400 py-2">אין דרישות רכש ממתינות.</p>';
    activeList.innerHTML = actHtml || '<p class="text-xs text-slate-400 py-2">עגלת הרכש הארגונית ריקה.</p>';
}

async function updateProcurementStatus(id, status) {
    await fetch(`${API}/shopping/update`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({itemId:id, status: status})});
    fetchBusinessData();
}

async function deleteProcurement(id) {
    if(!confirm('למחוק פריט זה?')) return;
    await fetch(`${API}/shopping/delete/${id}`, { method: 'DELETE' });
    fetchBusinessData();
}

// פענוח חשבוניות AI (Procurement)
function triggerInvoiceScan() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = handleInvoiceUpload;
    input.click();
}

function handleInvoiceUpload(event) {
    const file = event.target.files[0];
    if(!file) return;

    executeWithAIWarning(() => {
        showFamilAIModal('מערכת AI לפענוח חשבוניות', null); 
        document.getElementById('familai-loading-text').innerText = 'סורק חשבונית ספק ומחלץ נתונים למלאי...';
        
        // כאן אנו משתמשים בפונקציה compressImage הקיימת ב-common.js
        compressImage(file, 1200, 1200, 0.8, async (compressedDataUrl) => {
            const base64 = compressedDataUrl.split(',')[1];
            try {
                // מפנה לאותו מנוע של הקופאית האוטומטית, עם קונטקסט עסקי
                const res = await fetch(`${API}/shopping/scan-receipt`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ userId: currentUser.id, imageBase64: base64, mimeType: 'image/jpeg', isBusiness: true }) 
                });
                const data = await res.json();
                
                if(!handleAIResponseCheck(data)) { 
                    document.getElementById('familai-advisor-modal').classList.add('hidden'); 
                    return; 
                }
                
                if(data.success) { 
                    showFamilAIModal('פענוח הושלם', `נמצאו ${data.count} פריטים בחשבונית. הפריטים הוספו אוטומטית למערכת המלאי (Inventory).`); 
                    triggerConfetti(); 
                    fetchBusinessData(); 
                } else { 
                    document.getElementById('familai-advisor-modal').classList.add('hidden'); 
                    showToast('error', 'שגיאה בפענוח החשבונית.'); 
                }
            } catch(err) { 
                document.getElementById('familai-advisor-modal').classList.add('hidden'); 
                showToast('error', 'שגיאת תקשורת עם השרת.'); 
            }
        });
    });
}

// ==========================================
// Inventory (ניהול מלאי)
// ==========================================

function openInventoryModal() {
    document.getElementById('inventory-modal').classList.remove('hidden');
}

async function submitInventoryItem() {
    const name = val('inv-item');
    const qty = val('inv-qty');
    const unit = val('inv-unit') || "יח'";
    if(!name) return;

    await fetch(`${API}/pantry/add`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({groupId: currentGroup.id, itemName: name, quantity: qty, unit: unit}) 
    });
    document.getElementById('inventory-modal').classList.add('hidden');
    val('inv-item', ''); val('inv-qty', 1);
    fetchBusinessData();
    showToast('success', 'הפריט נוסף למלאי');
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    if(!list) return;
    
    if(inventoryCache.length === 0) {
        list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">המלאי ריק. ניתן להוסיף ידנית או דרך סריקת חשבונית רכש.</div>';
        return;
    }

    let html = '';
    inventoryCache.forEach(p => {
        html += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2">
                <div>
                    <h4 class="font-bold text-slate-800 text-sm">${p.item_name}</h4>
                    <p class="text-[10px] text-slate-400">עודכן: ${new Date(p.updated_at).toLocaleDateString('he-IL')}</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-bold">${p.quantity} ${p.unit || "יח'"}</span>
                    <button onclick="promptInventoryUsage(${p.id}, '${p.item_name.replace(/'/g,"\\'")}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold transition">דווח שימוש</button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

async function promptInventoryUsage(id, name) {
    const qty = prompt(`כמה לקחת מתוך ${name}? (מספר)`);
    if(qty && !isNaN(qty) && parseFloat(qty) > 0) {
        try {
            const res = await fetch(`${API}/pantry/use`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ groupId: currentGroup.id, itemName: name, usedQuantity: qty }) 
            });
            const data = await res.json();
            if(data.success) {
                showToast('success', 'המלאי עודכן');
                fetchBusinessData();
            } else {
                showToast('error', data.error);
            }
        } catch(e) { showToast('error', 'שגיאה בעדכון'); }
    }
}

function getInventoryInsightAI() {
    executeWithAIWarning(async () => {
        showFamilAIModal('מנהל רכש חכם (AI)', null); 
        document.getElementById('familai-loading-text').innerText = 'מנתח קצבי צריכה ומתריע על חוסרים צפויים...';
        try {
            const res = await fetch(`${API}/pantry/familai-insight`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ groupId: currentGroup.id, isBusiness: true }) 
            });
            const data = await res.json();
            if(!handleAIResponseCheck(data)) { document.getElementById('familai-advisor-modal').classList.add('hidden'); return; }
            
            if(data.success && data.insight) { 
                showFamilAIModal('דוח ניהול מלאי (AI)', data.insight); 
            } else { 
                document.getElementById('familai-advisor-modal').classList.add('hidden'); 
                showToast('error', 'שגיאה בהפקת הדוח'); 
            }
        } catch(e) { 
            document.getElementById('familai-advisor-modal').classList.add('hidden'); 
            showToast('error', 'שגיאת תקשורת'); 
        }
    });
}

// ==========================================
// Tickets / Projects (פרויקטים ומשימות)
// ==========================================

function openTicketModal() {
    const select = document.getElementById('ticket-assignee');
    select.innerHTML = '<option value="" disabled selected>בחר עובד לצוות...</option>';
    employeesCache.forEach(e => {
        select.innerHTML += `<option value="${e.id}">${e.nickname}</option>`;
    });
    document.getElementById('ticket-modal').classList.remove('hidden');
}

async function submitTicket() {
    const title = val('ticket-title');
    const assignee = val('ticket-assignee');
    const bonus = val('ticket-bonus') || 0;
    
    if(!title || !assignee) return showToast('error', 'יש להזין נושא ולבחור עובד');

    await fetch(`${API}/tasks`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({ title: title, reward: bonus, assignedTo: assignee, status: 'pending' }) 
    });
    
    document.getElementById('ticket-modal').classList.add('hidden');
    showToast('success', 'הטיקט נפתח ושויך בהצלחה!');
    fetchBusinessData();
}

function renderTickets() {
    const list = document.getElementById('tickets-list');
    if(!list) return;

    if(ticketsCache.length === 0) {
        list.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">אין פרויקטים או טיקטים פתוחים.</div>';
        return;
    }

    let html = '';
    ticketsCache.forEach(t => {
        const isMyTicket = String(t.assigned_to) === String(currentUser.id);
        const isAdmin = currentUser.role === 'ADMIN';
        if (!isMyTicket && !isAdmin) return;

        let statusBadge = '';
        let actionBtn = '';

        if (t.status === 'pending') {
            if (isMyTicket) {
                actionBtn = `<button onclick="updateTicketStatus(${t.id}, 'done')" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">דווח ביצוע</button>`;
            } else {
                statusBadge = `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded">בביצוע</span>`;
            }
        } else if (t.status === 'done') {
            if (isAdmin) {
                actionBtn = `<button onclick="updateTicketStatus(${t.id}, 'approved', ${t.reward})" class="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600">סגור ואשר בונוס</button>`;
            } else {
                statusBadge = `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded">ממתין ל-QA/מנהל</span>`;
            }
        } else if (t.status === 'approved') {
            statusBadge = `<span class="text-xs text-green-600 font-bold"><i class="fa-solid fa-check-double"></i> הושלם</span>`;
        }

        const bonusHtml = t.reward > 0 ? `<span class="text-[10px] bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded ml-2">בונוס: ₪${t.reward}</span>` : '';

        html += `
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center mb-2">
                <div>
                    <p class="font-bold text-slate-800">${t.title}</p>
                    <div class="flex items-center mt-1">
                        <span class="text-[10px] text-slate-500 mr-2"><i class="fa-regular fa-user"></i> ${t.assignee_name}</span>
                        ${bonusHtml}
                    </div>
                </div>
                <div class="flex flex-col items-end gap-1">
                    ${actionBtn}
                    ${statusBadge}
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
}

async function updateTicketStatus(taskId, status, reward = 0) {
    if(status === 'approved' && reward > 0) triggerConfetti();
    await fetch(`${API}/tasks/update`, {
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({taskId: taskId, status: status, finalReward: reward})
    });
    fetchBusinessData();
}

// ==========================================
// Payroll & Expenses (החזרי אש"ל, בונוסים ושכר)
// ==========================================

function openExpenseModal() {
    document.getElementById('expense-modal').classList.remove('hidden');
}

async function submitExpenseClaim() {
    const amount = val('expense-amount');
    const desc = val('expense-desc');
    if(!amount) return showToast('error', 'יש להזין סכום');

    await fetch(`${API}/loans/request`, { // משתמש במנגנון ההלוואות כבסיס להחזרי הוצאות
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({userId:currentUser.id, amount: amount, reason: desc, isExpenseClaim: true})
    });
    
    document.getElementById('expense-modal').classList.add('hidden');
    showToast('success', 'דרישת ההחזר הוגשה לאישור!');
    renderPayroll();
}

async function renderPayroll() {
    const list = document.getElementById('payroll-list');
    if (!list) return;

    try {
        let url = currentUser.role === 'ADMIN' ? `${API}/loans?groupId=${currentGroup.id}` : `${API}/loans?userId=${currentUser.id}`;
        const res = await fetch(url);
        const claims = await res.json();

        let html = '';
        if(currentUser.role === 'ADMIN') {
            const pending = claims.filter(c => c.status === 'pending');
            if(pending.length === 0) html = '<p class="text-xs text-slate-400 text-center py-4">אין דרישות החזר/תשלום ממתינות.</p>';
            pending.forEach(c => {
                html += `
                    <div class="bg-white p-3 rounded-xl border border-blue-100 shadow-sm flex justify-between items-center mb-2">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">${c.nickname} מבקש/ת החזר: ₪${c.original_amount}</p>
                            <p class="text-xs text-slate-500">${c.reason || 'ללא פירוט'}</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="approveExpenseClaim(${c.id})" class="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600">אשר וזכה</button>
                            <button onclick="rejectExpenseClaim(${c.id})" class="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100">דחה</button>
                        </div>
                    </div>
                `;
            });
        } else {
            if(claims.length === 0) html = '<p class="text-xs text-slate-400 text-center py-4">לא הגשת בקשות לאחרונה.</p>';
            claims.forEach(c => {
                const sLabel = c.status === 'pending' ? 'בבדיקה' : (c.status === 'approved' ? 'אושר וזוכה' : 'נדחה');
                const sColor = c.status === 'pending' ? 'bg-orange-100 text-orange-600' : (c.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600');
                html += `
                    <div class="bg-white p-3 rounded-xl border border-slate-50 shadow-sm flex justify-between items-center mb-2">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">בקשת החזר: ₪${c.original_amount}</p>
                            <p class="text-[10px] text-slate-400">${c.reason || ''}</p>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-1 rounded ${sColor}">${sLabel}</span>
                    </div>
                `;
            });
        }
        list.innerHTML = html;
    } catch(e) { console.error(e); }
}

async function approveExpenseClaim(id) {
    if (!confirm('לאשר את ההחזר ולזכות את העובד/ת בתקציב?')) return;
    const res = await fetch(`${API}/loans/approve`, { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ loanId: id, adminId: currentUser.id }) 
    });
    const data = await res.json();
    if (data.success) { 
        triggerConfetti(); 
        showToast('success', 'ההחזר אושר ובוצע זיכוי!'); 
        renderPayroll(); 
        fetchBusinessData(); 
    } else showToast('error', data.error);
}

async function rejectExpenseClaim(id) {
    if (!confirm('לדחות בקשה זו?')) return;
    await fetch(`${API}/loans/reject`, { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ loanId: id, adminId: currentUser.id }) 
    });
    showToast('success', 'הבקשה נדחתה');
    renderPayroll();
}

// ==========================================
// Dashboard Feed (פעילות אחרונה בעסק)
// ==========================================

function renderBusinessFeed() {
    const list = document.getElementById('business-feed-list');
    if (!list) return;

    // יוצר פיד משולב מטיקטים שנסגרו, החתמות שעון ורכש
    let feedItems = [];

    // נוסיף טיקטים מאושרים
    ticketsCache.forEach(t => {
        if(t.status === 'approved') {
            feedItems.push({
                date: new Date(t.created_at || Date.now()),
                title: `טיקט השושלם: ${t.title}`,
                user: t.assignee_name,
                icon: '<i class="fa-solid fa-check-double text-green-500"></i>',
                desc: t.reward > 0 ? `בונוס שחולק: ₪${t.reward}` : 'הושלם בהצלחה'
            });
        }
    });

    // נוסיף החתמות שעות (רק של היום/אתמול כדי לא להעמיס)
    timeclockRecords.forEach(r => {
        feedItems.push({
            date: new Date(r.punch_in),
            title: 'החתמת נוכחות',
            user: r.nickname,
            icon: '<i class="fa-solid fa-clock text-blue-500"></i>',
            desc: r.punch_out ? `משמרת הסתיימה (${(r.total_minutes/60).toFixed(1)} שעות)` : 'משמרת פעילה כעת'
        });
    });

    feedItems.sort((a, b) => b.date - a.date);
    feedItems = feedItems.slice(0, 15); // רק ה-15 האחרונים

    if(feedItems.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">אין פעילות אחרונה להצגה.</div>';
        return;
    }

    let html = '';
    feedItems.forEach(item => {
        const timeStr = item.date.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        html += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-start gap-3 mb-2">
                <div class="bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0">
                    ${item.icon}
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm leading-tight">${item.title}</p>
                    <p class="text-xs text-slate-500 mt-1">${item.user} • ${timeStr}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">${item.desc}</p>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

// ==========================================
// Budget Analyst AI (יועץ ארגוני AI)
// ==========================================

function getBusinessBudgetInsightAI() {
    executeWithAIWarning(async () => {
        showFamilAIModal('יועץ ארגוני AI', null); 
        document.getElementById('familai-loading-text').innerText = 'מנתח את הוצאות המחלקות וקצב השריפה (Burn Rate)...';
        try {
            // משתמש במנוע ה-Budget הקיים אבל שולח פלאג של עסק
            const res = await fetch(`${API}/budget/familai-insight`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ groupId: currentGroup.id, isBusiness: true }) 
            });
            const data = await res.json();
            
            if(!handleAIResponseCheck(data)) { 
                document.getElementById('familai-advisor-modal').classList.add('hidden'); 
                return; 
            }
            
            if(data.success && data.insight) { 
                showFamilAIModal('דוח ייעול ארגוני', data.insight); 
            } else { 
                document.getElementById('familai-advisor-modal').classList.add('hidden'); 
                showToast('error', 'שגיאה בהפקת הדוח הארגוני'); 
            }
        } catch(e) { 
            document.getElementById('familai-advisor-modal').classList.add('hidden'); 
            showToast('error', 'שגיאת תקשורת'); 
        }
    });
}
