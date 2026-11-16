import { useState } from "react";
import { useI18n } from "../../../i18n/useI18n";
import { Dialog } from "./Dialog";
import { FormError } from "./ErrorNotice";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  danger?: boolean;
  /** When set, the user must type this text to enable the confirm button. */
  typeToConfirm?: string;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  danger = true,
  typeToConfirm
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const blocked = typeToConfirm !== undefined && typed.trim() !== typeToConfirm;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="stack">
        <p>{message}</p>
        {typeToConfirm !== undefined ? (
          <label className="field">
            <span>{t("staff.typeToConfirm", { text: typeToConfirm })}</span>
            <input
              className="input ltr"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}
        <FormError error={error} />
        <div className="row end">
          <button type="button" className="button button-ghost" onClick={onClose} data-autofocus>
            {t("staff.cancel")}
          </button>
          <button
            type="button"
            className={danger ? "button staff-button-danger" : "button button-primary"}
            onClick={confirm}
            disabled={busy || blocked}
          >
            {busy ? t("staff.working") : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
