import { NotebookPen, Star, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useProfile } from "../../../app/ProfileContext";
import { useSettings } from "../../../app/SettingsContext";
import { topicOf } from "../../../data/content";
import { TOPICS_BY_ID } from "../../../data/topics";
import { setNote, toggleFavorite } from "../../../domain/engine";
import type { Question } from "../../../domain/types";
import { useI18n } from "../../../i18n/useI18n";
import { canSpeak, speak } from "../../../lib/speech";
import { useQuestionView } from "../hooks";
import { ExplanationPanel } from "./ExplanationPanel";

interface QuestionCardProps {
  question: Question;
  /** Option the learner picked, if any. */
  selected?: number | null;
  /** Show right/wrong colouring and the explanation. */
  reveal: boolean;
  onChoose?: (index: number) => void;
  /** Label above the question, e.g. "Question 3 of 30". */
  heading?: string;
  /** Hide the explanation even when revealed (e.g. compact lists). */
  hideExplanation?: boolean;
  /** In "end feedback" modes: show that an answer was recorded without saying if it is right. */
  lockedNeutral?: boolean;
  /** Exam layout: smaller header row (no topic chip) so answers fit on a phone screen. */
  compact?: boolean;
}

export function QuestionCard({
  question,
  selected = null,
  reveal,
  onChoose,
  heading,
  hideExplanation,
  lockedNeutral,
  compact
}: QuestionCardProps) {
  const { t, num, pick } = useI18n();
  const { settings } = useSettings();
  const { progress, mutate } = useProfile();
  const view = useQuestionView(question);
  const [noteOpen, setNoteOpen] = useState(false);
  // In exams (compact) the Arabic under each translated answer is one tap away, so all
  // three answers fit on a phone screen. The choice sticks for the rest of the session.
  const [officialOptionsOpen, setOfficialOptionsOpen] = useState(!compact);
  const [noteDraft, setNoteDraft] = useState(progress.notes[question.id] ?? "");
  const favorite = progress.favorites.includes(question.id);
  const topic = TOPICS_BY_ID.get(topicOf(question.id));
  const answered = selected !== null && selected !== undefined;

  useEffect(() => {
    setNoteDraft(progress.notes[question.id] ?? "");
    setNoteOpen(false);
    // Only when the question changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  useEffect(() => {
    if (settings.autoRead && view) speak(`${view.text}. ${view.options.join(". ")}`, view.lang);
  }, [settings.autoRead, view]);

  if (!view) return null;

  const showOfficial = view.translated && settings.showOfficial;
  const showOfficialOptions = showOfficial && officialOptionsOpen;

  const optionState = (index: number) => {
    if (!answered) return "";
    if (lockedNeutral) return index === selected ? "is-picked" : "is-muted";
    if (!reveal) return index === selected ? "is-picked" : "";
    if (index === question.answer) return "is-correct";
    if (index === selected) return "is-wrong";
    return "is-muted";
  };

  return (
    <section className={`question-panel question-card ${compact ? "compact" : ""}`}>
      <div className="question-card-top">
        <div className="question-meta">
          {heading ?? t("trainer.questionNumber", { n: question.id })}
          {topic && !compact ? <span className="chip topic-chip">{pick(topic.label)}</span> : null}
        </div>
        <div className="row question-tools">
          {canSpeak() ? (
            <button
              className="icon-button"
              type="button"
              aria-label={t("trainer.readAloud")}
              onClick={() => speak(`${view.text}. ${view.options.join(". ")}`, view.lang)}
            >
              <Volume2 aria-hidden="true" size={18} />
            </button>
          ) : null}
          <button
            className="icon-button"
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? t("trainer.unfavorite") : t("trainer.favorite")}
            onClick={() => mutate((draft) => void toggleFavorite(draft, question.id))}
          >
            <Star aria-hidden="true" size={18} fill={favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-pressed={Boolean(progress.notes[question.id])}
            aria-label={t("trainer.myNote")}
            onClick={() => setNoteOpen((open) => !open)}
          >
            <NotebookPen aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      {question.sign ? (
        <div className="question-sign">
          <img src={question.sign} alt={t("trainer.signAlt", { n: question.id })} />
        </div>
      ) : null}

      <div lang={view.lang} dir={view.dir} className="question-body">
        <h3>{view.text}</h3>
      </div>
      {showOfficial ? (
        <p className="official-text">
          <span className="badge">{t("trainer.officialWording")}</span>{" "}
          <span lang="ar" dir="rtl">
            {view.officialText}
          </span>
          {compact ? (
            <button
              type="button"
              className="link-button official-toggle"
              aria-pressed={officialOptionsOpen}
              onClick={() => setOfficialOptionsOpen((open) => !open)}
            >
              {officialOptionsOpen ? t("trainer.hideArabicAnswers") : t("trainer.showArabicAnswers")}
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="option-list" lang={view.lang} dir={view.dir}>
        {view.options.map((option, index) => (
          <button
            className={`option-button ${optionState(index)}`}
            disabled={answered || !onChoose}
            key={index}
            type="button"
            onClick={() => onChoose?.(index)}
          >
            <span className="option-marker">{num(index + 1)}</span>
            <span>
              {option}
              {showOfficialOptions ? (
                <span className="official-option" lang="ar" dir="rtl">
                  {view.officialOptions[index]}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      {noteOpen ? (
        <div className="field note-editor">
          <span>{t("trainer.myNote")}</span>
          <textarea
            className="textarea"
            value={noteDraft}
            maxLength={1000}
            onChange={(event) => setNoteDraft(event.target.value)}
            onBlur={() => mutate((draft) => setNote(draft, question.id, noteDraft))}
            placeholder={t("trainer.notePlaceholder")}
          />
        </div>
      ) : progress.notes[question.id] ? (
        <p className="my-note">
          <NotebookPen aria-hidden="true" size={14} /> {progress.notes[question.id]}
        </p>
      ) : null}

      {reveal && answered && !lockedNeutral && !hideExplanation ? (
        <ExplanationPanel question={question} selected={selected} />
      ) : null}
    </section>
  );
}
