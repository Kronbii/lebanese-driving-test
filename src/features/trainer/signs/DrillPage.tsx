import { Play, Timer, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../../app/ProfileContext";
import { useSchool } from "../../../app/SchoolContext";
import { recordAnswer, shuffle } from "../../../domain/engine";
import { useI18n } from "../../../i18n/useI18n";
import { useQuestionView } from "../hooks";
import { useSigns, type SignItem } from "./signData";

const DRILL_SECONDS = 60;

function bestKey(profileId: string) {
  return `ldt_drill_best:${profileId}`;
}

/** 60-second signs speed drill. Answers count towards the learner's progress. */
export function DrillPage() {
  const { t, num } = useI18n();
  const { active, mutate } = useProfile();
  const { link } = useSchool();
  const signs = useSigns();
  const [phase, setPhase] = useState<"ready" | "running" | "done">("ready");
  const [queue, setQueue] = useState<SignItem[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [left, setLeft] = useState(DRILL_SECONDS);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const endAt = useRef(0);
  const [best, setBest] = useState(() => {
    try {
      return Number(window.localStorage.getItem(bestKey(active.id))) || 0;
    } catch {
      return 0;
    }
  });

  const current = queue[index];
  const view = useQuestionView(current?.question);

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) setPhase("done");
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") return;
    if (score.right > best) {
      setBest(score.right);
      try {
        window.localStorage.setItem(bestKey(active.id), String(score.right));
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const begin = () => {
    setQueue(shuffle(signs));
    setIndex(0);
    setScore({ right: 0, total: 0 });
    setLeft(DRILL_SECONDS);
    endAt.current = Date.now() + DRILL_SECONDS * 1000;
    setPhase("running");
  };

  const answer = (option: number) => {
    if (!current || phase !== "running") return;
    const ok = option === current.question.answer;
    mutate((draft) => recordAnswer(draft, current.id, ok, { selected: option }));
    setScore((value) => ({ right: value.right + (ok ? 1 : 0), total: value.total + 1 }));
    setFlash(ok ? "right" : "wrong");
    window.setTimeout(() => setFlash(null), 250);
    setIndex((value) => (value + 1) % queue.length);
  };

  return (
    <main className="page drill-page">
      <header className="page-header">
        <div>
          <Link to={link("signs")} className="eyebrow">
            {t("common.navSigns")}
          </Link>
          <h2>{t("signs.drill")}</h2>
          <p>{t("signs.drillBest", { n: best })}</p>
        </div>
        {phase === "running" ? (
          <span className={`chip timer ${left <= 10 ? "danger" : ""}`}>
            <Timer aria-hidden="true" size={16} />
            {num(left)}
          </span>
        ) : null}
      </header>

      {phase === "ready" ? (
        <section className="card stack center">
          <p>{t("signs.drillIntro", { s: DRILL_SECONDS })}</p>
          <button className="button button-primary" type="button" onClick={begin}>
            <Play aria-hidden="true" size={18} />
            {t("signs.drillStart")}
          </button>
        </section>
      ) : null}

      {phase === "running" && current && view ? (
        <section className={`card stack drill-card ${flash ? `flash-${flash}` : ""}`}>
          <img className="sign-img drill-img" src={current.image} alt="" />
          <div className="option-list" lang={view.lang} dir={view.dir}>
            {view.options.map((option, optionIndex) => (
              <button key={optionIndex} type="button" className="option-button" onClick={() => answer(optionIndex)}>
                <span className="option-marker">{num(optionIndex + 1)}</span>
                <span>{option}</span>
              </button>
            ))}
          </div>
          <p className="muted small center">{t("signs.score", { right: score.right, total: score.total })}</p>
        </section>
      ) : null}

      {phase === "done" ? (
        <section className="card stack center">
          <Trophy aria-hidden="true" size={36} className="trophy" />
          <h3>{t("signs.drillResult", { right: score.right, total: score.total })}</h3>
          {score.right >= best && score.right > 0 ? <span className="badge success">{t("signs.newBest")}</span> : null}
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="button button-primary" type="button" onClick={begin}>
              {t("signs.drillAgain")}
            </button>
            <Link className="button button-ghost" to={link("signs/flashcards")}>
              {t("signs.flashcards")}
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
