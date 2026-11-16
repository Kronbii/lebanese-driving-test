import { Presentation } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { ClassroomPlayerState } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { errorKey, hasCode } from "../staff/shared/errors";
import { LangSwitch } from "../staff/shared/LangSwitch";
import { LoadingBlock } from "../staff/shared/Spinner";
import { usePolling } from "../staff/shared/usePolling";
import { CodeEntry } from "./CodeEntry";
import { JoinForm } from "./JoinForm";
import { cleanCode, clearToken, loadToken, saveToken } from "./liveSession";
import { PlayerView } from "./PlayerView";

/** /live/:code? — students join a live classroom from their phones. */
export function LivePage() {
  const { t } = useI18n();
  const { code: rawCode } = useParams();
  const code = cleanCode(rawCode ?? "");

  return (
    <div className="live-player">
      <header className="live-player-top">
        <span className="live-brand">
          <Presentation size={20} aria-hidden="true" />
          {t("live.brand")}
        </span>
        <LangSwitch />
      </header>
      <main className="live-player-main">{code ? <LiveSession key={code} code={code} /> : <CodeEntry />}</main>
    </div>
  );
}

function LiveSession({ code }: { code: string }) {
  const { t } = useI18n();
  const [token, setToken] = useState<string | null>(() => loadToken(code));
  const [initial, setInitial] = useState<ClassroomPlayerState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const fetcher = useCallback(
    () => api<ClassroomPlayerState>(`/live/${encodeURIComponent(code)}/state`, { token }),
    [code, token]
  );
  const [stopped, setStopped] = useState(false);
  const { data, error, replace } = usePolling<ClassroomPlayerState>(
    token && !stopped ? `live-${code}-${token}` : null,
    fetcher,
    1500
  );
  const state = data ?? initial;

  // Lost session (expired token, session deleted): back to the join screen.
  useEffect(() => {
    if (!error) return;
    if (hasCode(error, "unauthorized") || hasCode(error, "not_found") || hasCode(error, "expired")) {
      clearToken(code);
      setToken(null);
      setInitial(null);
      setNotice(t(hasCode(error, "not_found") ? "live.sessionNotFound" : "live.sessionLost"));
    }
  }, [error, code, t]);

  useEffect(() => {
    if (state?.phase === "ended") setStopped(true);
  }, [state?.phase]);

  // A new question clears the local selection.
  const questionKey = state ? `${state.index}-${state.phase}` : "";
  useEffect(() => {
    setPending(null);
    setAnswerError(null);
  }, [questionKey]);

  const answer = async (selected: number) => {
    if (!token) return;
    setPending(selected);
    setAnswerError(null);
    try {
      const next = await api<ClassroomPlayerState>(`/live/${encodeURIComponent(code)}/answer`, {
        body: { selected },
        token
      });
      replace(next);
    } catch (reason) {
      setPending(null);
      setAnswerError(t(errorKey(reason)));
    }
  };

  if (!token) {
    return (
      <JoinForm
        code={code}
        notice={notice}
        onJoined={(nextToken, nextState) => {
          saveToken(code, nextToken);
          setNotice(null);
          setInitial(nextState);
          setStopped(false);
          setToken(nextToken);
        }}
      />
    );
  }

  if (!state) {
    return error ? (
      <p className="notice danger" role="alert">
        {t(errorKey(error))}
      </p>
    ) : (
      <LoadingBlock />
    );
  }

  return (
    <>
      {error ? (
        <p className="notice warning small" role="status">
          {t("live.reconnecting")}
        </p>
      ) : null}
      <PlayerView state={state} pending={pending} answerError={answerError} onAnswer={answer} />
    </>
  );
}

export default LivePage;
