import { Activity } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";
import { DailyBars } from "../staff/shared/DailyBars";
import { ErrorNotice } from "../staff/shared/ErrorNotice";
import { LoadingBlock } from "../staff/shared/Spinner";
import { useApiGet } from "../staff/shared/useApiGet";

interface AdminUsage {
  totals: { schools: number; students: number; exams30d: number; leads30d: number };
  daily: { day: string; exams: number; visits: number; leads: number }[];
}

export function UsagePage() {
  const { t, num } = useI18n();
  const { data, error, loading, reload } = useApiGet<AdminUsage>("/admin/usage");
  const daily = data ? [...data.daily].sort((a, b) => a.day.localeCompare(b.day)) : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("admin.usageTitle")}</h1>
          <p>{t("admin.usageIntro")}</p>
        </div>
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data ? (
        <>
          <div className="grid cols-4">
            {[
              { label: t("admin.totalSchools"), value: data.totals.schools },
              { label: t("admin.students"), value: data.totals.students },
              { label: t("admin.exams30d"), value: data.totals.exams30d },
              { label: t("admin.leads30d"), value: data.totals.leads30d }
            ].map((stat) => (
              <div key={stat.label} className="card stat">
                <span className="stat-label">{stat.label}</span>
                <span className="stat-value">{num(stat.value)}</span>
              </div>
            ))}
          </div>
          <section className="card">
            <h2 className="card-title">
              <Activity size={18} aria-hidden="true" />
              {t("admin.daily")}
            </h2>
            <DailyBars
              title={t("admin.daily")}
              days={daily.map((day) => day.day)}
              series={[
                { key: "visits", label: t("staff.metricVisits"), values: daily.map((day) => day.visits) },
                { key: "exams", label: t("staff.metricExams"), values: daily.map((day) => day.exams) },
                { key: "leads", label: t("staff.metricLeads"), values: daily.map((day) => day.leads) }
              ]}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

export default UsagePage;
