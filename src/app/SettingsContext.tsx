import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useContentReady } from "../data/content";
import { isLang, LANG_INFO } from "../i18n/core";
import type { BankId, Lang } from "../domain/types";

export type Theme = "system" | "light" | "dark";
export type QuestionLang = "official" | "en" | "fr";

export interface Settings {
  lang: Lang;
  /** Language questions are shown in. "official" = the Arabic wording of the exam. */
  questionLang: QuestionLang;
  /** Show the official Arabic under a translated question. */
  showOfficial: boolean;
  /** Language for explanations; "ui" follows the interface language. */
  explanationLang: Lang | "ui";
  theme: Theme;
  fontScale: number;
  highContrast: boolean;
  lowData: boolean;
  /** Read questions aloud automatically. */
  autoRead: boolean;
  timerMinutes: number;
  reminderTime: string;
  /** Active question bank (motorcycle; car once imported). */
  bank: BankId;
}

export const SETTINGS_KEY = "ldt_settings_v1";

export const DEFAULT_SETTINGS: Settings = {
  lang: "ar",
  questionLang: "official",
  showOfficial: true,
  explanationLang: "ui",
  theme: "system",
  fontScale: 1,
  highContrast: false,
  lowData: false,
  autoRead: false,
  timerMinutes: 30,
  reminderTime: "19:00",
  bank: "motorcycle"
};

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return detectDefaults();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      lang: isLang(parsed.lang) ? parsed.lang : DEFAULT_SETTINGS.lang
    };
  } catch {
    return detectDefaults();
  }
}

function detectDefaults(): Settings {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("lang");
  if (isLang(fromUrl)) return { ...DEFAULT_SETTINGS, lang: fromUrl };
  return DEFAULT_SETTINGS;
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  /** True once the lazily loaded study content (explanations, translations) is available. */
  contentReady: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // Re-renders every consumer when explanations/translations finish loading.
  const contentReady = useContentReady();

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Settings still apply for this visit.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.lang;
    root.dir = LANG_INFO[settings.lang].dir;
    root.style.setProperty("--font-scale", String(settings.fontScale));
    root.dataset.contrast = settings.highContrast ? "high" : "normal";
    if (settings.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.lang, settings.fontScale, settings.highContrast, settings.theme]);

  useEffect(() => {
    // Web font is optional: skipped in low-data mode.
    const id = "ldt-webfont";
    const existing = document.getElementById(id);
    if (settings.lowData) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap";
    document.head.appendChild(link);
  }, [settings.lowData]);

  const value = useMemo(() => ({ settings, update, contentReady }), [settings, update, contentReady]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
