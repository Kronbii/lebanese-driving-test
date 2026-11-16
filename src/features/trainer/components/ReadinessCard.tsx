import { Gauge } from "lucide-react";
import type { Readiness, ReadinessFactors } from "../../../domain/readiness";
import { useI18n } from "../../../i18n/useI18n";

const LABEL_CLASS: Record<Readiness["label"], string> = {
  not_ready: "danger",
  needs_signs: "warning",
  almost: "info",
  ready: "success"
};

const FACTOR_ORDER: (keyof ReadinessFactors)[] = [
  "recentExams",
  "mastery",
  "coverage",
  "signs",
  "trend",
  "recency",
  "timed"
];

export function ReadinessCard({ readiness, compact }: { readiness: Readiness; compact?: boolean }) {
  const { t, pct } = useI18n();
  const tone = LABEL_CLASS[readiness.label];
  return (
    <section className="card readiness-card stack">
      <div className="row between">
        <div className="card-title">
          <Gauge aria-hidden="true" size={20} />
          {t("trainer.readinessTitle")}
        </div>
        <span className={`badge ${tone}`}>{t(`trainer.readiness_${readiness.label}`)}</span>
      </div>
      <div className="readiness-score">
        <strong>{pct(readiness.score)}</strong>
        <div className={`meter grow ${tone}`} aria-hidden="true">
          <span style={{ width: `${readiness.score}%` }} />
        </div>
      </div>
      <p className="muted small">{t(`trainer.readinessHint_${readiness.label}`)}</p>
      {!compact ? (
        <div className="bars">
          {FACTOR_ORDER.map((key) => {
            const value = readiness.factors[key];
            return (
              <div className="bar-row" key={key}>
                <span className="small strong">{t(`trainer.factor_${key}`)}</span>
                <span className="small muted">{value === null ? "—" : pct(value * 100)}</span>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${value === null ? 0 : Math.round(value * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
