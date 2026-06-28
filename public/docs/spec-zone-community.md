# מפרט טכני מקיף — סביבת Zone Manager וקהילה (Community)
## OneFlow Life · Zone Manager & Community Environment
### גרסה 2026-06-20

---

## 1. ארכיטקטורה ומיקום

### 1.1 קבצים ו-URL

| רכיב | קובץ | URL |
|------|------|-----|
| דף HTML | `public/zone-manager.html` | `/zone-manager.html` |
| לוגיקת JS | `public/zone-manager-app.js` | (טעון מ-HTML) |
| עמוד ציבורי קמפיין | `public/campaign.html` | `/campaign.html?t=TOKEN` |
| OG preview ווצאפ | (route בשרת) | `/c/camp/:token` |
| Backend | `server.js` | `/api/zone-manager/*` |

### 1.2 מי משתמש בסביבה זו

**Zone Manager (מנהל אזור)** הוא תפקיד ייחודי במערכת OneFlow — אחראי על אזור גיאוגרפי הכולל מספר קהילות שכונתיות. הוא:
- גייס ומארגן משפחות ועסקים להצטרפות לפלטפורמה
- מנהל קמפיינים שיווקיים
- מפקח על קהילות הקהילות שבתחום אחריותו
- ממנה מנהלי קהילה מקומיים
- מרוויח עמלה (ברירת מחדל 5%) על כל פעילות בקהילות שלו

### 1.3 מבנה ארגוני

```
Super Admin
  └── Zone Manager (מנהל אזור)
        └── Zones (אזורים גיאוגרפיים)
              └── Communities (קהילות / שכונות)
                    ├── Family Groups (משפחות)
                    └── Business Groups (עסקים)
```

### 1.4 קשר לסביבות FAMILY ו-BIZ

- **FAMILY**: משפחות יכולות להצטרף לקהילה באמצעות קוד (tab "קהילה מקומית"). הקהילה מתפקדת כ-feed שכונתי עם הנחות מעסקים
- **BIZ**: עסקים יכולים לבקש הצטרפות לקהילה ולהציע הנחה לחברים. הבקשה עוברת אישור Super Admin ← Zone Manager
- **Zone Manager**: גשר בין שתי הסביבות — מגייס, מפקח, ומנהל עמלות

### 1.5 Authentication

**אחסון session:**
- `localStorage.setItem('zm_token', token)` — token מסוג `ZM_<id>_<timestamp>_<random>`
- `localStorage.setItem('zm_manager', JSON.stringify(manager))`

**זרימת כניסה:**
1. לוגין → POST `/api/zone-manager/login` → קבלת token ואובייקט manager
2. כל בקשה מאומתת: header `Authorization: <token>` → middleware `verifyZoneManager`
3. Middleware מחפש token ב-`zoneManagerSessions` Map בזיכרון

**הרשמה:**
- ממלא טופס (שם, מייל, סיסמה, טלפון) → נשמר ב-DB כ-`status='pending'`
- Super Admin מאשר → status משתנה ל-`active`

**שכחתי סיסמה:**
- שולח מייל עם לינק `?reset=TOKEN` (תקף שעה)
- טופס איפוס מוצג אוטומטית בהתאם לפרמטר ב-URL

---

## 2. ניווט וטאבים

### 2.1 Header

Header קבוע בראש הדף (sticky) עם:
- שם מנהל האזור
- כפתור יציאה

### 2.2 Stats Bar

4 cubes (2 שורות) תמיד גלויים:
1. **אזורים** — מספר האזורים הגיאוגרפיים תחת האחריות
2. **קהילות** — מספר הקהילות תחת האחריות
3. **עמלות שנצברו** (מתחילת פעילות + חודש שוטף)
4. **עמלות שולמו** (עם progress bar — אחוז שולם)

### 2.3 טאבים ראשיים (6 טאבים)

| מזהה | שם | טוען בעת מעבר |
|------|----|----|
| `zones` | אזורים | renderZones() — נטען כחלק מ-loadDashboard |
| `biz-requests` | בקשות עסקים | zmLoadPendingBiz() — כולל badge אדום |
| `marketing` | שיווק | loadCampaigns() + loadTemplates() |
| `leads` | לידים | loadLeadsTab() |
| `inbox` | אינבוקס | loadInbox() — כולל badge אדום |
| `commissions` | עמלות | loadCommissions() |

---

## 3. מודולים בפירוט

### 3.1 טאב אזורים (Zones)

**תצוגה:** כרטיס לכל אזור גיאוגרפי. בתוך כל אזור — רשימת הקהילות.

**לכל קהילה מוצג:**
- שם הקהילה ועיר
- סטטוס: "פעילה" (ירוק) / "בהתפתחות" (צהוב)
- Progress bar — משפחות: X/30 (ברירת מחדל `community_min_families`)
- Progress bar — עסקים: X/15 (ברירת מחדל `community_min_businesses`)
- כפתור "מנה מנהל קהילה" / "יש מנהל קהילה" (לפי הסטטוס)

**ספי פעילות** (מוגדרים ב-system_settings):
- `community_min_families` — מינימום משפחות (ברירת מחדל: 30)
- `community_min_businesses` — מינימום עסקים (ברירת מחדל: 15)

### 3.2 מינוי מנהל קהילה

- כפתור "מנה מנהל קהילה" פותח modal חיפוש
- חיפוש משתמשים: `GET /api/zone-manager/communities-members?communityId=X&q=QUERY`
- תוצאה מציגה: שם, מייל, האם כבר מנהל
- כפתורים: "מנה כמנהל" / "הסר תפקיד" → `POST /api/zone-manager/set-community-manager`
- שדה `is_community_manager` מתעדכן ב-`family_communities`

### 3.3 בקשות עסקים (biz-requests)

**זרימה של הצטרפות עסק לקהילה (3 שלבים):**
1. עסק מגיש בקשה מתוך סביבת BIZ → `POST /api/biz/communities/join` → status=`pending`
2. Super Admin מאשר → status=`approved` (שלב ביניים)
3. Zone Manager מאשר סופית → `POST /api/zone-manager/community-business/approve`

**בתצוגת הרשימה:** שם עסק, שם קהילה, אחוז הנחה שהעסק מציע לחברי הקהילה.

**כפתורי פעולה:** אשר / דחה (עם אישור JS)

**Badge:** ספירת בקשות ממתינות מוצגת על כרטיסיית הטאב.

### 3.4 שיווק — קמפיינים ותבניות

#### קמפיינים

**סוגי קמפיין:**
- `business` — גיוס עסקים למערכת OneFlow BIZ
- `family` — גיוס משפחות למערכת OneFlow Family
- `community_join` — הצטרפות לקהילה ספציפית

**בניית קמפיין (modal):**
1. בחירת סוג קמפיין (שינוי מציג מודולים רלוונטיים)
2. בחירת מודולים לדגש ב-AI (רשימה של 17 מודולי עסק / 12 מודולי משפחה)
3. ניסוח עם AI: goal + audience → `POST /api/zone-manager/ai/draft-campaign`
4. יצירת תמונת באנר עם AI: `POST /api/zone-manager/ai/generate-banner`
5. שדות טופס הליד: שם פרטי, שם משפחה, שם עסק, עיר, כתובת, טלפון, מייל, טקסט חופשי
6. שמירה: `POST /api/zone-manager/campaigns` / `PUT /api/zone-manager/campaigns/:id`

**תצוגת קמפיין ברשימה:**
- תמונת באנר (אם קיימת)
- סוג קמפיין + כותרת
- ספירת לידים (כפתור → מעבר לטאב לידים)
- כפתור "לינק" (העתקת URL ישיר)
- כפתור "ווצאפ" (שליחה דרך WhatsApp Web)
- תאריך יצירה
- עריכה / מחיקה

#### תבניות הודעה

- יצירה: שם תבנית, נושא, תוכן → `POST /api/zone-manager/templates`
- שימוש: ממלא אוטומטית את טופס הודעה חדשה
- מחיקה: `DELETE /api/zone-manager/templates/:id`

### 3.5 לידים

**ניווט:** dropdown לבחירת קמפיין → טעינת הלידים שלו

**רכיבי ליד:**
- שדות שמולאו בטופס (שם, טלפון, מייל, עיר, וכד')
- סוג ליד: עסק / משפחה / לא ידוע
- סטטוס: חדש / פנינו / מתעניין / לא מתעניין / הצטרף
- ציון AI (1-10) + הערת AI
- תאריך הגשה

**ניתוח AI:** כפתור "נתח עם AI" → `POST /api/zone-manager/ai/analyze-leads` → מעדכן `ai_score` ו-`ai_notes`

**ניהול ליד (Lead CRM Modal):**
- עדכון סוג + סטטוס + הערות → `PUT /api/zone-manager/leads/:id`
- לוג פעולות: שיחה / ווצאפ / פגישה / מייל → `POST /api/zone-manager/leads/:id/actions`
- צפייה בהיסטוריית פעולות: `GET /api/zone-manager/leads/:id/actions`

### 3.6 אינבוקס

**מבנה:** שיחות (threads) בין Zone Manager לבין מנהלי קהילה.

**צפייה:** רשימת שיחות עם שם קהילה, תוכן הודעה אחרונה, badge הודעות שלא נקראו.

**שיחה בודדת (Thread Modal):**
- הודעות Zone Manager מוצגות בצד שמאל (כחול)
- הודעות מנהל קהילה בצד ימין (לבן)
- כפתור "הצעת תשובה עם AI" → `POST /api/zone-manager/ai/suggest-reply`

**שליחת הודעה חדשה:**
- בחירת קהילת יעד (עם מנהל קהילה פעיל בלבד)
- נושא + תוכן → `POST /api/zone-manager/inbox/new`

**שידור לכל מנהלי הקהילות:**
- `POST /api/zone-manager/inbox/broadcast`
- יוצר thread נפרד לכל מנהל קהילה פעיל

### 3.7 עמלות

**היסטוריה:** `GET /api/zone-manager/commissions`

**תצוגת רשומה:** תאריך, שם קהילה, תיאור, סכום בש"ח.

**מתי נצברת עמלה:**
- בכל הזמנה/תשלום שמתבצע בקהילה תחת האחריות
- שיעור: `commission_pct` ממטבלת `zone_managers` (ברירת מחדל 5%)
- נרשמת ב-`zone_manager_commissions`

---

## 4. קמפיינים — Flow מלא

### 4.1 יצירת קמפיין (Zone Manager)

```
Zone Manager → פתח modal → בחר סוג קמפיין
  → [אופציונלי] בחר מודולים לדגש
  → [אופציונלי] AI Draft: שלח goal + audience + modules → קבל title + subtitle + text
  → [אופציונלי] AI Banner: שלח title + type → קבל SVG כ-base64
  → [אופציונלי] העלה תמונה ידנית (מקסימום 2MB, base64)
  → מלא כותרת, כותרת משנה, טקסט
  → בחר שדות טופס
  → שמור → POST /api/zone-manager/campaigns
  → DB: zm_campaigns (עם token ייחודי)
```

### 4.2 שיתוף ב-WhatsApp

```
לחץ כפתור "ווצאפ"
  → נפתח https://wa.me/?text=ENCODED_TEXT
  → הטקסט: שורה ראשונה מהקמפיין + לינק OG
  → לינק: https://DOMAIN/c/camp/TOKEN
```

### 4.3 עמוד OG Preview (`/c/camp/:token`)

Server מגיש HTML עם מטאטגים ל-WhatsApp/Open Graph:
- `og:title` — כותרת הקמפיין
- `og:description` — כותרת משנה או תחילת הטקסט (עד 200 תווים)
- `og:image` — לוגיקת fallback:
  1. אם יש תמונת קמפיין (data: שאינה SVG) → `/api/public/campaign-image/:token`
  2. אם יש לוגו מערכת (data:) → `/api/public/logo`
  3. fallback → `/logo.png`
- `og:image:width/height` → 1200x630 לתמונת קמפיין, 512x512 ללוגו
- `twitter:card` → `summary_large_image` / `summary`
- `http-equiv="refresh"` → מעביר מיד ל-`/campaign.html?t=TOKEN`

### 4.4 עמוד הקמפיין הציבורי (`campaign.html`)

טוען: `GET /api/public/campaign/:token`

**מצבים:**
- **טעינה** — spinner
- **לא נמצא** — הודעת שגיאה
- **נמצא** — הצגת הקמפיין

**מבנה דף:**
1. באנר עליון מ-super admin (אופציונלי)
2. Hero gradient עם כותרת קמפיין + לוגו
3. תמונת באנר (אם קיימת, מעל overlay)
4. טקסט קמפיין
5. שדות טופס דינמיים (לפי `fields_config`)
6. כפתור שליחה

**שדות טופס אפשריים:** שם פרטי, שם משפחה, שם עסק, כתובת, עיר, טלפון (tel), מייל (email), טקסט חופשי (textarea).

**ברירת מחדל (אם אין fields_config):** שם מלא + טלפון.

**הגשה:** `POST /api/public/campaign/:token/submit` — ציבורי, ללא אימות.

---

## 5. סביבת קהילה (Community)

### 5.1 מהי קהילה ב-OneFlow

**קהילה (Community)** = ישות ארגונית שכונתית / גיאוגרפית שמאגדת:
- משפחות מהשכונה/ארגון
- עסקים מקומיים שבחרו להצטרף

כל קהילה יש לה:
- `id`, `name`, `city`, `code` (קוד הצטרפות 4-6 תווים)
- `zone_id` (אזור גיאוגרפי שאליו שייכת)
- `status` — pending / active
- `manager_email` / `manager_password` (לוגין מנהל קהילה)
- `image_url` (אופציונלי)

**טבלאות DB:**
- `communities` — הגדרת הקהילות
- `family_communities` — חיבור משפחות לקהילות (many-to-many)
- `community_businesses` — חיבור עסקים לקהילות (many-to-many + status + discount_pct)
- `manager_zones` — חיבור Zone Managers לאזורים

### 5.2 מה Family App יכול לעשות בקהילה

**טאב "קהילה מקומית"** ב-Family App:

1. **הצטרפות לקהילה** — הזנת קוד → `POST /api/community/join`
2. **צפייה בעסקים מקומיים** — רשימת עסקים עם קישור לחנות + אחוז הנחה
3. **קאשבק** — מעקב אחר cashback שנצבר מקניות בעסקים מקומיים
4. **Community Feed** — עדכוני קהילה מוצגים ב-feed הראשי (תחת `community_updates`)
5. **יצירת קהילה עצמאית** → `POST /api/community/user-create` (status=pending, ממתין לאישור)
6. **עזיבת קהילה** → `DELETE /api/community/leave/:groupId/:communityId`
7. **Inbox קהילתי** — שיחות עם Zone Manager (אם יש מנהל קהילה מקומי)

**תצוגת Feed:** עדכוני קהילה מגיעים עם `category: 'community'` ומוצגים בין יתר העדכונים בפיד הבית.

### 5.3 מה Business App יכול לעשות בקהילה

**ניהול קהילות בסביבת BIZ:**

1. **צפייה בקהילות שהעסק חבר בהן** → `GET /api/biz/communities/my/:bizId`
   - שדות: שם קהילה, עיר, ספירת משפחות, ספירת משתמשים
2. **גילוי קהילות זמינות** → `GET /api/biz/communities/available/:bizId`
3. **בקשת הצטרפות לקהילה** → `POST /api/biz/communities/join`
   - שולח: communityId, businessId, discountPct
   - status ← `pending`
4. **עזיבת קהילה** → `DELETE /api/biz/communities/leave/:communityId/:bizId`

**Storefront בקשר לקהילה:**
- לינק לחנות עסק כולל `?store=GROUP_CODE&communityId=ID`
- מקבל `communityData` עם שם הקהילה ואחוז ההנחה

### 5.4 חיבור בין עסקים לקהילות — תהליך מלא

```
1. עסק (BIZ) → "הצטרף לקהילה" + discountPct →
   INSERT community_businesses (status='pending')

2. Super Admin → רואה ב"קהילות > עסקים ממתינים" →
   אשר: UPDATE status='approved' (שלב ביניים) / דחה: DELETE

3. Zone Manager → רואה ב-tab "בקשות עסקים" →
   אשר: POST /api/zone-manager/community-business/approve
       UPDATE status='approved' (סופי)
   דחה: POST /api/zone-manager/community-business/reject
       DELETE FROM community_businesses

4. לאחר אישור:
   - העסק מופיע לחברי הקהילה (Family App)
   - הנחה מוצגת ב-storefront
   - Zone Manager צובר עמלה על פעילות בקהילה
```

**הערה:** לפי הקוד, יש שתי שכבות אישור (SA + ZM) אך בפועל Super Admin עשוי לאשר ישירות ל-`approved` מבלי שZone Manager צריך לאשר שנית — תלוי בזרימה שהוגדרה.

### 5.5 מנהל קהילה מקומי (Community Manager)

- Zone Manager ממנה אחד מחברי הקהילה כ-"מנהל קהילה מקומי"
- `is_community_manager = TRUE` ב-`family_communities`
- יכול לקבל ולשלוח הודעות ב-inbox הקהילתי
- יכול לאשר/לדחות בקשות עסקים (דרך Community Manager view ב-app.js)
- `GET /api/community/manager-data/:groupId` — נתוני ניהול (קהילות, ארנק, עסקים ממתינים, עסקות)

---

## 6. API Endpoints

### 6.1 Zone Manager — Auth

| Method | Path | תיאור |
|--------|------|--------|
| POST | `/api/zone-manager/register` | הרשמה (status=pending) |
| POST | `/api/zone-manager/login` | כניסה, מחזיר token |
| POST | `/api/zone-manager/forgot-password` | שליחת מייל איפוס |
| POST | `/api/zone-manager/reset-password` | איפוס סיסמה עם token |

### 6.2 Zone Manager — Dashboard

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/zone-manager/dashboard` | אזורים, קהילות, עמלות |
| GET | `/api/zone-manager/commissions` | היסטוריית עמלות |

### 6.3 Zone Manager — קהילות

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/zone-manager/communities-members` | חיפוש חברים לניהול קהילה |
| POST | `/api/zone-manager/set-community-manager` | מינוי/הסרת מנהל קהילה |
| GET | `/api/zone-manager/pending-businesses` | בקשות עסקים ממתינות |
| POST | `/api/zone-manager/community-business/approve` | אישור עסק לקהילה |
| POST | `/api/zone-manager/community-business/reject` | דחיית בקשת עסק |

### 6.4 Zone Manager — קמפיינים ולידים

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/zone-manager/campaigns` | רשימת קמפיינים |
| POST | `/api/zone-manager/campaigns` | יצירת קמפיין |
| PUT | `/api/zone-manager/campaigns/:id` | עריכת קמפיין |
| DELETE | `/api/zone-manager/campaigns/:id` | מחיקת קמפיין |
| GET | `/api/zone-manager/campaigns/:id/leads` | לידים של קמפיין |
| PUT | `/api/zone-manager/leads/:id` | עדכון ליד (סטטוס, הערות) |
| GET | `/api/zone-manager/leads/:id/actions` | לוג פעולות ליד |
| POST | `/api/zone-manager/leads/:id/actions` | הוספת פעולת CRM |

### 6.5 Zone Manager — AI

| Method | Path | תיאור |
|--------|------|--------|
| POST | `/api/zone-manager/ai/draft-campaign` | ניסוח טקסט קמפיין (Gemini) |
| POST | `/api/zone-manager/ai/generate-banner` | יצירת SVG (Gemini) |
| POST | `/api/zone-manager/ai/analyze-leads` | ניתוח לידים וציון (Gemini) |
| POST | `/api/zone-manager/ai/suggest-reply` | הצעת תשובה לאינבוקס (Gemini) |

### 6.6 Zone Manager — Inbox

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/zone-manager/inbox` | רשימת שיחות |
| POST | `/api/zone-manager/inbox/new` | הודעה חדשה |
| POST | `/api/zone-manager/inbox/broadcast` | שידור לכל מנהלי הקהילות |
| GET | `/api/zone-manager/inbox/:threadId` | שיחה בודדת |
| POST | `/api/zone-manager/inbox/:threadId/reply` | תגובה בשיחה |

### 6.7 Zone Manager — תבניות

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/zone-manager/templates` | רשימת תבניות |
| POST | `/api/zone-manager/templates` | יצירת תבנית |
| DELETE | `/api/zone-manager/templates/:id` | מחיקת תבנית |

### 6.8 ציבורי — קמפיינים

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/public/campaign/:token` | הגדרות קמפיין (ציבורי) |
| POST | `/api/public/campaign/:token/submit` | הגשת טופס ליד (ציבורי) |
| GET | `/c/camp/:token` | OG preview ל-WhatsApp |
| GET | `/api/public/campaign-image/:token` | תמונת קמפיין (binary) |

### 6.9 Community — Family App

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/community/info/:groupId` | קהילות + עסקים של הקבוצה |
| POST | `/api/community/join` | הצטרפות לקהילה בקוד |
| DELETE | `/api/community/leave/:groupId/:communityId` | עזיבת קהילה |
| POST | `/api/community/user-create` | יצירת קהילה חדשה |
| GET | `/api/community/my-initiatives/:groupId` | קהילות שהמשפחה הקימה |
| GET | `/api/community/info/:groupId` | נתוני קהילה + עסקים |
| GET | `/api/community/cashback-info/:groupId` | נתוני cashback |
| GET | `/api/community/manager-data/:groupId` | נתוני מנהל קהילה |
| GET | `/api/community/inbox/:groupId` | אינבוקס קהילתי |
| GET | `/api/community/inbox/thread/:threadId/:groupId` | שיחה בודדת |
| POST | `/api/community/inbox/thread/:threadId/reply` | תגובה |
| POST | `/api/community/inbox/new` | פתיחת שיחה עם ZM |

### 6.10 Community — BIZ

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/biz/communities/my/:bizId` | קהילות של העסק |
| GET | `/api/biz/communities/available/:bizId` | קהילות זמינות |
| POST | `/api/biz/communities/join` | בקשת הצטרפות |
| DELETE | `/api/biz/communities/leave/:communityId/:bizId` | עזיבת קהילה |

### 6.11 Super Admin — ניהול מנהלי אזורים וקהילות

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/sa/zone-managers` | רשימת מנהלי אזורים |
| POST | `/api/sa/zone-managers` | יצירת מנהל אזור |
| PUT | `/api/sa/zone-managers/:id` | עדכון מנהל אזור |
| DELETE | `/api/sa/zone-managers/:id` | מחיקת מנהל אזור |
| GET | `/api/sa/zone-managers/pending` | ממתינים לאישור |
| POST | `/api/sa/zone-managers/:id/zones` | שיוך אזורים למנהל |
| GET | `/api/sa/zone-managers/:id/details` | פרטים מלאים + עמלות |
| GET | `/api/sa/zone-managers/finance-summary` | סיכום פיננסי |
| POST | `/api/sa/zone-manager-payments` | רישום תשלום עמלה |
| GET | `/api/sa/communities` | רשימת קהילות |
| POST | `/api/sa/communities` | יצירת קהילה |
| PUT | `/api/sa/communities/:id` | עדכון קהילה |
| DELETE | `/api/sa/communities/:id` | מחיקת קהילה |
| GET | `/api/sa/communities/:id/details` | פרטי קהילה מלאים |
| GET | `/api/sa/communities/pending-businesses` | עסקים ממתינים (כל הקהילות) |
| POST | `/api/sa/community-business` | הוספת עסק לקהילה |
| GET | `/api/sa/community-business/:commId` | עסקים של קהילה |
| DELETE | `/api/sa/community-business/:commId/:bizId` | הסרת עסק |
| POST | `/api/sa/community-business/approve` | אישור עסק |
| POST | `/api/sa/community-business/reject` | דחיית עסק |

---

## 7. לוגיקות מיוחדות

### 7.1 AI — ניסוח טקסט קמפיין

**מודל:** Gemini 2.5 Flash (fallback: Gemini 1.5 Flash)

**prompt מובנה לפי סוג קמפיין:**
- `business` — מדגיש יכולות עסקיות של OneFlow
- `family` — מדגיש כלים משפחתיים
- `community_join` — מדגיש ערך הקהילה המקומית

**פרמטרים:** goal, audience, tone, campaignType, modules[]

**פלט JSON:** `{title, subtitle, text_content}`

### 7.2 AI — יצירת תמונת באנר (SVG)

**מודל:** Gemini 2.5 Flash (fallback: 2.0 Flash)

**palette לפי סוג:**
- `business` → גוונים כחולים כהים
- `family` → indigo-purple-pink
- `community_join` → גוונים ירוקים

**prompt:** SVG 1600x900 ← רק צורות גיאומטריות, ללא טקסט

**פלט:** base64 SVG → data URL → מוצגת כתמונת באנר

**הערה חשובה:** SVG ב-data URL אינה תקינה כ-og:image. Server ממיר תמונות binary (JPEG/PNG) בלבד לendpoint ציבורי. SVGs מוחלפות ב-logo.png ב-OG tags.

### 7.3 AI — ניתוח לידים

**מודל:** Gemini 2.5 Flash

**prompt:** מציג עד 50 לידים שטרם נותחו (ai_score IS NULL)

**פלט JSON:** `{results: [{id, score (1-10), notes}]}`

**עדכון DB:** `ai_score`, `ai_notes` ב-`zm_campaign_leads`

### 7.4 AI — הצעת תשובה לאינבוקס

**מודל:** Gemini 2.5 Flash

**קלט:** 6 ההודעות האחרונות בשיחה

**prompt context:** מציג שיחה בין "מנהל אזור" ל"מנהל קהילה"

**פלט:** טקסט תשובה מוצע (ממלא את שדה הטקסט, לא שולח אוטומטית)

### 7.5 WhatsApp Integration

**לינק שיתוף:** `https://wa.me/?text=ENCODED`

**בניית הטקסט:**
```
שורה ראשונה של הקמפיין...

👉 https://DOMAIN/c/camp/TOKEN
```

**זרימה בוואצאפ:**
1. משתמש מקבל הודעה עם preview (כרטיס OG)
2. לוחץ על הלינק → נכנס לנתיב `/c/camp/TOKEN`
3. Server מציג HTML עם OG meta tags
4. `http-equiv="refresh"` מעביר מיד ל-`/campaign.html?t=TOKEN`
5. דף הקמפיין נטען → ממלא טופס → שולח ליד

### 7.6 מבנה Token — זיהוי ייחודי

- **Session token:** `ZM_<id>_<timestamp>_<random6>` — נשמר ב-Map בזיכרון
- **Campaign token:** UUID (`crypto.randomUUID()`) — נשמר ב-DB
- **Reset token:** `ZMR_<id>_<timestamp>_<random>` — נשמר ב-Map, תקף שעה

### 7.7 DB Schema — טבלאות עיקריות Zone Manager

```sql
zone_managers (id, name, email, phone, password_hash, status, commission_pct, notes)
manager_zones (id, manager_id, name, status)
communities (id, name, code, city, zone_id, status, manager_email, image_url)
family_communities (group_id, community_id, is_community_manager)
community_businesses (community_id, business_id, discount_pct, status)
zm_campaigns (id, zone_manager_id, title, subtitle, text_content, fields_config, token, campaign_type, image_url, status)
zm_campaign_leads (id, campaign_id, data JSONB, lead_type, status, ai_score, ai_notes, crm_notes)
zm_lead_actions (id, lead_id, action_type, notes, created_at)
zm_inbox_threads (id, zone_manager_id, community_id, group_id, subject)
zm_inbox_messages (id, thread_id, sender_type, content, is_read, created_at)
zm_message_templates (id, zone_manager_id, name, subject, content)
zone_manager_commissions (id, manager_id, community_id, order_id, amount, commission_pct, description)
zone_manager_payments (id, manager_id, amount, payment_method, notes, paid_at, recorded_by)
```

---

---

## 8. פיצ'רים מתקדמים — קהילה (עדכון 2026-06-28)

### 8.1 ארנק FLOW לקהילה

כל קהילה מחזיקה **ארנק FLOW עצמאי** (entity_type = 'community'):
- **יתרה** — ₣ שנצברו מפעילות קהילתית (מבצעים, חבילות, הפניות)
- **מקורות הכנסה**: `promo_community`, `bundle_community`, `ambassador_approved`
- **מנהל הקהילה** יכול לראות את יתרת הארנק בפאנל הניהול (`openCommunityManagerPanel`)

### 8.2 תגיות עניין (Interest Tags)

קהילות יכולות להגדיר **תגית עניין** (`interest_tag`) — טקסט חופשי שמגדיר את נושא הקהילה:
- לדוגמה: כושר, יופי, קוסמטיקה, ילדים, בריאות, אוכל אורגני
- **עסקים** יכולים לחפש קהילות לפי תגית: `GET /api/communities/by-interest?tag={tag}`
- **משפחות** יכולות לחפש קהילות לפי עניין: `famSearchByInterest()`
- **SA map** מציג תגיות כ-chips על כל קהילה

### 8.3 ציון התאמה (Match Score)

API: `GET /api/biz/communities/match/:bizId` → מחזיר ציוני % התאמה לכל קהילה

**אלגוריתם ציון (0–100%):**

| גורם | ניקוד |
|------|-------|
| עיר זהה (name match) | +35 |
| קרבה גיאוגרפית (GPS) | עד +40 |
| גודל קהילה | +0.5 × מספר משפחות (מקס 30) |
| עסקים פעילים | +2 × מספר עסקים (מקס 20) |
| תגית עניין תואמת | +10 |

**קריאורוף בעסק**: `loadBizCommunitiesWithMatch()` — panel מסך מלא עם מיון יורד.

### 8.4 חבילות עסקים (Bundles)

**יצירה (SA)**: `POST /api/sa/community/bundles`
- שם, תיאור, מחיר, % הנחה, קהילה, מזהי עסקים (מינימום 2)

**צפייה (עסק)**: `loadMyBizBundles()` — מציג חבילות שהעסק כלול בהן

**רכישה (משפחה)**: `purchaseCommunityBundle(bundleId)` → `POST /api/community/bundles/:id/purchase`
- זיכוי ₣ אוטומטי לארנק המשפחה וארנק הקהילה

### 8.5 מבצעים קהילתיים (Promotions)

**פרסום (עסק)**: `openBizPromoModal()` → `POST /api/biz/community/promotions`
- עובר לאישור Zone Manager ו/או SA

**אישור (Zone Manager)**: `zmApproveBiz()` → `POST /api/zone-manager/community-business/approve`

**פדייה (משפחה)**: `redeemCommunityPromo(promoId)` → `POST /api/community/promotions/:id/redeem`
- זיכוי ₣ לארנק המשפחה

### 8.6 מערכת הפניות/שגריר (Ambassador/Referral)

**הפניית חברים (משפחה ← משפחה)**:
- כל משפחה מקבלת קוד ייחודי: `GET /api/community/my-referral-code/:groupId`
- ב-join: שדה "קוד חבר שהמליץ" שנשלח ב-`POST /api/community/join`
- כשהצטרפות מאושרת: +35₣ לממליץ, +15₣ לארנק הקהילה

**המלצת עסק לקהילה (משפחה ← עסק)**:
- `openFamReferralModal()` → `POST /api/community/family-refer`
- Zone Manager/SA מאשר → `ambassador_approved` trigger

**Zone Manager מאשר שגריר**:
- 35₣ אוטומטית לעסק הממליץ
- 15₣ לארנק הקהילה
- אפשרות בונוס ידני (₪) לארנק הקהילה

### 8.7 באנרים קהילתיים

- עסקים מאושרים יכולים לבקש "קידום באנר": `requestBannerForPromo(promoId)`
- Zone Manager מאשר + קובע תאריכים
- `POST /api/sa/banners` → `POST /api/superadmin/banners` → מוצג ב-feed קהילתי

### 8.8 מנהל קהילה — תפקיד `is_community_manager`

- Zone Manager ממנה מנהל מקרב חברי קהילה: `zmSetCommunityManager(groupId, isManager)`
- `POST /api/zone-manager/set-community-manager`
- **הרשאות מנהל קהילה**:
  - אישור/דחיית עסקים לקהילה
  - ניהול ארנק הקהילה
  - ראיית נתוני הקהילה (family_count, business_count, wallet)

### 8.9 API Endpoints — פיצ'רים מתקדמים

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/communities/discover` | גילוי קהילות לפי עיר |
| GET | `/api/communities/by-interest` | חיפוש לפי תגית עניין |
| GET | `/api/biz/communities/match/:bizId` | ציוני % התאמה |
| POST | `/api/sa/community/bundles` | יצירת חבילה (SA) |
| GET | `/api/community/bundles/:communityId` | חבילות קהילה |
| POST | `/api/community/bundles/:id/purchase` | רכישת חבילה |
| POST | `/api/biz/community/promotions` | פרסום מבצע |
| POST | `/api/community/promotions/:id/redeem` | פדיית מבצע |
| POST | `/api/biz/community/promotions/:id/banner-request` | בקשת באנר |
| GET | `/api/community/my-referral-code/:groupId` | קוד הפניה |
| POST | `/api/community/family-refer` | המלצת עסק |
| GET | `/api/sa/communities/map-data` | נתוני מפת SA |
| GET | `/api/flow/wallet/community/:communityId` | ארנק FLOW קהילה |

---

## 9. DB Schema — טבלאות נוספות (עדכון 2026-06-28)

| טבלה | תיאור |
|------|-------|
| `flow_wallets` | ארנק ₣ (entity_type + entity_id) |
| `flow_transactions` | כל עסקאות ה-₣ |
| `flow_redemptions` | קודי מימוש פיזיים (FL...) |
| `community_promotions` | מבצעים של עסקים בקהילה |
| `community_bundles` | חבילות קהילתיות |
| `community_bundle_businesses` | עסקים שכלולים בחבילה |
| `community_banners` | באנרים לקידום |
| `community_referrals` | קודי הפניה ומעקב |

---

*עודכן: 2026-06-28 | Oneflow Life — Zone Manager & Community*
