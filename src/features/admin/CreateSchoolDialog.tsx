import { useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { Plan, SchoolCreate, SchoolSettings, SchoolStatus } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { Dialog } from "../staff/shared/Dialog";
import { FormError } from "../staff/shared/ErrorNotice";
import { PLAN_KEYS, PLANS, SCHOOL_STATUS_KEYS, SCHOOL_STATUSES } from "../staff/shared/labels";

export function cleanSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .slice(0, 40);
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function CreateSchoolDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string | null) => void }) {
  const { t } = useI18n();
  const [slug, setSlug] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [plan, setPlan] = useState<Plan>("starter");
  const [status, setStatus] = useState<SchoolStatus>("trial");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const slugValid = SLUG_PATTERN.test(slug);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!slugValid) return;
    setBusy(true);
    setError(null);
    const body: SchoolCreate = {
      slug,
      name: {
        ar: nameAr.trim(),
        ...(nameEn.trim() ? { en: nameEn.trim() } : {}),
        ...(nameFr.trim() ? { fr: nameFr.trim() } : {})
      },
      plan,
      status,
      adminEmail: adminEmail.trim() || null,
      adminName: adminName.trim() || null
    };
    try {
      const created = await api<SchoolSettings>("/admin/schools", { body });
      onCreated(created?.id ?? null);
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Dialog title={t("admin.newSchool")} onClose={onClose} wide>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>{t("admin.slug")}</span>
          <input
            className="input ltr staff-mono"
            required
            value={slug}
            onChange={(event) => setSlug(cleanSlug(event.target.value))}
            placeholder="driving-school-beirut"
            aria-invalid={slug !== "" && !slugValid}
          />
          <span className="hint ltr">/s/{slug || "…"}</span>
          {slug !== "" && !slugValid ? <span className="hint form-error">{t("admin.slugInvalid")}</span> : null}
        </label>
        <div className="grid cols-3">
          <label className="field">
            <span>{t("staff.langArRequired")}</span>
            <input className="input" lang="ar" dir="rtl" required value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
          </label>
          <label className="field">
            <span>{t("staff.langEnOptional")}</span>
            <input className="input" lang="en" dir="ltr" value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
          </label>
          <label className="field">
            <span>{t("staff.langFrOptional")}</span>
            <input className="input" lang="fr" dir="ltr" value={nameFr} onChange={(event) => setNameFr(event.target.value)} />
          </label>
        </div>
        <div className="grid cols-2">
          <label className="field">
            <span>{t("staff.plan")}</span>
            <select className="select" value={plan} onChange={(event) => setPlan(event.target.value as Plan)}>
              {PLANS.map((item) => (
                <option key={item} value={item}>
                  {t(PLAN_KEYS[item])}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("staff.schoolStatus")}</span>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value as SchoolStatus)}>
              {SCHOOL_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(SCHOOL_STATUS_KEYS[item])}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("admin.adminEmail")}</span>
            <input className="input ltr" type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>{t("admin.adminName")}</span>
            <input className="input" value={adminName} onChange={(event) => setAdminName(event.target.value)} />
          </label>
        </div>
        <p className="small muted">{t("admin.adminHint")}</p>
        <FormError error={error} />
        <div className="row end">
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t("staff.cancel")}
          </button>
          <button type="submit" className="button button-primary" disabled={busy || !slugValid || !nameAr.trim()}>
            {busy ? t("staff.working") : t("admin.createSchool")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
