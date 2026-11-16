import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Flag,
  History,
  MessageCircle,
  Play,
  School,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useTrainer } from "../../app/TrainerContext";
import { QUESTIONS_BY_ID } from "../../data/banks";
import { weakestIds } from "../../domain/engine";
import { dailyQueue } from "../../domain/notebook";
import { studyPlan } from "../../domain/plan";
import { computeReadiness } from "../../domain/readiness";
import { useI18n } from "../../i18n/useI18n";
import { PlanCard } from "./components/PlanCard";
import { ProgressStats } from "./components/ProgressStats";
import { ReadinessCard } from "./components/ReadinessCard";
import { profileName } from "./components/ProfileAvatar";
import { SIGN_PROMPT, useBank, useQuestionView } from "./hooks";

export function HomePage() {
  const { t, num, date, pick } = useI18n();
  const { progress, active, profiles } = useProfile();
  const { session, start } = useTrainer();
  const { school, link, can } = useSchool();
  const { bank, meta, ids } = useBank();
  const navigate = useNavigate();

  const readiness = useMemo(() => computeReadiness(progress, meta), [progress, meta]);
  const plan = useMemo(() => studyPlan(progress, meta), [progress, meta]);
  const due = useMemo(() => dailyQueue(progress, ids, Date.now(), 15), [progress, ids]);
  const weak = useMemo(() => weakestIds(progress, ids, 5), [progress, ids]);
  const recent = progress.history.slice(-5).reverse();

  const go = (ok: boolean) => {
    if (ok) navigate(link("play"));
  };

  return (
    <main className="dashboard page">
      <section className="home-hero card">
        <div className="stack">
          <span className="eyebrow">
            {profiles.length > 1 || active.name
              ? t("trainer.helloName", { name: profileName(active, t) })
              : t("trainer.hello")}
          </span>
          <h2>{t("trainer.homeTitle", { bank: pick(bank.label) })}</h2>
          <div className="row">
            <span className="chip">
              <Flag aria-hidden="true" size={15} />
              {t("trainer.examFacts", { size: bank.examSize })}
            </span>
            <span className="chip">
              <CheckCircle2 aria-hidden="true" size={15} />
              {t("trainer.passFacts", { pass: bank.passScore, size: bank.examSize })}
            </span>
          </div>
        </div>
        <div className="home-actions">
          {session ? (
            <Link className="button button-primary" to={link("play")}>
              <Play aria-hidden="true" size={19} />
              {t("trainer.continueSession", { n: Object.keys(session.answers).length, total: session.ids.length })}
            </Link>
          ) : (
            <button className="button button-primary" type="button" onClick={() => go(start("official"))}>
              <Play aria-hidden="true" size={19} />
              {t("trainer.startExam")}
            </button>
          )}
          <button
            className="button button-secondary"
            type="button"
            disabled={!due.length}
            onClick={() => go(start("daily"))}
          >
            <CalendarCheck aria-hidden="true" size={18} />
            {due.length ? t("trainer.dailyReview", { n: due.length }) : t("trainer.dailyReviewDone")}
          </button>
          <Link className="button button-ghost home-more-modes" to={link("practice")}>
            <Sparkles aria-hidden="true" size={18} />
            {t("trainer.moreModes")}
          </Link>
        </div>
      </section>

      <ProgressStats />

      <div className="grid cols-2">
        <ReadinessCard readiness={readiness} compact />
        <PlanCard steps={plan} />
      </div>

      {school ? <SchoolCard /> : null}
      {school && can("cloudStudents") && !active.cloud ? (
        <Link className="notice no-print" to={link("join")}>
          <School aria-hidden="true" size={18} />
          {t("trainer.joinSchoolHint")}
        </Link>
      ) : null}

      <Link className="home-more-link" to={link("progress")}>
        <BarChart3 aria-hidden="true" size={18} />
        {t("common.seeAllProgress")}
      </Link>

      <div className="grid cols-2 home-secondary">
        <section className="card stack">
          <div className="card-title">
            <TriangleAlert aria-hidden="true" size={20} />
            {t("trainer.focusList")}
          </div>
          {weak.length ? (
            <ul className="list">
              {weak.map((item) => (
                <WeakRow key={item.id} id={item.id} wrong={item.wrong} />
              ))}
            </ul>
          ) : (
            <div className="empty">{t("trainer.focusEmpty")}</div>
          )}
        </section>

        <section className="card stack">
          <div className="card-title">
            <History aria-hidden="true" size={20} />
            {t("trainer.recentAttempts")}
          </div>
          {recent.length ? (
            <ul className="list">
              {recent.map((item) => (
                <li key={`${item.at}-${item.examIndex}`} className="list-row">
                  <span className={`badge ${item.passed ? "success" : item.mode && !["official", "timed", "strict", "final"].includes(item.mode) ? "info" : "danger"}`}>
                    {num(item.score)}/{num(item.total)}
                  </span>
                  <span className="grow">{t(`trainer.mode_${item.mode ?? "official"}`)}</span>
                  <span className="muted small">{date(item.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">{t("trainer.noAttempts")}</div>
          )}
        </section>
      </div>
    </main>
  );
}

function WeakRow({ id, wrong }: { id: number; wrong: number }) {
  const { t } = useI18n();
  const { link } = useSchool();
  const question = QUESTIONS_BY_ID.get(id);
  const view = useQuestionView(question);
  if (!question || !view) return null;
  return (
    <li>
      <Link className="list-row" to={link(`question/${id}`)}>
        {question.sign ? <img className="sign-img review-thumb" src={question.sign} alt="" /> : null}
        <span className="grow clamp-2" lang={view.lang} dir={view.dir}>
          {question.sign ? SIGN_PROMPT[view.lang] : view.text}
        </span>
        <span className="badge danger">{t("trainer.wrongTimes", { n: wrong })}</span>
      </Link>
    </li>
  );
}

function SchoolCard() {
  const { t, pick } = useI18n();
  const { school, slug } = useSchool();
  if (!school) return null;
  const whatsapp = school.contact.whatsapp?.replace(/\D/g, "");
  return (
    <section className="card school-card row between">
      <div className="row">
        {school.branding.logoUrl ? <img src={school.branding.logoUrl} alt="" className="school-card-logo" /> : <School aria-hidden="true" size={28} />}
        <div>
          <strong>{pick(school.name)}</strong>
          <p className="muted small">{t("trainer.schoolCardHint")}</p>
        </div>
      </div>
      <div className="row">
        {whatsapp ? (
          <a
            className="button button-secondary compact"
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(t("trainer.whatsappHello"))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" size={18} />
            {t("trainer.contactSchool")}
          </a>
        ) : null}
        <Link className="button button-ghost compact" to={`/s/${slug}`}>
          {t("common.aboutSchool")}
        </Link>
      </div>
    </section>
  );
}
