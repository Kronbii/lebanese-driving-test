export type Lang = "ar" | "en" | "fr";
export type Localized = Record<Lang, string>;

export type BankId = "motorcycle" | "car";

export interface Question {
  id: number;
  text: string;
  options: string[];
  answer: number;
  sign: string | null;
  /** Question bank this question belongs to. Missing means "motorcycle". */
  category?: BankId;
}

export type TopicId =
  | "gear"
  | "maintenance"
  | "control"
  | "passengers_loads"
  | "road_conditions"
  | "traffic_rules"
  | "hazards"
  | "rider_fitness"
  | "law_penalties"
  | "first_aid"
  | "signs_warning"
  | "signs_priority"
  | "signs_prohibition"
  | "signs_mandatory"
  | "signs_information";

/** Study content written for each official question. Never replaces the official wording. */
export interface QuestionContent {
  id: number;
  topic: TopicId;
  explanation: Localized;
  whyWrong: Record<Lang, (string | null)[]>;
  tip: Localized | null;
  translation: Record<"en" | "fr", { text: string; options: string[] }>;
}

export type ExamMode =
  | "official"
  | "timed"
  | "practice"
  | "strict"
  | "final"
  | "signs"
  | "weak"
  | "unseen"
  | "topic"
  | "favorites"
  | "daily"
  | "review"
  | "mistakes";

export interface QuestionProgress {
  seen: number;
  correct: number;
  wrong: number;
  level: number;
  lastExam: number;
  recentWrong: number;
  /** Timestamp of the last answer. */
  lastSeenAt?: number;
  /** Consecutive correct answers since the last mistake. */
  streak?: number;
  /** How many times each option was picked while wrong (index = option). */
  picks?: number[];
}

export interface ExamHistoryItem {
  at: number;
  score: number;
  total: number;
  passed: boolean;
  examIndex: number;
  mode?: ExamMode;
  durationMs?: number;
  timed?: boolean;
  signCorrect?: number;
  signTotal?: number;
  bank?: BankId;
}

export interface FlashcardState {
  box: number;
  due: number;
}

export interface DayActivity {
  answered: number;
  correct: number;
  exams?: number;
}

export interface ProgressState {
  version: 2;
  examIndex: number;
  questions: Record<number, QuestionProgress>;
  history: ExamHistoryItem[];
  favorites: number[];
  notes: Record<number, string>;
  flashcards: Record<number, FlashcardState>;
  /** Keyed by local date "YYYY-MM-DD". */
  activity: Record<string, DayActivity>;
  xp: number;
  /** Badge id -> timestamp earned. */
  badges: Record<string, number>;
  updatedAt: number;
}

export interface ProgressSummary {
  total: number;
  seen: number;
  unseen: number;
  mastered: number;
  weak: number;
  coveragePct: number;
  masteryPct: number;
  avgLevel: number;
  examsToCover: number;
  examsTaken: number;
  passes: number;
}

export interface WeakQuestion {
  id: number;
  level: number;
  recentWrong: number;
  wrong: number;
  score: number;
}

export interface SessionAnswer {
  id: number;
  selected: number;
  correct: number;
  ok: boolean;
}

export interface ExamSession {
  mode: ExamMode;
  ids: number[];
  index: number;
  answers: Record<number, SessionAnswer>;
  finished: boolean;
  startedAt?: number;
  /** Timestamp when a timed session ends. */
  deadline?: number;
  topic?: TopicId;
  bank?: BankId;
}

export interface ExamResult {
  mode: ExamMode;
  ids: number[];
  answers: Record<number, SessionAnswer>;
  score: number;
  total: number;
  passed: boolean;
  counted: boolean;
  durationMs?: number;
  timedOut?: boolean;
  topic?: TopicId;
  newBadges?: string[];
}
