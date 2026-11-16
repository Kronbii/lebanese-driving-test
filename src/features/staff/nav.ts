import {
  BookOpen,
  Building2,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Presentation,
  ShieldCheck,
  Ticket,
  Users,
  type LucideIcon
} from "lucide-react";
import type { FeatureFlag } from "../../api/types";
import type { StaffContextValue } from "./StaffContext";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
  feature?: FeatureFlag;
  adminOnly?: boolean;
  superOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/staff", labelKey: "staff.navOverview", icon: LayoutDashboard, end: true, feature: "instructorDashboard" },
  { to: "/staff/students", labelKey: "staff.navStudents", icon: Users },
  { to: "/staff/leads", labelKey: "staff.navLeads", icon: Inbox, feature: "leads" },
  { to: "/staff/appointments", labelKey: "staff.navAppointments", icon: CalendarDays, feature: "leads" },
  { to: "/staff/invite-codes", labelKey: "staff.navInviteCodes", icon: Ticket, feature: "cloudStudents" },
  { to: "/staff/classroom", labelKey: "staff.navClassroom", icon: Presentation, feature: "classroom" },
  { to: "/staff/questions", labelKey: "staff.navQuestions", icon: BookOpen },
  { to: "/staff/marketing", labelKey: "staff.navMarketing", icon: Megaphone, adminOnly: true },
  { to: "/staff/school", labelKey: "staff.navSchool", icon: Building2, adminOnly: true },
  { to: "/admin", labelKey: "staff.navAdmin", icon: ShieldCheck, superOnly: true }
];

export function visibleNav(staff: StaffContextValue): NavItem[] {
  if (!staff.school) return NAV_ITEMS.filter((item) => item.superOnly && staff.isSuperAdmin);
  return NAV_ITEMS.filter((item) => {
    if (item.superOnly) return staff.isSuperAdmin;
    if (item.adminOnly && !staff.isSchoolAdmin) return false;
    if (item.feature && !staff.hasFeature(item.feature)) return false;
    return true;
  });
}
