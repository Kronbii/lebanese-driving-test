import { Ban, Ticket } from "lucide-react";
import { useState } from "react";
import { api } from "../../../api/client";
import type { InviteCode } from "../../../api/types";
import { QrCode } from "../../../components/QrCode";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { CopyField } from "../shared/CopyField";
import { DATE_ONLY } from "../shared/dates";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";
import { InviteCreateForm } from "./InviteCreateForm";

export function InviteCodesPage() {
  const { t } = useI18n();
  const { isSchoolAdmin } = useStaff();
  const { data, error, loading, reload, setData } = useApiGet<InviteCode[]>("/staff/invite-codes");
  const [showInactive, setShowInactive] = useState(false);
  const codes = [...(data ?? [])]
    .filter((code) => showInactive || code.active)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const upsert = (code: InviteCode) =>
    setData((current) => {
      const list = current ?? [];
      return list.some((item) => item.code === code.code)
        ? list.map((item) => (item.code === code.code ? code : item))
        : [code, ...list];
    });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.inviteTitle")}</h1>
          <p>{t("staff.inviteIntro")}</p>
        </div>
      </div>
      {isSchoolAdmin ? <InviteCreateForm onCreated={upsert} /> : null}
      <div className="row between">
        <h2 className="staff-subtitle">{t("staff.inviteList")}</h2>
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          {t("staff.showInactive")}
        </label>
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && codes.length === 0 ? (
        <div className="empty">
          <Ticket size={32} aria-hidden="true" />
          <p>{t("staff.inviteEmpty")}</p>
        </div>
      ) : null}
      <div className="grid cols-2">
        {codes.map((code) => (
          <InviteCard key={code.code} code={code} onChanged={upsert} />
        ))}
      </div>
    </div>
  );
}

function InviteCard({ code, onChanged }: { code: InviteCode; onChanged: (code: InviteCode) => void }) {
  const { t, num, date } = useI18n();
  const { schoolUrl, branchName, userName, isSchoolAdmin } = useStaff();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const link = schoolUrl(`/learn/join?code=${encodeURIComponent(code.code)}`);
  const expired = code.expiresAt ? new Date(code.expiresAt).getTime() < Date.now() : false;
  const full = code.maxUses !== null && code.uses >= code.maxUses;

  const deactivate = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<InviteCode>(`/staff/invite-codes/${encodeURIComponent(code.code)}`, {
        method: "PATCH",
        body: { active: false }
      });
      onChanged(updated ?? { ...code, active: false });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`card stack staff-invite${code.active ? "" : " inactive"}`}>
      <div className="staff-invite-top">
        <QrCode value={link} size={132} label={t("staff.qrFor", { label: code.label || code.code })} />
        <div className="stack tight grow">
          <span className="staff-code ltr" aria-label={t("staff.code")}>
            {code.code}
          </span>
          {code.label ? <span className="strong">{code.label}</span> : null}
          <div className="row small">
            {!code.active ? <span className="badge">{t("staff.inactive")}</span> : null}
            {code.active && expired ? <span className="badge warning">{t("staff.expired")}</span> : null}
            {code.active && full ? <span className="badge warning">{t("staff.full")}</span> : null}
            {code.active && !expired && !full ? <span className="badge success">{t("staff.active")}</span> : null}
          </div>
          <span className="small muted">
            {t("staff.usesCount", {
              uses: num(code.uses),
              max: code.maxUses === null ? t("staff.unlimited") : num(code.maxUses)
            })}
          </span>
          <span className="small muted">
            {t("staff.expiresAt")}: {code.expiresAt ? date(code.expiresAt, DATE_ONLY) : t("staff.never")}
          </span>
          {branchName(code.branchId) ? <span className="small muted">{branchName(code.branchId)}</span> : null}
          {userName(code.instructorId) ? <span className="small muted">{userName(code.instructorId)}</span> : null}
        </div>
      </div>
      <CopyField label={t("staff.joinLink")} value={link} />
      <FormError error={error} />
      {code.active && isSchoolAdmin ? (
        <div className="row end">
          <button type="button" className="button button-ghost" onClick={deactivate} disabled={busy}>
            <Ban size={18} aria-hidden="true" />
            {t("staff.deactivate")}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default InviteCodesPage;
