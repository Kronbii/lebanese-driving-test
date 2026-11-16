import type { Lang } from "../domain/types";
import { NAMESPACES } from "./messages";

export type { Lang };

export interface LangInfo {
  code: Lang;
  label: string;
  dir: "rtl" | "ltr";
  locale: string;
}

export const LANGS: LangInfo[] = [
  { code: "ar", label: "العربية", dir: "rtl", locale: "ar-LB" },
  { code: "en", label: "English", dir: "ltr", locale: "en-GB" },
  { code: "fr", label: "Français", dir: "ltr", locale: "fr-FR" }
];

export const LANG_INFO: Record<Lang, LangInfo> = Object.fromEntries(
  LANGS.map((info) => [info.code, info])
) as Record<Lang, LangInfo>;

export function isLang(value: unknown): value is Lang {
  return value === "ar" || value === "en" || value === "fr";
}

type Flat = Record<string, string>;

const CATALOG: Record<Lang, Flat> = { ar: {}, en: {}, fr: {} };
for (const [namespace, messages] of Object.entries(NAMESPACES)) {
  for (const lang of ["ar", "en", "fr"] as Lang[]) {
    for (const [key, value] of Object.entries(messages[lang])) {
      CATALOG[lang][`${namespace}.${key}`] = value;
    }
  }
}

export type Vars = Record<string, string | number>;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

export function formatNumber(lang: Lang, value: number | string): string {
  const text = String(value);
  return lang === "ar" ? toArabicDigits(text) : text;
}

/**
 * Looks up "namespace.key", falling back to Arabic and then the key itself.
 * {name} placeholders are replaced; numbers use the language's digits.
 */
export function translate(lang: Lang, key: string, vars?: Vars): string {
  const template = CATALOG[lang][key] ?? CATALOG.ar[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    if (value === undefined) return match;
    return typeof value === "number" ? formatNumber(lang, value) : value;
  });
}

export function hasKey(lang: Lang, key: string): boolean {
  return key in CATALOG[lang];
}

export function formatPct(lang: Lang, value: number): string {
  // Isolate so the % sign stays on the correct side inside RTL text.
  return `⁨${formatNumber(lang, Math.round(value))}%⁩`;
}

export function formatDate(
  lang: Lang,
  timestamp: number | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    const text = new Intl.DateTimeFormat(LANG_INFO[lang].locale, options).format(date);
    return formatNumber(lang, text);
  } catch {
    return formatNumber(lang, date.toLocaleDateString());
  }
}

export function formatDuration(lang: Lang, ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return formatNumber(lang, `${minutes}:${seconds}`);
}

/** Picks the best string from a partially translated object ({ar, en?, fr?}). */
export function pickLocalized(
  lang: Lang,
  value: Partial<Record<Lang, string>> | null | undefined
): string {
  if (!value) return "";
  return value[lang] || value.ar || value.en || value.fr || "";
}
