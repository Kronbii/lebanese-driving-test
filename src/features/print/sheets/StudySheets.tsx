import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProfile } from "../../../app/ProfileContext";
import { useSettings } from "../../../app/SettingsContext";
import { BANKS } from "../../../data/banks";
import { topicOf } from "../../../data/content";
import { questionMeta } from "../../../data/meta";
import { isTopicId } from "../../../data/topics";
import { topicStats, weakTopics } from "../../../domain/stats";
import type { Question, TopicId } from "../../../domain/types";
import { useI18n } from "../../../i18n/useI18n";
import { displayQuestion, explanationText, optionLetter, topicLabel, topicsInBank } from "../lib";
import { PrintLayout, PrintNotice } from "../PrintLayout";
import { PrintQuestion } from "../PrintQuestion";

/** All sign questions with their meaning (the correct option), grouped by sign family. */
export function SignsSheet() {
  const { t, num, lang } = useI18n();
  const { settings } = useSettings();
  const bank = BANKS[settings.bank];

  const groups = useMemo(() => {
    const signs = bank.questions.filter((question) => question.sign);
    return topicsInBank(settings.bank, "signs")
      .map((topic) => ({ topic, questions: signs.filter((question) => topicOf(question.id) === topic) }))
      .filter((group) => group.questions.length > 0);
  }, [bank, settings.bank]);
  const count = groups.reduce((sum, group) => sum + group.questions.length, 0);

  return (
    <PrintLayout title={t("print.signs_title")} subtitle={t("print.signs_subtitle", { count })}>
      {count ? (
        groups.map((group) => (
          <section key={group.topic} className="print-section print-sign-group">
            <h2 className="print-section-title">
              {topicLabel(group.topic, lang)} <span className="print-count">({num(group.questions.length)})</span>
            </h2>
            <ul className="print-sign-grid">
              {group.questions.map((question) => {
                const view = displayQuestion(question, settings.questionLang);
                return (
                  <li key={question.id} className="print-sign-card">
                    {question.sign ? (
                      <img
                        className="sign-img"
                        src={question.sign}
                        alt={t("print.signAlt", { n: question.id })}
                      />
                    ) : null}
                    <p className="print-sign-meaning" dir={view.dir} lang={view.lang}>
                      {view.options[question.answer]}
                    </p>
                    {view.translated ? (
                      <p className="print-sign-official" dir="rtl" lang="ar">
                        {view.officialOptions[question.answer]}
                      </p>
                    ) : null}
                    <span className="print-sign-ref">{num(question.id)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      ) : (
        <PrintNotice title={t("print.signs_empty")} />
      )}
    </PrintLayout>
  );
}

/** Worksheet for one topic (default: the learner's weakest), with a key and explanations at the end. */
export function TopicSheet() {
  const { t, num, lang, pct } = useI18n();
  const { settings } = useSettings();
  const { progress } = useProfile();
  const [params, setParams] = useSearchParams();
  const meta = questionMeta(settings.bank);
  const explanationLang = settings.explanationLang === "ui" ? settings.lang : settings.explanationLang;

  const stats = useMemo(() => topicStats(progress, meta), [progress, meta]);
  const weakest = weakTopics(stats, 1)[0]?.topic ?? null;
  const available = topicsInBank(settings.bank);
  const param = params.get("topic");
  const topic: TopicId | null =
    isTopicId(param) && available.includes(param) ? param : weakest ?? available[0] ?? null;
  const stat = stats.find((item) => item.topic === topic);

  const questions: Question[] = useMemo(
    () => (topic ? BANKS[settings.bank].questions.filter((question) => topicOf(question.id) === topic) : []),
    [settings.bank, topic]
  );

  const controls = (
    <label className="print-inline-field">
      <span className="visually-hidden">{t("print.topic_choose")}</span>
      <select
        className="select"
        value={topic ?? ""}
        onChange={(event) => {
          const next = new URLSearchParams(params);
          next.set("topic", event.target.value);
          setParams(next, { replace: true });
        }}
      >
        {available.map((id) => (
          <option key={id} value={id}>
            {topicLabel(id, lang)}
            {id === weakest ? ` · ${t("print.topic_weakest")}` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const title = topic ? t("print.topic_title", { topic: topicLabel(topic, lang) }) : t("print.topic_titlePlain");

  return (
    <PrintLayout
      title={title}
      subtitle={t("print.topic_subtitle", { count: questions.length })}
      controls={controls}
    >
      {topic && questions.length ? (
        <>
          <p className="print-instructions">
            {param && param === topic
              ? t("print.topic_introChosen")
              : weakest === topic
                ? t("print.topic_introWeakest")
                : t("print.topic_introDefault")}
            {stat?.accuracy !== null && stat?.accuracy !== undefined
              ? ` ${t("print.topic_accuracy", { pct: pct(stat.accuracy * 100) })}`
              : ""}
          </p>
          <div className="print-fill-row">
            <span>{t("print.exam_name")}</span>
            <span className="print-fill-line" />
            <span>{t("print.exam_score")}</span>
            <span className="print-fill-box">
              ____ / {num(questions.length)}
            </span>
          </div>
          <div className="print-questions">
            {questions.map((question, index) => (
              <PrintQuestion key={question.id} question={question} number={index + 1} />
            ))}
          </div>

          <section className="print-section print-break-before">
            <h2 className="print-section-title">{t("print.topic_keyTitle")}</h2>
            <ol className="print-key-grid" aria-label={t("print.key_grid")}>
              {questions.map((question, index) => {
                const view = displayQuestion(question, settings.questionLang);
                return (
                  <li key={question.id}>
                    <span className="print-key-num">{num(index + 1)}</span>
                    <span className="print-key-letter">{optionLetter(view.lang, question.answer)}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="print-section">
            <h2 className="print-section-title">{t("print.topic_explanations")}</h2>
            <ol className="print-explanations">
              {questions.map((question, index) => {
                const view = displayQuestion(question, settings.questionLang);
                const explanation = explanationText(question.id, explanationLang);
                return (
                  <li key={question.id}>
                    <p className="print-explanation-head">
                      <span className="print-key-num">{num(index + 1)}</span>
                      <strong>{optionLetter(view.lang, question.answer)}</strong>{" "}
                      <span dir={view.dir} lang={view.lang}>
                        {view.options[question.answer]}
                      </span>
                    </p>
                    {explanation ? (
                      <p className="print-explanation-text" lang={explanationLang} dir={explanationLang === "ar" ? "rtl" : "ltr"}>
                        {explanation}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      ) : (
        <PrintNotice title={t("print.topic_empty")} />
      )}
    </PrintLayout>
  );
}
