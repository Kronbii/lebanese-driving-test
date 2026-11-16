import { useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import type { PackageId, StaffStudent, StudentCreate, StudentStatus } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { Dialog } from "../shared/Dialog";
import { FormError } from "../shared/ErrorNotice";
import { BranchSelect, InstructorSelect, PackageSelect, StatusSelect } from "./StaffSelects";

interface AddStudentDialogProps {
  onClose: () => void;
  onCreated: (student: StaffStudent) => void;
}

export function AddStudentDialog({ onClose, onCreated }: AddStudentDialogProps) {
  const { t } = useI18n();
  const { school, user } = useStaff();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<StudentStatus>("registered");
  const [pkg, setPkg] = useState<PackageId | null>(null);
  const [branchId, setBranchId] = useState<string | null>(user.branchId);
  const [instructorId, setInstructorId] = useState<string | null>(user.role === "instructor" ? user.id : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body: StudentCreate = {
      displayName: displayName.trim(),
      phone: phone.trim() || null,
      status,
      package: pkg,
      branchId,
      instructorId
    };
    try {
      const created = await api<StaffStudent>("/staff/students", { body });
      onCreated(created);
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Dialog title={t("staff.addStudent")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>{t("staff.name")}</span>
          <input
            className="input"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="off"
          />
        </label>
        {school?.collectPhone !== false ? (
          <label className="field">
            <span>{t("staff.phone")}</span>
            <input
              className="input ltr"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="03 123 456"
            />
          </label>
        ) : null}
        <div className="grid cols-2">
          <StatusSelect label={t("staff.status")} value={status} onChange={setStatus} />
          <PackageSelect label={t("staff.package")} value={pkg} onChange={setPkg} />
          <BranchSelect label={t("staff.branch")} value={branchId} onChange={setBranchId} />
          <InstructorSelect label={t("staff.instructor")} value={instructorId} onChange={setInstructorId} />
        </div>
        <FormError error={error} />
        <div className="row end">
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t("staff.cancel")}
          </button>
          <button type="submit" className="button button-primary" disabled={busy || !displayName.trim()}>
            {busy ? t("staff.working") : t("staff.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
