import { Gauge, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import type { StaffStudentDetail } from "../../../api/types";
import type { TopicId } from "../../../domain/types";
import { TOPICS, TOPICS_BY_ID } from "../../../data/topics";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { DATE_TIME } from "../shared/dates";
import { meterTone, READINESS_KEYS, READINESS_TONES } from "../shared/labels";

export function StudentMetricsCard({ student }: { student: StaffStudentDetail }) {
  const { t, num, pct, pick, date } = useI18n();
  const { hasFeature } = useStaff();
  const metrics = student.metrics;

  if (!student.linked || !metrics) {
    return (
      <section className="card stack">
        <h2 className="card-title">
          <Smartphone size={18} aria-hidden="true" />
          {t("staff.progress")}
        </h2>
        <p className="muted">{t("staff.notLinkedBody")}</p>
        {hasFeature("cloudStudents") ? (
          <Link className="button button-secondary" to="/staff/invite-codes">
            {t("staff.navInviteCodes")}
          </Link>
        ) : null}
      </section>
    );
  }

  const stats: { label: string; value: string }[] = [
    { label: t("staff.examsTaken"), value: num(metrics.examsTaken) },
    { label: t("staff.passes"), value: num(metrics.passes) },
    { label: t("staff.bestScore"), value: metrics.bestScorePct === null ? "—" : pct(metrics.bestScorePct) },
    { label: t("staff.avgScore"), value: metrics.avgScorePct === null ? "—" : pct(metrics.avgScorePct) },
    { label: t("staff.lastScore"), value: metrics.lastScorePct === null ? "—" : pct(metrics.lastScorePct) },
    { label: t("staff.coverage"), value: pct(metrics.coveragePct) },
    { label: t("staff.mastery"), value: pct(metrics.masteryPct) },
    { label: t("staff.signAccuracy"), value: metrics.signAccuracyPct === null ? "—" : pct(metrics.signAccuracyPct) }
  ];

  const topicRows = TOPICS.map((topic) => ({ id: topic.id, value: metrics.topicAccuracy[topic.id] })).filter(
    (row): row is { id: TopicId; value: number } => typeof row.value === "number"
  );

  return (
    <section className="card stack">
      <h2 className="card-title">
        <Gauge size={18} aria-hidden="true" />
        {t("staff.progress")}
      </h2>
      <div className="stack tight">
        <div className="row between">
          <span className="strong">{t("staff.readiness")}</span>
          <span className={`badge ${READINESS_TONES[metrics.readinessLabel]}`}>
            {t(READINESS_KEYS[metrics.readinessLabel])} · {pct(metrics.readiness)}
          </span>
        </div>
        <div
          className={`meter ${meterTone(metrics.readiness)}`}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(metrics.readiness)}
          aria-label={t("staff.readiness")}
        >
          <span style={{ inlineSize: `${Math.max(2, Math.min(100, metrics.readiness))}%` }} />
        </div>
      </div>
      <div className="grid cols-4 staff-mini-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="stat">
            <span className="stat-label">{stat.label}</span>
            <span className="staff-stat-small">{stat.value}</span>
          </div>
        ))}
      </div>
      <p className="small muted">
        {t("staff.lastPractice")}: {metrics.lastPracticeAt ? date(metrics.lastPracticeAt, DATE_TIME) : "—"}
      </p>
      {metrics.weakTopics.length > 0 ? (
        <div className="row">
          <span className="small strong">{t("staff.weakTopics")}:</span>
          {metrics.weakTopics.map((topic) => (
            <span key={topic} className="chip">
              {pick(TOPICS_BY_ID.get(topic)?.label) || topic}
            </span>
          ))}
        </div>
      ) : null}
      {topicRows.length > 0 ? (
        <div className="stack">
          <h3 className="staff-subtitle">{t("staff.topicAccuracy")}</h3>
          <div className="bars">
            {topicRows.map((row) => (
              <div key={row.id} className="bar-row">
                <span>{pick(TOPICS_BY_ID.get(row.id)?.label) || row.id}</span>
                <span className="strong">{pct(row.value)}</span>
                <div className={`meter ${meterTone(row.value)}`} aria-hidden="true">
                  <span style={{ inlineSize: `${Math.max(2, Math.min(100, row.value))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
