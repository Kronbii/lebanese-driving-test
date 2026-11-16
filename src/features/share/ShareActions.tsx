import { Award, Image as ImageIcon, MessageCircle, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useSettings } from "../../app/SettingsContext";
import { questionMeta } from "../../data/meta";
import { computeReadiness } from "../../domain/readiness";
import type { ExamResult } from "../../domain/types";
import { useI18n } from "../../i18n/useI18n";
import { appUrl, safeColor, whatsappLink } from "../print/lib";
import { renderStoryCard, shareOrDownload } from "./storyCanvas";

type Status = "idle" | "working" | "shared" | "downloaded" | "error";

/** Share buttons for a finished session: WhatsApp (instructor / anyone), story image, certificate. */
export function ShareActions({ result }: { result: ExamResult }) {
  const { t, num, dir, pick } = useI18n();
  const { settings } = useSettings();
  const { active, progress } = useProfile();
  const { school, slug, link, can } = useSchool();
  const [status, setStatus] = useState<Status>("idle");

  const readiness = useMemo(
    () => computeReadiness(progress, questionMeta(settings.bank)),
    [progress, settings.bank]
  );
  const percent = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const url = appUrl(slug);
  const verdict = result.counted
    ? result.passed
      ? t("share.passed")
      : t("share.failed")
    : t("share.practice");
  const vars = {
    score: result.score,
    total: result.total,
    pct: percent,
    verdict,
    readiness: readiness.score,
    link: url
  };
  const message = t("share.message", vars);
  const instructorMessage = t("share.instructorMessage", {
    ...vars,
    name: active.name || t("share.aStudent"),
    mode: t(`print.mode_${result.mode}`)
  });
  const whatsapp = school?.contact.whatsapp?.replace(/\D/g, "") || null;
  const showCertificate = result.counted && result.passed && can("certificates");

  const shareImage = async () => {
    setStatus("working");
    try {
      const blob = await renderStoryCard({
        brand: school ? pick(school.name) : t("print.appName"),
        title: t(`print.mode_${result.mode}`),
        ringValue: result.total ? result.score / result.total : 0,
        ringMain: `${num(result.score)}/${num(result.total)}`,
        ringSub: `${num(percent)}%`,
        pill: {
          text: verdict,
          tone: !result.counted ? "neutral" : result.passed ? "success" : "danger"
        },
        rows: [
          { label: t("share.readiness"), value: `${num(readiness.score)}%` },
          { label: t("share.readinessLabel"), value: t(`print.readiness_${readiness.label}`) }
        ],
        cta: t("share.cta"),
        link: url,
        primary: safeColor(school?.branding.primaryColor, "#0f766e"),
        accent: safeColor(school?.branding.accentColor, "#255f85"),
        dir
      });
      const outcome = await shareOrDownload(blob, `result-${result.score}-${result.total}.png`, message, verdict);
      setStatus(outcome === "cancelled" ? "idle" : outcome);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="share-actions stack">
      <div className="row">
        {whatsapp ? (
          <a
            className="button button-primary"
            href={whatsappLink(whatsapp, instructorMessage)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send size={18} aria-hidden />
            {t("share.toInstructor")}
          </a>
        ) : null}
        <a
          className={`button ${whatsapp ? "button-secondary" : "button-primary"}`}
          href={whatsappLink(null, message)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={18} aria-hidden />
          {t("share.whatsapp")}
        </a>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void shareImage()}
          disabled={status === "working"}
        >
          <ImageIcon size={18} aria-hidden />
          {status === "working" ? t("share.preparing") : t("share.image")}
        </button>
        {showCertificate ? (
          <Link className="button button-ghost" to={link("print/certificate")}>
            <Award size={18} aria-hidden />
            {t("share.certificate")}
          </Link>
        ) : null}
      </div>
      <p className="small muted" role="status" aria-live="polite">
        {status === "shared"
          ? t("share.shared")
          : status === "downloaded"
            ? t("share.downloaded")
            : status === "error"
              ? t("share.error")
              : ""}
      </p>
    </div>
  );
}

export default ShareActions;
