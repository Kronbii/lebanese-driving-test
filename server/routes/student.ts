import { Hono } from "hono";
import type { StudentAuthResponse } from "../../src/api/types";
import {
  audit,
  dbOf,
  nowOf,
  rateLimit,
  readBody,
  requireActive,
  requireFeature,
  requireStudent,
  schoolById,
  type Ctx,
  type HonoEnv,
  type SchoolRow,
  type StudentRow
} from "../context";
import { iso, isoRequired, json, type Db } from "../db";
import { Fail, formatLoginCode, newId, normalizeCode, randomCode, randomToken, sha256 } from "../lib";
import { studentSelf, type AppointmentRow, type InviteRow } from "../mappers";
import { joinSchema, loginSchema, progressSyncSchema } from "../schemas";
import { assertStudentCapacity, deleteStudentData } from "../services";

const MAX_PROGRESS_BYTES = 300_000;
const LOGIN_CODE_LENGTH = 10;

async function issueDeviceToken(db: Db, studentId: string, now: Date): Promise<string> {
  const token = randomToken(32);
  await db.query(
    `INSERT INTO device_tokens (id, student_id, token_hash, last_used_at, created_at) VALUES ($1, $2, $3, $4, $4)`,
    [newId(), studentId, sha256(token), now.toISOString()]
  );
  return token;
}

/** Generates a fresh login code (old one stops working). Returns the display form. */
export async function issueLoginCode(db: Db, studentId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(LOGIN_CODE_LENGTH);
    try {
      await db.query(`UPDATE students SET login_code_hash = $2 WHERE id = $1`, [studentId, sha256(code)]);
      return formatLoginCode(code);
    } catch {
      // Unique collision (astronomically unlikely): retry.
    }
  }
  throw new Fail("server_error", "could not generate login code");
}

export const studentRoutes = new Hono<HonoEnv>();

studentRoutes.post("/student/join", async (c) => {
  rateLimit(c, "join");
  const body = await readBody(c, joinSchema);
  const db = dbOf(c);
  const now = nowOf(c);
  const code = normalizeCode(body.code);

  const [invite] = await db.query<InviteRow>(`SELECT * FROM invite_codes WHERE code = $1`, [code]);
  if (!invite || !invite.active) throw new Fail("invalid_code");
  const school = await schoolById(db, invite.school_id);
  if (!school) throw new Fail("invalid_code");
  requireActive(school);
  requireFeature(school, "cloudStudents");
  if (invite.expires_at && new Date(isoRequired(invite.expires_at)) <= now) throw new Fail("expired");
  if (invite.max_uses !== null && invite.uses >= invite.max_uses) throw new Fail("limit_reached", "invite_max_uses");
  if (!body.consent) throw new Fail("consent_required");
  await assertStudentCapacity(db, school);

  // Atomic use increment guards maxUses under concurrency.
  const claimed = await db.query(
    `UPDATE invite_codes SET uses = uses + 1
     WHERE code = $1 AND (max_uses IS NULL OR uses < max_uses) RETURNING code`,
    [code]
  );
  if (!claimed.length) throw new Fail("limit_reached", "invite_max_uses");

  const studentId = newId();
  const [student] = await db.query<StudentRow>(
    `INSERT INTO students (id, school_id, display_name, phone, status, branch_id, instructor_id, source,
       consent_at, consent_version, linked_at, last_active_at, created_at)
     VALUES ($1, $2, $3, $4, 'registered', $5, $6, $7, $8, $9, $8, $8, $8) RETURNING *`,
    [
      studentId,
      school.id,
      body.displayName,
      school.collect_phone ? body.phone || null : null,
      invite.branch_id,
      invite.instructor_id,
      `invite:${invite.label ?? invite.code}`.slice(0, 120),
      now.toISOString(),
      body.consentVersion
    ]
  );
  const deviceToken = await issueDeviceToken(db, studentId, now);
  const loginCode = await issueLoginCode(db, studentId);
  const response: StudentAuthResponse = {
    student: await studentSelf(db, student!, school),
    deviceToken,
    loginCode
  };
  return c.json(response);
});

studentRoutes.post("/student/login", async (c) => {
  rateLimit(c, "login");
  const body = await readBody(c, loginSchema);
  const db = dbOf(c);
  const now = nowOf(c);
  const code = normalizeCode(body.loginCode);
  const [student] = await db.query<StudentRow>(`SELECT * FROM students WHERE login_code_hash = $1`, [sha256(code)]);
  if (!student) throw new Fail("invalid_code");
  const school = await schoolById(db, student.school_id);
  if (!school) throw new Fail("invalid_code");
  requireActive(school);
  requireFeature(school, "cloudStudents");
  const [updated] = await db.query<StudentRow>(
    `UPDATE students SET linked_at = coalesce(linked_at, $2), last_active_at = $2 WHERE id = $1 RETURNING *`,
    [student.id, now.toISOString()]
  );
  const deviceToken = await issueDeviceToken(db, student.id, now);
  const response: StudentAuthResponse = { student: await studentSelf(db, updated!, school), deviceToken };
  return c.json(response);
});

studentRoutes.get("/student/me", async (c) => {
  const { student, school } = await requireStudent(c);
  return c.json(await studentSelf(dbOf(c), student, school));
});

studentRoutes.get("/student/progress", async (c) => {
  const { student } = await requireStudent(c);
  return c.json({ progress: student.progress ?? null, savedAt: iso(student.progress_saved_at) });
});

studentRoutes.put("/student/progress", async (c) => {
  const { student, school } = await requireStudent(c);
  requireFeature(school, "cloudStudents");
  const body = await readBody(c, progressSyncSchema, MAX_PROGRESS_BYTES);
  const now = nowOf(c).toISOString();
  await dbOf(c).query(
    `UPDATE students SET progress = $2::text::jsonb, metrics = $3::text::jsonb, progress_saved_at = $4,
       last_active_at = $4, linked_at = coalesce(linked_at, $4),
       status = CASE WHEN status = 'registered' THEN 'practicing' ELSE status END
     WHERE id = $1`,
    [student.id, json(body.progress), json(body.metrics), now]
  );
  return c.json({ ok: true as const, savedAt: now });
});

studentRoutes.post("/student/login-code", async (c) => {
  const { student, school } = await requireStudent(c);
  requireFeature(school, "cloudStudents");
  return c.json({ loginCode: await issueLoginCode(dbOf(c), student.id) });
});

async function studentExport(c: Ctx, student: StudentRow, school: SchoolRow) {
  const db = dbOf(c);
  const appointments = await db.query<AppointmentRow>(
    `SELECT * FROM appointments WHERE student_id = $1 ORDER BY created_at`,
    [student.id]
  );
  const devices = await db.query<{ created_at: unknown; last_used_at: unknown }>(
    `SELECT created_at, last_used_at FROM device_tokens WHERE student_id = $1 ORDER BY created_at`,
    [student.id]
  );
  const fresh = (await schoolById(db, school.id)) ?? school;
  return {
    exportedAt: nowOf(c).toISOString(),
    school: { id: fresh.id, slug: fresh.slug, name: fresh.name },
    student: {
      id: student.id,
      displayName: student.display_name,
      phone: student.phone,
      status: student.status,
      package: student.package,
      branchId: student.branch_id,
      instructorId: student.instructor_id,
      paymentNote: student.payment_note,
      examDate: student.exam_date,
      lessonDate: student.lesson_date,
      notes: student.notes,
      source: student.source,
      interest: student.interest,
      consentAt: iso(student.consent_at),
      consentVersion: student.consent_version,
      linkedAt: iso(student.linked_at),
      lastActiveAt: iso(student.last_active_at),
      progressSavedAt: iso(student.progress_saved_at),
      createdAt: iso(student.created_at)
    },
    metrics: student.metrics,
    progress: student.progress,
    appointments: appointments.map((row) => ({
      kind: row.kind,
      preferredAt: row.preferred_at,
      status: row.status,
      message: row.message,
      createdAt: iso(row.created_at)
    })),
    devices: devices.map((row) => ({ createdAt: iso(row.created_at), lastUsedAt: iso(row.last_used_at) }))
  };
}

studentRoutes.get("/student/export", async (c) => {
  const { student, school } = await requireStudent(c);
  const data = await studentExport(c, student, school);
  await audit(c, "student.self_export", { schoolId: school.id, target: student.id, actorEmail: null });
  c.header("Content-Disposition", `attachment; filename="my-data-${student.id.slice(0, 8)}.json"`);
  return c.json(data);
});

studentRoutes.delete("/student/me", async (c) => {
  const { student, school } = await requireStudent(c);
  await deleteStudentData(dbOf(c), student.id);
  await audit(c, "student.self_delete", { schoolId: school.id, target: student.id, actorEmail: null });
  return c.json({ ok: true as const });
});
