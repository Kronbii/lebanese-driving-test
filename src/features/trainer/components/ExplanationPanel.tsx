import { CheckCircle2, Lightbulb, MessageCircleQuestion, PlayCircle, Sparkles, TriangleAlert, Volume2, XCircle } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "../../../api/client";
import { useSchool } from "../../../app/SchoolContext";
import { explanationFor, tipFor, whyWrongFor } from "../../../data/content";
import type { Question } from "../../../domain/types";
import { LANG_INFO } from "../../../i18n/core";
import { useI18n } from "../../../i18n/useI18n";
import { canSpeak, speak } from "../../../lib/speech";
import { useAiAvailable, useExplanationLang, useQuestionView, useSchoolNotes } from "../hooks";

/** Explanation after answering: why the answer is right, why the pick was wrong, tips, school notes, AI tutor. */
export function ExplanationPanel({ question, selected }: { question: Question; selected: number | null }) {
  const { t } = useI18n();
  const lang = useExplanationLang();
  const view = useQuestionView(question);
  const schoolNotes = useSchoolNotes().get(question.id) ?? [];
  const aiAvailable = useAiAvailable();
  const { slug } = useSchool();
  const [ai, setAi] = useState<{ status: "idle" | "loading" | "done" | "error"; text: string }>({
    status: "idle",
    text: ""
  });

  const ok = selected === question.answer;
  const explanation = explanationFor(question.id, lang);
  const whyWrong = !ok && selected !== null ? whyWrongFor(question.id, lang, selected) : null;
  const tip = tipFor(question.id, lang);
  const dir = LANG_INFO[lang].dir;
  const correctText = view?.options[question.answer] ?? question.options[question.answer];

  const askAi = async (style: "simple" | "nervous") => {
    setAi({ status: "loading", text: "" });
    try {
      const response = await api<{ text: string }>("/ai/explain", {
        body: { questionId: question.id, selected, style, lang, schoolSlug: slug }
      });
      setAi({ status: "done", text: response.text });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "server_error";
      setAi({ status: "error", text: t(code === "rate_limited" ? "trainer.aiRateLimited" : "trainer.aiError") });
    }
  };

  return (
    <div className="explanation-panel" aria-live="polite">
      <p className={`feedback ${ok ? "success" : "danger"}`}>
        {ok ? <CheckCircle2 aria-hidden="true" size={18} /> : <XCircle aria-hidden="true" size={18} />}
        {ok ? t("trainer.correct") : t("trainer.wrongAnswer")}
        {!ok ? (
          <>
            {" "}
            {t("trainer.correctIs")} <strong lang={view?.lang} dir={view?.dir}>{correctText}</strong>
          </>
        ) : null}
      </p>

      {explanation ? (
        <div className="explain-block" lang={lang} dir={dir}>
          <div className="explain-label">
            <Lightbulb aria-hidden="true" size={16} />
            {t("trainer.whyCorrect")}
            {canSpeak() ? (
              <button
                type="button"
                className="link-button"
                onClick={() => speak(explanation, lang)}
                aria-label={t("trainer.readAloud")}
              >
                <Volume2 aria-hidden="true" size={14} />
              </button>
            ) : null}
          </div>
          <p>{explanation}</p>
          {whyWrong ? (
            <>
              <div className="explain-label danger">
                <XCircle aria-hidden="true" size={16} />
                {t("trainer.whyYourPickWrong")}
              </div>
              <p>{whyWrong}</p>
            </>
          ) : null}
          {tip ? (
            <p className="tip">
              <TriangleAlert aria-hidden="true" size={16} />
              <span>{tip}</span>
            </p>
          ) : null}
          <p className="explain-disclaimer">{t("trainer.explanationDisclaimer")}</p>
        </div>
      ) : null}

      {schoolNotes.length ? (
        <div className="school-notes">
          <div className="explain-label">
            <MessageCircleQuestion aria-hidden="true" size={16} />
            {t("trainer.instructorNote")}
          </div>
          {schoolNotes.map((note, index) => (
            <div key={index} className="stack tight">
              <p>{note.body}</p>
              {note.videoUrl ? (
                <a href={note.videoUrl} target="_blank" rel="noopener noreferrer" className="row">
                  <PlayCircle aria-hidden="true" size={16} />
                  {t("trainer.watchVideo")}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {aiAvailable ? (
        <div className="ai-tutor">
          {ai.status === "idle" || ai.status === "error" ? (
            <div className="row">
              <button className="button button-ghost compact" type="button" onClick={() => void askAi("simple")}>
                <Sparkles aria-hidden="true" size={16} />
                {t("trainer.aiExplain")}
              </button>
              <button className="button button-ghost compact" type="button" onClick={() => void askAi("nervous")}>
                {t("trainer.aiNervous")}
              </button>
            </div>
          ) : null}
          {ai.status === "loading" ? <span className="spinner" aria-label={t("common.loading")} /> : null}
          {ai.status === "done" ? (
            <div className="explain-block ai" lang={lang} dir={dir}>
              <div className="explain-label">
                <Sparkles aria-hidden="true" size={16} />
                {t("trainer.aiLabel")}
              </div>
              <p>{ai.text}</p>
            </div>
          ) : null}
          {ai.status === "error" ? <p className="form-error small">{ai.text}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
