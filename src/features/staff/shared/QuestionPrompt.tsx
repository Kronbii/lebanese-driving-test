import { CircleCheck } from "lucide-react";
import { useI18n } from "../../../i18n/useI18n";
import { questionTexts } from "./question";

interface QuestionPromptProps {
  questionId: number;
  size?: "normal" | "large" | "small";
}

/** Official Arabic question (or sign image + prompt), with the translation in en/fr. */
export function QuestionPrompt({ questionId, size = "normal" }: QuestionPromptProps) {
  const { t, lang } = useI18n();
  const texts = questionTexts(questionId, lang);
  if (!texts) return <p className="muted">{t("staff.questionMissing", { id: questionId })}</p>;
  const { question, translatedText } = texts;
  return (
    <div className={`staff-qprompt ${size}`}>
      {question.sign ? (
        <img
          className="sign-img staff-qprompt-sign"
          src={question.sign}
          alt={t("staff.signAlt", { id: questionId })}
        />
      ) : null}
      {question.text ? (
        <p className="staff-qprompt-text" lang="ar" dir="rtl">
          {question.text}
        </p>
      ) : (
        <p className="staff-qprompt-text">{t("staff.signPrompt")}</p>
      )}
      {translatedText ? (
        <p className="staff-qprompt-translation" lang={lang}>
          {translatedText}
        </p>
      ) : null}
    </div>
  );
}

/** Options list with the correct answer marked. */
export function QuestionOptions({ questionId, showCorrect = true }: { questionId: number; showCorrect?: boolean }) {
  const { t, lang, num } = useI18n();
  const texts = questionTexts(questionId, lang);
  if (!texts) return null;
  const { question, translatedOptions } = texts;
  return (
    <ol className="staff-options">
      {question.options.map((option, index) => {
        const correct = showCorrect && index === question.answer;
        return (
          <li key={index} className={`staff-option${correct ? " correct" : ""}`}>
            <span className="staff-option-num" aria-hidden="true">
              {num(index + 1)}
            </span>
            <div className="grow stack tight">
              <span lang="ar" dir="rtl">
                {option}
              </span>
              {translatedOptions ? (
                <span className="muted small" lang={lang}>
                  {translatedOptions[index]}
                </span>
              ) : null}
            </div>
            {correct ? (
              <span className="badge success">
                <CircleCheck size={14} aria-hidden="true" />
                {t("staff.correctAnswer")}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** One-line label for lists: question text or sign thumbnail + prompt. */
export function QuestionSnippet({ questionId }: { questionId: number }) {
  const { t, lang, num } = useI18n();
  const texts = questionTexts(questionId, lang);
  if (!texts) return <span className="muted">#{num(questionId)}</span>;
  const { question } = texts;
  return (
    <span className="staff-qsnippet">
      <span className="staff-qsnippet-id">#{num(questionId)}</span>
      {question.sign ? <img className="sign-img staff-qthumb" src={question.sign} alt="" loading="lazy" /> : null}
      <span className="staff-qsnippet-text" lang={question.text ? "ar" : lang} dir={question.text ? "rtl" : undefined}>
        {question.text || t("staff.signPrompt")}
      </span>
    </span>
  );
}
