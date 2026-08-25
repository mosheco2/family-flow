/**
 * family-flow API Integration Test
 * הרצה: node scripts/api-test.js
 * דורש: node 18+, גישה לאינטרנט
 */

const BASE = 'https://family-flow-app.onrender.com';

// ─── credentials ─────────────────────────────────────────────────────────────
// עדכן אם הפרטים השתנו
const CREDS = {
  family: { groupCode: 'NWP701', nickname: 'מושיק כהן', password: '123456' },
  // BIZ: login ב-/api/biz/login דורש phone+password (לא groupCode)
  // שנה ל-phone האמיתי של מנהל העסק:
  biz: { phone: 'REPLACE_WITH_BIZ_PHONE', password: '123456' },
  // SA: email+password של Super Admin (אם יש)
  sa: { code: '', password: '' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0;
const failures = [];

async function req(method, path, { token, tokenType = 'Bearer', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `${tokenType} ${token}`;
  try {
    const r = await fetch(`${BASE}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { status: 0, body: { error: e.message } };
  }
}

function check(label, status, { expectNot = [401, 403, 500], warn = [] } = {}) {
  const bad = expectNot.includes(status);
  const w = warn.includes(status);
  if (status === 0) {
    warned++;
    console.log(`  ⚠️  ${label} → timeout/network`);
  } else if (bad) {
    failed++;
    failures.push(`❌ ${label} → ${status}`);
    console.log(`  ❌ ${label} → ${status}`);
  } else if (w) {
    warned++;
    console.log(`  ⚠️  ${label} → ${status}`);
  } else {
    passed++;
    console.log(`  ✅ ${label} → ${status}`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🔍 family-flow API Integration Test');
  console.log(`   ${BASE}\n`);

  // 1. Server health
  console.log('=== 1. Server Health ===');
  const root = await req('GET', '/');
  check('Server responds', root.status, { expectNot: [0, 500] });

  // 2. Auth guard
  console.log('\n=== 2. Auth Guard ===');
  const noAuth = await req('GET', '/api/biz/profile');
  check('No-token → blocked (401/403)', noAuth.status, { expectNot: [200, 500] });

  // 3. Family login + endpoints
  console.log('\n=== 3. FAMILY ===');
  const famLogin = await req('POST', '/api/login', { body: CREDS.family });
  if (famLogin.status !== 200 || !famLogin.body.token) {
    console.log(`  ❌ Family login נכשל → ${famLogin.status}`, famLogin.body.error || '');
    failed++;
  } else {
    const { token: fTok, groupId: famId } = famLogin.body;
    console.log(`  ✅ Family login → ${famLogin.status} (groupId=${famId})`);
    passed++;

    const famTests = [
      ['GET', `/api/family/${famId}/calendar`],
      ['GET', `/api/family/${famId}/tasks`],
      ['GET', `/api/family/${famId}/members`],
      ['GET', `/api/family/${famId}/flow-wallet`],
      ['GET', `/api/family/${famId}/kids`],
      ['GET', `/api/community/groups`],
    ];
    for (const [m, p] of famTests) {
      const r = await req(m, p, { token: fTok });
      check(`${m} ${p}`, r.status, { expectNot: [401, 403, 500], warn: [404] });
    }

    // IDOR: גישה ל-family אחרת
    const wrongFam = (parseInt(famId) || 0) + 9999;
    const idor = await req('GET', `/api/family/${wrongFam}/members`, { token: fTok });
    check(`IDOR Family blocked (id=${wrongFam})`, idor.status, { expectNot: [200, 500] });
  }

  // 4. BIZ login + endpoints
  console.log('\n=== 4. BIZ ===');
  if (CREDS.biz.phone === 'REPLACE_WITH_BIZ_PHONE') {
    console.log('  ⚠️  phone לא הוגדר — מדלג על בדיקות BIZ');
    warned++;
  } else {
    const bizLogin = await req('POST', '/api/biz/login', { body: CREDS.biz });
    if (bizLogin.status !== 200 || !bizLogin.body.token) {
      console.log(`  ❌ BIZ login נכשל → ${bizLogin.status}`, bizLogin.body?.error || '');
      failed++;
    } else {
      const { token: bTok } = bizLogin.body;
      const bizId = bizLogin.body.groupId || bizLogin.body.group_id || bizLogin.body.bizGroupId;
      console.log(`  ✅ BIZ login → ${bizLogin.status} (groupId=${bizId})`);
      passed++;

      const bizTests = [
        ['GET', `/api/biz/profile`],
        ['GET', `/api/beauty/${bizId}/practitioners`],
        ['GET', `/api/beauty/${bizId}/resources`],
        ['GET', `/api/beauty/${bizId}/appointments?from=2026-01-01&to=2026-12-31`],
        ['GET', `/api/beauty/${bizId}/clients`],
        ['GET', `/api/beauty/${bizId}/services`],
        ['GET', `/api/beauty/${bizId}/inventory`],
        ['GET', `/api/beauty/${bizId}/dashboard`],
        ['GET', `/api/beauty/${bizId}/alerts`],
        ['GET', `/api/beauty/${bizId}/commissions`],
        ['GET', `/api/beauty/${bizId}/rfq`],
      ];
      for (const [m, p] of bizTests) {
        const r = await req(m, p, { token: bTok });
        check(`${m} ${p}`, r.status, { expectNot: [401, 403, 500], warn: [404] });
      }

      // Work Orders payments (תיקוני authorization)
      console.log('\n  --- Work Orders Payments ---');
      const wpTests = [
        ['GET',    `/api/work-orders/999999/payments`],
        ['PATCH',  `/api/work-orders/payments/999999/receive`],
        ['DELETE', `/api/work-orders/payments/999999`],
      ];
      for (const [m, p] of wpTests) {
        const r = await req(m, p, { token: bTok });
        check(`${m} ${p}`, r.status, { expectNot: [401, 500], warn: [404, 403] });
      }

      // IDOR: גישה לעסק אחר
      const wrongBiz = (parseInt(bizId) || 0) + 9999;
      const idor = await req('GET', `/api/beauty/${wrongBiz}/practitioners`, { token: bTok });
      check(`IDOR BIZ blocked (id=${wrongBiz})`, idor.status, { expectNot: [200, 500] });
    }
  }

  // 5. SA endpoints
  console.log('\n=== 5. SUPER ADMIN ===');
  if (!CREDS.sa.code) {
    console.log('  ⚠️  אין credentials SA — מדלג');
    warned++;
  } else {
    const saLogin = await req('POST', '/api/superadmin/login', { body: CREDS.sa });
    if (saLogin.status !== 200 || !saLogin.body.token) {
      console.log(`  ❌ SA login נכשל → ${saLogin.status}`);
      failed++;
    } else {
      const saTok = saLogin.body.token;
      console.log(`  ✅ SA login → ${saLogin.status}`);
      passed++;
      const saTests = [
        ['GET', `/api/sa/groups/by-status/active`],
        ['GET', `/api/sa/banner/slots`],
        ['GET', `/api/sa/banner/orders`],
      ];
      for (const [m, p] of saTests) {
        const r = await req(m, p, { token: saTok, tokenType: 'SA' });
        check(`${m} ${p}`, r.status, { expectNot: [401, 403, 500], warn: [404] });
      }
    }
  }

  // 6. Public (ללא auth)
  console.log('\n=== 6. Public Endpoints ===');
  const pubTests = [
    ['GET', `/api/beauty/businesses`],
    ['GET', `/api/beauty/1/availability?from=2026-09-01&duration=60`],
  ];
  for (const [m, p] of pubTests) {
    const r = await req(m, p);
    check(`${m} ${p}`, r.status, { expectNot: [500], warn: [401, 403, 404] });
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const line = '═'.repeat(55);
  console.log(`\n${line}`);
  console.log(`✅ עברו: ${passed}   ❌ נכשלו: ${failed}   ⚠️  אזהרות: ${warned}`);
  if (failures.length) {
    console.log('\nכשלונות:');
    failures.forEach(f => console.log('  ', f));
  }
  console.log(`${line}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
