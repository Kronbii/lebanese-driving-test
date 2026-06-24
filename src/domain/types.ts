export type ExamMode = "official" | "review";

export interface Question {
  id: number;
  text: string;
  options: string[];
  answer: number;
  sign: string | null;
}

export interface QuestionProgress {
  seen: number;
  correct: number;
  wrong: number;
  level: number;
  lastExam: number;
  recentWrong: number;
}

export interface ExamHistoryItem {
  at: number;
  score: number;
  total: number;
  passed: boolean;
  examIndex: number;
  mode?: ExamMode;
}

export interface ProgressState {
  examIndex: number;
  questions: Record<number, QuestionProgress>;
  history: ExamHistoryItem[];
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
}

export interface ExamResult {
  mode: ExamMode;
  ids: number[];
  answers: Record<number, SessionAnswer>;
  score: number;
  total: number;
  passed: boolean;
}
