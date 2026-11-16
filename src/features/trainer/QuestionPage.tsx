import { ArrowRight, ArrowLeft, Eye } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { QUESTIONS_BY_ID } from "../../data/banks";
import { useI18n } from "../../i18n/useI18n";
import { QuestionCard } from "./components/QuestionCard";

/** Study a single question: try it, then see the explanation. Does not change progress stats. */
export function QuestionPage() {
  const { id } = useParams();
  const { t, num, dir } = useI18n();
  const { progress } = useProfile();
  const { link } = useSchool();
  const navigate = useNavigate();
  const question = QUESTIONS_BY_ID.get(Number(id));
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  if (!question) return <Navigate to={link("")} replace />;
  const stat = progress.questions[question.id];
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <main className="page">
      <div className="row between">
        <button className="button button-ghost" type="button" onClick={() => navigate(-1)}>
          <BackIcon aria-hidden="true" size={18} />
          {t("common.back")}
        </button>
        {stat ? (
          <span className="muted small">
            {t("trainer.questionStats", { seen: stat.seen, correct: stat.correct, wrong: stat.wrong })}
          </span>
        ) : null}
      </div>
      <QuestionCard
        key={question.id}
        question={question}
        selected={revealed && selected === null ? question.answer : selected}
        reveal={selected !== null || revealed}
        onChoose={(index) => setSelected(index)}
        heading={t("trainer.questionNumber", { n: num(question.id) })}
      />
      <div className="row">
        {selected === null && !revealed ? (
          <button className="button button-ghost" type="button" onClick={() => setRevealed(true)}>
            <Eye aria-hidden="true" size={18} />
            {t("trainer.showAnswer")}
          </button>
        ) : (
          <button
            className="button button-ghost"
            type="button"
            onClick={() => {
              setSelected(null);
              setRevealed(false);
            }}
          >
            {t("trainer.tryAgain")}
          </button>
        )}
        <Link className="button button-secondary" to={link("notebook")}>
          {t("common.navNotebook")}
        </Link>
      </div>
      <p className="muted small">{t("trainer.studyModeNote")}</p>
    </main>
  );
}
