import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api } from "./api/client";
import { ProfileProvider } from "./app/ProfileContext";
import { SchoolProvider } from "./app/SchoolContext";
import { SettingsProvider } from "./app/SettingsContext";
import { TrainerProvider } from "./app/TrainerContext";
import { ErrorReporter } from "./components/ErrorReporter";
import { Loading } from "./components/Loading";
import { TrainerRoutes } from "./features/trainer/TrainerRoutes";

const StaffApp = lazy(() => import("./features/staff/StaffApp"));
const AdminApp = lazy(() => import("./features/admin/AdminApp"));
const LivePage = lazy(() => import("./features/live/LivePage"));
const EmbedPage = lazy(() => import("./features/embed/EmbedPage"));
const PrivacyPage = lazy(() => import("./features/privacy/PrivacyPage"));
const SchoolLanding = lazy(() => import("./features/school/SchoolLanding"));

export default function App() {
  return (
    <SettingsProvider>
      <ProfileProvider>
        <BrowserRouter>
          <ErrorReporter />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/staff/*" element={<StaffApp />} />
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="/live/:code?" element={<LivePage />} />
              <Route path="/embed/:slug?" element={<EmbedScope />} />
              <Route path="/s/:slug" element={<SchoolScope />}>
                <Route index element={<SchoolLanding />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="learn/*" element={<TrainerRoutes />} />
              </Route>
              <Route path="/privacy" element={<PublicScope><PrivacyPage /></PublicScope>} />
              <Route
                path="/*"
                element={
                  <PublicScope>
                    <TrainerRoutes />
                  </PublicScope>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ProfileProvider>
    </SettingsProvider>
  );
}

function SchoolScope() {
  const { slug } = useParams();
  return (
    <SchoolProvider slug={slug ?? null}>
      <TrainerProvider>
        <Outlet />
      </TrainerProvider>
    </SchoolProvider>
  );
}

function EmbedScope() {
  const { slug } = useParams();
  return (
    <SchoolProvider slug={slug ?? null}>
      <EmbedPage />
    </SchoolProvider>
  );
}

/** Hosts that serve the generic app; any other host may be a school's custom domain. */
const APP_HOSTS = (import.meta.env.VITE_APP_HOSTS ?? "")
  .split(",")
  .map((host: string) => host.trim())
  .filter(Boolean);

function isAppHost(host: string): boolean {
  const name = host.split(":")[0];
  if (name === "localhost" || name === "127.0.0.1" || name.endsWith(".localhost")) return true;
  if (name.endsWith(".vercel.app")) return true;
  return APP_HOSTS.length === 0 || APP_HOSTS.includes(name);
}

function PublicScope({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  useEffect(() => {
    const host = window.location.host;
    if (isAppHost(host) || window.location.pathname !== "/") return;
    api<{ slug: string }>(`/schools/by-host?host=${encodeURIComponent(host)}`)
      .then(({ slug }) => navigate(`/s/${slug}`, { replace: true }))
      .catch(() => undefined);
  }, [navigate]);

  return (
    <SchoolProvider slug={null}>
      <TrainerProvider>{children}</TrainerProvider>
    </SchoolProvider>
  );
}
