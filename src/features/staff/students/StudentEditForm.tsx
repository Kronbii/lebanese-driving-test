import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import type { PackageId, StaffStudent, StaffStudentDetail, StudentStatus, StudentUpdate } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { fromDateTimeInput, toDateInput, toDateTimeInput } from "../shared/dates";
import { FormError } from "../shared/ErrorNotice";
import { BranchSelect, InstructorSelect, PackageSelect, StatusSelect } from "./StaffSelects";

interface StudentEditFormProps {
  student: StaffStudentDetail;
  onSaved: (student: StaffStudent) => void;
}

export function StudentEditForm({ student, onSaved }: StudentEditFormProps) {
  const { t } = useI18n();
  const { school } = useStaff();
  const [displayName, setDisplayName] = useState(student.displayName);
  const [phone, setPhone] = useState(student.phone ?? "");
  const [status, setStatus] = useState<StudentStatus>(student.status);
  const [pkg, setPkg] = useState<PackageId | null>(student.package);
  const [paymentNote, setPaymentNote] = useState(student.paymentNote ?? "");
  const [examDate, setExamDate] = useState(toDateInput(student.examDate));
  const [lessonDate, setLessonDate] = useState(toDateTimeInput(student.lessonDate));
  const [instructorId, setInstructorId] = useState(student.instructorId);
  const [branchId, setBranchId] = useState(student.branchId);
  const [notes, setNotes] = useState(student.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const body: StudentUpdate = {
      displayName: displayName.trim() || student.displayName,
      phone: phone.trim() || null,
      status,
      package: pkg,
      paymentNote: paymentNote.trim() || null,
      examDate: examDate || null,
      lessonDate: fromDateTimeInput(lessonDate),
      instructorId,
      branchId,
      notes: notes.trim() || null
    };
    try {
      const updated = await api<StaffStudent>(`/staff/students/${student.id}`, { method: "PATCH", body });
      onSaved(updated ?? { ...student, ...body });
      setSaved(true);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2 className="card-title">{t("staff.editStudent")}</h2>
      <div className="grid cols-2">
        <label className="field">
          <span>{t("staff.name")}</span>
          <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
        {school?.collectPhone !== false || student.phone ? (
          <label className="field">
            <span>{t("staff.phone")}</span>
            <input
              className="input ltr"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
        ) : null}
        <StatusSelect label={t("staff.status")} value={status} onChange={setStatus} />
        <PackageSelect label={t("staff.package")} value={pkg} onChange={setPkg} />
        <label className="field">
          <span>{t("staff.examDate")}</span>
          <input className="input" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
        </label>
        <label className="field">
          <span>{t("staff.lessonDate")}</span>
          <input
            className="input"
            type="datetime-local"
            value={lessonDate}
            onChange={(event) => setLessonDate(event.target.value)}
          />
        </label>
        <InstructorSelect label={t("staff.instructor")} value={instructorId} onChange={setInstructorId} />
        <BranchSelect label={t("staff.branch")} value={branchId} onChange={setBranchId} />
      </div>
      <label className="field">
        <span>{t("staff.paymentNote")}</span>
        <input
          className="input"
          value={paymentNote}
          onChange={(event) => setPaymentNote(event.target.value)}
          placeholder={t("staff.paymentNoteHint")}
        />
      </label>
      <label className="field">
        <span>{t("staff.notes")}</span>
        <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <FormError error={error} />
      <div className="row end">
        {saved ? (
          <span className="form-success" role="status">
            {t("staff.saved")}
          </span>
        ) : null}
        <button type="submit" className="button button-primary" disabled={busy}>
          <Save size={18} aria-hidden="true" />
          {busy ? t("staff.working") : t("staff.save")}
        </button>
      </div>
    </form>
  );
}
