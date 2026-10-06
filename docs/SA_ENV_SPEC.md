# סביבת SA (Super Admin) — מפרט טכני מלא
**Oneflow Life · מנתח מערכות · עומק מקסימלי**
גרסה: אוקטובר 2026

---

## תוכן עניינים

1. [זהות הסביבה](#1-זהות-הסביבה)
2. [כניסה ואוטנטיקציה](#2-כניסה-ואוטנטיקציה)
3. [תפקידי משתמש (RBAC)](#3-תפקידי-משתמש-rbac)
4. [מבנה הניווט — SA_GROUPS ו-allTabs](#4-מבנה-הניווט--sa_groups-ו-alltabs)
5. [Pulse — לוח בקרה ראשי](#5-pulse--לוח-בקרה-ראשי)
6. [Dashboard — סטטיסטיקות מהירות](#6-dashboard--סטטיסטיקות-מהירות)
7. [Insights — תובנות מאוחדות](#7-insights--תובנות-מאוחדות)
8. [Clients — ניהול סביבות (FAMILY + BIZ)](#8-clients--ניהול-סביבות-family--biz)
9. [Comm — ניהול קהילות](#9-comm--ניהול-קהילות)
10. [Biz — ניהול עסקים](#10-biz--ניהול-עסקים)
11. [Support — מערכת קריאות שירות](#11-support--מערכת-קריאות-שירות)
12. [DevOps — פיתוח, קנבן ו-QA](#12-devops--פיתוח-קנבן-ו-qa)
13. [Finance — פיננסים ולינג](#13-finance--פיננסים-ולינג)
14. [HR — צוות והרשאות](#14-hr--צוות-והרשאות)
15. [Content — תוכן ועיצוב](#15-content--תוכן-ועיצוב)
16. [Inbox — שיגור הודעות ושיווק](#16-inbox--שיגור-הודעות-ושיווק)
17. [AdSlots — שטחי פרסום](#17-adslots--שטחי-פרסום)
18. [Templates — תבניות BIZ](#18-templates--תבניות-biz)
19. [Pricing — קטלוג מחירים](#19-pricing--קטלוג-מחירים)
20. [AI Builder — בניית AI פרסונלי](#20-ai-builder--בניית-ai-פרסונלי)
21. [Masterconfig — הגדרות מערכת](#21-masterconfig--הגדרות-מערכת)
22. [WhatsApp Hub](#22-whatsapp-hub)
23. [Kol Haam — תור תוכן ציבורי](#23-kol-haam--תור-תוכן-ציבורי)
24. [Shuka — כלים עסקיים חיצוניים](#24-shuka--כלים-עסקיים-חיצוניים)
25. [Partners — שותפים ו-Zone Managers](#25-partners--שותפים-ו-zone-managers)
26. [SysMap — מפת מערכת](#26-sysmap--מפת-מערכת)
27. [Legal — מסמכים משפטיים](#27-legal--מסמכים-משפטיים)
28. [Stats — דוחות ומדדים](#28-stats--דוחות-ומדדים)
29. [Live Games](#29-live-games)
30. [Games — ניהול משחקים](#30-games--ניהול-משחקים)
31. [Feed — פיד תוכן](#31-feed--פיד-תוכן)
32. [Impersonation — כניסה לסביבת לקוח](#32-impersonation--כניסה-לסביבת-לקוח)
33. [Notifications — מרכז התראות](#33-notifications--מרכז-התראות)
34. [Audit Log](#34-audit-log)
35. [Archive](#35-archive)
36. [מנגנונים טכניים רוחביים](#36-מנגנונים-טכניים-רוחביים)

---

## 1. זהות הסביבה

| שדה | ערך |
|---|---|
| URL | `/sa.html` |
| JS ראשי | `public/sa-app.js` (16,412 שורות) |
| API constant | `const API = hostname==='localhost' ? 'http://localhost:3000/api' : '/api'` |
| מטרה | ניהול מלא של פלטפורמת Oneflow Life — לקוחות, תמיכה, פיתוח, פיננסים, תוכן ותשתיות |
| קהל יעד | צוות פנימי: מנהל ראשי, צוות תמיכה, צוות פיתוח, שיווק, פיננסים |
| Auth header | `Authorization: <token>` — **ללא** `Bearer` |
| Token storage | `localStorage('ofl_sa_token')` + `window.saToken` (משתנה גלובלי) |

---

## 2. כניסה ואוטנטיקציה

### Login Flow

```javascript
handleSALogin()  // שורה ~382
// POST /api/superadmin/login { code, password }
// ← { token, user: { id, name, email, permissions[] } }
// → localStorage: ofl_sa_token + ofl_sa_user
// → window.saToken = token
// → window.currentSAUser = user
```

**הבדל מסביבות אחרות:** כניסה עם `code` (לא email) + `password`. אין JWT — טוקן אופאק.

### `saFetch()` (שורה 6):
```javascript
async function saFetch(path, opts = {}) {
    const token = saToken || localStorage.getItem('ofl_sa_token');
    // Authorization = token ישיר, ללא Bearer
}
```

### `window.onload` (שורה 39):
1. טוען `ofl_sa_token` + `ofl_sa_user` מ-localStorage
2. מפעיל `applyUserPermissions()` + `loadSAData()`
3. מטפל ב-URL params: `?ticket=X` → פותח טיקט; `?tab=X&sub=Y` → ניווט ישיר
4. מפעיל polling: `_saPendingRefresh = setInterval(loadSAPendingRequests, 60000)`
5. Tab ברירת מחדל: `switchSATab('pulse')`

---

## 3. תפקידי משתמש (RBAC)

### הרשאות (`permissions[]` array):

| הרשאה | גישה לטאבים |
|---|---|
| `open` | pulse, dashboard, clients, sysmap, legal, templates |
| `support` | support |
| `devops` | devops |
| `stats` | stats, finance |
| `comm` | comm, shuka |
| `biz` | biz |
| `content` | content |
| `users` | hr |
| `marketing` | inbox, marketing |
| `all` | הכל (isMaster = true) |

### `applyUserPermissions()` (שורה 91):
```javascript
const tabRequirements = {
    'pulse': 'open', 'dashboard': 'open', 'clients': 'open', 'sysmap': 'open',
    'legal': 'open', 'templates': 'open',
    'support': 'support', 'devops': 'devops', 'stats': 'stats',
    'comm': 'comm', 'biz': 'biz', 'content': 'content',
    'hr': 'users', 'inbox': 'marketing', 'partners': 'all',
    'finance': 'stats', 'marketing': 'marketing', 'shuka': 'comm', 'masterconfig': 'all'
};
```

- `isMaster = perms.includes('all')` — גישה מלאה לכל הטאבים
- `checkTabAccess(tabId)` בודק הרשאה לפני כניסה לכל טאב

---

## 4. מבנה הניווט — SA_GROUPS ו-allTabs

### `SA_GROUPS` (שורה 531) — 14 קבוצות:

| מפתח | שם | Tabs |
|---|---|---|
| `home` | ראשי | pulse, insights, stats |
| `customers` | לקוחות | comm, biz, clients, feed |
| `shukagrp` | שוק | shuka |
| `finance` | פיננסים | finance |
| `supportdev` | תמיכה ופיתוח | support, devops |
| `contentmkt` | תוכן ושיווק | content, inbox, legal, adslots, games, marketing, kol-haam |
| `livegamesgrp` | משחקים חיים | livegames |
| `partners` | שותפים | partners |
| `system` | מערכת | hr, sysmap, auditlog, archive |
| `templates` | תבניות | templates |
| `whatsapp` | WhatsApp | whatsapp |
| `pricing` | תמחור | pricing |
| `aibuilder` | בניית AI | ai-builder |
| `masterconfig` | הגדרות מאסטר | masterconfig |

### `allTabs` (שורה ~430) — 30 טאבים:

```javascript
const allTabs = [
    'dashboard', 'pulse', 'insights', 'devops', 'support', 'stats',
    'comm', 'biz', 'inbox', 'content', 'clients', 'hr', 'partners',
    'finance', 'sysmap', 'legal', 'templates', 'adslots', 'auditlog',
    'archive', 'games', 'feed', 'livegames', 'marketing', 'whatsapp',
    'kol-haam', 'pricing', 'ai-builder', 'masterconfig', 'shuka'
];
```

### `switchSATab(tabId)` (שורה 429) — Mapping:

| Tab | פונקציות שמופעלות |
|---|---|
| pulse | `updateSADashboard()` + `loadSADashboard()` + `loadSAPendingCenter()` |
| stats | `loadSAData()` |
| insights | `loadSAInsights()` |
| finance | `loadSAFinanceData()` |
| adslots | `renderAdSlotsPanel()` |
| clients | `switchViewTab('clients','environments')` |
| kol-haam | `loadSAKolHaamQueue()` |
| shuka | `renderSAShukaPanel()` |
| pricing | `renderPricingCatalogView()` |
| ai-builder | `initAIBuilder()` |
| masterconfig | `loadCldConfig()` + `loadEmailSettings()` |
| hr | `loadSAHRData()` |
| devops | `switchDevTab('matrix')` + `loadProductMatrix()` + `loadDevTasks()` |
| support | `loadSATickets()` |
| partners | `loadSAPartners()` |
| comm | `loadSACommunityData()` |
| biz | `loadSABusinesses()` |

---

## 5. Pulse — לוח בקרה ראשי

**תיאור:** מרכז שליטה ראשי — Live Activity Feed + Pending Actions + KPI row.

### KPI Row — אלמנטים (IDs):

```
d2-businesses | d2-families | d2-communities | d2-total-users | d2-online-now
d2-ai-calls   | d2-month-commission | d2-month-cashback
d2-open-tickets | d2-urgent-tickets | d2-unpaid-count | d2-debt-amount
d2-banner-pending | d2-zm-active | d2-zm-pending | d2-flow-issued
```

### API:
```javascript
loadSADashboard()  // GET /api/sa/dashboard
// מחזיר: stats, pending, finance, zm, flow, debtors, ai_top, growth, wallets_top
```

### Pending Actions Bar — chips ניתנות לחיצה:

| Chip | ניווט |
|---|---|
| `open_tickets` | → support tab |
| `biz_joins` | → comm/manage |
| `fam_joins` | → families tab |
| `banner_orders` | → adslots/orders |
| `zone_managers` | → partners |
| `unpaid_billing` | → finance/dues |
| `promos` | → comm/manage |
| `pending_communities` | → comm/table |
| `module_requests` | → biz tab |

### Live Activity Stream — `renderLivePulse()`:
```javascript
// GET /api/sa/live-pulse
// מחזיר מאורעות אחרונים: לקוח חדש, טיקט, תשלום, כניסה
// Polling: _saOnlinePoll = setInterval(updateSADashboard, 60000)
```

### Pending Actions Center — `loadSAPendingCenter()` (שורה 878):
```javascript
GET /api/sa/pending-actions-center
// מחזיר: categories[], total_pending, oldest_overall_hours, sql_errors[]
```
**קטגוריות:** tickets, debts, modules, community_join, biz_community, removal, promos, zm_pending, banners

**Color severity:**
- ירוק: `< 24h`
- כתום: `24–72h`
- אדום: `> 72h`

---

## 6. Dashboard — סטטיסטיקות מהירות

**תיאור:** overview לכל הפלטפורמה.

```javascript
// GET /api/sa/dashboard
// stats.businesses, stats.families, stats.communities
// finance.month_commission, finance.month_cashback
// debtors[] (top unpaid)
// ai_top[] (top AI users)
// growth[] (monthly chart data)
// wallets_top[] (top coin holders)
```

---

## 7. Insights — תובנות מאוחדות

**תיאור:** ניתוח KPIs לפי קטגוריות + טבלאות top-lists.

```javascript
loadSAInsights()  // שורה ~731
// GET /api/sa/unified-stats → _saInsightsData (KPIs per category)
// GET /api/sa/insights-top-lists → _saInsightsTopLists
```

### 6 קטגוריות:
`business` | `families` | `communities` | `finance` | `coins` | `entities`

### Range filter:
`all` / `today` / `month`

### KPI Drilldown:
```javascript
openSAKpiDetail(kpiKey)
// GET /api/sa/kpi-detail?kpi=X&range=Y&page=Z
// → modal עם טבלה מפורטת
```

---

## 8. Clients — ניהול סביבות (FAMILY + BIZ)

**תיאור:** ניהול כל סביבות הלקוחות — משפחות + עסקים — בטבלה מאוחדת.

### Globals:
```javascript
let saAllGroups = [];   // כל הסביבות (FAMILY + BUSINESS)
let saAllUsers = [];    // כל המשתמשים
```

### `loadSAData()` (שורה 2000):
```javascript
// GET /api/superadmin/data
// מחזיר: groups[], users[], stats, activity, settings
// → renderSAGroups(), saAllGroups, saAllUsers
```

### Sub-views (`switchViewTab('clients', view)`):

| View | תיאור |
|---|---|
| `environments` | טבלת סביבות ראשית |
| `users` | כל המשתמשים cross-group |
| `sc_customers` | לקוחות Storefront (SC) |
| `snapshots` | גיבויים |

### `renderSAGroups()` — Filters:

- **Filter type:** `all` / `FAMILY` / `BUSINESS` (כפתורי chips)
- **חיפוש חכם:** לפי שם סביבה, group_code, שם/טלפון של משתמש
- **Pagination:** 25 סביבות לעמוד

### תגי סטטוס לכל סביבה:

| תג | מצב |
|---|---|
| `Solo` | plan=solo |
| `👨‍👩‍👧 Member` | member_type=member (WEFLOWZ) |
| `Standard/Premium/Enterprise` | plan field |
| `⏳ ממתין לאישור` | account_status=pending_activation |
| `❄️ מוקפא` | account_status=frozen |
| `📦 ארכיב` | account_status=archived |
| `🎁 הטבה` | trial_until בעתיד (עסק) |
| `🔔 בקשות` | module_requests pending |
| `🟣 חבר WEFLOWZ` | member_type=member |

### פעולות על סביבה:

| פעולה | API | שדות |
|---|---|---|
| כניסה לסביבה | `window.impersonateGroup(groupId, userId)` | — |
| עדכון פרטים | `PUT /api/sa/groups/:id` | name, adminEmail, city, billingConfig |
| שינוי תוכנית | `saPlanChange(groupId, plan)` | plan |
| הקפאה | `POST /api/sa/groups/:id/freeze` | reason |
| ביטול הקפאה | `saUnfreezeGroup(groupId)` | — |
| מחיקה | `saDeleteGroup(groupId)` | — |
| גיבויים | `openSnapshotsModal(groupId)` | — |
| מיזוג כפילות | `openMergeDuplicateModal(groupId)` | FAMILY בלבד |
| WhatsApp | `openSAWhatsAppModal(groupId)` | BIZ בלבד |
| שדרוג לMember→Family | `saUpgradeToFamily(groupId)` | — |
| סימון כסביבת טסט | `saToggleTestEnv(groupId)` | — |
| ניהול billing | `openSABillingModal(groupId)` | — |
| ניהול הטבה | `manageTrial(groupId)` | BIZ בלבד |
| שליחת פרטי כניסה | `saResendSoloCredentials(groupId)` | pending_activation בלבד |

### `FAMILY` Plans:
`solo` | `member` | `standard` | `premium` | `enterprise`
- **AI tokens:** solo=10/day, standard=10/day, premium=50/day, enterprise=unlimited

### `FAMILY` Modules — `SA_MODULE_LIST` (17 מודולים):

```javascript
const SA_MODULE_LIST = [
    { key:'bank', icon:'🏦', name:'הבנק המשפחתי' },
    { key:'cashflow', ... }, { key:'budget', ... },
    { key:'forecast', ... }, { key:'tasks', ... },
    { key:'shop', ... }, { key:'pantry', ... },
    { key:'recipes', ... }, { key:'community', ... },
    { key:'members', ... }, { key:'academy', ... },
    { key:'home-maintenance', ... }, { key:'kids-wallet', ... },
    { key:'kids-mode', ... }, { key:'supermarket-mode', ... },
    { key:'ai-assistant', ... }, { key:'expense-tracking', ... }
];
```

**ניהול מודולים:**
```javascript
// PATCH /api/sa/groups/:id/modules { modules: [] }
// PATCH /api/sa/groups/:id/module-request { moduleId, action: 'approve'|'deny' }
```

### Storefront Customers (SC) (שורה 1114):
```javascript
// GET /api/sa/sc-customers?search=X&limit=25&offset=Y
// POST /api/sa/sc-customers/:id/reset-pin → SMS reset
```

---

## 9. Comm — ניהול קהילות

**תיאור:** ניהול מלא של קהילות — יצירה, שיוך, אישור עסקים, מבצעים, שגרירים.

```javascript
loadSACommunityData()
// GET /api/sa/communities → saCommunitiesCache
// GET /api/sa/businesses  → saBusinessesCache
```

### Globals:
```javascript
let saCommunitiesCache = [];
let saBusinessesCache = [];
```

### Sub-views:

| View | תיאור |
|---|---|
| `table` | טבלת קהילות ראשית |
| `manage` | הקמה ושיוך (קהילה ↔ עסק) |

### כלים מתקדמים (Advanced Toolbar):

| כלי | פונקציה |
|---|---|
| 🗺️ מפת קהילות | `openCommunitiesMap()` |
| 📢 אישור מבצעים | `openSAPromotionsPanel()` |
| 🌟 שגרירי קהילה | `openSAReferralsPanel()` |
| 📦 חבילות קהילה | `openSABundlesPanel()` |
| 🎯 התאמת עסקים | `openBusinessMatchStandalonePanel()` |
| 🖼️ בקשות באנר | `openSABannerRequestsPanel()` |
| ⚡ ניהול FLOW | `openFlowConfigPanel()` |

### Business-Community Status Flow:

```
pending → zm_pending → pending_cm_review → comm_mgr_pending → biz_invited → active
```

**Override SA:**
```javascript
overrideApproveSABiz(communityId, businessId)
overrideRejectSABiz(communityId, businessId)
```

### מאמרים לקהילה:
```javascript
// GET /api/sa/articles → articles[]
// POST /api/sa/articles { title, body, image_url, community_id }
// DELETE /api/sa/articles/:id
```

### Platform Rates:
```javascript
savePlatformRates()
// PUT /api/sa/settings/rates { platform_commission_pct, community_cashback_pct }
```

---

## 10. Biz — ניהול עסקים

**תיאור:** ניהול עסקים שנרשמו לפלטפורמה — אישור, מודולים, billing.

```javascript
loadSABusinesses()
// GET /api/sa/businesses → saBusinessesCache
```

### פעולות על עסק:

| פעולה | API |
|---|---|
| אישור בקשת מודול | `PATCH /api/sa/groups/:id/module-request { moduleId, action:'approve' }` |
| דחיית בקשת מודול | `PATCH /api/sa/groups/:id/module-request { moduleId, action:'deny' }` |
| עדכון billing | `POST /api/sa/groups/:id/billing { billing_config }` |
| ניהול trial | `manageTrial(groupId, event)` |

### `billing_config` structure:
```javascript
{
    modules: [{ id, billing, custom_price }],
    extra_users_cost: number
}
```

---

## 11. Support — מערכת קריאות שירות

**תיאור:** ניהול מלא של קריאות תמיכה — צ'אט, SLA, מיון לפיתוח.

```javascript
loadSATickets()
// GET /api/superadmin/tickets → saTicketsCache
```

### Globals:
```javascript
let saTicketsCache = [];
let saCurrentTicketId = null;  // טיקט פתוח כרגע
```

### פעולות:

| פעולה | API | שדות |
|---|---|---|
| מענה לטיקט | `POST /api/superadmin/tickets/:id/reply` | message, status, isInternal, senderName |
| מיון וסיווג | `POST /api/superadmin/tickets/:id/assign_and_classify` | assignedTeam, priority, ticketType, auditNote |
| מחיקה | `DELETE /api/superadmin/tickets/:id` | — |
| פתיחת טיקט יזום | `POST /api/superadmin/tickets` | subject, description, group_id |
| עדכון SLA Matrix | `POST /api/sa/sla-matrix { sla: [] }` | — |

### Chat View:
- **הודעות רגילות:** גלויות ללקוח
- **Internal Notes (כתום):** גלויות לצוות בלבד (`isInternal: true`)
- **Milestones:** entries עם `[SYSTEM_AUDIT]` ב-log

### SLA System:
```javascript
saSlaRulesCache  // טבלת כללי SLA
getTicketSlaMaxHours(type, priority)
// → SLA badge עם animate-pulse כשהשעות חורגות
```

### Ticket Status Flow:
`open` → `in_progress` → `pending_customer` → `resolved` → `closed`

### העברה לפיתוח:
```javascript
sendTicketToALM()   // → switchSATab('devops') + switchDevTab('alm')
sendTicketToQA()    // → switchSATab('devops') + switchDevTab('qa')
```

---

## 12. DevOps — פיתוח, קנבן ו-QA

**תיאור:** לוח קנבן לניהול משימות פיתוח + ספר מוצר QA + כלי ALM.

### Sub-tabs (`switchDevTab(tabId)`):

| Tab | תיאור |
|---|---|
| `matrix` | ספר מוצר QA |
| `kanban` | לוח קנבן |
| `alm` | ALM Hub |
| `qa` | QA Staging |
| `release` | מרכז השקות |

### Kanban Board — `loadDevTasks()`:
```javascript
// GET /api/sa/dev/tasks → devKanbanTasks[]
```

**עמודות:** `backlog` | `in_progress` | `qa` | `done`

**Task fields:** id, title, type, priority, status, desc, version, owner_id, original_ticket_id

**סוגי משימות:** bug | feature | ui | tech

**עדיפויות:** critical 🚨 | high 🔴 | normal 🟡 | low 🔵

**Drag & Drop:** `dragKanbanTask()` + `dropKanbanTask(ev, newStatus)`
- חסום: מעבר ידני מ-`in_progress` ל-`done` (עובר רק דרך QA בספר)

### פעולות Kanban:

| פעולה | API |
|---|---|
| יצירת משימה | `POST /api/sa/dev/tasks { title, type, priority, status, description, owner_id, original_ticket_id }` |
| עדכון משימה | `PUT /api/sa/dev/tasks/:id` |
| שינוי סטטוס | `PUT /api/sa/dev/tasks/:id/status { status }` |
| מחיקה | `DELETE /api/sa/dev/tasks/:id` |

**Notification Sync:** בכל `loadDevTasks()`, משווה ל-`sa_last_known_tasks` ב-localStorage. שולח `addSANotification()` כשמשימה עוברת `in_progress→qa`, `qa→done`, או מקבל version target.

### Product Matrix (ספר מוצר QA):
```javascript
loadProductMatrix()
// GET /api/sa/matrix → productMatrixData[]
// PUT /api/sa/matrix/:id/status { status: 'passed'|'failed'|'in_dev' }
// POST /api/sa/matrix { environment, moduleName, scenarioName, expectedResult }
// DELETE /api/sa/matrix/:id
```

**סביבות:** family | business | community | sa | book

**Pagination:** 15 פריטים לעמוד

**Bug Reporting:** כשסטטוס = `failed` → `openDevBugModal()` → לוח קנבן

### Release Center:
```javascript
generateReleaseNotesAI()
// POST /api/sa/ai-generate { query, context }
// → HTML newsletter template

broadcastReleaseNotes()
// POST /api/sa/inbox/broadcast { targetType, targetValue, subject, content }
// targetType: 'all' | 'all_families'
```

**פלט:** HTML template עם גרדיאנט, לוגו, ניוזלטר. תמיכה ב-export PDF.

---

## 13. Finance — פיננסים ולינג

**תיאור:** דוחות פיננסיים, חייבים, עמלות, ו-billing overview.

```javascript
loadSAFinanceData()
// GET /api/sa/finance
```

### Sub-views:

| View | תיאור |
|---|---|
| `overview` | סיכום פיננסי כללי |
| `dues` | חייבים ותשלומים |
| `commissions` | עמלות Zone Managers |
| `wallets` | ארנקות + מטבעות |
| `billing` | billing configurations |

### ניהול Billing לסביבה:
```javascript
openSABillingModal(groupId, event)
// פותח מודאל עם billing_config editor
// שמירה: POST /api/sa/groups/:id/billing { billing_config }
```

### Platform Rates:
```javascript
// PUT /api/sa/settings/rates { platform_commission_pct, community_cashback_pct }
```

---

## 14. HR — צוות והרשאות

**תיאור:** ניהול צוות SA פנימי — צוותים, הרשאות, נציגים.

```javascript
loadSAHRData()
// GET /api/sa/teams  → saTeamsCache[]
// GET /api/sa/staff  → saStaffCache[]
```

### Globals:
```javascript
let saTeamsCache = [];
let saStaffCache = [];
```

### ניהול צוותים:

| פעולה | API | שדות |
|---|---|---|
| יצירת צוות | `POST /api/sa/teams { name, permissions[] }` | — |
| מחיקת צוות | `DELETE /api/sa/teams/:id` | — |

### ניהול נציג:

| פעולה | API |
|---|---|
| עדכון פרטי משתמש | `PATCH /api/superadmin/users/:id { nickname, phone, role, status, new_password, ... }` |
| מחיקת משתמש | `saDeleteUser(userId)` |

### הרשאות צוות (8 אפשרויות):

| ערך | תיאור |
|---|---|
| `support` | תמיכה וקריאות |
| `devops` | פיתוח ומוצר (QA) |
| `marketing` | שיווק והשקות |
| `stats` | דוחות ופיננסים |
| `biz` | ניהול עסקים |
| `comm` | ניהול קהילות |
| `users` | ניהול משתמשים/RBAC |
| `content` | מיתוג ובאנרים |

---

## 15. Content — תוכן ועיצוב

**תיאור:** ניהול תוכן ויזואלי — באנרים, הגדרות, לוגו, הודעות פתיחה.

### `loadSAData()` (שורה 2000):
```javascript
// GET /api/superadmin/data
// מחזיר:
// adBannerImgTop/Bottom — באנרים ל-FAMILY ו-BIZ
// globalAiLogo — לוגו FamilAI גלובלי
// loginSlides[] — שקופיות מסך כניסה
// memberWelcomeEnabled/Text/Img — הודעת ברוכים הבאים
// pwaInstallPromptEnabled — PWA prompt
```

### שמירת הגדרות:
```javascript
// POST /api/superadmin/settings { welcomeMsg? | businessWelcomeMsg? | adBannerImgTop? | ... }
```

### Login Slides:

```javascript
addLoginSlideImage(event)   // FileReader → Canvas resize → base64
toggleLoginSlide(idx)       // active/hidden
deleteLoginSlide(idx)       // מחיקה מ-loginSlidesCache
renderLoginSlidesAdmin()    // render רשימה
// שמירה: POST /api/superadmin/settings { loginSlides: [] }
```

### Module Popup Settings (17 מודולים):
```javascript
toggleModuleEnabled(key)     // on/off toggle ויזואלי
updateModuleField(key, field, value)  // title/text/img
// שמירה: POST /api/superadmin/settings { memberModuleSettings: {} }
```

**שדות לכל מודול:** `enabled`, `title`, `text`, `img` (base64)

---

## 16. Inbox — שיגור הודעות ושיווק

**תיאור:** שיגור הודעות לתיבת Inbox של לקוחות.

```javascript
sendSABroadcastMessage()
// POST /api/sa/inbox/broadcast
// { targetType, targetValue, subject, content }
```

### Target Types:

| ערך | קהל |
|---|---|
| `all` | כל העסקים |
| `all_families` | כל המשפחות |
| `specific` | ID ספציפי |

### Release Center Broadcast:
```javascript
broadcastReleaseNotes()
// audience: 'business' → targets=['all']
// audience: 'family'   → targets=['all_families']
// audience: 'all'      → targets=['all', 'all_families']
```

---

## 17. AdSlots — שטחי פרסום

**תיאור:** ניהול שטחי פרסום (banner slots) + הזמנות באנרים + לוח שנה.

```javascript
renderAdSlotsPanel()
// loadBannerSlotsPanel() — GET /api/sa/banner/slots
// loadBannerOrders()     — GET /api/sa/banner/orders?status=X
```

### Banner Slot — יצירה/עריכה:

| פעולה | API | שדות |
|---|---|---|
| יצירה | `POST /api/sa/banner/slots` | name, location_key, description, base_price_coins, base_price_ils |
| עדכון | `PUT /api/sa/banner/slots/:id` | name, description, base_price_coins, base_price_ils |
| קהילות | `PUT /api/sa/banner/slots/:id/communities { community_ids }` | — |
| מחירון | `PUT /api/sa/banner/slots/:id/pricing { pricing[] }` | duration_days/community_count, price_ils, price_coins |

### Pricing Rows (2 סוגים):

| סוג | שדות |
|---|---|
| **Duration** | duration_days, price_ils, price_coins |
| **Community Scale** | community_count, price_ils, price_coins |

### Banner Order Flow:
```
pending_approval → active → expired
                 ↓
             cancelled
```

**אישור הזמנה:**
```javascript
openBannerScheduleModal(orderId, slotId, durationDays, bizName, slotName, coinsUsed, cashAmount)
// בדיקת conflict: GET /api/sa/banner/slots/:id/availability?start=X&end=Y
// אישור: PUT /api/sa/banner/orders/:id/approve { start_date }
// ביטול: cancelBannerOrder(orderId)
```

---

## 18. Templates — תבניות BIZ

**תיאור:** ניהול נראות תבניות לפי סוג עסק — הצגה/הסתרה של tabs ופיצ'רים.

### `BIZ_TEMPLATE_TREE` (שורה 8610) — 6 סוגי עסקים:

| מפתח | שם |
|---|---|
| `restaurant` | מסעדה / בית קפה |
| `sport` | ספורט / כושר |
| `beauty` | יופי / קוסמטיקה |
| `maintenance_repair` | תיקונים ותחזוקה |
| `professionals` | מומחים / פרילנסרים |
| `retail` | קמעונאות / חנות |

**כל עסק:** מגדיר `elements[]` — רשימת tabs + features (עם children) שניתן להצגה/הסתרה.

---

## 19. Pricing — קטלוג מחירים

**תיאור:** קטלוג מחירים לתוכניות ומודולים.

```javascript
renderPricingCatalogView()
// טוען ומציג את קטלוג המחירים
```

---

## 20. AI Builder — בניית AI פרסונלי

**תיאור:** בניית AI assistant פרסונלי לעסק/קהילה.

```javascript
initAIBuilder()
// POST /api/sa/ai-generate { query, context }
// → Gemini-based generation
```

---

## 21. Masterconfig — הגדרות מערכת

**תיאור:** הגדרות מאסטר לכל הפלטפורמה — CloudConfig, Email, SMTP.

```javascript
loadCldConfig()      // GET /api/sa/config → cloudinary settings
loadEmailSettings()  // GET /api/sa/email-settings → SMTP config
```

### שדות הגדרות (מ-`loadSAData()`):

| שדה | תיאור |
|---|---|
| `smtpFromEmail` | כתובת שולח SMTP |
| `smtpFromName` | שם שולח |
| `adminNotificationEmail` | email להתראות |
| `saUsername` | שם מנהל ראשי |
| `saEmail` | email מנהל ראשי |

---

## 22. WhatsApp Hub

**תיאור:** ניהול חיבורי WhatsApp לעסקים.

```javascript
openSAWhatsAppModal(groupId, groupName)
// מנהל: wa_enabled flag + חיבור מספר WhatsApp לעסק
```

---

## 23. Kol Haam — תור תוכן ציבורי

**תיאור:** ניהול תור תוכן שמשתמשים שלחו לפרסום.

```javascript
loadSAKolHaamQueue()
// GET /api/sa/kol-haam-queue
// פעולות: אישור / דחייה / עריכה לפני פרסום
```

---

## 24. Shuka — כלים עסקיים חיצוניים

**תיאור:** "שוק" — כלים ואינטגרציות חיצוניות לעסקים.

```javascript
renderSAShukaPanel()
// מציג כלים חיצוניים + ניהול חיבורים
```

---

## 25. Partners — שותפים ו-Zone Managers

**תיאור:** ניהול Zone Managers (מנהלי אזור) + שותפים/מטמיעים.

### Zone Managers:

| פעולה | API |
|---|---|
| טעינה | `GET /api/sa/zone-managers` → zmCache |
| הגדרות | `GET /api/sa/zone-settings` → zmSettingsCache |
| ממתינים | `GET /api/sa/zone-managers/pending` |
| אישור | `PUT /api/sa/zone-managers/:id { status: 'active' }` |
| דחייה | `DELETE /api/sa/zone-managers/:id` |
| סיכום עמלות | `GET /api/sa/zone-managers/finance-summary` |
| Pilot Waitlist | `GET /api/sa/pilot-waitlist` → _pilotLeadsCache |
| עדכון ליד | `PATCH /api/sa/pilot-waitlist/:id { status / notes }` |
| מחיקת ליד | `DELETE /api/sa/pilot-waitlist/:id` |

### Zone Manager Status Flow:
`pending` → `active` | `rejected`

---

## 26. SysMap — מפת מערכת

**תיאור:** ויזואליזציה של מפת המערכת — קשרים בין סביבות.

---

## 27. Legal — מסמכים משפטיים

**תיאור:** עריכה ושמירה של 4 מסמכים משפטיים.

```javascript
loadLegalDocs()
// GET /api/sa/legal → legalDocsCache { key: html }
```

### מסמכים (`LEGAL_DOC_LABELS`):

| מפתח | שם |
|---|---|
| `legal_tos_family` | תקנון — משפחה |
| `legal_tos_business` | תקנון — עסקים |
| `legal_privacy` | מדיניות פרטיות |
| `legal_accessibility` | הצהרת נגישות |

### שמירה:
```javascript
saveLegalDoc()
// PUT /api/sa/legal/:key { content }
```

**עורך:** `contenteditable` div עם toolbar (bold/italic/underline/heading). `document.execCommand()`.

---

## 28. Stats — דוחות ומדדים

**תיאור:** דוחות מפורטים — מופעל על-ידי `loadSAData()`.

```javascript
// GET /api/superadmin/data
// → stats: { businesses, families, communities, users, ai_calls, ... }
// → activity: [] (latest events)
```

---

## 29. Live Games

**תיאור:** ניהול משחקים בזמן אמת.

---

## 30. Games — ניהול משחקים

**תיאור:** ניהול קטלוג המשחקים במערכת.

---

## 31. Feed — פיד תוכן

**תיאור:** ניהול תוכן ה-Feed הראשי.

---

## 32. Impersonation — כניסה לסביבת לקוח

**תיאור:** כניסה לסביבת לקוח (משפחה/עסק) מבלי לדעת את הסיסמה.

### `window.impersonateGroup(groupId, userId)` (שורה 5891):

```javascript
// 1. שמירת token SA הנוכחי: localStorage('ofl_sa_return_token')
// 2. ניקוי: ofl_sa_token, ofl_session, ofl_token
// 3. POST /api/sa/biz-impersonate-token { groupId, userId } → impersonate token
// 4. שמירה: ofl_session = { user, group, isImpersonating: true, token }
// 5. פתיחה: isBiz → /business.html | FAMILY → /
// 6. לאחר 2s: שחזור ofl_sa_token
```

**לוגיקת בחירת משתמש:**
1. `userId` מפורש → `saAllUsers.find(u => u.id === userId)`
2. ADMIN בקבוצה → `saAllUsers.find(u => u.group_id === groupId && u.role === 'ADMIN')`
3. כל משתמש בקבוצה → `saAllUsers.find(u => u.group_id === groupId)`
4. עסק ללא משתמש → mock user `{ id: 99999, role: 'ADMIN' }`

---

## 33. Notifications — מרכז התראות

**תיאור:** מרכז התראות פנימי לנציג SA.

### Storage: `localStorage('sa_notifs_' + userId)`

### פונקציות:

| פונקציה | תיאור |
|---|---|
| `addSANotification(text, type, ticketId)` | הוספת התראה |
| `renderSANotifications()` | render רשימה + badge count |
| `toggleSANotifications()` | פתיחה/סגירה dropdown |
| `markNotifRead(notifId)` | סימון כנקרא |
| `markAllNotifsRead()` | סימון הכל כנקרא |

**סוגים:** `info` | `success` | `warning`

---

## 34. Audit Log

**תיאור:** יומן ביקורת — כל הפעולות הרגישות במערכת.

---

## 35. Archive

**תיאור:** ארכיון סביבות שהוסרו.

---

## 36. מנגנונים טכניים רוחביים

### Polling:

| משתנה | interval | פונקציה |
|---|---|---|
| `_saPendingRefresh` | 60s | `loadSAPendingRequests()` |
| `_saOnlinePoll` | 60s | `updateSADashboard()` |

### Helper Functions:

| פונקציה | תיאור |
|---|---|
| `saFetch(path, opts)` | כל ה-API calls עם auth header |
| `getEl(id)` | `document.getElementById` shorthand |
| `val(id)` | `getEl(id).value` shorthand |
| `safeStr(str)` | XSS sanitization |
| `fmtGroupName(g)` | פורמט שם סביבה |
| `fmtUserName(u)` | פורמט שם משתמש |
| `showToast(type, msg)` | Toast notification |
| `switchDevTab(tabId)` | מעבר בין sub-tabs של DevOps |
| `switchViewTab(section, view)` | מעבר בין sub-views |

### URL Params Handling (window.onload):

| Param | פעולה |
|---|---|
| `?ticket=X` | פותח טיקט X ב-support |
| `?tab=X` | מנווט ל-tab X |
| `?tab=X&sub=Y` | מנווט ל-tab X + sub-view Y |

### AI Integration:

| API | שימוש |
|---|---|
| `POST /api/sa/ai-generate { query, context }` | Release Notes, ticket analysis, AI Builder |

---

*מסמך זה מתאר את סביבת SA בלבד. מסמכים מקבילים: [FAMILY_ENV_SPEC.md](./FAMILY_ENV_SPEC.md) | [BIZ_ENV_SPEC.md](./BIZ_ENV_SPEC.md) | ZM_ENV_SPEC.md (בהכנה)*
