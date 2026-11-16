import { ArrowLeft, ArrowRight, Clock, Inbox, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSchool } from "../../app/SchoolContext";
import { useTrainer } from "../../app/TrainerContext";
import { QUESTIONS_BY_ID } from "../../data/banks";
import { isTopicId } from "../../data/topics";
import { MODES } from "../../domain/modes";
import type { ExamMode } from "../../domain/types";
import { useI18n } from "../../i18n/useI18n";
import { QuestionCard } from "./components/QuestionCard";

const MODE_IDS = Object.keys(MODES) as ExamMode[];

/** /exam/:mode?topic= — starts a session and jumps to the player (deep-linkable from plans and QR codes). */
export function StartExamRoute() {
  const { mode } = useParams();
  const [params] = useSearchParams();
  const { start } = useTrainer();
  const { link } = useSchool();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [empty, setEmpty] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const examMode = MODE_IDS.includes(mode as ExamMode) ? (mode as ExamMode) : "official";
    const topic = params.get("topic");
    const ok = start(examMode, { topic: isTopicId(topic) ? topic : undefined });
    if (ok) navigate(link("play"), { replace: true });
    else setEmpty(true);
  }, [link, mode, navigate, params, start]);

  if (!empty) return null;
  return (
    <main className="page">
      <div className="empty">
        <Inbox aria-hidden="true" size={36} />
        <p>{t(`trainer.emptyMode_${MODE_IDS.includes(mode as ExamMode) ? mode : "official"}`)}</p>
        <Link className="button button-primary" to={link("practice")}>
          {t("trainer.choosePractice")}
        </Link>
      </div>
    </main>
  );
}

export function ExamPage() {
  const { t, num, duration, dir } = useI18n();
  const { session, result, choose, next, finish, quit } = useTrainer();
  const { link } = useSchool();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  const goResults = useCallback(() => navigate(link("results"), { replace: true }), [link, navigate]);

  const handleNext = useCallback(() => {
    if (!session) return;
    const id = session.ids[session.index];
    if (!session.answers[id]) return;
    const last = session.index >= session.ids.length - 1;
    next();
    if (last) goResults();
  }, [goResults, next, session]);

  const finishEarly = useCallback(() => {
    if (!session) return;
    const unanswered = session.ids.length - Object.keys(session.answers).length;
    if (unanswered > 0 && !window.confirm(t("trainer.finishEarlyConfirm", { n: unanswered }))) return;
    finish(false);
    goResults();
  }, [finish, goResults, session, t]);

  // Countdown for timed modes.
  useEffect(() => {
    if (!session?.deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session?.deadline]);

  useEffect(() => {
    if (session?.deadline && now >= session.deadline) {
      finish(true);
      goResults();
    }
  }, [finish, goResults, now, session?.deadline]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!session || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
      if (event.key === "Enter") {
        handleNext();
        return;
      }
      const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "١": 0, "٢": 1, "٣": 2 };
      if (event.key in map) choose(map[event.key]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [choose, handleNext, session]);

  if (!session) {
    return <Navigate to={result ? link("results") : link("")} replace />;
  }

  const question = QUESTIONS_BY_ID.get(session.ids[session.index]);
  if (!question) return <Navigate to={link("")} replace />;

  const config = MODES[session.mode];
  const answer = session.answers[question.id];
  const answeredCount = Object.keys(session.answers).length;
  const isLast = session.index === session.ids.length - 1;
  const remaining = session.deadline ? session.deadline - now : null;
  const NextIcon = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <main className="exam-view">
      <div className="exam-status">
        <div>
          <span className="eyebrow">{t(`trainer.mode_${session.mode}`)}</span>
          <h2>{t("trainer.questionOf", { n: session.index + 1, total: session.ids.length })}</h2>
        </div>
        <div className="row">
          {remaining !== null ? (
            <span className={`chip timer ${remaining < 60_000 ? "danger" : ""}`} role="timer" aria-live="off">
              <Clock aria-hidden="true" size={16} />
              <span className="ltr">{duration(remaining)}</span>
            </span>
          ) : null}
          <button
            className="button button-ghost"
            type="button"
            onClick={() => {
              if (window.confirm(t("trainer.quitConfirm"))) {
                quit();
                navigate(link(""));
              }
            }}
          >
            <LogOut aria-hidden="true" size={18} />
            {t("trainer.quit")}
          </button>
        </div>
      </div>

      <div className="progress-track exam-progress" aria-label={t("trainer.progressLabel")}>
        <span style={{ width: `${Math.round((answeredCount / session.ids.length) * 100)}%` }} />
      </div>

      <QuestionCard
        question={question}
        selected={answer?.selected ?? null}
        reveal={config.feedback === "instant"}
        lockedNeutral={config.feedback === "end"}
        onChoose={choose}
        heading={t("trainer.questionNumber", { n: question.id })}
      />

      <div className="question-footer exam-footer">
        <p className="feedback muted">
          {!answer
            ? t("trainer.chooseAnswer")
            : config.feedback === "end"
              ? t("trainer.answerSaved")
              : ""}
        </p>
        <div className="row">
          {config.feedback === "end" && !isLast ? (
            <button className="button button-ghost" type="button" onClick={finishEarly}>
              {t("trainer.finishNow")}
            </button>
          ) : null}
          <button className="button button-primary next-button" disabled={!answer} type="button" onClick={handleNext}>
            {isLast ? t("trainer.showResult") : t("trainer.next")}
            <NextIcon aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
      <p className="muted small center keyboard-hint">{t("trainer.keyboardHint", { a: num(1), b: num(3) })}</p>
    </main>
  );
}
