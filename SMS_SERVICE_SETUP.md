# SMS Service Setup - הגדרת שירות SMS

## מצב בדיקה (Test Mode) - ברירת מחדל

בכל הרצה ללא `SMS_SERVICE` בـ `.env`, קוד האישור **יודפס רק ללוג**:

```bash
# כלא צריך שום הגדרה - זה ברירת המחדל
node server.js
```

בקונסול תראה:
```
[SMS_TEST] {"timestamp":"2026-06-18T10:30:00Z","phone":"0545103343","message":"קוד האישור שלך: 1234","code":"1234","testMode":true}
```

---

## Twilio (מומלץ ללעסקים)

### 1. התקנה
```bash
npm install twilio
```

### 2. הגדרות ב-.env
```
SMS_SERVICE=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. קוד ב-server.js
החלף את הקוד בתוך `smsService`:

```javascript
const twilio = require('twilio');

const smsService = {
    send: async (phone, message, code) => {
        if (process.env.SMS_SERVICE !== 'twilio') return { success: false };

        try {
            const client = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );

            const msg = await client.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: `+972${phone.substring(1)}` // המרת טלפון ישראלי
            });

            console.log(`[SMS_TWILIO] Sent to ${phone}, SID: ${msg.sid}`);
            return { success: true, msgSid: msg.sid };
        } catch(e) {
            console.error(`[SMS_TWILIO_ERROR] ${e.message}`);
            return { success: false, error: e.message };
        }
    }
};
```

---

## Mada SMS (תקשורת בישראל)

### 1. הגדרות ב-.env
```
SMS_SERVICE=mada
MADA_API_KEY=your_api_key
MADA_SENDER_ID=your_sender_id
```

### 2. קוד ב-server.js

```javascript
const smsService = {
    send: async (phone, message, code) => {
        if (process.env.SMS_SERVICE !== 'mada') return { success: false };

        try {
            const response = await fetch('https://api.madasms.com/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.MADA_API_KEY}`
                },
                body: JSON.stringify({
                    to: `+972${phone.substring(1)}`,
                    text: message,
                    senderId: process.env.MADA_SENDER_ID
                })
            });

            const data = await response.json();
            console.log(`[SMS_MADA] Status: ${data.status}`);
            return { success: data.status === 'sent', msgId: data.msgId };
        } catch(e) {
            console.error(`[SMS_MADA_ERROR] ${e.message}`);
            return { success: false, error: e.message };
        }
    }
};
```

---

## פופ"ש / חברות תקשורת אחרות

הגדר בדומה לעיל, תוך התאמה לפורמט ה-API של החברה.

---

## בדיקה מהקונסול

```javascript
// כדי לבדוק את השירות:
const result = await smsService.send('0545103343', 'קוד: 1234', '1234');
console.log(result);
```

---

## זיכרון
- **בדיקות**: השאר ללא `SMS_SERVICE` בـ `.env`
- **עברור לשרת אמיתי**: הוסף `SMS_SERVICE=twilio` (או svc אחר) ו-credentials ב-.env
- **אל תשכח**: הודעה בטלפון = קוד 4 ספרות מ-`smsCode`
