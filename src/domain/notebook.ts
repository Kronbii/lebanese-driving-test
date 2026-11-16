import { overdue } from "./engine";
import type { ProgressState, TopicId } from "./types";

export type MistakeStatus = "repeated" | "active" | "fixed";

export interface NotebookEntry {
  id: number;
  topic: TopicId;
  status: MistakeStatus;
  wrong: number;
  correct: number;
  streak: number;
  lastSeenAt?: number;
  favorite: boolean;
  note?: string;
}

/** Consecutive correct answers needed before a past mistake counts as fixed. */
export const FIXED_STREAK = 3;

export function mistakeStatus(wrong: number, streak: number): MistakeStatus {
  if (streak >= FIXED_STREAK) return "fixed";
  if (wrong >= 2) return "repeated";
  return "active";
}

/** Every question the learner ever got wrong, newest first. */
export function notebookEntries(
  state: ProgressState,
  questions: { id: number; topic: TopicId }[]
): NotebookEntry[] {
  const favorites = new Set(state.favorites);
  const entries: NotebookEntry[] = [];
  for (const question of questions) {
    const stat = state.questions[question.id];
    if (!stat || stat.wrong === 0) continue;
    const streak = stat.streak ?? 0;
    entries.push({
      id: question.id,
      topic: question.topic,
      status: mistakeStatus(stat.wrong, streak),
      wrong: stat.wrong,
      correct: stat.correct,
      streak,
      lastSeenAt: stat.lastSeenAt,
      favorite: favorites.has(question.id),
      note: state.notes[question.id]
    });
  }
  const order: Record<MistakeStatus, number> = { repeated: 0, active: 1, fixed: 2 };
  entries.sort(
    (a, b) => order[a.status] - order[b.status] || (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0)
  );
  return entries;
}

export function groupByTopic<T extends { topic: TopicId }>(items: T[]): Map<TopicId, T[]> {
  const groups = new Map<TopicId, T[]>();
  for (const item of items) {
    const list = groups.get(item.topic) ?? [];
    list.push(item);
    groups.set(item.topic, list);
  }
  return groups;
}

/**
 * Today's review queue: seen questions that are due by the spacing schedule or
 * were missed recently, most urgent first.
 */
export function dailyQueue(
  state: ProgressState,
  allIds: number[],
  now: number,
  limit = 15
): number[] {
  const scored: { id: number; score: number }[] = [];
  for (const id of allIds) {
    const stat = state.questions[id];
    if (!stat || stat.seen === 0) continue;
    const due = overdue(state, stat);
    const daysSince = stat.lastSeenAt ? (now - stat.lastSeenAt) / 86_400_000 : 30;
    const recency = Math.min(daysSince, 30) / 30;
    const urgent = due >= 0 || stat.recentWrong > 0.3 || (stat.level < 3 && daysSince > 2);
    if (!urgent) continue;
    scored.push({
      id,
      score: stat.recentWrong * 3 + (5 - stat.level) + Math.max(due, 0) * 0.5 + recency
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.id);
}
