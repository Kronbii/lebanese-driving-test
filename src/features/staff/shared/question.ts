import { QUESTIONS_BY_ID } from "../../../data/banks";
import { contentFor, topicOf } from "../../../data/content";
import type { Lang, Question, TopicId } from "../../../domain/types";

export interface QuestionTexts {
  question: Question;
  /** Translated question text, only for non-sign questions in en/fr. */
  translatedText: string | null;
  /** Translated options (en/fr) or null. */
  translatedOptions: string[] | null;
  topic: TopicId;
}

export function questionTexts(id: number, lang: Lang): QuestionTexts | null {
  const question = QUESTIONS_BY_ID.get(id);
  if (!question) return null;
  const translation = lang === "ar" ? undefined : contentFor(id)?.translation[lang];
  return {
    question,
    translatedText: question.text && translation?.text ? translation.text : null,
    translatedOptions:
      translation && translation.options.length === question.options.length ? translation.options : null,
    topic: topicOf(id)
  };
}
