import type { StudentMetrics } from "../api/types";
import { summary } from "./engine";
import type { QuestionMeta } from "./modes";
import { computeReadiness, countedExams } from "./readiness";
import { signAccuracy, topicStats, weakTopics } from "./stats";
import type { ProgressState, TopicId } from "./types";

/** Metrics a linked student's device sends to their school with each sync. */
export function computeStudentMetrics(
  state: ProgressState,
  questions: QuestionMeta[],
  now = Date.now()
): StudentMetrics {
  const ids = questions.map((question) => question.id);
  const base = summary(state, ids);
  const readiness = computeReadiness(state, questions, now);
  const counted = countedExams(state.history);
  const pcts = counted.map((item) => (item.total ? (item.score / item.total) * 100 : 0));
  const stats = topicStats(state, questions);
  const topicAccuracy: Partial<Record<TopicId, number>> = {};
  for (const stat of stats) {
    if (stat.accuracy !== null) topicAccuracy[stat.topic] = Math.round(stat.accuracy * 100);
  }
  const signs = signAccuracy(
    state,
    questions.filter((question) => question.sign).map((question) => question.id)
  );
  let lastPracticeAt = 0;
  for (const stat of Object.values(state.questions)) {
    lastPracticeAt = Math.max(lastPracticeAt, stat.lastSeenAt ?? 0);
  }

  return {
    examsTaken: counted.length,
    passes: counted.filter((item) => item.passed).length,
    bestScorePct: pcts.length ? Math.round(Math.max(...pcts)) : null,
    avgScorePct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
    lastScorePct: pcts.length ? Math.round(pcts[pcts.length - 1]) : null,
    readiness: readiness.score,
    readinessLabel: readiness.label,
    coveragePct: base.coveragePct,
    masteryPct: base.masteryPct,
    signAccuracyPct: signs === null ? null : Math.round(signs * 100),
    topicAccuracy,
    weakTopics: weakTopics(stats, 3).map((stat) => stat.topic),
    lastPracticeAt: lastPracticeAt || null
  };
}
