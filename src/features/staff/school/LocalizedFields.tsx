import type { LocalizedText } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";

interface LocalizedFieldsProps {
  label: string;
  value: LocalizedText | null;
  onChange: (value: LocalizedText) => void;
  multiline?: boolean;
  invalidAr?: boolean;
}

const LANGS = [
  { code: "ar", key: "staff.langArRequired", dir: "rtl" },
  { code: "en", key: "staff.langEnOptional", dir: "ltr" },
  { code: "fr", key: "staff.langFrOptional", dir: "ltr" }
] as const;

/** Arabic (required) + English/French (optional) inputs for school-authored text. */
export function LocalizedFields({ label, value, onChange, multiline, invalidAr }: LocalizedFieldsProps) {
  const { t } = useI18n();
  const current: LocalizedText = value ?? { ar: "" };
  return (
    <fieldset className="staff-fieldset">
      <legend>{label}</legend>
      <div className={multiline ? "stack" : "grid cols-3"}>
        {LANGS.map((item) => {
          const text = current[item.code] ?? "";
          const update = (next: string) => onChange({ ...current, [item.code]: next });
          return (
            <label key={item.code} className="field">
              <span>{t(item.key)}</span>
              {multiline ? (
                <textarea
                  className="textarea"
                  lang={item.code}
                  dir={item.dir}
                  value={text}
                  onChange={(event) => update(event.target.value)}
                  aria-invalid={item.code === "ar" && invalidAr ? true : undefined}
                />
              ) : (
                <input
                  className="input"
                  lang={item.code}
                  dir={item.dir}
                  value={text}
                  onChange={(event) => update(event.target.value)}
                  aria-invalid={item.code === "ar" && invalidAr ? true : undefined}
                />
              )}
              {item.code === "ar" && invalidAr ? <span className="hint form-error">{t("staff.arabicRequired")}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
