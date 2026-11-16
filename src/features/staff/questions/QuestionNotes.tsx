import { Lock, MessageSquareText, Sparkles, Trash2, Users, Video } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import type { NoteVisibility, QuestionNote } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { DATE_TIME } from "../shared/dates";
import { ErrorNotice, FormError } from "../shared/ErrorNotice";
import { LoadingBlock } from "../shared/Spinner";
import { useApiGet } from "../shared/useApiGet";

type NotesResponse = QuestionNote[] | { notes: QuestionNote[] };

function asList(value: NotesResponse | null): QuestionNote[] {
  if (!value) return [];
  return Array.isArray(value) ? value : value.notes ?? [];
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function QuestionNotes({ questionId }: { questionId: number }) {
  const { t, date } = useI18n();
  const { data, error, loading, reload, setData } = useApiGet<NotesResponse>(`/staff/question-notes?questionId=${questionId}`);
  const [deleting, setDeleting] = useState<QuestionNote | null>(null);
  const notes = asList(data);

  return (
    <section className="card stack">
      <h2 className="card-title">
        <MessageSquareText size={18} aria-hidden="true" />
        {t("staff.schoolNotes")}
      </h2>
      <ErrorNotice error={error} onRetry={reload} />
      {loading && !data ? <LoadingBlock /> : null}
      {data && notes.length === 0 ? <p className="muted">{t("staff.notesEmpty")}</p> : null}
      <ul className="list">
        {notes.map((note) => {
          const video = safeUrl(note.videoUrl);
          return (
            <li key={note.id} className="list-row staff-note">
              <div className="grow stack tight">
                <p className="staff-note-body">{note.body}</p>
                {video ? (
                  <a href={video} target="_blank" rel="noreferrer" className="row small">
                    <Video size={14} aria-hidden="true" />
                    {t("staff.watchVideo")}
                  </a>
                ) : null}
                <span className="small muted row">
                  {note.visibility === "private" ? <Lock size={12} aria-hidden="true" /> : <Users size={12} aria-hidden="true" />}
                  {note.visibility === "private" ? t("staff.visibilityPrivate") : t("staff.visibilitySchool")}
                  {" · "}
                  {note.authorName} · {date(note.createdAt, DATE_TIME)}
                </span>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={t("staff.deleteNote")}
                title={t("staff.deleteNote")}
                onClick={() => setDeleting(note)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <NoteForm
        questionId={questionId}
        onCreated={(note) => setData((current) => [...asList(current), note])}
      />
      {deleting ? (
        <ConfirmDialog
          title={t("staff.deleteNote")}
          message={t("staff.deleteNoteConfirm")}
          confirmLabel={t("staff.delete")}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`/staff/question-notes/${deleting.id}`, { method: "DELETE" });
            setData((current) => asList(current).filter((note) => note.id !== deleting.id));
            setDeleting(null);
          }}
        />
      ) : null}
    </section>
  );
}

function NoteForm({ questionId, onCreated }: { questionId: number; onCreated: (note: QuestionNote) => void }) {
  const { t, lang } = useI18n();
  const { hasFeature } = useStaff();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("school");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<unknown>(null);
  const videoInvalid = videoUrl.trim() !== "" && safeUrl(videoUrl.trim()) === null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (videoInvalid) return;
    setBusy(true);
    setError(null);
    try {
      const note = await api<QuestionNote>("/staff/question-notes", {
        body: { questionId, visibility, body: body.trim(), videoUrl: videoUrl.trim() || null }
      });
      onCreated(note);
      setBody("");
      setVideoUrl("");
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const draft = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await api<{ text: string }>("/staff/ai/instructor-note", { body: { questionId, lang } });
      setBody((current) => (current.trim() ? `${current.trim()}\n\n${result.text}` : result.text));
    } catch (reason) {
      setAiError(reason);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <form className="stack staff-note-form" onSubmit={submit}>
      <h3 className="staff-subtitle">{t("staff.addNote")}</h3>
      <label className="field">
        <span>{t("staff.noteBody")}</span>
        <textarea
          className="textarea"
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t("staff.noteBodyHint")}
        />
      </label>
      <div className="row">
        {hasFeature("ai") ? (
          <button type="button" className="button button-ghost" onClick={draft} disabled={aiBusy}>
            <Sparkles size={16} aria-hidden="true" />
            {aiBusy ? t("staff.working") : t("staff.draftWithAi")}
          </button>
        ) : (
          <span className="small muted">{t("staff.aiNotInPlan")}</span>
        )}
      </div>
      <FormError error={aiError} />
      {body && hasFeature("ai") ? <p className="small muted">{t("staff.aiReviewHint")}</p> : null}
      <div className="grid cols-2">
        <label className="field">
          <span>{t("staff.visibility")}</span>
          <select className="select" value={visibility} onChange={(event) => setVisibility(event.target.value as NoteVisibility)}>
            <option value="school">{t("staff.visibilitySchool")}</option>
            <option value="private">{t("staff.visibilityPrivate")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("staff.videoUrl")}</span>
          <input
            className="input ltr"
            type="url"
            inputMode="url"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder="https://"
            aria-invalid={videoInvalid}
          />
          {videoInvalid ? <span className="hint form-error">{t("staff.invalidUrl")}</span> : null}
        </label>
      </div>
      <p className="small muted">{visibility === "school" ? t("staff.visibilitySchoolHint") : t("staff.visibilityPrivateHint")}</p>
      <FormError error={error} />
      <div className="row end">
        <button type="submit" className="button button-primary" disabled={busy || !body.trim() || videoInvalid}>
          {busy ? t("staff.working") : t("staff.saveNote")}
        </button>
      </div>
    </form>
  );
}
