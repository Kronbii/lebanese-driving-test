import { useMemo, useState } from "react";
import type { AuditEntry } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { AuditTable } from "../staff/shared/AuditTable";
import { ErrorNotice } from "../staff/shared/ErrorNotice";
import { LoadingBlock } from "../staff/shared/Spinner";
import { useApiGet } from "../staff/shared/useApiGet";

export function AuditPage() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useApiGet<AuditEntry[]>("/admin/audit-log");
  const [filter, setFilter] = useState("");
  const entries = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!data) return [];
    if (!needle) return data;
    return data.filter((entry) =>
      [entry.action, entry.actorEmail, entry.target, entry.schoolId].some((value) => value?.toLowerCase().includes(needle))
    );
  }, [data, filter]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("admin.auditTitle")}</h1>
          <p>{t("admin.auditIntro")}</p>
        </div>
        <label className="field">
          <span className="visually-hidden">{t("admin.filter")}</span>
          <input
            className="input"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t("admin.filter")}
          />
        </label>
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data ? <AuditTable entries={entries} showSchool /> : null}
    </div>
  );
}

export default AuditPage;
