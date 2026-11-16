import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import type { Branch } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { Dialog } from "../shared/Dialog";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";

type BranchBody = Omit<Branch, "id">;

export function BranchesPanel() {
  const { t } = useI18n();
  const { refreshMe } = useStaff();
  const { data, error, loading, reload } = useApiGet<Branch[]>("/staff/branches");
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);

  const changed = () => {
    reload();
    void refreshMe().catch(() => undefined);
  };

  return (
    <section className="card stack">
      <div className="row between">
        <h2 className="card-title">{t("staff.branches")}</h2>
        <button type="button" className="button button-primary" onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden="true" />
          {t("staff.addBranch")}
        </button>
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && data.length === 0 ? <p className="empty">{t("staff.branchesEmpty")}</p> : null}
      <ul className="list">
        {(data ?? []).map((branch) => (
          <li key={branch.id} className="list-row">
            <MapPin size={18} aria-hidden="true" />
            <div className="grow stack tight">
              <span className="strong">{branch.name}</span>
              {branch.address ? <span className="small muted">{branch.address}</span> : null}
              {branch.phone ? <span className="small muted ltr">{branch.phone}</span> : null}
            </div>
            <button type="button" className="icon-button" aria-label={t("staff.edit")} title={t("staff.edit")} onClick={() => setEditing(branch)}>
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label={t("staff.delete")} title={t("staff.delete")} onClick={() => setDeleting(branch)}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {editing ? (
        <BranchDialog
          branch={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            changed();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={t("staff.deleteBranch")}
          message={t("staff.deleteBranchConfirm", { name: deleting.name })}
          confirmLabel={t("staff.delete")}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`/staff/branches/${deleting.id}`, { method: "DELETE" });
            setDeleting(null);
            changed();
          }}
        />
      ) : null}
    </section>
  );
}

function BranchDialog({ branch, onClose, onSaved }: { branch: Branch | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(branch?.name ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [mapUrl, setMapUrl] = useState(branch?.mapUrl ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body: BranchBody = {
      name: name.trim(),
      address: address.trim() || null,
      mapUrl: mapUrl.trim() || null,
      phone: phone.trim() || null
    };
    try {
      if (branch) await api(`/staff/branches/${branch.id}`, { method: "PATCH", body });
      else await api("/staff/branches", { body });
      onSaved();
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Dialog title={branch ? t("staff.editBranch") : t("staff.addBranch")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>{t("staff.branchName")}</span>
          <input className="input" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>{t("staff.contactAddress")}</span>
          <input className="input" value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label className="field">
          <span>{t("staff.contactMap")}</span>
          <input className="input ltr" type="url" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} placeholder="https://" />
        </label>
        <label className="field">
          <span>{t("staff.contactPhone")}</span>
          <input className="input ltr" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <FormError error={error} />
        <div className="row end">
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t("staff.cancel")}
          </button>
          <button type="submit" className="button button-primary" disabled={busy || !name.trim()}>
            {busy ? t("staff.working") : t("staff.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
