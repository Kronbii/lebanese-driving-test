import { GraduationCap, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../../i18n/useI18n";
import { useStaff } from "./StaffContext";
import { visibleNav } from "./nav";
import { ROLE_KEYS, SCHOOL_STATUS_KEYS } from "./shared/labels";
import { LangSwitch } from "./shared/LangSwitch";

/** Sidebar on desktop, compact header with scrolling tabs on phones. */
export function StaffLayout({ children }: { children: ReactNode }) {
  const staff = useStaff();
  const { t, pick } = useI18n();
  const { user, school } = staff;
  const items = visibleNav(staff);
  const schoolName = school ? pick(school.name) : t("staff.platformName");

  return (
    <div className="staff-shell">
      <header className="staff-sidebar">
        <div className="staff-brand">
          {school?.branding.logoUrl ? (
            <img className="staff-brand-logo" src={school.branding.logoUrl} alt="" />
          ) : (
            <span className="staff-brand-logo placeholder" aria-hidden="true">
              <GraduationCap size={20} />
            </span>
          )}
          <div className="staff-brand-text">
            <span className="staff-brand-name">{schoolName}</span>
            <span className="staff-brand-role">{t(ROLE_KEYS[user.role])}</span>
          </div>
        </div>
        {school && school.status !== "active" ? (
          <span className={`badge ${school.status === "suspended" ? "danger" : "info"} staff-brand-status`}>
            {t(SCHOOL_STATUS_KEYS[school.status])}
          </span>
        ) : null}
        <nav className="staff-nav" aria-label={t("staff.navLabel")}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <Icon size={18} aria-hidden="true" />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="staff-sidebar-foot">
          <span className="staff-user small muted" title={user.email}>
            {user.name || user.email}
          </span>
          <div className="row">
            <LangSwitch />
            <button type="button" className="icon-button" onClick={() => void staff.logout()} aria-label={t("staff.logout")} title={t("staff.logout")}>
              <LogOut size={18} aria-hidden="true" className="staff-flip" />
            </button>
          </div>
        </div>
      </header>
      <main className="staff-main">
        {school?.status === "suspended" ? <p className="notice danger">{t("staff.suspendedBanner")}</p> : null}
        {children}
      </main>
    </div>
  );
}
