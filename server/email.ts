import type { EmailMessage, SendEmail } from "./context";
import type { Env } from "./lib";

/** Resend HTTP API sender, or null when not configured. */
export function resendSender(env: Env): SendEmail | null {
  const key = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!key || !from) return null;
  return async (message: EmailMessage) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
    }
  };
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function magicLinkEmail(to: string, link: string): EmailMessage {
  const subject = "رابط الدخول | Sign-in link";
  const text = [
    "رابط الدخول إلى لوحة المدرسة (صالح لمدة 15 دقيقة ولمرة واحدة):",
    link,
    "",
    "Your staff sign-in link (valid for 15 minutes, single use):",
    link,
    "",
    "إذا لم تطلب هذا الرابط فتجاهل هذه الرسالة. / If you did not request this, ignore this email."
  ].join("\n");
  const safe = escapeHtml(link);
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111">
<p dir="rtl">رابط الدخول إلى لوحة المدرسة (صالح لمدة 15 دقيقة ولمرة واحدة):</p>
<p>Your staff sign-in link (valid for 15 minutes, single use):</p>
<p><a href="${safe}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">تسجيل الدخول / Sign in</a></p>
<p style="font-size:12px;color:#555;word-break:break-all">${safe}</p>
<p style="font-size:12px;color:#555" dir="rtl">إذا لم تطلب هذا الرابط فتجاهل هذه الرسالة.</p>
<p style="font-size:12px;color:#555">If you did not request this, ignore this email.</p>
</body></html>`;
  return { to, subject, text, html };
}
