import { Award, BookOpenCheck, Clock, Home, Play, RotateCcw, TimerOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useTrainer } from "../../app/TrainerContext";
import { QUESTIONS_BY_ID } from "../../data/banks";
import { computeReadiness } from "../../domain/readiness";
import { useI18n } from "../../i18n/useI18n";
import { ShareActions } from "../share/ShareActions";
import { QuestionCard } from "./components/QuestionCard";
import { ReadinessCard } from "./components/ReadinessCard";
import { useBank, useQuestionView } from "./hooks";

export function ResultsPage() {
  const { t, num, duration, pct } = useI18n();
  const { result, start } = useTrainer();
  const { progress } = useProfile();
  const { link } = useSchool();
  const { bank, meta } = useBank();
  const navigate = useNavigate();
  const readiness = useMemo(() => computeReadiness(progress, meta), [progress, meta]);
  const [filter, setFilter] = useState<"wrong" | "all">("wrong");

  if (!result) return <Navigate to={link("")} replace />;

  const wrongIds = result.ids.filter((id) => result.answers[id] && !result.answers[id].ok);
  const unanswered = result.ids.filter((id) => !result.answers[id]);
  const percentage = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const listIds = filter === "wrong" ? [...wrongIds, ...unanswered] : result.ids;

  const startAndGo = (ok: boolean) => {
    if (ok) navigate(link("play"));
  };

  return (
    <main className="results-view page">
      <section className={`result-panel ${result.counted ? (result.passed ? "passed" : "failed") : ""}`}>
        <div className="score-ring" style={{ ["--score" as string]: `${percentage}%` }}>
          <strong>
            {num(result.score)}/{num(result.total)}
          </strong>
          <span>{pct(percentage)}</span>
        </div>
        <div className="stack">
          <span className="eyebrow">{t(`trainer.mode_${result.mode}`)}</span>
          <h2>
            {result.counted
              ? result.passed
                ? t("trainer.passedTitle")
                : t("trainer.failedTitle", { need: Math.ceil(result.total * (bank.passScore / bank.examSize)) })
              : t("trainer.sessionDone")}
          </h2>
          <div className="row">
            {result.durationMs ? (
              <span className="chip">
                <Clock aria-hidden="true" size={14} />
                <span className="ltr">{duration(result.durationMs)}</span>
              </span>
            ) : null}
            {result.timedOut ? (
              <span className="chip">
                <TimerOff aria-hidden="true" size={14} />
                {t("trainer.timedOut", { n: unanswered.length })}
              </span>
            ) : null}
          </div>
          {result.newBadges?.length ? (
            <div className="row">
              {result.newBadges.map((badge) => (
                <span key={badge} className="badge success">
                  <Award aria-hidden="true" size={14} />
                  {t(`trainer.badge_${badge}`)}
                </span>
              ))}
            </div>
          ) : null}
          <div className="result-actions row">
            {wrongIds.length ? (
              <button
                className="button button-primary"
                type="button"
                onClick={() => startAndGo(start("review", { ids: wrongIds }))}
              >
                <RotateCcw aria-hidden="true" size={18} />
                {t("trainer.retryWrong", { n: wrongIds.length })}
              </button>
            ) : null}
            <button
              className="button button-secondary"
              type="button"
              onClick={() => startAndGo(start(result.counted ? result.mode : "official"))}
            >
              <Play aria-hidden="true" size={18} />
              {t("trainer.newExam")}
            </button>
            <Link className="button button-ghost" to={link("")}>
              <Home aria-hidden="true" size={18} />
              {t("common.navHome")}
            </Link>
          </div>
        </div>
      </section>

      <ShareActions result={result} />

      <ReadinessCard readiness={readiness} compact />

      <section className="card stack">
        <div className="row between">
          <div className="card-title">
            <BookOpenCheck aria-hidden="true" size={20} />
            {t("trainer.reviewAnswers")}
          </div>
          <div className="tabs" role="tablist">
            <button className={`tab ${filter === "wrong" ? "active" : ""}`} type="button" onClick={() => setFilter("wrong")}>
              {t("trainer.filterWrong", { n: wrongIds.length + unanswered.length })}
            </button>
            <button className={`tab ${filter === "all" ? "active" : ""}`} type="button" onClick={() => setFilter("all")}>
              {t("trainer.filterAll", { n: result.ids.length })}
            </button>
          </div>
        </div>
        {listIds.length === 0 ? (
          <div className="empty">{t("trainer.noMistakes")}</div>
        ) : (
          <ul className="list">
            {listIds.map((id, index) => (
              <ReviewRow key={id} id={id} index={index} selected={result.answers[id]?.selected ?? null} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ReviewRow({ id, index, selected }: { id: number; index: number; selected: number | null }) {
  const { t, num } = useI18n();
  const question = QUESTIONS_BY_ID.get(id);
  const view = useQuestionView(question);
  const [open, setOpen] = useState(false);
  if (!question || !view) return null;
  const ok = selected === question.answer;
  return (
    <li>
      <details className="review-row" open={open} onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary className="list-row">
          <span className={`badge ${selected === null ? "warning" : ok ? "success" : "danger"}`}>{num(index + 1)}</span>
          {question.sign ? <img className="sign-img review-thumb" src={question.sign} alt="" /> : null}
          <span className="grow" lang={view.lang} dir={view.dir}>
            {question.sign ? view.options[question.answer] : view.text}
          </span>
          <span className="muted small nowrap">{selected === null ? t("trainer.unanswered") : ok ? t("trainer.correct") : t("trainer.wrongShort")}</span>
        </summary>
        {open ? (
          <div className="review-detail">
            <QuestionCard question={question} selected={selected} reveal />
          </div>
        ) : null}
      </details>
    </li>
  );
}
