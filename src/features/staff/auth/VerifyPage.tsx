import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../api/client";
import type { MeResponse } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { ErrorNotice } from "../shared/ErrorNotice";
import { LoadingBlock } from "../shared/Spinner";

/** One request per token, even when React runs effects twice in development. */
const pending = new Map<string, Promise<MeResponse>>();

function verifyOnce(token: string): Promise<MeResponse> {
  let request = pending.get(token);
  if (!request) {
    request = api<MeResponse>("/auth/verify", { body: { token } });
    pending.set(token, request);
  }
  return request;
}

export function VerifyPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    verifyOnce(token)
      .then((me) => {
        if (!active) return;
        navigate(me.user.role === "super_admin" && !me.school ? "/admin" : "/staff", { replace: true });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, [token, navigate]);

  if (!token) {
    return (
      <div className="stack">
        <p className="notice danger">{t("staff.verifyMissing")}</p>
        <Link to="/staff/login" className="button button-primary">
          {t("staff.backToLogin")}
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stack">
        <h1 className="staff-auth-title">{t("staff.verifyFailed")}</h1>
        <ErrorNotice error={error} />
        <Link to="/staff/login" className="button button-primary">
          {t("staff.requestNewLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="stack center">
      <p>{t("staff.verifying")}</p>
      <LoadingBlock />
    </div>
  );
}
