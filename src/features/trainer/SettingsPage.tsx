import {
  BellRing,
  CloudDownload,
  Database,
  Download,
  Languages,
  MonitorSmartphone,
  Palette,
  RotateCcw,
  School,
  ShieldCheck,
  Timer,
  Users
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useSettings, type QuestionLang, type Theme } from "../../app/SettingsContext";
import { AVAILABLE_BANKS } from "../../data/banks";
import type { Lang } from "../../domain/types";
import { LANGS } from "../../i18n/core";
import { useI18n } from "../../i18n/useI18n";
import { downloadIcs, nextTimeOfDay } from "../../lib/ics";
import { cachedSignCount, cacheSignsForOffline, isIos, isStandalone, useInstallPrompt } from "../../lib/pwa";
import { canSpeak } from "../../lib/speech";
import { profileName } from "./components/ProfileAvatar";
import { useBank } from "./hooks";

export function SettingsPage() {
  const { t, pick, num } = useI18n();
  const { settings, update } = useSettings();
  const { active, resetProgress, profiles } = useProfile();
  const { link, school } = useSchool();
  const { bank } = useBank();
  const install = useInstallPrompt();
  const signUrls = bank.questions.filter((q) => q.sign).map((q) => q.sign as string);
  const [cached, setCached] = useState<number | null>(null);
  const [caching, setCaching] = useState<number | null>(null);

  useEffect(() => {
    void cachedSignCount(signUrls).then(setCached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank.id]);

  const downloadReminder = () => {
    const start = nextTimeOfDay(settings.reminderTime);
    downloadIcs(
      [
        {
          uid: `ldt-daily-${active.id}@trainer`,
          title: t("settings.reminderTitle"),
          description: `${t("settings.reminderBody")} ${window.location.origin}${link("")}`,
          start,
          durationMinutes: 15,
          rrule: "FREQ=DAILY",
          alarmMinutes: 0,
          url: `${window.location.origin}${link("")}`
        }
      ],
      "practice-reminder.ics"
    );
  };

  return (
    <main className="page settings-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("common.navSettings")}</span>
          <h2>{t("settings.title")}</h2>
        </div>
      </header>

      <div className="grid cols-2">
        <Panel icon={<Languages aria-hidden="true" size={20} />} title={t("settings.languageTitle")}>
          <Choice label={t("settings.uiLanguage")}>
            {LANGS.map((item) => (
              <ChipButton key={item.code} active={settings.lang === item.code} onClick={() => update({ lang: item.code })}>
                {item.label}
              </ChipButton>
            ))}
          </Choice>
          <Choice label={t("settings.questionLanguage")} hint={t("settings.questionLanguageHint")}>
            {(["official", "en", "fr"] as QuestionLang[]).map((value) => (
              <ChipButton key={value} active={settings.questionLang === value} onClick={() => update({ questionLang: value })}>
                {t(`settings.qlang_${value}`)}
              </ChipButton>
            ))}
          </Choice>
          {settings.questionLang !== "official" ? (
            <label className="check">
              <input type="checkbox" checked={settings.showOfficial} onChange={(e) => update({ showOfficial: e.target.checked })} />
              {t("settings.showOfficial")}
            </label>
          ) : null}
          <Choice label={t("settings.explanationLanguage")}>
            {(["ui", "ar", "en", "fr"] as (Lang | "ui")[]).map((value) => (
              <ChipButton key={value} active={settings.explanationLang === value} onClick={() => update({ explanationLang: value })}>
                {t(`settings.elang_${value}`)}
              </ChipButton>
            ))}
          </Choice>
        </Panel>

        <Panel icon={<Palette aria-hidden="true" size={20} />} title={t("settings.displayTitle")}>
          <Choice label={t("settings.theme")}>
            {(["system", "light", "dark"] as Theme[]).map((value) => (
              <ChipButton key={value} active={settings.theme === value} onClick={() => update({ theme: value })}>
                {t(`settings.theme_${value}`)}
              </ChipButton>
            ))}
          </Choice>
          <Choice label={t("settings.fontSize")}>
            {[0.9, 1, 1.15, 1.3].map((value) => (
              <ChipButton key={value} active={settings.fontScale === value} onClick={() => update({ fontScale: value })}>
                <span style={{ fontSize: `${value}em` }}>{t("settings.fontSample")}</span>
              </ChipButton>
            ))}
          </Choice>
          <label className="check">
            <input type="checkbox" checked={settings.highContrast} onChange={(e) => update({ highContrast: e.target.checked })} />
            {t("settings.highContrast")}
          </label>
          {canSpeak() ? (
            <label className="check">
              <input type="checkbox" checked={settings.autoRead} onChange={(e) => update({ autoRead: e.target.checked })} />
              {t("settings.autoRead")}
            </label>
          ) : null}
          <label className="check">
            <input type="checkbox" checked={settings.lowData} onChange={(e) => update({ lowData: e.target.checked })} />
            <span>
              {t("settings.lowData")}
              <span className="hint block muted small">{t("settings.lowDataHint")}</span>
            </span>
          </label>
        </Panel>

        <Panel icon={<Timer aria-hidden="true" size={20} />} title={t("settings.examTitle")}>
          <Choice label={t("settings.timer")} hint={t("settings.timerHint")}>
            {[20, 30, 40, 60].map((value) => (
              <ChipButton key={value} active={settings.timerMinutes === value} onClick={() => update({ timerMinutes: value })}>
                {t("settings.minutes", { n: value })}
              </ChipButton>
            ))}
          </Choice>
          {AVAILABLE_BANKS.length > 1 ? (
            <Choice label={t("settings.bank")}>
              {AVAILABLE_BANKS.map((item) => (
                <ChipButton key={item.id} active={settings.bank === item.id} onClick={() => update({ bank: item.id })}>
                  {pick(item.label)}
                </ChipButton>
              ))}
            </Choice>
          ) : null}
        </Panel>

        <Panel icon={<BellRing aria-hidden="true" size={20} />} title={t("settings.reminderSection")}>
          <p className="muted small">{t("settings.reminderHint")}</p>
          <div className="row">
            <label className="field">
              <span>{t("settings.reminderTime")}</span>
              <input
                className="input ltr"
                type="time"
                value={settings.reminderTime}
                onChange={(e) => update({ reminderTime: e.target.value || "19:00" })}
              />
            </label>
            <button className="button button-secondary" type="button" onClick={downloadReminder}>
              <Download aria-hidden="true" size={18} />
              {t("settings.addToCalendar")}
            </button>
          </div>
        </Panel>

        <Panel icon={<MonitorSmartphone aria-hidden="true" size={20} />} title={t("settings.offlineTitle")}>
          {isStandalone() ? (
            <p className="form-success">{t("settings.installed")}</p>
          ) : install.canInstall ? (
            <button className="button button-primary" type="button" onClick={install.prompt}>
              <Download aria-hidden="true" size={18} />
              {t("common.install")}
            </button>
          ) : (
            <p className="muted small">{isIos() ? t("settings.iosInstall") : t("settings.browserInstall")}</p>
          )}
          <p className="muted small">
            {t("settings.offlineSigns", { cached: cached ?? 0, total: signUrls.length })}
          </p>
          <button
            className="button button-ghost"
            type="button"
            disabled={caching !== null || cached === signUrls.length}
            onClick={async () => {
              setCaching(0);
              await cacheSignsForOffline(signUrls, setCaching);
              setCaching(null);
              setCached(await cachedSignCount(signUrls));
            }}
          >
            <CloudDownload aria-hidden="true" size={18} />
            {caching !== null ? t("settings.caching", { n: num(caching), total: num(signUrls.length) }) : t("settings.cacheSigns")}
          </button>
        </Panel>

        <Panel icon={<Users aria-hidden="true" size={20} />} title={t("settings.profilesTitle")}>
          <p className="muted small">
            {t("settings.profilesHint", { name: profileName(active, t), n: profiles.length })}
          </p>
          <Link className="button button-secondary" to={link("profiles")}>
            {t("settings.manageProfiles")}
          </Link>
        </Panel>

        <Panel icon={<School aria-hidden="true" size={20} />} title={t("settings.schoolTitle")}>
          {active.cloud ? (
            <p className="small">{t("settings.linkedTo", { school: active.cloud.schoolSlug })}</p>
          ) : (
            <p className="muted small">{school ? t("settings.notLinkedSchool") : t("settings.notLinked")}</p>
          )}
          <Link className="button button-ghost" to={link("join")}>
            {active.cloud ? t("settings.manageSchoolAccount") : t("settings.joinSchool")}
          </Link>
        </Panel>

        <Panel icon={<ShieldCheck aria-hidden="true" size={20} />} title={t("settings.privacyTitle")}>
          <p className="muted small">{active.cloud ? t("settings.privacyCloud") : t("settings.privacyLocal")}</p>
          <Link to={school ? `/s/${school.slug}/privacy` : "/privacy"}>{t("common.privacy")}</Link>
        </Panel>

        <Panel icon={<Database aria-hidden="true" size={20} />} title={t("settings.dataTitle")} danger>
          <p className="muted small">{t("settings.resetHint", { name: profileName(active, t) })}</p>
          <button
            className="button button-danger"
            type="button"
            onClick={() => {
              if (window.confirm(t("settings.resetConfirm"))) resetProgress();
            }}
          >
            <RotateCcw aria-hidden="true" size={18} />
            {t("settings.reset")}
          </button>
        </Panel>
      </div>
    </main>
  );
}

function Panel({ icon, title, children, danger }: { icon: ReactNode; title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`card stack ${danger ? "danger-panel" : ""}`}>
      <div className="card-title">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function Choice({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="row">{children}</div>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}
