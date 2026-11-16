import { Check, Copy } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../../../i18n/useI18n";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button button-ghost"
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }
      }}
    >
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      <span aria-live="polite">{copied ? t("staff.copied") : label ?? t("staff.copy")}</span>
    </button>
  );
}

interface CopyFieldProps {
  label: string;
  value: string;
  multiline?: boolean;
}

/** Read-only value (link, snippet) with a copy button. */
export function CopyField({ label, value, multiline }: CopyFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="staff-copy">
        {multiline ? (
          <textarea id={id} className="textarea ltr staff-mono" readOnly value={value} rows={4} />
        ) : (
          <input
            id={id}
            className="input ltr staff-mono"
            readOnly
            value={value}
            onFocus={(event) => event.target.select()}
          />
        )}
        <CopyButton value={value} />
      </div>
    </div>
  );
}
