import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSchool } from "../../app/SchoolContext";
import { useSettings, type QuestionLang } from "../../app/SettingsContext";
import { Loading } from "../../components/Loading";
import { AVAILABLE_BANKS, BANKS, QUESTIONS_BY_ID } from "../../data/banks";
import type { BankId } from "../../domain/types";
import { isLang } from "../../i18n/core";
import { makeI18n } from "../../i18n/useI18n";
import { displayQuestion, explanationText, optionLetter, shuffled } from "../print/lib";

/**
 * Compact iframe widget (/embed/:slug?): one random official question at a time.
 * Optional ?lang=ar|en|fr and ?bank=motorcycle|car. Nothing is recorded.
 */
export function EmbedPage() {
  const { settings } = useSettings();
  const { school, slug, status, link } = useSchool();
  const [params] = useSearchParams();
  const langParam = params.get("lang");
  const lang = isLang(langParam) ? langParam : settings.lang;
  const i18n = useMemo(() => makeI18n(lang), [lang]);
  const { t, num, pick, dir } = i18n;
  const bankParam = params.get("bank");
  const bank: BankId =
    (bankParam === "motorcycle" || bankParam === "car") && BANKS[bankParam].questions.length
      ? bankParam
      : BANKS[settings.bank].questions.length
        ? settings.bank
        : AVAILABLE_BANKS[0]?.id ?? "motorcycle";
  const questionLang: QuestionLang =
    lang !== "ar" && settings.questionLang === "official" && isLang(langParam) ? lang : settings.questionLang;

  const queueRef = useRef<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState({ total: 0, correct: 0 });

  const draw = () => {
    if (!queueRef.current.length) {
      queueRef.current = shuffled(BANKS[bank].questions.map((question) => question.id));
    }
    setCurrent(queueRef.current.pop() ?? null);
    setPicked(null);
  };

  useEffect(() => {
    queueRef.current = [];
    draw();
    // A new bank starts a new queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank]);

  // Transparent page background so the widget blends into the host site.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("embed-mode");
    return () => root.classList.remove("embed-mode");
  }, []);

  if (slug && status === "loading") return <Loading />;

  const question = current === null ? undefined : QUESTIONS_BY_ID.get(current);
  const view = question ? displayQuestion(question, questionLang) : null;
  const explanation = question && picked !== null ? explanationText(question.id, lang) : null;
  const trainerUrl = link("") + (isLang(langParam) ? `?lang=${lang}` : "");
  const NextIcon = dir === "rtl" ? ArrowLeft : ArrowRight;
  const name = school ? pick(school.name) : t("embed.appName");

  const choose = (index: number) => {
    if (!question || picked !== null) return;
    setPicked(index);
    setAnswered((state) => ({
      total: state.total + 1,
      correct: state.correct + (index === question.answer ? 1 : 0)
    }));
  };

  return (
    <div className="embed" dir={dir} lang={lang}>
      <header className="embed-header">
        {school?.branding.logoUrl ? <img className="embed-logo" src={school.branding.logoUrl} alt="" /> : null}
        <div className="embed-title">
          <strong>{name}</strong>
          <span>{t("embed.subtitle")}</span>
        </div>
        {answered.total ? (
          <span className="embed-score" aria-label={t("embed.scoreLabel", { correct: answered.correct, total: answered.total })}>
            {num(answered.correct)}/{num(answered.total)}
          </span>
        ) : null}
      </header>

      {question && view ? (
        <section className="embed-question" aria-live="polite">
          {question.sign ? (
            <img className="embed-sign sign-img" src={question.sign} alt={t("embed.signAlt", { n: question.id })} />
          ) : null}
          <p className="embed-text" dir={view.dir} lang={view.lang}>
            {view.text}
          </p>
          {view.translated ? (
            <p className="embed-official" dir="rtl" lang="ar">
              <span>{t("embed.official")}</span> {view.officialText}
            </p>
          ) : null}
          <ol className="embed-options">
            {view.options.map((option, index) => {
              const state =
                picked === null
                  ? ""
                  : index === question.answer
                    ? "correct"
                    : index === picked
                      ? "wrong"
                      : "dimmed";
              return (
                <li key={index}>
                  <button
                    type="button"
                    className={`embed-option ${state}`}
                    onClick={() => choose(index)}
                    disabled={picked !== null}
                    aria-describedby={state === "correct" || state === "wrong" ? `embed-feedback` : undefined}
                  >
                    <span className="embed-letter">{optionLetter(view.lang, index)}</span>
                    <span dir={view.dir} lang={view.lang}>
                      {option}
                    </span>
                    {state === "correct" ? <CheckCircle2 size={18} aria-hidden /> : null}
                    {state === "wrong" ? <XCircle size={18} aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ol>
          {picked !== null ? (
            <div className={`embed-feedback ${picked === question.answer ? "ok" : "bad"}`} id="embed-feedback" role="status">
              <strong>{picked === question.answer ? t("embed.correct") : t("embed.wrong")}</strong>
              {explanation ? <p>{explanation}</p> : null}
            </div>
          ) : null}
          <div className="embed-actions">
            <button type="button" className="button button-secondary" onClick={draw}>
              {picked === null ? t("embed.skip") : t("embed.next")}
              <NextIcon size={18} aria-hidden />
            </button>
            <a className="button button-primary" href={trainerUrl} target="_blank" rel="noopener">
              {t("embed.openTrainer")}
              <ExternalLink size={18} aria-hidden />
            </a>
          </div>
        </section>
      ) : (
        <p className="embed-empty">{t("embed.empty")}</p>
      )}
    </div>
  );
}

export default EmbedPage;
