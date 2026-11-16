import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import type { StaffUser, StaffUserCreate } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { DATE_ONLY } from "../shared/dates";
import { Dialog } from "../shared/Dialog";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { ROLE_KEYS } from "../shared/labels";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";
import { BranchSelect } from "../students/StaffSelects";

type StaffRole = StaffUserCreate["role"];

export function UsersPanel() {
  const { t, date } = useI18n();
  const { user: me, reloadStaffUsers, branchName } = useStaff();
  const { data, error, loading, reload } = useApiGet<StaffUser[]>("/staff/users");
  const [editing, setEditing] = useState<StaffUser | "new" | null>(null);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);

  const changed = () => {
    reload();
    reloadStaffUsers();
  };

  return (
    <section className="card stack">
      <div className="row between">
        <h2 className="card-title">{t("staff.users")}</h2>
        <button type="button" className="button button-primary" onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden="true" />
          {t("staff.addUser")}
        </button>
      </div>
      <p className="small muted">{t("staff.usersIntro")}</p>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t("staff.name")}</th>
                <th scope="col">{t("staff.email")}</th>
                <th scope="col">{t("staff.role")}</th>
                <th scope="col">{t("staff.branch")}</th>
                <th scope="col">{t("staff.lastLogin")}</th>
                <th scope="col">
                  <span className="visually-hidden">{t("staff.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((member) => (
                <tr key={member.id}>
                  <td>
                    <span className="row">
                      <UserRound size={16} aria-hidden="true" />
                      {member.name}
                      {member.id === me.id ? <span className="badge info">{t("staff.you")}</span> : null}
                    </span>
                  </td>
                  <td className="ltr">{member.email}</td>
                  <td>{t(ROLE_KEYS[member.role])}</td>
                  <td>{branchName(member.branchId) ?? "—"}</td>
                  <td className="nowrap">{member.lastLoginAt ? date(member.lastLoginAt, DATE_ONLY) : "—"}</td>
                  <td>
                    {member.role !== "super_admin" ? (
                      <span className="row nowrap">
                        <button type="button" className="icon-button" aria-label={t("staff.edit")} title={t("staff.edit")} onClick={() => setEditing(member)}>
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        {member.id !== me.id ? (
                          <button type="button" className="icon-button" aria-label={t("staff.delete")} title={t("staff.delete")} onClick={() => setDeleting(member)}>
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {editing ? (
        <UserDialog
          member={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            changed();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={t("staff.deleteUser")}
          message={t("staff.deleteUserConfirm", { name: deleting.name || deleting.email })}
          confirmLabel={t("staff.delete")}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`/staff/users/${deleting.id}`, { method: "DELETE" });
            setDeleting(null);
            changed();
          }}
        />
      ) : null}
    </section>
  );
}

function UserDialog({ member, onClose, onSaved }: { member: StaffUser | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState(member?.email ?? "");
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState<StaffRole>(member?.role === "school_admin" ? "school_admin" : "instructor");
  const [branchId, setBranchId] = useState<string | null>(member?.branchId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (member) {
        await api(`/staff/users/${member.id}`, { method: "PATCH", body: { name: name.trim(), role, branchId } });
      } else {
        const body: StaffUserCreate = { email: email.trim(), name: name.trim(), role, branchId };
        await api("/staff/users", { body });
      }
      onSaved();
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Dialog title={member ? t("staff.editUser") : t("staff.addUser")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>{t("staff.email")}</span>
          <input
            className="input ltr"
            type="email"
            required
            value={email}
            disabled={member !== null}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>{t("staff.name")}</span>
          <input className="input" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>{t("staff.role")}</span>
          <select className="select" value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
            <option value="instructor">{t("staff.role_instructor")}</option>
            <option value="school_admin">{t("staff.role_school_admin")}</option>
          </select>
        </label>
        <BranchSelect label={t("staff.branch")} value={branchId} onChange={setBranchId} />
        {!member ? <p className="small muted">{t("staff.addUserHint")}</p> : null}
        <FormError error={error} />
        <div className="row end">
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t("staff.cancel")}
          </button>
          <button type="submit" className="button button-primary" disabled={busy || !name.trim() || !email.trim()}>
            {busy ? t("staff.working") : t("staff.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
