import { Building2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AdminSchoolRow, SchoolStatus } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { DATE_ONLY } from "../staff/shared/dates";
import { ErrorNotice } from "../staff/shared/ErrorNotice";
import { PLAN_KEYS, SCHOOL_STATUS_KEYS, SCHOOL_STATUS_TONES, SCHOOL_STATUSES } from "../staff/shared/labels";
import { LoadingBlock } from "../staff/shared/Spinner";
import { useApiGet } from "../staff/shared/useApiGet";
import { CreateSchoolDialog } from "./CreateSchoolDialog";

export function SchoolsPage() {
  const { t, pick, num, date } = useI18n();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApiGet<AdminSchoolRow[]>("/admin/schools");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SchoolStatus | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data ?? [])
      .filter((row) => !status || row.status === status)
      .filter(
        (row) =>
          !needle ||
          row.slug.includes(needle) ||
          [row.name.ar, row.name.en, row.name.fr].some((name) => name?.toLowerCase().includes(needle))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data, search, status]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("admin.schoolsTitle")}</h1>
          <p>{t("admin.schoolsIntro")}</p>
        </div>
        <button type="button" className="button button-primary" onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" />
          {t("admin.newSchool")}
        </button>
      </div>
      <div className="card stack">
        <label className="field staff-search">
          <span className="visually-hidden">{t("admin.searchSchools")}</span>
          <Search size={18} aria-hidden="true" />
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.searchSchools")}
          />
        </label>
        <div className="row" role="group" aria-label={t("staff.schoolStatus")}>
          <button type="button" className="chip" aria-pressed={status === null} onClick={() => setStatus(null)}>
            {t("staff.all")}
          </button>
          {SCHOOL_STATUSES.map((value) => (
            <button key={value} type="button" className="chip" aria-pressed={status === value} onClick={() => setStatus(value)}>
              {t(SCHOOL_STATUS_KEYS[value])}
            </button>
          ))}
        </div>
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && rows.length === 0 ? (
        <div className="empty">
          <Building2 size={32} aria-hidden="true" />
          <p>{data.length === 0 ? t("admin.schoolsEmpty") : t("staff.noMatches")}</p>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">{t("admin.schoolsTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("admin.school")}</th>
                <th scope="col">{t("staff.plan")}</th>
                <th scope="col">{t("staff.schoolStatus")}</th>
                <th scope="col">{t("admin.students")}</th>
                <th scope="col">{t("admin.exams30d")}</th>
                <th scope="col">{t("admin.leads30d")}</th>
                <th scope="col">{t("admin.staffCount")}</th>
                <th scope="col">{t("staff.paidUntil")}</th>
                <th scope="col">{t("staff.created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const overdue = row.paidUntil ? new Date(row.paidUntil).getTime() < Date.now() : false;
                return (
                  <tr key={row.id} className="clickable" onClick={() => navigate(`/admin/schools/${row.id}`)}>
                    <td>
                      <Link to={`/admin/schools/${row.id}`} className="strong staff-row-link" onClick={(event) => event.stopPropagation()}>
                        {pick(row.name)}
                      </Link>
                      <div className="small muted ltr">/{row.slug}</div>
                    </td>
                    <td>{t(PLAN_KEYS[row.plan])}</td>
                    <td>
                      <span className={`badge ${SCHOOL_STATUS_TONES[row.status]}`}>{t(SCHOOL_STATUS_KEYS[row.status])}</span>
                    </td>
                    <td className="nowrap">
                      {num(row.usage.students)}
                      {row.studentLimit !== null ? <span className="muted"> / {num(row.studentLimit)}</span> : null}
                      <div className="small muted">{t("admin.linkedCount", { count: num(row.usage.linkedStudents) })}</div>
                    </td>
                    <td>{num(row.usage.exams30d)}</td>
                    <td>{num(row.usage.leads30d)}</td>
                    <td>{num(row.usage.staff)}</td>
                    <td className={`nowrap${overdue ? " form-error" : ""}`}>{row.paidUntil ? date(row.paidUntil, DATE_ONLY) : "—"}</td>
                    <td className="nowrap">{date(row.createdAt, DATE_ONLY)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {creating ? (
        <CreateSchoolDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            reload();
            if (id) navigate(`/admin/schools/${id}`);
          }}
        />
      ) : null}
    </div>
  );
}

export default SchoolsPage;
