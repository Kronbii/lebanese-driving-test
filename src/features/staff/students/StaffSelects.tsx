import type { PackageId, StudentStatus } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { isPackageId, PACKAGE_KEYS, PACKAGES, STATUS_KEYS, STUDENT_STATUSES } from "../shared/labels";

interface SelectProps<T> {
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function StatusSelect({ value, onChange, label }: SelectProps<StudentStatus>) {
  const { t } = useI18n();
  return (
    <label className="field">
      <span>{label}</span>
      <select className="select" value={value} onChange={(event) => onChange(event.target.value as StudentStatus)}>
        {STUDENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(STATUS_KEYS[status])}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PackageSelect({ value, onChange, label }: SelectProps<PackageId | null>) {
  const { t } = useI18n();
  return (
    <label className="field">
      <span>{label}</span>
      <select
        className="select"
        value={value ?? ""}
        onChange={(event) => onChange(isPackageId(event.target.value) ? event.target.value : null)}
      >
        <option value="">{t("staff.none")}</option>
        {PACKAGES.map((item) => (
          <option key={item} value={item}>
            {t(PACKAGE_KEYS[item])}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BranchSelect({ value, onChange, label }: SelectProps<string | null>) {
  const { t } = useI18n();
  const { branches } = useStaff();
  return (
    <label className="field">
      <span>{label}</span>
      <select className="select" value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{t("staff.none")}</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InstructorSelect({ value, onChange, label }: SelectProps<string | null>) {
  const { t } = useI18n();
  const { staffUsers } = useStaff();
  return (
    <label className="field">
      <span>{label}</span>
      <select className="select" value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{t("staff.none")}</option>
        {staffUsers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name || member.email}
          </option>
        ))}
      </select>
    </label>
  );
}
