import { FileText, KeyRound, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSchool } from "../../../app/SchoolContext";
import { useSettings } from "../../../app/SettingsContext";
import { BANKS, QUESTIONS_BY_ID } from "../../../data/banks";
import { topicOf } from "../../../data/content";
import { isTopicId } from "../../../data/topics";
import type { BankId, Question, TopicId } from "../../../domain/types";
import { useI18n } from "../../../i18n/useI18n";
import { displayQuestion, newSeed, optionLetter, parseSeed, printableExamIds, topicLabel, topicsInBank } from "../lib";
import { PrintLayout, PrintNotice } from "../PrintLayout";
import { PrintQuestion } from "../PrintQuestion";

interface ExamParams {
  seed: number;
  bank: BankId;
  signsOnly: boolean;
  topic: TopicId | null;
  questions: Question[];
  /** Query string shared by the exam and its answer key. */
  query: string;
  setParam: (name: string, value: string | null) => void;
}

function isBankId(value: string | null): value is BankId {
  return value === "motorcycle" || value === "car";
}

/** Reads seed/bank/signs/topic from the URL and writes a seed there if missing. */
function useExamParams(): ExamParams {
  const [params, setParams] = useSearchParams();
  const { settings } = useSettings();
  const paramSeed = parseSeed(params.get("seed"));
  const [fallbackSeed] = useState(newSeed);
  const seed = paramSeed ?? fallbackSeed;
  const bankParam = params.get("bank");
  const bank: BankId = isBankId(bankParam) && BANKS[bankParam].questions.length ? bankParam : settings.bank;
  const signsOnly = params.get("signs") === "1";
  const topicParam = params.get("topic");
  const topic = isTopicId(topicParam) ? topicParam : null;

  useEffect(() => {
    if (paramSeed !== null && bankParam === bank) return;
    const next = new URLSearchParams(params);
    next.set("seed", String(seed));
    next.set("bank", bank);
    setParams(next, { replace: true });
  }, [paramSeed, bankParam, bank, seed, params, setParams]);

  const questions = useMemo(
    () =>
      printableExamIds(bank, seed, { signsOnly, topic })
        .map((id) => QUESTIONS_BY_ID.get(id))
        .filter((question): question is Question => Boolean(question)),
    [bank, seed, signsOnly, topic]
  );

  const query = new URLSearchParams({
    seed: String(seed),
    bank,
    ...(signsOnly ? { signs: "1" } : {}),
    ...(topic ? { topic } : {})
  }).toString();

  const setParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(name);
    else next.set(name, value);
    setParams(next, { replace: true });
  };

  return { seed, bank, signsOnly, topic, questions, query, setParam };
}

function passMark(bank: BankId, total: number): number {
  const info = BANKS[bank];
  return Math.ceil((total * info.passScore) / info.examSize);
}

export function ExamSheet() {
  const { t, num, lang } = useI18n();
  const { link } = useSchool();
  const exam = useExamParams();
  const total = exam.questions.length;

  const controls = (
    <>
      <button
        type="button"
        className="button button-ghost"
        onClick={() => exam.setParam("seed", String(newSeed()))}
      >
        <RefreshCw size={18} aria-hidden />
        {t("print.exam_new")}
      </button>
      <label className="check print-check">
        <input
          type="checkbox"
          checked={exam.signsOnly}
          onChange={(event) => exam.setParam("signs", event.target.checked ? "1" : null)}
        />
        <span>{t("print.exam_signsOnly")}</span>
      </label>
      <label className="print-inline-field">
        <span className="visually-hidden">{t("print.topic_choose")}</span>
        <select
          className="select"
          value={exam.topic ?? ""}
          onChange={(event) => exam.setParam("topic", event.target.value || null)}
        >
          <option value="">{t("print.exam_allTopics")}</option>
          {topicsInBank(exam.bank).map((topic) => (
            <option key={topic} value={topic}>
              {topicLabel(topic, lang)}
            </option>
          ))}
        </select>
      </label>
      <Link className="button button-secondary" to={`${link("print/answer-key")}?${exam.query}`}>
        <KeyRound size={18} aria-hidden />
        {t("print.exam_answerKey")}
      </Link>
    </>
  );

  return (
    <PrintLayout
      title={t("print.exam_title")}
      subtitle={t("print.exam_code", { code: String(exam.seed) })}
      controls={controls}
    >
      {total ? (
        <>
          <div className="print-fill-row">
            <span>{t("print.exam_name")}</span>
            <span className="print-fill-line" />
            <span>{t("print.exam_score")}</span>
            <span className="print-fill-box">
              ____ / {num(total)}
            </span>
          </div>
          <p className="print-instructions">
            {t("print.exam_instructions", { pass: passMark(exam.bank, total), total })}
            {exam.topic ? ` · ${topicLabel(exam.topic, lang)}` : ""}
            {exam.signsOnly ? ` · ${t("print.exam_signsOnly")}` : ""}
          </p>
          <div className="print-questions">
            {exam.questions.map((question, index) => (
              <PrintQuestion key={question.id} question={question} number={index + 1} />
            ))}
          </div>
          <p className="print-end">{t("print.exam_end", { code: String(exam.seed) })}</p>
        </>
      ) : (
        <PrintNotice title={t("print.exam_empty")}>
          <FileText aria-hidden />
        </PrintNotice>
      )}
    </PrintLayout>
  );
}

export function AnswerKeySheet() {
  const { t, num, lang } = useI18n();
  const { link } = useSchool();
  const { settings } = useSettings();
  const exam = useExamParams();
  const total = exam.questions.length;

  const controls = (
    <Link className="button button-secondary" to={`${link("print/exam")}?${exam.query}`}>
      <FileText size={18} aria-hidden />
      {t("print.key_backToExam")}
    </Link>
  );

  return (
    <PrintLayout
      title={t("print.key_title")}
      subtitle={t("print.exam_code", { code: String(exam.seed) })}
      controls={controls}
    >
      {total ? (
        <>
          <p className="print-instructions">
            {t("print.key_intro", { pass: passMark(exam.bank, total), total })}
          </p>
          <ol className="print-key-grid" aria-label={t("print.key_grid")}>
            {exam.questions.map((question, index) => {
              const view = displayQuestion(question, settings.questionLang);
              return (
                <li key={question.id}>
                  <span className="print-key-num">{num(index + 1)}</span>
                  <span className="print-key-letter">{optionLetter(view.lang, question.answer)}</span>
                </li>
              );
            })}
          </ol>
          <table className="print-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t("print.key_answer")}</th>
                <th scope="col">{t("print.key_topic")}</th>
                <th scope="col">{t("print.key_ref")}</th>
              </tr>
            </thead>
            <tbody>
              {exam.questions.map((question, index) => {
                const view = displayQuestion(question, settings.questionLang);
                return (
                  <tr key={question.id}>
                    <td>{num(index + 1)}</td>
                    <td>
                      <strong>{optionLetter(view.lang, question.answer)}</strong>{" "}
                      <span dir={view.dir} lang={view.lang}>
                        {view.options[question.answer]}
                      </span>
                    </td>
                    <td>{topicLabel(topicOf(question.id), lang)}</td>
                    <td className="nowrap">{num(question.id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <PrintNotice title={t("print.exam_empty")} />
      )}
    </PrintLayout>
  );
}
