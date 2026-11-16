import { Users } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { ClassroomPlayerState } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { FormError } from "../staff/shared/ErrorNotice";
import { hasCode } from "../staff/shared/errors";

interface JoinResponse {
  participantToken: string;
  state: ClassroomPlayerState;
}

interface JoinFormProps {
  code: string;
  notice?: string | null;
  onJoined: (token: string, state: ClassroomPlayerState) => void;
}

export function JoinForm({ code, notice, onJoined }: JoinFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [needsName, setNeedsName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const trimmed = name.trim();
    try {
      const response = await api<JoinResponse>(`/live/${encodeURIComponent(code)}/join`, {
        body: trimmed ? { name: trimmed } : {}
      });
      onJoined(response.participantToken, response.state);
    } catch (reason) {
      if (hasCode(reason, "bad_request") && !trimmed) {
        setNeedsName(true);
        nameRef.current?.focus();
      } else {
        setError(reason);
      }
      setBusy(false);
    }
  };

  return (
    <form className="live-card stack" onSubmit={submit}>
      <Users size={36} className="live-icon" aria-hidden="true" />
      <h1 className="live-title">{t("live.joinTitle")}</h1>
      <p className="live-code-label ltr">{code}</p>
      {notice ? <p className="notice warning">{notice}</p> : null}
      <label className="field">
        <span>{needsName ? t("live.nameRequired") : t("live.nameOptional")}</span>
        <input
          ref={nameRef}
          className="input live-name-input"
          value={name}
          maxLength={30}
          autoComplete="nickname"
          required={needsName}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("live.namePlaceholder")}
        />
        <span className="hint">{t("live.nameHint")}</span>
      </label>
      <FormError error={hasCode(error, "not_found") || hasCode(error, "invalid_code") ? null : error} />
      {hasCode(error, "not_found") || hasCode(error, "invalid_code") ? (
        <p className="form-error" role="alert">
          {t("live.sessionNotFound")}
        </p>
      ) : null}
      <button type="submit" className="button button-primary live-big-button" disabled={busy || (needsName && !name.trim())}>
        {busy ? t("live.joining") : t("live.joinButton")}
      </button>
      <Link to="/live" className="center small">
        {t("live.differentCode")}
      </Link>
    </form>
  );
}
