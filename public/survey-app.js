// Public survey page logic
(function () {
  const API = '/api/public/survey';
  const params = new URLSearchParams(location.search);
  const code = params.get('c') || params.get('code') || '';

  let _survey = null;
  let _questions = [];
  let _answers = {}; // qi → value

  const FIELD_LABELS = {
    name: 'שם פרטי', family_name: 'שם משפחה', id_number: 'ת.ז',
    email: 'מייל', phone: 'טלפון', address: 'כתובת', business_id: 'ח.פ'
  };
  const FIELD_TYPES = {
    email: 'email', phone: 'tel', id_number: 'text',
    business_id: 'text', address: 'text', name: 'text', family_name: 'text'
  };

  function show(id) {
    ['state-loading', 'state-error', 'state-form', 'state-success'].forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
  }

  async function loadSurvey() {
    if (!code) { showError('קישור לא תקין — חסר קוד סקר'); return; }
    try {
      const r = await fetch(`${API}/${code}`);
      const d = await r.json();
      if (!d.success) { showError(d.error || 'לא ניתן לטעון את הסקר'); return; }
      _survey = d.survey;
      _questions = d.questions || [];
      renderSurvey();
    } catch (e) {
      showError('שגיאת תקשורת — נסה שוב מאוחר יותר');
    }
  }

  function showError(msg) {
    document.getElementById('error-msg').textContent = msg;
    show('state-error');
  }

  function renderSurvey() {
    document.title = _survey.title + ' — סקר';
    const bizName = _survey.business_name || '';
    document.getElementById('biz-name').textContent = bizName;
    document.getElementById('biz-slogan').textContent = _survey.slogan || '';
    document.getElementById('survey-title').textContent = _survey.title;
    document.getElementById('survey-desc').textContent = _survey.description || '';

    // Logo or initials
    if (_survey.logo_url) {
      const img = document.getElementById('biz-logo');
      img.src = _survey.logo_url;
      document.getElementById('logo-wrap').classList.remove('hidden');
    } else if (bizName) {
      const init = document.getElementById('biz-initials');
      init.textContent = bizName.charAt(0);
      init.classList.remove('hidden');
      init.classList.add('flex');
    }

    renderRespondentFields();
    renderQuestions();
    show('state-form');
  }

  function renderRespondentFields() {
    const sec = document.getElementById('respondent-section');
    const el = document.getElementById('respondent-fields');
    if (_survey.anonymous || !_survey.required_fields?.length) {
      sec.classList.add('hidden');
      return;
    }
    el.innerHTML = _survey.required_fields.map(f => `
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${FIELD_LABELS[f] || f} *</label>
        <input type="${FIELD_TYPES[f] || 'text'}" id="rf-${f}" placeholder="${FIELD_LABELS[f] || f}"
          class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
      </div>`).join('');
  }

  function renderQuestions() {
    const el = document.getElementById('questions-section');
    el.innerHTML = _questions.map((q, i) => {
      let input = '';
      if (q.type === 'multiple_choice') {
        const opts = q.options || [];
        input = `<div class="space-y-2 mt-2">
          ${opts.map((o, oi) => `
            <button type="button" class="option-btn w-full text-right px-4 py-3 rounded-xl text-sm bg-white"
              onclick="selectOption(${i},${oi},'${esc(o)}')" id="opt-${i}-${oi}">${o}</button>`).join('')}
        </div>`;
      } else if (q.type === 'yes_no') {
        input = `<div class="flex gap-3 mt-2">
          <button type="button" class="yn-btn flex-1 py-3 rounded-xl text-sm bg-white font-medium"
            onclick="selectYN(${i},'כן')" id="yn-${i}-yes">כן</button>
          <button type="button" class="yn-btn flex-1 py-3 rounded-xl text-sm bg-white font-medium"
            onclick="selectYN(${i},'לא')" id="yn-${i}-no">לא</button>
        </div>`;
      } else if (q.type === 'rating') {
        input = `<div class="flex gap-1 mt-2 justify-center" dir="ltr">
          ${[1,2,3,4,5].map(n =>
            `<button type="button" class="star-btn" id="star-${i}-${n}" onclick="selectRating(${i},${n})">★</button>`
          ).join('')}
        </div>`;
      } else if (q.type === 'open_text') {
        input = `<textarea id="ot-${i}" rows="3" placeholder="כתוב כאן..."
          oninput="_answers[${i}]=this.value"
          class="w-full mt-2 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"></textarea>`;
      }
      return `<div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p class="text-sm font-bold text-slate-700">${i + 1}. ${q.question_text}${q.required ? ' <span class="text-red-400">*</span>' : ''}</p>
        ${input}
      </div>`;
    }).join('');
  }

  function esc(s) { return String(s).replace(/'/g, "\\'"); }

  // Interaction
  window.selectOption = function (qi, oi, val) {
    _answers[qi] = val;
    _questions[qi].options.forEach((_, j) => {
      document.getElementById(`opt-${qi}-${j}`)?.classList.toggle('selected', j === oi);
    });
  };

  window.selectYN = function (qi, val) {
    _answers[qi] = val;
    document.getElementById(`yn-${qi}-yes`)?.classList.toggle('selected-yes', val === 'כן');
    document.getElementById(`yn-${qi}-yes`)?.classList.remove('selected-no');
    document.getElementById(`yn-${qi}-no`)?.classList.toggle('selected-no', val === 'לא');
    document.getElementById(`yn-${qi}-no`)?.classList.remove('selected-yes');
  };

  window.selectRating = function (qi, rating) {
    _answers[qi] = rating;
    for (let n = 1; n <= 5; n++) {
      const el = document.getElementById(`star-${qi}-${n}`);
      if (el) el.classList.toggle('active', n <= rating);
    }
  };

  // Submit
  window.submitSurvey = async function () {
    const errEl = document.getElementById('submit-error');
    errEl.classList.add('hidden');

    // Collect respondent data
    const respondentData = {};
    if (!_survey.anonymous && _survey.required_fields?.length) {
      for (const f of _survey.required_fields) {
        const val = document.getElementById(`rf-${f}`)?.value.trim();
        if (!val) { showSubmitError(`חסר שדה: ${FIELD_LABELS[f] || f}`); return; }
        respondentData[f] = val;
      }
    }

    // Sync open_text answers from DOM (inline oninput can't reach IIFE scope)
    for (let i = 0; i < _questions.length; i++) {
      if (_questions[i].type === 'open_text') {
        const val = document.getElementById(`ot-${i}`)?.value || '';
        if (val) _answers[i] = val;
      }
    }

    // Validate required questions
    for (let i = 0; i < _questions.length; i++) {
      if (_questions[i].required && (_answers[i] === undefined || _answers[i] === null || _answers[i] === '')) {
        showSubmitError(`יש לענות על שאלה ${i + 1}`); return;
      }
    }

    // Build answers array
    const answers = _questions.map((q, i) => ({ qi: i, type: q.type, value: _answers[i] ?? null }));
    const comment = document.getElementById('free-comment').value.trim();

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'שולח...';

    try {
      const r = await fetch(`${API}/${code}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respondentData, answers, comment })
      });
      const d = await r.json();
      if (!d.success) { showSubmitError(d.error || 'שגיאה בשליחה'); btn.disabled = false; btn.textContent = 'שלח תשובות'; return; }
      show('state-success');
    } catch (e) {
      showSubmitError('שגיאת תקשורת — נסה שוב');
      btn.disabled = false;
      btn.innerHTML = 'שלח תשובות <i class="fa-solid fa-paper-plane mr-2"></i>';
    }
  };

  function showSubmitError(msg) {
    const el = document.getElementById('submit-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Init
  loadSurvey();
})();
