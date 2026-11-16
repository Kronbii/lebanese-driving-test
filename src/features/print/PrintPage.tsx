import { Award, BarChart3, FileText, KeyRound, ListChecks, QrCode as QrIcon, Signpost } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useSchool } from "../../app/SchoolContext";
import { useI18n } from "../../i18n/useI18n";
import { PrintLayout } from "./PrintLayout";
import { CertificateSheet, PosterSheet } from "./sheets/BrandedSheets";
import { AnswerKeySheet, ExamSheet } from "./sheets/ExamSheets";
import { ReportSheet } from "./sheets/ReportSheet";
import { SignsSheet, TopicSheet } from "./sheets/StudySheets";

export type PrintKind = "exam" | "answer-key" | "signs" | "topic" | "report" | "certificate" | "poster";

/**
 * Printable A4 pages (print/:kind), mounted outside the trainer shell.
 * Each sheet renders its own toolbar controls through PrintLayout.
 */
export function PrintPage() {
  const { kind } = useParams();
  switch (kind) {
    case "exam":
      return <ExamSheet />;
    case "answer-key":
      return <AnswerKeySheet />;
    case "signs":
      return <SignsSheet />;
    case "topic":
      return <TopicSheet />;
    case "report":
      return <ReportSheet />;
    case "certificate":
      return <CertificateSheet />;
    case "poster":
      return <PosterSheet />;
    default:
      return <PrintIndex />;
  }
}

/** Unknown kind: list what can be printed. */
function PrintIndex() {
  const { t } = useI18n();
  const { link, school } = useSchool();
  const items: { kind: PrintKind; icon: ReactNode; label: string }[] = [
    { kind: "exam", icon: <FileText aria-hidden />, label: t("print.exam_title") },
    { kind: "answer-key", icon: <KeyRound aria-hidden />, label: t("print.key_title") },
    { kind: "signs", icon: <Signpost aria-hidden />, label: t("print.signs_title") },
    { kind: "topic", icon: <ListChecks aria-hidden />, label: t("print.topic_titlePlain") },
    { kind: "report", icon: <BarChart3 aria-hidden />, label: t("print.report_title") },
    { kind: "certificate", icon: <Award aria-hidden />, label: t("print.cert_title") }
  ];
  if (school) items.push({ kind: "poster", icon: <QrIcon aria-hidden />, label: t("print.poster_title") });

  return (
    <PrintLayout title={t("print.index_title")} printable={false} footer={false}>
      <ul className="list print-index">
        {items.map((item) => (
          <li key={item.kind}>
            <Link className="list-row" to={link(`print/${item.kind}`)}>
              {item.icon}
              <span className="strong">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PrintLayout>
  );
}

export default PrintPage;
