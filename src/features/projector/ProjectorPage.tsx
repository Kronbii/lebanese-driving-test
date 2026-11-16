import {
  ChevronLeft,
  ChevronRight,
  Contrast,
  Eye,
  EyeOff,
  Keyboard,
  Lightbulb,
  ListChecks,
  LogOut,
  Maximize,
  Minimize,
  RotateCcw,
  Shuffle,
  Signpost,
  Target
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useSettings } from "../../app/SettingsContext";
import { BANKS, QUESTIONS_BY_ID } from "../../data/banks";
import { topicOf } from "../../data/content";
import { weakestIds } from "../../domain/engine";
import type { Question, TopicId } from "../../domain/types";
import { useI18n } from "../../i18n/useI18n";
import { displayQuestion, explanationText, optionLetter, shuffled, topicLabel, topicsInBank } from "../print/lib";

const SET_SIZE = 20;
const TOPIC_MAX = 30;

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

function digitOf(key: string): number | null {
  if (/^[0-9]$/.test(key)) return Number(key);
  const index = ARABIC_INDIC.indexOf(key);
  return index >= 0 ? index : null;
}

/** Runs a control-bar action; drops focus after a mouse click so Space keeps meaning "reveal". */
function press(action: () => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    action();
    if (event.detail > 0) event.currentTarget.blur();
  };
}

/** Classroom projector mode: one big question per screen, answer hidden until revealed. No accounts. */
export function ProjectorPage() {
  const { t } = useI18n();
  const { link, can } = useSchool();
  const navigate = useNavigate();
  const [ids, setIds] = useState<number[] | null>(null);
  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    navigate(link(""));
  }, [link, navigate]);

  if (!can("projector")) {
    return (
      <main className="projector-setup">
        <div className="card stack">
          <h1 className="projector-setup-title">{t("projector.title")}</h1>
          <p className="notice warning">{t("projector.disabled")}</p>
          <button type="button" className="button" onClick={exit}>
            <LogOut size={18} aria-hidden />
            {t("projector.exit")}
          </button>
        </div>
      </main>
    );
  }

  if (!ids) return <ProjectorSetup onStart={setIds} onExit={exit} />;
  return <ProjectorShow ids={ids} onNewSet={() => setIds(null)} onExit={exit} />;
}

function ProjectorSetup({ onStart, onExit }: { onStart: (ids: number[]) => void; onExit: () => void }) {
  const { t, num, lang } = useI18n();
  const { settings } = useSettings();
  const { progress } = useProfile();
  const bank = BANKS[settings.bank];
  const topics = topicsInBank(settings.bank);
  const [topic, setTopic] = useState<TopicId | "">(topics[0] ?? "");

  const pools = useMemo(() => {
    const all = bank.questions.map((question) => question.id);
    return {
      all,
      signs: bank.questions.filter((question) => question.sign).map((question) => question.id),
      weak: weakestIds(progress, all, SET_SIZE)
        .filter((item) => item.wrong > 0 || item.level <= 2)
        .map((item) => item.id)
    };
  }, [bank, progress]);

  const topicIds = topic ? pools.all.filter((id) => topicOf(id) === topic) : [];

  return (
    <main className="projector-setup">
      <div className="stack projector-setup-inner">
        <header className="row between">
          <div>
            <h1 className="projector-setup-title">{t("projector.title")}</h1>
            <p className="muted">{t("projector.intro")}</p>
          </div>
          <button type="button" className="button button-ghost" onClick={onExit}>
            <LogOut size={18} aria-hidden />
            {t("projector.exit")}
          </button>
        </header>

        <div className="grid cols-2">
          <button
            type="button"
            className="list-row projector-choice"
            onClick={() => onStart(shuffled(pools.all).slice(0, SET_SIZE))}
          >
            <Shuffle aria-hidden />
            <span className="stack tight">
              <strong>{t("projector.set_random", { n: SET_SIZE })}</strong>
              <span className="small muted">{t("projector.set_randomHint", { total: pools.all.length })}</span>
            </span>
          </button>
          <button
            type="button"
            className="list-row projector-choice"
            disabled={!pools.signs.length}
            onClick={() => onStart(shuffled(pools.signs).slice(0, SET_SIZE))}
          >
            <Signpost aria-hidden />
            <span className="stack tight">
              <strong>{t("projector.set_signs")}</strong>
              <span className="small muted">{t("projector.set_signsHint", { n: Math.min(SET_SIZE, pools.signs.length) })}</span>
            </span>
          </button>
          <button
            type="button"
            className="list-row projector-choice"
            disabled={!pools.weak.length}
            onClick={() => onStart(shuffled(pools.weak))}
          >
            <Target aria-hidden />
            <span className="stack tight">
              <strong>{t("projector.set_weak")}</strong>
              <span className="small muted">
                {pools.weak.length ? t("projector.set_weakHint", { n: pools.weak.length }) : t("projector.set_weakEmpty")}
              </span>
            </span>
          </button>
          <div className="list-row projector-choice projector-topic">
            <ListChecks aria-hidden />
            <div className="stack tight grow">
              <label className="field">
                <span>{t("projector.set_topic")}</span>
                <select
                  className="select"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value as TopicId | "")}
                >
                  {topics.map((id) => (
                    <option key={id} value={id}>
                      {topicLabel(id, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button button-primary"
                disabled={!topicIds.length}
                onClick={() => onStart(shuffled(topicIds).slice(0, TOPIC_MAX))}
              >
                {t("projector.set_topicStart", { n: Math.min(TOPIC_MAX, topicIds.length) })}
              </button>
            </div>
          </div>
        </div>

        <section className="card flat stack tight projector-keys">
          <h2 className="card-title">
            <Keyboard aria-hidden />
            {t("projector.keys_title")}
          </h2>
          <ul className="projector-key-list">
            <li><kbd>{t("projector.keys_space")}</kbd> {t("projector.keys_reveal")}</li>
            <li><kbd>←</kbd> <kbd>→</kbd> <kbd>PgUp</kbd> <kbd>PgDn</kbd> {t("projector.keys_navigate")}</li>
            <li><kbd>{num(1)}</kbd>–<kbd>{num(3)}</kbd> {t("projector.keys_highlight")}</li>
            <li><kbd>E</kbd> {t("projector.keys_explanation")}</li>
            <li><kbd>H</kbd> {t("projector.keys_contrast")}</li>
            <li><kbd>F</kbd> {t("projector.keys_fullscreen")}</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function ProjectorShow({ ids, onNewSet, onExit }: { ids: number[]; onNewSet: () => void; onExit: () => void }) {
  const { t, num, dir } = useI18n();
  const { settings } = useSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [highContrast, setHighContrast] = useState(settings.highContrast);
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));

  const questions = useMemo(
    () => ids.map((id) => QUESTIONS_BY_ID.get(id)).filter((question): question is Question => Boolean(question)),
    [ids]
  );
  const total = questions.length;
  const finished = index >= total;
  const question = finished ? null : questions[index];
  const explanationLang = settings.explanationLang === "ui" ? settings.lang : settings.explanationLang;

  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total, next)));
      setRevealed(false);
      setHighlight(null);
    },
    [total]
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const previous = useCallback(() => go(index - 1), [go, index]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void rootRef.current?.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const onControl = tag === "BUTTON" || tag === "A";
      const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";

      if (event.key === " " || event.key === "Enter") {
        if (onControl) return;
        event.preventDefault();
        if (finished) return;
        if (revealed) next();
        else setRevealed(true);
        return;
      }
      if (event.key === forward || event.key === "PageDown") {
        event.preventDefault();
        next();
        return;
      }
      if (event.key === backward || event.key === "PageUp") {
        event.preventDefault();
        previous();
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        go(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        go(total - 1);
        return;
      }
      const digit = digitOf(event.key);
      if (digit !== null && question && digit >= 1 && digit <= question.options.length) {
        setHighlight((current) => (current === digit - 1 ? null : digit - 1));
        return;
      }
      switch (event.code) {
        case "KeyR":
          if (!finished) setRevealed((current) => !current);
          break;
        case "KeyE":
          setShowExplanation((current) => !current);
          break;
        case "KeyH":
        case "KeyC":
          setHighContrast((current) => !current);
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dir, finished, go, next, previous, question, revealed, toggleFullscreen, total]);

  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  const view = question ? displayQuestion(question, settings.questionLang) : null;
  const explanation = question && revealed && showExplanation ? explanationText(question.id, explanationLang) : null;

  return (
    <div ref={rootRef} className={`projector${highContrast ? " projector-hc" : ""}`} dir={dir}>
      <div className="projector-bar" role="toolbar" aria-label={t("projector.controls")}>
        <span className="projector-progress-text" aria-live="polite">
          {finished ? t("projector.done") : t("projector.progress", { n: index + 1, total })}
        </span>
        <span className="projector-progress" aria-hidden>
          <span style={{ inlineSize: `${(Math.min(index + (revealed ? 1 : 0.5), total) / Math.max(total, 1)) * 100}%` }} />
        </span>
        <div className="projector-buttons">
          <button type="button" className="icon-button" onClick={press(previous)} disabled={index === 0} aria-label={t("projector.previous")} title={t("projector.previous")}>
            <PrevIcon aria-hidden />
          </button>
          <button
            type="button"
            className="button button-primary projector-reveal"
            onClick={press(() => setRevealed((current) => !current))}
            disabled={finished}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            {revealed ? t("projector.hide") : t("projector.reveal")}
          </button>
          <button type="button" className="icon-button" onClick={press(next)} disabled={finished} aria-label={t("projector.next")} title={t("projector.next")}>
            <NextIcon aria-hidden />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={press(() => setShowExplanation((current) => !current))}
            aria-pressed={showExplanation}
            aria-label={t("projector.explanationToggle")}
            title={t("projector.explanationToggle")}
          >
            <Lightbulb aria-hidden />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={press(() => setHighContrast((current) => !current))}
            aria-pressed={highContrast}
            aria-label={t("projector.contrast")}
            title={t("projector.contrast")}
          >
            <Contrast aria-hidden />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={press(toggleFullscreen)}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? t("projector.exitFullscreen") : t("projector.fullscreen")}
            title={fullscreen ? t("projector.exitFullscreen") : t("projector.fullscreen")}
          >
            {fullscreen ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
          </button>
          <button type="button" className="icon-button" onClick={press(onExit)} aria-label={t("projector.exit")} title={t("projector.exit")}>
            <LogOut aria-hidden />
          </button>
        </div>
      </div>

      {question && view ? (
        <main className="projector-stage" aria-live="polite">
          <p className="projector-number">{t("projector.questionLabel", { n: index + 1 })}</p>
          <div className={`projector-question${question.sign ? " has-sign" : ""}`}>
            {question.sign ? (
              <img className="projector-sign sign-img" src={question.sign} alt={t("projector.signAlt", { n: question.id })} />
            ) : null}
            <div className="projector-text-wrap">
              <h1 className="projector-text" dir={view.dir} lang={view.lang}>
                {view.text}
              </h1>
              {view.translated ? (
                <p className="projector-official" dir="rtl" lang="ar">
                  {view.officialText}
                </p>
              ) : null}
            </div>
          </div>
          <ol className="projector-options">
            {view.options.map((option, optionIndex) => {
              const isCorrect = revealed && optionIndex === question.answer;
              const isWrongPick = revealed && highlight === optionIndex && optionIndex !== question.answer;
              const className = [
                "projector-option",
                highlight === optionIndex ? "highlighted" : "",
                isCorrect ? "correct" : "",
                isWrongPick ? "wrong" : "",
                revealed && !isCorrect ? "dimmed" : ""
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <li key={optionIndex}>
                  <button
                    type="button"
                    className={className}
                    aria-pressed={highlight === optionIndex}
                    onClick={press(() => setHighlight((current) => (current === optionIndex ? null : optionIndex)))}
                  >
                    <span className="projector-letter">{optionLetter(view.lang, optionIndex)}</span>
                    <span className="projector-option-text">
                      <span dir={view.dir} lang={view.lang}>
                        {option}
                      </span>
                      {view.translated ? (
                        <span className="projector-option-official" dir="rtl" lang="ar">
                          {view.officialOptions[optionIndex]}
                        </span>
                      ) : null}
                    </span>
                    {isCorrect ? <span className="visually-hidden">{t("projector.correct")}</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
          {explanation ? (
            <aside className="projector-explanation" lang={explanationLang} dir={explanationLang === "ar" ? "rtl" : "ltr"}>
              <Lightbulb aria-hidden />
              <p>{explanation}</p>
            </aside>
          ) : null}
        </main>
      ) : (
        <main className="projector-stage projector-end">
          <h1 className="projector-text">{t("projector.endTitle")}</h1>
          <p className="projector-official">{t("projector.endBody", { total })}</p>
          <div className="row projector-end-actions">
            <button type="button" className="button button-primary" onClick={() => go(0)}>
              <RotateCcw size={18} aria-hidden />
              {t("projector.restart")}
            </button>
            <button type="button" className="button button-secondary" onClick={onNewSet}>
              <Shuffle size={18} aria-hidden />
              {t("projector.newSet")}
            </button>
            <button type="button" className="button button-ghost" onClick={onExit}>
              <LogOut size={18} aria-hidden />
              {t("projector.exit")}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}

export default ProjectorPage;
