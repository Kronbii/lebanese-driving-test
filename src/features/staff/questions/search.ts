import { contentFor, topicOf } from "../../../data/content";
import type { Question, TopicId } from "../../../domain/types";

/** Lowercase, strip Arabic diacritics/tatweel and unify common letter variants. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

export interface IndexedQuestion {
  question: Question;
  topic: TopicId;
  haystack: string;
}

export function indexQuestions(questions: Question[]): IndexedQuestion[] {
  return questions.map((question) => {
    const content = contentFor(question.id);
    const parts = [
      String(question.id),
      question.text,
      ...question.options,
      content?.translation.en.text ?? "",
      ...(content?.translation.en.options ?? []),
      content?.translation.fr.text ?? "",
      ...(content?.translation.fr.options ?? [])
    ];
    return { question, topic: topicOf(question.id), haystack: normalizeSearch(parts.join(" \u0001 ")) };
  });
}
