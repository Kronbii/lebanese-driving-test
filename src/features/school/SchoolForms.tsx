import { CalendarClock, CheckCircle2, Send } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type {
  AppointmentKind,
  AppointmentRequest,
  LeadRequest,
  PackageId,
  PublicSchool
} from "../../api/types";
import { useI18n } from "../../i18n/useI18n";

const PACKAGES: PackageId[] = ["theory", "motorcycle", "car", "full"];
const KINDS: AppointmentKind[] = ["lesson", "theory_exam", "consultation"];

type SendState = "idle" | "sending" | "sent" | "error";

function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "school.error_network";
    switch (error.code) {
      case "rate_limited":
        return "school.error_rateLimited";
      case "consent_required":
        return "school.error_consent";
      case "feature_disabled":
      case "school_suspended":
        return "school.error_unavailable";
      case "bad_request":
        return "school.error_invalid";
      default:
        return "school.error_generic";
    }
  }
  return "school.error_generic";
}

function phoneOk(value: string): boolean {
  return value.replace(/\D/g, "").length >= 6;
}

interface FormProps {
  school: PublicSchool;
  slug: string;
}

/** Shared fields: name, optional phone, branch, consent. */
function useContactFields(school: PublicSchool) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const reset = () => {
    setName("");
    setPhone("");
    setBranchId("");
    setMessage("");
    setConsent(false);
  };
  const problem = (): string | null => {
    if (name.trim().length < 2) return "school.error_name";
    if (school.collectPhone && !phoneOk(phone)) return "school.error_phone";
    if (!consent) return "school.error_consent";
    return null;
  };
  return {
    values: { name, phone, branchId, message, consent },
    set: { setName, setPhone, setBranchId, setMessage, setConsent },
    reset,
    problem
  };
}

function ContactFields({
  school,
  slug,
  fields,
  idPrefix,
  children
}: {
  school: PublicSchool;
  slug: string;
  fields: ReturnType<typeof useContactFields>;
  idPrefix: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const { values, set } = fields;
  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-name`}>{t("school.form_name")}</label>
        <input
          id={`${idPrefix}-name`}
          className="input"
          value={values.name}
          onChange={(event) => set.setName(event.target.value)}
          autoComplete="name"
          maxLength={80}
          required
        />
      </div>
      {school.collectPhone ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-phone`}>{t("school.form_phone")}</label>
          <input
            id={`${idPrefix}-phone`}
            className="input ltr"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="+961"
            value={values.phone}
            onChange={(event) => set.setPhone(event.target.value)}
            maxLength={24}
            required
          />
        </div>
      ) : null}
      {children}
      {school.branches.length ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-branch`}>{t("school.form_branch")}</label>
          <select
            id={`${idPrefix}-branch`}
            className="select"
            value={values.branchId}
            onChange={(event) => set.setBranchId(event.target.value)}
          >
            <option value="">{t("school.form_anyBranch")}</option>
            {school.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${idPrefix}-message`}>{t("school.form_message")}</label>
        <textarea
          id={`${idPrefix}-message`}
          className="textarea"
          value={values.message}
          onChange={(event) => set.setMessage(event.target.value)}
          maxLength={1000}
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={values.consent}
          onChange={(event) => set.setConsent(event.target.checked)}
          required
        />
        <span>
          {t("school.form_consent")}{" "}
          <Link to={`/s/${slug}/privacy`}>{t("school.form_privacyLink")}</Link>
        </span>
      </label>
    </>
  );
}

function SentNotice({ text, onAgain }: { text: string; onAgain: () => void }) {
  const { t } = useI18n();
  return (
    <div className="stack">
      <p className="notice success" role="status">
        <CheckCircle2 size={20} aria-hidden />
        <span>{text}</span>
      </p>
      <button type="button" className="button button-ghost" onClick={onAgain}>
        {t("school.form_again")}
      </button>
    </div>
  );
}

export function LeadForm({ school, slug, refCode }: FormProps & { refCode: string | null }) {
  const { t } = useI18n();
  const id = useId();
  const fields = useContactFields(school);
  const [interest, setInterest] = useState<PackageId | "">("");
  const [state, setState] = useState<SendState>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = fields.problem();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setState("sending");
    const { name, phone, branchId, message, consent } = fields.values;
    const body: LeadRequest = {
      name: name.trim(),
      phone: school.collectPhone ? phone.trim() : null,
      interest: interest || null,
      message: message.trim() || null,
      branchId: branchId || null,
      ref: refCode,
      consent
    };
    try {
      await api<{ ok: true }>(`/schools/${encodeURIComponent(slug)}/leads`, { body });
      setState("sent");
    } catch (failure) {
      setError(errorKey(failure));
      setState("error");
    }
  };

  return (
    <section className="card stack" aria-labelledby={`${id}-title`}>
      <h2 className="card-title" id={`${id}-title`}>
        <Send aria-hidden />
        {t("school.lead_title")}
      </h2>
      {state === "sent" ? (
        <SentNotice
          text={t("school.lead_sent")}
          onAgain={() => {
            fields.reset();
            setInterest("");
            setState("idle");
          }}
        />
      ) : (
        <form className="stack" onSubmit={(event) => void submit(event)} noValidate>
          <p className="muted small">{t("school.lead_intro")}</p>
          <ContactFields school={school} slug={slug} fields={fields} idPrefix={`${id}-lead`}>
            <div className="field">
              <label htmlFor={`${id}-interest`}>{t("school.form_interest")}</label>
              <select
                id={`${id}-interest`}
                className="select"
                value={interest}
                onChange={(event) => setInterest(event.target.value as PackageId | "")}
              >
                <option value="">{t("school.form_notSure")}</option>
                {PACKAGES.map((item) => (
                  <option key={item} value={item}>
                    {t(`school.package_${item}`)}
                  </option>
                ))}
              </select>
            </div>
          </ContactFields>
          {error ? (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          ) : null}
          <button type="submit" className="button button-primary" disabled={state === "sending"}>
            <Send size={18} aria-hidden />
            {state === "sending" ? t("school.form_sending") : t("school.lead_submit")}
          </button>
        </form>
      )}
    </section>
  );
}

function localInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AppointmentForm({ school, slug }: FormProps) {
  const { t } = useI18n();
  const id = useId();
  const fields = useContactFields(school);
  const [kind, setKind] = useState<AppointmentKind>("lesson");
  const [when, setWhen] = useState("");
  const [state, setState] = useState<SendState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [min] = useState(() => localInputValue(new Date(Date.now() + 60 * 60 * 1000)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = fields.problem();
    const at = when ? new Date(when) : null;
    if (problem) {
      setError(problem);
      return;
    }
    if (!at || Number.isNaN(at.getTime()) || at.getTime() < Date.now()) {
      setError("school.error_date");
      return;
    }
    setError(null);
    setState("sending");
    const { name, phone, branchId, message, consent } = fields.values;
    const body: AppointmentRequest = {
      name: name.trim(),
      phone: school.collectPhone ? phone.trim() : null,
      kind,
      preferredAt: at.toISOString(),
      branchId: branchId || null,
      message: message.trim() || null,
      consent
    };
    try {
      await api<{ ok: true }>(`/schools/${encodeURIComponent(slug)}/appointments`, { body });
      setState("sent");
    } catch (failure) {
      setError(errorKey(failure));
      setState("error");
    }
  };

  return (
    <section className="card stack" aria-labelledby={`${id}-title`}>
      <h2 className="card-title" id={`${id}-title`}>
        <CalendarClock aria-hidden />
        {t("school.appointment_title")}
      </h2>
      {state === "sent" ? (
        <SentNotice
          text={t("school.appointment_sent")}
          onAgain={() => {
            fields.reset();
            setWhen("");
            setState("idle");
          }}
        />
      ) : (
        <form className="stack" onSubmit={(event) => void submit(event)} noValidate>
          <p className="muted small">{t("school.appointment_intro")}</p>
          <ContactFields school={school} slug={slug} fields={fields} idPrefix={`${id}-appt`}>
            <div className="field">
              <label htmlFor={`${id}-kind`}>{t("school.appointment_kind")}</label>
              <select
                id={`${id}-kind`}
                className="select"
                value={kind}
                onChange={(event) => setKind(event.target.value as AppointmentKind)}
              >
                {KINDS.map((item) => (
                  <option key={item} value={item}>
                    {t(`school.kind_${item}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-when`}>{t("school.appointment_when")}</label>
              <input
                id={`${id}-when`}
                className="input"
                type="datetime-local"
                min={min}
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                required
              />
              <span className="hint">{t("school.appointment_whenHint")}</span>
            </div>
          </ContactFields>
          {error ? (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          ) : null}
          <button type="submit" className="button button-primary" disabled={state === "sending"}>
            <CalendarClock size={18} aria-hidden />
            {state === "sending" ? t("school.form_sending") : t("school.appointment_submit")}
          </button>
        </form>
      )}
    </section>
  );
}
