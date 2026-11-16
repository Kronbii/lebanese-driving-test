import { AlertTriangle, BarChart3, Flag, Target, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { StaffOverview } from "../../../api/types";
import { TOPICS_BY_ID } from "../../../data/topics";
import { useI18n } from "../../../i18n/useI18n";
import { DailyBars } from "../shared/DailyBars";
import { meterTone, STATUS_KEYS, STUDENT_STATUSES } from "../shared/labels";
import { QuestionSnippet } from "../shared/QuestionPrompt";

interface SectionProps {
  overview: StaffOverview;
}

export function KpiGrid({ overview }: SectionProps) {
  const { t, num, pct } = useI18n();
  const total = STUDENT_STATUSES.reduce((sum, status) => sum + (overview.counts[status] ?? 0), 0);
  const kpis: { label: string; value: string; tone?: string; to?: string }[] = [
    { label: t("staff.kpiStudents"), value: num(total), to: "/staff/students" },
    { label: t("staff.kpiLinked"), value: num(overview.linkedStudents) },
    { label: t("staff.kpiReady"), value: num(overview.ready), tone: "success" },
    { label: t("staff.kpiAtRisk"), value: num(overview.atRisk), tone: overview.atRisk > 0 ? "danger" : undefined },
    { label: t("staff.kpiInactive"), value: num(overview.inactive7d), tone: overview.inactive7d > 0 ? "warning" : undefined },
    { label: t("staff.kpiAvgScore"), value: overview.avgScorePct === null ? "—" : pct(overview.avgScorePct) }
  ];
  return (
    <section className="stack" aria-label={t("staff.kpiSection")}>
      <div className="grid cols-3 staff-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`card stat staff-kpi ${kpi.tone ?? ""}`}>
            <span className="stat-label">{kpi.label}</span>
            <span className="stat-value">{kpi.value}</span>
          </div>
        ))}
      </div>
      <div className="row" aria-label={t("staff.countsByStatus")}>
        {STUDENT_STATUSES.map((status) => (
          <Link key={status} className="chip" to={`/staff/students?status=${status}`}>
            {t(STATUS_KEYS[status])}
            <span className="strong">{num(overview.counts[status] ?? 0)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function WeakTopics({ overview }: SectionProps) {
  const { t, pick, pct, num } = useI18n();
  const rows = [...overview.weakTopics].sort((a, b) => a.accuracy - b.accuracy).slice(0, 8);
  return (
    <section className="card">
      <h2 className="card-title">
        <Target size={18} aria-hidden="true" />
        {t("staff.weakTopics")}
      </h2>
      {rows.length === 0 ? (
        <p className="empty">{t("staff.noData")}</p>
      ) : (
        <div className="bars">
          {rows.map((row) => (
            <div key={row.topic} className="bar-row">
              <span>
                {pick(TOPICS_BY_ID.get(row.topic)?.label) || row.topic}
                <span className="muted small"> · {t("staff.studentsCount", { count: num(row.students) })}</span>
              </span>
              <span className="strong">{pct(row.accuracy)}</span>
              <div className={`meter ${meterTone(row.accuracy)}`} aria-hidden="true">
                <span style={{ inlineSize: `${Math.max(2, Math.min(100, row.accuracy))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TopWrongList({ overview }: SectionProps) {
  const { t, pct, num } = useI18n();
  const rows = overview.topWrong.slice(0, 10);
  return (
    <section className="card">
      <h2 className="card-title">
        <TrendingDown size={18} aria-hidden="true" />
        {t("staff.topWrong")}
      </h2>
      {rows.length === 0 ? (
        <p className="empty">{t("staff.noData")}</p>
      ) : (
        <ul className="list">
          {rows.map((row) => (
            <li key={row.questionId}>
              <Link className="list-row staff-qrow" to={`/staff/questions/${row.questionId}`}>
                <QuestionSnippet questionId={row.questionId} />
                <span className="stack tight staff-qrow-stat">
                  <span className="badge danger">{pct(row.wrongRate <= 1 ? row.wrongRate * 100 : row.wrongRate)}</span>
                  <span className="small muted nowrap">
                    {t("staff.wrongOf", { wrong: num(row.wrong), total: num(row.attempts) })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function UsageCard({ overview }: SectionProps) {
  const { t } = useI18n();
  const usage = overview.usage;
  return (
    <section className="card">
      <h2 className="card-title">
        <BarChart3 size={18} aria-hidden="true" />
        {t("staff.usage30")}
      </h2>
      <DailyBars
        title={t("staff.usage30")}
        days={usage.map((day) => day.day)}
        series={[
          { key: "visits", label: t("staff.metricVisits"), values: usage.map((day) => day.visits) },
          { key: "exams", label: t("staff.metricExams"), values: usage.map((day) => day.exams) },
          { key: "passes", label: t("staff.metricPasses"), values: usage.map((day) => day.passes) },
          { key: "leads", label: t("staff.metricLeads"), values: usage.map((day) => day.leads) },
          { key: "qrScans", label: t("staff.metricQrScans"), values: usage.map((day) => day.qrScans) }
        ]}
      />
    </section>
  );
}

interface BreakdownRow {
  key: string;
  name: string;
  students: number;
  ready: number;
}

export function Breakdown({ title, nameLabel, rows }: { title: string; nameLabel: string; rows: BreakdownRow[] }) {
  const { t, num, pct } = useI18n();
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="empty">{t("staff.noData")}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{nameLabel}</th>
                <th scope="col">{t("staff.kpiStudents")}</th>
                <th scope="col">{t("staff.kpiReady")}</th>
                <th scope="col">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.name || t("staff.unassigned")}</td>
                  <td>{num(row.students)}</td>
                  <td>{num(row.ready)}</td>
                  <td>{row.students > 0 ? pct((row.ready / row.students) * 100) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function FlaggedList({ overview }: SectionProps) {
  const { t, num } = useI18n();
  return (
    <section className="card">
      <h2 className="card-title">
        <Flag size={18} aria-hidden="true" />
        {t("staff.flaggedQuestions")}
      </h2>
      {overview.flagged.length === 0 ? (
        <p className="empty">
          <AlertTriangle size={24} aria-hidden="true" />
          {t("staff.flaggedEmpty")}
        </p>
      ) : (
        <ul className="list">
          {overview.flagged.map((row) => (
            <li key={row.questionId}>
              <Link className="list-row staff-qrow" to={`/staff/questions/${row.questionId}`}>
                <QuestionSnippet questionId={row.questionId} />
                <span className="badge warning nowrap">{t("staff.flagCount", { count: num(row.count) })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
