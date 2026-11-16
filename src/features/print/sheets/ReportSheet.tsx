import { useMemo } from "react";
import { useProfile } from "../../../app/ProfileContext";
import { useSettings } from "../../../app/SettingsContext";
import { BANKS, QUESTIONS_BY_ID } from "../../../data/banks";
import { questionMeta } from "../../../data/meta";
import { summary, weakestIds } from "../../../domain/engine";
import { xpLevel } from "../../../domain/gamification";
import { studyPlan, type PlanStep } from "../../../domain/plan";
import { computeReadiness, countedExams, type ReadinessFactors } from "../../../domain/readiness";
import { practiceStreak, topicStats, weeklySummary } from "../../../domain/stats";
import { useI18n, type I18n } from "../../../i18n/useI18n";
import { displayQuestion, topicLabel } from "../lib";
import { PrintLayout } from "../PrintLayout";

const FACTORS: (keyof ReadinessFactors)[] = [
  "recentExams",
  "mastery",
  "coverage",
  "signs",
  "trend",
  "recency",
  "timed"
];

export function planStepText(step: PlanStep, i18n: I18n): string {
  const { t, lang } = i18n;
  const topic = step.topic ? topicLabel(step.topic, lang) : "";
  return t(`print.plan_${step.kind}`, { count: step.count, topic });
}

/** The learner's progress report, made to be printed or saved as PDF. */
export function ReportSheet() {
  const i18n = useI18n();
  const { t, num, pct, date, duration, lang } = i18n;
  const { settings } = useSettings();
  const { active, progress } = useProfile();
  const bank = BANKS[settings.bank];
  const meta = questionMeta(settings.bank);

  const data = useMemo(() => {
    const ids = meta.map((item) => item.id);
    const now = Date.now();
    return {
      readiness: computeReadiness(progress, meta, now),
      totals: summary(progress, ids),
      counted: countedExams(progress.history),
      topics: topicStats(progress, meta),
      weakest: weakestIds(progress, ids, 10).filter((item) => item.wrong > 0),
      plan: studyPlan(progress, meta, now),
      week: weeklySummary(progress, now),
      streak: practiceStreak(progress, now)
    };
  }, [progress, meta]);

  const { readiness, totals, counted, topics, weakest, plan, week, streak } = data;
  const name = active.name || t("print.report_learner");
  const best = counted.reduce<number | null>((max, item) => {
    const value = item.total ? (item.score / item.total) * 100 : 0;
    return max === null || value > max ? value : max;
  }, null);
  const history = progress.history.slice(-15).reverse();
  const weekMax = Math.max(1, ...week.days.map((day) => day.answered));
  const level = xpLevel(progress.xp).level;

  return (
    <PrintLayout
      title={t("print.report_title")}
      subtitle={t("print.report_subtitle", { name, bank: bank.label[lang] })}
    >
      <section className="print-section print-report-top">
        <div className="print-score">
          <span className="print-score-value">{pct(readiness.score)}</span>
          <span className="print-score-label">{t("print.report_readiness")}</span>
          <strong>{t(`print.readiness_${readiness.label}`)}</strong>
        </div>
        <div className="print-kv">
          <Kv label={t("print.report_coverage")} value={`${pct(totals.coveragePct)} (${num(totals.seen)}/${num(totals.total)})`} />
          <Kv label={t("print.report_mastery")} value={`${pct(totals.masteryPct)} (${num(totals.mastered)})`} />
          <Kv label={t("print.report_weak")} value={num(totals.weak)} />
          <Kv label={t("print.report_exams")} value={num(counted.length)} />
          <Kv label={t("print.report_passes")} value={num(counted.filter((item) => item.passed).length)} />
          <Kv label={t("print.report_best")} value={best === null ? "—" : pct(best)} />
          <Kv label={t("print.report_streak")} value={t("print.report_days", { n: streak })} />
          <Kv label={t("print.report_level")} value={`${num(level)} · ${num(progress.xp)} XP`} />
        </div>
      </section>

      <section className="print-section">
        <h2 className="print-section-title">{t("print.report_factors")}</h2>
        <table className="print-table">
          <tbody>
            {FACTORS.map((key) => {
              const value = readiness.factors[key];
              return (
                <tr key={key}>
                  <th scope="row">{t(`print.factor_${key}`)}</th>
                  <td className="print-bar-cell">
                    <span className="print-bar">
                      <span style={{ inlineSize: `${Math.round((value ?? 0) * 100)}%` }} />
                    </span>
                  </td>
                  <td className="nowrap">{value === null ? t("print.report_noData") : pct(value * 100)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="print-note">{t("print.report_readinessNote")}</p>
      </section>

      <section className="print-section">
        <h2 className="print-section-title">{t("print.report_plan")}</h2>
        <ol className="print-plan">
          {plan.map((step, index) => (
            <li key={`${step.kind}-${index}`}>{planStepText(step, i18n)}</li>
          ))}
        </ol>
      </section>

      <section className="print-section print-avoid-break">
        <h2 className="print-section-title">{t("print.report_week")}</h2>
        <p className="print-note">
          {t("print.report_weekSummary", {
            answered: week.answered,
            correct: week.correct,
            exams: week.exams,
            days: week.activeDays
          })}
        </p>
        <div className="print-week" role="img" aria-label={t("print.report_week")}>
          {week.days.map((day) => (
            <div key={day.day} className="print-week-day">
              <span className="print-week-value">{num(day.answered)}</span>
              <span className="print-week-bar">
                <span style={{ blockSize: `${Math.round((day.answered / weekMax) * 100)}%` }} />
              </span>
              <span className="print-week-label">
                {date(new Date(`${day.day}T12:00:00`).getTime(), { weekday: "short" })}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="print-section">
        <h2 className="print-section-title">{t("print.report_history")}</h2>
        {history.length ? (
          <table className="print-table">
            <thead>
              <tr>
                <th scope="col">{t("print.report_date")}</th>
                <th scope="col">{t("print.report_mode")}</th>
                <th scope="col">{t("print.report_score")}</th>
                <th scope="col">{t("print.report_result")}</th>
                <th scope="col">{t("print.report_time")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={`${item.at}-${item.examIndex}`}>
                  <td className="nowrap">{date(item.at)}</td>
                  <td>{item.mode ? t(`print.mode_${item.mode}`) : t("print.mode_official")}</td>
                  <td className="nowrap">
                    {num(item.score)}/{num(item.total)} · {pct(item.total ? (item.score / item.total) * 100 : 0)}
                  </td>
                  <td>{item.passed ? t("print.report_passed") : t("print.report_notPassed")}</td>
                  <td className="nowrap">{item.durationMs ? duration(item.durationMs) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="print-note">{t("print.report_noExams")}</p>
        )}
      </section>

      <section className="print-section">
        <h2 className="print-section-title">{t("print.report_topics")}</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th scope="col">{t("print.key_topic")}</th>
              <th scope="col">{t("print.report_seen")}</th>
              <th scope="col">{t("print.report_accuracy")}</th>
              <th scope="col">{t("print.report_mastery")}</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((stat) => (
              <tr key={stat.topic}>
                <td>{topicLabel(stat.topic, lang)}</td>
                <td className="nowrap">
                  {num(stat.seen)}/{num(stat.total)}
                </td>
                <td className="nowrap">{stat.accuracy === null ? "—" : pct(stat.accuracy * 100)}</td>
                <td className="print-bar-cell">
                  <span className="print-bar">
                    <span style={{ inlineSize: `${Math.round((stat.mastery / 5) * 100)}%` }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-section">
        <h2 className="print-section-title">{t("print.report_weakest")}</h2>
        {weakest.length ? (
          <table className="print-table">
            <thead>
              <tr>
                <th scope="col">{t("print.key_ref")}</th>
                <th scope="col">{t("print.report_question")}</th>
                <th scope="col">{t("print.report_correctAnswer")}</th>
                <th scope="col">{t("print.report_mistakes")}</th>
              </tr>
            </thead>
            <tbody>
              {weakest.map((item) => {
                const question = QUESTIONS_BY_ID.get(item.id);
                if (!question) return null;
                const view = displayQuestion(question, settings.questionLang);
                return (
                  <tr key={item.id}>
                    <td className="nowrap">{num(item.id)}</td>
                    <td dir={view.dir} lang={view.lang}>
                      {question.sign ? (
                        <img className="print-mini-sign sign-img" src={question.sign} alt={t("print.signAlt", { n: item.id })} />
                      ) : null}
                      {view.text}
                    </td>
                    <td dir={view.dir} lang={view.lang}>
                      {view.options[question.answer]}
                    </td>
                    <td className="nowrap">{num(item.wrong)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="print-note">{t("print.report_noMistakes")}</p>
        )}
      </section>

      <p className="print-note">{t("print.report_privacy")}</p>
    </PrintLayout>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-kv-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
