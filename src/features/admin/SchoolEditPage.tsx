import { ArrowLeft, BadgeCheck, ExternalLink, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { AdminSchoolRow, AdminSchoolUpdate, FeatureFlags, Plan, SchoolStatus } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { toDateInput } from "../staff/shared/dates";
import { ErrorNotice, FormError } from "../staff/shared/ErrorNotice";
import { PLAN_KEYS, PLANS, SCHOOL_STATUS_KEYS, SCHOOL_STATUSES } from "../staff/shared/labels";
import { LoadingBlock } from "../staff/shared/Spinner";
import { useApiGet } from "../staff/shared/useApiGet";
import { cleanSlug, SLUG_PATTERN } from "./CreateSchoolDialog";
import { DeleteSchoolCard } from "./DeleteSchoolCard";
import { FeatureOverrides } from "./FeatureOverrides";

export function SchoolEditPage() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const { data, error, loading, reload, setData } = useApiGet<AdminSchoolRow[]>("/admin/schools");
  const school = data?.find((row) => row.id === id) ?? null;

  return (
    <div className="page">
      <Link to="/admin" className="staff-back">
        <ArrowLeft size={16} aria-hidden="true" className="staff-flip" />
        {t("admin.backToSchools")}
      </Link>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && !school ? <p className="notice danger">{t("staff.err_not_found")}</p> : null}
      {school ? (
        <SchoolEditor
          key={school.id}
          school={school}
          onSaved={(updated) =>
            setData((current) => (current ? current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)) : current))
          }
        />
      ) : null}
    </div>
  );
}

function SchoolEditor({ school, onSaved }: { school: AdminSchoolRow; onSaved: (school: AdminSchoolRow) => void }) {
  const { t, pick, num, pct } = useI18n();
  const [slug, setSlug] = useState(school.slug);
  const [plan, setPlan] = useState<Plan>(school.plan);
  const [status, setStatus] = useState<SchoolStatus>(school.status);
  const [studentLimit, setStudentLimit] = useState(school.studentLimit === null ? "" : String(school.studentLimit));
  const [customDomain, setCustomDomain] = useState(school.customDomain ?? "");
  const [paidUntil, setPaidUntil] = useState(toDateInput(school.paidUntil));
  const [billingNote, setBillingNote] = useState(school.billingNote ?? "");
  const [overrides, setOverrides] = useState<Partial<FeatureFlags>>(school.featureOverrides ?? {});
  const [verified, setVerified] = useState(school.landing?.passRate?.verified ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const slugValid = SLUG_PATTERN.test(slug);
  const passRate = school.landing?.passRate ?? null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!slugValid) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const limit = Number.parseInt(studentLimit, 10);
    const body: AdminSchoolUpdate = {
      slug,
      plan,
      status,
      studentLimit: Number.isFinite(limit) && limit > 0 ? limit : null,
      customDomain: customDomain.trim().toLowerCase() || null,
      paidUntil: paidUntil || null,
      billingNote: billingNote.trim() || null,
      featureOverrides: overrides
    };
    if (passRate && verified !== passRate.verified) {
      body.landing = { ...school.landing, passRate: { ...passRate, verified } };
    }
    try {
      const updated = await api<AdminSchoolRow>(`/admin/schools/${school.id}`, { method: "PATCH", body });
      setSaved(true);
      onSaved({ ...school, ...(updated ?? {}), usage: updated?.usage ?? school.usage });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="staff-title">{pick(school.name)}</h1>
          <p className="ltr">/s/{school.slug}</p>
        </div>
        <a className="button button-ghost" href={`/s/${school.slug}`} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          {t("admin.openPublicPage")}
        </a>
      </div>

      <div className="grid cols-4">
        {[
          { label: t("admin.students"), value: num(school.usage.students) },
          { label: t("admin.linked"), value: num(school.usage.linkedStudents) },
          { label: t("admin.exams30d"), value: num(school.usage.exams30d) },
          { label: t("admin.leads30d"), value: num(school.usage.leads30d) }
        ].map((stat) => (
          <div key={stat.label} className="card stat">
            <span className="stat-label">{stat.label}</span>
            <span className="stat-value">{stat.value}</span>
          </div>
        ))}
      </div>

      <form className="stack" onSubmit={submit}>
        <section className="card stack">
          <h2 className="card-title">{t("admin.subscription")}</h2>
          <div className="grid cols-3">
            <label className="field">
              <span>{t("admin.slug")}</span>
              <input
                className="input ltr staff-mono"
                value={slug}
                onChange={(event) => setSlug(cleanSlug(event.target.value))}
                aria-invalid={!slugValid}
              />
              {!slugValid ? <span className="hint form-error">{t("admin.slugInvalid")}</span> : null}
              {slug !== school.slug ? <span className="hint">{t("admin.slugChangeWarning")}</span> : null}
            </label>
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
              <span>{t("staff.studentLimit")}</span>
              <input
                className="input"
                type="number"
                min={1}
                inputMode="numeric"
                value={studentLimit}
                onChange={(event) => setStudentLimit(event.target.value)}
                placeholder={t("staff.unlimited")}
              />
            </label>
            <label className="field">
              <span>{t("staff.paidUntil")}</span>
              <input className="input" type="date" value={paidUntil} onChange={(event) => setPaidUntil(event.target.value)} />
            </label>
            <label className="field">
              <span>{t("staff.customDomain")}</span>
              <input
                className="input ltr"
                value={customDomain}
                onChange={(event) => setCustomDomain(event.target.value)}
                placeholder="learn.school.com"
              />
            </label>
          </div>
          <label className="field">
            <span>{t("admin.billingNote")}</span>
            <textarea className="textarea" value={billingNote} onChange={(event) => setBillingNote(event.target.value)} />
          </label>
        </section>

        <section className="card stack">
          <h2 className="card-title">{t("admin.features")}</h2>
          <FeatureOverrides plan={plan} value={overrides} onChange={setOverrides} />
        </section>

        <section className="card stack">
          <h2 className="card-title">
            <BadgeCheck size={18} aria-hidden="true" />
            {t("staff.passRate")}
          </h2>
          {passRate ? (
            <>
              <p>
                <span className="stat-value">{pct(passRate.value)}</span>
                {passRate.note ? <span className="muted"> — {passRate.note}</span> : null}
              </p>
              <label className="check">
                <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
                {t("admin.verifyPassRate")}
              </label>
              <p className="small muted">{t("admin.verifyHint")}</p>
            </>
          ) : (
            <p className="muted">{t("admin.noPassRate")}</p>
          )}
        </section>

        <div className="staff-savebar">
          <div className="grow stack tight">
            {saved ? (
              <span className="form-success" role="status">
                {t("staff.saved")}
              </span>
            ) : null}
            <FormError error={error} />
          </div>
          <button type="submit" className="button button-primary" disabled={busy || !slugValid}>
            <Save size={16} aria-hidden="true" />
            {busy ? t("staff.working") : t("staff.saveChanges")}
          </button>
        </div>
      </form>

      <DeleteSchoolCard school={school} />
    </>
  );
}

export default SchoolEditPage;
