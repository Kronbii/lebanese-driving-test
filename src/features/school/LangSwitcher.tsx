import { useSettings } from "../../app/SettingsContext";
import { isLang, LANGS } from "../../i18n/core";
import { useI18n } from "../../i18n/useI18n";

/** Language picker for the public school pages (landing, privacy). */
export function LangSwitcher() {
  const { t, lang } = useI18n();
  const { update } = useSettings();
  return (
    <label className="school-lang">
      <span className="visually-hidden">{t("school.language")}</span>
      <select
        className="select"
        value={lang}
        onChange={(event) => {
          if (isLang(event.target.value)) update({ lang: event.target.value });
        }}
      >
        {LANGS.map((info) => (
          <option key={info.code} value={info.code}>
            {info.label}
          </option>
        ))}
      </select>
    </label>
  );
}
