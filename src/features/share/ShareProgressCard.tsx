import { Image as ImageIcon } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useSettings } from "../../app/SettingsContext";
import { questionMeta } from "../../data/meta";
import { summary } from "../../domain/engine";
import { computeReadiness, countedExams } from "../../domain/readiness";
import { practiceStreak } from "../../domain/stats";
import { useI18n } from "../../i18n/useI18n";
import { appUrl, safeColor } from "../print/lib";
import { renderStoryCard, shareOrDownload } from "./storyCanvas";

type Status = "idle" | "working" | "shared" | "downloaded" | "error";

/**
 * A 9:16 progress card that looks good as a phone screenshot (stories / TikTok),
 * plus a button that renders the same card as a full-size PNG.
 */
export function ShareProgressCard() {
  const { t, num, dir, pick } = useI18n();
  const { settings } = useSettings();
  const { progress } = useProfile();
  const { school, slug } = useSchool();
  const [status, setStatus] = useState<Status>("idle");

  const data = useMemo(() => {
    const meta = questionMeta(settings.bank);
    const readiness = computeReadiness(progress, meta);
    const totals = summary(progress, meta.map((item) => item.id));
    const counted = countedExams(progress.history);
    const best = counted.reduce((max, item) => Math.max(max, item.total ? item.score / item.total : 0), 0);
    return {
      readiness,
      totals,
      passes: counted.filter((item) => item.passed).length,
      best: counted.length ? Math.round(best * 100) : null,
      streak: practiceStreak(progress)
    };
  }, [progress, settings.bank]);

  const { readiness, totals, passes, best, streak } = data;
  const brand = school ? pick(school.name) : t("print.appName");
  const primary = safeColor(school?.branding.primaryColor, "#0f766e");
  const accent = safeColor(school?.branding.accentColor, "#255f85");
  const url = appUrl(slug);
  const label = t(`print.readiness_${readiness.label}`);
  const rows = [
    { label: t("share.card_coverage"), value: `${num(totals.coveragePct)}%` },
    { label: t("share.card_mastery"), value: `${num(totals.masteryPct)}%` },
    { label: t("share.card_streak"), value: t("share.card_days", { n: streak }) },
    {
      label: t("share.card_best"),
      value: best === null ? "—" : `${num(best)}% · ${t("share.card_passes", { n: passes })}`
    }
  ];
  const circumference = 2 * Math.PI * 42;

  const share = async () => {
    setStatus("working");
    try {
      const blob = await renderStoryCard({
        brand,
        title: t("share.card_title"),
        ringValue: readiness.score / 100,
        ringMain: `${num(readiness.score)}%`,
        ringSub: t("share.readiness"),
        pill: { text: label, tone: readiness.label === "ready" ? "success" : "neutral" },
        rows,
        cta: t("share.cta"),
        link: url,
        primary,
        accent,
        dir
      });
      const outcome = await shareOrDownload(blob, "my-progress.png", t("share.card_text", { link: url }), t("share.card_title"));
      setStatus(outcome === "cancelled" ? "idle" : outcome);
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="share-progress stack" aria-label={t("share.card_title")}>
      <div
        className="share-card"
        style={{ "--share-primary": primary, "--share-accent": accent } as CSSProperties}
      >
        <p className="share-card-brand">{brand}</p>
        <p className="share-card-title">{t("share.card_title")}</p>
        <div className="share-card-ring" role="img" aria-label={t("share.card_ringLabel", { n: readiness.score })}>
          <svg viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="42" className="share-ring-track" />
            <circle
              cx="50"
              cy="50"
              r="42"
              className="share-ring-value"
              strokeDasharray={`${(readiness.score / 100) * circumference} ${circumference}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <span className="share-card-score">
            <strong>{num(readiness.score)}%</strong>
            <small>{t("share.readiness")}</small>
          </span>
        </div>
        <p className={`share-card-pill${readiness.label === "ready" ? " ready" : ""}`}>{label}</p>
        <dl className="share-card-rows">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="share-card-link ltr">{url.replace(/^https?:\/\//, "")}</p>
      </div>
      <div className="row share-progress-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void share()}
          disabled={status === "working"}
        >
          <ImageIcon size={18} aria-hidden />
          {status === "working" ? t("share.preparing") : t("share.card_button")}
        </button>
        <span className="small muted" role="status" aria-live="polite">
          {status === "shared"
            ? t("share.shared")
            : status === "downloaded"
              ? t("share.downloaded")
              : status === "error"
                ? t("share.error")
                : t("share.card_hint")}
        </span>
      </div>
    </section>
  );
}

export default ShareProgressCard;
