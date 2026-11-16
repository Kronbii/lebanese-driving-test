import type {
  AppointmentKind,
  AppointmentStatus,
  ClassPhase,
  FeatureFlag,
  PackageId,
  Plan,
  Role,
  SchoolStatus,
  StudentMetrics,
  StudentStatus
} from "../../../api/types";

export type Tone = "" | "success" | "danger" | "warning" | "info";

export const STUDENT_STATUSES: StudentStatus[] = [
  "lead",
  "registered",
  "practicing",
  "exam_ready",
  "passed",
  "inactive"
];

export const STATUS_KEYS: Record<StudentStatus, string> = {
  lead: "staff.status_lead",
  registered: "staff.status_registered",
  practicing: "staff.status_practicing",
  exam_ready: "staff.status_exam_ready",
  passed: "staff.status_passed",
  inactive: "staff.status_inactive"
};

export const STATUS_TONES: Record<StudentStatus, Tone> = {
  lead: "info",
  registered: "",
  practicing: "warning",
  exam_ready: "success",
  passed: "success",
  inactive: "danger"
};

export const PACKAGES: PackageId[] = ["theory", "motorcycle", "car", "full"];

export const PACKAGE_KEYS: Record<PackageId, string> = {
  theory: "staff.package_theory",
  motorcycle: "staff.package_motorcycle",
  car: "staff.package_car",
  full: "staff.package_full"
};

export function isPackageId(value: unknown): value is PackageId {
  return typeof value === "string" && (PACKAGES as string[]).includes(value);
}

export type ReadinessLabel = StudentMetrics["readinessLabel"];

export const READINESS_KEYS: Record<ReadinessLabel, string> = {
  not_ready: "staff.readiness_not_ready",
  needs_signs: "staff.readiness_needs_signs",
  almost: "staff.readiness_almost",
  ready: "staff.readiness_ready"
};

export const READINESS_TONES: Record<ReadinessLabel, Tone> = {
  not_ready: "danger",
  needs_signs: "warning",
  almost: "info",
  ready: "success"
};

export const ROLE_KEYS: Record<Role, string> = {
  super_admin: "staff.role_super_admin",
  school_admin: "staff.role_school_admin",
  instructor: "staff.role_instructor"
};

export const APPOINTMENT_STATUSES: AppointmentStatus[] = ["requested", "confirmed", "done", "cancelled"];

export const APPOINTMENT_STATUS_KEYS: Record<AppointmentStatus, string> = {
  requested: "staff.appt_requested",
  confirmed: "staff.appt_confirmed",
  done: "staff.appt_done",
  cancelled: "staff.appt_cancelled"
};

export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, Tone> = {
  requested: "warning",
  confirmed: "info",
  done: "success",
  cancelled: ""
};

export const APPOINTMENT_KIND_KEYS: Record<AppointmentKind, string> = {
  lesson: "staff.apptKind_lesson",
  theory_exam: "staff.apptKind_theory_exam",
  consultation: "staff.apptKind_consultation"
};

export const PLANS: Plan[] = ["starter", "pro", "premium"];

export const PLAN_KEYS: Record<Plan, string> = {
  starter: "staff.plan_starter",
  pro: "staff.plan_pro",
  premium: "staff.plan_premium"
};

export const SCHOOL_STATUSES: SchoolStatus[] = ["trial", "active", "suspended"];

export const SCHOOL_STATUS_KEYS: Record<SchoolStatus, string> = {
  trial: "staff.schoolStatus_trial",
  active: "staff.schoolStatus_active",
  suspended: "staff.schoolStatus_suspended"
};

export const SCHOOL_STATUS_TONES: Record<SchoolStatus, Tone> = {
  trial: "info",
  active: "success",
  suspended: "danger"
};

export const FEATURE_FLAGS: FeatureFlag[] = [
  "cloudStudents",
  "instructorDashboard",
  "certificates",
  "classroom",
  "projector",
  "ai",
  "leads",
  "customDomain",
  "advancedAnalytics",
  "carBank"
];

export const FEATURE_KEYS: Record<FeatureFlag, string> = {
  cloudStudents: "staff.feature_cloudStudents",
  instructorDashboard: "staff.feature_instructorDashboard",
  certificates: "staff.feature_certificates",
  classroom: "staff.feature_classroom",
  projector: "staff.feature_projector",
  ai: "staff.feature_ai",
  leads: "staff.feature_leads",
  customDomain: "staff.feature_customDomain",
  advancedAnalytics: "staff.feature_advancedAnalytics",
  carBank: "staff.feature_carBank"
};

export const PHASE_KEYS: Record<ClassPhase, string> = {
  lobby: "staff.phase_lobby",
  question: "staff.phase_question",
  reveal: "staff.phase_reveal",
  ended: "staff.phase_ended"
};

export function scoreTone(pct: number | null | undefined): Tone {
  if (pct === null || pct === undefined) return "";
  if (pct >= 83) return "success";
  if (pct >= 65) return "warning";
  return "danger";
}

export function meterTone(pct: number): "success" | "warning" | "danger" {
  if (pct >= 80) return "success";
  if (pct >= 55) return "warning";
  return "danger";
}
