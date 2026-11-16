/**
 * API contract shared by the server (server/) and the React app.
 * All endpoints live under /api. JSON in, JSON out. Errors: HTTP status + { error: ErrorCode, message? }.
 *
 * Auth:
 *  - Staff (super_admin / school_admin / instructor): passwordless email link -> httpOnly cookie "ldt_session".
 *  - Cloud students: invite code -> device token, sent as "Authorization: Bearer <token>".
 *  - Live-classroom participants: join -> participant token, sent as "Authorization: Bearer <token>".
 *
 * Privacy: public mode never calls the API except anonymous counters (POST /api/events) and
 * optional error reports. Nothing personal is stored unless a student joins a school with consent.
 */
import type { Lang, ProgressState, TopicId } from "../domain/types";

// ---------- shared enums ----------

export type Role = "super_admin" | "school_admin" | "instructor";
export type Plan = "starter" | "pro" | "premium";
export type SchoolStatus = "trial" | "active" | "suspended";
export type StudentStatus =
  | "lead"
  | "registered"
  | "practicing"
  | "exam_ready"
  | "passed"
  | "inactive";
export type PackageId = "theory" | "motorcycle" | "car" | "full";
export type AppointmentKind = "lesson" | "theory_exam" | "consultation";
export type AppointmentStatus = "requested" | "confirmed" | "done" | "cancelled";
export type NoteVisibility = "private" | "school";
export type ClassPhase = "lobby" | "question" | "reveal" | "ended";
export type EventKind = "visit" | "exam_completed" | "exam_passed" | "qr_scan" | "lead" | "install";

export type FeatureFlag =
  | "cloudStudents"
  | "instructorDashboard"
  | "certificates"
  | "classroom"
  | "projector"
  | "ai"
  | "leads"
  | "customDomain"
  | "advancedAnalytics"
  | "carBank";

export type FeatureFlags = Record<FeatureFlag, boolean>;

/** Default flags per plan; super admins can override per school. */
export const PLAN_FEATURES: Record<Plan, FeatureFlags> = {
  starter: {
    cloudStudents: false,
    instructorDashboard: false,
    certificates: true,
    classroom: false,
    projector: false,
    ai: false,
    leads: true,
    customDomain: false,
    advancedAnalytics: false,
    carBank: false
  },
  pro: {
    cloudStudents: true,
    instructorDashboard: true,
    certificates: true,
    classroom: false,
    projector: true,
    ai: false,
    leads: true,
    customDomain: false,
    advancedAnalytics: false,
    carBank: true
  },
  premium: {
    cloudStudents: true,
    instructorDashboard: true,
    certificates: true,
    classroom: true,
    projector: true,
    ai: true,
    leads: true,
    customDomain: true,
    advancedAnalytics: true,
    carBank: true
  }
};

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "feature_disabled"
  | "limit_reached"
  | "school_suspended"
  | "consent_required"
  | "invalid_code"
  | "expired"
  | "ai_unavailable"
  | "server_error";

export interface ApiErrorBody {
  error: ErrorCode;
  message?: string;
}

/** School-authored text: Arabic required, English/French optional. */
export interface LocalizedText {
  ar: string;
  en?: string;
  fr?: string;
}

// ---------- schools ----------

export interface SchoolBranding {
  logoUrl: string | null;
  /** CSS hex colour, e.g. "#0f766e". */
  primaryColor: string;
  accentColor: string;
}

export interface SchoolContact {
  phone: string | null;
  /** International format without "+", e.g. "9613123456". Used for wa.me links. */
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  mapUrl: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  website: string | null;
}

export interface Testimonial {
  name: string;
  text: string;
}

export interface PassRateStat {
  /** 0..100 */
  value: number;
  /** Only shown publicly when verified by a super admin. */
  verified: boolean;
  note?: string;
}

export interface SchoolLanding {
  headline: LocalizedText | null;
  about: LocalizedText | null;
  testimonials: Testimonial[];
  passRate: PassRateStat | null;
  /** Shown on the landing page: "students trained" (anonymous counter-based). */
  showStats: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  mapUrl: string | null;
  phone: string | null;
}

/** GET /api/schools/:slug — what anyone (students, landing page) can see. */
export interface PublicSchool {
  id: string;
  slug: string;
  name: LocalizedText;
  branding: SchoolBranding;
  contact: SchoolContact;
  landing: SchoolLanding;
  branches: Branch[];
  features: FeatureFlags;
  /** Anonymous counters. */
  stats: { studentsTrained: number; examsCompleted: number };
  /** Data-minimisation: whether forms ask for a phone number. */
  collectPhone: boolean;
  status: SchoolStatus;
}

/** GET /api/staff/school (school_admin) and admin endpoints. */
export interface SchoolSettings extends PublicSchool {
  plan: Plan;
  studentLimit: number | null;
  /** Delete students inactive for this many days; null = keep. */
  retentionDays: number | null;
  customDomain: string | null;
  /** Manual billing (no payment provider): ISO date the subscription is paid until. */
  paidUntil: string | null;
  billingNote: string | null;
  /** Per-school overrides on top of PLAN_FEATURES[plan]. */
  featureOverrides: Partial<FeatureFlags>;
  createdAt: string;
}

/** PUT /api/staff/school body (school_admin). Plan/limits/billing are super-admin only. */
export interface SchoolUpdate {
  name?: LocalizedText;
  branding?: SchoolBranding;
  contact?: SchoolContact;
  landing?: SchoolLanding;
  collectPhone?: boolean;
  retentionDays?: number | null;
}

// ---------- staff auth ----------

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  schoolId: string | null;
  branchId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** POST /api/auth/request-link { email } -> RequestLinkResponse. Always 200 (no account enumeration). */
export interface RequestLinkResponse {
  ok: true;
  /** Only outside production when no email provider is configured. */
  devLink?: string;
}

/** POST /api/auth/verify { token } -> sets cookie, returns MeResponse. GET /api/auth/me -> MeResponse | 401. */
export interface MeResponse {
  user: StaffUser;
  school: SchoolSettings | null;
}

// ---------- students ----------

/** Computed on the student's device from their progress and sent with each sync. */
export interface StudentMetrics {
  examsTaken: number;
  passes: number;
  bestScorePct: number | null;
  avgScorePct: number | null;
  lastScorePct: number | null;
  readiness: number;
  readinessLabel: "not_ready" | "needs_signs" | "almost" | "ready";
  coveragePct: number;
  masteryPct: number;
  signAccuracyPct: number | null;
  topicAccuracy: Partial<Record<TopicId, number>>;
  weakTopics: TopicId[];
  lastPracticeAt: number | null;
}

export interface StaffStudent {
  id: string;
  displayName: string;
  phone: string | null;
  status: StudentStatus;
  package: PackageId | null;
  branchId: string | null;
  instructorId: string | null;
  paymentNote: string | null;
  /** ISO dates */
  examDate: string | null;
  lessonDate: string | null;
  notes: string | null;
  /** Lead source / referral ref (e.g. "qr-reception"). */
  source: string | null;
  interest: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  consentAt: string | null;
  /** Has joined from a device (cloud progress available). */
  linked: boolean;
  metrics: StudentMetrics | null;
}

/** GET /api/staff/students/:id */
export interface StaffStudentDetail extends StaffStudent {
  history: { at: number; score: number; total: number; passed: boolean; mode?: string }[];
  /** Per-question wrong counts, worst first (max 20). */
  topWrong: { questionId: number; wrong: number; seen: number }[];
}

/** PATCH /api/staff/students/:id */
export interface StudentUpdate {
  displayName?: string;
  phone?: string | null;
  status?: StudentStatus;
  package?: PackageId | null;
  branchId?: string | null;
  instructorId?: string | null;
  paymentNote?: string | null;
  examDate?: string | null;
  lessonDate?: string | null;
  notes?: string | null;
}

/** POST /api/staff/students (manual registration by staff) */
export interface StudentCreate {
  displayName: string;
  phone?: string | null;
  status?: StudentStatus;
  package?: PackageId | null;
  branchId?: string | null;
  instructorId?: string | null;
}

/** GET /api/staff/overview?branchId=&instructorId= */
export interface StaffOverview {
  counts: Record<StudentStatus, number>;
  linkedStudents: number;
  ready: number;
  /** Linked students with readiness < 50 and an exam date within 14 days, or failing last 3 exams. */
  atRisk: number;
  inactive7d: number;
  avgScorePct: number | null;
  topWrong: { questionId: number; wrong: number; attempts: number; wrongRate: number }[];
  weakTopics: { topic: TopicId; accuracy: number; students: number }[];
  byBranch: { branchId: string | null; name: string; students: number; ready: number }[];
  byInstructor: { instructorId: string | null; name: string; students: number; ready: number }[];
  /** Last 30 days of anonymous counters for this school. */
  usage: { day: string; visits: number; exams: number; passes: number; leads: number; qrScans: number }[];
  /** Question ids staff flagged as confusing, with counts. */
  flagged: { questionId: number; count: number }[];
}

// ---------- invite codes ----------

export interface InviteCode {
  code: string;
  label: string | null;
  branchId: string | null;
  instructorId: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

/** POST /api/staff/invite-codes */
export interface InviteCodeCreate {
  label?: string | null;
  branchId?: string | null;
  instructorId?: string | null;
  maxUses?: number | null;
  expiresAt?: string | null;
}

// ---------- student (cloud) ----------

/** POST /api/student/join */
export interface StudentJoinRequest {
  code: string;
  displayName: string;
  phone?: string | null;
  /** Must be true; consent text version shown to the student. */
  consent: boolean;
  consentVersion: string;
}

export interface StudentSelf {
  id: string;
  displayName: string;
  phone: string | null;
  status: StudentStatus;
  examDate: string | null;
  lessonDate: string | null;
  school: PublicSchool;
}

/** Response of join and login. loginCode is only returned when (re)generated. */
export interface StudentAuthResponse {
  student: StudentSelf;
  deviceToken: string;
  loginCode?: string;
}

/** POST /api/student/login { loginCode } -> StudentAuthResponse (new device). */
/** GET /api/student/me -> StudentSelf */
/** PUT /api/student/progress { progress, metrics } -> { ok: true, savedAt } */
export interface ProgressSync {
  progress: ProgressState;
  metrics: StudentMetrics;
}
/** GET /api/student/progress -> { progress: ProgressState | null, savedAt: string | null } */
/** POST /api/student/login-code -> { loginCode } (regenerates; old one stops working) */
/** GET /api/student/export -> everything stored about the student (JSON download) */
/** DELETE /api/student/me -> { ok: true } (deletes the student and all their data) */

// ---------- leads & appointments (public forms) ----------

/** POST /api/schools/:slug/leads -> { ok: true } */
export interface LeadRequest {
  name: string;
  phone?: string | null;
  interest?: PackageId | null;
  message?: string | null;
  branchId?: string | null;
  /** Referral/QR ref from ?ref= */
  ref?: string | null;
  consent: boolean;
}

/** POST /api/schools/:slug/appointments -> { ok: true } */
export interface AppointmentRequest {
  name: string;
  phone?: string | null;
  kind: AppointmentKind;
  /** ISO datetime */
  preferredAt: string;
  branchId?: string | null;
  message?: string | null;
  consent: boolean;
}

export interface Appointment {
  id: string;
  studentId: string | null;
  name: string;
  phone: string | null;
  kind: AppointmentKind;
  preferredAt: string;
  status: AppointmentStatus;
  branchId: string | null;
  message: string | null;
  notes: string | null;
  createdAt: string;
}
/** GET /api/staff/appointments?status= -> Appointment[] ; PATCH /api/staff/appointments/:id { status?, notes?, preferredAt? } */

// ---------- question notes & flags ----------

export interface QuestionNote {
  id: string;
  questionId: number;
  visibility: NoteVisibility;
  body: string;
  /** Optional link to a short video explanation. */
  videoUrl: string | null;
  authorName: string;
  createdAt: string;
}
/** GET /api/staff/question-notes?questionId= ; POST { questionId, visibility, body, videoUrl? } ; DELETE /:id */
/** GET /api/schools/:slug/question-notes -> { notes: Pick<QuestionNote, "questionId" | "body" | "videoUrl">[] } (school-visible only) */
/** POST /api/staff/question-flags { questionId, reason } -> { ok: true } */

// ---------- live classroom ----------

/** POST /api/staff/classroom { questionIds, anonymous } -> ClassroomHostState */
export interface ClassroomCreate {
  questionIds: number[];
  anonymous: boolean;
}

export interface ClassroomHostState {
  code: string;
  phase: ClassPhase;
  index: number;
  total: number;
  questionId: number | null;
  anonymous: boolean;
  participants: { id: string; name: string; score: number; answered: boolean }[];
  /** Answer counts per option for the current question. */
  distribution: number[];
  answeredCount: number;
  leaderboard: { name: string; score: number }[];
}
/** GET /api/staff/classroom/:code -> ClassroomHostState */
/** POST /api/staff/classroom/:code/advance { action: "start" | "reveal" | "next" | "end" } -> ClassroomHostState */
/** GET /api/staff/classroom/:code/export.csv */

export interface ClassroomPlayerState {
  code: string;
  phase: ClassPhase;
  index: number;
  total: number;
  questionId: number | null;
  myAnswer: number | null;
  /** Only during "reveal" and "ended". */
  correct: number | null;
  myScore: number;
  myName: string;
  leaderboard: { name: string; score: number }[];
}
/** POST /api/live/:code/join { name? } -> { participantToken, state: ClassroomPlayerState } */
/** GET /api/live/:code/state (Bearer participant) -> ClassroomPlayerState */
/** POST /api/live/:code/answer { selected } (Bearer participant) -> ClassroomPlayerState */

// ---------- staff users & branches ----------

/** GET/POST/PATCH/DELETE /api/staff/branches[/:id] — body: Omit<Branch, "id"> */
/** GET /api/staff/users ; POST { email, name, role: "school_admin" | "instructor", branchId? } ; PATCH /:id ; DELETE /:id */
export interface StaffUserCreate {
  email: string;
  name: string;
  role: "school_admin" | "instructor";
  branchId?: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorEmail: string | null;
  schoolId: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
}
/** GET /api/staff/audit-log -> AuditEntry[] (school_admin) ; GET /api/admin/audit-log (super_admin) */
/** GET /api/staff/export -> full school data JSON ; GET /api/staff/export/students.csv */

// ---------- super admin ----------

export interface AdminSchoolRow extends SchoolSettings {
  usage: { students: number; linkedStudents: number; exams30d: number; leads30d: number; staff: number };
}

/** POST /api/admin/schools */
export interface SchoolCreate {
  slug: string;
  name: LocalizedText;
  plan: Plan;
  status?: SchoolStatus;
  adminEmail?: string | null;
  adminName?: string | null;
}

/** PATCH /api/admin/schools/:id */
export interface AdminSchoolUpdate extends SchoolUpdate {
  slug?: string;
  plan?: Plan;
  status?: SchoolStatus;
  studentLimit?: number | null;
  customDomain?: string | null;
  paidUntil?: string | null;
  billingNote?: string | null;
  featureOverrides?: Partial<FeatureFlags>;
  landing?: SchoolLanding;
}
/** DELETE /api/admin/schools/:id — deletes the school and all its data */
/** GET /api/admin/usage -> { totals: {schools, students, exams30d, leads30d}, daily: {day, exams, visits, leads}[] } */
/** GET /api/admin/errors -> ErrorReport[] */

export interface ErrorReport {
  id: string;
  at: string;
  message: string;
  stack: string | null;
  path: string | null;
  release: string | null;
  count: number;
}

// ---------- misc public ----------

/** POST /api/events { kind, schoolSlug?, ref? } -> 204. Anonymous counters only. */
export interface EventRequest {
  kind: EventKind;
  schoolSlug?: string | null;
  ref?: string | null;
}

/** POST /api/errors { message, stack?, path?, release? } -> 204 */
/** GET /api/schools/by-host?host= -> { slug } | 404 (custom domains) */
/** GET /api/health -> { ok: true, ai: boolean, email: boolean } */

// ---------- AI ----------

/** POST /api/ai/explain -> { text }. 503 ai_unavailable when no API key; 403 feature_disabled per school. */
export interface AiExplainRequest {
  questionId: number;
  selected?: number | null;
  style: "simple" | "nervous";
  lang: Lang;
  schoolSlug?: string | null;
}
/** POST /api/staff/ai/instructor-note { questionId, lang } -> { text } */
