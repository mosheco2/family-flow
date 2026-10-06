# סביבת ZM (Zone Manager) — מפרט טכני מלא
**Oneflow Life · מנתח מערכות · עומק מקסימלי**
גרסה: אוקטובר 2026

---

## תוכן עניינים

1. [זהות הסביבה](#1-זהות-הסביבה)
2. [כניסה ואוטנטיקציה](#2-כניסה-ואוטנטיקציה)
3. [מבנה הניווט — Tabs](#3-מבנה-הניווט--tabs)
4. [Dashboard — לוח בקרה ראשי](#4-dashboard--לוח-בקרה-ראשי)
5. [Pending Panel — בקשות ממתינות](#5-pending-panel--בקשות-ממתינות)
6. [Zones — אזורים וקהילות](#6-zones--אזורים-וקהילות)
7. [Biz Requests — אישור בקשות עסקים](#7-biz-requests--אישור-בקשות-עסקים)
8. [Community Detail — מידע מלא על קהילה](#8-community-detail--מידע-מלא-על-קהילה)
9. [Community Manager — מינוי מנהלי קהילה](#9-community-manager--מינוי-מנהלי-קהילה)
10. [Marketing — קמפיינים ולידים](#10-marketing--קמפיינים-ולידים)
11. [Leads — ניהול לידים (CRM)](#11-leads--ניהול-לידים-crm)
12. [Inbox — הודעות עם מנהלי קהילות](#12-inbox--הודעות-עם-מנהלי-קהילות)
13. [Commissions — עמלות](#13-commissions--עמלות)
14. [Content — מאמרים לקהילות](#14-content--מאמרים-לקהילות)
15. [Kol Haam — אישור תוכן](#15-kol-haam--אישור-תוכן)
16. [קמפיין קהילתי — Community Campaign](#16-קמפיין-קהילתי--community-campaign)
17. [מנגנונים טכניים רוחביים](#17-מנגנונים-טכניים-רוחביים)

---

## 1. זהות הסביבה

| שדה | ערך |
|---|---|
| URL | `/zone-manager.html` |
| JS ראשי | `public/zone-manager-app.js` (2,294 שורות) |
| API constant | `const API = hostname==='localhost' ? 'http://localhost:3000/api' : '/api'` |
| מטרה | ניהול אזורים גיאוגרפיים — קהילות, עסקים, משפחות, קמפיינים ועמלות |
| קהל יעד | Zone Managers — שותפים חיצוניים שמנהלים אזור גיאוגרפי |
| Auth header | `Authorization: <token>` — **ללא** `Bearer` |
| Token storage | `localStorage('zm_token')` + `localStorage('zm_manager')` + `window.zmToken` |

**הבדל מ-SA:** ZM הוא שותף חיצוני (לא עובד פנימי). מרחיב את הפלטפורמה לאזורים גיאוגרפיים ומרוויח עמלות על פעילות.

---

## 2. כניסה ואוטנטיקציה

### Auth Tabs (5 מצבים):

| Tab | תיאור |
|---|---|
| `login` | כניסה רגילה (email + password) |
| `register` | הרשמה חדשה (שם + email + password + טלפון) |
| `pending` | מסך המתנה לאחר הרשמה — ממתין לאישור SA |
| `forgot` | איפוס סיסמה — שליחת email |
| `reset` | הגדרת סיסמה חדשה (מ-URL עם `?reset=<token>`) |

### Login:
```javascript
zmLogin()
// POST /api/zone-manager/login { email, password }
// ← { token, manager: { id, name, email, phone } }
// → localStorage: zm_token + zm_manager (JSON)
// → showDashboard() + loadDashboard()
```

### Register:
```javascript
zmRegister()
// POST /api/zone-manager/register { name, email, password, phone }
// שדות חובה: name, email, password (מינימום 6 תווים)
// ← success → zmSwitchAuthTab('pending')  // ממתין לאישור SA
```

### Password Reset Flow:
```javascript
zmForgotSubmit()
// POST /api/zone-manager/forgot-password { email }

zmResetSubmit()
// POST /api/zone-manager/reset-password { token, password }
// token מ-URL param: ?reset=<token>
// ← success → setTimeout 2.5s → zmSwitchAuthTab('login')
```

### Logout:
```javascript
zmLogout()
// מנקה: zm_token, zm_manager מ-localStorage
// מנקה: _zmPendingRefresh interval
```

### `window.onload` (שורה 10):
1. בדיקת URL param `?reset=X` → מצב reset
2. שחזור session מ-localStorage
3. `showDashboard()` + `loadDashboard()`
4. Polling: `_zmPendingRefresh = setInterval(loadZMPendingPanel, 60000)`

---

## 3. מבנה הניווט — Tabs

```javascript
zmSwitchTab(tab)
// tabs: ['zones', 'biz-requests', 'marketing', 'leads', 'inbox', 'commissions', 'content', 'kol-haam']
```

| Tab | תיאור | פונקציות שמופעלות |
|---|---|---|
| `zones` | אזורים וקהילות | *(ברירת מחדל — נטען ב-loadDashboard)* |
| `biz-requests` | בקשות עסקים ממתינות | `zmLoadPendingBiz()` |
| `marketing` | קמפיינים + תבניות הודעה | `loadCampaigns()` + `loadTemplates()` |
| `leads` | ניהול לידים מקמפיינים | `loadLeadsTab()` |
| `inbox` | צ'אט עם מנהלי קהילות | `loadInbox()` |
| `commissions` | דוח עמלות | `loadCommissions()` |
| `content` | מאמרים לפרסום בקהילות | `zmLoadContent()` |
| `kol-haam` | אישור תוכן קול העם | `zmLoadKolHaamQueue()` |

---

## 4. Dashboard — לוח בקרה ראשי

```javascript
loadDashboard()
// GET /api/zone-manager/dashboard → zmData
// zmData: { zones[], communities[], commissions, settings }
```

### Globals:
```javascript
let zmToken = null;
let zmManager = null;     // { id, name, email, phone }
let zmData = null;        // כל נתוני הדשבורד
let zmCampaigns = [];
```

### KPI Stats (IDs):

| ID | תוכן |
|---|---|
| `zm-stat-zones` | מספר אזורים משויכים |
| `zm-stat-communities` | מספר קהילות |
| `zm-stat-comm-total` | סה"כ עמלות שנצברו (₪) |
| `zm-stat-comm-month` | עמלות החודש (₪) |
| `zm-stat-paid-total` | סה"כ עמלות ששולמו (₪) |
| `zm-stat-paid-month` | שולמו החודש (₪) |

### Progress Bars:
- `zm-paid-total-bar` + `zm-paid-total-pct` — אחוז תשלום כולל
- `zm-paid-month-bar` + `zm-paid-month-pct` — אחוז תשלום החודש

### Community Thresholds (`data.settings`):
```javascript
community_min_families  = settings.community_min_families  || 30
community_min_businesses = settings.community_min_businesses || 15
// → progress bar: families/30, businesses/15
// → badge: "✓ פעילה" כשהגיעה ליעד, "⏳ בהתפתחות" לפני
```

---

## 5. Pending Panel — בקשות ממתינות

**תיאור:** פאנל קבוע בראש הדשבורד + polling כל 60 שניות. מאחד 4 סוגי בקשות.

```javascript
loadZMPendingPanel()
// 4 fetch במקביל:
// GET /api/zone-manager/pending-businesses
// GET /api/zone-manager/pending-families
// GET /api/zone-manager/pending-removals
// GET /api/zone-manager/invited-businesses
```

### 4 קטגוריות בקשות:

| סוג | מקור | פעולות |
|---|---|---|
| **משפחות ← קהילה** | `famPending[]` | אשר / דחה |
| **עסקים שהוזמנו** | `invitedPending[]` | אשר / דחה |
| **עסקים ← בקשה** | `bizPending[]` | אשר / דחה |
| **הסרת עסק** | `removalPending[]` | אשר הסרה / דחה |

### Badge: `zm-pending-biz-badge` — `total` = sum(כל הסוגים)

---

## 6. Zones — אזורים וקהילות

**תיאור:** תצוגת כרטיסיות לפי אזור — רשימת קהילות עם progress bars ופעולות.

### `renderZones(data)` (שורה 543):

```javascript
// data.zones[] → כל האזורים המשויכים לZM
// data.communities[] → כל הקהילות (עם zone_id)
```

### כרטיסיית קהילה:

| שדה | תוכן |
|---|---|
| כותרת | שם קהילה + עיר |
| Badge סטטוס | ✓ פעילה (ירוק) / ⏳ בהתפתחות (כתום) |
| Progress bar | משפחות: X/30 · עסקים: X/15 |
| כפתור פרטים | `openCommunityDetail(id, name)` → modal |
| כפתור מנהל | `openZMAppointModal(id, name)` → modal |

### `community.has_local_manager` → badge "יש מנהל קהילה" (סגול) / "מנה מנהל קהילה" (אפור)

---

## 7. Biz Requests — אישור בקשות עסקים

**תיאור:** כרטיסיות עסקים ממתינים בחלוקה לפי סוג בקשה.

### `zmLoadPendingBiz()` — 3 fetch במקביל:

```javascript
// GET /api/zone-manager/pending-businesses   → pending[]
// GET /api/zone-manager/pending-removals      → removals[]
// GET /api/zone-manager/invited-businesses    → invited[]
```

### Flow הצטרפות עסק לקהילה:

```
[SA creates community] → [BIZ joins or ZM invites] → [ZM approves] → active
```

**מקביל:** ZM יכול להזמין עסק בעצמו דרך `openZMInviteBizModal()`. אם העסק מאשר — ZM מאשר בשלב נוסף (`approve-invited`).

### פעולות אישור:

| פעולה | API | תנאי |
|---|---|---|
| אשר עסק שהגיש בקשה | `POST /api/zone-manager/community-business/approve { communityId, businessId }` | בקשה מהעסק |
| דחה עסק | `POST /api/zone-manager/community-business/reject { communityId, businessId }` | בקשה מהעסק |
| אשר עסק שהוזמן | `POST /api/zone-manager/community-business/approve-invited { communityId, businessId }` | ZM הזמין |
| דחה עסק שהוזמן | `POST /api/zone-manager/community-business/reject-invited { communityId, businessId }` | ZM הזמין |
| אשר הסרת עסק | `POST /api/zone-manager/community-business/approve-removal { communityId, businessId }` | מנהל קהילה ביקש |
| דחה הסרה | `POST /api/zone-manager/community-business/decline-removal { communityId, businessId }` | מנהל קהילה ביקש |

### הזמנת עסק לקהילה — `openZMInviteBizModal(commId, commName)`:
```javascript
// חיפוש: GET /api/community/search-business?q=X → { businesses[] }
// שליחת הזמנה: POST /api/zone-manager/invite-business { communityId, businessId }
```

### עדכון אחוז הנחה:
```javascript
openZMDiscountEdit(commId, bizId, current)
// PUT /api/zone-manager/community-business/discount { communityId, businessId, discountPct }
```

### אישור משפחות:
```javascript
zmApproveFamilyFromPanel(groupId, communityId)
// POST /api/zone-manager/community-family/approve { groupId, communityId }

zmRejectFamilyFromPanel(groupId, communityId)
// POST /api/zone-manager/community-family/reject { groupId, communityId }
```

---

## 8. Community Detail — מידע מלא על קהילה

**תיאור:** Modal מפורט לכל קהילה — 5 Tabs: משפחות, עסקים, מבצעים, FLOW, קמפיין.

```javascript
openCommunityDetail(commId, encodedName)
// GET /api/zone-manager/community-detail/:commId
// → _cdData: { community, families[], businesses[], promos[], flowTransactions[], flowBalance }
```

### `switchCDTab(tab)` — 5 Tabs:

| Tab | תוכן |
|---|---|
| `families` | משפחות ממתינות (אשר/דחה) + פעילות (פרטים, מינוי מנהל) |
| `businesses` | עסקים פעילים + כפתור הזמן עסק + עדכון הנחה |
| `promos` | מבצעים פעילים בקהילה (קריאה בלבד) |
| `flow` | יתרת FLOW + לוג פעולות FLOW |
| `campaign` | קמפיינים קהילתיים (ר' סעיף 16) |

### KPI bar בראש ה-modal (IDs):
`zm-cd-stat-families` | `zm-cd-stat-businesses` | `zm-cd-stat-promos` | `zm-cd-stat-flow`

### Family Detail — `openZMFamilyDetail(groupId)`:
```javascript
// GET /api/zone-manager/family-detail/:groupId
// → { group, users[], communities[], flowBalance }
// מוצג: קוד קבוצה, email, Flw, משתמשים, קהילות
// פעולה: zmSetManagerFromFamily(groupId, communityId, isManager, btn)
```

### FLOW Action Labels:
```javascript
const actionLabels = {
    join_community: 'הצטרפות לקהילה',
    referral: 'הפניית שגריר',
    promo_redemption: 'מימוש מבצע',
    ambassador_approved: 'שגריר אושר',
    biz_join_approved: 'עסק הצטרף',
    bundle_purchase: 'רכישת חבילה',
    review_business: 'ביקורת עסק',
    daily_login: 'כניסה יומית'
};
```

---

## 9. Community Manager — מינוי מנהלי קהילה

**תיאור:** ZM ממנה נציג מקהילה לתפקיד "מנהל קהילה" (community manager).

### `openZMAppointModal(communityId, communityName)`:
- פותח modal + `zmAppointCommunityId = communityId`
- קורא `zmSearchMembers()` → רשימת חברי קהילה

```javascript
zmSearchMembers()
// GET /api/zone-manager/communities-members?communityId=X&q=Y
// → members[]: { group_id, name, admin_email, is_community_manager }
```

### `zmSetCommunityManager(groupId, isManager)`:
```javascript
// POST /api/zone-manager/set-community-manager { groupId, communityId, isManager }
// isManager: true → מינוי | false → הסרה
```

### מינוי ישיר מתוך Family Detail:
```javascript
zmSetManagerFromFamily(groupId, communityId, isManager, btn)
// אותו API: POST /api/zone-manager/set-community-manager
// מרענן: family detail modal
```

---

## 10. Marketing — קמפיינים ולידים

**תיאור:** יצירת קמפיינים לגיוס לידים (משפחות/עסקים/קהילה) + תבניות הודעה.

### Globals:
```javascript
let zmCampaigns = [];  // cache של כל הקמפיינים
```

### `loadCampaigns()`:
```javascript
// GET /api/zone-manager/campaigns → zmCampaigns[]
// campaign: { id, title, subtitle, text_content, campaign_type, image_url, fields_config[], lead_count, token, created_at }
```

### Campaign Links:

| סוג | URL |
|---|---|
| Landing page | `{origin}/campaign.html?t={token}` |
| OG Share (ווצאפ) | `{origin}/c/camp/{token}` |
| WhatsApp direct | `https://wa.me/?text={encodedText}` |

### Campaign Types:
```javascript
{ business:'🏪 עסקים', family:'👨‍👩‍👧 משפחות', community_join:'🤝 קהילה', general:'כללי' }
```

### Lead Form Fields (checkboxes):
`name` | `last_name` | `business_name` | `address` | `city` | `phone` | `email` | `free_text`

### Module Selection (לפי סוג קמפיין):
- `business` → `zm-modules-business` (מודולי עסק)
- `family` → `zm-modules-family` (מודולי משפחה)

### פעולות קמפיין:

| פעולה | API | שדות |
|---|---|---|
| יצירה | `POST /api/zone-manager/campaigns` | title, subtitle, text_content, fields_config[], campaign_type, image_url |
| עריכה | `PUT /api/zone-manager/campaigns/:id` | אותם שדות |
| מחיקה | `DELETE /api/zone-manager/campaigns/:id` | — |

### AI בקמפיין:

| פונקציה | API | שדות |
|---|---|---|
| יצירת טקסט | `zmAIDraftCampaign()` | `POST /api/zone-manager/ai/draft-campaign { goal, audience, campaignType, modules[] }` |
| יצירת תמונת banner | `zmAIGenerateBanner()` | `POST /api/zone-manager/ai/generate-banner { title, campaignType }` |
| הצעת תשובה | `zmAISuggestReply()` | `POST /api/zone-manager/ai/suggest-reply { threadId }` |
| ניתוח לידים | `analyzeLeads(campId)` | `POST /api/zone-manager/ai/analyze-leads { campaignId }` |

### Banner Upload (local):
```javascript
zmHandleImageUpload(input)
// FileReader → base64 (max 2MB)
// → zmSetBannerPreview(url)
```

### Message Templates:

| פעולה | API | שדות |
|---|---|---|
| טעינה | `GET /api/zone-manager/templates` | — |
| יצירה | `POST /api/zone-manager/templates` | name, subject, content |
| מחיקה | `DELETE /api/zone-manager/templates/:id` | — |
| שימוש | `useTemplate(id)` → `openZMNewMessage()` | ממלא subject + content |

---

## 11. Leads — ניהול לידים (CRM)

**תיאור:** מעקב וניהול לידים לפי קמפיין, עם AI scoring ו-CRM מלא.

### `loadLeadsTab()` + `viewCampaignLeads(campId)`:
```javascript
// GET /api/zone-manager/campaigns/:id/leads → { leads[] }
// lead: { id, data, status, lead_type, ai_score, ai_notes, crm_notes, created_at }
```

### Lead Status Flow:
```
new → contacted → interested → not_interested → converted
```

### Status Labels:
```javascript
const LEAD_STATUS_LABELS = {
    new: '🆕 חדש',
    contacted: '📞 פנינו',
    interested: '✅ מתעניין',
    not_interested: '❌ לא מתעניין',
    converted: '🎉 הצטרף!'
};
```

### Lead Types:
```javascript
const LEAD_TYPE_LABELS = { business:'🏪 עסק', family:'👨‍👩‍👧 משפחה', unknown:'❓ לא ידוע' };
```

### AI Score:
- `ai_score >= 8` → ירוק (איכות גבוהה)
- `ai_score 5-7` → כתום (בינוני)
- `ai_score < 5` → אדום (איכות נמוכה)
- `null/undefined` → אפור (לא נותח)

### `analyzeLeads(campId)`:
```javascript
// POST /api/zone-manager/ai/analyze-leads { campaignId }
// → מחזיר leads[] עם ai_score + ai_notes
```

### Lead CRM Modal — `openLeadCRMWithData(leadId, lead)`:

**שדות לעדכון:**
```javascript
// PUT /api/zone-manager/leads/:id { lead_type, status, crm_notes }
```

**Lead Actions (היסטוריה):**
```javascript
// GET /api/zone-manager/leads/:id/actions → { actions[] }
// POST /api/zone-manager/leads/:id/actions { action_type, notes }
```

### Action Types:
```javascript
const ACTION_LABELS = {
    call: 'שיחה',
    whatsapp: 'ווצאפ',
    meeting: 'פגישה',
    email: 'מייל',
    other: 'הערה'
};
```

---

## 12. Inbox — הודעות עם מנהלי קהילות

**תיאור:** צ'אט בין ZM למנהלי קהילות (1-on-1 + broadcast).

### Globals:
```javascript
let zmCurrentThreadId = null;  // thread פתוח כרגע
let zmIsBroadcast = false;      // האם מצב broadcast
```

### `loadInbox()`:
```javascript
// GET /api/zone-manager/inbox → { threads[] }
// thread: { id, group_name, community_name, last_message, last_message_at, unread_count }
// → badge: zm-inbox-badge = totalUnread
```

### `openZMThread(threadId)`:
```javascript
// GET /api/zone-manager/inbox/:threadId
// → { thread: { subject, group_name, community_name }, messages[] }
// message: { content, sender_type: 'manager'|'user', created_at }
```

**כיוון הודעות:**
- `sender_type === 'manager'` → כחול (ZM שלח)
- `sender_type !== 'manager'` → לבן/אפור (מנהל קהילה שלח)

### פעולות:

| פעולה | API | שדות |
|---|---|---|
| תשובה לthread | `POST /api/zone-manager/inbox/:threadId/reply { content }` | — |
| הודעה חדשה | `POST /api/zone-manager/inbox/new { communityId, groupId, subject, content }` | — |
| Broadcast | `POST /api/zone-manager/inbox/broadcast { subject, content }` | לכל מנהלי הקהילות |
| הצעת תשובה AI | `POST /api/zone-manager/ai/suggest-reply { threadId }` | — |

### `openZMNewMessage()` — בחירת יעד:
```javascript
// טוען: zmData.communities.filter(c => c.has_local_manager)
// → dropdown של קהילות עם מנהל פעיל
// מציאת manager: GET /api/zone-manager/communities-members?communityId=X&q=
// מחזיר: members[].find(m => m.is_community_manager).group_id
```

### `openZMBroadcast()`:
- `zmIsBroadcast = true`
- מסתיר dropdown בחירת קהילה
- שולח ל-broadcast endpoint

---

## 13. Commissions — עמלות

**תיאור:** דוח עמלות שנצברו מפעילות קהילות.

```javascript
loadCommissions()
// GET /api/zone-manager/commissions → { commissions[] }
// commission: { community_name, description, amount, created_at }
```

### Summary (מ-Dashboard):
```javascript
data.commissions = {
    total,        // סה"כ שנצבר
    month,        // החודש
    total_paid,   // סה"כ ששולם
    month_paid    // ששולם החודש
}
```

---

## 14. Content — מאמרים לקהילות

**תיאור:** ZM יכול לפרסם מאמרים לכל קהילות האזור שלו, או לקהילה ספציפית.

**הערה:** Tab זה משתמש בנתיב API שונה — `/api/zm/` (עם prefix שונה) ו-`Authorization: Bearer <token>`.

```javascript
zmLoadContent()
// GET /api/zm/zones { Authorization: 'Bearer ' + token } → { communities[] }
// GET /api/zm/articles { Authorization: 'Bearer ' + token } → { articles[] }
// article: { id, title, community_name, published_at }
```

### `zmPublishArticle()`:
```javascript
// POST /api/zm/articles { title, body, image_url, community_id }
// community_id: null → מתפרסם לכל קהילות האזור
// Authorization: 'Bearer ' + token
```

### `zmDeleteArticle(id)`:
```javascript
// DELETE /api/zm/articles/:id { Authorization: 'Bearer ' + token }
```

**שים לב:** שני פורמטי Auth בשימוש — `Authorization: zmToken` (רוב ה-API) ו-`Authorization: Bearer ${token}` (כאן). API אחר!

---

## 15. Kol Haam — אישור תוכן

**תיאור:** ZM מאשר/דוחה תוכן ממשתמשים שהוגש לפרסום ב"קול העם".

```javascript
zmLoadKolHaamQueue()
// GET /api/kol-haam/zm/queue { Authorization: zmToken }
// → { items[] }
// item: { id, title, summary, author_name, community_name, scope_type, cover_image_url, created_at }
```

### Scope Types:
- `GLOBAL` → תוכן גלובלי (סגול)
- לא `GLOBAL` → תוכן מקומי (כחול)

### פעולות:

| פעולה | API |
|---|---|
| אישור | `POST /api/kol-haam/zm/:id/approve` |
| דחייה | `POST /api/kol-haam/zm/:id/reject { reason }` (אופציונלי) |

---

## 16. קמפיין קהילתי — Community Campaign

**תיאור:** ZM יוצר קמפיינים קהילתיים (שוק מקומי) — עמוד ציבורי עם מוצרים מעסקים של הקהילה.

גישה: Community Detail modal → Tab `campaign`

### Flow מלא:

```
ZM יוצר קמפיין → הגדרת כותרת/לוגו/באנר/סלוגן → הזמנת עסקים → 
  ← עסק מאשר ומוסיף מוצרים → ZM מאשר מוצרים → פרסום ציבורי
```

### יצירת קמפיין — `zmCreateCommunityCampaign(commId)`:
```javascript
// POST /api/zone-manager/community-campaigns { communityId, title, code }
// code: unique slug לנתיב הציבורי (/campaign/:code)
```

### הגדרות קמפיין — `zmSaveCampaignSettings(campaignId, commId)`:
```javascript
// PATCH /api/zone-manager/community-campaigns/:id { title, slogan, logoUrl, bannerImageUrl, hideTitle, shareDescription, orderingEnabled }
```

| שדה | תיאור |
|---|---|
| `title` | כותרת (אופציונלי — אם כבר בתמונה) |
| `hide_title` | הסתר כותרת מהעמוד |
| `slogan` | משפט קצר לציבור |
| `logo_url` | לוגו הקמפיין (base64 upload) |
| `banner_image_url` | תמונת נושא/רקע |
| `share_description` | טקסט תצוגה מקדימה בווצאפ (OG) |
| `ordering_enabled` | מאפשר/חוסם הוספה לסל |

### ניהול עסקים בקמפיין:

| פעולה | API | שדות |
|---|---|---|
| Toggle inclusion | `POST /api/zone-manager/community-campaigns/:id/businesses { businessGroupId, action: 'add'|'remove' }` | — |
| הזמנת עסק | `POST /api/zone-manager/community-campaigns/:id/invite { businessGroupId, message }` | — |
| אישור בקשת עסק | `POST /api/zone-manager/community-campaigns/:id/requests/:requestId/respond { action: 'approve'|'reject' }` | — |

**Request Direction:**
- `business_request` → עסק ביקש להצטרף
- אחר → ZM הזמין, ממתין לתשובת עסק

### סקירת מוצרים — `zmOpenProductsReview(campaignId, commId)`:

```javascript
// GET /api/zone-manager/community-campaigns/:id/products-review
// → { products[] }
// product: { catalog_id, business_group_id, business_name, product_name, base_price, price_override, approval_status }
```

**Approval Status:** `pending` | `approved` | `rejected`

### Filters:
- **Status tabs:** ממתינים / מאושרים / נדחו / הכל
- **Biz filter:** dropdown לפי עסק

### פעולות מוצר:

| פעולה | API | שדות |
|---|---|---|
| אישור מוצר | `POST /api/zone-manager/community-campaigns/:id/products/review { businessGroupId, catalogId, action:'approve' }` | — |
| דחיית מוצר | `POST /api/zone-manager/community-campaigns/:id/products/review { businessGroupId, catalogId, action:'reject' }` | — |
| הסרת מוצר מאושר | `POST /api/zone-manager/community-campaigns/:id/products { catalogId, action:'remove' }` | — |

### Image Upload בקמפיין:
```javascript
zmHandleCampaignImageUpload(event, targetInputId, previewId)
// FileReader → Canvas resize (max 1200px) → JPEG 90% → base64
// → input.value = base64
```

### שיתוף WhatsApp:
```javascript
zmShareCampaignWhatsapp(campaignId)
// → window.open(`https://wa.me/?text=${link}`)
// WhatsApp ישלוף OG meta מ-/campaign/:code אוטומטית
```

---

## 17. מנגנונים טכניים רוחביים

### Polling:
```javascript
_zmPendingRefresh = setInterval(loadZMPendingPanel, 60000)
// מתחיל ב-showDashboard(), מנוקה ב-zmLogout()
```

### Toast Notifications:

```javascript
zmShowToast(type, msg)   // שורה 530 — fixed bottom, 3 שניות
// type: 'success' (ירוק) | 'info' (כחול) | 'error' (אדום)

showZMToast(msg, type)   // שורה 2133 — fixed top, 3 שניות
// type: 'success' (ירוק) | 'error' (אדום)
```

**שים לב:** 2 פונקציות toast שונות עם `fixed bottom` ו-`fixed top`.

### XSS Protection:

```javascript
safeStrZM(s)  // שורה 1669 — HTML entities escape
escapeHtml(str)  // שורה 2264 — HTML entities escape
```

### Copy to Clipboard:
```javascript
copyLink(url)
// navigator.clipboard.writeText → feedback ויזואלי 2 שניות
```

### Image Upload — 2 patterns:

| Pattern | קובץ | שימוש |
|---|---|---|
| `zmHandleImageUpload(input)` | שורה 803 | Banner קמפיין רגיל (max 2MB, base64) |
| `zmHandleCampaignImageUpload(event, inputId, previewId)` | שורה 1688 | logo/banner קמפיין קהילתי (Canvas resize, 1200px, JPEG 90%) |

### Helper Functions:

| פונקציה | תיאור |
|---|---|
| `fmtGroupName(g)` | פורמט שם סביבה |
| `fmtUserName(u)` | פורמט שם משתמש |
| `zmShowToast(type, msg)` | toast מטה |
| `showZMToast(msg, type)` | toast מעלה |
| `safeStrZM(s)` | XSS sanitize |
| `escapeHtml(str)` | XSS sanitize |
| `copyLink(url)` | clipboard copy |

### Auth Header Inconsistency:

| API Routes | Header |
|---|---|
| `/api/zone-manager/*` | `Authorization: zmToken` (ללא Bearer) |
| `/api/zm/*` (Content tab) | `Authorization: Bearer ${token}` |
| `/api/kol-haam/zm/*` | `Authorization: zmToken` (ללא Bearer) |

---

*מסמך זה מתאר את סביבת ZM בלבד. מסמכים מקבילים: [FAMILY_ENV_SPEC.md](./FAMILY_ENV_SPEC.md) | [BIZ_ENV_SPEC.md](./BIZ_ENV_SPEC.md) | [SA_ENV_SPEC.md](./SA_ENV_SPEC.md)*
