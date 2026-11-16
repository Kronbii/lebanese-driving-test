import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "../../api/client";
import { useI18n } from "../../i18n/useI18n";
import type { MeResponse } from "../../api/types";
import { LoginPage } from "./auth/LoginPage";
import { VerifyPage } from "./auth/VerifyPage";
import { AuthFrame } from "./auth/AuthFrame";
import { StaffProvider, useStaff } from "./StaffContext";
import { StaffLayout } from "./StaffLayout";
import { visibleNav } from "./nav";
import { ErrorNotice } from "./shared/ErrorNotice";
import { isAbort, isUnauthorized } from "./shared/errors";
import { LoadingBlock } from "./shared/Spinner";
import { AdminOnly, FeatureGate } from "./shared/FeatureGate";

const OverviewPage = lazy(() => import("./overview/OverviewPage"));
const StudentsPage = lazy(() => import("./students/StudentsPage"));
const StudentDetailPage = lazy(() => import("./students/StudentDetailPage"));
const LeadsPage = lazy(() => import("./leads/LeadsPage"));
const AppointmentsPage = lazy(() => import("./appointments/AppointmentsPage"));
const InviteCodesPage = lazy(() => import("./invites/InviteCodesPage"));
const ClassroomSetupPage = lazy(() => import("./classroom/ClassroomSetupPage"));
const ClassroomHostPage = lazy(() => import("./classroom/ClassroomHostPage"));
const QuestionsPage = lazy(() => import("./questions/QuestionsPage"));
const QuestionDetailPage = lazy(() => import("./questions/QuestionDetailPage"));
const MarketingPage = lazy(() => import("./marketing/MarketingPage"));
const SchoolSettingsPage = lazy(() => import("./school/SchoolSettingsPage"));

/** /staff/* — staff dashboard with its own layout (outside the student trainer shell). */
export function StaffApp() {
  return (
    <Routes>
      <Route
        path="login"
        element={
          <AuthFrame>
            <LoginPage />
          </AuthFrame>
        }
      />
      <Route
        path="verify"
        element={
          <AuthFrame>
            <VerifyPage />
          </AuthFrame>
        }
      />
      <Route path="*" element={<StaffGate />} />
    </Routes>
  );
}

/** Loads /auth/me; 401 sends the user to the login page. */
function StaffGate() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    api<MeResponse>("/auth/me", { signal: controller.signal })
      .then(setMe)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && !isAbort(reason)) setError(reason);
      });
    return () => controller.abort();
  }, [attempt]);

  const onMe = useCallback((next: MeResponse) => setMe(next), []);

  if (error && isUnauthorized(error)) return <Navigate to="/staff/login" replace />;
  if (error) {
    return (
      <AuthFrame>
        <ErrorNotice error={error} onRetry={() => setAttempt((value) => value + 1)} />
      </AuthFrame>
    );
  }
  if (!me) return <LoadingBlock />;

  return (
    <StaffProvider me={me} onMe={onMe}>
      <Suspense fallback={<LoadingBlock />}>
        <Routes>
          <Route path="classroom/:code" element={<HostRoute />} />
          <Route path="*" element={<StaffShellRoutes />} />
        </Routes>
      </Suspense>
    </StaffProvider>
  );
}

function HostRoute() {
  return (
    <FeatureGate flag="classroom">
      <ClassroomHostPage />
    </FeatureGate>
  );
}

function StaffShellRoutes() {
  const staff = useStaff();
  if (!staff.school) {
    return (
      <StaffLayout>
        <NoSchool />
      </StaffLayout>
    );
  }
  return (
    <StaffLayout>
      <Suspense fallback={<LoadingBlock />}>
        <Routes>
          <Route index element={<HomeRoute />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="leads" element={<FeatureGate flag="leads"><LeadsPage /></FeatureGate>} />
          <Route path="appointments" element={<FeatureGate flag="leads"><AppointmentsPage /></FeatureGate>} />
          <Route
            path="invite-codes"
            element={<FeatureGate flag="cloudStudents"><InviteCodesPage /></FeatureGate>}
          />
          <Route path="classroom" element={<FeatureGate flag="classroom"><ClassroomSetupPage /></FeatureGate>} />
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="questions/:id" element={<QuestionDetailPage />} />
          <Route path="marketing" element={<AdminOnly><MarketingPage /></AdminOnly>} />
          <Route path="school" element={<AdminOnly><SchoolSettingsPage /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/staff" replace />} />
        </Routes>
      </Suspense>
    </StaffLayout>
  );
}

/** Overview when the plan has the dashboard; otherwise the first page the user can open. */
function HomeRoute() {
  const staff = useStaff();
  if (staff.hasFeature("instructorDashboard")) return <OverviewPage />;
  const first = visibleNav(staff).find((item) => item.to !== "/staff");
  return <Navigate to={first?.to ?? "/staff/students"} replace />;
}

function NoSchool() {
  const { isSuperAdmin } = useStaff();
  if (isSuperAdmin) return <Navigate to="/admin" replace />;
  return <NoSchoolNotice />;
}

function NoSchoolNotice() {
  const { t } = useI18n();
  return <p className="notice warning">{t("staff.noSchool")}</p>;
}

export default StaffApp;
