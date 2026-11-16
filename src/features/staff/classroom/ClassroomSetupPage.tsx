import { Play, Shuffle } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../api/client";
import type { ClassroomCreate, ClassroomHostState, StaffOverview } from "../../../api/types";
import { useSettings } from "../../../app/SettingsContext";
import { AVAILABLE_BANKS, BANKS, bankIds, idsForTopic, signIds } from "../../../data/banks";
import { TOPICS } from "../../../data/topics";
import type { BankId, TopicId } from "../../../domain/types";
import { useI18n } from "../../../i18n/useI18n";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { QuestionSnippet } from "../shared/QuestionPrompt";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";

type Source = "random" | "signs" | "topic" | "weak";

const SOURCES: { value: Source; key: string }[] = [
  { value: "random", key: "staff.sourceRandom" },
  { value: "signs", key: "staff.sourceSigns" },
  { value: "topic", key: "staff.sourceTopic" },
  { value: "weak", key: "staff.sourceWeak" }
];

function sample(ids: number[], count: number): number[] {
  const copy = [...ids];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, count);
}

export function ClassroomSetupPage() {
  const { t, pick, num } = useI18n();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const defaultBank: BankId = AVAILABLE_BANKS.some((bank) => bank.id === settings.bank)
    ? settings.bank
    : AVAILABLE_BANKS[0]?.id ?? "motorcycle";
  const [bank, setBank] = useState<BankId>(defaultBank);
  const [source, setSource] = useState<Source>("random");
  const [topic, setTopic] = useState<TopicId>("traffic_rules");
  const [count, setCount] = useState(10);
  const [anonymous, setAnonymous] = useState(false);
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const overview = useApiGet<StaffOverview>(source === "weak" ? "/staff/overview" : null);

  const topics = useMemo(() => TOPICS.filter((item) => idsForTopic(bank, item.id).length > 0), [bank]);

  const questionIds = useMemo(() => {
    void seed;
    const size = Math.max(1, Math.min(50, count));
    if (source === "weak") {
      const inBank = new Set(bankIds(bank));
      return (overview.data?.topWrong ?? [])
        .map((row) => row.questionId)
        .filter((id) => inBank.has(id))
        .slice(0, size);
    }
    const pool = source === "signs" ? signIds(bank) : source === "topic" ? idsForTopic(bank, topic) : bankIds(bank);
    return sample(pool, size);
  }, [source, bank, topic, count, seed, overview.data]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (questionIds.length === 0) return;
    setBusy(true);
    setError(null);
    const body: ClassroomCreate = { questionIds, anonymous };
    try {
      const state = await api<ClassroomHostState>("/staff/classroom", { body });
      navigate(`/staff/classroom/${state.code}`);
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.classroomTitle")}</h1>
          <p>{t("staff.classroomIntro")}</p>
        </div>
      </div>
      <form className="card stack" onSubmit={submit}>
        <div className="grid cols-2">
          {AVAILABLE_BANKS.length > 1 ? (
            <label className="field">
              <span>{t("staff.bank")}</span>
              <select className="select" value={bank} onChange={(event) => setBank(event.target.value as BankId)}>
                {AVAILABLE_BANKS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {pick(item.label)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>{t("staff.questionCount")}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              inputMode="numeric"
              value={count}
              onChange={(event) => setCount(Number.parseInt(event.target.value, 10) || 1)}
            />
          </label>
        </div>
        <fieldset className="staff-fieldset">
          <legend>{t("staff.questionSource")}</legend>
          <div className="staff-radio-grid">
            {SOURCES.map((item) => (
              <label key={item.value} className={`staff-radio${source === item.value ? " active" : ""}`}>
                <input
                  type="radio"
                  name="source"
                  value={item.value}
                  checked={source === item.value}
                  onChange={() => setSource(item.value)}
                />
                {t(item.key)}
              </label>
            ))}
          </div>
        </fieldset>
        {source === "topic" ? (
          <label className="field">
            <span>{t("staff.topic")}</span>
            <select className="select" value={topic} onChange={(event) => setTopic(event.target.value as TopicId)}>
              {topics.map((item) => (
                <option key={item.id} value={item.id}>
                  {pick(item.label)} ({num(idsForTopic(bank, item.id).length)})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {source === "weak" ? (
          <>
            <ErrorNotice error={overview.error} onRetry={overview.reload} />
            {overview.loading ? <LoadingBlock /> : null}
          </>
        ) : null}
        <label className="check">
          <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
          <span>
            {t("staff.anonymous")}
            <span className="hint small muted"> — {t("staff.anonymousHint")}</span>
          </span>
        </label>

        <div className="stack tight">
          <div className="row between">
            <span className="strong">
              {t("staff.selectedCount", { count: questionIds.length, bank: pick(BANKS[bank].label) })}
            </span>
            {source !== "weak" ? (
              <button type="button" className="button button-ghost" onClick={() => setSeed((value) => value + 1)}>
                <Shuffle size={16} aria-hidden="true" />
                {t("staff.reshuffle")}
              </button>
            ) : null}
          </div>
          {questionIds.length === 0 ? <p className="notice warning">{t("staff.noQuestionsSelected")}</p> : null}
          <ul className="staff-preview-list">
            {questionIds.slice(0, 6).map((id) => (
              <li key={id}>
                <QuestionSnippet questionId={id} />
              </li>
            ))}
            {questionIds.length > 6 ? (
              <li className="muted small">{t("staff.andMore", { count: questionIds.length - 6 })}</li>
            ) : null}
          </ul>
        </div>
        <FormError error={error} />
        <div className="row end">
          <button type="submit" className="button button-primary" disabled={busy || questionIds.length === 0}>
            <Play size={18} aria-hidden="true" />
            {busy ? t("staff.working") : t("staff.startSession")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ClassroomSetupPage;
