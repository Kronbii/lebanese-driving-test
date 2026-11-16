import { ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../api/client";
import { useI18n } from "../../../i18n/useI18n";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import type { DraftPatch, DraftProblem, SchoolDraft } from "./draft";

interface PanelProps {
  draft: SchoolDraft;
  patch: (update: DraftPatch) => void;
  problems: DraftProblem[];
  savedRetentionDays: number | null;
  dirty: boolean;
}

interface RetentionResult {
  deleted?: number;
}

export function PrivacyPanel({ draft, patch, problems, savedRetentionDays, dirty }: PanelProps) {
  const { t, num } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RetentionResult | null>(null);

  return (
    <div className="stack">
      <section className="card stack">
        <h2 className="card-title">
          <ShieldCheck size={18} aria-hidden="true" />
          {t("staff.privacyTitle")}
        </h2>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.collectPhone}
            onChange={(event) => patch((current) => ({ ...current, collectPhone: event.target.checked }))}
          />
          <span>
            {t("staff.collectPhone")}
            <span className="hint small muted"> — {t("staff.collectPhoneHint")}</span>
          </span>
        </label>
      </section>

      <section className="card stack">
        <h2 className="card-title">
          <Trash2 size={18} aria-hidden="true" />
          {t("staff.retentionTitle")}
        </h2>
        <p className="small muted">{t("staff.retentionIntro")}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.retentionDays !== null}
            onChange={(event) => patch((current) => ({ ...current, retentionDays: event.target.checked ? 365 : null }))}
          />
          {t("staff.retentionEnable")}
        </label>
        {draft.retentionDays !== null ? (
          <label className="field">
            <span>{t("staff.retentionDays")}</span>
            <input
              className="input staff-narrow"
              type="number"
              min={30}
              step={1}
              inputMode="numeric"
              value={Number.isFinite(draft.retentionDays) ? draft.retentionDays : ""}
              onChange={(event) =>
                patch((current) => ({ ...current, retentionDays: Number.parseInt(event.target.value, 10) }))
              }
              aria-invalid={problems.includes("retention")}
            />
            <span className={problems.includes("retention") ? "hint form-error" : "hint"}>{t("staff.retentionHint")}</span>
          </label>
        ) : null}
        <div className="row">
          <button
            type="button"
            className="button button-ghost"
            disabled={savedRetentionDays === null || dirty}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={16} aria-hidden="true" />
            {t("staff.runRetention")}
          </button>
          {dirty ? <span className="small muted">{t("staff.saveFirst")}</span> : null}
        </div>
        {result ? (
          <p className="form-success" role="status">
            {typeof result.deleted === "number"
              ? t("staff.retentionDone", { count: num(result.deleted) })
              : t("staff.retentionDoneGeneric")}
          </p>
        ) : null}
      </section>

      {confirming && savedRetentionDays !== null ? (
        <ConfirmDialog
          title={t("staff.runRetention")}
          message={t("staff.runRetentionConfirm", { days: num(savedRetentionDays) })}
          confirmLabel={t("staff.runRetention")}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const response = await api<RetentionResult>("/staff/retention/run", { method: "POST" });
            setResult(response ?? {});
            setConfirming(false);
          }}
        />
      ) : null}
    </div>
  );
}
