const https = require('https');
const querystring = require('querystring');

function formatPhone(raw) {
    if (!raw) return null;
    let p = raw.replace(/\D/g, '');
    if (p.startsWith('0')) p = '972' + p.slice(1);
    if (!p.startsWith('972') || p.length < 11) return null;
    return p;
}

function buildMessage(businessName, content, linkUrl) {
    let msg = `*${businessName}*\n\n${content}`;
    if (linkUrl) msg += `\n\n🔗 ${linkUrl}`;
    msg += `\n\n—\n_הודעה זו נשלחה דרך מערכת Oneflow_`;
    return msg;
}

async function checkAlreadySent(pool, groupId, messageType, recipientPhone, withinHours = 23) {
    try {
        const r = await pool.query(
            `SELECT id FROM whatsapp_log WHERE group_id=$1 AND message_type=$2 AND recipient_phone=$3 AND sent_at > NOW() - INTERVAL '${parseInt(withinHours)} hours' LIMIT 1`,
            [groupId, messageType, recipientPhone]
        );
        return r.rows.length > 0;
    } catch (e) { return false; }
}

function sendUltraMsg(instanceId, token, phone, message) {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({ token, to: phone, body: message });
        const options = {
            hostname: 'api.ultramsg.com',
            path: `/${instanceId}/messages/chat`,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ sent: true }); } });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function sendWhatsApp(pool, groupId, phone, businessName, content, linkUrl, recipientType, recipientName, messageType) {
    const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
    const token = process.env.ULTRAMSG_TOKEN;
    const formattedPhone = formatPhone(phone);

    const status = (!instanceId || !token) ? 'no_config' : (!formattedPhone ? 'invalid_phone' : 'pending');

    let errorMsg = null;
    let result = null;

    if (status === 'pending') {
        try {
            const message = buildMessage(businessName, content, linkUrl);
            result = await sendUltraMsg(instanceId, token, formattedPhone, message);
        } catch (e) {
            errorMsg = e.message;
        }
    }

    try {
        await pool.query(
            `INSERT INTO whatsapp_log (group_id, message_type, recipient_type, recipient_name, recipient_phone, content, status, error_msg)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [groupId, messageType, recipientType, recipientName || '', formattedPhone || phone, content,
             errorMsg ? 'error' : (status === 'pending' ? 'sent' : status), errorMsg]
        );
    } catch (e) { /* log silently */ }

    return { success: !errorMsg && status === 'pending', result };
}

module.exports = { sendWhatsApp, buildMessage, checkAlreadySent, formatPhone };
