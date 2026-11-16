import { CircleCheck, CircleX, Hourglass, Lock, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import type { ClassroomPlayerState } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { questionTexts } from "../staff/shared/question";
import { QuestionPrompt } from "../staff/shared/QuestionPrompt";

interface PlayerViewProps {
  state: ClassroomPlayerState;
  pending: number | null;
  answerError: string | null;
  onAnswer: (selected: number) => void;
}

export function PlayerView({ state, pending, answerError, onAnswer }: PlayerViewProps) {
  if (state.phase === "lobby") return <Lobby state={state} />;
  if (state.phase === "ended") return <Ended state={state} />;
  return <QuestionScreen state={state} pending={pending} answerError={answerError} onAnswer={onAnswer} />;
}

function Lobby({ state }: { state: ClassroomPlayerState }) {
  const { t } = useI18n();
  return (
    <div className="live-card stack center" aria-live="polite">
      <Hourglass size={40} className="live-icon live-pulse" aria-hidden="true" />
      <h1 className="live-title">{state.myName ? t("live.youreIn", { name: state.myName }) : t("live.youreInAnon")}</h1>
      <p className="muted">{t("live.waiting")}</p>
    </div>
  );
}

function QuestionScreen({ state, pending, answerError, onAnswer }: PlayerViewProps) {
  const { t, num, lang } = useI18n();
  if (state.questionId === null) return <Lobby state={state} />;
  const texts = questionTexts(state.questionId, lang);
  const reveal = state.phase === "reveal";
  const chosen = state.myAnswer ?? pending;
  const locked = chosen !== null || reveal;
  const correct = reveal ? state.correct : null;
  const gotIt = reveal && state.myAnswer !== null && state.myAnswer === state.correct;

  return (
    <div className="stack live-question">
      <div className="row between">
        <span className="badge info">
          {t("live.questionOf", { index: num(Math.min(state.index + 1, state.total)), total: num(state.total) })}
        </span>
        <span className="small strong">{t("live.score", { score: num(state.myScore) })}</span>
      </div>

      {reveal ? (
        <div className={`live-result ${gotIt ? "good" : "bad"}`} role="status">
          {gotIt ? <CircleCheck size={28} aria-hidden="true" /> : <CircleX size={28} aria-hidden="true" />}
          <span>
            {gotIt ? t("live.correct") : state.myAnswer === null ? t("live.noAnswer") : t("live.incorrect")}
          </span>
        </div>
      ) : null}

      <div className="live-card">
        <QuestionPrompt questionId={state.questionId} />
      </div>

      {texts ? (
        <div className="live-options" role="group" aria-label={t("live.chooseAnswer")}>
          {texts.question.options.map((option, index) => {
            const isChosen = chosen === index;
            const isCorrect = correct === index;
            const classes = [
              "live-option",
              isChosen ? "chosen" : "",
              isCorrect ? "correct" : "",
              reveal && isChosen && !isCorrect ? "wrong" : ""
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={index}
                type="button"
                className={classes}
                disabled={locked}
                aria-pressed={isChosen}
                onClick={() => onAnswer(index)}
              >
                <span className="live-option-num" aria-hidden="true">
                  {num(index + 1)}
                </span>
                <span className="grow stack tight">
                  <span lang="ar" dir="rtl">
                    {option}
                  </span>
                  {texts.translatedOptions ? (
                    <span className="small live-option-tr" lang={lang}>
                      {texts.translatedOptions[index]}
                    </span>
                  ) : null}
                </span>
                {isCorrect ? <CircleCheck size={22} aria-label={t("live.correctAnswer")} /> : null}
                {reveal && isChosen && !isCorrect ? <CircleX size={22} aria-label={t("live.yourAnswer")} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {answerError ? (
        <p className="form-error" role="alert">
          {answerError}
        </p>
      ) : null}
      {!reveal && chosen !== null ? (
        <p className="notice" role="status">
          <Lock size={18} aria-hidden="true" />
          {t("live.locked")}
        </p>
      ) : null}
      {!reveal && chosen === null ? <p className="muted small center">{t("live.tapToAnswer")}</p> : null}
    </div>
  );
}

function Ended({ state }: { state: ClassroomPlayerState }) {
  const { t, num } = useI18n();
  return (
    <div className="stack">
      <div className="live-card stack center">
        <Trophy size={44} className="live-icon" aria-hidden="true" />
        <h1 className="live-title">{t("live.ended")}</h1>
        <p className="live-final-score">{t("live.finalScore", { score: num(state.myScore), total: num(state.total) })}</p>
      </div>
      {state.leaderboard.length > 0 ? (
        <section className="live-card stack" aria-label={t("live.leaderboard")}>
          <h2 className="strong">{t("live.leaderboard")}</h2>
          <ol className="live-board-list">
            {state.leaderboard.slice(0, 10).map((row, index) => (
              <li
                key={`${row.name}-${index}`}
                className={`${index < 3 ? `top top-${index + 1}` : ""}${state.myName && row.name === state.myName ? " me" : ""}`}
              >
                <span className="live-board-rank">{num(index + 1)}</span>
                <span className="grow">{row.name || t("live.anonymous")}</span>
                <span className="strong">{num(row.score)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <Link to="/live" className="button button-ghost live-big-button">
        {t("live.joinAnother")}
      </Link>
    </div>
  );
}
