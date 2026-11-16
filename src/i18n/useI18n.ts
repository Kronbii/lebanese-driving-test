import { useCallback, useMemo } from "react";
import { useSettings } from "../app/SettingsContext";
import {
  formatDate,
  formatDuration,
  formatNumber,
  formatPct,
  LANG_INFO,
  pickLocalized,
  translate,
  type Vars
} from "./core";
import type { Lang } from "../domain/types";

export interface I18n {
  lang: Lang;
  dir: "rtl" | "ltr";
  locale: string;
  /** Looks up "namespace.key" with optional { vars }. */
  t: (key: string, vars?: Vars) => string;
  num: (value: number | string) => string;
  pct: (value: number) => string;
  date: (timestamp: number | string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  duration: (ms: number) => string;
  pick: (value: Partial<Record<Lang, string>> | null | undefined) => string;
}

export function makeI18n(lang: Lang): I18n {
  return {
    lang,
    dir: LANG_INFO[lang].dir,
    locale: LANG_INFO[lang].locale,
    t: (key, vars) => translate(lang, key, vars),
    num: (value) => formatNumber(lang, value),
    pct: (value) => formatPct(lang, value),
    date: (timestamp, options) => formatDate(lang, timestamp, options),
    duration: (ms) => formatDuration(lang, ms),
    pick: (value) => pickLocalized(lang, value)
  };
}

export function useI18n(): I18n {
  const { settings, contentReady } = useSettings();
  const lang = settings.lang;
  const build = useCallback(() => makeI18n(lang), [lang]);
  // contentReady is a dependency so components re-render when explanations arrive.
  return useMemo(build, [build, contentReady]);
}
