import { ArrowLeft, ArrowRight, Printer } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSchool } from "../../app/SchoolContext";
import { useSettings } from "../../app/SettingsContext";
import { isLang, LANGS } from "../../i18n/core";
import { useI18n } from "../../i18n/useI18n";

export interface PrintPageSetup {
  size: "A4" | "A5";
  orientation: "portrait" | "landscape";
  /** CSS length for @page margins. */
  margin?: string;
}

interface PrintLayoutProps {
  /** Document title; also used as the default "Save as PDF" file name. */
  title: string;
  subtitle?: string;
  /** Extra toolbar controls (never printed). */
  controls?: ReactNode;
  page?: PrintPageSetup;
  /** Branded header with school logo/name, title and date. */
  header?: boolean;
  /** Footer with the app link. */
  footer?: boolean;
  /** Hide the Print button (e.g. nothing printable yet). */
  printable?: boolean;
  className?: string;
  children: ReactNode;
}

const DEFAULT_PAGE: PrintPageSetup = { size: "A4", orientation: "portrait", margin: "14mm" };

/** Shell of every printable page: a toolbar on screen, a clean sheet on paper. */
export function PrintLayout({
  title,
  subtitle,
  controls,
  page = DEFAULT_PAGE,
  header = true,
  footer = true,
  printable = true,
  className,
  children
}: PrintLayoutProps) {
  const { t, lang, dir } = useI18n();
  const { update } = useSettings();
  const { link } = useSchool();
  const navigate = useNavigate();

  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  const goBack = () => {
    const state = window.history.state as { idx?: number } | null;
    if ((state?.idx ?? 0) > 0) navigate(-1);
    else navigate(link(""));
  };

  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const sheetClass = [
    "print-sheet",
    `print-${page.size.toLowerCase()}`,
    `print-${page.orientation}`,
    className ?? ""
  ].join(" ");

  return (
    <div className="print-root" dir={dir} lang={lang}>
      <style>{`@page { size: ${page.size} ${page.orientation}; margin: ${page.margin ?? DEFAULT_PAGE.margin}; }`}</style>
      <div className="print-toolbar no-print" role="toolbar" aria-label={t("print.toolbar")}>
        <button type="button" className="button button-ghost" onClick={goBack}>
          <BackIcon size={18} aria-hidden />
          {t("print.back")}
        </button>
        <label className="print-lang">
          <span className="visually-hidden">{t("print.language")}</span>
          <select
            className="select"
            value={lang}
            onChange={(event) => {
              if (isLang(event.target.value)) update({ lang: event.target.value });
            }}
          >
            {LANGS.map((info) => (
              <option key={info.code} value={info.code}>
                {info.label}
              </option>
            ))}
          </select>
        </label>
        {controls}
        <span className="grow" />
        {printable ? (
          <button type="button" className="button button-primary" onClick={() => window.print()}>
            <Printer size={18} aria-hidden />
            {t("print.print")}
          </button>
        ) : null}
      </div>
      {printable ? <p className="print-hint no-print">{t("print.pdfHint")}</p> : null}
      <main className={sheetClass}>
        {header ? <PrintHeader title={title} subtitle={subtitle} /> : null}
        {children}
        {footer ? <PrintFooter /> : null}
      </main>
    </div>
  );
}

export function PrintBrand({ large = false }: { large?: boolean }) {
  const { t, pick } = useI18n();
  const { school } = useSchool();
  const name = school ? pick(school.name) : t("print.appName");
  return (
    <div className={`print-brand${large ? " large" : ""}`}>
      {school?.branding.logoUrl ? (
        <img className="print-logo" src={school.branding.logoUrl} alt="" />
      ) : null}
      <span className="print-brand-name">{name}</span>
    </div>
  );
}

function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { date } = useI18n();
  return (
    <header className="print-header">
      <PrintBrand />
      <div className="print-header-title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <time className="print-date" dateTime={new Date().toISOString().slice(0, 10)}>
        {date(Date.now(), { day: "numeric", month: "long", year: "numeric" })}
      </time>
    </header>
  );
}

function PrintFooter() {
  const { t } = useI18n();
  const { slug } = useSchool();
  const url = `${window.location.host}${slug ? `/s/${slug}` : ""}`;
  return (
    <footer className="print-footer">
      <span>{t("print.footer")}</span>
      <span className="ltr">{url}</span>
    </footer>
  );
}

/** Notice shown inside the sheet area (e.g. no data yet). */
export function PrintNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="print-notice">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
