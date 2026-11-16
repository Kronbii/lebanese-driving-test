import { Inbox, MessageCircle, Trash2, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import type { StaffStudent, StudentUpdate } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { DATE_TIME } from "../shared/dates";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { isPackageId, PACKAGE_KEYS } from "../shared/labels";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";
import { whatsappLink } from "../shared/whatsapp";

export function LeadsPage() {
  const { t, num } = useI18n();
  const { data, error, loading, reload, setData } = useApiGet<StaffStudent[]>("/staff/students?status=lead");
  const [source, setSource] = useState<string | null>(null);

  const leads = useMemo(
    () =>
      (data ?? [])
        .filter((student) => student.status === "lead")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data]
  );
  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const key = lead.source ?? "";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);
  const visible = source === null ? leads : leads.filter((lead) => (lead.source ?? "") === source);

  const remove = (id: string) => setData((current) => (current ? current.filter((item) => item.id !== id) : current));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.leadsTitle")}</h1>
          <p>{t("staff.leadsIntro")}</p>
        </div>
      </div>
      {sources.length > 1 ? (
        <div className="tabs" role="group" aria-label={t("staff.source")}>
          <button type="button" className="chip" aria-pressed={source === null} onClick={() => setSource(null)}>
            {t("staff.allSources")} <span className="strong">{num(leads.length)}</span>
          </button>
          {sources.map(([key, count]) => (
            <button key={key || "direct"} type="button" className="chip" aria-pressed={source === key} onClick={() => setSource(key)}>
              {key || t("staff.direct")} <span className="strong">{num(count)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && visible.length === 0 ? (
        <div className="empty">
          <Inbox size={32} aria-hidden="true" />
          <p>{t("staff.leadsEmpty")}</p>
        </div>
      ) : null}
      <ul className="list">
        {visible.map((lead) => (
          <LeadRow key={lead.id} lead={lead} onRemoved={() => remove(lead.id)} />
        ))}
      </ul>
    </div>
  );
}

function LeadRow({ lead, onRemoved }: { lead: StaffStudent; onRemoved: () => void }) {
  const { t, date, pick } = useI18n();
  const { school, isSchoolAdmin } = useStaff();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const schoolName = school ? pick(school.name) : "";
  const wa = whatsappLink(lead.phone, t("staff.waLead", { name: lead.displayName, school: schoolName }));

  const markRegistered = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: StudentUpdate = { status: "registered" };
      await api(`/staff/students/${lead.id}`, { method: "PATCH", body });
      onRemoved();
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <li className="card stack staff-lead">
      <div className="row between">
        <div className="stack tight">
          <Link to={`/staff/students/${lead.id}`} className="strong staff-row-link">
            {lead.displayName}
          </Link>
          {lead.phone ? <span className="ltr small muted">{lead.phone}</span> : null}
        </div>
        <span className="small muted nowrap">{date(lead.createdAt, DATE_TIME)}</span>
      </div>
      <div className="row">
        <span className="chip">
          {t("staff.source")}: {lead.source || t("staff.direct")}
        </span>
        {lead.interest ? (
          <span className="chip">
            {t("staff.interest")}: {isPackageId(lead.interest) ? t(PACKAGE_KEYS[lead.interest]) : lead.interest}
          </span>
        ) : null}
      </div>
      {lead.notes ? <p className="staff-message">{lead.notes}</p> : null}
      <FormError error={error} />
      <div className="row">
        <button type="button" className="button button-primary" onClick={markRegistered} disabled={busy}>
          <UserCheck size={18} aria-hidden="true" />
          {t("staff.markRegistered")}
        </button>
        {wa ? (
          <a className="button staff-wa" href={wa} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            {t("staff.whatsapp")}
          </a>
        ) : null}
        {isSchoolAdmin ? (
          <button type="button" className="button button-ghost" onClick={() => setConfirming(true)}>
            <Trash2 size={18} aria-hidden="true" />
            {t("staff.delete")}
          </button>
        ) : null}
      </div>
      {confirming ? (
        <ConfirmDialog
          title={t("staff.deleteLead")}
          message={t("staff.deleteStudentConfirm", { name: lead.displayName })}
          confirmLabel={t("staff.delete")}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await api(`/staff/students/${lead.id}`, { method: "DELETE" });
            setConfirming(false);
            onRemoved();
          }}
        />
      ) : null}
    </li>
  );
}

export default LeadsPage;
