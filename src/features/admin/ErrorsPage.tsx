import { Bug } from "lucide-react";
import type { ErrorReport } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { DATE_TIME } from "../staff/shared/dates";
import { ErrorNotice } from "../staff/shared/ErrorNotice";
import { LoadingBlock } from "../staff/shared/Spinner";
import { useApiGet } from "../staff/shared/useApiGet";

export function ErrorsPage() {
  const { t, num, date } = useI18n();
  const { data, error, loading, reload } = useApiGet<ErrorReport[]>("/admin/errors");
  const reports = [...(data ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("admin.errorsTitle")}</h1>
          <p>{t("admin.errorsIntro")}</p>
        </div>
        <button type="button" className="button button-ghost" onClick={reload}>
          {t("admin.refresh")}
        </button>
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && reports.length === 0 ? (
        <div className="empty">
          <Bug size={32} aria-hidden="true" />
          <p>{t("admin.errorsEmpty")}</p>
        </div>
      ) : null}
      <ul className="list">
        {reports.map((report) => (
          <li key={report.id} className="card stack admin-error">
            <div className="row between">
              <span className="strong ltr admin-error-message">{report.message}</span>
              <span className="badge danger">{t("admin.occurrences", { count: num(report.count) })}</span>
            </div>
            <div className="row small muted">
              <span>{date(report.at, DATE_TIME)}</span>
              {report.path ? <span className="ltr">{report.path}</span> : null}
              {report.release ? <span className="ltr">{report.release}</span> : null}
            </div>
            {report.stack ? (
              <details>
                <summary>{t("admin.stack")}</summary>
                <pre className="admin-stack ltr">{report.stack}</pre>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ErrorsPage;
