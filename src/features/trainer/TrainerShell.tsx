import {
  BarChart3,
  Bike,
  BookMarked,
  Download,
  Home,
  Languages,
  ListChecks,
  Menu,
  School,
  Settings,
  ShieldCheck,
  SignpostBig,
  WifiOff,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useSettings } from "../../app/SettingsContext";
import { trackEvent } from "../../api/client";
import { Loading } from "../../components/Loading";
import { LANGS } from "../../i18n/core";
import { useI18n } from "../../i18n/useI18n";
import { useInstallPrompt, useOnline } from "../../lib/pwa";
import { ProfileGate } from "./ProfileGate";
import { ProfileAvatar, profileName } from "./components/ProfileAvatar";

const NAV = [
  { path: "", icon: Home, label: "common.navHome", end: true },
  { path: "practice", icon: ListChecks, label: "common.navPractice", end: false },
  { path: "signs", icon: SignpostBig, label: "common.navSigns", end: false },
  { path: "notebook", icon: BookMarked, label: "common.navNotebook", end: false },
  { path: "progress", icon: BarChart3, label: "common.navProgress", end: false }
] as const;

export function TrainerShell() {
  const { t, pick, lang } = useI18n();
  const { update } = useSettings();
  const { school, status, link, slug } = useSchool();
  const { active, locked } = useProfile();
  const location = useLocation();
  const online = useOnline();
  const install = useInstallPrompt();
  const inExam = location.pathname.endsWith("/play");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const name = school ? pick(school.name) : t("common.appName");
    document.title = name;
  }, [school, pick, t]);

  // Anonymous visit counter, once per browser session (no identifiers are sent).
  useEffect(() => {
    const key = `ldt_visit:${slug ?? "public"}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    trackEvent("visit", slug);
  }, [slug]);

  if (status === "loading") return <Loading />;
  if (status === "missing") {
    return (
      <div className="app-shell">
        <div className="empty">
          <h2>{t("common.schoolMissing")}</h2>
          <Link className="button button-primary" to="/">
            {t("common.openPublicTrainer")}
          </Link>
        </div>
      </div>
    );
  }

  const nextLang = LANGS[(LANGS.findIndex((item) => item.code === lang) + 1) % LANGS.length];
  const brandName = school ? pick(school.name) : t("common.appName");

  const offlineBanner = !online ? (
    <div className="notice warning offline-banner" role="status">
      <WifiOff aria-hidden="true" size={18} />
      {t("common.offline")}
    </div>
  ) : null;

  // Exams get the whole screen: the exam page draws its own one-line bar.
  if (inExam) {
    return (
      <div className="app-shell trainer-shell exam-mode">
        {offlineBanner}
        {locked ? <ProfileGate /> : <Outlet />}
      </div>
    );
  }

  return (
    <div className="app-shell trainer-shell">
      <header className="topbar trainer-topbar">
        <Link className="brand-mark" to={link("")} aria-label={t("common.navHome")}>
          {school?.branding.logoUrl ? (
            <img src={school.branding.logoUrl} alt="" className="brand-logo" />
          ) : (
            <Bike aria-hidden="true" size={22} />
          )}
        </Link>
        <div className="brand-text">
          <h1>{brandName}</h1>
          <span>{school ? t("common.poweredTrainer") : t("common.country")}</span>
        </div>
        <div className="topbar-actions">
          <nav className="desktop-nav" aria-label={t("common.mainNav")}>
            {NAV.map((item) => (
              <NavLink key={item.path} to={link(item.path)} end={item.end} className="tab">
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
          <button
            className="icon-button desktop-only"
            type="button"
            onClick={() => update({ lang: nextLang.code })}
            aria-label={t("common.switchLanguage", { lang: nextLang.label })}
            title={nextLang.label}
          >
            <Languages aria-hidden="true" size={18} />
          </button>
          <Link className="icon-button desktop-only" to={link("profiles")} aria-label={t("common.profiles")}>
            <ProfileAvatar profile={active} size={26} />
          </Link>
          <Link className="icon-button desktop-only" to={link("settings")} aria-label={t("common.navSettings")}>
            <Settings aria-hidden="true" size={18} />
          </Link>
          <button
            className="menu-button mobile-only"
            type="button"
            aria-label={t("common.menu")}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <ProfileAvatar profile={active} size={30} />
            <Menu aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      {menuOpen ? <AppMenu onClose={() => setMenuOpen(false)} /> : null}

      {offlineBanner}

      {install.canInstall ? <InstallBanner onInstall={install.prompt} /> : null}

      {locked ? <ProfileGate /> : <Outlet />}

      <footer className="site-footer">
        <span>{t("common.footerOfficial")}</span>
        <span>
          {active.cloud ? t("common.footerLinked", { school: active.cloud.schoolSlug }) : t("common.footerLocal")}
          {" · "}
          <Link to={slug ? `/s/${slug}/privacy` : "/privacy"}>{t("common.privacy")}</Link>
          {school ? (
            <>
              {" · "}
              <Link to={`/s/${slug}`}>{t("common.aboutSchool")}</Link>
            </>
          ) : null}
        </span>
      </footer>

      <nav className="bottom-nav" aria-label={t("common.mainNav")}>
        {NAV.map((item) => (
          <NavLink key={item.path} to={link(item.path)} end={item.end}>
            <item.icon aria-hidden="true" size={20} />
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Phone menu: profile, language and the less-used pages, so the header stays one row. */
function AppMenu({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const { update } = useSettings();
  const { active } = useProfile();
  const { link, school, slug } = useSchool();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div
        className="app-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t("common.menu")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row between">
          <Link className="row app-menu-profile" to={link("profiles")} onClick={onClose}>
            <ProfileAvatar profile={active} size={36} />
            <span className="stack tight">
              <strong>{profileName(active, t)}</strong>
              <span className="muted small">{t("common.switchProfile")}</span>
            </span>
          </Link>
          <button className="icon-button" type="button" aria-label={t("common.dismiss")} onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="field">
          <span>{t("common.language")}</span>
          <div className="row">
            {LANGS.map((item) => (
              <button
                key={item.code}
                type="button"
                className="chip"
                aria-pressed={lang === item.code}
                onClick={() => update({ lang: item.code })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <nav className="list app-menu-links">
          <Link className="list-row" to={link("settings")} onClick={onClose}>
            <Settings aria-hidden="true" size={18} />
            {t("common.navSettings")}
          </Link>
          {school ? (
            <Link className="list-row" to={`/s/${slug}`} onClick={onClose}>
              <School aria-hidden="true" size={18} />
              {t("common.aboutSchool")}
            </Link>
          ) : null}
          <Link className="list-row" to={slug ? `/s/${slug}/privacy` : "/privacy"} onClick={onClose}>
            <ShieldCheck aria-hidden="true" size={18} />
            {t("common.privacy")}
          </Link>
        </nav>
      </div>
    </div>
  );
}

function InstallBanner({ onInstall }: { onInstall: () => void }) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(() => {
    try {
      return window.localStorage.getItem("ldt_install_dismissed") === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <div className="notice install-banner no-print">
      <Download aria-hidden="true" size={18} />
      <span className="grow">{t("common.installHint")}</span>
      <button className="button button-primary compact" type="button" onClick={onInstall}>
        {t("common.install")}
      </button>
      <button
        className="icon-button"
        type="button"
        aria-label={t("common.dismiss")}
        onClick={() => {
          setHidden(true);
          try {
            window.localStorage.setItem("ldt_install_dismissed", "1");
          } catch {
            // ignore
          }
        }}
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
