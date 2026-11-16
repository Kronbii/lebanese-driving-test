import type { QuestionMeta } from "./modes";
import { dailyQueue, notebookEntries } from "./notebook";
import { computeReadiness } from "./readiness";
import { topicStats, weakTopics } from "./stats";
import type { ExamMode, ProgressState, TopicId } from "./types";

export type PlanStepKind =
  | "first_exam"
  | "daily_review"
  | "cover_unseen"
  | "fix_mistakes"
  | "signs_drill"
  | "weak_topic"
  | "timed_exam"
  | "keep_sharp";

export interface PlanStep {
  kind: PlanStepKind;
  mode: ExamMode;
  count: number;
  topic?: TopicId;
}

/**
 * A deterministic study plan from the learner's own data. Steps are ordered by
 * what moves pass-readiness the most right now.
 */
export function studyPlan(
  state: ProgressState,
  questions: QuestionMeta[],
  now = Date.now()
): PlanStep[] {
  const steps: PlanStep[] = [];
  const ids = questions.map((question) => question.id);
  const readiness = computeReadiness(state, questions, now);

  if (!state.history.length) {
    return [{ kind: "first_exam", mode: "official", count: 30 }];
  }

  const due = dailyQueue(state, ids, now, 15);
  if (due.length >= 5) steps.push({ kind: "daily_review", mode: "daily", count: due.length });

  const mistakes = notebookEntries(state, questions).filter((entry) => entry.status !== "fixed");
  if (mistakes.length) {
    steps.push({ kind: "fix_mistakes", mode: "mistakes", count: Math.min(mistakes.length, 30) });
  }

  const unseen = ids.filter((id) => !state.questions[id] || state.questions[id].seen === 0).length;
  if (unseen > 0) {
    steps.push({ kind: "cover_unseen", mode: "official", count: Math.ceil(unseen / 20) });
  }

  if (readiness.factors.signs !== null && readiness.factors.signs < 0.85) {
    steps.push({ kind: "signs_drill", mode: "signs", count: 30 });
  }

  const weak = weakTopics(topicStats(state, questions), 1)[0];
  if (weak && weak.accuracy !== null && weak.accuracy < 0.8 && !weak.topic.startsWith("signs_")) {
    steps.push({ kind: "weak_topic", mode: "topic", topic: weak.topic, count: weak.total });
  }

  if (readiness.score >= 70 && readiness.factors.timed === null) {
    steps.push({ kind: "timed_exam", mode: "final", count: 30 });
  }

  if (!steps.length) steps.push({ kind: "keep_sharp", mode: "timed", count: 30 });
  return steps.slice(0, 4);
}
