import {
  AlarmClock,
  BookMarked,
  CalendarCheck,
  ClipboardCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Monitor,
  Printer,
  Shuffle,
  SignpostBig,
  Star,
  Target,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useSettings } from "../../app/SettingsContext";
import { useTrainer } from "../../app/TrainerContext";
import { AVAILABLE_BANKS } from "../../data/banks";
import { TOPICS } from "../../data/topics";
import { buildSessionIds } from "../../domain/modes";
import { topicStats } from "../../domain/stats";
import type { ExamMode, TopicId } from "../../domain/types";
import { useI18n } from "../../i18n/useI18n";
import { useBank } from "./hooks";

const EXAMS: { mode: ExamMode; icon: LucideIcon }[] = [
  { mode: "official", icon: ClipboardCheck },
  { mode: "timed", icon: AlarmClock },
  { mode: "strict", icon: EyeOff },
  { mode: "final", icon: GraduationCap }
];

const PRACTICE: { mode: ExamMode; icon: LucideIcon }[] = [
  { mode: "practice", icon: Eye },
  { mode: "daily", icon: CalendarCheck },
  { mode: "mistakes", icon: BookMarked },
  { mode: "weak", icon: TriangleAlert },
  { mode: "unseen", icon: Shuffle },
  { mode: "signs", icon: SignpostBig },
  { mode: "favorites", icon: Star }
];

export function PracticePage() {
  const { t, num, pct, pick } = useI18n();
  const { settings, update } = useSettings();
  const { progress } = useProfile();
  const { start } = useTrainer();
  const { link, can } = useSchool();
  const { bank, meta } = useBank();
  const navigate = useNavigate();

  const counts = useMemo(() => {
    const result: Partial<Record<ExamMode, number>> = {};
    for (const { mode } of PRACTICE) {
      result[mode] = buildSessionIds(mode, progress, meta, { size: bank.examSize, rng: () => 0.5 }).length;
    }
    return result;
  }, [bank.examSize, meta, progress]);

  const stats = useMemo(() => new Map(topicStats(progress, meta).map((stat) => [stat.topic, stat])), [progress, meta]);

  const go = (mode: ExamMode, topic?: TopicId) => {
    if (start(mode, { topic })) navigate(link("play"));
  };

  return (
    <main className="page practice-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("common.navPractice")}</span>
          <h2>{t("trainer.practiceTitle")}</h2>
          <p>{t("trainer.practiceSubtitle")}</p>
        </div>
        {AVAILABLE_BANKS.length > 1 ? (
          <div className="tabs">
            {AVAILABLE_BANKS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`tab ${settings.bank === item.id ? "active" : ""}`}
                onClick={() => update({ bank: item.id })}
              >
                {pick(item.label)}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <section className="stack">
        <h3 className="section-title">{t("trainer.examModes")}</h3>
        <div className="grid cols-4 mode-grid">
          {EXAMS.map(({ mode, icon: Icon }) => (
            <button key={mode} type="button" className="mode-tile" onClick={() => go(mode)}>
              <Icon aria-hidden="true" size={24} />
              <strong>{t(`trainer.mode_${mode}`)}</strong>
              <span>{t(`trainer.modeDesc_${mode}`, { minutes: settings.timerMinutes })}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h3 className="section-title">{t("trainer.practiceModes")}</h3>
        <div className="grid cols-4 mode-grid">
          {PRACTICE.map(({ mode, icon: Icon }) => {
            const count = counts[mode] ?? 0;
            return (
              <button key={mode} type="button" className="mode-tile" disabled={!count} onClick={() => go(mode)}>
                <Icon aria-hidden="true" size={24} />
                <strong>{t(`trainer.mode_${mode}`)}</strong>
                <span>{t(`trainer.modeDesc_${mode}`)}</span>
                <span className="badge">{count ? t("trainer.questionsCount", { n: count }) : t("trainer.nothingYet")}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <h3 className="section-title">{t("trainer.byTopic")}</h3>
        <div className="grid cols-3">
          {TOPICS.map((topic) => {
            const stat = stats.get(topic.id);
            if (!stat || !stat.total) return null;
            return (
              <button key={topic.id} type="button" className="topic-tile" onClick={() => go("topic", topic.id)}>
                <span className="row between">
                  <strong>{pick(topic.label)}</strong>
                  <Target aria-hidden="true" size={18} />
                </span>
                <span className="muted small">
                  {t("trainer.topicSeen", { seen: stat.seen, total: stat.total })}
                  {stat.accuracy !== null ? ` · ${t("trainer.accuracy")} ${pct(stat.accuracy * 100)}` : ""}
                </span>
                <span className={`meter ${stat.accuracy !== null && stat.accuracy < 0.7 ? "warning" : ""}`} aria-hidden="true">
                  <span style={{ width: `${Math.round((stat.mastery / 5) * 100)}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <h3 className="section-title">{t("trainer.studyTools")}</h3>
        <div className="grid cols-3 mode-grid">
          <Link className="mode-tile" to={link("signs")}>
            <SignpostBig aria-hidden="true" size={24} />
            <strong>{t("common.navSigns")}</strong>
            <span>{t("trainer.toolSigns")}</span>
          </Link>
          {can("projector") ? (
            <Link className="mode-tile" to={link("projector")}>
              <Monitor aria-hidden="true" size={24} />
              <strong>{t("trainer.toolProjector")}</strong>
              <span>{t("trainer.toolProjectorDesc")}</span>
            </Link>
          ) : null}
          <div className="mode-tile static">
            <Printer aria-hidden="true" size={24} />
            <strong>{t("trainer.toolPrint")}</strong>
            <span className="row">
              <Link to={link("print/exam")} target="_blank">{t("trainer.printExam")}</Link>
              <Link to={link("print/signs")} target="_blank">{t("trainer.printSigns")}</Link>
              <Link to={link("print/topic")} target="_blank">{t("trainer.printTopic")}</Link>
              <Link to={link("print/report")} target="_blank">{t("trainer.printReport")}</Link>
            </span>
          </div>
        </div>
      </section>
      <p className="muted small">{t("trainer.modesFootnote", { n: num(bank.questions.length) })}</p>
    </main>
  );
}
