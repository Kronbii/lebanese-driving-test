import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { Branch, FeatureFlag, MeResponse, SchoolSettings, StaffUser } from "../../api/types";
import { useApiGet } from "./shared/useApiGet";

export interface StaffContextValue {
  me: MeResponse;
  user: StaffUser;
  school: SchoolSettings | null;
  isSchoolAdmin: boolean;
  isSuperAdmin: boolean;
  hasFeature: (flag: FeatureFlag) => boolean;
  branches: Branch[];
  /** Everyone on staff (falls back to just the current user when the list is not visible). */
  staffUsers: StaffUser[];
  reloadStaffUsers: () => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  branchName: (id: string | null) => string | null;
  userName: (id: string | null) => string | null;
  /** Absolute URL under the school's public pages, e.g. schoolUrl("/learn"). */
  schoolUrl: (path?: string) => string;
}

const StaffContext = createContext<StaffContextValue | null>(null);

interface StaffProviderProps {
  me: MeResponse;
  onMe: (me: MeResponse) => void;
  children: ReactNode;
}

export function StaffProvider({ me, onMe, children }: StaffProviderProps) {
  const navigate = useNavigate();
  const { user, school } = me;
  const users = useApiGet<StaffUser[]>(school ? "/staff/users" : null);

  const refreshMe = useCallback(async () => {
    const next = await api<MeResponse>("/auth/me");
    onMe(next);
  }, [onMe]);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    navigate("/staff/login", { replace: true });
  }, [navigate]);

  const value = useMemo<StaffContextValue>(() => {
    const branches = school?.branches ?? [];
    const staffUsers = users.data && Array.isArray(users.data) && users.data.length > 0 ? users.data : [user];
    const slug = school?.slug ?? "";
    return {
      me,
      user,
      school,
      isSchoolAdmin: user.role === "school_admin" || user.role === "super_admin",
      isSuperAdmin: user.role === "super_admin",
      hasFeature: (flag) => Boolean(school?.features?.[flag]),
      branches,
      staffUsers,
      reloadStaffUsers: users.reload,
      refreshMe,
      logout,
      branchName: (id) => (id ? branches.find((branch) => branch.id === id)?.name ?? null : null),
      userName: (id) => (id ? staffUsers.find((member) => member.id === id)?.name ?? null : null),
      schoolUrl: (path = "") => `${window.location.origin}/s/${slug}${path}`
    };
  }, [me, user, school, users.data, users.reload, refreshMe, logout]);

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff(): StaffContextValue {
  const context = useContext(StaffContext);
  if (!context) throw new Error("useStaff must be used inside StaffProvider");
  return context;
}
