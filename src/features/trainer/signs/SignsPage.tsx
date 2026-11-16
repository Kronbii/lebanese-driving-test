import { Eye, EyeOff, Layers, Printer, Repeat2, Search, Timer, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../../app/ProfileContext";
import { useSchool } from "../../../app/SchoolContext";
import { TOPICS_BY_ID } from "../../../data/topics";
import { knownCount } from "../../../domain/flashcards";
import { mostConfused } from "../../../domain/stats";
import type { TopicId } from "../../../domain/types";
import { useI18n } from "../../../i18n/useI18n";
import { normalizeSearch, SIGN_TOPICS, useSigns, type SignItem } from "./signData";

export function SignsPage() {
  const { t, pick, num } = useI18n();
  const { progress } = useProfile();
  const { link } = useSchool();
  const signs = useSigns();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [hideMeanings, setHideMeanings] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const needle = normalizeSearch(query);
    return signs.filter((sign) => {
      if (topic !== "all" && sign.topic !== topic) return false;
      if (!needle) return true;
      return (
        normalizeSearch(sign.meaning).includes(needle) ||
        normalizeSearch(sign.official).includes(needle) ||
        String(sign.id) === needle
      );
    });
  }, [query, signs, topic]);

  const confused = useMemo(
    () => mostConfused(progress, signs.map((sign) => sign.id), 6),
    [progress, signs]
  );
  const byId = useMemo(() => new Map(signs.map((sign) => [sign.id, sign])), [signs]);
  const known = knownCount(progress, signs.map((sign) => sign.id));

  return (
    <main className="page signs-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("common.navSigns")}</span>
          <h2>{t("signs.title")}</h2>
          <p>{t("signs.subtitle", { total: signs.length, known })}</p>
        </div>
      </header>

      <div className="grid cols-4 mode-grid">
        <Link className="mode-tile" to={link("signs/flashcards")}>
          <Layers aria-hidden="true" size={24} />
          <strong>{t("signs.flashcards")}</strong>
          <span>{t("signs.flashcardsDesc")}</span>
        </Link>
        <Link className="mode-tile" to={link("signs/reverse")}>
          <Repeat2 aria-hidden="true" size={24} />
          <strong>{t("signs.reverse")}</strong>
          <span>{t("signs.reverseDesc")}</span>
        </Link>
        <Link className="mode-tile" to={link("signs/drill")}>
          <Timer aria-hidden="true" size={24} />
          <strong>{t("signs.drill")}</strong>
          <span>{t("signs.drillDesc")}</span>
        </Link>
        <Link className="mode-tile" to={link("print/signs")} target="_blank">
          <Printer aria-hidden="true" size={24} />
          <strong>{t("signs.print")}</strong>
          <span>{t("signs.printDesc")}</span>
        </Link>
      </div>

      {confused.length ? (
        <section className="card stack">
          <div className="card-title">
            <TriangleAlert aria-hidden="true" size={20} />
            {t("signs.mostConfused")}
          </div>
          <div className="confused-grid">
            {confused.map((item) => {
              const sign = byId.get(item.id);
              if (!sign) return null;
              return (
                <Link key={item.id} className="confused-item" to={link(`question/${item.id}`)}>
                  <img className="sign-img" src={sign.image} alt="" />
                  <span className="small" lang={sign.meaningLang}>{sign.meaning}</span>
                  {item.confusedWith !== null ? (
                    <span className="muted small">
                      {t("signs.confusedWith")}{" "}
                      <span lang="ar">{sign.question.options[item.confusedWith]}</span>
                    </span>
                  ) : null}
                  <span className="badge danger">{t("trainer.wrongTimes", { n: item.wrong })}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="card stack">
        <div className="row">
          <label className="field grow sign-search">
            <span className="visually-hidden">{t("signs.search")}</span>
            <span className="input-icon">
              <Search aria-hidden="true" size={18} />
              <input
                className="input"
                type="search"
                value={query}
                placeholder={t("signs.searchPlaceholder")}
                onChange={(event) => setQuery(event.target.value)}
              />
            </span>
          </label>
          <button
            className="button button-ghost"
            type="button"
            aria-pressed={hideMeanings}
            onClick={() => {
              setHideMeanings((value) => !value);
              setRevealed(new Set());
            }}
          >
            {hideMeanings ? <Eye aria-hidden="true" size={18} /> : <EyeOff aria-hidden="true" size={18} />}
            {hideMeanings ? t("signs.showMeanings") : t("signs.hideMeanings")}
          </button>
        </div>
        <div className="tabs">
          <button type="button" className={`tab ${topic === "all" ? "active" : ""}`} onClick={() => setTopic("all")}>
            {t("signs.all", { n: signs.length })}
          </button>
          {SIGN_TOPICS.map((id) => {
            const count = signs.filter((sign) => sign.topic === id).length;
            if (!count) return null;
            return (
              <button key={id} type="button" className={`tab ${topic === id ? "active" : ""}`} onClick={() => setTopic(id)}>
                {pick(TOPICS_BY_ID.get(id)?.label)} ({num(count)})
              </button>
            );
          })}
        </div>
        {filtered.length === 0 ? (
          <div className="empty">{t("signs.noResults")}</div>
        ) : (
          <div className="sign-gallery">
            {filtered.map((sign) => (
              <SignTile
                key={sign.id}
                sign={sign}
                hidden={hideMeanings && !revealed.has(sign.id)}
                known={(progress.flashcards[sign.id]?.box ?? 0) >= 3}
                onReveal={() => setRevealed((current) => new Set(current).add(sign.id))}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SignTile({
  sign,
  hidden,
  known,
  onReveal
}: {
  sign: SignItem;
  hidden: boolean;
  known: boolean;
  onReveal: () => void;
}) {
  const { t } = useI18n();
  const { link } = useSchool();
  if (hidden) {
    return (
      <button type="button" className="sign-tile" onClick={onReveal}>
        <img className="sign-img" src={sign.image} alt={t("signs.tapToReveal")} loading="lazy" />
        <span className="muted small">{t("signs.tapToReveal")}</span>
      </button>
    );
  }
  return (
    <Link className="sign-tile" to={link(`question/${sign.id}`)}>
      <img className="sign-img" src={sign.image} alt="" loading="lazy" />
      <span lang={sign.meaningLang} dir={sign.meaningLang === "ar" ? "rtl" : "ltr"}>
        {sign.meaning}
      </span>
      {known ? <span className="badge success">{t("signs.known")}</span> : null}
    </Link>
  );
}
