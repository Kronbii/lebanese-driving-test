import { useMemo } from "react";
import { useSettings } from "../../../app/SettingsContext";
import { BANKS } from "../../../data/banks";
import { contentFor, topicOf } from "../../../data/content";
import type { Lang, Question, TopicId } from "../../../domain/types";

export interface SignItem {
  id: number;
  image: string;
  topic: TopicId;
  /** Meaning in the learner's question language. */
  meaning: string;
  meaningLang: Lang;
  /** Official Arabic meaning. */
  official: string;
  question: Question;
}

export const SIGN_TOPICS: TopicId[] = [
  "signs_warning",
  "signs_priority",
  "signs_prohibition",
  "signs_mandatory",
  "signs_information"
];

export function useSigns(): SignItem[] {
  const { settings, contentReady } = useSettings();
  return useMemo(() => {
    const lang = settings.questionLang === "official" ? "ar" : settings.questionLang;
    return BANKS[settings.bank].questions
      .filter((question) => question.sign)
      .map((question) => {
        const official = question.options[question.answer];
        const translated =
          lang === "ar" ? null : contentFor(question.id)?.translation[lang]?.options[question.answer];
        return {
          id: question.id,
          image: question.sign as string,
          topic: topicOf(question.id),
          meaning: translated || official,
          meaningLang: translated ? lang : "ar",
          official,
          question
        };
      });
  }, [settings.bank, settings.questionLang, contentReady]);
}

/** Normalises Arabic for search: strips diacritics and unifies alef/yaa/taa marbuta forms. */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}
