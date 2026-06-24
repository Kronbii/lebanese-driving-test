import type { Question } from "../domain/types";

export const PASS_SCORE = 25;
export const EXAM_SIZE = 30;
export const SIGN_PROMPT = "ماذا تعني هذه الشاخصة؟";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function arNum(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

export function pct(value: number): string {
  return `\u2068${arNum(Math.round(value))}%\u2069`;
}

export function questionText(question: Question): string {
  return question.text.trim() ? question.text : SIGN_PROMPT;
}

export function formatDate(timestamp?: number): string {
  if (!timestamp) return "—";

  try {
    return new Intl.DateTimeFormat("ar-LB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp));
  } catch {
    return arNum(new Date(timestamp).toLocaleDateString());
  }
}
