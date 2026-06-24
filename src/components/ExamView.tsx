import { ArrowLeft, LogOut } from "lucide-react";
import type { ExamSession, Question, SessionAnswer } from "../domain/types";
import { arNum, questionText } from "../lib/format";

interface ExamViewProps {
  answer?: SessionAnswer;
  question: Question;
  session: ExamSession;
  onChoose: (selected: number) => void;
  onNext: () => void;
  onQuit: () => void;
}

export function ExamView({ answer, question, session, onChoose, onNext, onQuit }: ExamViewProps) {
  const percentage = Math.round((session.index / session.ids.length) * 100);
  const isLastQuestion = session.index === session.ids.length - 1;

  return (
    <main className="exam-view">
      <div className="exam-status">
        <div>
          <span className="eyebrow">{session.mode === "review" ? "مراجعة" : "امتحان رسمي"}</span>
          <h2>السؤال {arNum(session.index + 1)}</h2>
        </div>
        <button className="button button-ghost" type="button" onClick={onQuit}>
          <LogOut aria-hidden="true" size={18} />
          خروج
        </button>
      </div>

      <div className="progress-track exam-progress" aria-label="تقدّم الامتحان">
        <span style={{ width: `${percentage}%` }} />
      </div>

      <section className="question-panel">
        <div className="question-meta">سؤال رقم {arNum(question.id)}</div>
        {question.sign ? (
          <div className="question-sign">
            <img src={question.sign} alt={`إشارة السؤال رقم ${arNum(question.id)}`} />
          </div>
        ) : null}
        <h3>{questionText(question)}</h3>

        <div className="option-list">
          {question.options.map((option, index) => {
            const state = getOptionState(answer, index);
            return (
              <button
                className={`option-button ${state}`}
                disabled={Boolean(answer)}
                key={option}
                type="button"
                onClick={() => onChoose(index)}
              >
                <span className="option-marker">{arNum(index + 1)}</span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        <div className="question-footer">
          <Feedback answer={answer} question={question} />
          <button
            className="button button-primary next-button"
            disabled={!answer}
            type="button"
            onClick={onNext}
          >
            {isLastQuestion ? "عرض النتيجة" : "التالي"}
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
        </div>
      </section>
    </main>
  );
}

function getOptionState(answer: SessionAnswer | undefined, index: number): string {
  if (!answer) return "";
  if (index === answer.correct) return "is-correct";
  if (index === answer.selected) return "is-wrong";
  return "is-muted";
}

interface FeedbackProps {
  answer?: SessionAnswer;
  question: Question;
}

function Feedback({ answer, question }: FeedbackProps) {
  if (!answer) return <p className="feedback muted">اختر الإجابة المناسبة.</p>;

  if (answer.ok) {
    return <p className="feedback success">إجابة صحيحة.</p>;
  }

  return (
    <p className="feedback danger">
      الإجابة الصحيحة: <strong>{question.options[answer.correct]}</strong>
    </p>
  );
}
