// Playwright reporter — syncs test results to QA Book via /api/qa/update
// Each test titled [TEST-ID] ... is reported per its env(s) from ENV_MAP.

const ENV_MAP = {
  'AUTH-01':['family'],
  'AUTH-02':['biz'],
  'AUTH-03':['family','biz'],
  'AUTH-04':['family','biz'],
  'AUTH-05':['family','biz'],
  'AUTH-06':['family','biz'],
  'AUTH-07':['family','biz'],
  'AUTH-08':['family','biz'],
  'AUTH-09':['family','biz'],
  'AUTH-10':['family','biz'],
  'AUTH-11':['family','biz'],
  'AUTH-12':['family','biz'],
  'AUTH-13':['biz'],
  'AUTH-14':['family','biz'],
  'AUTH-15':['family','biz'],
  'ONBD-01':['family','biz'],
  'ONBD-02':['family','biz'],
  'ONBD-03':['family'],
  'ONBD-04':['biz'],
  'ONBD-05':['family','biz'],
  'ONBD-06':['family','biz'],
  'ONBD-07':['family','biz'],
  'ONBD-08':['family','biz'],
  'FAM-01':['family'],'FAM-02':['family'],'FAM-03':['family'],'FAM-04':['family'],'FAM-05':['family'],
  'FAM-06':['family'],'FAM-07':['family'],'FAM-08':['family'],'FAM-09':['family'],'FAM-10':['family'],
  'FAM-11':['family'],'FAM-12':['family'],'FAM-13':['family'],'FAM-14':['family'],'FAM-15':['family'],
  'FAM-16':['family'],'FAM-17':['family'],'FAM-18':['family'],'FAM-19':['family'],'FAM-20':['family'],
  'FAM-21':['family'],'FAM-22':['family'],'FAM-23':['family'],'FAM-24':['family'],'FAM-25':['family'],
  'FAM-26':['family'],'FAM-27':['family'],'FAM-28':['family'],'FAM-29':['family'],'FAM-30':['family'],
  'BIZ-01':['biz'],'BIZ-02':['biz'],'BIZ-03':['biz'],'BIZ-04':['biz'],'BIZ-05':['biz'],
  'BIZ-06':['biz'],'BIZ-07':['biz'],'BIZ-08':['biz'],'BIZ-09':['biz'],'BIZ-10':['biz'],
  'BIZ-11':['biz'],'BIZ-12':['biz'],'BIZ-13':['biz'],'BIZ-14':['biz'],'BIZ-15':['biz'],
  'BIZ-16':['biz'],'BIZ-17':['biz'],'BIZ-18':['biz'],'BIZ-19':['biz'],'BIZ-21':['biz'],
  'BIZ-22':['biz'],'BIZ-23':['biz'],'BIZ-24':['biz'],'BIZ-25':['biz'],'BIZ-26':['biz'],
  'BIZ-27':['biz'],'BIZ-28':['biz'],'BIZ-29':['biz'],'BIZ-30':['biz'],
  'STR-01':['biz'],'STR-02':['biz'],'STR-03':['biz'],'STR-04':['biz'],'STR-05':['biz'],
  'STR-06':['biz'],'STR-07':['biz'],'STR-08':['biz'],'STR-09':['biz'],'STR-10':['biz'],
  'STR-11':['biz'],'STR-12':['biz'],'STR-13':['biz'],'STR-14':['biz'],'STR-15':['biz'],
  'STR-16':['biz'],'STR-17':['biz'],'STR-18':['biz'],'STR-19':['biz'],'STR-20':['biz'],
  'STR-21':['biz'],'STR-22':['biz'],'STR-23':['biz'],
  'POS-01':['biz'],'POS-02':['biz'],'POS-03':['biz'],'POS-04':['biz'],'POS-05':['biz'],
  'POS-06':['biz'],'POS-07':['biz'],'POS-08':['biz'],'POS-09':['biz'],'POS-10':['biz'],
  'POS-11':['biz'],'POS-12':['biz'],'POS-13':['biz'],'POS-14':['biz'],'POS-15':['biz'],
  'B2B-01':['biz'],'B2B-02':['biz'],'B2B-03':['biz'],'B2B-04':['biz'],'B2B-05':['biz'],
  'B2B-06':['biz'],'B2B-07':['biz','comm'],'B2B-08':['biz','comm'],'B2B-09':['biz'],
  'B2B-10':['biz'],'B2B-11':['biz'],'B2B-12':['biz','comm'],
  'FIN-01':['family','biz'],'FIN-02':['family','biz'],'FIN-03':['family','biz'],
  'FIN-04':['family','biz'],'FIN-05':['family','biz'],'FIN-06':['family','biz'],
  'FIN-07':['family','biz'],'FIN-08':['family','biz'],'FIN-09':['family','biz'],
  'FIN-10':['family','biz'],'FIN-11':['biz'],'FIN-12':['biz'],
  'INV-01':['family','biz'],'INV-02':['family'],'INV-03':['family','biz'],'INV-04':['family'],
  'INV-05':['family','biz'],'INV-06':['family','biz'],'INV-07':['family','biz'],
  'INV-08':['family','biz'],'INV-09':['family','biz'],'INV-10':['family'],
  'INV-11':['family','biz'],'INV-12':['biz'],
  'AI-01':['family','biz'],'AI-02':['family','biz'],'AI-03':['biz'],'AI-04':['biz'],
  'AI-05':['family'],'AI-06':['family','biz'],'AI-07':['biz'],'AI-08':['family'],
  'AI-09':['family','biz'],'AI-10':['family','biz'],'AI-11':['biz'],'AI-12':['family','biz'],
  'AI-13':['family'],'AI-14':['family','biz'],'AI-15':['family','biz'],
  'CAL-01':['biz'],'CAL-02':['biz'],'CAL-03':['biz'],'CAL-04':['biz'],'CAL-05':['biz'],
  'CAL-06':['biz'],'CAL-07':['biz'],'CAL-08':['biz'],'CAL-09':['biz'],'CAL-10':['biz'],
  'CAL-11':['biz'],'CAL-12':['biz'],
  'SHF-01':['biz'],'SHF-02':['biz'],'SHF-03':['biz'],'SHF-04':['biz'],'SHF-05':['biz'],
  'SHF-06':['biz'],'SHF-07':['biz'],'SHF-08':['biz'],'SHF-09':['biz'],'SHF-10':['biz'],
  'TSK-01':['family','biz'],'TSK-02':['family','biz'],'TSK-03':['family','biz'],
  'TSK-04':['family','biz'],'TSK-05':['family','biz'],'TSK-06':['family','biz'],
  'TSK-07':['family','biz'],'TSK-08':['family','biz'],'TSK-09':['family','biz'],'TSK-10':['family','biz'],
  'ACAD-01':['family','biz'],'ACAD-02':['family','biz'],'ACAD-03':['family','biz'],
  'ACAD-04':['family','biz'],'ACAD-05':['family','biz'],'ACAD-06':['family','biz'],
  'ACAD-07':['family','biz'],'ACAD-08':['family','biz'],'ACAD-09':['family','biz'],'ACAD-10':['family','biz'],
  'COM-01':['family'],'COM-02':['biz'],'COM-03':['biz','comm'],'COM-04':['biz','comm'],
  'COM-05':['biz','comm'],'COM-06':['biz','comm'],'COM-07':['family','biz'],'COM-08':['family'],
  'COM-09':['family','comm'],'COM-10':['family','biz'],'COM-11':['comm'],'COM-12':['comm'],
  'NOT-01':['family','biz'],'NOT-02':['family','biz'],'NOT-03':['family','biz'],
  'NOT-04':['family','biz'],'NOT-05':['family','biz'],'NOT-06':['family','biz'],
  'NOT-07':['family','biz'],'NOT-08':['family','biz'],'NOT-09':['biz'],'NOT-10':['family','biz'],
  'SA-01':['sa'],'SA-02':['sa'],'SA-03':['sa'],'SA-04':['sa'],'SA-05':['sa'],
  'SA-06':['sa'],'SA-07':['sa'],'SA-08':['sa'],'SA-09':['sa'],'SA-10':['sa'],
  'SA-11':['sa'],'SA-12':['sa'],'SA-13':['sa'],'SA-14':['sa'],'SA-15':['sa'],
  'SMK-01':['sa'],'SMK-02':['sa'],'SMK-03':['sa'],'SMK-04':['sa'],'SMK-05':['sa'],
  'SMK-06':['sa'],'SMK-07':['sa'],'SMK-08':['sa'],'SMK-09':['sa'],'SMK-10':['sa'],
  'SMK-11':['sa'],'SMK-12':['sa'],'SMK-13':['sa'],'SMK-14':['sa'],'SMK-15':['sa'],
  'SMK-16':['sa'],'SMK-17':['sa'],'SMK-18':['sa'],'SMK-19':['sa'],'SMK-20':['sa'],
  'PWA-01':['family','biz'],'PWA-02':['family','biz'],'PWA-03':['family','biz'],
  'PWA-04':['family','biz'],'PWA-05':['family','biz'],'PWA-06':['family','biz'],
  'PWA-07':['family','biz'],'PWA-08':['family','biz'],'PWA-09':['biz'],
  'PWA-10':['family','biz'],'PWA-11':['family','biz'],'PWA-12':['biz'],
  'PFAM-01':['family'],'PFAM-02':['family'],'PFAM-03':['family'],'PFAM-04':['family'],
  'PFAM-05':['family'],'PFAM-06':['family'],'PFAM-07':['family'],'PFAM-08':['family'],
  'PFAM-09':['family'],'PFAM-10':['family'],'PFAM-11':['family'],'PFAM-12':['family'],
  'PFAM-13':['family'],'PFAM-14':['family'],'PFAM-15':['family'],'PFAM-16':['family'],
  'PFAM-17':['family'],'PFAM-18':['family'],'PFAM-19':['family'],'PFAM-20':['family'],
  'PBIZ-01':['biz'],'PBIZ-02':['biz'],'PBIZ-03':['biz'],'PBIZ-04':['biz'],'PBIZ-05':['biz'],
  'PBIZ-06':['biz'],'PBIZ-07':['biz'],'PBIZ-08':['biz'],'PBIZ-09':['biz'],'PBIZ-10':['biz'],
  'PBIZ-11':['biz'],'PBIZ-12':['biz'],'PBIZ-13':['biz'],'PBIZ-14':['biz'],'PBIZ-15':['biz'],
  'PBIZ-16':['biz'],'PBIZ-17':['biz'],'PBIZ-18':['biz'],'PBIZ-19':['biz'],'PBIZ-20':['biz'],
  'PBIZ-21':['biz'],'PBIZ-22':['biz'],'PBIZ-23':['biz'],'PBIZ-24':['biz'],'PBIZ-25':['biz'],
  'PBIZ-26':['biz'],'PBIZ-27':['biz'],'PBIZ-28':['biz'],'PBIZ-29':['biz'],'PBIZ-30':['biz'],
  'PBIZ-31':['biz'],'PBIZ-32':['biz'],'PBIZ-33':['biz'],'PBIZ-34':['biz'],'PBIZ-35':['biz'],
  'SAF-01':['sa'],'SAF-02':['sa'],'SAF-03':['sa'],'SAF-04':['sa'],'SAF-05':['sa'],
  'SAF-06':['sa'],'SAF-07':['sa'],'SAF-08':['sa'],'SAF-09':['sa'],'SAF-10':['sa'],
  'SAF-11':['sa'],'SAF-12':['sa'],'SAF-13':['sa'],'SAF-14':['sa'],'SAF-15':['sa'],
  'SAF-16':['sa'],'SAF-17':['sa'],'SAF-18':['sa'],'SAF-19':['sa'],'SAF-20':['sa'],
  'SAF-21':['sa'],'SAF-22':['sa'],'SAF-23':['sa'],'SAF-24':['sa'],'SAF-25':['sa'],
  'SAF-26':['sa'],'SAF-27':['sa'],'SAF-28':['sa'],
  'REST-01':['biz'],'REST-02':['biz'],'REST-03':['biz'],'REST-04':['biz'],'REST-05':['biz'],
  'REST-06':['biz'],'REST-07':['biz'],'REST-08':['biz'],'REST-09':['biz'],'REST-10':['biz'],
  'REST-11':['biz'],'REST-12':['biz'],'REST-13':['biz'],'REST-14':['biz'],'REST-15':['biz'],
  'REST-16':['biz'],'REST-17':['biz'],'REST-18':['biz'],'REST-19':['biz'],'REST-20':['biz'],
  'REST-21':['biz'],'REST-22':['biz'],'REST-23':['biz'],'REST-24':['biz'],'REST-25':['biz'],
  'REST-26':['biz'],'REST-27':['biz'],'REST-28':['biz'],'REST-29':['biz'],'REST-30':['biz'],
  'REST-31':['biz'],'REST-32':['biz'],'REST-33':['biz'],'REST-34':['biz'],'REST-35':['biz'],
  'REST-36':['biz'],'REST-37':['biz'],'REST-38':['biz'],'REST-39':['biz'],'REST-40':['biz'],
  'REST-41':['biz'],'REST-42':['biz'],'REST-43':['biz'],'REST-44':['biz'],'REST-45':['biz'],
  'REST-46':['biz'],'REST-47':['biz'],'REST-48':['biz'],'REST-49':['biz'],'REST-50':['biz'],
  'REST-51':['biz'],'REST-52':['biz'],'REST-53':['biz'],'REST-54':['biz'],'REST-55':['biz'],
  'REST-56':['biz'],'REST-57':['biz'],'REST-58':['biz'],'REST-59':['biz'],'REST-60':['biz'],
  'REST-61':['biz'],'REST-62':['biz'],'REST-63':['biz'],'REST-64':['biz'],'REST-65':['biz'],
  'REST-66':['biz'],'REST-67':['biz'],'REST-68':['biz'],'REST-69':['biz'],'REST-70':['biz'],
  'REST-71':['biz'],'REST-72':['biz'],'REST-73':['biz'],'REST-74':['biz'],'REST-75':['biz'],
  'REST-76':['biz'],'REST-77':['biz'],'REST-78':['biz'],'REST-79':['biz'],'REST-80':['biz'],
  'REST-81':['biz'],'REST-82':['biz'],
  'SPT-01':['biz'],'SPT-02':['biz'],'SPT-03':['biz'],'SPT-04':['biz'],'SPT-05':['biz'],
  'SPT-06':['biz'],'SPT-07':['biz'],'SPT-08':['biz'],'SPT-09':['biz'],'SPT-10':['biz'],
  'SPT-11':['biz'],'SPT-12':['biz'],'SPT-13':['biz'],'SPT-14':['biz'],'SPT-15':['biz'],
  'SPT-16':['biz'],'SPT-17':['biz'],'SPT-18':['biz'],'SPT-19':['biz'],'SPT-20':['biz'],
  'SPT-21':['biz'],'SPT-22':['biz'],'SPT-23':['biz'],'SPT-24':['biz'],'SPT-25':['biz'],
  'SPT-26':['biz'],'SPT-27':['biz'],'SPT-28':['biz'],'SPT-29':['biz'],'SPT-30':['biz'],
  'SPT-31':['biz'],'SPT-32':['biz'],'SPT-33':['biz'],'SPT-34':['biz'],'SPT-35':['biz'],
  'SPT-36':['biz'],'SPT-37':['biz'],'SPT-38':['biz'],'SPT-39':['biz'],'SPT-40':['biz'],
  'SPT-41':['biz'],'SPT-42':['biz'],'SPT-43':['biz'],'SPT-44':['biz'],'SPT-45':['biz'],
  'SPT-46':['biz'],'SPT-47':['biz'],'SPT-48':['biz'],'SPT-49':['biz'],'SPT-50':['biz'],
  'SPT-51':['biz'],'SPT-52':['biz'],'SPT-53':['biz'],'SPT-54':['biz'],'SPT-55':['biz'],
  'SPT-56':['biz'],'SPT-57':['biz'],'SPT-58':['biz'],'SPT-59':['biz'],'SPT-60':['biz'],
  'SPT-61':['biz'],'SPT-62':['biz'],'SPT-63':['biz'],'SPT-64':['biz'],'SPT-65':['biz'],
  'SPT-66':['biz'],'SPT-67':['biz'],'SPT-68':['biz'],'SPT-69':['biz'],'SPT-70':['biz'],
  'SPT-71':['biz'],'SPT-72':['biz'],'SPT-73':['biz'],'SPT-74':['biz'],'SPT-75':['biz'],
  'SPT-76':['biz'],'SPT-77':['biz'],'SPT-78':['biz'],'SPT-79':['biz'],'SPT-80':['biz'],
  'SPT-81':['biz'],'SPT-82':['biz'],
  'SPT-83':['biz'],'SPT-84':['biz'],'SPT-85':['biz'],'SPT-86':['biz'],'SPT-87':['biz'],
  'SPT-88':['biz'],'SPT-89':['biz'],'SPT-90':['biz'],'SPT-91':['biz'],'SPT-92':['biz'],
  'SPT-93':['biz'],'SPT-94':['biz'],'SPT-95':['biz'],'SPT-96':['biz'],
};

// Fallback: derive env from prefix when not in ENV_MAP
const PREFIX_ENV = {
  AUTH: ['family','biz'], ONBD: ['family','biz'],
  FAM: ['family'], BIZ: ['biz'],
  STR: ['biz'], POS: ['biz'], B2B: ['biz'],
  FIN: ['family','biz'], INV: ['family','biz'],
  AI:  ['family','biz'], CAL: ['biz'], SHF: ['biz'],
  TSK: ['family','biz'], ACAD: ['family','biz'],
  COM: ['family','biz'], NOT: ['family','biz'],
  SA:  ['sa'], SMK: ['sa'], SAF: ['sa'],
  PWA: ['family','biz'],
  PFAM: ['family'], PBIZ: ['biz'],
  REST: ['biz'],
  SPT: ['biz'],
};

function getEnvs(testId) {
  if (ENV_MAP[testId]) return ENV_MAP[testId];
  const prefix = testId.replace(/-\d+$/, '');
  return PREFIX_ENV[prefix] || ['family'];
}

function playwrightStatusToQA(status) {
  if (status === 'passed') return 'ok';
  if (status === 'failed' || status === 'timedOut' || status === 'interrupted') return 'fail';
  return 'skip'; // skipped, fixme
}

class QAReporter {
  constructor(options = {}) {
    this._server = options.server || process.env.QA_SERVER || process.env.BASE_URL || 'https://oneflowlife.co.il';
    this._pending = [];
    this._sent = 0;
    this._skipped = 0;
  }

  onTestEnd(test, result) {
    const title = test.title;
    const m = title.match(/\[([A-Z0-9]+-\d+)\]/);
    if (!m) return; // no test ID in title — skip

    const testId = m[1];
    const qaStatus = playwrightStatusToQA(result.status);
    const envs = getEnvs(testId);

    for (const env of envs) {
      this._pending.push({ testId, env, status: qaStatus });
    }
  }

  async onEnd(result) {
    if (!this._pending.length) return;

    const server = this._server.replace(/\/$/, '');
    const url = `${server}/api/qa/update`;

    console.log(`\n[QA Reporter] Syncing ${this._pending.length} results to QA Book...`);

    for (const item of this._pending) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (res.ok) {
          this._sent++;
        } else {
          console.warn(`[QA Reporter] ${item.testId}:${item.env} → HTTP ${res.status}`);
          this._skipped++;
        }
      } catch (e) {
        console.warn(`[QA Reporter] ${item.testId}:${item.env} → ${e.message}`);
        this._skipped++;
      }
    }

    const icon = this._skipped === 0 ? '✅' : '⚠️';
    console.log(`[QA Reporter] ${icon} Sent ${this._sent}/${this._pending.length} results to ${server}`);
  }
}

module.exports = QAReporter;
