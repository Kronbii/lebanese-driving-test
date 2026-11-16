import { CalendarPlus, MessageCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../api/client";
import type { StaffStudent } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { asDisplayDate, DATE_LONG, DATE_TIME, isDateOnly } from "../shared/dates";
import { downloadIcs } from "../shared/ics";
import { whatsappLink } from "../shared/whatsapp";

/** WhatsApp reminders, calendar files and delete for one student. */
export function StudentActions({ student }: { student: StaffStudent }) {
  const { t, pick, date } = useI18n();
  const { school, isSchoolAdmin, schoolUrl, branches } = useStaff();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const schoolName = school ? pick(school.name) : "";
  const branch = branches.find((item) => item.id === student.branchId);
  const location = branch ? [branch.name, branch.address].filter(Boolean).join(" — ") : schoolName;

  const practiceText = t("staff.waPractice", { name: student.displayName, school: schoolName, link: schoolUrl("/learn") });
  const examText = student.examDate
    ? t("staff.waExam", {
        name: student.displayName,
        school: schoolName,
        date: date(asDisplayDate(student.examDate), isDateOnly(student.examDate) ? DATE_LONG : DATE_TIME)
      })
    : "";
  const lessonText = student.lessonDate
    ? t("staff.waLesson", { name: student.displayName, school: schoolName, date: date(student.lessonDate, DATE_TIME) })
    : "";

  const practiceLink = whatsappLink(student.phone, practiceText);
  const examLink = student.examDate ? whatsappLink(student.phone, examText) : null;
  const lessonLink = student.lessonDate ? whatsappLink(student.phone, lessonText) : null;
  const safeName = student.displayName.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) || "student";

  return (
    <div className="card stack">
      <h2 className="card-title">{t("staff.contactActions")}</h2>
      {!student.phone ? <p className="small muted">{t("staff.noPhone")}</p> : null}
      <div className="staff-action-grid">
        {practiceLink ? (
          <a className="button staff-wa" href={practiceLink} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            {t("staff.waPracticeButton")}
          </a>
        ) : null}
        {examLink ? (
          <a className="button staff-wa" href={examLink} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            {t("staff.waExamButton")}
          </a>
        ) : null}
        {lessonLink ? (
          <a className="button staff-wa" href={lessonLink} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            {t("staff.waLessonButton")}
          </a>
        ) : null}
        {student.examDate ? (
          <button
            type="button"
            className="button button-ghost"
            onClick={() =>
              downloadIcs(
                {
                  uid: `exam-${student.id}@ldt`,
                  title: t("staff.icsExamTitle", { name: student.displayName }),
                  description: schoolName,
                  location,
                  start: student.examDate ?? "",
                  durationMinutes: 60
                },
                `exam-${safeName}.ics`
              )
            }
          >
            <CalendarPlus size={18} aria-hidden="true" />
            {t("staff.icsExam")}
          </button>
        ) : null}
        {student.lessonDate ? (
          <button
            type="button"
            className="button button-ghost"
            onClick={() =>
              downloadIcs(
                {
                  uid: `lesson-${student.id}@ldt`,
                  title: t("staff.icsLessonTitle", { name: student.displayName }),
                  description: schoolName,
                  location,
                  start: student.lessonDate ?? "",
                  durationMinutes: 60
                },
                `lesson-${safeName}.ics`
              )
            }
          >
            <CalendarPlus size={18} aria-hidden="true" />
            {t("staff.icsLesson")}
          </button>
        ) : null}
        {isSchoolAdmin ? (
          <button type="button" className="button staff-button-danger" onClick={() => setConfirming(true)}>
            <Trash2 size={18} aria-hidden="true" />
            {t("staff.deleteStudent")}
          </button>
        ) : null}
      </div>
      {confirming ? (
        <ConfirmDialog
          title={t("staff.deleteStudent")}
          message={t("staff.deleteStudentConfirm", { name: student.displayName })}
          confirmLabel={t("staff.delete")}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await api(`/staff/students/${student.id}`, { method: "DELETE" });
            navigate("/staff/students", { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}
