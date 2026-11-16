import { ArrowLeft, ArrowRight, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSchool } from "../../app/SchoolContext";
import { Loading } from "../../components/Loading";
import { useI18n } from "../../i18n/useI18n";
import { LangSwitcher } from "../school/LangSwitcher";

interface PolicySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

/** Section text lives in the privacy namespace; this lists which keys form each section. */
const SECTIONS: PolicySection[] = [
  {
    id: "device",
    title: "privacy.device_title",
    paragraphs: ["privacy.device_p1"],
    bullets: ["privacy.device_b1", "privacy.device_b2", "privacy.device_b3", "privacy.device_b4"]
  },
  {
    id: "sent",
    title: "privacy.sent_title",
    paragraphs: ["privacy.sent_p1"],
    bullets: ["privacy.sent_b1", "privacy.sent_b2", "privacy.sent_b3", "privacy.sent_b4"]
  },
  {
    id: "cloud",
    title: "privacy.cloud_title",
    paragraphs: ["privacy.cloud_p1", "privacy.cloud_p2"],
    bullets: ["privacy.cloud_b1", "privacy.cloud_b2", "privacy.cloud_b3", "privacy.cloud_b4"]
  },
  {
    id: "forms",
    title: "privacy.forms_title",
    paragraphs: ["privacy.forms_p1"]
  },
  {
    id: "retention",
    title: "privacy.retention_title",
    paragraphs: ["privacy.retention_p1"],
    bullets: ["privacy.retention_b1", "privacy.retention_b2", "privacy.retention_b3"]
  },
  {
    id: "rights",
    title: "privacy.rights_title",
    paragraphs: ["privacy.rights_p1"],
    bullets: ["privacy.rights_b1", "privacy.rights_b2", "privacy.rights_b3", "privacy.rights_b4"]
  },
  {
    id: "law",
    title: "privacy.law_title",
    paragraphs: ["privacy.law_p1", "privacy.law_p2"],
    bullets: ["privacy.law_b1", "privacy.law_b2", "privacy.law_b3", "privacy.law_b4"]
  },
  {
    id: "security",
    title: "privacy.security_title",
    paragraphs: ["privacy.security_p1"]
  },
  {
    id: "changes",
    title: "privacy.changes_title",
    paragraphs: ["privacy.changes_p1"]
  }
];

/** Plain-language privacy policy (template for schools to review). /privacy and /s/:slug/privacy */
export function PrivacyPage() {
  const { t, pick, dir } = useI18n();
  const { school, slug, status } = useSchool();
  const navigate = useNavigate();

  if (status === "loading") return <Loading />;

  const schoolName = school ? pick(school.name) : t("privacy.theSchool");
  const backTo = slug ? `/s/${slug}` : "/";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const goBack = (event: MouseEvent<HTMLAnchorElement>) => {
    const state = window.history.state as { idx?: number } | null;
    if ((state?.idx ?? 0) > 0) {
      event.preventDefault();
      navigate(-1);
    }
  };
  const contact = school?.contact;
  const vars = { school: schoolName };

  return (
    <div className="school-page privacy-page">
      <header className="school-header">
        <Link to={backTo} className="button button-ghost" onClick={goBack}>
          <BackIcon size={18} aria-hidden />
          {t("privacy.back")}
        </Link>
        <span className="grow" />
        <LangSwitcher />
      </header>

      <main className="school-main">
        <article className="privacy-article card">
          <header className="stack tight">
            <p className="eyebrow">
              <ShieldCheck size={16} aria-hidden /> {school ? schoolName : t("privacy.eyebrow")}
            </p>
            <h1 className="school-title">{t("privacy.title")}</h1>
            <p className="small muted">{t("privacy.updated")}</p>
          </header>

          <p className="notice warning">{t(school ? "privacy.templateSchool" : "privacy.template", vars)}</p>

          <section className="privacy-summary" aria-labelledby="privacy-summary">
            <h2 id="privacy-summary">{t("privacy.summary_title")}</h2>
            <ul>
              <li>{t("privacy.summary_b1")}</li>
              <li>{t("privacy.summary_b2")}</li>
              <li>{t("privacy.summary_b3", vars)}</li>
              <li>{t("privacy.summary_b4")}</li>
            </ul>
          </section>

          {SECTIONS.map((section) => (
            <section key={section.id} className="privacy-section" aria-labelledby={`privacy-${section.id}`}>
              <h2 id={`privacy-${section.id}`}>{t(section.title)}</h2>
              {section.paragraphs.map((key) => (
                <p key={key}>{t(key, vars)}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((key) => (
                    <li key={key}>{t(key, vars)}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section className="privacy-section" aria-labelledby="privacy-contact">
            <h2 id="privacy-contact">{t("privacy.contact_title")}</h2>
            {school && contact ? (
              <>
                <p>{t("privacy.contact_school", vars)}</p>
                <ul className="privacy-contact">
                  {contact.phone ? (
                    <li>
                      <Phone size={16} aria-hidden />
                      <a className="ltr" href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
                        {contact.phone}
                      </a>
                    </li>
                  ) : null}
                  {contact.whatsapp ? (
                    <li>
                      <MessageCircle size={16} aria-hidden />
                      <a className="ltr" href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                        +{contact.whatsapp.replace(/\D/g, "")}
                      </a>
                    </li>
                  ) : null}
                  {contact.email ? (
                    <li>
                      <Mail size={16} aria-hidden />
                      <a className="ltr" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    </li>
                  ) : null}
                  {contact.address ? (
                    <li>
                      <MapPin size={16} aria-hidden />
                      <span>{contact.address}</span>
                    </li>
                  ) : null}
                </ul>
                {!contact.phone && !contact.whatsapp && !contact.email ? (
                  <p className="muted">{t("privacy.contact_noDetails")}</p>
                ) : null}
              </>
            ) : (
              <p>{t("privacy.contact_public")}</p>
            )}
          </section>

          <p className="small muted">{t("privacy.notAdvice")}</p>
        </article>
      </main>
    </div>
  );
}

export default PrivacyPage;
