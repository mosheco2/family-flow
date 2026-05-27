/**
 * seed-qa-book.js
 * מנקה ומאכלס מחדש את sa_product_book
 * הרצה: node seed-qa-book.js
 */

const fs   = require('fs');
const path = require('path');

const SERVER   = process.env.QA_SERVER || 'https://oneflowlife.co.il';
const SA_TOKEN = process.env.SA_TOKEN  || 'SA_SECRET_TOKEN_2026';

// ── מיפוי מזהה → category (בדיוק כמו שqa-book.html מצפה) ─────────────────────
const ID_TO_CAT = {
  AUTH:  'אימות ומשתמשים',
  ONBD:  'אשף הכניסה (Onboarding)',
  FAM:   'סביבת משפחה — לשוניות ראשיות',
  PFAM:  'הרשאות — סביבת משפחה (הורה vs ילד)',
  BIZ:   'סביבת עסק — לשוניות ראשיות',
  PBIZ:  'הרשאות — סביבת עסק (4 תפקידים)',
  STR:   'חנות, קטלוג ו-Storefront',
  POS:   'קופה (POS)',
  B2B:   'רכש, ספקים ו-B2B',
  FIN:   'פיננסים ותקציב',
  INV:   'מלאי, רכש וקניות',
  AI:    "AI ופיצ'רים חכמים",
  CAL:   'יומן, תורים והזמנות',
  SHF:   'משמרות ולוח עובדים',
  TSK:   'משימות',
  ACAD:  'אקדמיה',
  COM:   'קהילות ו-B2B קהילה',
  NOT:   'התראות, Inbox ותקשורת',
  SA:    'SuperAdmin',
  SAF:   'SuperAdmin — sa.html ו-sa-app.js',
  SMK:   'SuperAdmin — שיווק וניוזלטר',
  PWA:   'PWA, ביצועים ואבטחה',
};

// ── חילוץ כותרות מקבצי הספק ──────────────────────────────────────────────────
function extractTitles() {
  const testsDir = path.join(__dirname, 'tests');
  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.spec.js'));
  const map = new Map();
  for (const f of files) {
    const content = fs.readFileSync(path.join(testsDir, f), 'utf8');
    for (const line of content.split('\n')) {
      const idMatch = line.match(/\[([A-Z0-9\-]+)\]/);
      if (!idMatch || map.has(idMatch[1])) continue;
      const titleMatch = line.match(/['\`](\[.*?\][^'\`]*)['\`]/);
      const raw = titleMatch ? titleMatch[1] : idMatch[1];
      const name = raw.replace('[' + idMatch[1] + '] ', '').trim().substring(0, 180) || idMatch[1];
      map.set(idMatch[1], name);
    }
  }
  return map;
}

// ── בניית רשימת בדיקות ───────────────────────────────────────────────────────
function buildTests() {
  const titles = extractTitles();
  return [...titles.entries()].map(([id, name]) => {
    const prefix = id.split('-')[0];
    return {
      id,
      category: ID_TO_CAT[prefix] || 'כללי',
      name,
      description: '',
      priority: 'medium',
    };
  });
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? require('https') : require('http');
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname,
      method,
      headers: { 'Authorization': SA_TOKEN },
    };
    if (data) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = lib.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── ריצה ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. נקה את הטבלה
  console.log('\nמנקה את sa_product_book...');
  const delRes = await request('DELETE', `${SERVER}/api/sa/qa/tests`);
  if (delRes.status === 200) {
    console.log('✅ טבלה נוקתה');
  } else {
    console.warn(`⚠️  ניקוי החזיר HTTP ${delRes.status} — ממשיך בכל מקרה`);
  }

  // 2. שלח את הבדיקות
  const tests = buildTests();
  console.log(`\nמוסיף ${tests.length} בדיקות ל-${SERVER}...\n`);

  let ok = 0, fail = 0;
  for (const t of tests) {
    const res = await request('POST', `${SERVER}/api/sa/qa/tests`, t);
    if (res.status === 200 || res.status === 201) {
      ok++;
      process.stdout.write(`\r✅ ${ok}/${tests.length}`);
    } else {
      fail++;
      console.error(`\n❌ ${t.id} HTTP ${res.status}:`, JSON.stringify(res.body).substring(0, 80));
    }
    await new Promise(r => setTimeout(r, 30));
  }

  console.log(`\n\nסיום: ${ok} הוכנסו, ${fail} נכשלו`);
  console.log('רענן את qa-book.html');
}

main().catch(console.error);
