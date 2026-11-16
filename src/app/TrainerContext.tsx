import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { trackEvent } from "../api/client";
import { BANKS, QUESTIONS_BY_ID } from "../data/banks";
import { questionMeta } from "../data/meta";
import { recordAnswer, recordExamResult, startExam } from "../domain/engine";
import { awardBadges } from "../domain/gamification";
import { buildSessionIds, MODES } from "../domain/modes";
import type { ExamMode, ExamResult, ExamSession, SessionAnswer, TopicId } from "../domain/types";
import { useProfile } from "./ProfileContext";
import { useSchool } from "./SchoolContext";
import { useSettings } from "./SettingsContext";

export interface StartOptions {
  topic?: TopicId;
  /** Explicit question ids (e.g. "review the mistakes of this result"). */
  ids?: number[];
}

interface TrainerContextValue {
  session: ExamSession | null;
  result: ExamResult | null;
  /** Returns false when the mode has no questions to offer yet. */
  start: (mode: ExamMode, options?: StartOptions) => boolean;
  choose: (selected: number) => void;
  next: () => void;
  previous: () => void;
  finish: (timedOut?: boolean) => void;
  quit: () => void;
  clearResult: () => void;
}

const TrainerContext = createContext<TrainerContextValue | null>(null);

const SESSION_KEY = "ldt_session_v1";

function loadSession(profileId: string): ExamSession | null {
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_KEY}:${profileId}`);
    return raw ? (JSON.parse(raw) as ExamSession) : null;
  } catch {
    return null;
  }
}

function storeSession(profileId: string, session: ExamSession | null) {
  try {
    const key = `${SESSION_KEY}:${profileId}`;
    if (session) window.sessionStorage.setItem(key, JSON.stringify(session));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Session survives only in memory.
  }
}

export function TrainerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { active, mutate } = useProfile();
  const { slug } = useSchool();
  const [session, setSessionState] = useState<ExamSession | null>(() => loadSession(active.id));
  const [result, setResult] = useState<ExamResult | null>(null);
  const sessionRef = useRef(session);

  const setSession = useCallback(
    (next: ExamSession | null) => {
      sessionRef.current = next;
      setSessionState(next);
      storeSession(active.id, next);
    },
    [active.id]
  );

  useEffect(() => {
    const loaded = loadSession(active.id);
    sessionRef.current = loaded;
    setSessionState(loaded);
    setResult(null);
  }, [active.id]);

  const start = useCallback(
    (mode: ExamMode, options: StartOptions = {}) => {
      const bank = BANKS[settings.bank];
      const meta = questionMeta(settings.bank);
      let ids: number[] = [];
      const next = mutate((draft) => {
        ids = options.ids?.length
          ? options.ids.slice()
          : buildSessionIds(mode, draft, meta, { size: bank.examSize, topic: options.topic });
        if (ids.length) startExam(draft);
      });
      void next;
      if (!ids.length) return false;
      const now = Date.now();
      const config = MODES[mode];
      setSession({
        mode,
        ids,
        index: 0,
        answers: {},
        finished: false,
        startedAt: now,
        deadline: config.timed ? now + settings.timerMinutes * 60_000 : undefined,
        topic: options.topic,
        bank: settings.bank
      });
      setResult(null);
      return true;
    },
    [mutate, setSession, settings.bank, settings.timerMinutes]
  );

  const choose = useCallback(
    (selected: number) => {
      const current = sessionRef.current;
      if (!current || current.finished) return;
      const id = current.ids[current.index];
      const question = QUESTIONS_BY_ID.get(id);
      if (!question || current.answers[id]) return;
      const answer: SessionAnswer = {
        id,
        selected,
        correct: question.answer,
        ok: selected === question.answer
      };
      mutate((draft) => recordAnswer(draft, id, answer.ok, { selected }));
      setSession({ ...current, answers: { ...current.answers, [id]: answer } });
    },
    [mutate, setSession]
  );

  const finish = useCallback(
    (timedOut = false) => {
      const current = sessionRef.current;
      if (!current || current.finished) return;
      const bank = BANKS[current.bank ?? settings.bank];
      const config = MODES[current.mode];
      const answers = Object.values(current.answers);
      const score = answers.filter((answer) => answer.ok).length;
      const total = current.ids.length;
      const passRatio = bank.passScore / bank.examSize;
      const passed = config.counts && score >= Math.ceil(total * passRatio);
      const now = Date.now();
      const durationMs = current.startedAt ? now - current.startedAt : undefined;
      let signCorrect = 0;
      let signTotal = 0;
      for (const id of current.ids) {
        if (!QUESTIONS_BY_ID.get(id)?.sign) continue;
        signTotal += 1;
        if (current.answers[id]?.ok) signCorrect += 1;
      }
      let newBadges: string[] = [];
      mutate((draft) => {
        recordExamResult(draft, score, total, passed, now, {
          mode: current.mode,
          durationMs,
          timed: config.timed,
          signCorrect,
          signTotal
        });
        newBadges = awardBadges(draft, questionMeta(current.bank ?? settings.bank), now);
      });
      if (config.counts) {
        trackEvent("exam_completed", slug);
        if (passed) trackEvent("exam_passed", slug);
      }
      setResult({
        mode: current.mode,
        ids: current.ids.slice(),
        answers: current.answers,
        score,
        total,
        passed,
        counted: config.counts,
        durationMs,
        timedOut,
        topic: current.topic,
        newBadges
      });
      setSession(null);
    },
    [mutate, setSession, settings.bank, slug]
  );

  const next = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const id = current.ids[current.index];
    if (!current.answers[id]) return;
    if (current.index >= current.ids.length - 1) {
      finish(false);
      return;
    }
    setSession({ ...current, index: current.index + 1 });
  }, [finish, setSession]);

  const previous = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.index === 0) return;
    setSession({ ...current, index: current.index - 1 });
  }, [setSession]);

  const quit = useCallback(() => setSession(null), [setSession]);
  const clearResult = useCallback(() => setResult(null), []);

  const value = useMemo(
    () => ({ session, result, start, choose, next, previous, finish, quit, clearResult }),
    [session, result, start, choose, next, previous, finish, quit, clearResult]
  );
  return <TrainerContext.Provider value={value}>{children}</TrainerContext.Provider>;
}

export function useTrainer(): TrainerContextValue {
  const context = useContext(TrainerContext);
  if (!context) throw new Error("useTrainer must be used inside TrainerProvider");
  return context;
}
