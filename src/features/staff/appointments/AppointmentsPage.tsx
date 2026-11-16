import { CalendarDays, Check, CheckCheck, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../../api/client";
import type { Appointment, AppointmentStatus } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { DATE_TIME } from "../shared/dates";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import {
  APPOINTMENT_KIND_KEYS,
  APPOINTMENT_STATUS_KEYS,
  APPOINTMENT_STATUS_TONES,
  APPOINTMENT_STATUSES
} from "../shared/labels";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";
import { whatsappLink } from "../shared/whatsapp";

type Filter = AppointmentStatus | "all";

interface AppointmentPatch {
  status?: AppointmentStatus;
  notes?: string | null;
}

export function AppointmentsPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("requested");
  const path = filter === "all" ? "/staff/appointments" : `/staff/appointments?status=${filter}`;
  const { data, error, loading, reload, setData } = useApiGet<Appointment[]>(path);
  const items = (data ?? [])
    .filter((item) => filter === "all" || item.status === filter)
    .sort((a, b) => a.preferredAt.localeCompare(b.preferredAt));

  const onUpdated = (updated: Appointment) =>
    setData((current) =>
      current
        ? current
            .map((item) => (item.id === updated.id ? updated : item))
            .filter((item) => filter === "all" || item.status === filter)
        : current
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.appointmentsTitle")}</h1>
          <p>{t("staff.appointmentsIntro")}</p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label={t("staff.status")}>
        {[...APPOINTMENT_STATUSES, "all" as const].map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`tab${filter === value ? " active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? t("staff.all") : t(APPOINTMENT_STATUS_KEYS[value])}
          </button>
        ))}
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && items.length === 0 ? (
        <div className="empty">
          <CalendarDays size={32} aria-hidden="true" />
          <p>{t("staff.appointmentsEmpty")}</p>
        </div>
      ) : null}
      <ul className="list">
        {items.map((item) => (
          <AppointmentRow key={item.id} item={item} onUpdated={onUpdated} />
        ))}
      </ul>
    </div>
  );
}

function AppointmentRow({ item, onUpdated }: { item: Appointment; onUpdated: (item: Appointment) => void }) {
  const { t, date, pick } = useI18n();
  const { branchName, school } = useStaff();
  const [notes, setNotes] = useState(item.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const schoolName = school ? pick(school.name) : "";
  const wa = whatsappLink(
    item.phone,
    t("staff.waAppointment", { name: item.name, school: schoolName, date: date(item.preferredAt, DATE_TIME) })
  );

  const patch = async (body: AppointmentPatch) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Appointment>(`/staff/appointments/${item.id}`, { method: "PATCH", body });
      onUpdated(updated ?? { ...item, ...body });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card stack">
      <div className="row between">
        <div className="stack tight">
          <span className="strong">{item.name}</span>
          {item.phone ? <span className="ltr small muted">{item.phone}</span> : null}
        </div>
        <span className={`badge ${APPOINTMENT_STATUS_TONES[item.status]}`}>{t(APPOINTMENT_STATUS_KEYS[item.status])}</span>
      </div>
      <div className="row small">
        <span className="chip">{t(APPOINTMENT_KIND_KEYS[item.kind])}</span>
        <span className="chip">
          <CalendarDays size={14} aria-hidden="true" />
          {date(item.preferredAt, DATE_TIME)}
        </span>
        {branchName(item.branchId) ? <span className="chip">{branchName(item.branchId)}</span> : null}
        <span className="muted">
          {t("staff.created")}: {date(item.createdAt, DATE_TIME)}
        </span>
      </div>
      {item.message ? <p className="staff-message">{item.message}</p> : null}
      <label className="field">
        <span>{t("staff.notes")}</span>
        <div className="staff-copy">
          <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <button
            type="button"
            className="button button-ghost"
            disabled={busy || notes === (item.notes ?? "")}
            onClick={() => patch({ notes: notes.trim() || null })}
          >
            {t("staff.save")}
          </button>
        </div>
      </label>
      <FormError error={error} />
      <div className="row">
        {item.status === "requested" ? (
          <button type="button" className="button button-primary" disabled={busy} onClick={() => patch({ status: "confirmed" })}>
            <Check size={18} aria-hidden="true" />
            {t("staff.confirm")}
          </button>
        ) : null}
        {item.status === "confirmed" ? (
          <button type="button" className="button button-primary" disabled={busy} onClick={() => patch({ status: "done" })}>
            <CheckCheck size={18} aria-hidden="true" />
            {t("staff.markDone")}
          </button>
        ) : null}
        {item.status === "requested" || item.status === "confirmed" ? (
          <button type="button" className="button button-ghost" disabled={busy} onClick={() => patch({ status: "cancelled" })}>
            <X size={18} aria-hidden="true" />
            {t("staff.cancelAppointment")}
          </button>
        ) : null}
        {wa ? (
          <a className="button staff-wa" href={wa} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            {t("staff.whatsapp")}
          </a>
        ) : null}
      </div>
    </li>
  );
}

export default AppointmentsPage;
