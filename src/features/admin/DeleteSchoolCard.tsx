import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { AdminSchoolRow } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { ConfirmDialog } from "../staff/shared/ConfirmDialog";

export function DeleteSchoolCard({ school }: { school: AdminSchoolRow }) {
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <section className="card stack admin-danger-zone">
      <h2 className="card-title">{t("admin.dangerZone")}</h2>
      <p className="small">{t("admin.deleteSchoolBody")}</p>
      <div>
        <button type="button" className="button staff-button-danger" onClick={() => setOpen(true)}>
          <Trash2 size={16} aria-hidden="true" />
          {t("admin.deleteSchool")}
        </button>
      </div>
      {open ? (
        <ConfirmDialog
          title={t("admin.deleteSchool")}
          message={t("admin.deleteSchoolConfirm", { name: pick(school.name) })}
          confirmLabel={t("admin.deleteSchool")}
          typeToConfirm={school.slug}
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            await api(`/admin/schools/${school.id}`, { method: "DELETE" });
            navigate("/admin", { replace: true });
          }}
        />
      ) : null}
    </section>
  );
}
