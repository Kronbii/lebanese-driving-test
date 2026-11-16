import { MAX_LEVEL } from "./engine";
import type { QuestionMeta } from "./modes";
import type { ExamHistoryItem, ProgressState } from "./types";

export type ReadinessLabel = "not_ready" | "needs_signs" | "almost" | "ready";

export interface ReadinessFactors {
  /** Average of the last 3 counted exam scores, 0..1. */
  recentExams: number | null;
  /** Average mastery level across the whole bank, 0..1. */
  mastery: number;
  /** Share of the bank seen at least once, 0..1. */
  coverage: number;
  /** Accuracy on sign questions, 0..1. */
  signs: number | null;
  /** 1 - average recent-wrong rate on seen questions, 0..1. */
  trend: number | null;
  /** 1 when practised in the last 2 days, fading to 0 after 3 weeks. */
  recency: number | null;
  /** Pass rate on the last 3 timed exams, 0..1. */
  timed: number | null;
}

export interface Readiness {
  score: number;
  label: ReadinessLabel;
  factors: ReadinessFactors;
  lastScores: number[];
  examsCounted: number;
  daysSinceLast: number | null;
}

const WEIGHTS: Record<keyof ReadinessFactors, number> = {
  recentExams: 0.35,
  mastery: 0.2,
  coverage: 0.1,
  signs: 0.15,
  trend: 0.1,
  recency: 0.05,
  timed: 0.05
};

const COUNTED_MODES = new Set(["official", "timed", "strict", "final", undefined]);

export function countedExams(history: ExamHistoryItem[]): ExamHistoryItem[] {
  return history.filter((item) => COUNTED_MODES.has(item.mode));
}

export function computeReadiness(
  state: ProgressState,
  questions: QuestionMeta[],
  now = Date.now()
): Readiness {
  const counted = countedExams(state.history);
  const last3 = counted.slice(-3);
  const lastScores = last3.map((item) => (item.total ? item.score / item.total : 0));
  const recentExams = lastScores.length
    ? lastScores.reduce((sum, value) => sum + value, 0) / lastScores.length
    : null;

  let seen = 0;
  let levelSum = 0;
  let recentWrongSum = 0;
  let signCorrect = 0;
  let signWrong = 0;
  let lastSeen = 0;
  for (const question of questions) {
    const stat = state.questions[question.id];
    if (!stat || stat.seen === 0) continue;
    seen += 1;
    levelSum += stat.level;
    recentWrongSum += stat.recentWrong;
    if (question.sign) {
      signCorrect += stat.correct;
      signWrong += stat.wrong;
    }
    lastSeen = Math.max(lastSeen, stat.lastSeenAt ?? 0);
  }
  for (const item of state.history) lastSeen = Math.max(lastSeen, item.at);

  const total = questions.length || 1;
  const timedExams = counted.filter((item) => item.timed).slice(-3);
  const daysSinceLast = lastSeen ? (now - lastSeen) / 86_400_000 : null;

  const factors: ReadinessFactors = {
    recentExams,
    mastery: levelSum / (total * MAX_LEVEL),
    coverage: seen / total,
    signs: signCorrect + signWrong > 0 ? signCorrect / (signCorrect + signWrong) : null,
    trend: seen ? 1 - recentWrongSum / seen : null,
    recency:
      daysSinceLast === null
        ? null
        : daysSinceLast <= 2
          ? 1
          : Math.max(0, 1 - (daysSinceLast - 2) / 19),
    timed: timedExams.length
      ? timedExams.filter((item) => item.passed).length / timedExams.length
      : null
  };

  let weighted = 0;
  let weightSum = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof ReadinessFactors)[]) {
    const value = factors[key];
    if (value === null) continue;
    weighted += value * WEIGHTS[key];
    weightSum += WEIGHTS[key];
  }
  let score = weightSum ? Math.round((weighted / weightSum) * 100) : 0;
  if (!counted.length) score = Math.min(score, 50);

  const allRecentPassed = last3.length >= 2 && last3.every((item) => item.passed);
  let label: ReadinessLabel = "not_ready";
  if (
    score >= 85 &&
    allRecentPassed &&
    factors.coverage >= 0.9 &&
    (factors.signs === null || factors.signs >= 0.85)
  ) {
    label = "ready";
  } else if (factors.signs !== null && factors.signs < 0.8 && score >= 55) {
    label = "needs_signs";
  } else if (score >= 70) {
    label = "almost";
  }

  return {
    score,
    label,
    factors,
    lastScores,
    examsCounted: counted.length,
    daysSinceLast: daysSinceLast === null ? null : Math.floor(daysSinceLast)
  };
}
