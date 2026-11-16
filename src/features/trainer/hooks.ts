import { useEffect, useMemo, useState } from "react";
import { api, apiHealth } from "../../api/client";
import { useSchool } from "../../app/SchoolContext";
import { useSettings } from "../../app/SettingsContext";
import { BANKS } from "../../data/banks";
import { contentFor } from "../../data/content";
import { questionMeta } from "../../data/meta";
import type { Lang, Question } from "../../domain/types";
import { useI18n } from "../../i18n/useI18n";

export const SIGN_PROMPT: Record<Lang, string> = {
  ar: "ماذا تعني هذه الشاخصة؟",
  en: "What does this sign mean?",
  fr: "Que signifie ce panneau ?"
};

export interface QuestionView {
  text: string;
  options: string[];
  lang: Lang;
  dir: "rtl" | "ltr";
  translated: boolean;
  officialText: string;
  officialOptions: string[];
}

/** The question in the learner's chosen question language, with the official Arabic kept alongside. */
export function useQuestionView(question: Question | undefined | null): QuestionView | null {
  const { settings, contentReady } = useSettings();
  return useMemo(() => {
    if (!question) return null;
    const officialText = question.text.trim() || SIGN_PROMPT.ar;
    const official: QuestionView = {
      text: officialText,
      options: question.options,
      lang: "ar",
      dir: "rtl",
      translated: false,
      officialText,
      officialOptions: question.options
    };
    if (settings.questionLang === "official") return official;
    const lang = settings.questionLang;
    const translation = contentFor(question.id)?.translation[lang];
    if (!translation || translation.options.length !== question.options.length) return official;
    return {
      text: translation.text.trim() || SIGN_PROMPT[lang],
      options: translation.options,
      lang,
      dir: "ltr",
      translated: true,
      officialText,
      officialOptions: question.options
    };
  }, [question, settings.questionLang, contentReady]);
}

export function useExplanationLang(): Lang {
  const { settings } = useSettings();
  return settings.explanationLang === "ui" ? settings.lang : settings.explanationLang;
}

/** Active bank info + domain metadata. */
export function useBank() {
  const { settings } = useSettings();
  return useMemo(() => {
    const bank = BANKS[settings.bank];
    const meta = questionMeta(settings.bank);
    return {
      bank,
      meta,
      ids: meta.map((item) => item.id),
      signIds: meta.filter((item) => item.sign).map((item) => item.id)
    };
  }, [settings.bank]);
}

export interface SchoolNote {
  questionId: number;
  body: string;
  videoUrl: string | null;
}

const notesCache = new Map<string, Promise<Map<number, SchoolNote[]>>>();

/** School-wide instructor notes for questions (school mode with the API only). */
export function useSchoolNotes(): Map<number, SchoolNote[]> {
  const { slug } = useSchool();
  const [notes, setNotes] = useState<Map<number, SchoolNote[]>>(new Map());
  useEffect(() => {
    if (!slug) {
      setNotes(new Map());
      return;
    }
    let promise = notesCache.get(slug);
    if (!promise) {
      promise = api<{ notes: SchoolNote[] }>(`/schools/${encodeURIComponent(slug)}/question-notes`)
        .then(({ notes: list }) => {
          const map = new Map<number, SchoolNote[]>();
          for (const note of list) {
            const items = map.get(note.questionId) ?? [];
            items.push(note);
            map.set(note.questionId, items);
          }
          return map;
        })
        .catch(() => new Map<number, SchoolNote[]>());
      notesCache.set(slug, promise);
    }
    let cancelled = false;
    void promise.then((map) => {
      if (!cancelled) setNotes(map);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return notes;
}

/** Whether the AI tutor can be offered (API up with a key, and the school allows it). */
export function useAiAvailable(): boolean {
  const { can } = useSchool();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void apiHealth().then((health) => {
      if (!cancelled) setAvailable(health.ok && health.ai);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return available && can("ai");
}

/** Localised topic label. */
export function useTopicLabel() {
  const { pick } = useI18n();
  return pick;
}
