import { Activity, Bug, Building2, LayoutDashboard, LogOut, ScrollText, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { MeResponse } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { LangSwitch } from "../staff/shared/LangSwitch";

const NAV = [
  { to: "/admin", key: "admin.navSchools", icon: Building2, end: true },
  { to: "/admin/usage", key: "admin.navUsage", icon: Activity, end: false },
  { to: "/admin/audit", key: "admin.navAudit", icon: ScrollText, end: false },
  { to: "/admin/errors", key: "admin.navErrors", icon: Bug, end: false }
];

export function AdminLayout({ me, children }: { me: MeResponse; children: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    navigate("/staff/login", { replace: true });
  };

  return (
    <div className="staff-shell">
      <header className="staff-sidebar">
        <div className="staff-brand">
          <span className="staff-brand-logo placeholder" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <div className="staff-brand-text">
            <span className="staff-brand-name">{t("admin.title")}</span>
            <span className="staff-brand-role">{t("staff.role_super_admin")}</span>
          </div>
        </div>
        <nav className="staff-nav" aria-label={t("admin.navLabel")}>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <Icon size={18} aria-hidden="true" />
                <span>{t(item.key)}</span>
              </NavLink>
            );
          })}
          {me.school ? (
            <NavLink to="/staff" end>
              <LayoutDashboard size={18} aria-hidden="true" />
              <span>{t("admin.navStaff")}</span>
            </NavLink>
          ) : null}
        </nav>
        <div className="staff-sidebar-foot">
          <span className="staff-user small muted" title={me.user.email}>
            {me.user.name || me.user.email}
          </span>
          <div className="row">
            <LangSwitch />
            <button type="button" className="icon-button" onClick={() => void logout()} aria-label={t("staff.logout")} title={t("staff.logout")}>
              <LogOut size={18} aria-hidden="true" className="staff-flip" />
            </button>
          </div>
        </div>
      </header>
      <main className="staff-main">{children}</main>
    </div>
  );
}
