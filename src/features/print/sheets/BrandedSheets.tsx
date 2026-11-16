import { Award, MessageCircle, Phone } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useProfile } from "../../../app/ProfileContext";
import { useSchool } from "../../../app/SchoolContext";
import { useSettings } from "../../../app/SettingsContext";
import { QrCode } from "../../../components/QrCode";
import { BANKS } from "../../../data/banks";
import { questionMeta } from "../../../data/meta";
import { computeReadiness, countedExams } from "../../../domain/readiness";
import { makeI18n, useI18n } from "../../../i18n/useI18n";
import { appUrl, cleanRef, safeColor } from "../lib";
import { PrintBrand, PrintLayout, PrintNotice } from "../PrintLayout";

/** Short stable code so a printed certificate can be matched to the learner's device. */
function certificateCode(seed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

export function CertificateSheet() {
  const { t, num, pct, date, pick, lang } = useI18n();
  const { settings } = useSettings();
  const { active, progress } = useProfile();
  const { school, can, link } = useSchool();
  const [name, setName] = useState(active.name);
  const meta = questionMeta(settings.bank);
  const bank = BANKS[settings.bank];

  const passes = useMemo(() => countedExams(progress.history).filter((item) => item.passed), [progress.history]);
  const readiness = useMemo(() => computeReadiness(progress, meta), [progress, meta]);
  const best = passes.reduce<{ score: number; total: number } | null>((top, item) => {
    if (!top || item.score / item.total > top.score / top.total) return { score: item.score, total: item.total };
    return top;
  }, null);
  const firstPass = passes[0];
  const color = safeColor(school?.branding.primaryColor, "#0f766e");
  const page = { size: "A4", orientation: "landscape", margin: "8mm" } as const;

  if (!can("certificates")) {
    return (
      <PrintLayout title={t("print.cert_title")} printable={false}>
        <PrintNotice title={t("print.cert_disabled")} />
      </PrintLayout>
    );
  }

  if (!best || !firstPass) {
    return (
      <PrintLayout title={t("print.cert_title")} printable={false}>
        <PrintNotice title={t("print.cert_notYet")}>
          <p>{t("print.cert_notYetBody", { pass: bank.passScore, total: bank.examSize })}</p>
          <Link className="button button-primary no-print" to={link("exam/official")}>
            {t("print.cert_startExam")}
          </Link>
        </PrintNotice>
      </PrintLayout>
    );
  }

  const issuer = school ? pick(school.name) : t("print.appName");
  const displayName = name.trim();

  const controls = (
    <label className="print-inline-field print-name-field">
      <span>{t("print.cert_nameLabel")}</span>
      <input
        className="input"
        value={name}
        maxLength={60}
        autoComplete="name"
        placeholder={t("print.cert_namePlaceholder")}
        onChange={(event) => setName(event.target.value)}
      />
    </label>
  );

  return (
    <PrintLayout
      title={t("print.cert_title")}
      controls={controls}
      page={page}
      header={false}
      footer={false}
      className="print-cert-sheet"
    >
      {!displayName ? <p className="notice warning no-print">{t("print.cert_needName")}</p> : null}
      <article className="print-cert" style={{ "--cert-color": color } as CSSProperties}>
        <div className="print-cert-inner">
          <PrintBrand large />
          <Award className="print-cert-icon" size={56} aria-hidden />
          <h1 className="print-cert-title">{t("print.cert_heading")}</h1>
          <p className="print-cert-line">{t("print.cert_certifies")}</p>
          <p className="print-cert-name">{displayName || " "}</p>
          <p className="print-cert-line">
            {t("print.cert_body", { bank: bank.label[lang] })}
          </p>
          <dl className="print-cert-facts">
            <div>
              <dt>{t("print.cert_bestScore")}</dt>
              <dd>
                {num(best.score)}/{num(best.total)} · {pct((best.score / best.total) * 100)}
              </dd>
            </div>
            <div>
              <dt>{t("print.cert_readiness")}</dt>
              <dd>
                {pct(readiness.score)} · {t(`print.readiness_${readiness.label}`)}
              </dd>
            </div>
            <div>
              <dt>{t("print.cert_firstPass")}</dt>
              <dd>{date(firstPass.at, { day: "numeric", month: "long", year: "numeric" })}</dd>
            </div>
          </dl>
          <div className="print-cert-sign">
            <div>
              <span className="print-cert-signline" />
              <span>{school ? t("print.cert_instructor") : t("print.cert_issuedBy", { issuer })}</span>
            </div>
            <div>
              <strong>{date(Date.now(), { day: "numeric", month: "long", year: "numeric" })}</strong>
              <span>{t("print.cert_issuedOn")}</span>
            </div>
          </div>
          <p className="print-cert-disclaimer">
            {t("print.cert_disclaimer")} · {t("print.cert_code", { code: certificateCode(`${active.id}:${firstPass.at}`) })}
          </p>
        </div>
      </article>
    </PrintLayout>
  );
}

export function PosterSheet() {
  const { t, pick } = useI18n();
  const { school, slug } = useSchool();
  const [params, setParams] = useSearchParams();
  const size = params.get("size") === "a5" ? "A5" : "A4";
  const ref = cleanRef(params.get("ref")) ?? "poster";
  const [refDraft, setRefDraft] = useState(ref);

  if (!school || !slug) {
    return (
      <PrintLayout title={t("print.poster_title")} printable={false}>
        <PrintNotice title={t("print.poster_schoolOnly")} />
      </PrintLayout>
    );
  }

  const url = `${appUrl(slug)}?ref=${encodeURIComponent(ref)}`;
  const ar = makeI18n("ar");
  const en = makeI18n("en");
  const headline = pick(school.landing.headline) || t("print.poster_headline");
  const color = safeColor(school.branding.primaryColor, "#0f766e");
  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(name, value);
    setParams(next, { replace: true });
  };

  const controls = (
    <>
      <label className="print-inline-field">
        <span>{t("print.poster_size")}</span>
        <select className="select" value={size} onChange={(event) => setParam("size", event.target.value.toLowerCase())}>
          <option value="A4">A4</option>
          <option value="A5">A5</option>
        </select>
      </label>
      <form
        className="print-inline-field"
        onSubmit={(event) => {
          event.preventDefault();
          setParam("ref", cleanRef(refDraft) ?? "poster");
        }}
      >
        <label className="print-inline-field">
          <span>{t("print.poster_ref")}</span>
          <input
            className="input ltr"
            value={refDraft}
            maxLength={48}
            onChange={(event) => setRefDraft(event.target.value)}
            onBlur={() => setParam("ref", cleanRef(refDraft) ?? "poster")}
          />
        </label>
      </form>
    </>
  );

  return (
    <PrintLayout
      title={t("print.poster_title")}
      controls={controls}
      page={{ size, orientation: "portrait", margin: "0" }}
      header={false}
      footer={false}
      className="print-poster-sheet"
    >
      <article className="print-poster" style={{ "--poster-color": color } as CSSProperties}>
        <div className="print-poster-top">
          {school.branding.logoUrl ? <img className="print-poster-logo" src={school.branding.logoUrl} alt="" /> : null}
          <h1 className="print-poster-name">{pick(school.name)}</h1>
          <p className="print-poster-headline">{headline}</p>
        </div>
        <QrCode value={url} size={360} level="H" className="print-poster-qr" label={t("print.poster_qrLabel")} />
        <div className="print-poster-scan">
          <p lang="ar" dir="rtl">
            {ar.t("print.poster_scan")}
          </p>
          <p lang="en" dir="ltr">
            {en.t("print.poster_scan")}
          </p>
          <p className="print-poster-sub" lang="ar" dir="rtl">
            {ar.t("print.poster_sub")}
          </p>
          <p className="print-poster-sub" lang="en" dir="ltr">
            {en.t("print.poster_sub")}
          </p>
        </div>
        <div className="print-poster-contact">
          {school.contact.phone ? (
            <span className="ltr">
              <Phone size={20} aria-hidden /> {school.contact.phone}
            </span>
          ) : null}
          {school.contact.whatsapp ? (
            <span className="ltr">
              <MessageCircle size={20} aria-hidden /> +{school.contact.whatsapp.replace(/\D/g, "")}
            </span>
          ) : null}
        </div>
        <p className="print-poster-url ltr">{url.replace(/^https?:\/\//, "")}</p>
      </article>
    </PrintLayout>
  );
}
