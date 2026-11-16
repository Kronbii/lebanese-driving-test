import { FileUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import type { ProgressState } from "../../domain/types";
import { useI18n } from "../../i18n/useI18n";
import { decodeCompactBackup } from "../../lib/profiles";

/** Opened by scanning a backup QR code: /restore#b=<compressed progress>. */
export function RestorePage() {
  const { t } = useI18n();
  const { createProfile, replaceProgress } = useProfile();
  const { link } = useSchool();
  const navigate = useNavigate();
  const [state, setState] = useState<ProgressState | null | "invalid">(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const data = new URLSearchParams(window.location.hash.slice(1)).get("b");
    if (!data) {
      setState("invalid");
      return;
    }
    void decodeCompactBackup(data).then((decoded) => setState(decoded ?? "invalid"));
    // Keep the backup out of the address bar and history.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (state === null) return null;
  if (state === "invalid") {
    return (
      <main className="page">
        <div className="empty">{t("settings.restoreInvalid")}</div>
      </main>
    );
  }

  const seen = Object.values(state.questions).filter((stat) => stat.seen > 0).length;

  return (
    <main className="page">
      <section className="card stack">
        <div className="card-title">
          <FileUp aria-hidden="true" size={20} />
          {t("settings.restoreTitle")}
        </div>
        <p>{t("settings.restoreSummary", { seen, exams: state.history.length })}</p>
        <label className="field">
          <span>{t("settings.newProfile")}</span>
          <input className="input" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="row">
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              createProfile(name.trim() || t("settings.importedProfile"), { ...state, updatedAt: Date.now() });
              navigate(link(""));
            }}
          >
            {t("settings.restoreAsNew")}
          </button>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => {
              if (!window.confirm(t("settings.importReplaceConfirm"))) return;
              replaceProgress({ ...state, updatedAt: Date.now() });
              navigate(link(""));
            }}
          >
            {t("settings.restoreReplace")}
          </button>
        </div>
      </section>
    </main>
  );
}
