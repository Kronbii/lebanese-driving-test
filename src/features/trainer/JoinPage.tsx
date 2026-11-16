import { CalendarPlus, CloudOff, Download, KeyRound, Link2Off, RefreshCw, School, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError, apiHealth, downloadFrom } from "../../api/client";
import type { StudentAuthResponse, StudentSelf } from "../../api/types";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { useI18n } from "../../i18n/useI18n";
import { downloadIcs } from "../../lib/ics";

export const CONSENT_VERSION = "2026-11-v1";

/** Link this profile to a school (cloud mode) with an invite code, or manage the link. */
export function JoinPage() {
  const { t } = useI18n();
  const { active } = useProfile();
  const [online, setOnline] = useState<boolean | null>(null);
  // Shown once right after joining, before the linked-account view takes over.
  const [freshCode, setFreshCode] = useState<string | null>(null);

  useEffect(() => {
    void apiHealth().then((health) => setOnline(health.ok));
  }, []);

  return (
    <main className="page join-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("settings.schoolTitle")}</span>
          <h2>{active.cloud ? t("settings.schoolAccount") : t("settings.joinTitle")}</h2>
          <p>{t("settings.joinSubtitle")}</p>
        </div>
      </header>
      {freshCode ? (
        <LoginCodeNotice code={freshCode} onDone={() => setFreshCode(null)} />
      ) : online === false ? (
        <div className="notice warning">
          <CloudOff aria-hidden="true" size={18} />
          {t("settings.apiOffline")}
        </div>
      ) : active.cloud ? (
        <LinkedAccount />
      ) : (
        <JoinForms onLoginCode={setFreshCode} />
      )}
    </main>
  );
}

function errorText(t: (key: string) => string, error: unknown): string {
  const code = error instanceof ApiError ? error.code : "server_error";
  const key = `settings.error_${code}`;
  const text = t(key);
  return text === key ? t("settings.error_server_error") : text;
}

function JoinForms({ onLoginCode }: { onLoginCode: (code: string) => void }) {
  const { t } = useI18n();
  const { linkCloud } = useProfile();
  const { school, slug } = useSchool();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"code" | "login">("code");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finish = (response: StudentAuthResponse) => {
    if (response.loginCode) onLoginCode(response.loginCode);
    linkCloud({
      studentId: response.student.id,
      deviceToken: response.deviceToken,
      schoolSlug: response.student.school.slug,
      displayName: response.student.displayName,
      lastSyncAt: null
    });
  };

  const join = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api<StudentAuthResponse>("/student/join", {
        body: {
          code: code.trim().toUpperCase(),
          displayName: displayName.trim(),
          phone: phone.trim() || null,
          consent,
          consentVersion: CONSENT_VERSION
        }
      });
      finish(response);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      finish(await api<StudentAuthResponse>("/student/login", { body: { loginCode: loginCode.trim().toUpperCase() } }));
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card stack">
      <div className="tabs">
        <button type="button" className={`tab ${tab === "code" ? "active" : ""}`} onClick={() => setTab("code")}>
          {t("settings.haveInvite")}
        </button>
        <button type="button" className={`tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>
          {t("settings.haveLoginCode")}
        </button>
      </div>
      {tab === "code" ? (
        <form className="stack" onSubmit={join}>
          <label className="field">
            <span>{t("settings.inviteCode")}</span>
            <input className="input ltr" value={code} required autoCapitalize="characters" onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("settings.displayName")}</span>
            <input className="input" value={displayName} required maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
            <span className="hint">{t("settings.displayNameHint")}</span>
          </label>
          {!school || school.collectPhone ? (
            <label className="field">
              <span>{t("settings.phoneOptional")}</span>
              <input className="input ltr" type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
            </label>
          ) : null}
          <div className="notice">
            <span className="small">{t("settings.consentExplain")}</span>
          </div>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>
              {t("settings.consentCheck")}{" "}
              <Link to={slug ? `/s/${slug}/privacy` : "/privacy"} target="_blank">
                {t("common.privacy")}
              </Link>
            </span>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button button-primary" type="submit" disabled={busy || !consent || !code.trim() || !displayName.trim()}>
            <School aria-hidden="true" size={18} />
            {t("settings.joinButton")}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={login}>
          <label className="field">
            <span>{t("settings.loginCode")}</span>
            <input className="input ltr" value={loginCode} required autoCapitalize="characters" onChange={(e) => setLoginCode(e.target.value)} />
            <span className="hint">{t("settings.loginCodeHint")}</span>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button button-primary" type="submit" disabled={busy || !loginCode.trim()}>
            <KeyRound aria-hidden="true" size={18} />
            {t("settings.loginButton")}
          </button>
        </form>
      )}
    </section>
  );
}

function LoginCodeNotice({ code, onDone }: { code: string; onDone: () => void }) {
  const { t } = useI18n();
  return (
    <section className="card stack">
      <div className="card-title">
        <KeyRound aria-hidden="true" size={20} />
        {t("settings.saveLoginCode")}
      </div>
      <p>{t("settings.saveLoginCodeHint")}</p>
      <p className="login-code ltr">{code}</p>
      <button className="button button-primary" type="button" onClick={onDone}>
        {t("settings.continue")}
      </button>
    </section>
  );
}

function LinkedAccount() {
  const { t, date, pick } = useI18n();
  const { active, unlinkCloud, syncNow, syncStatus } = useProfile();
  const [self, setSelf] = useState<StudentSelf | null>(null);
  const [error, setError] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const cloud = active.cloud!;

  useEffect(() => {
    api<StudentSelf>("/student/me", { token: cloud.deviceToken })
      .then(setSelf)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setError(t("settings.linkExpired"));
        else setError(errorText(t, err));
      });
  }, [cloud.deviceToken, t]);

  const examReminder = () => {
    if (!self?.examDate) return;
    const start = new Date(self.examDate);
    if (Number.isNaN(start.getTime())) return;
    if (!self.examDate.includes("T")) start.setHours(9, 0, 0, 0);
    downloadIcs(
      [{ uid: `ldt-exam-${self.id}@trainer`, title: t("settings.examEventTitle"), start, durationMinutes: 60, alarmMinutes: 24 * 60 }],
      "theory-exam.ics"
    );
  };

  return (
    <div className="stack">
      <section className="card stack">
        <div className="card-title">
          <School aria-hidden="true" size={20} />
          {self ? pick(self.school.name) : cloud.schoolSlug}
        </div>
        <p>{t("settings.linkedAs", { name: cloud.displayName })}</p>
        <p className="muted small">
          {syncStatus === "error"
            ? t("settings.syncError")
            : syncStatus === "syncing"
              ? t("settings.syncing")
              : cloud.lastSyncAt
                ? t("settings.lastSync", { when: date(cloud.lastSyncAt) })
                : t("settings.notSyncedYet")}
        </p>
        {self?.examDate ? (
          <div className="row">
            <span className="chip">{t("settings.examDate", { when: date(self.examDate, { day: "numeric", month: "long", year: "numeric" }) })}</span>
            <button className="button button-ghost compact" type="button" onClick={examReminder}>
              <CalendarPlus aria-hidden="true" size={16} />
              {t("settings.addToCalendar")}
            </button>
          </div>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <div className="row">
          <button className="button button-secondary" type="button" onClick={() => void syncNow()}>
            <RefreshCw aria-hidden="true" size={18} />
            {t("settings.syncNow")}
          </button>
          <button
            className="button button-ghost"
            type="button"
            onClick={async () => {
              try {
                const response = await api<{ loginCode: string }>("/student/login-code", { method: "POST", token: cloud.deviceToken });
                setNewCode(response.loginCode);
              } catch (err) {
                setError(errorText(t, err));
              }
            }}
          >
            <KeyRound aria-hidden="true" size={18} />
            {t("settings.newLoginCode")}
          </button>
        </div>
        {newCode ? (
          <div className="notice">
            <span>
              {t("settings.saveLoginCodeHint")} <strong className="ltr login-code-inline">{newCode}</strong>
            </span>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <div className="card-title">{t("settings.yourData")}</div>
        <p className="muted small">{t("settings.yourDataHint")}</p>
        <div className="row">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => void downloadFrom("/student/export", "my-school-data.json", cloud.deviceToken).catch((err) => setError(errorText(t, err)))}
          >
            <Download aria-hidden="true" size={18} />
            {t("settings.exportMyData")}
          </button>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => {
              if (window.confirm(t("settings.unlinkConfirm"))) unlinkCloud();
            }}
          >
            <Link2Off aria-hidden="true" size={18} />
            {t("settings.unlinkDevice")}
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={async () => {
              if (!window.confirm(t("settings.deleteCloudConfirm"))) return;
              try {
                await api("/student/me", { method: "DELETE", token: cloud.deviceToken });
                unlinkCloud();
              } catch (err) {
                setError(errorText(t, err));
              }
            }}
          >
            <Trash2 aria-hidden="true" size={18} />
            {t("settings.deleteCloudData")}
          </button>
        </div>
      </section>
    </div>
  );
}
