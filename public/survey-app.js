// Public survey page logic
(function () {
  const API = '/api/public/survey';
  const params = new URLSearchParams(location.search);
  const code = params.get('c') || params.get('code') || '';

  let _survey = null;
  let _questions = [];
  let _answers = {}; // qi → value
  let _answered = 0;

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
    const bizName = _survey.business_name || '';
    document.title = _survey.title + ' — סקר';
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
      init.style.display = 'flex';
    }

    // Progress bar
    updateProgress();

    renderRespondentFields();
    renderQuestions();
    show('state-form');
  }

  // Exposed so inline oninput handlers can reach IIFE-scoped _answers
  window._svSetOpenText = function(qi, val) {
    _answers[qi] = val;
    updateProgress();
  };

  function updateProgress() {
    const required = _questions.filter(q => q.required);
    if (!required.length) return;
    // For open_text, read current DOM value directly so progress is accurate while typing
    const answeredCount = required.filter(q => {
      const qi = _questions.indexOf(q);
      if (q.type === 'open_text') {
        const domVal = document.getElementById(`ot-${qi}`)?.value || '';
        return domVal.trim() !== '';
      }
      return _answers[qi] !== undefined && _answers[qi] !== null && _answers[qi] !== '';
    }).length;
    const pct = Math.round(answeredCount / required.length * 100);
    const wrap = document.getElementById('progress-wrap');
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    if (wrap) wrap.classList.remove('hidden');
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = `${answeredCount} מתוך ${required.length} שאלות חובה`;
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
        <label class="block text-xs font-semibold text-slate-500 mb-1.5">${FIELD_LABELS[f] || f} *</label>
        <input type="${FIELD_TYPES[f] || 'text'}" id="rf-${f}" placeholder="${FIELD_LABELS[f] || f}"
          class="survey-input">
      </div>`).join('');
  }

  function renderQuestions() {
    const el = document.getElementById('questions-section');
    el.innerHTML = _questions.map((q, i) => {
      let input = '';
      if (q.type === 'multiple_choice') {
        const opts = q.options || [];
        input = `<div class="space-y-2.5 mt-3">
          ${opts.map((o, oi) => `
            <button type="button" class="opt-btn" onclick="selectOption(${i},${oi},'${esc(o)}')" id="opt-${i}-${oi}">
              <span class="check-circle"></span>
              <span>${o}</span>
            </button>`).join('')}
        </div>`;
      } else if (q.type === 'yes_no') {
        input = `<div class="grid grid-cols-2 gap-3 mt-3">
          <button type="button" class="yn-btn" onclick="selectYN(${i},'כן')" id="yn-${i}-yes">
            <span class="text-2xl">👍</span>
            <span>כן</span>
          </button>
          <button type="button" class="yn-btn" onclick="selectYN(${i},'לא')" id="yn-${i}-no">
            <span class="text-2xl">👎</span>
            <span>לא</span>
          </button>
        </div>`;
      } else if (q.type === 'rating') {
        input = `<div class="flex gap-2 mt-3 justify-center" dir="ltr">
          ${[1,2,3,4,5].map(n =>
            `<button type="button" class="star-btn" id="star-${i}-${n}" onclick="selectRating(${i},${n})">★</button>`
          ).join('')}
        </div>
        <p id="rating-label-${i}" class="text-center text-xs text-slate-400 mt-1 h-4"></p>`;
      } else if (q.type === 'open_text') {
        input = `<textarea id="ot-${i}" rows="3" placeholder="כתוב כאן..."
          oninput="_svSetOpenText(${i},this.value)"
          class="survey-input resize-none mt-3"></textarea>`;
      }

      return `<div class="q-card p-5" style="animation-delay:${i*0.06}s">
        <div class="flex items-start gap-3 mb-1">
          <div class="q-number mt-0.5">${i + 1}</div>
          <p class="text-[15px] font-bold text-slate-800 leading-snug flex-1">
            ${q.question_text}${q.required ? ' <span class="text-red-400 font-normal">*</span>' : ''}
          </p>
        </div>
        ${input}
      </div>`;
    }).join('');
  }

  function esc(s) { return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

  const RATING_LABELS = ['', 'גרוע', 'לא טוב', 'בסדר', 'טוב', 'מצוין'];

  // Interactions
  window.selectOption = function (qi, oi, val) {
    _answers[qi] = val;
    _questions[qi].options.forEach((_, j) => {
      document.getElementById(`opt-${qi}-${j}`)?.classList.toggle('selected', j === oi);
    });
    updateProgress();
  };

  window.selectYN = function (qi, val) {
    _answers[qi] = val;
    const yes = document.getElementById(`yn-${qi}-yes`);
    const no = document.getElementById(`yn-${qi}-no`);
    yes?.classList.toggle('selected-yes', val === 'כן');
    yes?.classList.remove('selected-no');
    no?.classList.toggle('selected-no', val === 'לא');
    no?.classList.remove('selected-yes');
    updateProgress();
  };

  window.selectRating = function (qi, rating) {
    _answers[qi] = rating;
    for (let n = 1; n <= 5; n++) {
      document.getElementById(`star-${qi}-${n}`)?.classList.toggle('active', n <= rating);
    }
    const lbl = document.getElementById(`rating-label-${qi}`);
    if (lbl) lbl.textContent = RATING_LABELS[rating] || '';
    updateProgress();
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

    // Final sync for open_text in case user pasted without triggering oninput
    for (let i = 0; i < _questions.length; i++) {
      if (_questions[i].type === 'open_text') {
        const val = (document.getElementById(`ot-${i}`)?.value || '').trim();
        _answers[i] = val;
      }
    }

    // Validate required questions
    for (let i = 0; i < _questions.length; i++) {
      if (_questions[i].required && (_answers[i] === undefined || _answers[i] === null || String(_answers[i]).trim() === '')) {
        // Scroll to the question card
        const cards = document.querySelectorAll('#questions-section > div');
        if (cards[i]) cards[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        showSubmitError(`יש לענות על שאלה ${i + 1}`);
        return;
      }
    }

    // Build answers array
    const answers = _questions.map((q, i) => ({ qi: i, type: q.type, value: _answers[i] ?? null }));
    const comment = document.getElementById('free-comment').value.trim();

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full mr-2"></span> שולח...';

    try {
      const r = await fetch(`${API}/${code}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respondentData, answers, comment })
      });
      const d = await r.json();
      if (!d.success) {
        showSubmitError(d.error || 'שגיאה בשליחה');
        btn.disabled = false;
        btn.innerHTML = 'שלח תשובות <i class="fa-solid fa-paper-plane text-sm"></i>';
        return;
      }
      show('state-success');
    } catch (e) {
      showSubmitError('שגיאת תקשורת — נסה שוב');
      btn.disabled = false;
      btn.innerHTML = 'שלח תשובות <i class="fa-solid fa-paper-plane text-sm"></i>';
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
