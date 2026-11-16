import { ShieldAlert } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { api } from "../../api/client";
import type { MeResponse } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { AuthFrame } from "../staff/auth/AuthFrame";
import { ErrorNotice } from "../staff/shared/ErrorNotice";
import { isAbort, isUnauthorized } from "../staff/shared/errors";
import { LoadingBlock } from "../staff/shared/Spinner";
import { AdminLayout } from "./AdminLayout";

const SchoolsPage = lazy(() => import("./SchoolsPage"));
const SchoolEditPage = lazy(() => import("./SchoolEditPage"));
const UsagePage = lazy(() => import("./UsagePage"));
const AuditPage = lazy(() => import("./AuditPage"));
const ErrorsPage = lazy(() => import("./ErrorsPage"));

/** /admin/* — platform administration (super admins only). */
export function AdminApp() {
  const { t } = useI18n();
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

  if (error && isUnauthorized(error)) return <Navigate to="/staff/login" replace />;
  if (error) {
    return (
      <AuthFrame>
        <ErrorNotice error={error} onRetry={() => setAttempt((value) => value + 1)} />
      </AuthFrame>
    );
  }
  if (!me) return <LoadingBlock />;
  if (me.user.role !== "super_admin") {
    return (
      <AuthFrame>
        <div className="stack center">
          <ShieldAlert size={40} className="staff-auth-icon" aria-hidden="true" />
          <h1 className="staff-auth-title">{t("admin.forbiddenTitle")}</h1>
          <p className="muted">{t("admin.forbiddenBody")}</p>
          <Link to="/staff" className="button button-primary">
            {t("admin.backToStaff")}
          </Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AdminLayout me={me}>
      <Suspense fallback={<LoadingBlock />}>
        <Routes>
          <Route index element={<SchoolsPage />} />
          <Route path="schools/:id" element={<SchoolEditPage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="errors" element={<ErrorsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}

export default AdminApp;
