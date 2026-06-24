import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildExam,
  cloneProgress,
  loadProgress,
  recordAnswer,
  recordExamResult,
  resetProgress,
  saveProgress,
  startExam,
  summary,
  weakestIds
} from "./domain/engine";
import type { ExamResult, ExamSession, ProgressState, Question, SessionAnswer } from "./domain/types";
import { QUESTIONS } from "./data/questions";
import { EXAM_SIZE, PASS_SCORE } from "./lib/format";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./components/Dashboard";
import { ExamView } from "./components/ExamView";
import { ResultsView } from "./components/ResultsView";
import { SettingsView } from "./components/SettingsView";
import { Toast } from "./components/Toast";

type ViewName = "dashboard" | "exam" | "results" | "settings";

const ALL_IDS = QUESTIONS.map((question) => question.id);
const QUESTIONS_BY_ID = new Map<number, Question>(
  QUESTIONS.map((question) => [question.id, question])
);
const SIGN_PREVIEW = QUESTIONS.filter((question) => question.sign).slice(0, 6);

export default function App() {
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const progressRef = useRef(progress);
  const [view, setView] = useState<ViewName>("dashboard");
  const [session, setSession] = useState<ExamSession | null>(null);
  const [lastResult, setLastResult] = useState<ExamResult | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const progressSummary = useMemo(() => summary(progress, ALL_IDS), [progress]);
  const weakQuestions = useMemo(() => weakestIds(progress, ALL_IDS, 8), [progress]);

  const commitProgress = useCallback((nextProgress: ProgressState) => {
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    saveProgress(nextProgress);
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return QUESTIONS_BY_ID.get(session.ids[session.index]) ?? null;
  }, [session]);

  const startOfficial = useCallback(() => {
    const nextProgress = cloneProgress(progressRef.current);
    const ids = buildExam(nextProgress, ALL_IDS, EXAM_SIZE);
    if (!ids.length) {
      showToast("تعذّر إنشاء الامتحان.");
      return;
    }

    startExam(nextProgress);
    commitProgress(nextProgress);
    setSession({ mode: "official", ids, index: 0, answers: {}, finished: false });
    setLastResult(null);
    setView("exam");
  }, [commitProgress, showToast]);

  const startReview = useCallback(() => {
    const weak = weakestIds(progressRef.current, ALL_IDS, EXAM_SIZE).map((item) => item.id);
    if (!weak.length) {
      showToast("ابدأ امتحاناً أولاً كي تظهر أسئلة للمراجعة.");
      return;
    }

    const nextProgress = cloneProgress(progressRef.current);
    startExam(nextProgress);
    commitProgress(nextProgress);
    setSession({ mode: "review", ids: weak, index: 0, answers: {}, finished: false });
    setLastResult(null);
    setView("exam");
  }, [commitProgress, showToast]);

  const chooseAnswer = useCallback(
    (selected: number) => {
      if (!session) return;
      const question = QUESTIONS_BY_ID.get(session.ids[session.index]);
      if (!question || session.answers[question.id]) return;

      const answer: SessionAnswer = {
        id: question.id,
        selected,
        correct: question.answer,
        ok: selected === question.answer
      };

      const nextProgress = cloneProgress(progressRef.current);
      recordAnswer(nextProgress, question.id, answer.ok);
      commitProgress(nextProgress);

      setSession({
        ...session,
        answers: {
          ...session.answers,
          [question.id]: answer
        }
      });
    },
    [commitProgress, session]
  );

  const finishSession = useCallback(() => {
    if (!session || session.finished) return;

    const answers = session.ids
      .map((id) => session.answers[id])
      .filter((answer): answer is SessionAnswer => Boolean(answer));
    const score = answers.filter((answer) => answer.ok).length;
    const passed = session.mode === "official" && score >= PASS_SCORE;

    const nextProgress = cloneProgress(progressRef.current);
    recordExamResult(nextProgress, score, session.ids.length, passed);
    const lastHistoryItem = nextProgress.history[nextProgress.history.length - 1];
    if (lastHistoryItem) {
      lastHistoryItem.mode = session.mode;
    }
    commitProgress(nextProgress);

    const result: ExamResult = {
      mode: session.mode,
      ids: session.ids.slice(),
      answers: session.answers,
      score,
      total: session.ids.length,
      passed
    };

    setLastResult(result);
    setSession(null);
    setView("results");
  }, [commitProgress, session]);

  const goNext = useCallback(() => {
    if (!session) return;
    const questionId = session.ids[session.index];
    if (!session.answers[questionId]) {
      showToast("اختر إجابة أولاً.");
      return;
    }

    if (session.index === session.ids.length - 1) {
      finishSession();
      return;
    }

    setSession({ ...session, index: session.index + 1 });
  }, [finishSession, session, showToast]);

  const quitExam = useCallback(() => {
    if (!session) {
      setView("dashboard");
      return;
    }

    if (window.confirm("هل تريد إنهاء هذه الجولة والعودة إلى الرئيسية؟ لن تُسجّل نتيجة الامتحان.")) {
      setSession(null);
      setView("dashboard");
    }
  }, [session]);

  const resetAllProgress = useCallback(() => {
    if (!window.confirm("هل تريد مسح كل التقدّم والبدء من جديد؟")) return;
    resetProgress();
    const freshProgress = loadProgress();
    progressRef.current = freshProgress;
    setProgress(freshProgress);
    setSession(null);
    setLastResult(null);
    setView("settings");
    showToast("تم مسح التقدّم.");
  }, [showToast]);

  const goDashboard = useCallback(() => {
    if (session) {
      quitExam();
      return;
    }
    setView("dashboard");
  }, [quitExam, session]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (!session || view !== "exam") return;
      if (event.key === "Enter") {
        goNext();
        return;
      }

      const keys: Record<string, number> = {
        "1": 0,
        "2": 1,
        "3": 2,
        "١": 0,
        "٢": 1,
        "٣": 2
      };

      if (Object.prototype.hasOwnProperty.call(keys, event.key)) {
        chooseAnswer(keys[event.key]);
      }
    };

    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [chooseAnswer, goNext, session, view]);

  return (
    <AppShell
      activeView={view}
      onHome={goDashboard}
      onSettings={() => setView("settings")}
      onStartExam={startOfficial}
    >
      {view === "dashboard" ? (
        <Dashboard
          history={progress.history}
          questionsById={QUESTIONS_BY_ID}
          signPreview={SIGN_PREVIEW}
          summary={progressSummary}
          weakQuestions={weakQuestions}
          onStartExam={startOfficial}
          onStartReview={startReview}
        />
      ) : null}

      {view === "exam" && session && currentQuestion ? (
        <ExamView
          answer={session.answers[currentQuestion.id]}
          question={currentQuestion}
          session={session}
          onChoose={chooseAnswer}
          onNext={goNext}
          onQuit={quitExam}
        />
      ) : null}

      {view === "results" && lastResult ? (
        <ResultsView
          questionsById={QUESTIONS_BY_ID}
          result={lastResult}
          onHome={() => setView("dashboard")}
          onReviewWrong={() => {
            const wrong = lastResult.ids.filter((id) => {
              const answer = lastResult.answers[id];
              return answer && !answer.ok;
            });
            if (!wrong.length) {
              showToast("لا توجد أخطاء في هذه الجولة.");
              return;
            }
            const nextProgress = cloneProgress(progressRef.current);
            startExam(nextProgress);
            commitProgress(nextProgress);
            setSession({
              mode: "review",
              ids: wrong,
              index: 0,
              answers: {},
              finished: false
            });
            setView("exam");
          }}
          onStartExam={startOfficial}
        />
      ) : null}

      {view === "settings" ? (
        <SettingsView
          summary={progressSummary}
          onReset={resetAllProgress}
        />
      ) : null}

      <Toast message={toast} />
    </AppShell>
  );
}
