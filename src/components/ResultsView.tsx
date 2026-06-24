import { BookOpenCheck, Home, Play, XCircle } from "lucide-react";
import type { ExamResult, Question, SessionAnswer } from "../domain/types";
import { arNum, PASS_SCORE, questionText } from "../lib/format";

interface ResultsViewProps {
  questionsById: Map<number, Question>;
  result: ExamResult;
  onHome: () => void;
  onReviewWrong: () => void;
  onStartExam: () => void;
}

export function ResultsView({
  questionsById,
  result,
  onHome,
  onReviewWrong,
  onStartExam
}: ResultsViewProps) {
  const percentage = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const wrongAnswers = result.ids
    .map((id) => result.answers[id])
    .filter((answer): answer is SessionAnswer => Boolean(answer && !answer.ok));
  const verdict = result.mode === "official" ? (result.passed ? "ناجح" : "راسب") : "انتهت المراجعة";
  const scoreColor = result.mode === "official" ? (result.passed ? "#15803d" : "#b42318") : "#0f766e";

  return (
    <main className="results-view">
      <section className="result-panel">
        <div
          className="score-ring"
          style={{
            "--score-color": scoreColor,
            "--score-percent": `${percentage}%`
          } as React.CSSProperties}
        >
          <div>
            <strong>{arNum(result.score)}</strong>
            <span>من {arNum(result.total)}</span>
          </div>
        </div>
        <div className="result-copy">
          <p className="eyebrow">{result.mode === "official" ? "نتيجة الامتحان" : "نتيجة المراجعة"}</p>
          <h2>{verdict}</h2>
          <p>
            {result.mode === "official" ? (
              <>
                علامة النجاح: {arNum(PASS_SCORE)}.
              </>
            ) : (
              "تم تحديث مستوى الإتقان بناءً على هذه الجولة."
            )}
          </p>
        </div>
        <div className="result-actions">
          <button className="button button-primary" type="button" onClick={onStartExam}>
            <Play aria-hidden="true" size={18} />
            امتحان جديد
          </button>
          <button className="button button-secondary" type="button" onClick={onReviewWrong}>
            <BookOpenCheck aria-hidden="true" size={18} />
            مراجعة الأخطاء
          </button>
          <button className="button button-ghost" type="button" onClick={onHome}>
            <Home aria-hidden="true" size={18} />
            الرئيسية
          </button>
        </div>
      </section>

      <section className="panel wrong-review">
        <div className="section-heading">
          <div>
            <p className="eyebrow">المراجعة</p>
            <h3>{wrongAnswers.length ? "الإجابات الخاطئة" : "لا توجد إجابات خاطئة"}</h3>
          </div>
          <XCircle aria-hidden="true" className="section-icon" size={20} />
        </div>

        {wrongAnswers.length ? (
          <div className="review-stack">
            {wrongAnswers.map((answer) => {
              const question = questionsById.get(answer.id);
              if (!question) return null;
              return (
                <article className="wrong-item" key={answer.id}>
                  {question.sign ? (
                    <img src={question.sign} alt={`إشارة السؤال رقم ${arNum(question.id)}`} />
                  ) : null}
                  <div>
                    <h4>{arNum(question.id)} - {questionText(question)}</h4>
                    <p><span>إجابتك</span>{question.options[answer.selected]}</p>
                    <p><span>الصحيح</span>{question.options[answer.correct]}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">كل الإجابات في هذه الجولة كانت صحيحة.</p>
        )}
      </section>
    </main>
  );
}
