import { useState } from "react";
import type { StaffOverview } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { ErrorNotice } from "../shared/ErrorNotice";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";
import { Breakdown, FlaggedList, KpiGrid, TopWrongList, UsageCard, WeakTopics } from "./OverviewSections";

export function OverviewPage() {
  const { t } = useI18n();
  const { branches, staffUsers } = useStaff();
  const [branchId, setBranchId] = useState("");
  const [instructorId, setInstructorId] = useState("");

  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  if (instructorId) params.set("instructorId", instructorId);
  const query = params.toString();
  const { data, error, loading, reload } = useApiGet<StaffOverview>(`/staff/overview${query ? `?${query}` : ""}`);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.overviewTitle")}</h1>
          <p>{t("staff.overviewIntro")}</p>
        </div>
        <div className="row staff-filters">
          {branches.length > 0 ? (
            <label className="field">
              <span>{t("staff.branch")}</span>
              <select className="select" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">{t("staff.allBranches")}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {staffUsers.length > 1 ? (
            <label className="field">
              <span>{t("staff.instructor")}</span>
              <select className="select" value={instructorId} onChange={(event) => setInstructorId(event.target.value)}>
                <option value="">{t("staff.allInstructors")}</option>
                {staffUsers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data ? (
        <>
          <KpiGrid overview={data} />
          <div className="grid cols-2">
            <WeakTopics overview={data} />
            <TopWrongList overview={data} />
          </div>
          <UsageCard overview={data} />
          <div className="grid cols-2">
            <Breakdown
              title={t("staff.byBranch")}
              nameLabel={t("staff.branch")}
              rows={data.byBranch.map((row) => ({ key: row.branchId ?? "none", ...row }))}
            />
            <Breakdown
              title={t("staff.byInstructor")}
              nameLabel={t("staff.instructor")}
              rows={data.byInstructor.map((row) => ({ key: row.instructorId ?? "none", ...row }))}
            />
          </div>
          <FlaggedList overview={data} />
        </>
      ) : null}
    </div>
  );
}

export default OverviewPage;
