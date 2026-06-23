(function () {
  'use strict';

  var PASS_SCORE = 25;
  var EXAM_SIZE = 30;
  var SIGN_PROMPT = 'ماذا تعني هذه الشاخصة؟';
  var QUESTIONS = window.QUESTIONS || [];
  var Engine = window.Engine;
  var byId = {};
  var state = Engine ? Engine.load() : null;
  var session = null;
  var lastResult = null;
  var toastTimer = 0;

  QUESTIONS.forEach(function (q) { byId[q.id] = q; });
  var allIds = QUESTIONS.map(function (q) { return q.id; });

  var el = {
    home: document.getElementById('view-home'),
    exam: document.getElementById('view-exam'),
    result: document.getElementById('view-result'),
    bankCount: document.getElementById('bankCount'),
    startExam: document.getElementById('startExam'),
    startReview: document.getElementById('startReview'),
    stCoverage: document.getElementById('stCoverage'),
    stMastery: document.getElementById('stMastery'),
    stExams: document.getElementById('stExams'),
    stPasses: document.getElementById('stPasses'),
    coverageBar: document.getElementById('coverageBar'),
    coverageNote: document.getElementById('coverageNote'),
    bankChips: document.getElementById('bankChips'),
    weakCard: document.getElementById('weakCard'),
    weakTitle: document.getElementById('weakTitle'),
    historyCard: document.getElementById('historyCard'),
    resetBtn: document.getElementById('resetBtn'),
    homeBtn: document.getElementById('homeBtn'),
    qPos: document.getElementById('qPos'),
    qTotal: document.getElementById('qTotal'),
    examMode: document.getElementById('examMode'),
    examBar: document.getElementById('examBar'),
    qBadge: document.getElementById('qBadge'),
    signWrap: document.getElementById('signWrap'),
    signImg: document.getElementById('signImg'),
    qText: document.getElementById('qText'),
    optionsBox: document.getElementById('optionsBox'),
    feedback: document.getElementById('feedback'),
    nextBtn: document.getElementById('nextBtn'),
    quitExam: document.getElementById('quitExam'),
    scoreRing: document.getElementById('scoreRing'),
    scoreVal: document.getElementById('scoreVal'),
    scoreOf: document.getElementById('scoreOf'),
    verdict: document.getElementById('verdict'),
    verdictSub: document.getElementById('verdictSub'),
    againBtn: document.getElementById('againBtn'),
    reviewWrongBtn: document.getElementById('reviewWrongBtn'),
    toHomeBtn: document.getElementById('toHomeBtn'),
    reviewTitle: document.getElementById('reviewTitle'),
    reviewList: document.getElementById('reviewList'),
    toast: document.getElementById('toast')
  };

  function arNum(value) {
    return String(value).replace(/\d/g, function (d) {
      return '٠١٢٣٤٥٦٧٨٩'[Number(d)];
    });
  }

  function pct(value) {
    return arNum(Math.round(value)) + '%';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function textFor(q) {
    return q.text && q.text.trim() ? q.text : SIGN_PROMPT;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add('show');
    toastTimer = window.setTimeout(function () {
      el.toast.classList.remove('show');
    }, 2500);
  }

  function showView(name) {
    el.home.classList.toggle('hidden', name !== 'home');
    el.exam.classList.toggle('hidden', name !== 'exam');
    el.result.classList.toggle('hidden', name !== 'result');
    el.homeBtn.classList.toggle('hidden', name === 'home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveState() {
    Engine.save(state);
  }

  function renderHome() {
    state = Engine.load();
    var summary = Engine.summary(state, allIds);
    el.bankCount.textContent = arNum(summary.total);
    el.stCoverage.textContent = pct(summary.coveragePct);
    el.stMastery.textContent = pct(summary.masteryPct);
    el.stExams.textContent = arNum(summary.examsTaken);
    el.stPasses.textContent = arNum(summary.passes);
    el.coverageBar.style.width = summary.coveragePct + '%';

    if (summary.seen === 0) {
      el.coverageNote.innerHTML = 'لم تبدأ بعد — كل محاولة تُدخل أسئلة جديدة لم ترها.';
    } else if (summary.unseen > 0) {
      el.coverageNote.innerHTML =
        'رأيت <b>' + arNum(summary.seen) + '</b> من أصل <b>' + arNum(summary.total) +
        '</b>. بقي تقريباً <b>' + arNum(summary.examsToCover) + '</b> محاولات لتغطية كامل البنك.';
    } else {
      el.coverageNote.innerHTML = 'غطّيت كامل بنك الأسئلة. المحاولات القادمة ستركّز على نقاط الضعف.';
    }

    el.bankChips.innerHTML = [
      chip('كل الأسئلة', summary.total),
      chip('شوهدت', summary.seen),
      chip('لم تُشاهد', summary.unseen),
      chip('متقنة', summary.mastered),
      chip('تحتاج تركيزاً', summary.weak)
    ].join('');

    renderWeakList();
    renderHistory();
    showView('home');
  }

  function chip(label, value) {
    return '<span class="chip">' + escapeHtml(label) + ' <b>' + arNum(value) + '</b></span>';
  }

  function renderWeakList() {
    var weak = Engine.weakestIds(state, allIds, 8);
    if (!weak.length) {
      el.weakTitle.textContent = 'الأسئلة التي تحتاج تركيزاً';
      el.weakCard.innerHTML = '<div class="coverage-note">ستظهر هنا الأسئلة التي تخطئ بها أكثر بعد أول محاولة.</div>';
      return;
    }

    el.weakTitle.textContent = 'الأسئلة التي تحتاج تركيزاً';
    el.weakCard.innerHTML = weak.map(function (item) {
      var q = byId[item.id];
      var stat = state.questions[item.id] || {};
      return '<div class="review-item">' +
        '<p class="rq">' + arNum(item.id) + ' — ' + escapeHtml(textFor(q)) + '</p>' +
        '<div class="chips">' +
        chip('مستوى الإتقان', item.level) +
        chip('أخطاء', item.wrong) +
        chip('مرات الظهور', stat.seen || 0) +
        '</div>' +
        '</div>';
    }).join('');
  }

  function renderHistory() {
    var history = (state.history || []).slice(-6).reverse();
    if (!history.length) {
      el.historyCard.innerHTML = '<div class="coverage-note">لا توجد محاولات سابقة بعد.</div>';
      return;
    }

    el.historyCard.innerHTML = history.map(function (h) {
      var mode = h.mode === 'review' ? 'مراجعة' : 'امتحان';
      var verdict = h.mode === 'review' ? 'تدريب' : (h.passed ? 'نجاح' : 'رسوب');
      var tagClass = h.mode === 'review' ? '' : (h.passed ? 'right' : 'you');
      return '<div class="review-item">' +
        '<p class="rq">' + mode + ' · ' + formatDate(h.at) + '</p>' +
        '<div class="ans"><span class="tag ' + tagClass + '">' + verdict + '</span>' +
        '<span>' + arNum(h.score) + ' / ' + arNum(h.total) + '</span></div>' +
        '</div>';
    }).join('');
  }

  function formatDate(timestamp) {
    if (!timestamp) return '—';
    try {
      return new Intl.DateTimeFormat('ar-LB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(timestamp));
    } catch (e) {
      return arNum(new Date(timestamp).toLocaleDateString());
    }
  }

  function startOfficialExam() {
    state = Engine.load();
    var ids = Engine.buildExam(state, allIds, EXAM_SIZE);
    if (!ids.length) {
      showToast('تعذّر إنشاء الامتحان.');
      return;
    }
    Engine.startExam(state);
    saveState();
    beginSession('official', ids);
  }

  function startReviewExam() {
    state = Engine.load();
    var weak = Engine.weakestIds(state, allIds, EXAM_SIZE).map(function (item) { return item.id; });
    if (!weak.length) {
      showToast('ابدأ امتحاناً أولاً كي تظهر أسئلة للمراجعة.');
      return;
    }
    Engine.startExam(state);
    saveState();
    beginSession('review', weak);
  }

  function beginSession(mode, ids) {
    session = {
      mode: mode,
      ids: ids.slice(),
      index: 0,
      answers: {},
      locked: false,
      finished: false
    };
    el.qTotal.textContent = arNum(session.ids.length);
    el.examMode.textContent = mode === 'review' ? 'مراجعة' : 'امتحان رسمي';
    renderQuestion();
    showView('exam');
  }

  function currentQuestion() {
    if (!session) return null;
    return byId[session.ids[session.index]];
  }

  function renderQuestion() {
    var q = currentQuestion();
    if (!q) return;

    session.locked = !!session.answers[q.id];
    el.qPos.textContent = arNum(session.index + 1);
    el.qTotal.textContent = arNum(session.ids.length);
    el.examBar.style.width = Math.round((session.index / session.ids.length) * 100) + '%';
    el.qBadge.textContent = 'سؤال رقم ' + arNum(q.id);
    el.qText.textContent = textFor(q);
    el.feedback.className = 'feedback hidden';
    el.feedback.textContent = '';
    el.nextBtn.classList.add('hidden');
    el.nextBtn.textContent = session.index === session.ids.length - 1 ? 'عرض النتيجة' : 'التالي ←';

    if (q.sign) {
      el.signImg.src = q.sign;
      el.signImg.alt = 'إشارة السؤال رقم ' + arNum(q.id);
      el.signWrap.classList.remove('hidden');
    } else {
      el.signImg.removeAttribute('src');
      el.signWrap.classList.add('hidden');
    }

    el.optionsBox.innerHTML = '';
    q.options.forEach(function (option, idx) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'opt';
      button.dataset.index = String(idx);
      button.innerHTML = '<span class="marker">' + arNum(idx + 1) + '</span><span class="txt"></span>';
      button.querySelector('.txt').textContent = option;
      button.addEventListener('click', function () { chooseAnswer(idx); });
      el.optionsBox.appendChild(button);
    });

    if (session.locked) {
      paintAnswer(session.answers[q.id]);
    }
  }

  function chooseAnswer(selectedIndex) {
    var q = currentQuestion();
    if (!q || session.locked || session.answers[q.id]) return;

    var ok = selectedIndex === q.answer;
    var answer = {
      id: q.id,
      selected: selectedIndex,
      correct: q.answer,
      ok: ok
    };
    session.answers[q.id] = answer;
    session.locked = true;
    Engine.recordAnswer(state, q.id, ok);
    saveState();
    paintAnswer(answer);
  }

  function paintAnswer(answer) {
    var buttons = Array.prototype.slice.call(el.optionsBox.querySelectorAll('.opt'));
    buttons.forEach(function (button) {
      var idx = Number(button.dataset.index);
      button.classList.add('locked');
      button.disabled = true;
      if (idx === answer.correct) {
        button.classList.add('correct');
      } else if (idx === answer.selected) {
        button.classList.add('wrong');
      } else {
        button.classList.add('dim');
      }
    });

    if (answer.ok) {
      el.feedback.textContent = 'إجابة صحيحة';
      el.feedback.className = 'feedback ok';
    } else {
      var q = byId[answer.id];
      el.feedback.textContent = 'الإجابة الصحيحة: ' + q.options[answer.correct];
      el.feedback.className = 'feedback no';
    }
    el.nextBtn.classList.remove('hidden');
  }

  function goNext() {
    if (!session) return;
    var q = currentQuestion();
    if (q && !session.answers[q.id]) {
      showToast('اختر إجابة أولاً.');
      return;
    }
    if (session.index < session.ids.length - 1) {
      session.index += 1;
      renderQuestion();
      return;
    }
    finishSession();
  }

  function finishSession() {
    if (!session || session.finished) return;
    session.finished = true;
    el.examBar.style.width = '100%';

    var total = session.ids.length;
    var answers = session.ids.map(function (id) { return session.answers[id]; }).filter(Boolean);
    var score = answers.filter(function (a) { return a.ok; }).length;
    var passed = session.mode === 'official' && score >= PASS_SCORE;
    Engine.recordExamResult(state, score, total, passed, Date.now());
    if (state.history.length) {
      state.history[state.history.length - 1].mode = session.mode;
    }
    saveState();

    lastResult = {
      mode: session.mode,
      ids: session.ids.slice(),
      answers: session.answers,
      score: score,
      total: total,
      passed: passed
    };
    session = null;
    renderResult(lastResult);
  }

  function renderResult(result) {
    var percentage = result.total ? Math.round((result.score / result.total) * 100) : 0;
    var ringColor = result.mode === 'official'
      ? (result.passed ? 'var(--green)' : 'var(--red)')
      : 'var(--accent)';

    el.scoreRing.style.background =
      'conic-gradient(' + ringColor + ' ' + percentage + '%, var(--card-2) 0)';
    el.scoreVal.textContent = arNum(result.score);
    el.scoreOf.textContent = arNum(result.total);
    el.verdict.className = 'verdict';

    if (result.mode === 'official') {
      el.verdict.classList.add(result.passed ? 'pass' : 'fail');
      el.verdict.textContent = result.passed ? 'ناجح' : 'راسب';
      el.verdictSub.textContent = result.passed
        ? 'تجاوزت علامة النجاح الرسمية: ' + arNum(PASS_SCORE) + ' / ' + arNum(EXAM_SIZE) + '.'
        : 'تحتاج إلى ' + arNum(PASS_SCORE) + ' إجابة صحيحة للنجاح في الامتحان الرسمي.';
      if (result.passed) launchConfetti();
    } else {
      el.verdict.textContent = 'انتهت المراجعة';
      el.verdictSub.textContent = 'تم تحديث مستوى الإتقان بناءً على إجابات هذه الجولة.';
    }

    renderWrongReview(result);
    showView('result');
  }

  function wrongAnswers(result) {
    return result.ids.map(function (id) { return result.answers[id]; })
      .filter(function (answer) { return answer && !answer.ok; });
  }

  function renderWrongReview(result) {
    var wrong = wrongAnswers(result);
    el.reviewWrongBtn.disabled = !wrong.length;
    el.reviewWrongBtn.textContent = wrong.length ? 'مراجعة أخطاء هذا الامتحان' : 'لا توجد أخطاء';
    el.reviewTitle.textContent = wrong.length ? 'مراجعة الإجابات الخاطئة' : 'لا توجد إجابات خاطئة';

    if (!wrong.length) {
      el.reviewList.innerHTML = '<div class="card"><div class="coverage-note">كل الإجابات في هذه الجولة كانت صحيحة.</div></div>';
      return;
    }

    el.reviewList.innerHTML = wrong.map(function (answer) {
      var q = byId[answer.id];
      var sign = q.sign
        ? '<img class="review-sign" src="' + escapeHtml(q.sign) + '" alt="إشارة السؤال رقم ' + arNum(q.id) + '" />'
        : '';
      return '<div class="review-item">' +
        sign +
        '<p class="rq">' + arNum(q.id) + ' — ' + escapeHtml(textFor(q)) + '</p>' +
        '<div class="ans"><span class="tag you">إجابتك</span><span>' +
        escapeHtml(q.options[answer.selected]) + '</span></div>' +
        '<div class="ans"><span class="tag right">الصحيح</span><span>' +
        escapeHtml(q.options[answer.correct]) + '</span></div>' +
        '</div>';
    }).join('');
  }

  function launchConfetti() {
    var old = document.querySelector('.confetti');
    if (old) old.remove();
    var confetti = document.createElement('div');
    confetti.className = 'confetti';
    var colors = ['#22c55e', '#3b82f6', '#f59e0b', '#22d3ee', '#ef4444'];
    for (var i = 0; i < 70; i++) {
      var dot = document.createElement('i');
      dot.style.left = Math.random() * 100 + '%';
      dot.style.background = colors[i % colors.length];
      dot.style.animationDuration = (1.6 + Math.random() * 1.8) + 's';
      dot.style.animationDelay = (Math.random() * 0.6) + 's';
      confetti.appendChild(dot);
    }
    document.body.appendChild(confetti);
    window.setTimeout(function () { confetti.remove(); }, 4200);
  }

  function quitCurrentExam() {
    if (!session) {
      renderHome();
      return;
    }
    if (window.confirm('هل تريد إنهاء هذه الجولة والعودة إلى الرئيسية؟ لن تُسجّل نتيجة الامتحان.')) {
      session = null;
      renderHome();
    }
  }

  function handleKeyboard(event) {
    if (!session || el.exam.classList.contains('hidden')) return;
    if (event.key === 'Enter') {
      if (!el.nextBtn.classList.contains('hidden')) goNext();
      return;
    }
    var keys = { '1': 0, '2': 1, '3': 2, '١': 0, '٢': 1, '٣': 2 };
    if (Object.prototype.hasOwnProperty.call(keys, event.key)) {
      chooseAnswer(keys[event.key]);
    }
  }

  function resetProgress() {
    if (!window.confirm('هل تريد مسح كل التقدّم والبدء من جديد؟')) return;
    Engine.reset();
    state = Engine.load();
    session = null;
    renderHome();
    showToast('تم مسح التقدّم.');
  }

  function scrollToWrongReview() {
    if (!lastResult || !wrongAnswers(lastResult).length) {
      showToast('لا توجد أخطاء في هذه الجولة.');
      return;
    }
    el.reviewTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindEvents() {
    el.startExam.addEventListener('click', startOfficialExam);
    el.startReview.addEventListener('click', startReviewExam);
    el.resetBtn.addEventListener('click', resetProgress);
    el.homeBtn.addEventListener('click', quitCurrentExam);
    el.quitExam.addEventListener('click', quitCurrentExam);
    el.nextBtn.addEventListener('click', goNext);
    el.againBtn.addEventListener('click', startOfficialExam);
    el.reviewWrongBtn.addEventListener('click', scrollToWrongReview);
    el.toHomeBtn.addEventListener('click', renderHome);
    document.addEventListener('keydown', handleKeyboard);
  }

  function init() {
    if (!Engine || !QUESTIONS.length) {
      showToast('تعذّر تحميل بنك الأسئلة.');
      return;
    }
    bindEvents();
    renderHome();
  }

  init();
})();
