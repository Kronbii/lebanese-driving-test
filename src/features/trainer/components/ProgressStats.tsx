import { Flame, Star } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useProfile } from "../../../app/ProfileContext";
import { summary } from "../../../domain/engine";
import { xpLevel } from "../../../domain/gamification";
import { practiceStreak } from "../../../domain/stats";
import { useI18n } from "../../../i18n/useI18n";
import { useBank } from "../hooks";

/** Coverage, mastery, streak and XP — on Home (desktop) and at the top of Progress. */
export function ProgressStats({ className = "" }: { className?: string }) {
  const { t, pct } = useI18n();
  const { progress } = useProfile();
  const { ids } = useBank();
  const stats = useMemo(() => summary(progress, ids), [progress, ids]);
  const streak = practiceStreak(progress);
  const level = xpLevel(progress.xp);

  return (
    <section className={`grid cols-4 home-stats ${className}`}>
      <Stat label={t("trainer.coverage")} value={pct(stats.coveragePct)} meter={stats.coveragePct} />
      <Stat label={t("trainer.mastery")} value={pct(stats.masteryPct)} meter={stats.masteryPct} />
      <Stat
        label={t("trainer.streak")}
        value={t("trainer.streakDays", { n: streak })}
        icon={<Flame aria-hidden="true" size={18} className={streak ? "flame" : ""} />}
      />
      <Stat
        label={t("trainer.level", { n: level.level })}
        value={t("trainer.xp", { n: progress.xp })}
        meter={Math.round((level.into / level.next) * 100)}
        icon={<Star aria-hidden="true" size={18} />}
      />
    </section>
  );
}

function Stat({ label, value, meter, icon }: { label: string; value: string; meter?: number; icon?: ReactNode }) {
  return (
    <div className="card stat">
      <span className="stat-label row">
        {icon}
        {label}
      </span>
      <span className="stat-value">{value}</span>
      {meter !== undefined ? (
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
        </div>
      ) : null}
    </div>
  );
}
