import { ArrowLeft, ArrowRight, Repeat2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../../app/ProfileContext";
import { useSchool } from "../../../app/SchoolContext";
import { gradeCard } from "../../../domain/flashcards";
import { shuffle } from "../../../domain/engine";
import { useI18n } from "../../../i18n/useI18n";
import { useSigns, type SignItem } from "./signData";

interface Round {
  target: SignItem;
  choices: SignItem[];
}

/** Reverse mode: read the meaning, pick the matching sign out of three. */
export function ReversePage() {
  const { t, num, dir } = useI18n();
  const { mutate } = useProfile();
  const { link } = useSchool();
  const signs = useSigns();

  const makeRound = useCallback((): Round | null => {
    if (signs.length < 3) return null;
    const target = signs[Math.floor(Math.random() * signs.length)];
    // Prefer distractors from the same family so the choice is meaningful.
    const sameFamily = signs.filter((sign) => sign.topic === target.topic && sign.id !== target.id);
    const others = signs.filter((sign) => sign.topic !== target.topic);
    const distractors = shuffle(sameFamily).concat(shuffle(others)).slice(0, 2);
    return { target, choices: shuffle([target, ...distractors]) };
  }, [signs]);

  const [round, setRound] = useState<Round | null>(() => makeRound());
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const NextIcon = dir === "rtl" ? ArrowLeft : ArrowRight;

  const pick = (sign: SignItem) => {
    if (!round || picked !== null) return;
    const ok = sign.id === round.target.id;
    setPicked(sign.id);
    setScore((current) => ({ right: current.right + (ok ? 1 : 0), total: current.total + 1 }));
    mutate((draft) => gradeCard(draft, round.target.id, ok));
  };

  const next = () => {
    setRound(makeRound());
    setPicked(null);
  };

  const status = useMemo(() => {
    if (!round || picked === null) return null;
    return picked === round.target.id ? "right" : "wrong";
  }, [picked, round]);

  if (!round) return null;

  return (
    <main className="page reverse-page">
      <header className="page-header">
        <div>
          <Link to={link("signs")} className="eyebrow">
            {t("common.navSigns")}
          </Link>
          <h2>{t("signs.reverse")}</h2>
          <p>{t("signs.score", { right: score.right, total: score.total })}</p>
        </div>
      </header>
      <section className="card stack">
        <div className="card-title">
          <Repeat2 aria-hidden="true" size={20} />
          {t("signs.whichSign")}
        </div>
        <p className="reverse-meaning" lang={round.target.meaningLang}>
          {round.target.meaning}
        </p>
        <div className="reverse-choices">
          {round.choices.map((sign, index) => {
            const state =
              picked === null ? "" : sign.id === round.target.id ? "is-correct" : sign.id === picked ? "is-wrong" : "is-muted";
            return (
              <button
                key={sign.id}
                type="button"
                className={`reverse-choice ${state}`}
                onClick={() => pick(sign)}
                disabled={picked !== null}
                aria-label={t("signs.choiceN", { n: num(index + 1) })}
              >
                <img className="sign-img" src={sign.image} alt="" />
                {picked !== null ? (
                  <span className="small" lang={sign.meaningLang}>
                    {sign.meaning}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {status ? (
          <div className="row between">
            <p className={`feedback ${status === "right" ? "success" : "danger"}`}>
              {status === "right" ? t("trainer.correct") : t("trainer.wrongAnswer")}
            </p>
            <button className="button button-primary" type="button" onClick={next}>
              {t("trainer.next")}
              <NextIcon aria-hidden="true" size={18} />
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
