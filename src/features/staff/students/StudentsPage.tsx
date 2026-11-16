import { Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { StaffStudent, StudentStatus } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { asDisplayDate, DATE_ONLY } from "../shared/dates";
import { ErrorNotice } from "../shared/ErrorNotice";
import { STATUS_KEYS, STUDENT_STATUSES } from "../shared/labels";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";
import { AddStudentDialog } from "./AddStudentDialog";
import { ReadinessBadge, StatusBadge } from "./StudentBadges";

function isStatus(value: string | null): value is StudentStatus {
  return value !== null && (STUDENT_STATUSES as string[]).includes(value);
}

export function StudentsPage() {
  const { t, num, pct, date } = useI18n();
  const { user, branches, branchName } = useStaff();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const status = isStatus(statusParam) ? statusParam : null;
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [mine, setMine] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useApiGet<StaffStudent[]>("/staff/students");

  const students = useMemo(() => {
    const query = search.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return (data ?? [])
      .filter((student) => (status ? student.status === status : student.status !== "lead"))
      .filter((student) => !branchId || student.branchId === branchId)
      .filter((student) => !mine || student.instructorId === user.id)
      .filter((student) => {
        if (!query) return true;
        if (student.displayName.toLowerCase().includes(query)) return true;
        return Boolean(digits && student.phone?.replace(/\D/g, "").includes(digits));
      })
      .sort((a, b) => (b.lastActiveAt ?? b.createdAt).localeCompare(a.lastActiveAt ?? a.createdAt));
  }, [data, status, branchId, mine, search, user.id]);

  const setStatus = (next: StudentStatus | null) => {
    const copy = new URLSearchParams(params);
    if (next) copy.set("status", next);
    else copy.delete("status");
    setParams(copy, { replace: true });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.studentsTitle")}</h1>
          <p>{t("staff.studentsIntro")}</p>
        </div>
        <button type="button" className="button button-primary" onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden="true" />
          {t("staff.addStudent")}
        </button>
      </div>

      <div className="card stack">
        <div className="row">
          <label className="field grow staff-search">
            <span className="visually-hidden">{t("staff.searchStudents")}</span>
            <Search size={18} aria-hidden="true" />
            <input
              className="input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("staff.searchStudents")}
            />
          </label>
          {branches.length > 0 ? (
            <label className="field">
              <span className="visually-hidden">{t("staff.branch")}</span>
              <select className="select" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">{t("staff.allBranches")}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="check">
            <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} />
            {t("staff.mineOnly")}
          </label>
        </div>
        <div className="tabs" role="group" aria-label={t("staff.status")}>
          <button type="button" className="chip" aria-pressed={status === null} onClick={() => setStatus(null)}>
            {t("staff.allActive")}
          </button>
          {STUDENT_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {t(STATUS_KEYS[value])}
              {data ? <span>{num(data.filter((student) => student.status === value).length)}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && students.length === 0 ? (
        <div className="empty">
          <Users size={32} aria-hidden="true" />
          <p>{data.length === 0 ? t("staff.studentsEmpty") : t("staff.noMatches")}</p>
        </div>
      ) : null}
      {students.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">{t("staff.studentsTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("staff.name")}</th>
                <th scope="col">{t("staff.status")}</th>
                <th scope="col">{t("staff.readiness")}</th>
                <th scope="col">{t("staff.branch")}</th>
                <th scope="col">{t("staff.lastActive")}</th>
                <th scope="col">{t("staff.bestAvg")}</th>
                <th scope="col">{t("staff.examDate")}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="clickable" onClick={() => navigate(`/staff/students/${student.id}`)}>
                  <td>
                    <Link to={`/staff/students/${student.id}`} className="strong staff-row-link" onClick={(event) => event.stopPropagation()}>
                      {student.displayName}
                    </Link>
                    {student.phone ? <div className="small muted ltr">{student.phone}</div> : null}
                  </td>
                  <td>
                    <StatusBadge status={student.status} />
                    {student.linked ? <span className="badge info staff-linked">{t("staff.linked")}</span> : null}
                  </td>
                  <td>
                    <ReadinessBadge metrics={student.metrics} />
                  </td>
                  <td>{branchName(student.branchId) ?? "—"}</td>
                  <td className="nowrap">{student.lastActiveAt ? date(student.lastActiveAt, DATE_ONLY) : "—"}</td>
                  <td className="nowrap">
                    {student.metrics?.bestScorePct != null ? pct(student.metrics.bestScorePct) : "—"}
                    {" / "}
                    {student.metrics?.avgScorePct != null ? pct(student.metrics.avgScorePct) : "—"}
                  </td>
                  <td className="nowrap">{student.examDate ? date(asDisplayDate(student.examDate), DATE_ONLY) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {data ? <p className="small muted">{t("staff.showingCount", { shown: students.length, total: data.length })}</p> : null}

      {adding ? (
        <AddStudentDialog
          onClose={() => setAdding(false)}
          onCreated={(student) => {
            setAdding(false);
            reload();
            navigate(`/staff/students/${student.id}`);
          }}
        />
      ) : null}
    </div>
  );
}

export default StudentsPage;
