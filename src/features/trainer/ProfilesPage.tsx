import { Check, FileDown, FileUp, KeyRound, Lock, Pencil, Plus, QrCode as QrIcon, Trash2, Users } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useProfile } from "../../app/ProfileContext";
import { useSchool } from "../../app/SchoolContext";
import { QrCode } from "../../components/QrCode";
import { useI18n } from "../../i18n/useI18n";
import { downloadText } from "../../lib/ics";
import { encodeCompactBackup, makeBackup, parseBackup, type Profile } from "../../lib/profiles";
import { ProfileAvatar, profileName } from "./components/ProfileAvatar";

export function ProfilesPage() {
  const { t, date } = useI18n();
  const { profiles, active, progress, createProfile, switchProfile, renameProfile, setPin, deleteProfile, replaceProgress } =
    useProfile();
  const { link } = useSchool();
  const [newName, setNewName] = useState("");
  const [pinFor, setPinFor] = useState<Profile | null>(null);
  const [unlockFor, setUnlockFor] = useState<Profile | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    createProfile(newName);
    setNewName("");
    setMessage({ tone: "success", text: t("settings.profileCreated") });
  };

  const exportFile = () => {
    const backup = makeBackup(active, progress);
    const safeName = (active.name || "profile").replace(/[^\p{L}\p{N}_-]+/gu, "-");
    downloadText(JSON.stringify(backup), `ldt-backup-${safeName}.json`, "application/json");
  };

  const importFile = async (file: File) => {
    const backup = parseBackup(await file.text());
    if (!backup) {
      setMessage({ tone: "danger", text: t("settings.importInvalid") });
      return;
    }
    const asNew = window.confirm(t("settings.importAsNew", { name: backup.name || t("settings.defaultProfileName") }));
    if (asNew) {
      createProfile(backup.name || t("settings.importedProfile"), { ...backup.progress, updatedAt: Date.now() });
    } else if (window.confirm(t("settings.importReplaceConfirm"))) {
      replaceProgress({ ...backup.progress, updatedAt: Date.now() });
    } else {
      return;
    }
    setMessage({ tone: "success", text: t("settings.importDone") });
  };

  const showQr = async () => {
    const data = await encodeCompactBackup(progress);
    setQr(`${window.location.origin}${link("restore")}#b=${data}`);
  };

  return (
    <main className="page profiles-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("common.navSettings")}</span>
          <h2>{t("settings.profilesTitle")}</h2>
          <p>{t("settings.profilesSubtitle")}</p>
        </div>
      </header>

      {message ? <p className={message.tone === "success" ? "notice success" : "notice danger"}>{message.text}</p> : null}

      <section className="card stack">
        <div className="card-title">
          <Users aria-hidden="true" size={20} />
          {t("settings.profilesOnDevice")}
        </div>
        <ul className="list">
          {profiles.map((profile) => (
            <li key={profile.id} className={`list-row profile-row ${profile.id === active.id ? "active" : ""}`}>
              <ProfileAvatar profile={profile} size={38} />
              <span className="grow stack tight">
                <strong>{profileName(profile, t)}</strong>
                <span className="muted small">
                  {profile.cloud ? t("settings.linkedTo", { school: profile.cloud.schoolSlug }) : t("settings.localOnly")}
                  {" · "}
                  {date(profile.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </span>
              {profile.pinHash ? <Lock aria-label={t("settings.hasPin")} size={16} /> : null}
              {profile.id === active.id ? (
                <span className="badge success">
                  <Check aria-hidden="true" size={14} />
                  {t("settings.active")}
                </span>
              ) : (
                <button
                  className="button button-secondary compact"
                  type="button"
                  onClick={async () => {
                    if (profile.pinHash) setUnlockFor(profile);
                    else await switchProfile(profile.id);
                  }}
                >
                  {t("settings.switchTo")}
                </button>
              )}
              <button
                className="icon-button"
                type="button"
                aria-label={t("settings.rename")}
                onClick={() => {
                  const name = window.prompt(t("settings.renamePrompt"), profile.name);
                  if (name !== null) renameProfile(profile.id, name);
                }}
              >
                <Pencil aria-hidden="true" size={16} />
              </button>
              {profile.id === active.id ? (
                <button className="icon-button" type="button" aria-label={t("settings.setPin")} onClick={() => setPinFor(profile)}>
                  <KeyRound aria-hidden="true" size={16} />
                </button>
              ) : null}
              <button
                className="icon-button"
                type="button"
                aria-label={t("settings.deleteProfile")}
                onClick={() => {
                  if (window.confirm(t("settings.deleteProfileConfirm", { name: profileName(profile, t) }))) deleteProfile(profile.id);
                }}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={create}>
          <label className="field grow">
            <span>{t("settings.newProfile")}</span>
            <input
              className="input"
              value={newName}
              maxLength={40}
              placeholder={t("settings.newProfilePlaceholder")}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <button className="button button-primary" type="submit" disabled={!newName.trim()}>
            <Plus aria-hidden="true" size={18} />
            {t("settings.addProfile")}
          </button>
        </form>
        <p className="muted small">{t("settings.sharedDeviceHint")}</p>
      </section>

      <section className="card stack">
        <div className="card-title">
          <FileDown aria-hidden="true" size={20} />
          {t("settings.backupTitle", { name: profileName(active, t) })}
        </div>
        <p className="muted small">{t("settings.backupHint")}</p>
        <div className="row">
          <button className="button button-secondary" type="button" onClick={exportFile}>
            <FileDown aria-hidden="true" size={18} />
            {t("settings.exportFile")}
          </button>
          <button className="button button-ghost" type="button" onClick={() => fileInput.current?.click()}>
            <FileUp aria-hidden="true" size={18} />
            {t("settings.importFile")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = "";
            }}
          />
          <button className="button button-ghost" type="button" onClick={() => void showQr()}>
            <QrIcon aria-hidden="true" size={18} />
            {t("settings.showQr")}
          </button>
        </div>
        {qr ? (
          <div className="qr-backup stack">
            <QrCode value={qr} size={280} level="L" label={t("settings.qrLabel")} />
            <p className="muted small">{t("settings.qrHint")}</p>
          </div>
        ) : null}
      </section>

      {pinFor ? <PinDialog profile={pinFor} onClose={() => setPinFor(null)} onSave={setPin} /> : null}
      {unlockFor ? (
        <UnlockDialog
          profile={unlockFor}
          onClose={() => setUnlockFor(null)}
          onUnlock={async (pin) => {
            const ok = await switchProfile(unlockFor.id, pin);
            if (ok) setUnlockFor(null);
            return ok;
          }}
        />
      ) : null}
    </main>
  );
}

function PinDialog({
  profile,
  onClose,
  onSave
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (id: string, pin: string | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <form
        className="dialog stack"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSave(profile.id, pin);
          onClose();
        }}
      >
        <h3>{t("settings.setPinTitle", { name: profileName(profile, t) })}</h3>
        <p className="muted small">{t("settings.pinHint")}</p>
        <input
          className="input ltr"
          inputMode="numeric"
          pattern="[0-9]*"
          minLength={4}
          maxLength={8}
          value={pin}
          autoFocus
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
        />
        <div className="row end">
          {profile.pinHash ? (
            <button
              className="button button-ghost"
              type="button"
              onClick={async () => {
                await onSave(profile.id, null);
                onClose();
              }}
            >
              {t("settings.removePin")}
            </button>
          ) : null}
          <button className="button button-ghost" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="button button-primary" type="submit" disabled={pin.length < 4}>
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

function UnlockDialog({
  profile,
  onClose,
  onUnlock
}: {
  profile: Profile;
  onClose: () => void;
  onUnlock: (pin: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <form
        className="dialog stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(!(await onUnlock(pin)));
        }}
      >
        <h3>{t("settings.enterPin", { name: profileName(profile, t) })}</h3>
        <input
          className="input ltr"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          value={pin}
          autoFocus
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
        />
        {error ? <p className="form-error">{t("settings.wrongPin")}</p> : null}
        <div className="row end">
          <button className="button button-ghost" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="button button-primary" type="submit" disabled={pin.length < 4}>
            {t("settings.unlock")}
          </button>
        </div>
      </form>
    </div>
  );
}
