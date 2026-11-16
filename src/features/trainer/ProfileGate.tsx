import { Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useProfile } from "../../app/ProfileContext";
import { useI18n } from "../../i18n/useI18n";
import { ProfileAvatar, profileName } from "./components/ProfileAvatar";

/** Shared-device lock: the active profile has a PIN; pick a profile or enter its PIN. */
export function ProfileGate() {
  const { t } = useI18n();
  const { profiles, active, unlock, switchProfile } = useProfile();
  const [selected, setSelected] = useState(active.id);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const target = profiles.find((profile) => profile.id === selected) ?? active;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = target.id === active.id ? await unlock(pin) : await switchProfile(target.id, pin);
    setError(!ok);
    if (ok) setPin("");
  };

  return (
    <main className="page profile-gate">
      <section className="card stack">
        <div className="card-title">
          <Lock aria-hidden="true" size={20} />
          {t("settings.whoIsPractising")}
        </div>
        <div className="profile-picker">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`profile-choice ${profile.id === selected ? "active" : ""}`}
              onClick={async () => {
                setSelected(profile.id);
                setError(false);
                if (!profile.pinHash) await switchProfile(profile.id);
              }}
            >
              <ProfileAvatar profile={profile} size={44} />
              <span>{profileName(profile, t)}</span>
              {profile.pinHash ? <Lock aria-hidden="true" size={14} /> : null}
            </button>
          ))}
        </div>
        {target.pinHash ? (
          <form className="row" onSubmit={submit}>
            <label className="field grow">
              <span>{t("settings.enterPin", { name: profileName(target, t) })}</span>
              <input
                className="input ltr"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </label>
            <button className="button button-primary" type="submit" disabled={pin.length < 4}>
              {t("settings.unlock")}
            </button>
          </form>
        ) : null}
        {error ? <p className="form-error">{t("settings.wrongPin")}</p> : null}
      </section>
    </main>
  );
}
