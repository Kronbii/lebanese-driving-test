import { useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import { useI18n } from "../../../i18n/useI18n";
import { Dialog } from "../shared/Dialog";
import { FormError } from "../shared/ErrorNotice";

export function FlagDialog({ questionId, onClose, onDone }: { questionId: number; onClose: () => void; onDone: () => void }) {
  const { t, num } = useI18n();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/staff/question-flags", { body: { questionId, reason: reason.trim() } });
      onDone();
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Dialog title={t("staff.flagTitle", { id: num(questionId) })} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">{t("staff.flagIntro")}</p>
        <label className="field">
          <span>{t("staff.flagReason")}</span>
          <textarea
            className="textarea"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("staff.flagReasonHint")}
          />
        </label>
        <FormError error={error} />
        <div className="row end">
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t("staff.cancel")}
          </button>
          <button type="submit" className="button button-primary" disabled={busy || !reason.trim()}>
            {busy ? t("staff.working") : t("staff.sendFlag")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
