# ביקורת אבטחה — /api/community/*
מסמך ביקורת · OneFlow Life · עודכן 25.08.2026

---

## רקע

74 endpoints תחת `/api/community/*` — **אף אחד** אינו משתמש ב-middleware אימות.  
כל endpoint חשוף: אין `verifyFamily`, `verifyBiz`, `verifySA` או כל middleware אחר.

בנוסף: ב-54 endpoints גם אם יתווסף middleware בסיסי, יישאר פער —  
המשתמש שולח `groupId`/`familyId` ב-params/body וה-server משתמש בו ישירות בלי לוודא שהוא שייך לטוקן.

---

## קטגוריה א' — ציבוריים לגיטימי (14 endpoints — לא לגעת)

| שורה | Method + Path | נימוק |
|---|---|---|
| 11503 | GET /api/community/search-business | חיפוש ציבורי |
| 14226 | GET /api/community/promotions/validate | ולידציה ציבורית |
| 14253 | GET /api/community/promotions/:communityId | מבצעים ציבוריים |
| 14595 | GET /api/community/approved-banners | באנרים ציבוריים |
| 14731 | GET /api/community/bundles/:communityId | חבילות ציבוריות |
| 23634 | GET /api/community/pool/community/:communityId | פולים ציבוריים |
| 23660 | GET /api/community/pool/:id | פרטי פול |
| 23862 | GET /api/community/pool/:id/messages | הודעות פול |
| 25788 | GET /api/community/posts/:id/comments | תגובות ציבוריות |
| 25862 | GET /api/community/posts/:id/likers | likers ציבורי |
| 25886 | GET /api/community/posts/:id/sharers | sharers ציבורי |
| 25901 | GET /api/community/posts/:id/public | פוסט ציבורי (gated logic) |
| 25934 | GET /api/community/:communityId/groups | קבוצות ציבורי |
| 26072 | GET /api/community/groups/:id/members | חברים ציבורי |

---

## קטגוריה ב' — דרוש verifyFamily (54 endpoints)

כולם ⚠️ groupId/familyId לא מאומת מול טוקן — פגיעות IDOR.  
שורות עם ⚠️⚠️ = חמורות במיוחד.

| שורה | Method + Path | ⚠️ |
|---|---|---|
| 10763 | GET /api/community/articles/:communityId | groupId מ-params |
| 11295 | POST /api/community/user-create | ⚠️ groupId מ-body |
| 11313 | GET /api/community/my-initiatives/:groupId | ⚠️ groupId מ-params |
| 12373 | GET /api/community/promos/:groupId | ⚠️ groupId מ-params |
| 12591 | GET /api/community/info/:groupId | ⚠️ groupId מ-params |
| 12626 | GET /api/community/family-feed/:groupId | ⚠️ groupId מ-params |
| 12684 | POST /api/community/family-refer | ⚠️ groupId מ-body |
| 12713 | POST /api/community/join | ⚠️ groupId מ-body |
| **12749** | **DELETE /api/community/leave/:groupId/:communityId** | **⚠️⚠️ DELETE ישיר, אפס בדיקה — כל אחד יכול לנתק כל משפחה מכל קהילה** |
| 13959 | GET /api/community/inbox/:groupId | ⚠️ groupId מ-params |
| 13976 | POST /api/community/inbox/new | ⚠️ groupId מ-body |
| 13995 | GET /api/community/inbox/thread/:threadId/:groupId | ⚠️ groupId מ-params |
| 14012 | POST /api/community/inbox/thread/:threadId/reply | ⚠️ groupId מ-body |
| 14027 | GET /api/community/cashback-info/:groupId | ⚠️ groupId מ-params |
| 14195 | GET /api/community/my-referral-stats/:groupId | ⚠️ groupId מ-params |
| **14206** | **GET /api/community/my-referral-code/:groupId** | **⚠️⚠️ יוצר + חושף קוד הפניה של כל משפחה** |
| 14373 | POST /api/community/refer-business | ⚠️ referrerGroupId מ-body |
| 14401 | GET /api/community/my-referrals/:groupId | ⚠️ groupId מ-params |
| **15240** | **POST /api/community/promotions/:id/redeem** | **⚠️⚠️ מימוש מבצע בשם כל groupId** |
| 15258 | POST /api/community/reviews | ⚠️ familyGroupId מ-body |
| 15278 | POST /api/community/biz-contact | ⚠️ familyGroupId מ-body |
| **15292** | **POST /api/community/bundles/:id/purchase** | **⚠️⚠️ רכישה בשם כל groupId** |
| 23617 | POST /api/community/pool | ⚠️ initiatorId מ-body |
| 23676 | POST /api/community/pool/:id/remove-member | ⚠️ initiatorId מ-body |
| 23689 | POST /api/community/pool/:id/join | ⚠️ groupId מ-body |
| **23707** | **POST /api/community/pool/:id/bid** | **⚠️⚠️ isGuest=true עוקף כל בדיקה** |
| 23729 | GET /api/community/pool/:id/bids | ⚠️ viewerId מ-query |
| 23751 | POST /api/community/pool/:id/select-bid | ⚠️ viewerId מ-body |
| 23772 | POST /api/community/pool/:id/open-round2 | ⚠️ viewerId מ-body |
| 23788 | POST /api/community/pool/:id/archive | ⚠️ viewerId מ-body |
| 23811 | POST /api/community/pool/:id/renew | ⚠️ viewerId מ-body |
| 23828 | POST /api/community/pool/:id/edit | ⚠️ viewerId מ-body |
| 23844 | POST /api/community/pool/:id/restore | ⚠️ viewerId מ-body |
| 23869 | POST /api/community/pool/:id/message | ⚠️ senderId מ-body |
| 23953 | GET /api/community/pool/family-archive/:groupId | ⚠️ groupId מ-params |
| 25545 | GET /api/community/feed | ⚠️ familyId מ-query |
| 25604 | POST /api/community/posts | ⚠️ familyId מ-body |
| 25638 | POST /api/community/feed/mark-read | ⚠️ familyId מ-body |
| 25668 | GET /api/community/feed/unread-counts | ⚠️ familyId מ-query |
| 25698 | GET /api/community/notifications | ⚠️ familyId מ-query |
| 25719 | GET /api/community/notifications/count | ⚠️ familyId מ-query |
| **25731** | **POST /api/community/notifications/mark-read** | **⚠️⚠️ מסמן התראות של כל משפחה** |
| **25750** | **POST /api/community/posts/:id/like** | **⚠️⚠️ לייק בשם כל משפחה** |
| 25804 | POST /api/community/posts/:id/comments | ⚠️ familyId מ-body |
| **25829** | **POST /api/community/posts/:id/report** | **⚠️⚠️ 3 דיווחים מסתירים פוסט — קל לנצל** |
| 25845 | POST /api/community/posts/:id/share | ⚠️ familyId מ-body |
| 25949 | POST /api/community/groups/:id/join | ⚠️ familyId מ-body |
| **25971** | **POST /api/community/groups/:id/leave** | **⚠️⚠️ DELETE ישיר ללא אימות** |
| 25985 | POST /api/community/groups | ⚠️ familyId מ-body |
| 26027 | POST /api/community/groups/:id/add-family | ⚠️ familyId מ-body |
| 26052 | DELETE /api/community/groups/:id/remove-family | ⚠️ familyId מ-body |
| 26104 | GET /api/community/feed/search | ⚠️ familyId מ-query |
| 26684 | GET /api/community/feed/biz-promos | ⚠️ familyId מ-query |
| 28680 | GET /api/community/:id/live-games | ⚠️ groupId מ-query |

---

## קטגוריה ג' — דרוש verifyFamily + בדיקת manager role (5 endpoints)

דורשים לא רק "יש טוקן" אלא "הטוקן שייך למנהל קהילה".  
כרגע יש בדיקת DB (is_community_manager), אך groupId עצמו לא מאומת מול טוקן.

| שורה | Method + Path | ⚠️ |
|---|---|---|
| 10830 | POST /api/community/manager/articles | ⚠️ group_id מ-body |
| 11515 | POST /api/community/invite-business | ⚠️ groupId מ-body |
| 14044 | POST /api/community/manager/family/approve | ⚠️ groupId מ-body |
| 14055 | POST /api/community/manager/family/reject | ⚠️ groupId מ-body |
| 14066 | GET /api/community/manager-data/:groupId | ⚠️ groupId מ-params |

---

## endpoint ניהולי — דרוש verifySA (1 endpoint)

| שורה | Method + Path | בעיה |
|---|---|---|
| **23898** | **POST /api/community/pool/cleanup** | **⚠️⚠️⚠️ endpoint ניהולי ללא שום הגנה** |

---

## סיכום ספירות

| קטגוריה | כמות |
|---|---|
| א' — ציבורי לגיטימי | 14 |
| ב' — דרוש verifyFamily | 54 |
| ג' — דרוש verifyFamily + manager check | 5 |
| ניהולי (verifySA) | 1 |
| **סה"כ** | **74** |

---

## פגיעויות קריטיות לטיפול מיידי

| שורה | Path | תרחיש תקיפה |
|---|---|---|
| 12749 | DELETE /leave/:groupId/:communityId | ניתוק כל משפחה מכל קהילה |
| 15240 | POST /promotions/:id/redeem | מימוש מבצעים בשם כל groupId |
| 15292 | POST /bundles/:id/purchase | רכישה חינם בשם כל groupId |
| 23707 | POST /pool/:id/bid | isGuest=true עוקף כל בדיקה |
| 23898 | POST /pool/cleanup | endpoint ניהולי ללא הגנה |
| 25829 | POST /posts/:id/report | הסתרת פוסטים ע"י 3 דיווחים מזויפים |
| 25971 | POST /groups/:id/leave | הוצאת משפחות מקבוצות |

---

## הערות תכנון לשלב הבא

1. **פגיעות IDOR בכל קטגוריה ב'**: הוספת middleware לבדה לא מספיקה.  
   דרוש: לאחר `verifyFamily`, לוודא שה-`groupId` בבקשה תואם ל-group_id שמשויך לטוקן ב-DB.

2. **verifyFamily קיים** במערכת — ניתן להתאים לשימוש כאן.

3. **endpoints עם `viewerId`** (pool actions) — `viewerId` הוא group_id — דורש אותה בדיקת IDOR.

4. **קטגוריה ג'** — הבדיקה הקיימת (`is_community_manager`) נכונה לתפקיד, אך groupId עצמו לא מאומת. תיקון: וודא שה-group_id בטוקן = group_id בבקשה לפני בדיקת המנהל.
