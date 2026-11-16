import { useId, useState } from "react";
import { useI18n } from "../../../i18n/useI18n";

export interface DailySeries {
  key: string;
  label: string;
  values: number[];
}

interface DailyBarsProps {
  days: string[];
  series: DailySeries[];
  title: string;
}

/** Column chart of daily counters with a metric picker and totals. */
export function DailyBars({ days, series, title }: DailyBarsProps) {
  const { t, num, date } = useI18n();
  const [active, setActive] = useState(series[0]?.key ?? "");
  const tableId = useId();
  const current = series.find((item) => item.key === active) ?? series[0];
  if (!current || days.length === 0) return <p className="empty">{t("staff.noData")}</p>;
  const max = Math.max(1, ...current.values);
  const total = current.values.reduce((sum, value) => sum + value, 0);

  return (
    <div className="stack">
      <div className="row" role="group" aria-label={title}>
        {series.map((item) => (
          <button
            key={item.key}
            type="button"
            className="chip"
            aria-pressed={item.key === current.key}
            onClick={() => setActive(item.key)}
          >
            {item.label}
            <span className="strong">{num(item.values.reduce((sum, value) => sum + value, 0))}</span>
          </button>
        ))}
      </div>
      <div
        className="staff-columns"
        role="img"
        aria-label={t("staff.chartSummary", { metric: current.label, total, days: days.length })}
        aria-describedby={tableId}
      >
        {current.values.map((value, index) => (
          <div key={days[index] ?? index} className="staff-column" title={`${date(days[index], { day: "numeric", month: "short" })}: ${num(value)}`}>
            <span style={{ blockSize: `${Math.round((value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="row between small muted">
        <span>{date(days[0], { day: "numeric", month: "short" })}</span>
        <span>
          {t("staff.total")}: <strong>{num(total)}</strong>
        </span>
        <span>{date(days[days.length - 1], { day: "numeric", month: "short" })}</span>
      </div>
      <table className="visually-hidden" id={tableId}>
        <tbody>
          {current.values.map((value, index) => (
            <tr key={days[index] ?? index}>
              <th scope="row">{date(days[index], { day: "numeric", month: "short" })}</th>
              <td>{num(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
