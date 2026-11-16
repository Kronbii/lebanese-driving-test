import type {
  ExamHistoryItem,
  ExamMode,
  ProgressState,
  ProgressSummary,
  QuestionProgress,
  WeakQuestion
} from "./types";

/** Legacy single-profile key (v1). Read once for migration into profiles. */
export const STORAGE_KEY = "ldt_progress_v1";
export const MAX_LEVEL = 5;
const INTERVALS = [0, 1, 2, 4, 8, 16];

export const XP_CORRECT = 10;
export const XP_WRONG = 2;
export const XP_PASS = 50;

export function createProgressState(): ProgressState {
  return {
    version: 2,
    examIndex: 0,
    questions: {},
    history: [],
    favorites: [],
    notes: {},
    flashcards: {},
    activity: {},
    xp: 0,
    badges: {},
    updatedAt: 0
  };
}

/** Accepts v1 or v2 data (or garbage) and returns a valid v2 state. */
export function normalizeProgress(raw: unknown): ProgressState {
  const base = createProgressState();
  if (!raw || typeof raw !== "object") return base;
  const parsed = raw as Partial<ProgressState>;

  const questions: Record<number, QuestionProgress> = {};
  if (parsed.questions && typeof parsed.questions === "object") {
    for (const [key, value] of Object.entries(parsed.questions)) {
      if (!value || typeof value !== "object") continue;
      const item = value as Partial<QuestionProgress>;
      questions[Number(key)] = {
        seen: Number(item.seen) || 0,
        correct: Number(item.correct) || 0,
        wrong: Number(item.wrong) || 0,
        level: Math.max(0, Math.min(MAX_LEVEL, Number(item.level) || 0)),
        lastExam: Number.isFinite(Number(item.lastExam)) ? Number(item.lastExam) : -1,
        recentWrong: Number(item.recentWrong) || 0,
        ...(item.lastSeenAt ? { lastSeenAt: Number(item.lastSeenAt) } : {}),
        ...(item.streak !== undefined ? { streak: Number(item.streak) || 0 } : {}),
        ...(Array.isArray(item.picks) ? { picks: item.picks.map((n) => Number(n) || 0) } : {})
      };
    }
  }

  return {
    version: 2,
    examIndex: Number(parsed.examIndex) || 0,
    questions,
    history: Array.isArray(parsed.history)
      ? (parsed.history.filter((h) => h && typeof h === "object") as ExamHistoryItem[])
      : [],
    favorites: Array.isArray(parsed.favorites)
      ? parsed.favorites.map(Number).filter(Number.isFinite)
      : [],
    notes: parsed.notes && typeof parsed.notes === "object" ? { ...parsed.notes } : {},
    flashcards:
      parsed.flashcards && typeof parsed.flashcards === "object" ? { ...parsed.flashcards } : {},
    activity: parsed.activity && typeof parsed.activity === "object" ? { ...parsed.activity } : {},
    xp: Number(parsed.xp) || 0,
    badges: parsed.badges && typeof parsed.badges === "object" ? { ...parsed.badges } : {},
    updatedAt: Number(parsed.updatedAt) || 0
  };
}

export function cloneProgress(state: ProgressState): ProgressState {
  return {
    ...state,
    questions: Object.fromEntries(
      Object.entries(state.questions).map(([id, progress]) => [
        id,
        { ...progress, ...(progress.picks ? { picks: progress.picks.slice() } : {}) }
      ])
    ),
    history: state.history.map((item) => ({ ...item })),
    favorites: state.favorites.slice(),
    notes: { ...state.notes },
    flashcards: Object.fromEntries(
      Object.entries(state.flashcards).map(([id, card]) => [id, { ...card }])
    ),
    activity: Object.fromEntries(
      Object.entries(state.activity).map(([day, value]) => [day, { ...value }])
    ),
    badges: { ...state.badges }
  };
}

export function loadProgressFrom(storage: Storage, key: string): ProgressState {
  try {
    const raw = storage.getItem(key);
    if (!raw) return createProgressState();
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return createProgressState();
  }
}

export function saveProgressTo(storage: Storage, key: string, state: ProgressState): void {
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {
    // Progress is helpful but not critical; ignore browser storage failures.
  }
}

/** v1 helpers kept for tests and migration. */
export function loadProgress(storage: Storage = window.localStorage): ProgressState {
  return loadProgressFrom(storage, STORAGE_KEY);
}

export function saveProgress(state: ProgressState, storage: Storage = window.localStorage): void {
  saveProgressTo(storage, STORAGE_KEY, state);
}

export function resetProgress(storage: Storage = window.localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore browser storage failures.
  }
}

export function dayKey(at: number = Date.now()): string {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

export interface RecordAnswerOptions {
  /** Option index the learner picked (enables confusion tracking). */
  selected?: number;
  at?: number;
}

export function recordAnswer(
  state: ProgressState,
  id: number,
  correct: boolean,
  options: RecordAnswerOptions = {}
): void {
  const at = options.at ?? Date.now();
  const question = statFor(state, id);
  question.seen += 1;
  question.lastExam = state.examIndex;
  question.lastSeenAt = at;
  question.recentWrong = 0.5 * question.recentWrong + 0.5 * (correct ? 0 : 1);

  if (correct) {
    question.correct += 1;
    question.level = Math.min(MAX_LEVEL, question.level + 1);
    question.streak = (question.streak ?? 0) + 1;
  } else {
    question.wrong += 1;
    question.level = Math.max(0, question.level - 2);
    question.streak = 0;
    if (typeof options.selected === "number" && options.selected >= 0) {
      const picks = question.picks ?? [0, 0, 0];
      while (picks.length <= options.selected) picks.push(0);
      picks[options.selected] += 1;
      question.picks = picks;
    }
  }

  const key = dayKey(at);
  const day = state.activity[key] ?? { answered: 0, correct: 0 };
  day.answered += 1;
  if (correct) day.correct += 1;
  state.activity[key] = day;

  state.xp += correct ? XP_CORRECT : XP_WRONG;
  state.updatedAt = at;
}

export function startExam(state: ProgressState): number {
  state.examIndex += 1;
  return state.examIndex;
}

export interface ExamResultExtras {
  mode?: ExamMode;
  durationMs?: number;
  timed?: boolean;
  signCorrect?: number;
  signTotal?: number;
}

export function recordExamResult(
  state: ProgressState,
  score: number,
  total: number,
  passed: boolean,
  at = Date.now(),
  extras: ExamResultExtras = {}
): void {
  state.history.push({
    at,
    score,
    total,
    passed,
    examIndex: state.examIndex,
    ...extras
  });
  const key = dayKey(at);
  const day = state.activity[key] ?? { answered: 0, correct: 0 };
  day.exams = (day.exams ?? 0) + 1;
  state.activity[key] = day;
  if (passed) state.xp += XP_PASS;
  state.updatedAt = at;
}

export function toggleFavorite(state: ProgressState, id: number): boolean {
  const index = state.favorites.indexOf(id);
  if (index >= 0) {
    state.favorites.splice(index, 1);
    return false;
  }
  state.favorites.push(id);
  return true;
}

export function setNote(state: ProgressState, id: number, note: string): void {
  const trimmed = note.trim();
  if (trimmed) state.notes[id] = trimmed.slice(0, 1000);
  else delete state.notes[id];
}

/** Drops progress for ids that are no longer in the question bank (bank updates). */
export function pruneUnknown(state: ProgressState, allIds: number[]): void {
  const known = new Set(allIds);
  for (const key of Object.keys(state.questions)) {
    if (!known.has(Number(key))) delete state.questions[Number(key)];
  }
  state.favorites = state.favorites.filter((id) => known.has(id));
  for (const key of Object.keys(state.notes)) {
    if (!known.has(Number(key))) delete state.notes[Number(key)];
  }
  for (const key of Object.keys(state.flashcards)) {
    if (!known.has(Number(key))) delete state.flashcards[Number(key)];
  }
}

/** Exam-style attempts that count towards pass statistics (v1 history has no mode). */
export function isCountedMode(mode: ExamMode | undefined): boolean {
  return mode === undefined || mode === "official" || mode === "timed" || mode === "strict" || mode === "final";
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
    examsTaken: state.history.filter((item) => isCountedMode(item.mode)).length,
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
