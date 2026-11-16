import { useSettings } from "../../app/SettingsContext";
import type { Question } from "../../domain/types";
import { useI18n } from "../../i18n/useI18n";
import { displayQuestion, optionLetter } from "./lib";

interface PrintQuestionProps {
  question: Question;
  number: number;
  /** Mark the correct option (answer key / worksheets). */
  showAnswer?: boolean;
}

/** One question on paper: number, sign, wording, options with tick boxes. */
export function PrintQuestion({ question, number, showAnswer = false }: PrintQuestionProps) {
  const { t, num } = useI18n();
  const { settings } = useSettings();
  const view = displayQuestion(question, settings.questionLang);

  return (
    <section className="pq" aria-label={t("print.questionNumber", { n: number })}>
      <span className="pq-num">{num(number)}</span>
      <div className="pq-body">
        <div className="pq-main">
          {question.sign ? (
            <img
              className="pq-sign sign-img"
              src={question.sign}
              alt={t("print.signAlt", { n: question.id })}
              loading="eager"
            />
          ) : null}
          <div className="pq-content">
            <p className="pq-text" dir={view.dir} lang={view.lang}>
              {view.text}
            </p>
            {view.translated ? (
              <p className="pq-official" dir="rtl" lang="ar">
                <span className="pq-official-label">{t("print.official")}</span> {view.officialText}
              </p>
            ) : null}
            <ol className="pq-options">
              {view.options.map((option, index) => {
                const correct = showAnswer && index === question.answer;
                return (
                  <li key={index} className={correct ? "correct" : undefined}>
                    <span className="pq-box" aria-hidden>
                      {correct ? "✓" : ""}
                    </span>
                    <span className="pq-letter">{optionLetter(view.lang, index)}</span>
                    <span className="pq-option">
                      <span dir={view.dir} lang={view.lang}>
                        {option}
                      </span>
                      {view.translated ? (
                        <span className="pq-option-official" dir="rtl" lang="ar">
                          {view.officialOptions[index]}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
