import {
  BookOpenCheck,
  Facebook,
  Gauge,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlayCircle,
  Quote,
  Repeat,
  ShieldCheck,
  Signpost
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiHealth, trackEvent } from "../../api/client";
import type { PublicSchool } from "../../api/types";
import { useSchool } from "../../app/SchoolContext";
import { Loading } from "../../components/Loading";
import { BANKS } from "../../data/banks";
import { useI18n } from "../../i18n/useI18n";
import { cleanRef, whatsappLink } from "../print/lib";
import { LangSwitcher } from "./LangSwitcher";
import { AppointmentForm, LeadForm } from "./SchoolForms";

const REF_KEY = "ldt_ref";

function sessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private mode: counters may run twice, nothing else breaks.
  }
}

/** Referral code for this school from ?ref= (kept for the session so a later lead keeps it). */
export function storedRef(slug: string): string | null {
  return cleanRef(sessionGet(`${REF_KEY}:${slug}`));
}

function socialUrl(kind: "instagram" | "tiktok" | "facebook" | "website", value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  switch (kind) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "facebook":
      return `https://facebook.com/${handle}`;
    default:
      return `https://${trimmed}`;
  }
}

function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Public page of a school: /s/:slug */
export function SchoolLanding() {
  const { status, school, slug } = useSchool();
  if (status === "loading") return <Loading />;
  if (!school || !slug) return <SchoolMissing />;
  return <SchoolLandingContent school={school} slug={slug} />;
}

function SchoolMissing() {
  const { t } = useI18n();
  return (
    <div className="school-page">
      <header className="school-header">
        <span className="grow" />
        <LangSwitcher />
      </header>
      <main className="school-main">
        <section className="empty school-missing">
          <Signpost size={40} aria-hidden />
          <h1 className="school-title">{t("school.missing_title")}</h1>
          <p>{t("school.missing_body")}</p>
          <Link className="button button-primary" to="/">
            {t("school.missing_cta")}
          </Link>
        </section>
      </main>
    </div>
  );
}

function SchoolLandingContent({ school, slug }: { school: PublicSchool; slug: string }) {
  const { t, pick, num, pct } = useI18n();
  const { link } = useSchool();
  const [params] = useSearchParams();
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const urlRef = cleanRef(params.get("ref"));
  const name = pick(school.name);
  const suspended = school.status === "suspended";

  useEffect(() => {
    let cancelled = false;
    void apiHealth().then((health) => {
      if (!cancelled) setApiOk(health.ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const visitKey = `ldt_visit:${slug}`;
    if (!sessionGet(visitKey)) {
      sessionSet(visitKey, "1");
      trackEvent("visit", slug);
    }
    if (urlRef) {
      sessionSet(`${REF_KEY}:${slug}`, urlRef);
      const scanKey = `ldt_scan:${slug}:${urlRef}`;
      if (!sessionGet(scanKey)) {
        sessionSet(scanKey, "1");
        trackEvent("qr_scan", slug, urlRef);
      }
    }
  }, [slug, urlRef]);

  useEffect(() => {
    const previous = document.title;
    document.title = name;
    return () => {
      document.title = previous;
    };
  }, [name]);

  const { contact, landing } = school;
  const waNumber = contact.whatsapp?.replace(/\D/g, "") || null;
  const waHref = waNumber ? whatsappLink(waNumber, t("school.waMessage", { school: name })) : null;
  const formsEnabled = apiOk === true && school.features.leads && !suspended;
  const headline = pick(landing.headline) || t("school.defaultHeadline");
  const about = pick(landing.about);
  const questionCount = BANKS.motorcycle.questions.length + BANKS.car.questions.length;
  const passRate = landing.passRate?.verified ? landing.passRate : null;
  const showCounters = landing.showStats && (school.stats.studentsTrained > 0 || school.stats.examsCompleted > 0);

  const contactButtons = (
    <div className="row school-contact-buttons">
      {waHref ? (
        <a className="button button-primary" href={waHref} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={18} aria-hidden />
          {t("school.whatsapp")}
        </a>
      ) : null}
      {contact.phone ? (
        <a className="button button-secondary" href={telLink(contact.phone)}>
          <Phone size={18} aria-hidden />
          {t("school.call")}
        </a>
      ) : null}
      {contact.email ? (
        <a className="button button-ghost" href={`mailto:${contact.email}`}>
          <Mail size={18} aria-hidden />
          {t("school.email")}
        </a>
      ) : null}
    </div>
  );

  const socials: { key: string; href: string; label: string; icon: ReactNode }[] = [];
  if (contact.instagram) socials.push({ key: "instagram", href: socialUrl("instagram", contact.instagram), label: "Instagram", icon: <Instagram size={18} aria-hidden /> });
  if (contact.tiktok) socials.push({ key: "tiktok", href: socialUrl("tiktok", contact.tiktok), label: "TikTok", icon: <PlayCircle size={18} aria-hidden /> });
  if (contact.facebook) socials.push({ key: "facebook", href: socialUrl("facebook", contact.facebook), label: "Facebook", icon: <Facebook size={18} aria-hidden /> });
  if (contact.website) socials.push({ key: "website", href: socialUrl("website", contact.website), label: t("school.website"), icon: <Globe size={18} aria-hidden /> });

  const branches = school.branches.length
    ? school.branches
    : contact.address || contact.mapUrl
      ? [{ id: "main", name, address: contact.address, mapUrl: contact.mapUrl, phone: contact.phone }]
      : [];

  return (
    <div className="school-page">
      <header className="school-header">
        <Link to={`/s/${slug}`} className="school-header-brand">
          {school.branding.logoUrl ? <img src={school.branding.logoUrl} alt="" className="school-header-logo" /> : null}
          <span>{name}</span>
        </Link>
        <span className="grow" />
        <LangSwitcher />
      </header>

      <main className="school-main">
        <section className="school-hero">
          {school.branding.logoUrl ? <img className="school-hero-logo" src={school.branding.logoUrl} alt={t("school.logoAlt", { school: name })} /> : null}
          <p className="eyebrow">{t("school.eyebrow")}</p>
          <h1 className="school-title">{name}</h1>
          <p className="school-headline">{headline}</p>
          {suspended ? (
            <>
              <p className="notice warning">{t("school.suspended")}</p>
              {contactButtons}
            </>
          ) : (
            <div className="row school-cta">
              <Link className="button button-primary school-cta-main" to={link("")}>
                <PlayCircle size={20} aria-hidden />
                {t("school.start")}
              </Link>
              {waHref ? (
                <a className="button button-secondary" href={waHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={20} aria-hidden />
                  {t("school.whatsapp")}
                </a>
              ) : null}
            </div>
          )}
          {!suspended ? <p className="small muted">{t("school.free")}</p> : null}
        </section>

        {!suspended ? (
          <>
            {about ? (
              <section className="card school-about">
                <h2 className="card-title">{t("school.about")}</h2>
                <p className="school-prose">{about}</p>
              </section>
            ) : null}

            <section className="stack" aria-labelledby="school-highlights">
              <h2 className="school-section-title" id="school-highlights">
                {t("school.highlights_title")}
              </h2>
              <div className="grid cols-2 school-highlights">
                <Highlight icon={<BookOpenCheck aria-hidden />} title={t("school.highlights_official")} text={t("school.highlights_officialText", { n: questionCount })} />
                <Highlight icon={<Signpost aria-hidden />} title={t("school.highlights_signs")} text={t("school.highlights_signsText")} />
                <Highlight icon={<Repeat aria-hidden />} title={t("school.highlights_adaptive")} text={t("school.highlights_adaptiveText")} />
                <Highlight icon={<Gauge aria-hidden />} title={t("school.highlights_readiness")} text={t("school.highlights_readinessText")} />
              </div>
            </section>

            {showCounters || passRate ? (
              <section className="grid cols-3 school-stats" aria-label={t("school.stats_title")}>
                {showCounters ? (
                  <>
                    <div className="card stat">
                      <span className="stat-value">{num(school.stats.studentsTrained)}</span>
                      <span className="stat-label">{t("school.stats_students")}</span>
                    </div>
                    <div className="card stat">
                      <span className="stat-value">{num(school.stats.examsCompleted)}</span>
                      <span className="stat-label">{t("school.stats_exams")}</span>
                    </div>
                  </>
                ) : null}
                {passRate ? (
                  <div className="card stat">
                    <span className="stat-value">{pct(passRate.value)}</span>
                    <span className="stat-label">{t("school.stats_passRate")}</span>
                    {passRate.note ? <span className="small muted">{passRate.note}</span> : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            {landing.testimonials.length ? (
              <section className="stack" aria-labelledby="school-testimonials">
                <h2 className="school-section-title" id="school-testimonials">
                  {t("school.testimonials")}
                </h2>
                <div className="grid cols-2">
                  {landing.testimonials.map((item, index) => (
                    <figure key={`${item.name}-${index}`} className="card school-testimonial">
                      <Quote aria-hidden />
                      <blockquote>{item.text}</blockquote>
                      <figcaption>{item.name}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {branches.length ? (
          <section className="stack" aria-labelledby="school-branches">
            <h2 className="school-section-title" id="school-branches">
              {school.branches.length > 1 ? t("school.branches") : t("school.findUs")}
            </h2>
            <div className="grid cols-2">
              {branches.map((branch) => (
                <article key={branch.id} className="card stack tight school-branch">
                  <h3 className="strong">{branch.name}</h3>
                  {branch.address ? (
                    <p className="row school-branch-line">
                      <MapPin size={18} aria-hidden />
                      <span>{branch.address}</span>
                    </p>
                  ) : null}
                  <div className="row">
                    {branch.mapUrl ? (
                      <a className="button button-ghost" href={branch.mapUrl} target="_blank" rel="noopener noreferrer">
                        <MapPin size={18} aria-hidden />
                        {t("school.map")}
                      </a>
                    ) : null}
                    {branch.phone ? (
                      <a className="button button-ghost" href={telLink(branch.phone)}>
                        <Phone size={18} aria-hidden />
                        <span className="ltr">{branch.phone}</span>
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="stack" aria-labelledby="school-contact">
          <h2 className="school-section-title" id="school-contact">
            {t("school.contact")}
          </h2>
          {formsEnabled ? (
            <>
              <div className="grid cols-2 school-forms">
                <LeadForm school={school} slug={slug} refCode={urlRef ?? storedRef(slug)} />
                <AppointmentForm school={school} slug={slug} />
              </div>
              {contactButtons}
            </>
          ) : (
            <div className="card stack">
              <p className="muted">{apiOk === null ? t("school.checking") : t("school.contactIntro")}</p>
              {contactButtons}
            </div>
          )}
          {socials.length ? (
            <div className="row school-socials">
              {socials.map((social) => (
                <a key={social.key} className="chip" href={social.href} target="_blank" rel="noopener noreferrer">
                  {social.icon}
                  {social.label}
                </a>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      <footer className="school-footer">
        <span>© {name}</span>
        <Link to={`/s/${slug}/privacy`}>
          <ShieldCheck size={16} aria-hidden /> {t("school.privacy")}
        </Link>
        {!suspended ? <Link to={link("")}>{t("school.start")}</Link> : null}
      </footer>
    </div>
  );
}

function Highlight({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="card school-highlight">
      <span className="school-highlight-icon">{icon}</span>
      <div className="stack tight">
        <h3 className="strong">{title}</h3>
        <p className="muted small">{text}</p>
      </div>
    </article>
  );
}

export default SchoolLanding;
