import type { StudentMetrics, StudentStatus } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { READINESS_KEYS, READINESS_TONES, STATUS_KEYS, STATUS_TONES } from "../shared/labels";

export function StatusBadge({ status }: { status: StudentStatus }) {
  const { t } = useI18n();
  return <span className={`badge ${STATUS_TONES[status]}`}>{t(STATUS_KEYS[status])}</span>;
}

export function ReadinessBadge({ metrics }: { metrics: StudentMetrics | null }) {
  const { t, pct } = useI18n();
  if (!metrics) return <span className="muted small">—</span>;
  return (
    <span className={`badge ${READINESS_TONES[metrics.readinessLabel]}`}>
      {t(READINESS_KEYS[metrics.readinessLabel])} · {pct(metrics.readiness)}
    </span>
  );
}
