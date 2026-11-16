import { useSettings } from "../../../app/SettingsContext";
import { LANG_INFO } from "../../../i18n/core";
import { useI18n } from "../../../i18n/useI18n";
import type { Lang } from "../../../domain/types";

const OPTIONS: { code: Lang; short: string }[] = [
  { code: "ar", short: "ع" },
  { code: "en", short: "EN" },
  { code: "fr", short: "FR" }
];

/** Compact ar / EN / FR switcher for staff, admin and live layouts. */
export function LangSwitch() {
  const { t, lang } = useI18n();
  const { update } = useSettings();
  return (
    <div className="staff-lang" role="group" aria-label={t("staff.language")}>
      {OPTIONS.map((option) => (
        <button
          key={option.code}
          type="button"
          lang={option.code}
          title={LANG_INFO[option.code].label}
          aria-label={LANG_INFO[option.code].label}
          aria-pressed={lang === option.code}
          onClick={() => update({ lang: option.code })}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
