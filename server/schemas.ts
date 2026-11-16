import { z } from "zod";

/** Request body validation. Mirrors src/api/types.ts (kept permissive where the client owns the shape). */

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const id = z.string().min(1).max(64);
const optId = id.nullable().optional();

const parseableDate = (value: string) => !Number.isNaN(new Date(value).getTime());
/** ISO date or datetime ("2026-12-01" or "2026-12-01T09:00"). */
const isoDate = z
  .string()
  .trim()
  .max(40)
  .regex(/^\d{4}-\d{2}-\d{2}/, "expected ISO date")
  .refine(parseableDate, "invalid date");

export const roleEnum = z.enum(["super_admin", "school_admin", "instructor"]);
export const planEnum = z.enum(["starter", "pro", "premium"]);
export const schoolStatusEnum = z.enum(["trial", "active", "suspended"]);
export const studentStatusEnum = z.enum([
  "lead",
  "registered",
  "practicing",
  "exam_ready",
  "passed",
  "inactive"
]);
export const packageEnum = z.enum(["theory", "motorcycle", "car", "full"]);
export const appointmentKindEnum = z.enum(["lesson", "theory_exam", "consultation"]);
export const appointmentStatusEnum = z.enum(["requested", "confirmed", "done", "cancelled"]);
export const langEnum = z.enum(["ar", "en", "fr"]);
export const eventKindEnum = z.enum(["visit", "exam_completed", "exam_passed", "qr_scan", "lead", "install"]);

const featureFlagShape = {
  cloudStudents: z.boolean().optional(),
  instructorDashboard: z.boolean().optional(),
  certificates: z.boolean().optional(),
  classroom: z.boolean().optional(),
  projector: z.boolean().optional(),
  ai: z.boolean().optional(),
  leads: z.boolean().optional(),
  customDomain: z.boolean().optional(),
  advancedAnalytics: z.boolean().optional(),
  carBank: z.boolean().optional()
};

export const localizedText = (max: number) =>
  z.object({
    ar: text(max),
    en: text(max).optional(),
    fr: text(max).optional()
  });

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected #rrggbb");
const urlish = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:image/"), "expected URL");

export const brandingSchema = z.object({
  logoUrl: urlish.nullable(),
  primaryColor: hexColor,
  accentColor: hexColor
});

export const contactSchema = z.object({
  phone: optText(40).transform((v) => v ?? null),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{6,16}$/, "digits only, international format without +")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  email: optText(200).transform((v) => v ?? null),
  address: optText(300).transform((v) => v ?? null),
  mapUrl: urlish.nullable().optional().transform((v) => v ?? null),
  instagram: optText(200).transform((v) => v ?? null),
  tiktok: optText(200).transform((v) => v ?? null),
  facebook: optText(200).transform((v) => v ?? null),
  website: optText(300).transform((v) => v ?? null)
});

export const landingSchema = z.object({
  headline: localizedText(200).nullable(),
  about: localizedText(4000).nullable(),
  testimonials: z.array(z.object({ name: text(80), text: text(600) })).max(20),
  passRate: z
    .object({
      value: z.number().min(0).max(100),
      verified: z.boolean(),
      note: text(300).optional()
    })
    .nullable(),
  showStats: z.boolean()
});

export const schoolUpdateSchema = z.object({
  name: localizedText(120).refine((value) => value.ar.length > 0, "Arabic name required").optional(),
  branding: brandingSchema.optional(),
  contact: contactSchema.optional(),
  landing: landingSchema.optional(),
  collectPhone: z.boolean().optional(),
  retentionDays: z.number().int().min(1).max(3650).nullable().optional()
});

const RESERVED_SLUGS = new Set(["by-host", "admin", "api", "staff", "student", "live", "app", "www"]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "slug: lowercase letters, digits and dashes")
  .refine((value) => !RESERVED_SLUGS.has(value), "reserved slug");

const hostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, "expected a host name like school.example.com");

export const adminSchoolUpdateSchema = schoolUpdateSchema.extend({
  slug: slugSchema.optional(),
  plan: planEnum.optional(),
  status: schoolStatusEnum.optional(),
  studentLimit: z.number().int().min(1).max(100_000).nullable().optional(),
  customDomain: hostSchema.nullable().optional(),
  paidUntil: isoDate.nullable().optional(),
  billingNote: optText(1000),
  featureOverrides: z.object(featureFlagShape).optional()
});

export const schoolCreateSchema = z.object({
  slug: slugSchema,
  name: localizedText(120).refine((value) => value.ar.length > 0, "Arabic name required"),
  plan: planEnum,
  status: schoolStatusEnum.optional(),
  adminEmail: z.email().max(200).nullable().optional(),
  adminName: optText(120)
});

export const branchSchema = z.object({
  name: text(120).min(1),
  address: optText(300),
  mapUrl: urlish.nullable().optional(),
  phone: optText(40)
});

export const branchPatchSchema = branchSchema.partial();

export const emailSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(200)) });
export const tokenSchema = z.object({ token: z.string().min(10).max(200) });

export const staffUserCreateSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
  name: text(120).min(1),
  role: z.enum(["school_admin", "instructor"]),
  branchId: optId
});

export const staffUserPatchSchema = z.object({
  name: text(120).min(1).optional(),
  role: z.enum(["school_admin", "instructor"]).optional(),
  branchId: optId
});

export const inviteCreateSchema = z.object({
  label: optText(80),
  branchId: optId,
  instructorId: optId,
  maxUses: z.number().int().min(1).max(100_000).nullable().optional(),
  expiresAt: isoDate.nullable().optional()
});

export const invitePatchSchema = inviteCreateSchema.extend({ active: z.boolean().optional() });

export const studentCreateSchema = z.object({
  displayName: text(80).min(1),
  phone: optText(40),
  status: studentStatusEnum.optional(),
  package: packageEnum.nullable().optional(),
  branchId: optId,
  instructorId: optId
});

export const studentUpdateSchema = z.object({
  displayName: text(80).min(1).optional(),
  phone: optText(40),
  status: studentStatusEnum.optional(),
  package: packageEnum.nullable().optional(),
  branchId: optId,
  instructorId: optId,
  paymentNote: optText(500),
  examDate: isoDate.nullable().optional(),
  lessonDate: isoDate.nullable().optional(),
  notes: optText(4000)
});

export const joinSchema = z.object({
  code: z.string().trim().min(3).max(32),
  displayName: text(80).min(1),
  phone: optText(40),
  consent: z.boolean(),
  consentVersion: text(40).min(1)
});

export const loginSchema = z.object({ loginCode: z.string().trim().min(6).max(32) });

/** Permissive ProgressState check: structure only; the client owns the details. */
export const progressSchema = z.looseObject({
  version: z.number(),
  examIndex: z.number(),
  questions: z.record(z.string(), z.looseObject({ seen: z.number(), correct: z.number(), wrong: z.number() })),
  history: z
    .array(z.looseObject({ at: z.number(), score: z.number(), total: z.number(), passed: z.boolean() }))
    .max(5000),
  favorites: z.array(z.number()),
  notes: z.record(z.string(), z.string()),
  flashcards: z.record(z.string(), z.unknown()),
  activity: z.record(z.string(), z.unknown()),
  xp: z.number(),
  badges: z.record(z.string(), z.number()),
  updatedAt: z.number()
});

const pct = z.number().min(0).max(100);

export const metricsSchema = z.looseObject({
  examsTaken: z.number().int().min(0),
  passes: z.number().int().min(0),
  bestScorePct: pct.nullable(),
  avgScorePct: pct.nullable(),
  lastScorePct: pct.nullable(),
  readiness: z.number().min(0).max(100),
  readinessLabel: z.enum(["not_ready", "needs_signs", "almost", "ready"]),
  coveragePct: pct,
  masteryPct: pct,
  signAccuracyPct: pct.nullable(),
  topicAccuracy: z.record(z.string(), z.number()),
  weakTopics: z.array(z.string()).max(20),
  lastPracticeAt: z.number().nullable()
});

export const progressSyncSchema = z.object({ progress: progressSchema, metrics: metricsSchema });

export const leadSchema = z.object({
  name: text(80).min(1),
  phone: optText(40),
  interest: packageEnum.nullable().optional(),
  message: optText(1000),
  branchId: optId,
  ref: optText(64),
  consent: z.boolean()
});

export const appointmentSchema = z.object({
  name: text(80).min(1),
  phone: optText(40),
  kind: appointmentKindEnum,
  preferredAt: z.string().trim().max(40).refine(parseableDate, "invalid datetime"),
  branchId: optId,
  message: optText(1000),
  consent: z.boolean()
});

export const appointmentPatchSchema = z.object({
  status: appointmentStatusEnum.optional(),
  notes: optText(4000),
  preferredAt: z.string().trim().max(40).refine(parseableDate, "invalid datetime").optional()
});

export const noteCreateSchema = z.object({
  questionId: z.number().int().positive(),
  visibility: z.enum(["private", "school"]),
  body: text(4000).min(1),
  videoUrl: urlish.nullable().optional()
});

export const flagCreateSchema = z.object({
  questionId: z.number().int().positive(),
  reason: optText(500)
});

export const classroomCreateSchema = z.object({
  questionIds: z.array(z.number().int().positive()).min(1).max(100),
  anonymous: z.boolean()
});

export const advanceSchema = z.object({ action: z.enum(["start", "reveal", "next", "end"]) });
export const liveJoinSchema = z.object({ name: optText(40) });
export const liveAnswerSchema = z.object({ selected: z.number().int().min(0).max(9) });

export const eventSchema = z.object({
  kind: eventKindEnum,
  schoolSlug: z.string().trim().max(64).nullable().optional(),
  ref: z.string().max(200).nullable().optional()
});

export const errorReportSchema = z.object({
  message: z.string().max(2000).min(1),
  stack: z.string().max(10_000).nullable().optional(),
  path: z.string().max(500).nullable().optional(),
  release: z.string().max(100).nullable().optional()
});

export const aiExplainSchema = z.object({
  questionId: z.number().int().positive(),
  selected: z.number().int().min(0).max(9).nullable().optional(),
  style: z.enum(["simple", "nervous"]),
  lang: langEnum,
  schoolSlug: z.string().trim().max(64).nullable().optional()
});

export const instructorNoteSchema = z.object({
  questionId: z.number().int().positive(),
  lang: langEnum
});
