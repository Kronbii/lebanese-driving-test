import type { AuditEntry } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { DATE_TIME } from "./dates";

function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const text = JSON.stringify(meta);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

export function AuditTable({ entries, showSchool }: { entries: AuditEntry[]; showSchool?: boolean }) {
  const { t, date } = useI18n();
  if (entries.length === 0) return <p className="empty">{t("staff.auditEmpty")}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{t("staff.auditWhen")}</th>
            <th scope="col">{t("staff.auditActor")}</th>
            <th scope="col">{t("staff.auditAction")}</th>
            <th scope="col">{t("staff.auditTarget")}</th>
            {showSchool ? <th scope="col">{t("staff.auditSchool")}</th> : null}
            <th scope="col">{t("staff.auditDetails")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="nowrap">{date(entry.at, DATE_TIME)}</td>
              <td className="ltr">{entry.actorEmail ?? "—"}</td>
              <td className="ltr staff-mono">{entry.action}</td>
              <td className="ltr">{entry.target ?? "—"}</td>
              {showSchool ? <td className="ltr">{entry.schoolId ?? "—"}</td> : null}
              <td className="ltr small muted staff-meta">{metaSummary(entry.meta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
