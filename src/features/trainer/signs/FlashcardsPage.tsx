import { Check, Layers, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../../app/ProfileContext";
import { useSchool } from "../../../app/SchoolContext";
import { explanationFor } from "../../../data/content";
import { TOPICS_BY_ID } from "../../../data/topics";
import { dueCards, gradeCard, knownCount } from "../../../domain/flashcards";
import type { TopicId } from "../../../domain/types";
import { useI18n } from "../../../i18n/useI18n";
import { useExplanationLang } from "../hooks";
import { SIGN_TOPICS, useSigns } from "./signData";

export function FlashcardsPage() {
  const { t, num, pick } = useI18n();
  const { progress, mutate } = useProfile();
  const { link } = useSchool();
  const lang = useExplanationLang();
  const signs = useSigns();
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  // Snapshot of the queue when the deck starts so graded cards leave it.
  const [sessionStart] = useState(() => Date.now());

  const pool = useMemo(
    () => signs.filter((sign) => topic === "all" || sign.topic === topic),
    [signs, topic]
  );
  const queue = useMemo(
    () => dueCards(progress, pool.map((sign) => sign.id), sessionStart),
    [pool, progress, sessionStart]
  );
  const current = pool.find((sign) => sign.id === queue[0]);
  const known = knownCount(progress, pool.map((sign) => sign.id));

  const grade = (isKnown: boolean) => {
    if (!current) return;
    mutate((draft) => gradeCard(draft, current.id, isKnown));
    setFlipped(false);
    setReviewed((count) => count + 1);
  };

  return (
    <main className="page flashcards-page">
      <header className="page-header">
        <div>
          <Link to={link("signs")} className="eyebrow">
            {t("common.navSigns")}
          </Link>
          <h2>{t("signs.flashcards")}</h2>
          <p>{t("signs.flashcardsProgress", { known, total: pool.length, left: queue.length })}</p>
        </div>
      </header>
      <div className="tabs">
        <button type="button" className={`tab ${topic === "all" ? "active" : ""}`} onClick={() => setTopic("all")}>
          {t("signs.all", { n: signs.length })}
        </button>
        {SIGN_TOPICS.map((id) =>
          signs.some((sign) => sign.topic === id) ? (
            <button key={id} type="button" className={`tab ${topic === id ? "active" : ""}`} onClick={() => setTopic(id)}>
              {pick(TOPICS_BY_ID.get(id)?.label)}
            </button>
          ) : null
        )}
      </div>

      {!current ? (
        <div className="empty">
          <Layers aria-hidden="true" size={36} />
          <p>{t("signs.deckDone", { n: reviewed })}</p>
          <Link className="button button-primary" to={link("signs/drill")}>
            {t("signs.tryDrill")}
          </Link>
        </div>
      ) : (
        <section className="card flashcard stack">
          <button
            type="button"
            className={`flashcard-face ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped(true)}
            aria-label={flipped ? current.meaning : t("signs.tapToReveal")}
          >
            <img className="sign-img flashcard-img" src={current.image} alt="" />
            {flipped ? (
              <span className="stack tight">
                <strong className="flashcard-meaning" lang={current.meaningLang}>
                  {current.meaning}
                </strong>
                {current.meaningLang !== "ar" ? <span lang="ar" className="muted">{current.official}</span> : null}
                {explanationFor(current.id, lang) ? (
                  <span className="muted small" lang={lang}>
                    {explanationFor(current.id, lang)}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="muted">{t("signs.tapToReveal")}</span>
            )}
          </button>
          <div className="row flashcard-actions">
            <button className="button button-ghost grow" type="button" onClick={() => grade(false)} disabled={!flipped}>
              <RotateCcw aria-hidden="true" size={18} />
              {t("signs.reviewAgain")}
            </button>
            <button className="button button-primary grow" type="button" onClick={() => grade(true)} disabled={!flipped}>
              <Check aria-hidden="true" size={18} />
              {t("signs.iKnowThis")}
            </button>
          </div>
          <p className="muted small center">{t("signs.cardCount", { n: num(queue.length) })}</p>
        </section>
      )}
    </main>
  );
}
