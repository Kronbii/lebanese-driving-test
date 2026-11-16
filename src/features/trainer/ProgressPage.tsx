import { Award, BarChart3, CalendarDays, FileText, History, Lock, Target } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { TOPICS_BY_ID } from "../../data/topics";
import { BADGES } from "../../domain/gamification";
import { studyPlan } from "../../domain/plan";
import { computeReadiness } from "../../domain/readiness";
import { topicStats, weeklySummary } from "../../domain/stats";
import { useI18n } from "../../i18n/useI18n";
import { ShareProgressCard } from "../share/ShareProgressCard";
import { PlanCard } from "./components/PlanCard";
import { ReadinessCard } from "./components/ReadinessCard";
import { useBank } from "./hooks";

export function ProgressPage() {
  const { t, num, pct, date, pick, duration, locale } = useI18n();
  const { progress } = useProfile();
  const { link, can } = useSchool();
  const { meta } = useBank();

  const readiness = useMemo(() => computeReadiness(progress, meta), [progress, meta]);
  const plan = useMemo(() => studyPlan(progress, meta), [progress, meta]);
  const topics = useMemo(
    () => topicStats(progress, meta).sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2)),
    [progress, meta]
  );
  const week = useMemo(() => weeklySummary(progress), [progress]);
  const maxDay = Math.max(1, ...week.days.map((day) => day.answered));
  const history = progress.history.slice().reverse();
  const passedOnce = progress.history.some((item) => item.passed);

  return (
    <main className="page progress-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("common.navProgress")}</span>
          <h2>{t("trainer.progressTitle")}</h2>
        </div>
        <div className="row">
          <Link className="button button-ghost" to={link("print/report")} target="_blank">
            <FileText aria-hidden="true" size={18} />
            {t("trainer.printReport")}
          </Link>
          {passedOnce && can("certificates") ? (
            <Link className="button button-secondary" to={link("print/certificate")} target="_blank">
              <Award aria-hidden="true" size={18} />
              {t("trainer.certificate")}
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid cols-2">
        <ReadinessCard readiness={readiness} />
        <div className="stack">
          <PlanCard steps={plan} />
          <ShareProgressCard />
        </div>
      </div>

      <section className="card stack">
        <div className="card-title">
          <CalendarDays aria-hidden="true" size={20} />
          {t("trainer.weekTitle")}
        </div>
        <p className="muted small">
          {t("trainer.weekSummary", {
            answered: week.answered,
            accuracy: week.answered ? Math.round((week.correct / week.answered) * 100) : 0,
            exams: week.exams,
            days: week.activeDays
          })}
        </p>
        <div className="week-chart" role="img" aria-label={t("trainer.weekTitle")}>
          {week.days.map((day) => (
            <div key={day.day} className="week-bar">
              <span className="week-count small">{day.answered ? num(day.answered) : ""}</span>
              <span className="week-fill" style={{ height: `${Math.round((day.answered / maxDay) * 100)}%` }} />
              <span className="small muted">
                {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(`${day.day}T12:00:00`))}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="card-title">
          <Target aria-hidden="true" size={20} />
          {t("trainer.topicsTitle")}
        </div>
        <div className="bars">
          {topics.map((stat) => (
            <div key={stat.topic} className="bar-row">
              <Link className="small strong" to={link(`exam/topic?topic=${stat.topic}`)}>
                {pick(TOPICS_BY_ID.get(stat.topic)?.label)}
              </Link>
              <span className="small muted">{stat.accuracy === null ? "—" : pct(stat.accuracy * 100)}</span>
              <div
                className={`meter ${stat.accuracy === null ? "" : stat.accuracy < 0.6 ? "danger" : stat.accuracy < 0.8 ? "warning" : "success"}`}
                aria-hidden="true"
              >
                <span style={{ width: `${stat.accuracy === null ? 0 : Math.round(stat.accuracy * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="card-title">
          <Award aria-hidden="true" size={20} />
          {t("trainer.badgesTitle")}
        </div>
        <div className="badge-grid">
          {BADGES.map((badge) => {
            const earned = progress.badges[badge];
            return (
              <div key={badge} className={`badge-tile ${earned ? "earned" : ""}`}>
                {earned ? <Award aria-hidden="true" size={26} /> : <Lock aria-hidden="true" size={22} />}
                <strong>{t(`trainer.badge_${badge}`)}</strong>
                <span className="small muted">
                  {earned ? date(earned, { day: "numeric", month: "short" }) : t(`trainer.badgeHow_${badge}`)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card stack">
        <div className="card-title">
          <History aria-hidden="true" size={20} />
          {t("trainer.historyTitle")}
        </div>
        {history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("trainer.colDate")}</th>
                  <th>{t("trainer.colMode")}</th>
                  <th>{t("trainer.colScore")}</th>
                  <th>{t("trainer.colTime")}</th>
                  <th>{t("trainer.colResult")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={`${item.at}-${item.examIndex}`}>
                    <td className="nowrap">{date(item.at)}</td>
                    <td>{t(`trainer.mode_${item.mode ?? "official"}`)}</td>
                    <td className="nowrap">
                      {num(item.score)}/{num(item.total)}
                    </td>
                    <td className="ltr nowrap">{item.durationMs ? duration(item.durationMs) : "—"}</td>
                    <td>
                      {["official", "timed", "strict", "final", undefined].includes(item.mode) ? (
                        <span className={`badge ${item.passed ? "success" : "danger"}`}>
                          {item.passed ? t("trainer.pass") : t("trainer.fail")}
                        </span>
                      ) : (
                        <span className="badge info">{t("trainer.practiceOnly")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <BarChart3 aria-hidden="true" size={32} />
            {t("trainer.noAttempts")}
          </div>
        )}
      </section>
    </main>
  );
}
