import { BadgeCheck, Plus, Trash2 } from "lucide-react";
import type { SchoolLanding, Testimonial } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import type { DraftPatch, DraftProblem, SchoolDraft } from "./draft";
import { LocalizedFields } from "./LocalizedFields";

interface PanelProps {
  draft: SchoolDraft;
  patch: (update: DraftPatch) => void;
  problems: DraftProblem[];
}

export function LandingPanel({ draft, patch, problems }: PanelProps) {
  const { t } = useI18n();
  const landing = draft.landing;
  const setLanding = (next: Partial<SchoolLanding>) =>
    patch((current) => ({ ...current, landing: { ...current.landing, ...next } }));
  const setTestimonial = (index: number, next: Partial<Testimonial>) =>
    setLanding({ testimonials: landing.testimonials.map((item, i) => (i === index ? { ...item, ...next } : item)) });
  const pass = landing.passRate;

  return (
    <div className="stack">
      <section className="card stack">
        <h2 className="card-title">{t("staff.landingTitle")}</h2>
        <LocalizedFields
          label={t("staff.headline")}
          value={landing.headline}
          onChange={(headline) => setLanding({ headline })}
          invalidAr={problems.includes("headlineAr")}
        />
        <LocalizedFields
          label={t("staff.about")}
          value={landing.about}
          onChange={(about) => setLanding({ about })}
          multiline
          invalidAr={problems.includes("aboutAr")}
        />
        <label className="check">
          <input type="checkbox" checked={landing.showStats} onChange={(event) => setLanding({ showStats: event.target.checked })} />
          <span>
            {t("staff.showStats")}
            <span className="hint small muted"> — {t("staff.showStatsHint")}</span>
          </span>
        </label>
      </section>

      <section className="card stack">
        <h2 className="card-title">{t("staff.testimonials")}</h2>
        {landing.testimonials.length === 0 ? <p className="muted small">{t("staff.testimonialsEmpty")}</p> : null}
        {landing.testimonials.map((item, index) => (
          <div key={index} className="staff-testimonial">
            <div className="grow stack">
              <label className="field">
                <span>{t("staff.testimonialName")}</span>
                <input className="input" value={item.name} onChange={(event) => setTestimonial(index, { name: event.target.value })} />
              </label>
              <label className="field">
                <span>{t("staff.testimonialText")}</span>
                <textarea className="textarea" value={item.text} onChange={(event) => setTestimonial(index, { text: event.target.value })} />
              </label>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={t("staff.removeTestimonial")}
              title={t("staff.removeTestimonial")}
              onClick={() => setLanding({ testimonials: landing.testimonials.filter((_, i) => i !== index) })}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setLanding({ testimonials: [...landing.testimonials, { name: "", text: "" }] })}
            disabled={landing.testimonials.length >= 12}
          >
            <Plus size={16} aria-hidden="true" />
            {t("staff.addTestimonial")}
          </button>
        </div>
        <p className="small muted">{t("staff.testimonialsHint")}</p>
      </section>

      <section className="card stack">
        <h2 className="card-title">{t("staff.passRate")}</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={pass !== null}
            onChange={(event) =>
              setLanding({ passRate: event.target.checked ? { value: 90, verified: false } : null })
            }
          />
          {t("staff.showPassRate")}
        </label>
        {pass ? (
          <>
            <div className="grid cols-2">
              <label className="field">
                <span>{t("staff.passRateValue")}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={Number.isFinite(pass.value) ? pass.value : ""}
                  onChange={(event) =>
                    setLanding({ passRate: { ...pass, value: Number.parseFloat(event.target.value), verified: pass.verified } })
                  }
                  aria-invalid={problems.includes("passRate")}
                />
              </label>
              <label className="field">
                <span>{t("staff.passRateNote")}</span>
                <input
                  className="input"
                  value={pass.note ?? ""}
                  onChange={(event) => setLanding({ passRate: { ...pass, note: event.target.value } })}
                  placeholder={t("staff.passRateNoteHint")}
                />
              </label>
            </div>
            <p className={`notice ${pass.verified ? "success" : "warning"}`}>
              <BadgeCheck size={18} aria-hidden="true" />
              <span>{pass.verified ? t("staff.verified") : t("staff.notVerified")}</span>
            </p>
            {problems.includes("passRate") ? <p className="form-error">{t("staff.invalidPassRate")}</p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
