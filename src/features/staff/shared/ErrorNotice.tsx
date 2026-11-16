import { RotateCw, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "../../../i18n/useI18n";
import { errorKey, isUnauthorized } from "./errors";

interface ErrorNoticeProps {
  error: unknown;
  onRetry?: () => void;
}

/** Translated API error with an optional retry button. Renders nothing without an error. */
export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <div className="notice danger" role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <div className="grow stack tight">
        <span>{t(errorKey(error))}</span>
        {isUnauthorized(error) ? (
          <Link to="/staff/login">{t("staff.signInAgain")}</Link>
        ) : null}
      </div>
      {onRetry ? (
        <button type="button" className="button button-ghost" onClick={onRetry}>
          <RotateCw size={16} aria-hidden="true" />
          {t("staff.retry")}
        </button>
      ) : null}
    </div>
  );
}

/** Inline error text for forms. */
export function FormError({ error }: { error: unknown }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      {t(errorKey(error))}
    </p>
  );
}
