import type {
  ProgressState,
  ProgressSummary,
  QuestionProgress,
  WeakQuestion
} from "./types";

export const STORAGE_KEY = "ldt_progress_v1";
export const MAX_LEVEL = 5;
const INTERVALS = [0, 1, 2, 4, 8, 16];

export function createProgressState(): ProgressState {
  return {
    examIndex: 0,
    questions: {},
    history: []
  };
}

export function cloneProgress(state: ProgressState): ProgressState {
  return {
    examIndex: state.examIndex,
    questions: Object.fromEntries(
      Object.entries(state.questions).map(([id, progress]) => [id, { ...progress }])
    ),
    history: state.history.map((item) => ({ ...item }))
  };
}

export function loadProgress(storage: Storage = window.localStorage): ProgressState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createProgressState();
    const parsed = JSON.parse(raw) as Partial<ProgressState> | null;
    if (!parsed || typeof parsed !== "object") return createProgressState();

    return {
      examIndex: Number(parsed.examIndex) || 0,
      questions: parsed.questions || {},
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch {
    return createProgressState();
  }
}

export function saveProgress(
  state: ProgressState,
  storage: Storage = window.localStorage
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Progress is helpful but not critical; ignore browser storage failures.
  }
}

export function resetProgress(storage: Storage = window.localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore browser storage failures.
  }
}

export function statFor(state: ProgressState, id: number): QuestionProgress {
  let question = state.questions[id];
  if (!question) {
    question = { seen: 0, correct: 0, wrong: 0, level: 0, lastExam: -1, recentWrong: 0 };
    state.questions[id] = question;
  }
  return question;
}

export function overdue(state: ProgressState, question: QuestionProgress): number {
  const interval = INTERVALS[Math.min(question.level, MAX_LEVEL)];
  const elapsed = state.examIndex - question.lastExam;
  return elapsed - interval;
}

export function weightFor(state: ProgressState, id: number): number {
  const question = state.questions[id];
  if (!question || question.seen === 0) return 1000;

  const masteryGap = MAX_LEVEL + 1 - question.level;
  const dueBy = overdue(state, question);
  const wrongBoost = 1 + 2.5 * question.recentWrong;

  if (dueBy >= 0) {
    return 80 * masteryGap * wrongBoost * (1 + 0.25 * Math.min(dueBy, 8));
  }

  return 4 * masteryGap;
}

export function weightedSampleNoReplace(
  ids: number[],
  weights: number[],
  size: number,
  rng: () => number = Math.random
): number[] {
  const keyed = ids.map((id, index) => {
    const weight = Math.max(weights[index], 1e-6);
    const random = rng();
    const key = Math.pow(random <= 0 ? 1e-12 : random, 1 / weight);
    return { id, key };
  });

  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, Math.min(size, keyed.length)).map((item) => item.id);
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }
  return copy;
}

export function buildExam(
  state: ProgressState,
  allIds: number[],
  size = 30,
  rng: () => number = Math.random
): number[] {
  const unseen: number[] = [];
  const seen: number[] = [];

  allIds.forEach((id) => {
    const question = state.questions[id];
    if (!question || question.seen === 0) unseen.push(id);
    else seen.push(id);
  });

  if (unseen.length === 0) {
    return weightedSampleNoReplace(
      seen,
      seen.map((id) => weightFor(state, id)),
      size,
      rng
    );
  }

  const weakSeen = seen.filter((id) => {
    const question = state.questions[id];
    return question.level <= 2 || question.recentWrong > 0;
  });
  const reviewSlots = Math.min(weakSeen.length, Math.floor(size / 3));
  const reviewPicked = weightedSampleNoReplace(
    weakSeen,
    weakSeen.map((id) => weightFor(state, id)),
    reviewSlots,
    rng
  );

  let picked = reviewPicked.slice();
  picked = picked.concat(shuffle(unseen, rng).slice(0, size - picked.length));

  if (picked.length < size) {
    const pickedSet = new Set(picked);
    const remainingSeen = seen.filter((id) => !pickedSet.has(id));
    picked = picked.concat(
      weightedSampleNoReplace(
        remainingSeen,
        remainingSeen.map((id) => weightFor(state, id)),
        size - picked.length,
        rng
      )
    );
  }

  return shuffle(picked, rng).slice(0, size);
}

export function recordAnswer(state: ProgressState, id: number, correct: boolean): void {
  const question = statFor(state, id);
  question.seen += 1;
  question.lastExam = state.examIndex;
  question.recentWrong = 0.5 * question.recentWrong + 0.5 * (correct ? 0 : 1);

  if (correct) {
    question.correct += 1;
    question.level = Math.min(MAX_LEVEL, question.level + 1);
  } else {
    question.wrong += 1;
    question.level = Math.max(0, question.level - 2);
  }
}

export function startExam(state: ProgressState): number {
  state.examIndex += 1;
  return state.examIndex;
}

export function recordExamResult(
  state: ProgressState,
  score: number,
  total: number,
  passed: boolean,
  at = Date.now()
): void {
  state.history.push({
    at,
    score,
    total,
    passed,
    examIndex: state.examIndex
  });
}

export function summary(state: ProgressState, allIds: number[]): ProgressSummary {
  const total = allIds.length;
  let seen = 0;
  let mastered = 0;
  let weak = 0;
  let levelSum = 0;

  allIds.forEach((id) => {
    const question = state.questions[id];
    if (!question || question.seen <= 0) return;
    seen += 1;
    levelSum += question.level;
    if (question.level >= MAX_LEVEL) mastered += 1;
    if (question.level <= 1 || question.recentWrong >= 0.5) weak += 1;
  });

  const unseen = total - seen;

  return {
    total,
    seen,
    unseen,
    mastered,
    weak,
    coveragePct: total ? Math.round((seen / total) * 100) : 0,
    masteryPct: total ? Math.round((mastered / total) * 100) : 0,
    avgLevel: seen ? Number((levelSum / seen).toFixed(2)) : 0,
    examsToCover: unseen > 0 ? Math.ceil(unseen / 24) : 0,
    examsTaken: state.history.length,
    passes: state.history.filter((item) => item.passed).length
  };
}

export function weakestIds(
  state: ProgressState,
  allIds: number[],
  count = 10
): WeakQuestion[] {
  const items = allIds
    .filter((id) => {
      const question = state.questions[id];
      return question && question.seen > 0;
    })
    .map((id) => {
      const question = state.questions[id];
      return {
        id,
        level: question.level,
        recentWrong: question.recentWrong,
        wrong: question.wrong,
        score: question.level - 3 * question.recentWrong
      };
    });

  items.sort((a, b) => a.score - b.score);
  return items.slice(0, count);
}
