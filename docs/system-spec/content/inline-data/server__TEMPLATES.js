// source: server.js:6539
const TEMPLATES = {
            family_signup: {
                userSubject: `הסביבה שלכם ב-WEFLOWZ (למשפחות) מוכנה!`,
                userHtml: `<div dir="rtl" style="font-family:Arial;"><h2>ברוכים הבאים ל-WEFLOWZ (למשפחות)! 🚀</h2><p>שלום ${adminNickname},</p><p>הסביבה שלכם מוגדרת ומוכנה לפעולה.</p><br><p>פרטי הגישה שלכם:</p><p>קוד סביבה: <strong style="color: #2563eb;">${code}</strong></p><p>משתמש: <strong>${adminNickname}</strong></p><p>סיסמה: <strong>••••••••</strong> (בטריגר האמיתי מוצגת כאן הסיסמה שנבחרה בהרשמה)</p></div>`,
                saSubject: 'WEFLOWZ | הצטרפות חדשה למערכת!',
                saHtml: `<div dir="rtl" style="font-family:Arial;"><h2>🎉 סביבה חדשה הוקמה!</h2><p>סוג: WEFLOWZ (למשפחות)</p><p>שם: ${groupName}</p><p>מייל: ${demoEmail}</p><p>קוד: <b>${code}</b></p></div>`
            },
            family_join: {
                userSubject: `WEFLOWZ | בן/בת משפחה חדש/ה הצטרף/ה ל-${groupName}`,
                userHtml: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:540px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                    <div style="background:#4f46e5;padding:20px 24px;">
                        <h2 style="color:#fff;margin:0;font-size:18px;">⚡ התראה מ-WEFLOWZ</h2>
                        <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">${groupName}</p>
                    </div>
                    <div style="padding:24px;">
                        <p style="font-size:15px;color:#1e293b;margin:0 0 16px;"><strong>דנה כהן</strong> (בן/בת משפחה) ביקש/ה להצטרף למשפחה <strong>${groupName}</strong> וממתין/ה לאישורך במסך ניהול החברים.</p>
                        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
                        <p style="font-size:11px;color:#94a3b8;margin:0;">WEFLOWZ · מערכת ניהול עסקי</p>
                    </div>
                </div>`,
                saSubject: `WEFLOWZ | בן/בת משפחה חדש/ה הצטרף/ה ל-${groupName}`,
                saHtml: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:540px;margin:auto;">
                    <h3 style="color:#4f46e5;">WEFLOWZ | בן/בת משפחה חדש/ה הצטרף/ה ל-${groupName}</h3>
                    <p><strong>דנה כהן</strong> (בן/בת משפחה) ביקש/ה להצטרף למשפחה <strong>${groupName}</strong> וממתין/ה לאישורך במסך ניהול החברים.</p>
                    <p style="color:#64748b;font-size:12px;">קוד משפחה: ${code}</p>
                </div>`
            },
            business_signup: {
                userSubject: `ברוכים הבאים ל-WEFLOWZ BIZ — ${bizName}`,
                userHtml: `<div dir="rtl" style="font-family:sans-serif;max-width:520px;margin:0 auto;">
                  <h2 style="color:#4f46e5;">המערכת שלך מוכנה! 🎉</h2>
                  <p>שלום ישראל,</p>
                  <p>העסק <strong>${bizName}</strong> הוגדר בהצלחה במערכת WEFLOWZ BIZ.</p>
                  <p>תוכל להתחבר בכל עת דרך האתר ולהתחיל לנהל את העסק שלך.</p>
                  <p style="color:#64748b;font-size:12px;">צוות WEFLOWZ</p>
                </div>`,
                saSubject: `עסק חדש הצטרף: ${bizName}`,
                saHtml: `<div dir="rtl" style="font-family:sans-serif;">
                  <h3>עסק חדש השלים הרשמה</h3>
                  <ul>
                    <li><strong>שם עסק:</strong> ${bizName}</li>
                    <li><strong>סוג:</strong> מסעדה</li>
                    <li><strong>מנהל:</strong> ישראל ישראלי</li>
                    <li><strong>עיר:</strong> תל אביב</li>
                    <li><strong>אימייל:</strong> ${demoEmail}</li>
                  </ul>
                </div>`
            },
            business_join: {
                userSubject: `WEFLOWZ | עובד/ת חדש/ה הצטרף/ה ל-${bizName}`,
                userHtml: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:540px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                    <div style="background:#4f46e5;padding:20px 24px;">
                        <h2 style="color:#fff;margin:0;font-size:18px;">⚡ התראה מ-WEFLOWZ</h2>
                        <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">${bizName}</p>
                    </div>
                    <div style="padding:24px;">
                        <p style="font-size:15px;color:#1e293b;margin:0 0 16px;"><strong>יוסי לוי</strong> (עובד) ביקש/ה להצטרף לעסק <strong>${bizName}</strong> וממתין/ה לאישורך במסך ניהול החברים.</p>
                        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
                        <p style="font-size:11px;color:#94a3b8;margin:0;">WEFLOWZ · מערכת ניהול עסקי</p>
                    </div>
                </div>`,
                saSubject: `WEFLOWZ | עובד/ת חדש/ה הצטרף/ה ל-${bizName}`,
                saHtml: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:540px;margin:auto;">
                    <h3 style="color:#4f46e5;">WEFLOWZ | עובד/ת חדש/ה הצטרף/ה ל-${bizName}</h3>
                    <p><strong>יוסי לוי</strong> (עובד) ביקש/ה להצטרף לעסק <strong>${bizName}</strong> וממתין/ה לאישורך במסך ניהול החברים.</p>
                    <p style="color:#64748b;font-size:12px;">קוד עסק: ${code}</p>
                </div>`
            },
            family_reset: {
                userSubject: 'WEFLOWZ | שחזור קוד וסיסמה לסביבה שלך',
                userHtml: `<div style="direction: rtl; font-family: Arial, sans-serif;">
                    <h2>שחזור פרטי גישה - WEFLOWZ</h2>
                    <p>שלום ${adminNickname},</p>
                    <p>התקבלה בקשה לשחזור פרטי הגישה עבור הסביבה שלכם: "<strong>${groupName}</strong>".</p>
                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
                        <p style="font-size: 16px; margin: 8px 0;"><strong>קוד הסביבה שלכם הוא:</strong> <span style="font-size: 20px; color: #3b82f6; font-weight: bold;">${code}</span></p>
                        <p style="font-size: 16px; margin: 8px 0;"><strong>שם משתמש מנהל:</strong> <span style="font-size: 18px; color: #3b82f6;">${adminNickname}</span></p>
                        <p><a href="#" style="background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">איפוס סיסמה (בטריגר האמיתי - קישור פעיל עם טוקן)</a></p>
                        <p style="color:#64748b;font-size:13px">קישור האיפוס תקף לשעה אחת.</p>
                    </div>
                    <p>אם לא ביקשתם שחזור פרטים, ניתן להתעלם מהודעה זו בביטחה.</p>
                    <p>בברכה,<br>צוות WEFLOWZ</p>
                </div>`,
                // בטריגר האמיתי אין עותק נפרד לסופר אדמין - נשלח רק למבקש. לצרכי בדיקה, אותו תוכן.
                saSubject: 'WEFLOWZ | שחזור קוד וסיסמה לסביבה שלך (אין בפועל עותק SA - זהה למייל הלקוח)',
                saHtml: null
            },
            business_reset: {
                userSubject: `WEFLOWZ | איפוס סיסמה — ${bizName}`,
                userHtml: `<div dir="rtl" style="font-family:Arial;max-width:520px">
                    <h2>איפוס סיסמה — ${bizName}</h2>
                    <p>קיבלנו בקשה לאיפוס הסיסמה שלך ב-WEFLOWZ.</p>
                    <p><a href="#" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">איפוס סיסמה (בטריגר האמיתי - קישור פעיל עם טוקן)</a></p>
                    <p style="color:#64748b;font-size:13px">הקישור תקף לשעה אחת. אם לא ביקשת את האיפוס — התעלם מהודעה זו.</p>
                </div>`,
                // בטריגר האמיתי אין עותק נפרד לסופר אדמין - נשלח רק למבקש. לצרכי בדיקה, אותו תוכן.
                saSubject: `WEFLOWZ | איפוס סיסמה — ${bizName} (אין בפועל עותק SA - זהה למייל הלקוח)`,
                saHtml: null
            }
        };
