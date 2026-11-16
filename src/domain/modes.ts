import { buildExam, shuffle, weakestIds } from "./engine";
import { dailyQueue, notebookEntries } from "./notebook";
import type { ExamMode, ProgressState, TopicId } from "./types";

export interface QuestionMeta {
  id: number;
  sign: boolean;
  topic: TopicId;
}

export interface ModeConfig {
  id: ExamMode;
  /** "instant" shows right/wrong after each answer; "end" only at the results. */
  feedback: "instant" | "end";
  timed: boolean;
  /** Counted as an exam attempt with a pass/fail verdict. */
  counts: boolean;
  /** Adaptive spaced-repetition selection vs. plain random. */
  adaptive: boolean;
}

export const MODES: Record<ExamMode, ModeConfig> = {
  official: { id: "official", feedback: "instant", timed: false, counts: true, adaptive: true },
  timed: { id: "timed", feedback: "instant", timed: true, counts: true, adaptive: true },
  strict: { id: "strict", feedback: "end", timed: false, counts: true, adaptive: true },
  final: { id: "final", feedback: "end", timed: true, counts: true, adaptive: false },
  practice: { id: "practice", feedback: "instant", timed: false, counts: false, adaptive: true },
  signs: { id: "signs", feedback: "instant", timed: false, counts: false, adaptive: true },
  weak: { id: "weak", feedback: "instant", timed: false, counts: false, adaptive: true },
  unseen: { id: "unseen", feedback: "instant", timed: false, counts: false, adaptive: false },
  topic: { id: "topic", feedback: "instant", timed: false, counts: false, adaptive: true },
  favorites: { id: "favorites", feedback: "instant", timed: false, counts: false, adaptive: false },
  daily: { id: "daily", feedback: "instant", timed: false, counts: false, adaptive: true },
  review: { id: "review", feedback: "instant", timed: false, counts: false, adaptive: true },
  mistakes: { id: "mistakes", feedback: "instant", timed: false, counts: false, adaptive: true }
};

export const EXAM_MODES: ExamMode[] = ["official", "timed", "strict", "final"];
export const PRACTICE_MODES: ExamMode[] = [
  "practice",
  "signs",
  "weak",
  "unseen",
  "topic",
  "favorites",
  "daily",
  "mistakes"
];

export interface BuildOptions {
  size: number;
  topic?: TopicId;
  rng?: () => number;
  now?: number;
}

/** Picks question ids for a session. Returns [] when the mode has nothing to offer yet. */
export function buildSessionIds(
  mode: ExamMode,
  state: ProgressState,
  questions: QuestionMeta[],
  options: BuildOptions
): number[] {
  const rng = options.rng ?? Math.random;
  const size = options.size;
  const allIds = questions.map((question) => question.id);

  switch (mode) {
    case "official":
    case "timed":
    case "strict":
    case "practice":
      return buildExam(state, allIds, size, rng);
    case "final":
      return shuffle(allIds, rng).slice(0, size);
    case "signs":
      return buildExam(
        state,
        questions.filter((question) => question.sign).map((question) => question.id),
        size,
        rng
      );
    case "topic": {
      const topicIds = questions
        .filter((question) => question.topic === options.topic)
        .map((question) => question.id);
      return buildExam(state, topicIds, Math.min(size, topicIds.length), rng);
    }
    case "weak":
    case "review":
      return shuffle(
        weakestIds(state, allIds, size).map((item) => item.id),
        rng
      );
    case "unseen":
      return shuffle(
        allIds.filter((id) => !state.questions[id] || state.questions[id].seen === 0),
        rng
      ).slice(0, size);
    case "favorites":
      return shuffle(
        state.favorites.filter((id) => allIds.includes(id)),
        rng
      ).slice(0, size);
    case "daily":
      return shuffle(dailyQueue(state, allIds, options.now ?? Date.now(), 15), rng);
    case "mistakes":
      return shuffle(
        notebookEntries(state, questions)
          .filter((entry) => entry.status !== "fixed")
          .map((entry) => entry.id),
        rng
      ).slice(0, size);
    default:
      return [];
  }
}
