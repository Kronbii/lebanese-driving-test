import type { QuestionLang } from "../../app/SettingsContext";
import { BANKS } from "../../data/banks";
import { contentFor, topicOf } from "../../data/content";
import { TOPICS, TOPICS_BY_ID } from "../../data/topics";
import type { BankId, Lang, Question, TopicId } from "../../domain/types";

/**
 * Small helpers shared by the print, projector, share and embed features.
 * Pure functions only (no React).
 */

/** Deterministic PRNG (mulberry32) so a seed in the URL always rebuilds the same exam. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseSeed(value: string | null): number | null {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  return Number(value);
}

/** A fresh 6-digit seed that is easy to read aloud and write on a sheet. */
export function newSeed(): number {
  return 100000 + Math.floor(Math.random() * 900000);
}

export function shuffled<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}

export interface PrintExamOptions {
  signsOnly?: boolean;
  topic?: TopicId | null;
  size?: number;
}

/** Question ids of a printable exam: same bank + seed + options -> same ids, same order. */
export function printableExamIds(bank: BankId, seed: number, options: PrintExamOptions = {}): number[] {
  const size = options.size ?? BANKS[bank].examSize;
  let pool = BANKS[bank].questions;
  if (options.signsOnly) pool = pool.filter((question) => question.sign);
  if (options.topic) pool = pool.filter((question) => topicOf(question.id) === options.topic);
  const ids = pool.map((question) => question.id).sort((a, b) => a - b);
  return shuffled(ids, seededRandom(seed)).slice(0, size);
}

export interface DisplayQuestion {
  /** Text and options in the language the learner reads. */
  text: string;
  options: string[];
  /** Language/direction of text/options. */
  lang: Lang;
  dir: "rtl" | "ltr";
  /** True when text/options are a translation; the official Arabic is then shown as well. */
  translated: boolean;
  officialText: string;
  officialOptions: string[];
}

/** Sign questions have no wording in the official bank: the sign itself is the question. */
export const SIGN_PROMPT: Record<Lang, string> = {
  ar: "ماذا تعني هذه الشاخصة؟",
  en: "What does this sign mean?",
  fr: "Que signifie ce panneau ?"
};

/** Official Arabic wording, or the study translation with the official wording kept alongside. */
export function displayQuestion(question: Question, questionLang: QuestionLang): DisplayQuestion {
  const officialText = question.text.trim() || SIGN_PROMPT.ar;
  const base: DisplayQuestion = {
    text: officialText,
    options: question.options,
    lang: "ar",
    dir: "rtl",
    translated: false,
    officialText,
    officialOptions: question.options
  };
  if (questionLang === "official") return base;
  const translation = contentFor(question.id)?.translation[questionLang];
  if (!translation || translation.options.length !== question.options.length) return base;
  return {
    ...base,
    text: translation.text.trim() || SIGN_PROMPT[questionLang],
    options: translation.options,
    lang: questionLang,
    dir: "ltr",
    translated: true
  };
}

const LETTERS: Record<Lang, string[]> = {
  ar: ["أ", "ب", "ج", "د", "هـ"],
  en: ["A", "B", "C", "D", "E"],
  fr: ["A", "B", "C", "D", "E"]
};

export function optionLetter(lang: Lang, index: number): string {
  return LETTERS[lang][index] ?? String(index + 1);
}

export function topicLabel(topic: TopicId, lang: Lang): string {
  return TOPICS_BY_ID.get(topic)?.label[lang] ?? topic;
}

/** Topics that have at least one question in the bank, in the canonical order. */
export function topicsInBank(bank: BankId, group?: "theory" | "signs"): TopicId[] {
  const present = new Set(BANKS[bank].questions.map((question) => topicOf(question.id)));
  return TOPICS.filter((topic) => present.has(topic.id) && (!group || topic.group === group)).map(
    (topic) => topic.id
  );
}

export function explanationText(id: number, lang: Lang): string | null {
  return contentFor(id)?.explanation[lang] ?? null;
}

/** "#0f766e" style colours only; anything else falls back. */
export function safeColor(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

/** wa.me link; number is international digits without "+". */
export function whatsappLink(number: string | null | undefined, text: string): string {
  const digits = (number ?? "").replace(/\D/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return digits ? `https://wa.me/${digits}${query}` : `https://wa.me/${query}`;
}

/** Public URL of the trainer: the school landing in school scope, the site root otherwise. */
export function appUrl(slug: string | null): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return slug ? `${origin}/s/${slug}` : `${origin}/`;
}

/** Only short, URL-safe ref codes are kept (they end up in counters and lead sources). */
export function cleanRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/[^\w-]/g, "").slice(0, 48);
  return cleaned || null;
}
