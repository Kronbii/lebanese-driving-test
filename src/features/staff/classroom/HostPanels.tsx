import { Trophy, Users } from "lucide-react";
import type { ClassroomHostState } from "../../../api/types";
import { QrCode } from "../../../components/QrCode";
import { useI18n } from "../../../i18n/useI18n";
import { questionTexts } from "../shared/question";
import { QuestionPrompt } from "../shared/QuestionPrompt";

export function LobbyStage({ state, joinUrl }: { state: ClassroomHostState; joinUrl: string }) {
  const { t, num } = useI18n();
  const digits = state.code.split("");
  return (
    <div className="live-host-lobby">
      <div className="live-host-qr">
        <QrCode value={joinUrl} size={320} level="M" label={t("staff.scanToJoin")} />
      </div>
      <div className="stack live-host-join">
        <p className="live-host-hint">{t("staff.scanToJoin")}</p>
        <p className="live-host-url ltr">{joinUrl.replace(/^https?:\/\//, "")}</p>
        <p className="live-host-hint">{t("staff.orEnterCode")}</p>
        <p className="live-host-code ltr" aria-label={t("staff.code")}>
          {digits.map((digit, index) => (
            <span key={index}>{digit}</span>
          ))}
        </p>
        <p className="live-host-count">
          <Users size={28} aria-hidden="true" />
          {t("staff.participantsCount", { count: num(state.participants.length) })}
        </p>
        {!state.anonymous && state.participants.length > 0 ? (
          <ul className="live-host-names">
            {state.participants.map((participant) => (
              <li key={participant.id} className="chip">
                {participant.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

interface QuestionStageProps {
  state: ClassroomHostState;
  showDistribution: boolean;
}

export function QuestionStage({ state, showDistribution }: QuestionStageProps) {
  const { t, num, pct, lang } = useI18n();
  if (state.questionId === null) return null;
  const texts = questionTexts(state.questionId, lang);
  if (!texts) return <QuestionPrompt questionId={state.questionId} size="large" />;
  const reveal = state.phase === "reveal" || state.phase === "ended";
  const { question, translatedOptions } = texts;
  const answered = state.distribution.reduce((sum, value) => sum + value, 0);

  return (
    <div className="live-host-question">
      <QuestionPrompt questionId={state.questionId} size="large" />
      <ol className="live-host-options">
        {question.options.map((option, index) => {
          const correct = reveal && index === question.answer;
          const count = state.distribution[index] ?? 0;
          const share = answered > 0 ? (count / answered) * 100 : 0;
          const showBar = reveal || showDistribution;
          return (
            <li
              key={index}
              className={`live-host-option${correct ? " correct" : ""}${reveal && !correct ? " dim" : ""}`}
            >
              <span className="live-host-option-num" aria-hidden="true">
                {num(index + 1)}
              </span>
              <div className="grow stack tight">
                <span lang="ar" dir="rtl">
                  {option}
                </span>
                {translatedOptions ? (
                  <span className="live-host-option-tr" lang={lang}>
                    {translatedOptions[index]}
                  </span>
                ) : null}
                {showBar ? (
                  <span className="live-host-bar" aria-hidden="true">
                    <span style={{ inlineSize: `${share}%` }} />
                  </span>
                ) : null}
              </div>
              {showBar ? (
                <span className="live-host-option-count">
                  {num(count)}
                  <span className="small"> ({pct(share)})</span>
                </span>
              ) : null}
              {correct ? <span className="visually-hidden">{t("staff.correctAnswer")}</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AnsweredMeter({ state }: { state: ClassroomHostState }) {
  const { t, num } = useI18n();
  const total = state.participants.length;
  const share = total > 0 ? Math.min(100, (state.answeredCount / total) * 100) : 0;
  return (
    <div className="stack tight live-host-answered" aria-live="polite">
      <span className="strong">
        {t("staff.answeredCount", { answered: num(state.answeredCount), total: num(total) })}
      </span>
      <div className="meter">
        <span style={{ inlineSize: `${share}%` }} />
      </div>
    </div>
  );
}

export function Leaderboard({ state, limit = 10 }: { state: ClassroomHostState; limit?: number }) {
  const { t, num } = useI18n();
  const rows = state.leaderboard.slice(0, limit);
  return (
    <section className="live-board" aria-label={t("staff.leaderboard")}>
      <h2 className="card-title">
        <Trophy size={20} aria-hidden="true" />
        {t("staff.leaderboard")}
      </h2>
      {rows.length === 0 ? (
        <p className="muted">{t("staff.noParticipants")}</p>
      ) : (
        <ol className="live-board-list">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`} className={index < 3 ? `top top-${index + 1}` : undefined}>
              <span className="live-board-rank">{num(index + 1)}</span>
              <span className="grow">{row.name || t("staff.anonymousPlayer")}</span>
              <span className="strong">{num(row.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
