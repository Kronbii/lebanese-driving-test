import { Mail, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import type { RequestLinkResponse } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { FormError } from "../shared/ErrorNotice";

export function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<RequestLinkResponse | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await api<RequestLinkResponse>("/auth/request-link", { body: { email: email.trim() } });
      setSent(response);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="stack">
        <MailCheck size={36} className="staff-auth-icon" aria-hidden="true" />
        <h1 className="staff-auth-title">{t("staff.checkEmailTitle")}</h1>
        <p className="muted">{t("staff.checkEmailBody", { email: email.trim() })}</p>
        {sent.devLink ? (
          <div className="notice warning">
            <div className="stack tight">
              <span className="strong">{t("staff.devLinkLabel")}</span>
              <a href={sent.devLink} className="ltr staff-break">
                {sent.devLink}
              </a>
            </div>
          </div>
        ) : null}
        <button type="button" className="button button-ghost" onClick={() => setSent(null)}>
          {t("staff.useAnotherEmail")}
        </button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h1 className="staff-auth-title">{t("staff.loginTitle")}</h1>
      <p className="muted">{t("staff.loginIntro")}</p>
      <label className="field">
        <span>{t("staff.email")}</span>
        <input
          className="input ltr"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@school.com"
        />
      </label>
      <FormError error={error} />
      <button type="submit" className="button button-primary" disabled={busy || !email.trim()}>
        <Mail size={18} aria-hidden="true" />
        {busy ? t("staff.working") : t("staff.sendLink")}
      </button>
      <p className="small muted">{t("staff.loginPrivacy")}</p>
    </form>
  );
}
