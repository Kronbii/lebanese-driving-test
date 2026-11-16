import { LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/useI18n";

export function CodeEntry() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const ready = code.length === 6;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) navigate(`/live/${code}`);
  };

  return (
    <form className="live-card stack" onSubmit={submit}>
      <h1 className="live-title">{t("live.enterCodeTitle")}</h1>
      <p className="muted">{t("live.enterCodeIntro")}</p>
      <label className="field">
        <span className="visually-hidden">{t("live.codeLabel")}</span>
        <input
          className="input live-code-input ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          aria-label={t("live.codeLabel")}
        />
      </label>
      <button type="submit" className="button button-primary live-big-button" disabled={!ready}>
        <LogIn size={22} aria-hidden="true" className="staff-flip" />
        {t("live.continue")}
      </button>
    </form>
  );
}
