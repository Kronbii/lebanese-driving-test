import { Download, FileJson, Info } from "lucide-react";
import { useState } from "react";
import { downloadFrom } from "../../../api/client";
import type { AuditEntry, SchoolSettings } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { AuditTable } from "../shared/AuditTable";
import { DATE_ONLY } from "../shared/dates";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { FEATURE_FLAGS, FEATURE_KEYS, PLAN_KEYS, SCHOOL_STATUS_KEYS, SCHOOL_STATUS_TONES } from "../shared/labels";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";

export function PlanPanel({ school }: { school: SchoolSettings }) {
  const { t, date, num } = useI18n();
  const expired = school.paidUntil ? new Date(school.paidUntil).getTime() < Date.now() : false;
  return (
    <section className="card stack">
      <h2 className="card-title">{t("staff.planTitle")}</h2>
      <div className="grid cols-4">
        <div className="stat">
          <span className="stat-label">{t("staff.plan")}</span>
          <span className="staff-stat-small">{t(PLAN_KEYS[school.plan])}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t("staff.schoolStatus")}</span>
          <span>
            <span className={`badge ${SCHOOL_STATUS_TONES[school.status]}`}>{t(SCHOOL_STATUS_KEYS[school.status])}</span>
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">{t("staff.paidUntil")}</span>
          <span className={`staff-stat-small${expired ? " form-error" : ""}`}>
            {school.paidUntil ? date(school.paidUntil, DATE_ONLY) : "—"}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">{t("staff.studentLimit")}</span>
          <span className="staff-stat-small">{school.studentLimit === null ? t("staff.unlimited") : num(school.studentLimit)}</span>
        </div>
      </div>
      <div className="row">
        {FEATURE_FLAGS.map((flag) => (
          <span key={flag} className={`badge ${school.features[flag] ? "success" : ""}`}>
            {school.features[flag] ? "✓" : "—"} {t(FEATURE_KEYS[flag])}
          </span>
        ))}
      </div>
      {school.customDomain ? (
        <p className="small">
          {t("staff.customDomain")}: <span className="ltr">{school.customDomain}</span>
        </p>
      ) : null}
      <p className="notice">
        <Info size={18} aria-hidden="true" />
        <span>{t("staff.planContact")}</span>
      </p>
    </section>
  );
}

export function ExportPanel({ school }: { school: SchoolSettings }) {
  const { t } = useI18n();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const stamp = new Date().toISOString().slice(0, 10);

  const run = async (key: string, path: string, filename: string) => {
    setBusy(key);
    setError(null);
    try {
      await downloadFrom(path, filename);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card stack">
      <h2 className="card-title">{t("staff.dataTitle")}</h2>
      <p className="small muted">{t("staff.dataIntro")}</p>
      <div className="row">
        <button
          type="button"
          className="button button-ghost"
          disabled={busy !== null}
          onClick={() => run("json", "/staff/export", `${school.slug}-export-${stamp}.json`)}
        >
          <FileJson size={16} aria-hidden="true" />
          {busy === "json" ? t("staff.working") : t("staff.exportJson")}
        </button>
        <button
          type="button"
          className="button button-ghost"
          disabled={busy !== null}
          onClick={() => run("csv", "/staff/export/students.csv", `${school.slug}-students-${stamp}.csv`)}
        >
          <Download size={16} aria-hidden="true" />
          {busy === "csv" ? t("staff.working") : t("staff.exportCsvStudents")}
        </button>
      </div>
      <FormError error={error} />
    </section>
  );
}

export function AuditPanel() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useApiGet<AuditEntry[]>("/staff/audit-log");
  return (
    <section className="card stack">
      <h2 className="card-title">{t("staff.auditTitle")}</h2>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data ? <AuditTable entries={data} /> : null}
    </section>
  );
}
