import type { Profile } from "../../../lib/profiles";
import { useI18n } from "../../../i18n/useI18n";

export function profileName(profile: Profile, t: (key: string) => string): string {
  return profile.name || t("settings.defaultProfileName");
}

export function ProfileAvatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const { t } = useI18n();
  const name = profileName(profile, t);
  const initial = Array.from(name.trim())[0] ?? "?";
  return (
    <span
      className="profile-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, background: profile.color, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
