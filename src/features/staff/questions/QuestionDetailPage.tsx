import { ArrowLeft, ChevronLeft, ChevronRight, Flag, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BANKS, QUESTIONS_BY_ID } from "../../../data/banks";
import { explanationFor, tipFor, topicOf } from "../../../data/content";
import { TOPICS_BY_ID } from "../../../data/topics";
import { useI18n } from "../../../i18n/useI18n";
import { QuestionOptions, QuestionPrompt } from "../shared/QuestionPrompt";
import { FlagDialog } from "./FlagDialog";
import { QuestionNotes } from "./QuestionNotes";

export function QuestionDetailPage() {
  const { id = "" } = useParams();
  return <QuestionDetail key={id} id={id} />;
}

function QuestionDetail({ id }: { id: string }) {
  const { t, lang, num, pick } = useI18n();
  const questionId = Number.parseInt(id, 10);
  const question = QUESTIONS_BY_ID.get(questionId);
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState(false);

  if (!question) {
    return (
      <div className="page">
        <Link to="/staff/questions" className="staff-back">
          <ArrowLeft size={16} aria-hidden="true" className="staff-flip" />
          {t("staff.backToQuestions")}
        </Link>
        <p className="notice danger">{t("staff.questionMissing", { id })}</p>
      </div>
    );
  }

  const bank = BANKS[question.category ?? "motorcycle"];
  const position = bank.questions.findIndex((item) => item.id === question.id);
  const previous = position > 0 ? bank.questions[position - 1] : null;
  const next = position >= 0 && position < bank.questions.length - 1 ? bank.questions[position + 1] : null;
  const explanation = explanationFor(question.id, lang);
  const tip = tipFor(question.id, lang);
  const topic = TOPICS_BY_ID.get(topicOf(question.id));

  return (
    <div className="page">
      <div className="row between">
        <Link to="/staff/questions" className="staff-back">
          <ArrowLeft size={16} aria-hidden="true" className="staff-flip" />
          {t("staff.backToQuestions")}
        </Link>
        <div className="row">
          {previous ? (
            <Link className="icon-button" to={`/staff/questions/${previous.id}`} aria-label={t("staff.previousQuestion")}>
              <ChevronLeft size={18} aria-hidden="true" className="staff-flip" />
            </Link>
          ) : null}
          {next ? (
            <Link className="icon-button" to={`/staff/questions/${next.id}`} aria-label={t("staff.nextQuestion")}>
              <ChevronRight size={18} aria-hidden="true" className="staff-flip" />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.questionNumber", { id: num(question.id) })}</h1>
          <div className="row small">
            {topic ? <span className="chip">{pick(topic.label)}</span> : null}
            <span className="chip">{pick(bank.label)}</span>
          </div>
        </div>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => setFlagging(true)}
          disabled={flagged}
        >
          <Flag size={18} aria-hidden="true" />
          {flagged ? t("staff.flagSent") : t("staff.flagConfusing")}
        </button>
      </div>

      <div className="staff-detail-grid">
        <div className="stack">
          <section className="card stack">
            <span className="eyebrow">{t("staff.officialWording")}</span>
            <QuestionPrompt questionId={question.id} />
            <QuestionOptions questionId={question.id} />
          </section>
          {explanation || tip ? (
            <section className="card stack">
              <h2 className="card-title">
                <Lightbulb size={18} aria-hidden="true" />
                {t("staff.explanation")}
              </h2>
              {explanation ? <p>{explanation}</p> : null}
              {tip ? (
                <p className="notice">
                  <span className="strong">{t("staff.tip")}:</span> {tip}
                </p>
              ) : null}
              <p className="small muted">{t("staff.explanationDisclaimer")}</p>
            </section>
          ) : null}
        </div>
        <QuestionNotes questionId={question.id} />
      </div>

      {flagging ? (
        <FlagDialog
          questionId={question.id}
          onClose={() => setFlagging(false)}
          onDone={() => {
            setFlagging(false);
            setFlagged(true);
          }}
        />
      ) : null}
    </div>
  );
}

export default QuestionDetailPage;
