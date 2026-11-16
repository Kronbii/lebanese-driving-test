import { ArrowLeft, Download, Eye, Maximize, Minimize, Play, SkipForward, Square, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, downloadFrom } from "../../../api/client";
import type { ClassroomHostState } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { PHASE_KEYS } from "../shared/labels";
import { LangSwitch } from "../shared/LangSwitch";
import { LoadingBlock } from "../shared/Spinner";
import { usePolling } from "../shared/usePolling";
import { AnsweredMeter, Leaderboard, LobbyStage, QuestionStage } from "./HostPanels";

type Action = "start" | "reveal" | "next" | "end";

/** Projector screen for a live classroom session. Space = reveal / next. */
export function ClassroomHostPage() {
  const { code = "" } = useParams();
  const { t, num } = useI18n();
  const fetcher = useCallback(() => api<ClassroomHostState>(`/staff/classroom/${encodeURIComponent(code)}`), [code]);
  const [stopped, setStopped] = useState(false);
  const { data: state, error, replace } = usePolling<ClassroomHostState>(
    code && !stopped ? `host-${code}` : null,
    fetcher,
    1500
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [showLive, setShowLive] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const joinUrl = `${window.location.origin}/live/${code}`;

  useEffect(() => {
    if (state?.phase === "ended") setStopped(true);
  }, [state?.phase]);

  const advance = useCallback(
    async (action: Action) => {
      setBusy(true);
      setActionError(null);
      try {
        const next = await api<ClassroomHostState>(`/staff/classroom/${encodeURIComponent(code)}/advance`, {
          body: { action }
        });
        replace(next);
      } catch (reason) {
        setActionError(reason);
      } finally {
        setBusy(false);
      }
    },
    [code, replace]
  );

  const isLast = state ? state.index + 1 >= state.total : false;
  const primary: { action: Action; label: string } | null = !state
    ? null
    : state.phase === "lobby"
      ? { action: "start", label: t("staff.hostStart") }
      : state.phase === "question"
        ? { action: "reveal", label: t("staff.hostReveal") }
        : state.phase === "reveal"
          ? isLast
            ? { action: "end", label: t("staff.hostFinish") }
            : { action: "next", label: t("staff.hostNext") }
          : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest("button, a, input, textarea, select, [contenteditable=true]")) return;
      if (!primary || busy || primary.action === "start") return;
      event.preventDefault();
      void advance(primary.action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary, busy, advance]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const exportCsv = async () => {
    setActionError(null);
    try {
      await downloadFrom(`/staff/classroom/${encodeURIComponent(code)}/export.csv`, `classroom-${code}.csv`);
    } catch (reason) {
      setActionError(reason);
    }
  };

  return (
    <div className="live-host">
      <header className="live-host-bar-top">
        <Link to="/staff/classroom" className="button button-ghost">
          <ArrowLeft size={18} aria-hidden="true" className="staff-flip" />
          {t("staff.exitHost")}
        </Link>
        <span className="live-host-meta ltr">#{code}</span>
        {state ? <span className="badge info">{t(PHASE_KEYS[state.phase])}</span> : null}
        {state && state.phase !== "lobby" ? (
          <span className="strong">
            {t("staff.questionOf", { index: num(Math.min(state.index + 1, state.total)), total: num(state.total) })}
          </span>
        ) : null}
        {state ? (
          <span className="row small">
            <Users size={16} aria-hidden="true" />
            {num(state.participants.length)}
          </span>
        ) : null}
        <span className="grow" />
        <LangSwitch />
        <button
          type="button"
          className="icon-button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? t("staff.exitFullscreen") : t("staff.fullscreen")}
          title={fullscreen ? t("staff.exitFullscreen") : t("staff.fullscreen")}
        >
          {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
        </button>
      </header>

      {!state && error ? <ErrorNotice error={error} /> : null}
      {!state && !error ? <LoadingBlock /> : null}

      {state ? (
        <div className="live-host-body">
          <main className="live-host-stage">
            {state.phase === "lobby" ? <LobbyStage state={state} joinUrl={joinUrl} /> : null}
            {state.phase === "question" || state.phase === "reveal" ? (
              <QuestionStage state={state} showDistribution={showLive} />
            ) : null}
            {state.phase === "ended" ? (
              <div className="stack live-host-ended">
                <h1 className="live-host-title">{t("staff.sessionEnded")}</h1>
                <Leaderboard state={state} limit={20} />
              </div>
            ) : null}
          </main>
          <aside className="live-host-side">
            {state.phase === "question" ? (
              <>
                <AnsweredMeter state={state} />
                <label className="check">
                  <input type="checkbox" checked={showLive} onChange={(event) => setShowLive(event.target.checked)} />
                  {t("staff.showLiveAnswers")}
                </label>
              </>
            ) : null}
            {state.phase === "reveal" ? <Leaderboard state={state} limit={5} /> : null}
            {error ? <ErrorNotice error={error} /> : null}
            <FormError error={actionError} />
            <div className="stack">
              {primary ? (
                <button
                  type="button"
                  className="button button-primary live-host-primary"
                  disabled={busy}
                  onClick={() => void advance(primary.action)}
                >
                  {primary.action === "start" ? <Play size={22} aria-hidden="true" /> : null}
                  {primary.action === "reveal" ? <Eye size={22} aria-hidden="true" /> : null}
                  {primary.action === "next" || primary.action === "end" ? (
                    <SkipForward size={22} aria-hidden="true" className="staff-flip" />
                  ) : null}
                  {primary.label}
                </button>
              ) : null}
              {primary && primary.action !== "start" ? <p className="small muted center">{t("staff.spaceHint")}</p> : null}
              {state.phase !== "ended" ? (
                <button type="button" className="button button-ghost" disabled={busy} onClick={() => setConfirmEnd(true)}>
                  <Square size={18} aria-hidden="true" />
                  {t("staff.hostEnd")}
                </button>
              ) : null}
              {state.phase !== "lobby" ? (
                <button type="button" className="button button-ghost" onClick={exportCsv}>
                  <Download size={18} aria-hidden="true" />
                  {t("staff.exportCsv")}
                </button>
              ) : null}
              {state.phase === "ended" ? (
                <Link className="button button-secondary" to="/staff/classroom">
                  {t("staff.newSession")}
                </Link>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {confirmEnd ? (
        <ConfirmDialog
          title={t("staff.hostEnd")}
          message={t("staff.hostEndConfirm")}
          confirmLabel={t("staff.hostEnd")}
          onClose={() => setConfirmEnd(false)}
          onConfirm={async () => {
            await advance("end");
            setConfirmEnd(false);
          }}
        />
      ) : null}
    </div>
  );
}

export default ClassroomHostPage;
