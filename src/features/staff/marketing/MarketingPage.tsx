import { Code2, Download, ExternalLink, Link2, Megaphone, Printer } from "lucide-react";
import { useState } from "react";
import { QrCode, qrDataUrl } from "../../../components/QrCode";
import { TOPICS } from "../../../data/topics";
import type { TopicId } from "../../../domain/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { CopyField } from "../shared/CopyField";

function cleanRef(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
}

async function downloadQr(value: string, filename: string) {
  const url = await qrDataUrl(value, 1000, "Q");
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function MarketingPage() {
  const { t, pick } = useI18n();
  const { school, schoolUrl } = useStaff();
  const [refInput, setRefInput] = useState("reception");
  const [topic, setTopic] = useState<TopicId>("traffic_rules");
  if (!school) return null;

  const publicUrl = schoolUrl();
  const ref = cleanRef(refInput);
  const refUrl = ref ? `${publicUrl}?ref=${encodeURIComponent(ref)}` : publicUrl;
  const posterUrl = schoolUrl(`/learn/print/poster${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);
  const embedTitle = t("staff.embedTitle", { school: pick(school.name) }).replace(/"/g, "&quot;");
  const embed = `<iframe src="${window.location.origin}/embed/${school.slug}" width="100%" height="560" style="border:0" loading="lazy" title="${embedTitle}"></iframe>`;

  const worksheets: { key: string; href: string }[] = [
    { key: "staff.printExam", href: schoolUrl("/learn/print/exam") },
    { key: "staff.printAnswerKey", href: schoolUrl("/learn/print/answer-key") },
    { key: "staff.printSigns", href: schoolUrl("/learn/print/signs") }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="staff-title">{t("staff.marketingTitle")}</h1>
          <p>{t("staff.marketingIntro")}</p>
        </div>
      </div>

      <div className="grid cols-2">
        <section className="card stack">
          <h2 className="card-title">
            <Megaphone size={18} aria-hidden="true" />
            {t("staff.publicPage")}
          </h2>
          <div className="staff-qr-block">
            <QrCode value={publicUrl} size={180} label={t("staff.publicPage")} />
            <div className="stack grow">
              <CopyField label={t("staff.publicLink")} value={publicUrl} />
              <div className="row">
                <a className="button button-ghost" href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} aria-hidden="true" />
                  {t("staff.open")}
                </a>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => void downloadQr(publicUrl, `${school.slug}-qr.png`)}
                >
                  <Download size={16} aria-hidden="true" />
                  {t("staff.downloadQr")}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card stack">
          <h2 className="card-title">
            <Link2 size={18} aria-hidden="true" />
            {t("staff.referralBuilder")}
          </h2>
          <p className="small muted">{t("staff.referralIntro")}</p>
          <label className="field">
            <span>{t("staff.refName")}</span>
            <input
              className="input ltr"
              value={refInput}
              onChange={(event) => setRefInput(event.target.value)}
              placeholder="instagram-bio"
              aria-describedby="ref-hint"
            />
            <span className="hint" id="ref-hint">
              {t("staff.refHint")}
            </span>
          </label>
          <div className="staff-qr-block">
            <QrCode value={refUrl} size={150} label={t("staff.referralBuilder")} />
            <div className="stack grow">
              <CopyField label={t("staff.referralLink")} value={refUrl} />
              <div className="row">
                <a className="button button-secondary" href={posterUrl} target="_blank" rel="noreferrer">
                  <Printer size={16} aria-hidden="true" />
                  {t("staff.printPoster")}
                </a>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => void downloadQr(refUrl, `${school.slug}-${ref || "qr"}.png`)}
                >
                  <Download size={16} aria-hidden="true" />
                  {t("staff.downloadQr")}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card stack">
        <h2 className="card-title">
          <Code2 size={18} aria-hidden="true" />
          {t("staff.embedSnippet")}
        </h2>
        <p className="small muted">{t("staff.embedIntro")}</p>
        <CopyField label={t("staff.embedCode")} value={embed} multiline />
      </section>

      <section className="card stack">
        <h2 className="card-title">
          <Printer size={18} aria-hidden="true" />
          {t("staff.worksheets")}
        </h2>
        <p className="small muted">{t("staff.worksheetsIntro")}</p>
        <div className="row">
          {worksheets.map((item) => (
            <a key={item.key} className="button button-ghost" href={item.href} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              {t(item.key)}
            </a>
          ))}
        </div>
        <div className="row">
          <label className="field grow">
            <span>{t("staff.printTopic")}</span>
            <select className="select" value={topic} onChange={(event) => setTopic(event.target.value as TopicId)}>
              {TOPICS.map((item) => (
                <option key={item.id} value={item.id}>
                  {pick(item.label)}
                </option>
              ))}
            </select>
          </label>
          <a
            className="button button-ghost staff-align-end"
            href={schoolUrl(`/learn/print/topic?topic=${topic}`)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} aria-hidden="true" />
            {t("staff.open")}
          </a>
        </div>
      </section>
    </div>
  );
}

export default MarketingPage;
