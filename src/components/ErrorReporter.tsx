import { useEffect } from "react";
import { apiHealth } from "../api/client";

const RELEASE = import.meta.env.VITE_RELEASE ?? "dev";
let sent = 0;

/** Sends uncaught errors (no personal data: message, stack, path only) when the API exists. */
export function ErrorReporter() {
  useEffect(() => {
    const report = (message: string, stack?: string) => {
      if (sent >= 5 || import.meta.env.DEV) return;
      sent += 1;
      void apiHealth().then((health) => {
        if (!health.ok) return;
        void fetch("/api/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message.slice(0, 500),
            stack: stack?.slice(0, 2000) ?? null,
            path: window.location.pathname.replace(/\/live\/\d+/, "/live/:code"),
            release: RELEASE
          }),
          keepalive: true
        }).catch(() => undefined);
      });
    };
    const onError = (event: ErrorEvent) => report(event.message, event.error?.stack);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as Error | undefined;
      report(reason?.message ?? String(event.reason), reason?.stack);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
