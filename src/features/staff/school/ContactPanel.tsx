import type { SchoolContact } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import type { DraftPatch, SchoolDraft } from "./draft";

const FIELDS: { key: keyof SchoolContact; label: string; type: string; hint?: string; placeholder?: string }[] = [
  { key: "phone", label: "staff.contactPhone", type: "tel", placeholder: "01 234 567" },
  { key: "whatsapp", label: "staff.contactWhatsapp", type: "tel", hint: "staff.whatsappHint", placeholder: "9613123456" },
  { key: "email", label: "staff.contactEmail", type: "email" },
  { key: "address", label: "staff.contactAddress", type: "text" },
  { key: "mapUrl", label: "staff.contactMap", type: "url", placeholder: "https://maps.google.com/..." },
  { key: "website", label: "staff.contactWebsite", type: "url", placeholder: "https://" },
  { key: "instagram", label: "staff.contactInstagram", type: "text", placeholder: "@school" },
  { key: "tiktok", label: "staff.contactTiktok", type: "text", placeholder: "@school" },
  { key: "facebook", label: "staff.contactFacebook", type: "text", placeholder: "https://facebook.com/..." }
];

export function ContactPanel({ draft, patch }: { draft: SchoolDraft; patch: (update: DraftPatch) => void }) {
  const { t } = useI18n();
  return (
    <section className="card stack">
      <h2 className="card-title">{t("staff.contactTitle")}</h2>
      <div className="grid cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="field">
            <span>{t(field.label)}</span>
            <input
              className={`input${field.key === "address" ? "" : " ltr"}`}
              type={field.type}
              value={draft.contact[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) =>
                patch((current) => ({ ...current, contact: { ...current.contact, [field.key]: event.target.value } }))
              }
            />
            {field.hint ? <span className="hint">{t(field.hint)}</span> : null}
          </label>
        ))}
      </div>
    </section>
  );
}
