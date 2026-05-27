/**
 * seed-qa-book.js
 * מאכלס מחדש את sa_product_book מתוך קבצי הבדיקות
 * הרצה: node seed-qa-book.js
 */

const fs   = require('fs');
const path = require('path');
const http = require('https');

const SERVER = process.env.QA_SERVER || 'https://oneflowlife.co.il';
const SA_TOKEN = process.env.SA_TOKEN || 'SA_SECRET_TOKEN_2026';

const categoryMap = {
  'auth': 'אימות ומשתמשים', 'biz-auth': 'אימות ומשתמשים',
  'onboarding': 'Onboarding',
  'family-core': 'סביבת משפחה', 'family-bank': 'סביבת משפחה', 'goals': 'סביבת משפחה',
  'calendar': 'יומן משפחה',
  'tasks': 'משימות', 'biz-tasks': 'משימות',
  'acad': 'אקדמיה', 'biz-academy': 'אקדמיה',
  'notif': 'התראות', 'budget': 'פיננסי', 'kids': 'ילדים והרשאות',
  'community': 'קהילה', 'search': 'קהילה', 'b2b': 'B2B',
  'ai': 'בינה מלאכותית', 'biz-ai': 'בינה מלאכותית',
  'allowance': 'דמי כיס',
  'accessibility': 'PWA ונגישות',
  'profile': 'SuperAdmin', 'admin': 'SuperAdmin', 'reports': 'SuperAdmin',
  'rewards': 'שיווק',
  'biz-timeclock': 'עסק', 'biz-cashflow': 'עסק', 'biz-hr': 'עסק',
  'biz-crm': 'עסק', 'biz-inventory': 'עסק', 'biz-sales': 'עסק',
  'biz-pos': 'קופה', 'biz-permissions': 'הרשאות עסק',
  'biz-shipping': 'שליחויות', 'biz-calendar': 'יומן עסקי', 'biz-settings': 'הגדרות עסק',
  'loans': 'שיפוי', 'settings': 'הגדרות חנות', 'export': 'ייצוא וקופונים',
};

function extractTests() {
  const testsDir = path.join(__dirname, 'tests');
  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.spec.js'));
  const tests = [];
  const seen = new Set();

  for (const f of files) {
    const content = fs.readFileSync(path.join(testsDir, f), 'utf8');
    const base = f.replace('.spec.js', '');
    const cat = categoryMap[base] || base;
    const lines = content.split('\n');
    for (const line of lines) {
      const m = line.match(/\[([A-Z0-9\-]+)\]/);
      if (!m) continue;
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const titleM = line.match(/['\`](\[.*?\][^'\`]*)['\`]/);
      const name = titleM ? titleM[1].replace('[' + id + '] ', '').trim() : id;
      tests.push({ id, cat, name: name.substring(0, 150), desc: '', prio: 'medium' });
    }
  }
  return tests;
}

function postJSON(url, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': token,
      },
    };
    const lib = u.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request(options, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const tests = extractTests();
  console.log(`\nמצאתי ${tests.length} בדיקות בקבצי הספק. שולח ל-${SERVER}...\n`);

  const result = await postJSON(
    `${SERVER}/api/sa/qa/tests/bulk`,
    { tests },
    SA_TOKEN
  );

  if (result.body && result.body.success) {
    console.log(`✅ הוכנסו ${result.body.inserted} בדיקות ל-sa_product_book`);
  } else {
    console.error('❌ שגיאה:', JSON.stringify(result));
  }
}

main().catch(console.error);
