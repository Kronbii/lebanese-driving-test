import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import type { InviteCode, InviteCodeCreate } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { FormError } from "../shared/ErrorNotice";
import { BranchSelect, InstructorSelect } from "../students/StaffSelects";

export function InviteCreateForm({ onCreated }: { onCreated: (code: InviteCode) => void }) {
  const { t } = useI18n();
  const { user } = useStaff();
  const [label, setLabel] = useState("");
  const [branchId, setBranchId] = useState<string | null>(user.branchId);
  const [instructorId, setInstructorId] = useState<string | null>(user.role === "instructor" ? user.id : null);
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const uses = Number.parseInt(maxUses, 10);
    const body: InviteCodeCreate = {
      label: label.trim() || null,
      branchId,
      instructorId,
      maxUses: Number.isFinite(uses) && uses > 0 ? uses : null,
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null
    };
    try {
      const created = await api<InviteCode>("/staff/invite-codes", { body });
      onCreated(created);
      setLabel("");
      setMaxUses("");
      setExpiresAt("");
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2 className="card-title">
        <Plus size={18} aria-hidden="true" />
        {t("staff.newInviteCode")}
      </h2>
      <div className="grid cols-3">
        <label className="field">
          <span>{t("staff.inviteLabel")}</span>
          <input
            className="input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("staff.inviteLabelHint")}
          />
        </label>
        <BranchSelect label={t("staff.branch")} value={branchId} onChange={setBranchId} />
        <InstructorSelect label={t("staff.instructor")} value={instructorId} onChange={setInstructorId} />
        <label className="field">
          <span>{t("staff.maxUses")}</span>
          <input
            className="input"
            type="number"
            min={1}
            inputMode="numeric"
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
            placeholder={t("staff.unlimited")}
          />
        </label>
        <label className="field">
          <span>{t("staff.expiresAt")}</span>
          <input className="input" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </label>
      </div>
      <FormError error={error} />
      <div className="row end">
        <button type="submit" className="button button-primary" disabled={busy}>
          <Plus size={18} aria-hidden="true" />
          {busy ? t("staff.working") : t("staff.createCode")}
        </button>
      </div>
    </form>
  );
}
