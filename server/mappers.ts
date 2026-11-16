import type {
  Appointment,
  AppointmentKind,
  AppointmentStatus,
  AuditEntry,
  Branch,
  ErrorReport,
  InviteCode,
  LocalizedText,
  PackageId,
  PublicSchool,
  SchoolBranding,
  SchoolContact,
  SchoolLanding,
  SchoolSettings,
  StaffStudent,
  StaffStudentDetail,
  StaffUser,
  StudentSelf
} from "../src/api/types.js";
import { iso, isoRequired, type Db } from "./db.js";
import { effectiveFeatures, type BranchRow, type SchoolRow, type StudentRow, type UserRow } from "./context.js";

export const DEFAULT_BRANDING: SchoolBranding = {
  logoUrl: null,
  primaryColor: "#0f766e",
  accentColor: "#255f85"
};

export const EMPTY_CONTACT: SchoolContact = {
  phone: null,
  whatsapp: null,
  email: null,
  address: null,
  mapUrl: null,
  instagram: null,
  tiktok: null,
  facebook: null,
  website: null
};

export const EMPTY_LANDING: SchoolLanding = {
  headline: null,
  about: null,
  testimonials: [],
  passRate: null,
  showStats: true
};

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function toBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    mapUrl: row.map_url,
    phone: row.phone
  };
}

export async function schoolStats(db: Db, schoolId: string) {
  const [students] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM students WHERE school_id = $1 AND status <> 'lead'`,
    [schoolId]
  );
  const [exams] = await db.query<{ n: number }>(
    `SELECT coalesce(sum(count), 0)::int AS n FROM events WHERE school_id = $1 AND kind = 'exam_completed'`,
    [schoolId]
  );
  return { studentsTrained: students?.n ?? 0, examsCompleted: exams?.n ?? 0 };
}

export async function schoolSettings(db: Db, school: SchoolRow): Promise<SchoolSettings> {
  const branches = await db.query<BranchRow>(
    `SELECT * FROM branches WHERE school_id = $1 ORDER BY created_at, name`,
    [school.id]
  );
  const landing = { ...EMPTY_LANDING, ...obj(school.landing) } as SchoolLanding;
  return {
    id: school.id,
    slug: school.slug,
    name: { ar: "", ...obj(school.name) } as LocalizedText,
    branding: { ...DEFAULT_BRANDING, ...obj(school.branding) } as SchoolBranding,
    contact: { ...EMPTY_CONTACT, ...obj(school.contact) } as SchoolContact,
    landing: { ...landing, testimonials: Array.isArray(landing.testimonials) ? landing.testimonials : [] },
    branches: branches.map(toBranch),
    features: effectiveFeatures(school),
    stats: await schoolStats(db, school.id),
    collectPhone: Boolean(school.collect_phone),
    status: school.status,
    plan: school.plan,
    studentLimit: school.student_limit,
    retentionDays: school.retention_days,
    customDomain: school.custom_domain,
    paidUntil: school.paid_until,
    billingNote: school.billing_note,
    featureOverrides: school.feature_overrides ?? {},
    createdAt: isoRequired(school.created_at)
  };
}

/** What anyone may see. Unverified pass rates are hidden. */
export async function publicSchool(db: Db, school: SchoolRow): Promise<PublicSchool> {
  const settings = await schoolSettings(db, school);
  const landing = { ...settings.landing };
  if (!landing.passRate?.verified) landing.passRate = null;
  return {
    id: settings.id,
    slug: settings.slug,
    name: settings.name,
    branding: settings.branding,
    contact: settings.contact,
    landing,
    branches: settings.branches,
    features: settings.features,
    stats: settings.stats,
    collectPhone: settings.collectPhone,
    status: settings.status
  };
}

export function toStaffUser(row: UserRow): StaffUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    schoolId: row.school_id,
    branchId: row.branch_id,
    lastLoginAt: iso(row.last_login_at),
    createdAt: isoRequired(row.created_at)
  };
}

export function toStaffStudent(row: StudentRow, withMetrics: boolean): StaffStudent {
  return {
    id: row.id,
    displayName: row.display_name,
    phone: row.phone,
    status: row.status,
    package: (row.package as PackageId | null) ?? null,
    branchId: row.branch_id,
    instructorId: row.instructor_id,
    paymentNote: row.payment_note,
    examDate: row.exam_date,
    lessonDate: row.lesson_date,
    notes: row.notes,
    source: row.source,
    interest: row.interest,
    createdAt: isoRequired(row.created_at),
    lastActiveAt: iso(row.last_active_at),
    consentAt: iso(row.consent_at),
    linked: row.linked_at !== null && row.linked_at !== undefined,
    metrics: withMetrics ? (row.metrics ?? null) : null
  };
}

export function toStaffStudentDetail(row: StudentRow, withMetrics: boolean): StaffStudentDetail {
  const base = toStaffStudent(row, withMetrics);
  const progress = withMetrics ? row.progress : null;
  const history = Array.isArray(progress?.history)
    ? progress.history.map((item) => ({
        at: Number(item.at) || 0,
        score: Number(item.score) || 0,
        total: Number(item.total) || 0,
        passed: Boolean(item.passed),
        ...(item.mode ? { mode: String(item.mode) } : {})
      }))
    : [];
  const topWrong = Object.entries(obj(progress?.questions))
    .map(([id, value]) => {
      const stat = obj(value);
      return { questionId: Number(id), wrong: Number(stat.wrong) || 0, seen: Number(stat.seen) || 0 };
    })
    .filter((item) => item.wrong > 0 && Number.isFinite(item.questionId))
    .sort((a, b) => b.wrong - a.wrong || b.seen - a.seen)
    .slice(0, 20);
  return { ...base, history, topWrong };
}

export async function studentSelf(db: Db, row: StudentRow, school: SchoolRow): Promise<StudentSelf> {
  return {
    id: row.id,
    displayName: row.display_name,
    phone: row.phone,
    status: row.status,
    examDate: row.exam_date,
    lessonDate: row.lesson_date,
    school: await publicSchool(db, school)
  };
}

export interface InviteRow {
  code: string;
  school_id: string;
  label: string | null;
  branch_id: string | null;
  instructor_id: string | null;
  max_uses: number | null;
  uses: number;
  expires_at: unknown;
  active: boolean;
  created_at: unknown;
}

export function toInvite(row: InviteRow): InviteCode {
  return {
    code: row.code,
    label: row.label,
    branchId: row.branch_id,
    instructorId: row.instructor_id,
    maxUses: row.max_uses,
    uses: row.uses,
    expiresAt: iso(row.expires_at),
    active: Boolean(row.active),
    createdAt: isoRequired(row.created_at)
  };
}

export interface AppointmentRow {
  id: string;
  school_id: string;
  student_id: string | null;
  name: string;
  phone: string | null;
  kind: AppointmentKind;
  preferred_at: string;
  status: AppointmentStatus;
  branch_id: string | null;
  message: string | null;
  notes: string | null;
  consent_at: unknown;
  created_at: unknown;
}

export function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    phone: row.phone,
    kind: row.kind,
    preferredAt: row.preferred_at,
    status: row.status,
    branchId: row.branch_id,
    message: row.message,
    notes: row.notes,
    createdAt: isoRequired(row.created_at)
  };
}

export interface AuditRow {
  id: string;
  at: unknown;
  actor_email: string | null;
  school_id: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
}

export function toAudit(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    at: isoRequired(row.at),
    actorEmail: row.actor_email,
    schoolId: row.school_id,
    action: row.action,
    target: row.target,
    meta: row.meta ?? null
  };
}

export interface ErrorRow {
  id: string;
  at: unknown;
  message: string;
  stack: string | null;
  path: string | null;
  release: string | null;
  count: number;
}

export function toErrorReport(row: ErrorRow): ErrorReport {
  return {
    id: row.id,
    at: isoRequired(row.at),
    message: row.message,
    stack: row.stack,
    path: row.path,
    release: row.release,
    count: row.count
  };
}
