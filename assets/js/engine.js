/*
 * Adaptive selection + spaced-repetition engine.
 *
 * Goals (from the spec):
 *  1. Remember what you get wrong and emphasise it — in a *smart* way, not a naive
 *     "always re-ask the wrong ones". We use a Leitner-style mastery ladder with
 *     spaced intervals so a wrong question comes back soon & often, then spaces out
 *     as you prove you know it, and stops dominating once mastered.
 *  2. Diverse tries that, taken together, cover every question. New (never-seen)
 *     questions carry a very high weight, so across a handful of exams the union of
 *     questions converges to the full bank. We also expose how many exams remain to
 *     reach full coverage.
 *
 * State is persisted in localStorage. Each question has:
 *   seen, correct, wrong  : counters
 *   level                 : Leitner box 0..5 (0 = new/most-due, 5 = mastered)
 *   lastExam              : index of the exam in which it was last shown (-1 = never)
 *   recentWrong           : EWMA of recent wrongness in [0,1]
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'ldt_progress_v1';
  var MAX_LEVEL = 5;
  // After answering correctly at level L, the question should rest for this many
  // exams before it is "due" again. Wrong answers reset the rest period.
  var INTERVALS = [0, 1, 2, 4, 8, 16]; // index by level

  function nowState() {
    return {
      examIndex: 0,            // how many exams have been started
      questions: {},           // id -> per-question stats
      history: []              // list of {at, score, total, passed, examIndex}
    };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return nowState();
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return nowState();
      s.examIndex = s.examIndex || 0;
      s.questions = s.questions || {};
      s.history = s.history || [];
      return s;
    } catch (e) {
      return nowState();
    }
  }

  function save(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore quota errors */ }
  }

  function reset() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function statFor(state, id) {
    var q = state.questions[id];
    if (!q) {
      q = { seen: 0, correct: 0, wrong: 0, level: 0, lastExam: -1, recentWrong: 0 };
      state.questions[id] = q;
    }
    return q;
  }

  // How "due" a seen question is, in exams overdue (>=0 means due).
  function overdue(state, q) {
    var interval = INTERVALS[Math.min(q.level, MAX_LEVEL)];
    var elapsed = state.examIndex - q.lastExam;
    return elapsed - interval;
  }

  /*
   * Compute a selection weight for one question. Higher = more likely to appear.
   * - Never seen  -> dominant weight so coverage completes fast.
   * - Seen & due  -> weight grows as mastery is low and as recent wrongness is high.
   * - Seen, not due (resting / mastered) -> small residual weight for variety.
   */
  function weightFor(state, id) {
    var q = state.questions[id];
    if (!q || q.seen === 0) return 1000; // unseen: top priority -> guarantees coverage

    var masteryGap = (MAX_LEVEL + 1) - q.level;   // 6 at level 0 .. 1 at level 5
    var od = overdue(state, q);
    var wrongBoost = 1 + 2.5 * q.recentWrong;     // recently-wrong questions weigh up to 3.5x

    if (od >= 0) {
      // due: base 80, scaled by how weak it is, how overdue, and recent wrongness
      return 80 * masteryGap * wrongBoost * (1 + 0.25 * Math.min(od, 8));
    }
    // not due yet: small residual so the exam stays varied but doesn't re-drill mastered items
    return 4 * masteryGap;
  }

  // Weighted sampling WITHOUT replacement via the efficient A-Res algorithm
  // (exponential keys). Diversity from randomness + emphasis from weights.
  function weightedSampleNoReplace(ids, weights, k, rng) {
    rng = rng || Math.random;
    var keyed = ids.map(function (id, i) {
      var w = Math.max(weights[i], 1e-6);
      // key = u^(1/w); larger key => more likely chosen
      var u = rng();
      var key = Math.pow(u <= 0 ? 1e-12 : u, 1 / w);
      return { id: id, key: key };
    });
    keyed.sort(function (a, b) { return b.key - a.key; });
    return keyed.slice(0, Math.min(k, keyed.length)).map(function (x) { return x.id; });
  }

  // Fisher-Yates shuffle using the supplied rng.
  function shuffle(arr, rng) {
    rng = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /*
   * Build the next exam: an array of question ids (length = size, default 30).
   *
   * GUARANTEED COVERAGE + emphasis: while any question is still unseen we reserve at
   * most ~1/3 of the exam for reviewing weak/due questions (the "emphasise mistakes"
   * goal) and fill the REST from never-seen questions first (the "cover everything
   * across tries" goal). This makes at least (size - reviewSlots) new questions appear
   * every exam, so the union of exams reaches the full bank in a bounded number of tries
   * (~ceil(unseen / 20) exams) no matter how often you miss the hard ones. Once every
   * question has been seen at least once, selection becomes purely adaptive (weighted by
   * weakness / due-ness) so practice keeps focusing on what you still get wrong.
   */
  function buildExam(state, allIds, size, rng) {
    size = size || 30;
    rng = rng || Math.random;

    var unseen = [], seen = [];
    allIds.forEach(function (id) {
      var q = state.questions[id];
      if (!q || q.seen === 0) unseen.push(id); else seen.push(id);
    });

    // Full coverage reached -> pure adaptive weighted sampling.
    if (unseen.length === 0) {
      var w = seen.map(function (id) { return weightFor(state, id); });
      return weightedSampleNoReplace(seen, w, size, rng);
    }

    // Pick the weak/due seen questions to review (emphasis), capped at ~1/3 of the exam.
    var weakSeen = seen.filter(function (id) {
      var q = state.questions[id];
      return q.level <= 2 || q.recentWrong > 0;
    });
    var reviewSlots = Math.min(weakSeen.length, Math.floor(size / 3));
    var reviewPicked = weightedSampleNoReplace(
      weakSeen, weakSeen.map(function (id) { return weightFor(state, id); }), reviewSlots, rng);

    // Fill the remaining slots with NEW questions first (drives coverage deterministically).
    var picked = reviewPicked.slice();
    var newPicked = shuffle(unseen, rng).slice(0, size - picked.length);
    picked = picked.concat(newPicked);

    // If new questions ran out, top up from the rest of the seen pool by weight.
    if (picked.length < size) {
      var pickedSet = {};
      picked.forEach(function (id) { pickedSet[id] = true; });
      var rest = seen.filter(function (id) { return !pickedSet[id]; });
      picked = picked.concat(
        weightedSampleNoReplace(rest, rest.map(function (id) { return weightFor(state, id); }),
          size - picked.length, rng));
    }

    // Shuffle so review and new questions aren't grouped together.
    return shuffle(picked, rng).slice(0, size);
  }

  // Record one answered question. correct: bool.
  function recordAnswer(state, id, correct) {
    var q = statFor(state, id);
    q.seen += 1;
    q.lastExam = state.examIndex;
    // EWMA of wrongness: alpha 0.5
    q.recentWrong = 0.5 * q.recentWrong + 0.5 * (correct ? 0 : 1);
    if (correct) {
      q.correct += 1;
      q.level = Math.min(MAX_LEVEL, q.level + 1);
    } else {
      q.wrong += 1;
      // harsher than a single demotion: drop two boxes so wrong items resurface fast
      q.level = Math.max(0, q.level - 2);
    }
  }

  // Call once when an exam is started (after building it) to advance the clock.
  function startExam(state) {
    state.examIndex += 1;
    return state.examIndex;
  }

  function recordExamResult(state, score, total, passed, at) {
    state.history.push({ at: at || 0, score: score, total: total, passed: !!passed, examIndex: state.examIndex });
  }

  // Aggregate stats for the dashboard.
  function summary(state, allIds) {
    var total = allIds.length;
    var seen = 0, mastered = 0, weak = 0, sumLevel = 0;
    allIds.forEach(function (id) {
      var q = state.questions[id];
      if (q && q.seen > 0) {
        seen += 1;
        sumLevel += q.level;
        if (q.level >= MAX_LEVEL) mastered += 1;
        if (q.level <= 1 || q.recentWrong >= 0.5) weak += 1;
      }
    });
    var unseen = total - seen;
    // Estimate exams to full coverage assuming ~size new per exam (most weight on unseen).
    var examsToCover = unseen > 0 ? Math.ceil(unseen / 24) : 0; // ~24 new per exam in practice
    return {
      total: total,
      seen: seen,
      unseen: unseen,
      mastered: mastered,
      weak: weak,
      coveragePct: total ? Math.round((seen / total) * 100) : 0,
      masteryPct: total ? Math.round((mastered / total) * 100) : 0,
      avgLevel: seen ? +(sumLevel / seen).toFixed(2) : 0,
      examsToCover: examsToCover,
      examsTaken: state.history.length,
      passes: state.history.filter(function (h) { return h.passed; }).length
    };
  }

  // List the weakest questions (for the dashboard "focus list").
  function weakestIds(state, allIds, n) {
    var arr = allIds.filter(function (id) {
      var q = state.questions[id];
      return q && q.seen > 0;
    }).map(function (id) {
      var q = state.questions[id];
      return { id: id, level: q.level, recentWrong: q.recentWrong, wrong: q.wrong, score: q.level - 3 * q.recentWrong };
    });
    arr.sort(function (a, b) { return a.score - b.score; });
    return arr.slice(0, n || 10);
  }

  global.Engine = {
    STORAGE_KEY: STORAGE_KEY,
    load: load,
    save: save,
    reset: reset,
    statFor: statFor,
    weightFor: weightFor,
    buildExam: buildExam,
    recordAnswer: recordAnswer,
    startExam: startExam,
    recordExamResult: recordExamResult,
    summary: summary,
    weakestIds: weakestIds,
    weightedSampleNoReplace: weightedSampleNoReplace,
    _internals: { INTERVALS: INTERVALS, MAX_LEVEL: MAX_LEVEL, overdue: overdue }
  };
})(typeof window !== 'undefined' ? window : globalThis);
