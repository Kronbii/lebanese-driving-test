import { BookMarked, NotebookPen, Play, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useTrainer } from "../../app/TrainerContext";
import { QUESTIONS_BY_ID } from "../../data/banks";
import { TOPICS_BY_ID } from "../../data/topics";
import { FIXED_STREAK, groupByTopic, notebookEntries, type MistakeStatus, type NotebookEntry } from "../../domain/notebook";
import { useI18n } from "../../i18n/useI18n";
import { SIGN_PROMPT, useBank, useQuestionView } from "./hooks";

type Filter = "open" | MistakeStatus | "favorites" | "notes";

export function NotebookPage() {
  const { t, pick } = useI18n();
  const { progress } = useProfile();
  const { start } = useTrainer();
  const { link } = useSchool();
  const { meta } = useBank();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("open");

  const entries = useMemo(() => notebookEntries(progress, meta), [progress, meta]);
  const extra = useMemo(() => {
    // Favourites and noted questions that were never wrong still belong in the notebook.
    const known = new Set(entries.map((entry) => entry.id));
    const result: NotebookEntry[] = [];
    for (const item of meta) {
      if (known.has(item.id)) continue;
      const favorite = progress.favorites.includes(item.id);
      const note = progress.notes[item.id];
      if (!favorite && !note) continue;
      const stat = progress.questions[item.id];
      result.push({
        id: item.id,
        topic: item.topic,
        status: "fixed",
        wrong: 0,
        correct: stat?.correct ?? 0,
        streak: stat?.streak ?? 0,
        lastSeenAt: stat?.lastSeenAt,
        favorite,
        note
      });
    }
    return result;
  }, [entries, meta, progress]);

  const all = [...entries, ...extra];
  const visible = all.filter((entry) => {
    switch (filter) {
      case "open":
        return entry.wrong > 0 && entry.status !== "fixed";
      case "favorites":
        return entry.favorite;
      case "notes":
        return Boolean(entry.note);
      default:
        return entry.wrong > 0 && entry.status === filter;
    }
  });
  const groups = groupByTopic(visible);
  const counts: Record<Filter, number> = {
    open: entries.filter((entry) => entry.status !== "fixed").length,
    repeated: entries.filter((entry) => entry.status === "repeated").length,
    active: entries.filter((entry) => entry.status === "active").length,
    fixed: entries.filter((entry) => entry.status === "fixed").length,
    favorites: all.filter((entry) => entry.favorite).length,
    notes: all.filter((entry) => entry.note).length
  };
  const filters: Filter[] = ["open", "repeated", "fixed", "favorites", "notes"];

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("common.navNotebook")}</span>
          <h2>{t("trainer.notebookTitle")}</h2>
          <p>{t("trainer.notebookSubtitle", { n: FIXED_STREAK })}</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={!counts.open}
          onClick={() => {
            if (start("mistakes")) navigate(link("play"));
          }}
        >
          <Play aria-hidden="true" size={18} />
          {t("trainer.practiceMistakes", { n: Math.min(counts.open, 30) })}
        </button>
      </header>

      <div className="tabs" role="tablist">
        {filters.map((item) => (
          <button key={item} type="button" className={`tab ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>
            {t(`trainer.notebook_${item}`, { n: counts[item] })}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <BookMarked aria-hidden="true" size={36} />
          <p>{t(`trainer.notebookEmpty_${filter}`)}</p>
        </div>
      ) : (
        [...groups.entries()].map(([topic, items]) => (
          <section key={topic} className="card stack">
            <div className="card-title">
              {pick(TOPICS_BY_ID.get(topic)?.label)}
              <span className="badge">{items.length}</span>
            </div>
            <ul className="list">
              {items.map((entry) => (
                <NotebookRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}

const STATUS_TONE: Record<MistakeStatus, string> = { repeated: "danger", active: "warning", fixed: "success" };

function NotebookRow({ entry }: { entry: NotebookEntry }) {
  const { t, date } = useI18n();
  const { link } = useSchool();
  const question = QUESTIONS_BY_ID.get(entry.id);
  const view = useQuestionView(question);
  if (!question || !view) return null;
  return (
    <li>
      <Link className="list-row notebook-row" to={link(`question/${entry.id}`)}>
        {question.sign ? <img className="sign-img review-thumb" src={question.sign} alt="" /> : null}
        <span className="grow stack tight">
          <span className="clamp-2" lang={view.lang} dir={view.dir}>
            {question.sign ? SIGN_PROMPT[view.lang] : view.text}
          </span>
          {entry.note ? (
            <span className="muted small row">
              <NotebookPen aria-hidden="true" size={13} />
              {entry.note}
            </span>
          ) : null}
          <span className="muted small">
            {entry.wrong ? t("trainer.wrongTimes", { n: entry.wrong }) : null}
            {entry.lastSeenAt ? ` · ${date(entry.lastSeenAt, { day: "numeric", month: "short" })}` : ""}
          </span>
        </span>
        {entry.favorite ? <Star aria-hidden="true" size={16} className="star-on" fill="currentColor" /> : null}
        {entry.wrong ? <span className={`badge ${STATUS_TONE[entry.status]}`}>{t(`trainer.status_${entry.status}`)}</span> : null}
      </Link>
    </li>
  );
}
