import {
  BarChart3,
  Bike,
  BookMarked,
  Download,
  Home,
  Languages,
  ListChecks,
  Settings,
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
import { ProfileAvatar } from "./components/ProfileAvatar";

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
          {!inExam ? (
            <nav className="desktop-nav" aria-label={t("common.mainNav")}>
              {NAV.map((item) => (
                <NavLink key={item.path} to={link(item.path)} end={item.end} className="tab">
                  {t(item.label)}
                </NavLink>
              ))}
            </nav>
          ) : null}
          <button
            className="icon-button"
            type="button"
            onClick={() => update({ lang: nextLang.code })}
            aria-label={t("common.switchLanguage", { lang: nextLang.label })}
            title={nextLang.label}
          >
            <Languages aria-hidden="true" size={18} />
          </button>
          <Link className="icon-button" to={link("profiles")} aria-label={t("common.profiles")}>
            <ProfileAvatar profile={active} size={26} />
          </Link>
          <Link className="icon-button" to={link("settings")} aria-label={t("common.navSettings")}>
            <Settings aria-hidden="true" size={18} />
          </Link>
        </div>
      </header>

      {!online ? (
        <div className="notice warning offline-banner" role="status">
          <WifiOff aria-hidden="true" size={18} />
          {t("common.offline")}
        </div>
      ) : null}

      {install.canInstall && !inExam ? <InstallBanner onInstall={install.prompt} /> : null}

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

      {!inExam ? (
        <nav className="bottom-nav" aria-label={t("common.mainNav")}>
          {NAV.map((item) => (
            <NavLink key={item.path} to={link(item.path)} end={item.end}>
              <item.icon aria-hidden="true" size={20} />
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
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
