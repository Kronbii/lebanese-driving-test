import { dayKey, MAX_LEVEL } from "./engine";
import type { ProgressState, TopicId } from "./types";

export interface TopicStat {
  topic: TopicId;
  total: number;
  seen: number;
  correct: number;
  wrong: number;
  /** 0..1, or null when nothing answered yet. */
  accuracy: number | null;
  /** Average level 0..MAX_LEVEL across all questions in the topic (unseen = 0). */
  mastery: number;
}

export function topicStats(
  state: ProgressState,
  questions: { id: number; topic: TopicId }[]
): TopicStat[] {
  const map = new Map<TopicId, TopicStat>();
  for (const question of questions) {
    const stat = map.get(question.topic) ?? {
      topic: question.topic,
      total: 0,
      seen: 0,
      correct: 0,
      wrong: 0,
      accuracy: null,
      mastery: 0
    };
    stat.total += 1;
    const progress = state.questions[question.id];
    if (progress && progress.seen > 0) {
      stat.seen += 1;
      stat.correct += progress.correct;
      stat.wrong += progress.wrong;
      stat.mastery += progress.level;
    }
    map.set(question.topic, stat);
  }
  return [...map.values()].map((stat) => ({
    ...stat,
    accuracy: stat.correct + stat.wrong > 0 ? stat.correct / (stat.correct + stat.wrong) : null,
    mastery: stat.total ? stat.mastery / stat.total : 0
  }));
}

/** Topics sorted weakest first (only those with answers). */
export function weakTopics(stats: TopicStat[], limit = 3): TopicStat[] {
  return stats
    .filter((stat) => stat.accuracy !== null)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1) || a.mastery - b.mastery)
    .slice(0, limit);
}

export interface ConfusedItem {
  id: number;
  wrong: number;
  /** Option most often picked by mistake. */
  confusedWith: number | null;
}

/** Most-confused questions (e.g. signs), by number of wrong answers. */
export function mostConfused(
  state: ProgressState,
  ids: number[],
  limit = 10
): ConfusedItem[] {
  const items: ConfusedItem[] = [];
  for (const id of ids) {
    const stat = state.questions[id];
    if (!stat || stat.wrong === 0) continue;
    let confusedWith: number | null = null;
    if (stat.picks) {
      let best = 0;
      stat.picks.forEach((count, index) => {
        if (count > best) {
          best = count;
          confusedWith = index;
        }
      });
    }
    items.push({ id, wrong: stat.wrong, confusedWith });
  }
  items.sort((a, b) => b.wrong - a.wrong);
  return items.slice(0, limit);
}

export function signAccuracy(state: ProgressState, signIds: number[]): number | null {
  let correct = 0;
  let wrong = 0;
  for (const id of signIds) {
    const stat = state.questions[id];
    if (!stat) continue;
    correct += stat.correct;
    wrong += stat.wrong;
  }
  return correct + wrong > 0 ? correct / (correct + wrong) : null;
}

export function signMastery(state: ProgressState, signIds: number[]): number {
  if (!signIds.length) return 0;
  let sum = 0;
  for (const id of signIds) sum += state.questions[id]?.level ?? 0;
  return sum / (signIds.length * MAX_LEVEL);
}

/** Consecutive days with practice, ending today (or yesterday if not yet today). */
export function practiceStreak(state: ProgressState, now = Date.now()): number {
  const active = (at: number) => (state.activity[dayKey(at)]?.answered ?? 0) > 0;
  let cursor = now;
  if (!active(cursor)) cursor -= 86_400_000;
  let streak = 0;
  while (active(cursor)) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}

export interface WeeklySummary {
  days: { day: string; answered: number; correct: number }[];
  answered: number;
  correct: number;
  exams: number;
  activeDays: number;
}

export function weeklySummary(state: ProgressState, now = Date.now()): WeeklySummary {
  const days: WeeklySummary["days"] = [];
  let answered = 0;
  let correct = 0;
  let exams = 0;
  for (let offset = 6; offset >= 0; offset -= 1) {
    const key = dayKey(now - offset * 86_400_000);
    const activity = state.activity[key];
    days.push({ day: key, answered: activity?.answered ?? 0, correct: activity?.correct ?? 0 });
    answered += activity?.answered ?? 0;
    correct += activity?.correct ?? 0;
    exams += activity?.exams ?? 0;
  }
  return { days, answered, correct, exams, activeDays: days.filter((d) => d.answered > 0).length };
}
