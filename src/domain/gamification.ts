import { MAX_LEVEL } from "./engine";
import type { QuestionMeta } from "./modes";
import { computeReadiness } from "./readiness";
import { practiceStreak } from "./stats";
import type { ProgressState } from "./types";

export type BadgeId =
  | "first_exam"
  | "first_pass"
  | "perfect"
  | "coverage_50"
  | "coverage_100"
  | "mastery_50"
  | "signs_master"
  | "streak_3"
  | "streak_7"
  | "exam_ready";

export const BADGES: BadgeId[] = [
  "first_exam",
  "first_pass",
  "perfect",
  "coverage_50",
  "coverage_100",
  "mastery_50",
  "signs_master",
  "streak_3",
  "streak_7",
  "exam_ready"
];

/** Returns badges earned now that were not already in state.badges, and records them. */
export function awardBadges(
  state: ProgressState,
  questions: QuestionMeta[],
  now = Date.now()
): BadgeId[] {
  const earned: BadgeId[] = [];
  const give = (id: BadgeId, condition: boolean) => {
    if (condition && !state.badges[id]) {
      state.badges[id] = now;
      earned.push(id);
    }
  };

  const total = questions.length || 1;
  let seen = 0;
  let mastered = 0;
  const signs = questions.filter((question) => question.sign);
  for (const question of questions) {
    const stat = state.questions[question.id];
    if (stat && stat.seen > 0) seen += 1;
    if (stat && stat.level >= MAX_LEVEL) mastered += 1;
  }
  const signsMastered =
    signs.length > 0 && signs.every((question) => (state.questions[question.id]?.level ?? 0) >= 3);
  const streak = practiceStreak(state, now);

  give("first_exam", state.history.length > 0);
  give("first_pass", state.history.some((item) => item.passed));
  give(
    "perfect",
    state.history.some((item) => item.total >= 30 && item.score === item.total)
  );
  give("coverage_50", seen / total >= 0.5);
  give("coverage_100", seen === total);
  give("mastery_50", mastered / total >= 0.5);
  give("signs_master", signsMastered);
  give("streak_3", streak >= 3);
  give("streak_7", streak >= 7);
  give("exam_ready", computeReadiness(state, questions, now).label === "ready");
  return earned;
}

/** Level from XP: 0-99 → 1, then every 250 XP. */
export function xpLevel(xp: number): { level: number; into: number; next: number } {
  if (xp < 100) return { level: 1, into: xp, next: 100 };
  const level = 2 + Math.floor((xp - 100) / 250);
  const into = (xp - 100) % 250;
  return { level, into, next: 250 };
}
