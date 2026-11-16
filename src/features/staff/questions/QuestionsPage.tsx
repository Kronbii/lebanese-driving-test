import { BookOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSettings } from "../../../app/SettingsContext";
import { AVAILABLE_BANKS, BANKS } from "../../../data/banks";
import { isTopicId, TOPICS, TOPICS_BY_ID } from "../../../data/topics";
import type { BankId } from "../../../domain/types";
import { useI18n } from "../../../i18n/useI18n";
import { QuestionSnippet } from "../shared/QuestionPrompt";
import { indexQuestions, normalizeSearch } from "./search";

const PAGE = 40;

export function QuestionsPage() {
  const { t, pick, num } = useI18n();
  const { settings, contentReady } = useSettings();
  const [params, setParams] = useSearchParams();
  const [limit, setLimit] = useState(PAGE);
  const bankParam = params.get("bank");
  const bank: BankId =
    AVAILABLE_BANKS.find((item) => item.id === bankParam)?.id ??
    (AVAILABLE_BANKS.some((item) => item.id === settings.bank) ? settings.bank : AVAILABLE_BANKS[0]?.id ?? "motorcycle");
  const query = params.get("q") ?? "";
  const topicParam = params.get("topic");
  const topic = isTopicId(topicParam) ? topicParam : null;
  const signsOnly = params.get("signs") === "1";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
    setLimit(PAGE);
  };

  // Re-index once translations load so English/French search works.
  const indexed = useMemo(() => indexQuestions(BANKS[bank].questions), [bank, contentReady]);
  const results = useMemo(() => {
    const needle = normalizeSearch(query);
    return indexed.filter(
      (item) =>
        (!signsOnly || item.question.sign) &&
        (!topic || item.topic === topic) &&
        (!needle || item.haystack.includes(needle))
    );
  }, [indexed, query, topic, signsOnly]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.questionsTitle")}</h1>
          <p>{t("staff.questionsIntro")}</p>
        </div>
      </div>
      <div className="card stack">
        <div className="row">
          <label className="field grow staff-search">
            <span className="visually-hidden">{t("staff.searchQuestions")}</span>
            <Search size={18} aria-hidden="true" />
            <input
              className="input"
              type="search"
              value={query}
              onChange={(event) => update({ q: event.target.value })}
              placeholder={t("staff.searchQuestions")}
            />
          </label>
          {AVAILABLE_BANKS.length > 1 ? (
            <label className="field">
              <span className="visually-hidden">{t("staff.bank")}</span>
              <select className="select" value={bank} onChange={(event) => update({ bank: event.target.value })}>
                {AVAILABLE_BANKS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {pick(item.label)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span className="visually-hidden">{t("staff.topic")}</span>
            <select className="select" value={topic ?? ""} onChange={(event) => update({ topic: event.target.value || null })}>
              <option value="">{t("staff.allTopics")}</option>
              {TOPICS.map((item) => (
                <option key={item.id} value={item.id}>
                  {pick(item.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={signsOnly} onChange={(event) => update({ signs: event.target.checked ? "1" : null })} />
            {t("staff.signsOnly")}
          </label>
        </div>
        <p className="small muted" aria-live="polite">
          {t("staff.resultsCount", { count: num(results.length) })}
        </p>
      </div>

      {results.length === 0 ? (
        <div className="empty">
          <BookOpen size={32} aria-hidden="true" />
          <p>{t("staff.noMatches")}</p>
        </div>
      ) : (
        <ul className="list">
          {results.slice(0, limit).map((item) => (
            <li key={item.question.id}>
              <Link className="list-row staff-qrow" to={`/staff/questions/${item.question.id}`}>
                <QuestionSnippet questionId={item.question.id} />
                <span className="chip staff-topic-chip">{pick(TOPICS_BY_ID.get(item.topic)?.label)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {results.length > limit ? (
        <button type="button" className="button button-ghost" onClick={() => setLimit((value) => value + PAGE)}>
          {t("staff.showMore", { count: num(results.length - limit) })}
        </button>
      ) : null}
    </div>
  );
}

export default QuestionsPage;
