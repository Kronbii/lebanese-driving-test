import { useState } from "react";
import type { SchoolBranding } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import type { DraftPatch, DraftProblem, SchoolDraft } from "./draft";
import { textOn } from "./draft";
import { LocalizedFields } from "./LocalizedFields";

interface PanelProps {
  draft: SchoolDraft;
  patch: (update: DraftPatch) => void;
  problems: DraftProblem[];
}

export function ProfilePanel({ draft, patch, problems }: PanelProps) {
  const { t, pick } = useI18n();
  const [logoFailed, setLogoFailed] = useState(false);
  const setBranding = (next: Partial<SchoolBranding>) =>
    patch((current) => ({ ...current, branding: { ...current.branding, ...next } }));
  const { primaryColor, accentColor, logoUrl } = draft.branding;

  return (
    <div className="stack">
      <section className="card stack">
        <LocalizedFields
          label={t("staff.schoolName")}
          value={draft.name}
          onChange={(name) => patch((current) => ({ ...current, name }))}
          invalidAr={problems.includes("nameAr")}
        />
      </section>
      <section className="card stack">
        <h2 className="card-title">{t("staff.branding")}</h2>
        <div className="grid cols-2">
          <div className="stack">
            <label className="field">
              <span>{t("staff.logoUrl")}</span>
              <input
                className="input ltr"
                type="url"
                inputMode="url"
                value={logoUrl ?? ""}
                onChange={(event) => {
                  setLogoFailed(false);
                  setBranding({ logoUrl: event.target.value });
                }}
                placeholder="https://"
              />
              <span className="hint">{t("staff.logoHint")}</span>
            </label>
            <div className="grid cols-2">
              <ColorField label={t("staff.primaryColor")} value={primaryColor} onChange={(value) => setBranding({ primaryColor: value })} />
              <ColorField label={t("staff.accentColor")} value={accentColor} onChange={(value) => setBranding({ accentColor: value })} />
            </div>
            {problems.includes("color") ? <p className="form-error">{t("staff.invalidColor")}</p> : null}
          </div>
          <div className="stack tight">
            <span className="stat-label">{t("staff.preview")}</span>
            <div className="staff-brand-preview" aria-label={t("staff.preview")}>
              <div className="staff-brand-preview-head" style={{ background: primaryColor, color: textOn(primaryColor) }}>
                {logoUrl && !logoFailed ? (
                  <img src={logoUrl} alt="" onError={() => setLogoFailed(true)} />
                ) : (
                  <span className="staff-brand-preview-dot" style={{ background: accentColor }} />
                )}
                <strong>{pick(draft.name) || t("staff.schoolName")}</strong>
              </div>
              <div className="staff-brand-preview-body">
                <p className="strong">{pick(draft.landing.headline) || t("staff.previewHeadline")}</p>
                <div className="row">
                  <span className="staff-brand-preview-button" style={{ background: primaryColor, color: textOn(primaryColor) }}>
                    {t("staff.previewPrimary")}
                  </span>
                  <span className="staff-brand-preview-button" style={{ background: accentColor, color: textOn(accentColor) }}>
                    {t("staff.previewAccent")}
                  </span>
                </div>
              </div>
            </div>
            {logoUrl && logoFailed ? <p className="small form-error">{t("staff.logoFailed")}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="field">
      <span>{label}</span>
      <div className="staff-color">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
        <input
          className="input ltr staff-mono"
          value={value}
          onChange={(event) => onChange(event.target.value.trim())}
          maxLength={7}
          aria-label={`${label} (hex)`}
          aria-invalid={!valid}
        />
      </div>
    </div>
  );
}
