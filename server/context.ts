import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { z } from "zod";
import type {
  FeatureFlag,
  FeatureFlags,
  Plan,
  Role,
  SchoolStatus,
  StudentMetrics,
  StudentStatus
} from "../src/api/types.js";
import { PLAN_FEATURES } from "../src/api/types.js";
import type { ProgressState } from "../src/domain/types.js";
import { json, type Db } from "./db.js";
import { Fail, RATE_RULES, newId, sha256, type Env, type RateLimiter, type RateRuleName } from "./lib.js";

// ---------- dependencies ----------

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendEmail = (message: EmailMessage) => Promise<void>;

export interface AiRequest {
  system: string;
  prompt: string;
}

/** Returns the model's plain-text reply. Injected in tests. */
export type AiComplete = (request: AiRequest) => Promise<string>;

export interface AppDeps {
  db: Db;
  env: Env;
  now: () => Date;
  /** null -> no email provider configured. */
  sendEmail: SendEmail | null;
  /** null -> AI unavailable (no API key). */
  ai: AiComplete | null;
  rateLimit: boolean;
  limiter: RateLimiter;
}

// ---------- rows ----------

export interface SchoolRow {
  id: string;
  slug: string;
  name: unknown;
  branding: unknown;
  contact: unknown;
  landing: unknown;
  plan: Plan;
  status: SchoolStatus;
  student_limit: number | null;
  retention_days: number | null;
  custom_domain: string | null;
  paid_until: string | null;
  billing_note: string | null;
  feature_overrides: Partial<FeatureFlags> | null;
  collect_phone: boolean;
  created_at: unknown;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  school_id: string | null;
  branch_id: string | null;
  last_login_at: unknown;
  created_at: unknown;
}

export interface StudentRow {
  id: string;
  school_id: string;
  display_name: string;
  phone: string | null;
  status: StudentStatus;
  package: string | null;
  branch_id: string | null;
  instructor_id: string | null;
  payment_note: string | null;
  exam_date: string | null;
  lesson_date: string | null;
  notes: string | null;
  source: string | null;
  interest: string | null;
  consent_at: unknown;
  consent_version: string | null;
  login_code_hash: string | null;
  linked_at: unknown;
  progress: ProgressState | null;
  metrics: StudentMetrics | null;
  progress_saved_at: unknown;
  last_active_at: unknown;
  created_at: unknown;
}

export interface BranchRow {
  id: string;
  school_id: string;
  name: string;
  address: string | null;
  map_url: string | null;
  phone: string | null;
  created_at: unknown;
}

// ---------- Hono env ----------

export interface Vars {
  deps: AppDeps;
  staff: UserRow | null;
}

export type HonoEnv = { Variables: Vars };
export type Ctx = Context<HonoEnv>;

export const depsOf = (c: Ctx) => c.get("deps");
export const dbOf = (c: Ctx) => c.get("deps").db;
export const nowOf = (c: Ctx) => c.get("deps").now();

// ---------- request helpers ----------

export function clientIp(c: Ctx): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return c.req.header("x-real-ip") ?? "local";
}

export function rateLimit(c: Ctx, name: RateRuleName, extraKey = "") {
  const deps = depsOf(c);
  if (!deps.rateLimit) return;
  const key = `${name}:${clientIp(c)}:${extraKey}`;
  if (!deps.limiter.check(key, RATE_RULES[name], deps.now().getTime())) {
    throw new Fail("rate_limited");
  }
}

/** Reads and validates a JSON body. Bad JSON / schema errors -> 400 bad_request. */
export async function readBody<S extends z.ZodType>(
  c: Ctx,
  schema: S,
  maxBytes = 64_000
): Promise<z.infer<S>> {
  let text: string;
  try {
    text = await c.req.text();
  } catch {
    throw new Fail("bad_request", "unreadable body");
  }
  if (text.length > maxBytes) throw new Fail("bad_request", "body too large", 413);
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Fail("bad_request", "invalid json");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    throw new Fail("bad_request", `${where}${issue?.message ?? "invalid body"}`);
  }
  return parsed.data;
}

// ---------- features ----------

export function effectiveFeatures(school: Pick<SchoolRow, "plan" | "feature_overrides">): FeatureFlags {
  const base = PLAN_FEATURES[school.plan] ?? PLAN_FEATURES.starter;
  const overrides = school.feature_overrides ?? {};
  const merged = { ...base };
  for (const key of Object.keys(base) as FeatureFlag[]) {
    const value = overrides[key];
    if (typeof value === "boolean") merged[key] = value;
  }
  return merged;
}

export function requireFeature(school: SchoolRow, flag: FeatureFlag) {
  if (!effectiveFeatures(school)[flag]) throw new Fail("feature_disabled", flag);
}

export function requireActive(school: SchoolRow) {
  if (school.status === "suspended") throw new Fail("school_suspended");
}

// ---------- loaders ----------

export async function schoolById(db: Db, id: string): Promise<SchoolRow | null> {
  const rows = await db.query<SchoolRow>(`SELECT * FROM schools WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function schoolBySlug(db: Db, slug: string): Promise<SchoolRow | null> {
  const rows = await db.query<SchoolRow>(`SELECT * FROM schools WHERE slug = $1`, [
    slug.toLowerCase()
  ]);
  return rows[0] ?? null;
}

export async function requireSchoolBySlug(c: Ctx, slug: string): Promise<SchoolRow> {
  const school = await schoolBySlug(dbOf(c), slug);
  if (!school) throw new Fail("not_found", "school");
  return school;
}

// ---------- staff auth ----------

export const SESSION_COOKIE = "ldt_session";

export async function loadStaff(c: Ctx): Promise<UserRow | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const rows = await dbOf(c).query<UserRow>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [sha256(token), nowOf(c).toISOString()]
  );
  return rows[0] ?? null;
}

export function staffOf(c: Ctx): UserRow {
  const user = c.get("staff");
  if (!user) throw new Fail("unauthorized");
  return user;
}

export function requireRole(c: Ctx, ...roles: Role[]): UserRow {
  const user = staffOf(c);
  if (user.role !== "super_admin" && !roles.includes(user.role)) throw new Fail("forbidden");
  return user;
}

/**
 * The school a /staff request acts on: the user's own school, or for super admins the
 * `schoolId` query param / `X-School-Id` header.
 */
export async function staffSchool(c: Ctx): Promise<SchoolRow> {
  const user = staffOf(c);
  let schoolId = user.school_id;
  if (user.role === "super_admin") {
    schoolId = c.req.query("schoolId") ?? c.req.header("x-school-id") ?? user.school_id;
    if (!schoolId) throw new Fail("bad_request", "schoolId required for super admin");
  }
  if (!schoolId) throw new Fail("forbidden", "no school");
  const school = await schoolById(dbOf(c), schoolId);
  if (!school) throw new Fail("not_found", "school");
  return school;
}

// ---------- student auth ----------

export function bearer(c: Ctx): string | null {
  const header = c.req.header("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}

export async function requireStudent(c: Ctx): Promise<{ student: StudentRow; school: SchoolRow }> {
  const token = bearer(c);
  if (!token) throw new Fail("unauthorized");
  const db = dbOf(c);
  const rows = await db.query<StudentRow & { token_id: string }>(
    `SELECT s.*, d.id AS token_id FROM device_tokens d JOIN students s ON s.id = d.student_id
     WHERE d.token_hash = $1`,
    [sha256(token)]
  );
  const student = rows[0];
  if (!student) throw new Fail("unauthorized");
  const school = await schoolById(db, student.school_id);
  if (!school) throw new Fail("unauthorized");
  await db.query(`UPDATE device_tokens SET last_used_at = $2 WHERE id = $1`, [
    student.token_id,
    nowOf(c).toISOString()
  ]);
  return { student, school };
}

// ---------- audit ----------

export async function audit(
  c: Ctx,
  action: string,
  options: { schoolId?: string | null; target?: string | null; meta?: Record<string, unknown> | null; actorEmail?: string | null } = {}
) {
  const actor = options.actorEmail !== undefined ? options.actorEmail : (c.get("staff")?.email ?? null);
  await dbOf(c).query(
    `INSERT INTO audit_log (id, at, actor_email, school_id, action, target, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb)`,
    [
      newId(),
      nowOf(c).toISOString(),
      actor,
      options.schoolId ?? null,
      action,
      options.target ?? null,
      json(options.meta ?? null)
    ]
  );
}
