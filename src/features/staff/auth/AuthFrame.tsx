import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import { useI18n } from "../../../i18n/useI18n";
import { LangSwitch } from "../shared/LangSwitch";

/** Centered card for login / verify screens. */
export function AuthFrame({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="staff-auth">
      <div className="staff-auth-top">
        <span className="staff-auth-brand">
          <GraduationCap size={22} aria-hidden="true" />
          {t("staff.appName")}
        </span>
        <LangSwitch />
      </div>
      <main className="staff-auth-card card">{children}</main>
    </div>
  );
}
