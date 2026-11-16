import { Save, Undo2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../../api/client";
import type { SchoolSettings } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";
import { BranchesPanel } from "./BranchesPanel";
import { ContactPanel } from "./ContactPanel";
import { AuditPanel, ExportPanel, PlanPanel } from "./DataPanel";
import { draftFrom, toUpdate, validateDraft, type DraftPatch, type SchoolDraft } from "./draft";
import { LandingPanel } from "./LandingPanel";
import { PrivacyPanel } from "./PrivacyPanel";
import { ProfilePanel } from "./ProfilePanel";
import { UsersPanel } from "./UsersPanel";

const TABS = [
  { id: "profile", key: "staff.tabProfile", draft: true },
  { id: "contact", key: "staff.tabContact", draft: true },
  { id: "landing", key: "staff.tabLanding", draft: true },
  { id: "privacy", key: "staff.tabPrivacy", draft: true },
  { id: "branches", key: "staff.tabBranches", draft: false },
  { id: "users", key: "staff.tabUsers", draft: false },
  { id: "audit", key: "staff.tabAudit", draft: false },
  { id: "data", key: "staff.tabData", draft: false }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SchoolSettingsPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabId = TABS.find((item) => item.id === tabParam)?.id ?? "profile";
  const { data, error, loading, reload, setData } = useApiGet<SchoolSettings>("/staff/school");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.schoolTitle")}</h1>
          <p>{t("staff.schoolIntro")}</p>
        </div>
      </div>
      <nav className="tabs" aria-label={t("staff.schoolTitle")}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab${tab === item.id ? " active" : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setParams({ tab: item.id }, { replace: true })}
          >
            {t(item.key)}
          </button>
        ))}
      </nav>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data ? <SchoolEditor key={data.id} school={data} tab={tab} onSaved={(next) => setData(() => next)} /> : null}
    </div>
  );
}

function SchoolEditor({ school, tab, onSaved }: { school: SchoolSettings; tab: TabId; onSaved: (school: SchoolSettings) => void }) {
  const { t } = useI18n();
  const { refreshMe } = useStaff();
  const [base, setBase] = useState<SchoolDraft>(() => draftFrom(school));
  const [draft, setDraft] = useState<SchoolDraft>(base);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [showProblems, setShowProblems] = useState(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base]);
  const problems = useMemo(() => validateDraft(draft), [draft]);
  const visibleProblems = showProblems ? problems : [];
  const patch = useCallback((update: DraftPatch) => {
    setSaved(false);
    setDraft((current) => update(current));
  }, []);

  const save = async () => {
    setShowProblems(true);
    if (problems.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api<SchoolSettings>("/staff/school", { method: "PUT", body: toUpdate(draft) });
      const merged = next ?? school;
      const fresh = draftFrom(merged);
      setBase(fresh);
      setDraft(fresh);
      setSaved(true);
      setShowProblems(false);
      onSaved(merged);
      void refreshMe().catch(() => undefined);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const isDraftTab = TABS.find((item) => item.id === tab)?.draft ?? false;

  return (
    <div className="stack">
      {tab === "profile" ? <ProfilePanel draft={draft} patch={patch} problems={visibleProblems} /> : null}
      {tab === "contact" ? <ContactPanel draft={draft} patch={patch} /> : null}
      {tab === "landing" ? <LandingPanel draft={draft} patch={patch} problems={visibleProblems} /> : null}
      {tab === "privacy" ? (
        <PrivacyPanel
          draft={draft}
          patch={patch}
          problems={visibleProblems}
          savedRetentionDays={school.retentionDays}
          dirty={dirty}
        />
      ) : null}
      {tab === "branches" ? <BranchesPanel /> : null}
      {tab === "users" ? <UsersPanel /> : null}
      {tab === "audit" ? <AuditPanel /> : null}
      {tab === "data" ? (
        <>
          <PlanPanel school={school} />
          <ExportPanel school={school} />
        </>
      ) : null}

      {isDraftTab || dirty ? (
        <div className="staff-savebar" role="region" aria-label={t("staff.saveChanges")}>
          <div className="grow stack tight">
            {dirty ? <span className="strong">{t("staff.unsavedChanges")}</span> : null}
            {saved && !dirty ? (
              <span className="form-success" role="status">
                {t("staff.saved")}
              </span>
            ) : null}
            {showProblems && problems.length > 0 ? <span className="form-error">{t("staff.fixErrors")}</span> : null}
            <FormError error={error} />
          </div>
          <button
            type="button"
            className="button button-ghost"
            disabled={!dirty || busy}
            onClick={() => {
              setDraft(base);
              setShowProblems(false);
            }}
          >
            <Undo2 size={16} aria-hidden="true" />
            {t("staff.discard")}
          </button>
          <button type="button" className="button button-primary" disabled={!dirty || busy} onClick={save}>
            <Save size={16} aria-hidden="true" />
            {busy ? t("staff.working") : t("staff.saveChanges")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default SchoolSettingsPage;
