/**
 * seed-qa-book.js
 * מאכלס מחדש את sa_product_book מתוך ENV_MAP של qa-book.html + כותרות מקבצי הספק
 * הרצה: node seed-qa-book.js
 */

const fs   = require('fs');
const path = require('path');

const SERVER   = process.env.QA_SERVER || 'https://oneflowlife.co.il';
const SA_TOKEN = process.env.SA_TOKEN  || 'SA_SECRET_TOKEN_2026';

// ── ENV_MAP מדויק מ-qa-book.html ──────────────────────────────────────────────
const ENV_MAP = {
  'AUTH-01':['family'],'AUTH-02':['biz'],'AUTH-03':['family','biz'],'AUTH-04':['family','biz'],'AUTH-05':['family','biz'],'AUTH-06':['family','biz'],'AUTH-07':['family','biz'],'AUTH-08':['family','biz'],'AUTH-09':['family','biz'],'AUTH-10':['family','biz'],'AUTH-11':['family','biz'],'AUTH-12':['family','biz'],'AUTH-13':['biz'],'AUTH-14':['family','biz'],'AUTH-15':['family','biz'],
  'ONBD-01':['family','biz'],'ONBD-02':['family','biz'],'ONBD-03':['family'],'ONBD-04':['biz'],'ONBD-05':['family','biz'],'ONBD-06':['family','biz'],'ONBD-07':['family','biz'],'ONBD-08':['family','biz'],
  'FAM-01':['family'],'FAM-02':['family'],'FAM-03':['family'],'FAM-04':['family'],'FAM-05':['family'],'FAM-06':['family'],'FAM-07':['family'],'FAM-08':['family'],'FAM-09':['family'],'FAM-10':['family'],'FAM-11':['family'],'FAM-12':['family'],'FAM-13':['family'],'FAM-14':['family'],'FAM-15':['family'],'FAM-16':['family'],'FAM-17':['family'],'FAM-18':['family'],'FAM-19':['family'],'FAM-20':['family'],'FAM-21':['family'],'FAM-22':['family'],'FAM-23':['family'],'FAM-24':['family'],'FAM-25':['family'],'FAM-26':['family'],'FAM-27':['family'],'FAM-28':['family'],'FAM-29':['family'],'FAM-30':['family'],
  'BIZ-01':['biz'],'BIZ-02':['biz'],'BIZ-03':['biz'],'BIZ-04':['biz'],'BIZ-05':['biz'],'BIZ-06':['biz'],'BIZ-07':['biz'],'BIZ-08':['biz'],'BIZ-09':['biz'],'BIZ-10':['biz'],'BIZ-11':['biz'],'BIZ-12':['biz'],'BIZ-13':['biz'],'BIZ-14':['biz'],'BIZ-15':['biz'],'BIZ-16':['biz'],'BIZ-17':['biz'],'BIZ-18':['biz'],'BIZ-19':['biz'],'BIZ-20':['biz'],'BIZ-21':['biz'],'BIZ-22':['biz'],'BIZ-23':['biz'],'BIZ-24':['biz'],'BIZ-25':['biz'],'BIZ-26':['biz'],'BIZ-27':['biz'],'BIZ-28':['biz'],'BIZ-29':['biz'],'BIZ-30':['biz'],
  'STR-01':['biz'],'STR-02':['biz'],'STR-03':['biz'],'STR-04':['biz'],'STR-05':['biz'],'STR-06':['biz'],'STR-07':['biz'],'STR-08':['biz'],'STR-09':['biz'],'STR-10':['biz'],'STR-11':['biz'],'STR-12':['biz'],'STR-13':['biz'],'STR-14':['biz'],'STR-15':['biz'],'STR-16':['biz'],'STR-17':['biz'],'STR-18':['biz'],'STR-19':['biz'],'STR-20':['biz'],'STR-21':['biz'],'STR-22':['biz'],'STR-23':['biz'],
  'POS-01':['biz'],'POS-02':['biz'],'POS-03':['biz'],'POS-04':['biz'],'POS-05':['biz'],'POS-06':['biz'],'POS-07':['biz'],'POS-08':['biz'],'POS-09':['biz'],'POS-10':['biz'],'POS-11':['biz'],'POS-12':['biz'],'POS-13':['biz'],'POS-14':['biz'],'POS-15':['biz'],
  'B2B-01':['biz'],'B2B-02':['biz'],'B2B-03':['biz'],'B2B-04':['biz'],'B2B-05':['biz'],'B2B-06':['biz'],'B2B-07':['biz','comm'],'B2B-08':['biz','comm'],'B2B-09':['biz'],'B2B-10':['biz'],'B2B-11':['biz'],'B2B-12':['biz','comm'],
  'FIN-01':['family','biz'],'FIN-02':['family','biz'],'FIN-03':['family','biz'],'FIN-04':['family','biz'],'FIN-05':['family','biz'],'FIN-06':['family','biz'],'FIN-07':['family','biz'],'FIN-08':['family','biz'],'FIN-09':['family','biz'],'FIN-10':['family','biz'],'FIN-11':['biz'],'FIN-12':['biz'],
  'INV-01':['family','biz'],'INV-02':['family'],'INV-03':['family','biz'],'INV-04':['family'],'INV-05':['family','biz'],'INV-06':['family','biz'],'INV-07':['family','biz'],'INV-08':['family','biz'],'INV-09':['family','biz'],'INV-10':['family'],'INV-11':['family','biz'],'INV-12':['biz'],
  'AI-01':['family','biz'],'AI-02':['family','biz'],'AI-03':['biz'],'AI-04':['biz'],'AI-05':['family'],'AI-06':['family','biz'],'AI-07':['biz'],'AI-08':['family'],'AI-09':['family','biz'],'AI-10':['family','biz'],'AI-11':['biz'],'AI-12':['family','biz'],'AI-13':['family'],'AI-14':['family','biz'],'AI-15':['family','biz'],
  'CAL-01':['biz'],'CAL-02':['biz'],'CAL-03':['biz'],'CAL-04':['biz'],'CAL-05':['biz'],'CAL-06':['biz'],'CAL-07':['biz'],'CAL-08':['biz'],'CAL-09':['biz'],'CAL-10':['biz'],'CAL-11':['biz'],'CAL-12':['biz'],
  'SHF-01':['biz'],'SHF-02':['biz'],'SHF-03':['biz'],'SHF-04':['biz'],'SHF-05':['biz'],'SHF-06':['biz'],'SHF-07':['biz'],'SHF-08':['biz'],'SHF-09':['biz'],'SHF-10':['biz'],
  'TSK-01':['family','biz'],'TSK-02':['family','biz'],'TSK-03':['family','biz'],'TSK-04':['family','biz'],'TSK-05':['family','biz'],'TSK-06':['family','biz'],'TSK-07':['family','biz'],'TSK-08':['family','biz'],'TSK-09':['family','biz'],'TSK-10':['family','biz'],
  'ACAD-01':['family','biz'],'ACAD-02':['family','biz'],'ACAD-03':['family','biz'],'ACAD-04':['family','biz'],'ACAD-05':['family','biz'],'ACAD-06':['family','biz'],'ACAD-07':['family','biz'],'ACAD-08':['family','biz'],'ACAD-09':['family','biz'],'ACAD-10':['family','biz'],
  'COM-01':['family'],'COM-02':['biz'],'COM-03':['biz','comm'],'COM-04':['biz','comm'],'COM-05':['biz','comm'],'COM-06':['biz','comm'],'COM-07':['family','biz'],'COM-08':['family'],'COM-09':['family','comm'],'COM-10':['family','biz'],'COM-11':['comm'],'COM-12':['comm'],
  'NOT-01':['family','biz'],'NOT-02':['family','biz'],'NOT-03':['family','biz'],'NOT-04':['family','biz'],'NOT-05':['family','biz'],'NOT-06':['family','biz'],'NOT-07':['family','biz'],'NOT-08':['family','biz'],'NOT-09':['biz'],'NOT-10':['family','biz'],
  'SA-01':['sa'],'SA-02':['sa'],'SA-03':['sa'],'SA-04':['sa'],'SA-05':['sa'],'SA-06':['sa'],'SA-07':['sa'],'SA-08':['sa'],'SA-09':['sa'],'SA-10':['sa'],'SA-11':['sa'],'SA-12':['sa'],'SA-13':['sa'],'SA-14':['sa'],'SA-15':['sa'],
  'SMK-01':['sa'],'SMK-02':['sa'],'SMK-03':['sa'],'SMK-04':['sa'],'SMK-05':['sa'],'SMK-06':['sa'],'SMK-07':['sa'],'SMK-08':['sa'],'SMK-09':['sa'],'SMK-10':['sa'],'SMK-11':['sa'],'SMK-12':['sa'],'SMK-13':['sa'],'SMK-14':['sa'],'SMK-15':['sa'],'SMK-16':['sa'],'SMK-17':['sa'],'SMK-18':['sa'],'SMK-19':['sa'],'SMK-20':['sa'],
  'PWA-01':['family','biz'],'PWA-02':['family','biz'],'PWA-03':['family','biz'],'PWA-04':['family','biz'],'PWA-05':['family','biz'],'PWA-06':['family','biz'],'PWA-07':['family','biz'],'PWA-08':['family','biz'],'PWA-09':['biz'],'PWA-10':['family','biz'],'PWA-11':['family','biz'],'PWA-12':['biz'],
  'PFAM-01':['family'],'PFAM-02':['family'],'PFAM-03':['family'],'PFAM-04':['family'],'PFAM-05':['family'],'PFAM-06':['family'],'PFAM-07':['family'],'PFAM-08':['family'],'PFAM-09':['family'],'PFAM-10':['family'],'PFAM-11':['family'],'PFAM-12':['family'],'PFAM-13':['family'],'PFAM-14':['family'],'PFAM-15':['family'],'PFAM-16':['family'],'PFAM-17':['family'],'PFAM-18':['family'],'PFAM-19':['family'],'PFAM-20':['family'],
  'PBIZ-01':['biz'],'PBIZ-02':['biz'],'PBIZ-03':['biz'],'PBIZ-04':['biz'],'PBIZ-05':['biz'],'PBIZ-06':['biz'],'PBIZ-07':['biz'],'PBIZ-08':['biz'],'PBIZ-09':['biz'],'PBIZ-10':['biz'],'PBIZ-11':['biz'],'PBIZ-12':['biz'],'PBIZ-13':['biz'],'PBIZ-14':['biz'],'PBIZ-15':['biz'],'PBIZ-16':['biz'],'PBIZ-17':['biz'],'PBIZ-18':['biz'],'PBIZ-19':['biz'],'PBIZ-20':['biz'],'PBIZ-21':['biz'],'PBIZ-22':['biz'],'PBIZ-23':['biz'],'PBIZ-24':['biz'],'PBIZ-25':['biz'],'PBIZ-26':['biz'],'PBIZ-27':['biz'],'PBIZ-28':['biz'],'PBIZ-29':['biz'],'PBIZ-30':['biz'],'PBIZ-31':['biz'],'PBIZ-32':['biz'],'PBIZ-33':['biz'],'PBIZ-34':['biz'],'PBIZ-35':['biz'],
  'SAF-01':['sa'],'SAF-02':['sa'],'SAF-03':['sa'],'SAF-04':['sa'],'SAF-05':['sa'],'SAF-06':['sa'],'SAF-07':['sa'],'SAF-08':['sa'],'SAF-09':['sa'],'SAF-10':['sa'],'SAF-11':['sa'],'SAF-12':['sa'],'SAF-13':['sa'],'SAF-14':['sa'],'SAF-15':['sa'],'SAF-16':['sa'],'SAF-17':['sa'],'SAF-18':['sa'],'SAF-19':['sa'],'SAF-20':['sa'],'SAF-21':['sa'],'SAF-22':['sa'],'SAF-23':['sa'],'SAF-24':['sa'],'SAF-25':['sa'],'SAF-26':['sa'],'SAF-27':['sa'],'SAF-28':['sa'],
};

// ── icon ו-color לפי section ──────────────────────────────────────────────────
const sectionMeta = {
  AUTH:  { icon: '🔐', color: '#6366f1' },
  ONBD:  { icon: '🚀', color: '#8b5cf6' },
  FAM:   { icon: '🏠', color: '#ec4899' },
  PFAM:  { icon: '👶', color: '#f97316' },
  BIZ:   { icon: '💼', color: '#0ea5e9' },
  PBIZ:  { icon: '🔒', color: '#64748b' },
  CAL:   { icon: '📅', color: '#14b8a6' },
  TSK:   { icon: '✅', color: '#22c55e' },
  ACAD:  { icon: '📚', color: '#a855f7' },
  NOT:   { icon: '🔔', color: '#f59e0b' },
  FIN:   { icon: '💰', color: '#10b981' },
  INV:   { icon: '🎁', color: '#f43f5e' },
  SHF:   { icon: '🤝', color: '#06b6d4' },
  COM:   { icon: '🏘️',  color: '#84cc16' },
  B2B:   { icon: '🏪', color: '#3b82f6' },
  AI:    { icon: '🤖', color: '#7c3aed' },
  PWA:   { icon: '📱', color: '#0891b2' },
  SA:    { icon: '⚙️',  color: '#475569' },
  SAF:   { icon: '🛡️',  color: '#dc2626' },
  SMK:   { icon: '📣', color: '#d97706' },
  STR:   { icon: '🏬', color: '#059669' },
  POS:   { icon: '🛒', color: '#7c3aed' },
  SHF:   { icon: '🤝', color: '#06b6d4' },
};

// ── כותרות מקבצי הספק ────────────────────────────────────────────────────────
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
      map.set(idMatch[1], raw.replace('[' + idMatch[1] + '] ', '').trim().substring(0, 150) || idMatch[1]);
    }
  }
  return map;
}

// ── בניית רשימת בדיקות ───────────────────────────────────────────────────────
function buildTests() {
  const titles = extractTitles();
  const tests = [];

  // כל מה שב-ENV_MAP
  for (const [id, envs] of Object.entries(ENV_MAP)) {
    const section = id.split('-')[0];
    const meta = sectionMeta[section] || { icon: '🔹', color: '#94a3b8' };
    tests.push({
      id,
      section_id: section,
      title: titles.get(id) || id,
      description: '',
      envs,
      icon: meta.icon,
      color: meta.color,
    });
  }

  // בדיקות בספק שאינן ב-ENV_MAP — ברירת מחדל: שתי הסביבות
  for (const [id, title] of titles) {
    if (ENV_MAP[id]) continue;
    const section = id.split('-')[0];
    const meta = sectionMeta[section] || { icon: '🔹', color: '#94a3b8' };
    tests.push({
      id,
      section_id: section,
      title,
      description: '',
      envs: ['family', 'biz'],
      icon: meta.icon,
      color: meta.color,
    });
  }

  return tests;
}

// ── POST יחיד ────────────────────────────────────────────────────────────────
function postOne(test) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(test);
    const u = new URL(`${SERVER}/api/sa/qa/tests`);
    const lib = u.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': SA_TOKEN,
      },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, id: test.id }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── ריצה ────────────────────────────────────────────────────────────────────
async function main() {
  const tests = buildTests();
  const totalRows = tests.reduce((n, t) => n + t.envs.length, 0);
  console.log(`\nסה"כ בדיקות ייחודיות: ${tests.length}`);
  console.log(`סה"כ שורות בספר QA:   ${totalRows}`);
  console.log(`שולח ל-${SERVER}...\n`);

  let ok = 0, fail = 0;
  for (const t of tests) {
    const res = await postOne(t);
    if (res.status === 200 || res.status === 201) {
      ok++;
      process.stdout.write(`\r✅ ${ok}/${tests.length}`);
    } else {
      fail++;
      console.error(`\n❌ ${t.id} — HTTP ${res.status}`);
    }
    await new Promise(r => setTimeout(r, 30));
  }

  console.log(`\n\nסיום: ${ok} הוכנסו, ${fail} נכשלו`);
  console.log(`ספר QA יציג ${totalRows} שורות`);
}

main().catch(console.error);
