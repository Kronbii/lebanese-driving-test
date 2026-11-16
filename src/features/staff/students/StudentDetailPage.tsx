import { ArrowLeft, History, TrendingDown } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { StaffStudentDetail } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { asDisplayDate, DATE_ONLY, DATE_TIME } from "../shared/dates";
import { ErrorNotice } from "../shared/ErrorNotice";
import { PACKAGE_KEYS } from "../shared/labels";
import { QuestionSnippet } from "../shared/QuestionPrompt";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";
import { StudentActions } from "./StudentActions";
import { StatusBadge } from "./StudentBadges";
import { StudentEditForm } from "./StudentEditForm";
import { StudentMetricsCard } from "./StudentMetricsCard";

export function StudentDetailPage() {
  const { id = "" } = useParams();
  const { t, date } = useI18n();
  const { branchName, userName } = useStaff();
  const { data: student, error, loading, reload, setData } = useApiGet<StaffStudentDetail>(
    `/staff/students/${encodeURIComponent(id)}`
  );

  return (
    <div className="page">
      <Link to="/staff/students" className="staff-back">
        <ArrowLeft size={16} aria-hidden="true" className="staff-flip" />
        {t("staff.backToStudents")}
      </Link>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !student ? <LoadingBlock /> : null}
      {student ? (
        <>
          <div className="page-header">
            <div>
              <h1 className="staff-title">{student.displayName}</h1>
              <div className="row small muted">
                <StatusBadge status={student.status} />
                {student.package ? <span>{t(PACKAGE_KEYS[student.package])}</span> : null}
                {student.phone ? <span className="ltr">{student.phone}</span> : null}
                <span>
                  {t("staff.branch")}: {branchName(student.branchId) ?? "—"}
                </span>
                <span>
                  {t("staff.instructor")}: {userName(student.instructorId) ?? "—"}
                </span>
                {student.examDate ? (
                  <span>
                    {t("staff.examDate")}: {date(asDisplayDate(student.examDate), DATE_ONLY)}
                  </span>
                ) : null}
                <span>
                  {t("staff.created")}: {date(student.createdAt, DATE_ONLY)}
                </span>
              </div>
            </div>
          </div>

          <div className="staff-detail-grid">
            <div className="stack">
              <StudentMetricsCard student={student} />
              <HistoryCard student={student} />
              <TopWrongCard student={student} />
            </div>
            <div className="stack">
              <StudentActions student={student} />
              <StudentEditForm
                key={student.id}
                student={student}
                onSaved={(updated) => setData((current) => (current ? { ...current, ...updated } : current))}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function HistoryCard({ student }: { student: StaffStudentDetail }) {
  const { t, num, date } = useI18n();
  const history = [...student.history].sort((a, b) => b.at - a.at).slice(0, 30);
  return (
    <section className="card">
      <h2 className="card-title">
        <History size={18} aria-hidden="true" />
        {t("staff.examHistory")}
      </h2>
      {history.length === 0 ? (
        <p className="empty">{t("staff.examHistoryEmpty")}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t("staff.date")}</th>
                <th scope="col">{t("staff.score")}</th>
                <th scope="col">{t("staff.result")}</th>
                <th scope="col">{t("staff.mode")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={`${item.at}-${index}`}>
                  <td className="nowrap">{date(item.at, DATE_TIME)}</td>
                  <td className="nowrap">
                    {num(item.score)} / {num(item.total)}
                  </td>
                  <td>
                    <span className={`badge ${item.passed ? "success" : "danger"}`}>
                      {item.passed ? t("staff.passed") : t("staff.failed")}
                    </span>
                  </td>
                  <td className="small muted">{item.mode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TopWrongCard({ student }: { student: StaffStudentDetail }) {
  const { t, num } = useI18n();
  return (
    <section className="card">
      <h2 className="card-title">
        <TrendingDown size={18} aria-hidden="true" />
        {t("staff.topWrong")}
      </h2>
      {student.topWrong.length === 0 ? (
        <p className="empty">{t("staff.noData")}</p>
      ) : (
        <ul className="list">
          {student.topWrong.map((row) => (
            <li key={row.questionId}>
              <Link className="list-row staff-qrow" to={`/staff/questions/${row.questionId}`}>
                <QuestionSnippet questionId={row.questionId} />
                <span className="small muted nowrap">
                  {t("staff.wrongOf", { wrong: num(row.wrong), total: num(row.seen) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default StudentDetailPage;
