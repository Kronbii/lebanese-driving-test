import { useI18n } from "../../../i18n/useI18n";

/** Inline loading block with an accessible label. */
export function LoadingBlock() {
  const { t } = useI18n();
  return (
    <div className="loading staff-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{t("staff.loading")}</span>
    </div>
  );
}
